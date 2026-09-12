import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  buildScenePlan,
  mountScene,
  requiredSemanticKeys,
  type SampleSource,
  type ScenePlan,
  type SceneHandle,
  type ThemeDocument,
} from '@vigilia/renderer-core';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';

/**
 * Display-only player entry point.
 *
 * SCAFFOLD STATUS: the renderer, the theme document and the update loop are
 * real; the **data is not**. Samples come from `@vigilia/fake-source`, which
 * fabricates them. The SignalR transport, theme delivery and pairing are Gate 1
 * and Gate 3 work, and swapping them in means replacing exactly one thing —
 * `source`, below — because the renderer only ever sees a
 * {@link SampleSource}.
 *
 * §116/§122: the phone renders; the PC acquires. This bundle must never poll
 * hardware, fetch API sensors or hold an unbounded history. The fake source
 * obeys that too: it computes values from a clock, it does not go looking for
 * any.
 *
 * §97 forbids presenting a fabricated reading as real, so while the fake source
 * is wired up the page says so on screen. That banner is not decoration — it is
 * the thing that stops a screenshot of this being mistaken for a measurement.
 */

// Import only what is used. §47's small-bundle requirement depends on this
// staying a narrow list — never switch to the `echarts` default bundle here.
// GridComponent is what the cartesian families (line, bar) need; the gauge and
// pie families do not use it.
echarts.use([GaugeChart, LineChart, BarChart, PieChart, GridComponent, CanvasRenderer]);

const artboardHost = document.querySelector<HTMLElement>('#artboard');

if (!artboardHost) {
  throw new Error('Artboard host element is missing.');
}

/**
 * How often the scene is rebuilt, in milliseconds.
 *
 * §122 requires sampling, transmission and animation rates to stay separate.
 * This is the *data* rate and it matches the 1 s hardware baseline; the chart
 * engine animates between values on its own, which is the local interpolation
 * §122 permits. Rebuilding at frame rate would burn a phone's battery to redraw
 * values that had not changed.
 */
const DATA_TICK_MS = 1000;

// Passed explicitly rather than read from the module scope: TypeScript cannot
// keep the null check's narrowing inside a hoisted function declaration, and a
// non-null assertion at each use would be the wrong way to silence that.
function start(host: HTMLElement): void {
  let theme: ThemeDocument;

  try {
    theme = loadDemoTheme();
  } catch (error) {
    showFailure(host, error instanceof Error ? error.message : String(error));
    return;
  }

  // The two lines that become the transport. Everything below is unaware of
  // where samples come from: it only ever sees a SampleSource.
  const fake = createDemoSource(Date.now());
  const source: SampleSource = fake;

  const plan = () =>
    buildScenePlan({
      document: theme,
      source,
      nowMs: Date.now(),
    });

  const first = plan();
  const handle = mountScene({ host, plan: first });

  reportIssues(first);
  showScaffoldBanner(requiredSemanticKeys(theme).length);

  let timer: number | undefined;

  const tick = (): void => {
    // Only the fake needs its clock pushed forward; a real source is advanced
    // by arriving samples, so this line goes away with the transport.
    fake.setNow(Date.now());
    handle.update(plan());
  };

  const run = (): void => {
    if (timer !== undefined) {
      return;
    }
    tick();
    timer = window.setInterval(tick, DATA_TICK_MS);
  };

  const pause = (): void => {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  // §124: pause unnecessary rendering when hidden or disconnected. A phone left
  // on a desk with the screen off must stop doing this work.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      run();
    } else {
      pause();
    }
  });

  // §51: one uniform transform for the whole artboard, recomputed for the new
  // viewport. Nothing reflows — the design is scaled, not re-laid-out (§57).
  window.addEventListener('resize', () => handle.resize());

  // A phone rotating fires resize before the new size settles on some WebViews,
  // so recompute once more after the orientation change completes.
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => handle.resize(), 200);
  });

  run();
  exposeForDiagnostics(handle);
}

/**
 * Reports what the frame could not express.
 *
 * Logged rather than drawn, for now: §141 wants explicit remapping surfaced in
 * UI, and a phone has no room for a diagnostics panel that has not been
 * designed. The values themselves already show a placeholder rather than a
 * fabricated number, which is the part that must not wait.
 */
function reportIssues(plan: ScenePlan): void {
  if (plan.issues.length === 0) {
    return;
  }

  console.warn(
    `Vigilia: ${plan.issues.length} binding or asset issue(s) in this theme:\n` +
      plan.issues.map((issue) => `  [${issue.code}] ${issue.nodeId}: ${issue.detail}`).join('\n'),
  );
}

/** The document did not load at all. Say so on screen rather than showing black. */
function showFailure(host: HTMLElement, message: string): void {
  const panel = document.createElement('pre');
  panel.textContent = `Vigilia could not load this theme.\n\n${message}`;
  panel.style.cssText =
    'position:absolute;inset:0;margin:0;padding:24px;color:#ff8f73;background:#14161c;' +
    "font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow:auto";
  host.append(panel);
}

/**
 * States plainly that the numbers are invented.
 *
 * Deliberately not dismissible and not styled to blend in. §97's rule is about
 * never presenting a fabricated reading as a real one, and a convincing demo
 * screenshot is the most likely way that happens by accident.
 */
function showScaffoldBanner(keyCount: number): void {
  const banner = document.createElement('div');
  banner.textContent = `SYNTHETIC DATA — ${keyCount} semantic keys served by @vigilia/fake-source, not by hardware`;
  banner.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:9;padding:6px 12px;text-align:center;' +
    'background:#4a2c00;color:#ffc14d;font:12px/1.4 ui-monospace,monospace;letter-spacing:0.04em';
  document.body.append(banner);
}

/**
 * Exposes the scene handle for manual poking in a browser console.
 *
 * Read-only convenience for development. Nothing in the app reads it, and it
 * carries no data a page could not already see.
 */
function exposeForDiagnostics(handle: SceneHandle): void {
  Reflect.set(window, 'vigilia', { handle });
}

start(artboardHost);

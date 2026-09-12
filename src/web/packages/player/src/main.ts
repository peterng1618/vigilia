import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';
import {
  buildScenePlan,
  createAssetResolver,
  missingFontFamilies,
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
// Both renderers are registered because §157 asks for the comparison to be
// measured rather than assumed: SVG trades draw speed for crisper scaling, and
// which wins depends on the reference phone. It also turns out to matter for
// reproducibility — canvas rasterisation is not byte-stable across page loads,
// SVG is — so `?renderer=svg` is how a deterministic capture of a chart is
// possible at all.
echarts.use([
  GaugeChart,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  CanvasRenderer,
  SVGRenderer,
]);

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

  // SCAFFOLD: which fixture to render. The transport will deliver the assigned
  // theme instead (§105 pairing), and this goes away with it — but until then a
  // selector is how the display path gets exercised against more than one
  // layout, which is what caught several rendering defects.
  const parameters = new URLSearchParams(window.location.search);
  const requested = parameters.get('theme') ?? 'demo';

  // Animation is off when the viewer asks for less motion, or when the URL says
  // so. Both are real settings rather than test hooks:
  //
  // - `prefers-reduced-motion` is an accessibility preference the OS reports,
  //   and a dashboard that ignores it animates in someone's peripheral vision
  //   all day.
  // - `?static=1` is for a still capture — and it is what makes a screenshot
  //   test deterministic, because a frame rendered without animation is a pure
  //   function of the clock. With animation on, a capture lands wherever the
  //   engine's transition happened to be.
  //
  // §124 also wants unnecessary rendering avoided, and transitions nobody
  // watches are the cheapest thing to give up.
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const animate = parameters.get('static') !== '1' && !reducedMotion;

  try {
    theme = loadDemoTheme(requested);
  } catch (error) {
    showFailure(host, error instanceof Error ? error.message : String(error));
    return;
  }

  // The two lines that become the transport. Everything below is unaware of
  // where samples come from: it only ever sees a SampleSource.
  const fake = createDemoSource(Date.now());
  const source: SampleSource = fake;

  // Assets are served from the site root here because the player's static
  // files are laid out that way. The host will serve a per-revision prefix
  // instead, so a published theme's assets are versioned and HTTP-cacheable
  // (§122) — which is a change to this one line, not to the renderer.
  const resolveAsset = createAssetResolver(theme.assets, { baseUrl: '/' });

  const plan = () =>
    buildScenePlan({
      document: theme,
      source,
      nowMs: Date.now(),
      resolveAsset,
      animate,
    });

  const first = plan();
  const chartRenderer = parameters.get('renderer') === 'svg' ? 'svg' : 'canvas';

  const handle = mountScene({
    host,
    plan: first,
    chartRenderer,
    onAssetError: (nodeId, src) => {
      // Declared by the theme, absent from what the server actually serves.
      // On the host this is a packaging bug; here it is a fact worth stating
      // rather than a blank rectangle nobody can explain.
      console.warn(`Vigilia: asset for node "${nodeId}" failed to load: ${src}`);
    },
  });

  reportIssues(first);
  reportMissingFonts(first);
  showScaffoldBanner(requiredSemanticKeys(theme).length, theme.metadata?.name ?? requested);

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

/**
 * Reports font families this device cannot provide (§89).
 *
 * Run after `document.fonts.ready` so a web font still downloading is not
 * mistaken for one that is absent. The text was already drawn — the boxes are
 * author-specified, so glyphs change but nothing moves — and this only says
 * which family is actually in use.
 */
function reportMissingFonts(plan: ScenePlan): void {
  void document.fonts.ready.then(() => {
    const missing = missingFontFamilies(plan);

    if (missing.length > 0) {
      console.warn(
        `Vigilia: ${missing.length} font family/families are unavailable on this device and ` +
          `a fallback is being used: ${missing.join(', ')}. Metrics will differ from the design.`,
      );
    }
  });
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
function showScaffoldBanner(keyCount: number, themeName: string): void {
  const banner = document.createElement('div');
  banner.textContent =
    `SYNTHETIC DATA — "${themeName}", ${keyCount} semantic keys served by ` +
    '@vigilia/fake-source, not by hardware';
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

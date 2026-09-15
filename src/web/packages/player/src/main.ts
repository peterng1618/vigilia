import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  SAMPLE_STREAM_PATH,
  buildScenePlan,
  createAssetResolver,
  createLiveSource,
  missingFontFamilies,
  mountScene,
  requiredSemanticKeys,
  type LiveSourceHandle,
  type LiveSourceStatus,
  type SampleSource,
  type ScenePlan,
  type SceneHandle,
  type ThemeDocument,
} from '@vigilia/renderer-core';
import { mountFabricScene } from '@vigilia/scene-fabric';
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
//
// **Canvas only.** The SVG renderer was registered so the two could be compared
// on the reference phone; a Fabric object draws by blitting a canvas and cannot
// reach SVG at all, so once the scene renders through Fabric the comparison has
// one reachable side and is moot. The comment here also used to claim SVG was
// what made a deterministic chart capture possible, and the repo's own
// measurements disprove it — `display.spec.ts` and
// `.agents/screenshots/README.md` both record that a frame containing a chart
// is not byte-reproducible on *either* renderer, clock frozen and animation off.
//
// This list only still exists for `mount.ts`, the DOM path. `scene-fabric`
// registers its own as a module side effect, and this goes when that path does.
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

  // Where samples come from. Everything below is unaware: it only ever sees a
  // SampleSource.
  //
  // `?data=live` opens the host's stream; anything else uses the fake. The
  // choice is **explicit in both directions and never inferred**, because the
  // tempting behaviour — try the host, fall back to synthetic when it is not
  // there — is precisely what §97 forbids. A dashboard that quietly swaps in
  // invented numbers when the host dies is worse than one that shows gaps,
  // and it is indistinguishable from working.
  //
  // The host redirects `/` to `?data=live`, so a phone pointed at the PC gets
  // real hardware; a bare `vite preview` keeps the fake, which is what the
  // browser tests and screenshots run against.
  const live = parameters.get('data') === 'live';
  const fake = live ? undefined : createDemoSource(Date.now());
  let source: SampleSource;
  let liveHandle: LiveSourceHandle | undefined;

  if (fake === undefined) {
    // Only the keys this theme actually binds (§111): the host polls the union
    // across connected displays, so asking for less genuinely acquires less.
    const keys = requiredSemanticKeys(theme);

    liveHandle = createLiveSource({
      url: `${SAMPLE_STREAM_PATH}?keys=${encodeURIComponent(keys.join(','))}`,
      onStatus: (status, detail) => showConnectionState(status, keys.length, detail),
    });
    source = liveHandle.source;
  } else {
    source = fake;
  }

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

  const onAssetError = (nodeId: string, src: string): void => {
    // Declared by the theme, absent from what the server actually serves. On
    // the host this is a packaging bug; here it is a fact worth stating rather
    // than a blank rectangle nobody can explain.
    console.warn(`Vigilia: asset for node "${nodeId}" failed to load: ${src}`);
  };

  // Which scene graph draws the frame. The DOM applier is still the default;
  // `?scene=fabric` is the migration's opt-in (spec 0013 stage 2), and it is
  // one call because both return the same `SceneHandle` — everything below,
  // including the update loop, the resize observer and the diagnostics hook, is
  // unaware of the choice. Stage 3 deletes the branch by flipping the default.
  //
  // Not `?renderer=`: that named the *chart* engine's renderer and is retired
  // in this same change, so reusing it would give one parameter two meanings.
  const handle =
    parameters.get('scene') === 'fabric'
      ? mountFabricScene({
          host,
          plan: first,
          onAssetError,
          onUnsupported: (nodeId, reason) => {
            // §85: a gap is marked, never approximated — and a gap nobody is
            // told about is indistinguishable from a rendering bug. These are
            // facts about the *renderer*, which is why they are not plan
            // issues.
            console.warn(`Vigilia: node "${nodeId}" cannot be drawn as authored — ${reason}`);
          },
        })
      : mountScene({ host, plan: first, onAssetError });

  reportIssues(first);
  reportMissingFonts(first);

  if (fake === undefined) {
    showConnectionState('connecting', requiredSemanticKeys(theme).length);
  } else {
    showScaffoldBanner(requiredSemanticKeys(theme).length, theme.metadata?.name ?? requested);
  }

  let timer: number | undefined;

  const tick = (): void => {
    // Only the fake needs its clock pushed forward. A live source is advanced
    // by arriving samples — the render loop stays on its own cadence, which is
    // §111's "keep sampling, transmission and animation rates separate".
    fake?.setNow(Date.now());
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
  //
  // A ResizeObserver rather than `window.resize`, because the observer runs
  // after layout and **before paint**: the new scale is in place for the very
  // first frame at the new size. The resize event fires after that frame, so it
  // paints one frame of the old scale — visible as a flash of overflow when a
  // desktop window is dragged, and as a brief crop when a phone rotates.
  const observer = new ResizeObserver(() => handle.resize());
  observer.observe(host);

  // A phone rotating settles its viewport in stages on some WebViews, and not
  // every stage resizes the observed element, so recompute once more after the
  // orientation change completes. Idempotent: re-fitting an unchanged viewport
  // recomputes the same transform.
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => handle.resize(), 200);
  });

  // Close the stream when the page goes away. §111 bounds per-client state on
  // the host, and a connection the browser has abandoned but not closed keeps
  // its keys in the polling union — so a phone navigating away would keep the
  // PC acquiring sensors nobody is looking at.
  window.addEventListener('pagehide', () => liveHandle?.close());

  run();
  exposeForDiagnostics(handle, liveHandle);
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
 * Shows the live connection's state, and only ever the truth about it.
 *
 * The counterpart to {@link showScaffoldBanner}: that one exists so synthetic
 * data can never be mistaken for real, and this one exists so a *stopped* host
 * can never be mistaken for a working one. A dashboard frozen on its last good
 * reading looks exactly like a dashboard that is up to date, which is the
 * failure §83 and §97 are both circling — so the state is on screen, not in
 * the console.
 *
 * `live` is the one state that says nothing: a working dashboard should be the
 * dashboard, not a dashboard with a badge on it.
 */
function showConnectionState(
  status: LiveSourceStatus,
  keyCount: number,
  detail?: string,
): void {
  const id = 'vigilia-connection';
  const existing = document.getElementById(id);

  if (status === 'live') {
    existing?.remove();
    return;
  }

  const message: Record<Exclude<LiveSourceStatus, 'live'>, string> = {
    connecting: `Connecting to the host — ${keyCount} sensors requested`,
    reconnecting: 'Lost the host. Values shown are the last received, not current.',
    refused: `The host is not compatible with this display${detail === undefined ? '' : `: ${detail}`}`,
  };

  const banner = existing ?? document.createElement('div');

  banner.id = id;
  banner.textContent = message[status];
  banner.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:9;padding:6px 12px;text-align:center;' +
    'font:12px/1.4 ui-monospace,monospace;letter-spacing:0.04em;' +
    (status === 'refused'
      ? 'background:#4a0000;color:#ff9a9a'
      : 'background:#003a4a;color:#7fdce9');

  if (existing === null) {
    document.body.append(banner);
  }
}

/**
 * Exposes the scene handle for manual poking in a browser console.
 *
 * Read-only convenience for development. Nothing in the app reads it, and it
 * carries no data a page could not already see.
 */
function exposeForDiagnostics(handle: SceneHandle, live?: LiveSourceHandle): void {
  // `live` is included so a browser test — and a person on a phone with a
  // remote console — can ask whether batches are actually arriving, rather
  // than inferring it from whether the numbers look plausible.
  Reflect.set(window, 'vigilia', { handle, live });
}

start(artboardHost);

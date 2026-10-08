import { createDemoSource, validThemeByName } from "@vigilia/fake-source";
import {
  type Binding,
  buildChartPlan,
  buildScenePlan,
  type ChartContent,
  createAssetResolver,
  createLiveSource,
  type FabricPalette,
  type FabricThemeEnvelope,
  type LiveSourceHandle,
  type MeasurementSystem,
  missingFontFamilies,
  type PlanIssue,
  requiredSemanticKeys,
  SAMPLE_STREAM_PATH,
  type SampleSource,
  type SceneHandle,
  type ScenePlan,
  type ThemeDocument,
  validateThemeDocument,
} from "@vigilia/renderer-core";
import {
  applyAuthoredText,
  loadFontAssets,
  mountFabricScene,
  refreshBoundText,
  reviveThemeEnvelope,
  startChartRefresh,
  VigiliaChart,
} from "@vigilia/scene-fabric";
import { Group } from "fabric/es";
import { boundSemanticKeys } from "./bound-keys.js";
import {
  showAvailabilityNotice,
  showConnectionState,
  showCropNotice,
  showScaffoldBanner,
} from "./chrome.js";
import { envelopePlan } from "./hosted-plan.js";
import { showLoadFailure } from "./load-failure.js";
import { followPublished } from "./publish-follower.js";
import { type DisplaySessionToken, displaySession } from "./session.js";
import {
  loadDisplayPreferences,
  loadHostedFontAssets,
  loadHostedTheme,
  ThemeLoadError,
} from "./theme-loader.js";

/** Display-only runtime. The phone renders; hardware acquisition stays on the host. */

const artboardHost = document.querySelector<HTMLElement>("#artboard");

if (!artboardHost) {
  throw new Error("Artboard host element is missing.");
}

const FIXTURE_THEME_IDS = new Set(["stress", "portrait-cover", "assets"]);
async function start(host: HTMLElement): Promise<void> {
  const parameters = new URLSearchParams(window.location.search);
  const requested = parameters.get("theme");

  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const animate = parameters.get("static") !== "1" && !reducedMotion;

  if (requested !== null && FIXTURE_THEME_IDS.has(requested)) {
    const theme = validThemeByName(requested);
    if (theme === undefined) {
      throw new Error(`Fixture theme "${requested}" is missing.`);
    }
    const result = validateThemeDocument(theme);
    if (!result.ok) {
      throw new Error(`Fixture theme "${requested}" is invalid.`);
    }
    startFixtureTheme(
      host,
      result.document,
      parameters,
      requested,
      animate,
      await loadDisplayPreferences(fetch),
    );
    return;
  }

  if (requested === null) {
    showLoadFailure(new ThemeLoadError("missing-id", "No ?theme=."));
    return;
  }

  try {
    const session = displaySession(
      window.location.href,
      window.fetch.bind(window),
    );
    await startHostedTheme(
      host,
      await loadHostedTheme(requested, session.fetch),
      session,
    );
  } catch (error) {
    showLoadFailure(error);
    return;
  }
}

/**
 * A glass panel this renderer cannot composite — an unsupported `ctx.filter`, a
 * cross-origin asset that taints the surface, a sample over the size ceiling.
 * The player has no user-visible diagnostic surface, so this follows the
 * convention `onUnsupported` already sets: a named, greppable warning rather
 * than a silently missing blur.
 */
function reportGlassError(message: string): void {
  console.warn(`Vigilia: glass cannot be rendered as authored — ${message}`);
}

/** A repaint that threw. Reported, not shown: the scene keeps rendering, so
 *  replacing it with a failure panel would hide a display that still works. */
function reportRepaintError(message: string): void {
  console.warn(`Vigilia: ${message}`);
}

/** A packaged face that would not load, or that declared no bytes. `loadFontAssets`
 *  reports and carries on, so the scene is already mounted and drawing in a
 *  fallback — the same case as `reportRepaintError`, and reported the same way.
 *  It used to take the display down, which turned a wrong typeface into a blank
 *  screen and a page that claims nothing is being shown. */
function reportFontError(message: string): void {
  console.warn(`Vigilia: ${message}`);
}

function startFixtureTheme(
  host: HTMLElement,
  theme: ThemeDocument,
  parameters: URLSearchParams,
  requested: string | null,
  animate: boolean,
  measurement: MeasurementSystem,
): void {
  declareDocumentLanguage(theme.metadata?.themeLanguage);
  // Fake vs live is explicit. Never fall back to invented data when live telemetry fails.
  const live = parameters.get("data") === "live";
  const fake = live ? undefined : createDemoSource(Date.now());
  let source: SampleSource;
  let liveHandle: LiveSourceHandle | undefined;

  if (fake === undefined) {
    const keys = requiredSemanticKeys(theme);

    liveHandle = createLiveSource({
      url: `${SAMPLE_STREAM_PATH}?keys=${encodeURIComponent(keys.join(","))}`,
      onStatus: (status, detail) =>
        showConnectionState(status, keys.length, detail),
    });
    source = liveHandle.source;
  } else {
    source = fake;
  }

  const resolveAsset = createAssetResolver(theme.assets, { baseUrl: "/" });

  const plan = () =>
    buildScenePlan({
      document: theme,
      source,
      nowMs: Date.now(),
      resolveAsset,
      animate,
      measurement,
    });

  const first = plan();

  const onAssetError = (nodeId: string, src: string): void => {
    console.warn(`Vigilia: asset for node "${nodeId}" failed to load: ${src}`);
  };

  const handle = mountFabricScene({
    host,
    plan: first,
    artboard: theme.artboard,
    assets: theme.assets ?? [],
    resolveAsset: (assetId) => {
      const url = resolveAsset(assetId);
      return url === undefined ? undefined : { url };
    },
    onAssetError,
    onUnsupported: (nodeId, reason) => {
      console.warn(
        `Vigilia: node "${nodeId}" cannot be drawn as authored — ${reason}`,
      );
    },
    onGlassError: reportGlassError,
  });

  reportIssues(first);
  reportMissingFonts(first);
  showCropNotice(handle, theme.artboard);

  if (fake === undefined) {
    showConnectionState("connecting", requiredSemanticKeys(theme).length);
  } else {
    showScaffoldBanner(
      requiredSemanticKeys(theme).length,
      theme.metadata?.name ?? requested ?? "fixture",
    );
  }

  let chartRefresh: ReturnType<typeof startChartRefresh> | undefined;

  const tick = (): void => {
    // Live sources advance on transport arrival; only the deterministic fake needs its clock moved.
    fake?.setNow(Date.now());
    handle.update(plan());
    // Refreshed here because a provider's reason only exists once data has
    // arrived; the notice removes itself when nothing is unreadable.
    if (fake === undefined) {
      showAvailabilityNotice(source, requiredSemanticKeys(theme));
    }
  };

  const run = (): void => {
    if (chartRefresh !== undefined) {
      return;
    }
    tick();
    chartRefresh = startChartRefresh(tick, 30, undefined, {
      onError: reportRepaintError,
    });
  };

  const pause = (): void => {
    if (chartRefresh !== undefined) {
      chartRefresh.dispose();
      chartRefresh = undefined;
    }
  };

  // Avoid rendering while the page is hidden.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      run();
    } else {
      pause();
    }
  });

  // ResizeObserver updates the artboard transform after layout and before paint.
  const observer = new ResizeObserver(() => handle.resize());
  observer.observe(host);

  // Some mobile WebViews settle orientation in stages; refit once after rotation completes.
  window.addEventListener("orientationchange", () => {
    window.setTimeout(() => handle.resize(), 200);
  });

  // Closing removes this display's keys from the host polling union, and
  // releases the scene: its glass handle, media layer and video frame callback
  // are not covered by anything else here. `once` because a `visibilitychange`
  // that arrives after this would otherwise restart the refresh loop against a
  // disposed scene.
  window.addEventListener(
    "pagehide",
    () => {
      liveHandle?.close();
      pause();
      observer.disconnect();
      handle.dispose();
    },
    { once: true },
  );

  run();
  exposeForDiagnostics(handle, liveHandle);
}

async function startHostedTheme(
  host: HTMLElement,
  theme: FabricThemeEnvelope,
  session: DisplaySessionToken,
): Promise<void> {
  declareDocumentLanguage(theme.metadata?.themeLanguage);
  // Fetch before allocating live resources so a failed font request has nothing to release.
  const fontBytes = await loadHostedFontAssets(theme.id, theme, session.fetch);
  const measurement = await loadDisplayPreferences(session.fetch);
  const keys = boundSemanticKeys(theme);
  const liveHandle = createLiveSource({
    url: session.streamUrl(
      SAMPLE_STREAM_PATH,
      new URLSearchParams({ keys: keys.join(",") }),
    ),
    onStatus: (status, detail) =>
      showConnectionState(status, keys.length, detail),
  });
  const resolveAsset = createAssetResolver(theme.assets, {
    baseUrl: `/api/themes/${encodeURIComponent(theme.id)}/`,
  });
  const handle = mountFabricScene({
    host,
    plan: envelopePlan(theme),
    artboard: theme.artboard,
    assets: theme.assets ?? [],
    resolveAsset: (assetId) => {
      const url = resolveAsset(assetId);
      // Fabric fetches these itself, so the token rides in the URL: a paired
      // phone could not load a packaged image or SVG without it. It goes on the
      // finished URL — a query belongs at the end of one, and the path this
      // resolver appends has to come before it.
      return url === undefined ? undefined : { url: session.withToken(url) };
    },
    onGlassError: reportGlassError,
  });
  const releaseFonts = await loadFontAssets({
    assets: theme.assets ?? [],
    bytes: fontBytes,
    onError: reportFontError,
  });
  // The scene's own asset references resolve here, the way background media
  // already does: an object that names a packaged image has to load from the
  // host, because the `src` the editor saved is a handle into that session.
  await reviveThemeEnvelope(handle.canvas, theme, (assetId) => {
    const url = resolveAsset(assetId);
    return url === undefined ? undefined : session.withToken(url);
  });
  // Every text object, bound or not, takes its box, its alignment and its
  // clip from the authored content once after revival. `refreshBoundText`
  // only visits objects a binding resolves, so without this an unbound label
  // would keep whatever geometry the save happened to carry.
  applyAuthoredText(handle.canvas, theme.globals, {
    ...(theme.bindings === undefined ? {} : { bindings: theme.bindings }),
  });
  const refresh = (): void => {
    hydrateCharts(
      handle.canvas.getObjects(),
      theme.bindings ?? {},
      liveHandle.source,
      theme.globals?.palette,
    );
    // Revived text carries the authored runs, not the sampled readings: the
    // saved scene keeps placeholders, so every cadence re-resolves the runs
    // through the bindings, the way a rebuilt plan would.
    refreshBoundText(
      handle.canvas,
      theme.bindings ?? {},
      liveHandle.source,
      theme.globals,
      measurement,
      theme.metadata?.themeLanguage,
    );
    handle.canvas.requestRenderAll();
    // Refreshed here because a provider's reason exists only once data has
    // arrived; the notice removes itself when nothing is unreadable.
    showAvailabilityNotice(liveHandle.source, keys);
  };

  refresh();
  // Measured after revival and the first text pass: before them the boxes on
  // the canvas are the saved ones, not the ones the display will draw.
  showCropNotice(handle, theme.artboard);
  showConnectionState("connecting", keys.length);
  // Only a host-served display follows a publish: a fixture theme is not
  // something an author is editing.
  const stopFollowing = followPublished(
    session,
    () => window.location.reload(),
    {
      onRefused: (reason) => showConnectionState("refused", 0, reason),
    },
  );
  const chartRefresh = startChartRefresh(refresh, 30, undefined, {
    onError: reportRepaintError,
  });
  const observer = new ResizeObserver(() => handle.resize());
  observer.observe(host);
  window.addEventListener(
    "pagehide",
    () => {
      releaseFonts();
      chartRefresh.dispose();
      observer.disconnect();
      // `pagehide` is `{ once: true }`, so a discarded handle would leave the
      // poll running for every display parked in the back/forward cache.
      stopFollowing();
      liveHandle.close();
      // The scene owns the glass handle, the media layer and any video frame
      // callback, and none of them is released by the teardown above.
      handle.dispose();
    },
    { once: true },
  );
  exposeForDiagnostics(handle, liveHandle);
}

function hydrateCharts(
  objects: readonly { get(key: string): unknown }[],
  bindings: Readonly<Record<string, readonly Binding[]>>,
  source: SampleSource,
  palette: FabricPalette | undefined,
): void {
  const issues: PlanIssue[] = [];
  for (const object of objects) {
    if (object instanceof VigiliaChart) {
      const id = object.get("id");
      if (typeof id !== "string") continue;
      // **Per chart, deliberately.** A chart that throws must cost that chart
      // and nothing else: this runs in the same callback as the text repaint
      // and the render, so an unguarded throw here would leave every reading on
      // the display frozen at whatever it last showed — which is a total
      // freeze caused by one bad option, and the defect this file already had
      // one level up in the frame loop.
      try {
        const content = {
          family: object.family,
          settings: object.settings,
        } as ChartContent;
        const plan = buildChartPlan(
          id,
          content,
          bindings[id] ?? [],
          {
            source,
            nowMs: Date.now(),
            animate: false,
          },
          issues,
          palette,
        );
        object.setOption(plan.option);
      } catch (error) {
        reportRepaintError(
          `Chart "${id}" failed to draw and was left as it was. ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    // A chart inside a group is still a chart a reader is watching, so the
    // walk goes into groups: the starter's cards are groups, and stopping at
    // the canvas would freeze every reading in the composition at load.
    if (object instanceof Group) {
      hydrateCharts(object.getObjects(), bindings, source, palette);
    }
  }
  // One line per distinct cause: this runs on every refresh cadence, and a
  // display repeating the same refusal every 30 s teaches nobody anything.
  for (const issue of issues) {
    const message = `Chart "${issue.nodeId}" ${issue.detail}`;
    if (reportedChartIssues.has(message)) continue;
    reportedChartIssues.add(message);
    reportRepaintError(message);
  }
}

const reportedChartIssues = new Set<string>();

/** Logs frame issues while affected values remain visibly missing rather than fabricated. */
function reportIssues(plan: ScenePlan): void {
  if (plan.issues.length === 0) {
    return;
  }

  console.warn(
    `Vigilia: ${plan.issues.length} binding or asset issue(s) in this theme:\n` +
      plan.issues
        .map((issue) => `  [${issue.code}] ${issue.nodeId}: ${issue.detail}`)
        .join("\n"),
  );
}

/** Reports unavailable fonts after browser font loading settles. */
function reportMissingFonts(plan: ScenePlan): void {
  void document.fonts.ready.then(() => {
    const missing = missingFontFamilies(plan);

    if (missing.length > 0) {
      console.warn(
        `Vigilia: ${missing.length} font family/families are unavailable on this device and ` +
          `a fallback is being used: ${missing.join(", ")}. Metrics will differ from the design.`,
      );
    }
  });
}

/**
 * Declares the theme's language on the page that shows it.
 *
 * The author's Language setting says what the text on this display is written
 * in, and the page said `en` whatever it was. `dir` is the half that matters
 * most and costs nothing to get right: Arabic and Urdu are both offered, and
 * without it the player's own chrome lays out left-to-right under a theme that
 * reads right-to-left. Both come from the runtime — `Intl.Locale` knows a
 * language's script and direction, and a hand-written table of fifteen would
 * be a worse copy of it that drifts from CLDR.
 *
 * The theme's own strings are the author's text and are left exactly as
 * authored; this declares the page they sit in.
 */
function declareDocumentLanguage(themeLanguage: string | undefined): void {
  if (themeLanguage === undefined || themeLanguage.length === 0) return;
  try {
    const { language, script } = new Intl.Locale(themeLanguage);
    const root = document.documentElement;
    root.lang = script === undefined ? language : `${language}-${script}`;
    const direction = new Intl.Locale(themeLanguage).getTextInfo?.().direction;
    if (direction === "rtl") root.dir = "rtl";
    else root.removeAttribute("dir");
  } catch {
    // A tag this runtime cannot parse leaves the page as it was, which is the
    // same place a document with no declared language starts.
  }
}

/** Development-only access to scene/live handles; the app never reads this. */
function exposeForDiagnostics(
  handle: SceneHandle,
  live?: LiveSourceHandle,
): void {
  Reflect.set(window, "vigilia", { handle, live });
}

void start(artboardHost);

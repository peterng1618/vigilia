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
  type LiveSourceStatus,
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
  type FabricSceneHandle,
  loadFontAssets,
  mountFabricScene,
  refreshBoundText,
  reviveThemeEnvelope,
  startChartRefresh,
  VigiliaChart,
} from "@vigilia/scene-fabric";
import { type FabricObject, Group } from "fabric/es";
import { availabilityNoticeText } from "./availability-notice.js";
import {
  type ArtboardSize,
  cropNoticeText,
  type SceneBox,
} from "./artboard-crop.js";
import { type DisplaySessionToken, displaySession } from "./session.js";
import {
  loadDisplayPreferences,
  loadHostedFontAssets,
  loadHostedTheme,
} from "./theme-loader.js";
import { uiCopy } from "./ui-copy.js";

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
    showFailure(host, "A theme id is required.");
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
    showFailure(host, error instanceof Error ? error.message : String(error));
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

function startFixtureTheme(
  host: HTMLElement,
  theme: ThemeDocument,
  parameters: URLSearchParams,
  requested: string | null,
  animate: boolean,
  measurement: MeasurementSystem,
): void {
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
  // Fetch before allocating live resources so a failed font request has nothing to release.
  const fontBytes = await loadHostedFontAssets(theme.id, theme, session.fetch);
  const measurement = await loadDisplayPreferences(session.fetch);
  const keys = Object.values(theme.bindings ?? {})
    .flat()
    .map((binding) => binding.semanticKey);
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
    onError: (message) => showFailure(host, message),
  });
  await reviveThemeEnvelope(handle.canvas, theme);
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
      theme.metadata?.locale,
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
      liveHandle.close();
      // The scene owns the glass handle, the media layer and any video frame
      // callback, and none of them is released by the teardown above.
      handle.dispose();
    },
    { once: true },
  );
  exposeForDiagnostics(handle, liveHandle);
}

function envelopePlan(theme: FabricThemeEnvelope): ScenePlan {
  return {
    artboard: {
      width: theme.artboard.width,
      height: theme.artboard.height,
      fitMode: theme.artboard.fitMode ?? "contain",
      background: theme.artboard.background ?? "#000",
      barColor: theme.artboard.barColor ?? "#000",
    },
    nodes: [],
    issues: [],
  };
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

/** Shows a document-load failure on screen rather than leaving a blank display. */
function showFailure(host: HTMLElement, message: string): void {
  const panel = document.createElement("pre");
  panel.textContent = uiCopy.loadFailure(message);
  panel.style.cssText =
    "position:absolute;inset:0;margin:0;padding:24px;color:#ff8f73;background:#14161c;" +
    "font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow:auto";
  host.append(panel);
}

/**
 * Names the sensors this display cannot read, and why. Section 97 requires an
 * unavailable sensor to explain itself; without this the consumer sees empty
 * charts and no reason for them.
 *
 * Renders nothing when every key has a reading. The wording is
 * `availabilityNoticeText`'s, which groups by cause so a reason shared by
 * several sensors is said once rather than repeated in a row.
 */
function showAvailabilityNotice(
  source: SampleSource,
  semanticKeys: readonly string[],
): void {
  const id = "vigilia-availability";
  document.getElementById(id)?.remove();

  const text = availabilityNoticeText(
    semanticKeys.map((key) => source.latest(key)),
  );

  if (text === undefined) {
    return;
  }

  const notice = document.createElement("div");
  notice.id = id;
  notice.dataset["vigiliaAvailability"] = "";
  notice.textContent = text;
  notice.style.cssText =
    "padding:6px 12px;text-align:center;" +
    "background:#3a2a00;color:#ffce6a;font:12px/1.4 ui-monospace,monospace;letter-spacing:0.02em";
  topNotices().append(notice);
}

/**
 * The full-width strips along the display's top edge, stacked.
 *
 * A column rather than a `position: fixed` strip per notice: a theme can be
 * both short of a reading and holding objects the artboard does not contain,
 * and two fixed strips at `top: 0` would draw over one another. Section 97
 * wants those two gaps to look different, not to hide one another.
 */
function topNotices(): HTMLElement {
  const id = "vigilia-notices";
  const existing = document.getElementById(id);
  if (existing !== null) return existing;

  const column = document.createElement("div");
  column.id = id;
  column.style.cssText =
    "position:fixed;left:0;right:0;top:0;z-index:9;display:flex;flex-direction:column";
  document.body.append(column);
  return column;
}

/**
 * Says what this artboard does not contain, and that it is not being shown.
 *
 * The other notices here all describe the *transport* — a sensor with no
 * reading, a host that went away. This one describes the *composition*, and it
 * is told once and left: no reading arriving will bring a cropped panel back,
 * and a strip that came and went would read as a fault the display recovered
 * from. Only a re-saved theme can change it.
 */
function showCropNotice(
  handle: FabricSceneHandle,
  artboard: ArtboardSize,
): void {
  document.getElementById("vigilia-crop")?.remove();

  const text = cropNoticeText(sceneBoxes(handle.canvas.getObjects()), artboard);
  if (text === undefined) return;

  const notice = document.createElement("div");
  notice.id = "vigilia-crop";
  notice.dataset["vigiliaCrop"] = "";
  notice.textContent = text;
  // Slate rather than the amber of `showAvailabilityNotice`: a missing reading
  // is this instant's news and a crop is a standing property of the theme, and
  // §97 requires the two gaps not to read as the same kind of gap.
  notice.style.cssText =
    "padding:6px 12px;text-align:center;" +
    "background:#1d2230;color:#c3cde3;font:12px/1.4 ui-monospace,monospace;letter-spacing:0.02em";
  topNotices().append(notice);
}

/** Each object on the canvas, in artboard units. Fabric's `getBoundingRect` is
 *  in the scene plane, which is the artboard's own units before the viewport
 *  transform — the numbers the artboard is measured in. Recursed into groups,
 *  because a group placed half off the artboard takes its children with it and
 *  a reader is missing every one of them. */
function sceneBoxes(objects: readonly FabricObject[]): SceneBox[] {
  return objects.flatMap((object) => {
    const rect = object.getBoundingRect();
    const box: SceneBox = {
      visible: object.visible,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    return object instanceof Group
      ? [box, ...sceneBoxes(object.getObjects())]
      : [box];
  });
}

/** Persistent disclosure that displayed values are synthetic. */
function showScaffoldBanner(keyCount: number, themeName: string): void {
  const banner = document.createElement("div");
  banner.textContent = uiCopy.syntheticData(themeName, keyCount);
  banner.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:9;padding:6px 12px;text-align:center;" +
    "background:#4a2c00;color:#ffc14d;font:12px/1.4 ui-monospace,monospace;letter-spacing:0.04em";
  document.body.append(banner);
}

/** Shows non-live connection states; a healthy live display needs no badge. */
function showConnectionState(
  status: LiveSourceStatus,
  keyCount: number,
  detail?: string,
): void {
  const id = "vigilia-connection";
  const existing = document.getElementById(id);

  if (status === "live") {
    existing?.remove();
    return;
  }

  const banner = existing ?? document.createElement("div");

  banner.id = id;
  banner.textContent =
    status === "refused"
      ? uiCopy.connection.refused(detail)
      : status === "connecting"
        ? uiCopy.connection.connecting(keyCount)
        : uiCopy.connection.reconnecting;
  banner.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:9;padding:6px 12px;text-align:center;" +
    "font:12px/1.4 ui-monospace,monospace;letter-spacing:0.04em;" +
    (status === "refused"
      ? "background:#4a0000;color:#ff9a9a"
      : "background:#003a4a;color:#7fdce9");

  if (existing === null) {
    document.body.append(banner);
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

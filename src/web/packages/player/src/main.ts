import { createDemoSource, validThemeByName } from "@vigilia/fake-source";
import {
  type Binding,
  buildChartPlan,
  buildScenePlan,
  type ChartContent,
  createAssetResolver,
  createLiveSource,
  type FabricThemeEnvelope,
  type LiveSourceHandle,
  type LiveSourceStatus,
  missingFontFamilies,
  requiredSemanticKeys,
  SAMPLE_STREAM_PATH,
  type SampleSource,
  type SceneHandle,
  type ScenePlan,
  type ThemeDocument,
  validateThemeDocument,
} from "@vigilia/renderer-core";
import {
  loadFontAssets,
  mountFabricScene,
  reviveThemeEnvelope,
  startChartRefresh,
  VigiliaChart,
} from "@vigilia/scene-fabric";
import { type DisplaySessionToken, displaySession } from "./session.js";
import { loadHostedFontAssets, loadHostedTheme } from "./theme-loader.js";
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
    startFixtureTheme(host, result.document, parameters, requested, animate);
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
      parameters,
      session,
    );
  } catch (error) {
    showFailure(host, error instanceof Error ? error.message : String(error));
    return;
  }
}

function startFixtureTheme(
  host: HTMLElement,
  theme: ThemeDocument,
  parameters: URLSearchParams,
  requested: string | null,
  animate: boolean,
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
  });

  reportIssues(first);
  reportMissingFonts(first);

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
  };

  const run = (): void => {
    if (chartRefresh !== undefined) {
      return;
    }
    tick();
    chartRefresh = startChartRefresh(tick, 30);
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

  // Closing removes this display's keys from the host polling union.
  window.addEventListener("pagehide", () => liveHandle?.close());

  run();
  exposeForDiagnostics(handle, liveHandle);
}

async function startHostedTheme(
  host: HTMLElement,
  theme: FabricThemeEnvelope,
  parameters: URLSearchParams,
  session: DisplaySessionToken,
): Promise<void> {
  // Fetch before allocating live resources so a failed font request has nothing to release.
  const fontBytes = await loadHostedFontAssets(theme.id, theme, session.fetch);
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
    // Fabric fetches these itself, so the token rides in the URL: a paired
    // phone could not load a packaged image or SVG without it.
    baseUrl: session.withToken(
      `/api/themes/${encodeURIComponent(parameters.get("theme") ?? "")}/`,
    ),
  });
  const handle = mountFabricScene({
    host,
    plan: envelopePlan(theme),
    artboard: theme.artboard,
    assets: theme.assets ?? [],
    resolveAsset: (assetId) => {
      const url = resolveAsset(assetId);
      return url === undefined ? undefined : { url };
    },
  });
  const releaseFonts = await loadFontAssets({
    assets: theme.assets ?? [],
    bytes: fontBytes,
    onError: (message) => showFailure(host, message),
  });
  await reviveThemeEnvelope(handle.canvas, theme);
  const refresh = (): void => {
    hydrateCharts(
      handle.canvas.getObjects(),
      theme.bindings ?? {},
      liveHandle.source,
    );
    handle.canvas.requestRenderAll();
  };

  refresh();
  showConnectionState("connecting", keys.length);
  const chartRefresh = startChartRefresh(refresh, 30);
  const observer = new ResizeObserver(() => handle.resize());
  observer.observe(host);
  window.addEventListener(
    "pagehide",
    () => {
      releaseFonts();
      chartRefresh.dispose();
      observer.disconnect();
      liveHandle.close();
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
): void {
  for (const object of objects) {
    if (object instanceof VigiliaChart) {
      const id = object.get("id");
      if (typeof id === "string") {
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
          [],
          undefined,
        );
        object.setOption(plan.option);
      }
    }
  }
}

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

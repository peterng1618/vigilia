import {
  type FabricThemeEnvelope,
  type FabricThemeEnvelopeInput,
} from "@vigilia/renderer-core";
import {
  assertFabricThemeEnvelopeCompatible,
  type ChartRefreshRate,
  loadFontAssets,
  startChartRefresh,
} from "@vigilia/scene-fabric";
import type { ArtboardSize } from "./artboard-presets.js";
import { AssetManager } from "./asset-manager/index.js";
import { EditorSession } from "./editor-session.js";
import {
  createEditorShellBridge,
  type EditorShellBridge,
} from "./editor-shell/bridge.js";
import type { EditorViewControls } from "./editor-shell/session-facade.js";
import { createShellLayout } from "./editor-shell/shell-layout.js";
import { mountEditorShell } from "./editor-shell.js";
import "./editor-shell/editor-shell.css";
import { bootTheme } from "./boot-theme.js";
import { createEditorSource } from "./live-source.js";
import {
  createBlankFabricTheme,
  createNewFabricTheme,
} from "./new-fabric-theme.js";
import { parseThemePackage } from "./persist.js";
import { DEFAULT_RUN_DISPLAY_MODE } from "./run-placeholder.js";
import { loadStarterBackdrop } from "./starter-backdrop.js";
import { createThemeLibraryClient } from "./theme-library-client.js";
import { captureCanvas } from "./thumbnail-capture.js";

type EditorSource = ReturnType<typeof createEditorSource>;
type ActiveEditor = {
  readonly shell: Awaited<ReturnType<typeof mountEditorShell>>;
  readonly extensions: EditorSession;
  readonly releaseFonts: () => void;
  readonly bridge: EditorShellBridge;
  source: EditorSource;
};

async function start(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (root === null) {
    throw new Error("Editor shell is missing #app.");
  }

  const libraryClient = createThemeLibraryClient();
  let mode: "preview" | "live" = "preview";
  let active: ActiveEditor | undefined;
  let chartRefreshRate: ChartRefreshRate = 30;

  const layout = createShellLayout(root);
  const host = layout.hosts.canvas;
  const status = layout.hosts.status;
  // A pointer gesture owns the canvas for its duration. The refresh loop runs
  // at 30fps and a full repaint erases Fabric's drag marquee — which is drawn
  // straight onto the context, not into the scene — so the marquee survived
  // about 33ms and then vanished until the pointer moved again. Live readings
  // are not worth showing mid-drag anyway; the next frame after `mouse:up`
  // brings them current.
  //
  // **A panel gesture is deliberately not this guard.** A palette drag reaches
  // the canvas only through the loop: the session hands new globals to six
  // owners and none of them repaints text, so pausing the loop for one would
  // freeze the very preview the drag exists to produce. The loop's cost went
  // down instead — see `LiveRuntime.tick` — rather than away during a gesture.
  const gesture = { down: false };
  const chartRefresh = startChartRefresh(
    () => {
      if (gesture.down) return;
      active?.extensions.tick();
    },
    chartRefreshRate,
    undefined,
    // The session is mounted later, so the report is routed through whatever is
    // current; a throw before one exists is still logged.
    {
      onError: (message) => {
        const manager = active?.shell.editor.errorManager;
        if (manager === undefined) console.warn(`[vigilia:repaint] ${message}`);
        else manager.warn("controls", message);
      },
    },
  );
  /** Document actions come from the session once it exists; the View menu's
   * source/refresh controls are owned here and only dispatch through it. */
  const viewControls: EditorViewControls = {
    sourceMode: () => mode,
    setSourceMode: (next) => {
      mode = next;
      replaceSource();
    },
    runDisplay: () =>
      active?.extensions.runDisplay() ?? DEFAULT_RUN_DISPLAY_MODE,
    setRunDisplay: (runMode) => active?.extensions.setRunDisplay(runMode),
    chartRefreshRate: () => chartRefreshRate,
    setChartRefreshRate: (rate) => {
      chartRefreshRate = rate;
      chartRefresh.setRate(rate);
      active?.extensions.charts.setRefreshRate(rate);
    },
  };

  const createSource = (envelope: FabricThemeEnvelopeInput): EditorSource =>
    createEditorSource({
      mode,
      keys: semanticKeys(envelope),
      onStatus: (sourceStatus, detail) => {
        status.textContent = `${mode === "preview" ? "Preview" : "Live"}: ${detail ?? sourceStatus}`;
      },
    });

  const replaceSource = (): void => {
    if (active === undefined) return;
    const source = createSource(active.extensions.envelope);
    active.source.close();
    active.extensions.setSource(source.source);
    active.source = source;
  };

  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".vigilia-theme";
  picker.hidden = true;
  host.parentElement!.append(picker);

  const mount = async (next: {
    readonly input: FabricThemeEnvelopeInput;
    readonly envelope: FabricThemeEnvelope;
    readonly assets?: Readonly<Record<string, Uint8Array>>;
    readonly thumbnail?: Uint8Array;
    /** The stored document this one came from, when it came from the library.
     *  A new session is built on every mount, so the base has to arrive with
     *  the document rather than be remembered by the one being replaced. */
    readonly base?: string;
  }) => {
    assertFabricThemeEnvelopeCompatible(next.envelope);
    const releaseFonts = await loadFontAssets({
      assets: next.envelope.assets ?? [],
      bytes: next.assets ?? {},
      onError: (message) => {
        status.textContent = message;
      },
    });
    const source = createSource(next.input);
    // The shell revives the scene before a session exists, and Fabric enlivens
    // an image from `src` alone. A pasted image's persisted `src` is the dead
    // `blob:` URL of the session that saved it, so without bytes in hand by
    // then the object is not revived broken — it is not revived at all, and the
    // next save drops it. One manager, loaded here where the document and its
    // bytes first meet, and handed to the session rather than a second copy.
    const assetManager = new AssetManager();
    assetManager.load(
      next.envelope.assets === undefined
        ? {}
        : { assets: next.envelope.assets },
      next.assets ?? {},
    );
    let shell: Awaited<ReturnType<typeof mountEditorShell>>;
    try {
      shell = await mountEditorShell({
        host,
        artboard: next.input.artboard,
        envelope: next.envelope,
        resolveSceneAsset: (assetId) => assetManager.previewUrl(assetId),
      });
    } catch (error) {
      assetManager.destroy();
      releaseFonts();
      throw error;
    }
    const options = {
      shell,
      source: source.source,
      envelope: next.input,
      // The package's own picture, so a theme keeps the look its author saw
      // even where this machine cannot render one.
      ...(next.thumbnail === undefined ? {} : { thumbnail: next.thumbnail }),
      ...(next.base === undefined ? {} : { libraryBase: next.base }),
      assetManager,
      panelHosts: {
        add: layout.hosts.add,
        assets: layout.hosts.assets,
        document: layout.hosts.document,
        chart: layout.hosts.chart,
        selection: layout.hosts.selection,
        style: layout.hosts.style,
      },
      libraryClient,
      onBindingsChange: replaceSource,
      onNew: async (artboard: ArtboardSize) => {
        const fresh = createBlankFabricTheme(artboard);
        await mount({
          input: envelopeInputFor(fresh),
          envelope: fresh,
        });
        status.textContent = "New theme";
      },
      // The reference composition, reachable as what it is: a template the
      // product ships, not what a new document means.
      onNewFromStarter: async () => {
        const fresh = createNewFabricTheme();
        await mount({
          input: envelopeInputFor(fresh),
          envelope: fresh,
          assets: await starterAssets(),
        });
        status.textContent = "New theme from the starter";
      },
      onOpenPackage: () => picker.click(),
      onOpenTheme: async (
        envelope: FabricThemeEnvelope,
        assets: Readonly<Record<string, Uint8Array>>,
        base?: string,
      ) => {
        await mount({
          input: envelopeInputFor(envelope),
          envelope,
          assets,
          ...(base === undefined ? {} : { base }),
        });
        status.textContent = `Opened ${envelope.metadata?.name ?? envelope.id}`;
      },
      onSaved: (msg: string | undefined) => {
        status.textContent = msg ?? "Fabric theme saved";
      },
      onError: (msg: string) => {
        status.textContent = msg;
      },
    };
    const extensions = new EditorSession(options);
    await extensions.hydrateAssets(shell);
    const bridge = createEditorShellBridge({
      editor: shell.editor,
      session: extensions.actionFacade(),
      // The envelope is the only owner of a binding, so the layer row's bound
      // key is pulled from the live session rather than from the copy this
      // mount opened with — a binding edited afterwards would otherwise leave
      // the row naming a key the document no longer declares.
      bindings: () => extensions.envelope.bindings ?? {},
      capture: () =>
        captureCanvas(shell.editor.canvas, shell.backdrop())?.toDataURL(
          "image/png",
        ),
    });
    active?.bridge.destroy();
    delete (window as unknown as Record<string, unknown>).vigiliaEditorBridge;
    active?.extensions.destroy();
    active?.shell.destroy();
    active?.source.close();
    active?.releaseFonts();
    active = { shell, extensions, source, releaseFonts, bridge };
    /** e2e drives a rename through the same bridge the layer panel calls, so the
     * global is published only after the previous document's is torn down. */
    (window as unknown as Record<string, unknown>).vigiliaEditorBridge = bridge;
    layout.setBridge(bridge, viewControls);
    // Bound per document, because the canvas is torn down and rebuilt with it.
    const canvas = shell.editor.canvas;
    canvas.on(
      "mouse:down" as never,
      (() => {
        gesture.down = true;
      }) as never,
    );
    canvas.on(
      "mouse:up" as never,
      (() => {
        gesture.down = false;
      }) as never,
    );
  };

  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    picker.value = "";
    if (file === undefined) return;
    void file.arrayBuffer().then(async (buffer) => {
      const bytes = new Uint8Array(buffer);
      const parsed = parseThemePackage(bytes);
      if (!parsed.ok) {
        status.textContent = `Could not open: ${parsed.message}`;
        return;
      }
      try {
        await mount({
          input: envelopeInputFor(parsed.envelope),
          envelope: parsed.envelope,
          assets: parsed.assets,
          ...(parsed.thumbnail === undefined
            ? {}
            : { thumbnail: parsed.thumbnail }),
        });
        status.textContent = `Opened ${file.name}`;
      } catch (error) {
        status.textContent = `Could not open: ${error instanceof Error ? error.message : String(error)}`;
      }
    });
  });

  window.addEventListener("pagehide", () => chartRefresh.dispose(), {
    once: true,
  });
  // The browser owns this dialog's wording and leaves no room to say what would
  // be lost, so it can only ask. It asks the session's own comparison rather
  // than a second one, so a document saved since the last edit stays silent —
  // a warning the author learns to dismiss is the same as no warning.
  window.addEventListener("beforeunload", (event) => {
    if (active?.extensions.isDirty() !== true) return;
    event.preventDefault();
    event.returnValue = "";
  });
  // A saved theme the author came back to, rather than the reference
  // composition the editor ships. Nothing is open yet, so there is nothing to
  // confirm over; the document this replaces is the one that never opened.
  const requested = await bootTheme(window.location.search, libraryClient);
  if (requested !== undefined) {
    await mount({
      input: envelopeInputFor(requested.envelope),
      envelope: requested.envelope,
      assets: requested.assets,
      ...(requested.base === undefined ? {} : { base: requested.base }),
    });
    status.textContent = `Opened ${requested.envelope.metadata?.name ?? requested.envelope.id}`;
    return;
  }
  const theme = createNewFabricTheme();
  await mount({
    input: envelopeInputFor(theme),
    envelope: theme,
    assets: await starterAssets(),
  });
  status.textContent = "Fabric editor ready";
}

/**
 * The starter's own declared bytes, read once.
 *
 * A new theme declares a packaged backdrop, and a declaration without bytes is
 * a broken theme: the media layer would report it unreadable and the artboard
 * would show nothing behind the glass. A package opened from disk brings its
 * own, which is why this is only wired into the two paths that *build* the
 * starter. `docs/decisions/0011`.
 */
let starterBytes: Promise<Readonly<Record<string, Uint8Array>>> | undefined;
function starterAssets(): Promise<Readonly<Record<string, Uint8Array>>> {
  starterBytes ??= loadStarterBackdrop();
  return starterBytes;
}

void start();

function semanticKeys(envelope: FabricThemeEnvelopeInput): readonly string[] {
  return [
    ...new Set(
      Object.values(envelope.bindings ?? {}).flatMap((bindings) =>
        bindings.map((binding) => binding.semanticKey),
      ),
    ),
  ];
}

function envelopeInputFor(
  envelope: FabricThemeEnvelope,
): FabricThemeEnvelopeInput {
  const {
    schemaVersion: _schemaVersion,
    fabricVersion: _fabricVersion,
    scene: _scene,
    ...input
  } = envelope;
  return input;
}

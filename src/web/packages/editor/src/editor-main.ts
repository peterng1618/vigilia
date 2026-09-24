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
import { EditorSession } from "./editor-session.js";
import {
  createEditorShellBridge,
  type EditorShellBridge,
} from "./editor-shell/bridge.js";
import type { EditorViewControls } from "./editor-shell/session-facade.js";
import { createShellLayout } from "./editor-shell/shell-layout.js";
import { mountEditorShell } from "./editor-shell.js";
import "./editor-shell/editor-shell.css";
import { createEditorSource } from "./live-source.js";
import { createNewFabricTheme } from "./new-fabric-theme.js";
import { parseThemePackage } from "./persist.js";
import { createThemeLibraryClient } from "./theme-library-client.js";

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
  const chartRefresh = startChartRefresh(
    () => active?.extensions.refresh(),
    chartRefreshRate,
  );
  /** Document actions come from the session once it exists; the View menu's
   * source/refresh controls are owned here and only dispatch through it. */
  const viewControls: EditorViewControls = {
    sourceMode: () => mode,
    setSourceMode: (next) => {
      mode = next;
      replaceSource();
    },
    runDisplay: () => active?.extensions.runDisplay() ?? "tokens",
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
    let shell: Awaited<ReturnType<typeof mountEditorShell>>;
    try {
      shell = await mountEditorShell({
        host,
        artboard: next.input.artboard,
        envelope: next.envelope,
      });
    } catch (error) {
      releaseFonts();
      throw error;
    }
    const options = {
      shell,
      source: source.source,
      envelope: next.input,
      ...(next.assets === undefined ? {} : { assets: next.assets }),
      panelHosts: {
        layers: layout.hosts.layers,
        add: layout.hosts.add,
        assets: layout.hosts.assets,
        document: layout.hosts.document,
        chart: layout.hosts.chart,
        selection: layout.hosts.selection,
        style: layout.hosts.style,
      },
      libraryClient,
      onBindingsChange: replaceSource,
      onNew: async () => {
        const fresh = createNewFabricTheme();
        await mount({ input: envelopeInputFor(fresh), envelope: fresh });
        status.textContent = "New Fabric theme";
      },
      onOpenPackage: () => picker.click(),
      onOpenTheme: async (
        envelope: FabricThemeEnvelope,
        assets: Readonly<Record<string, Uint8Array>>,
      ) => {
        await mount({ input: envelopeInputFor(envelope), envelope, assets });
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
    });
    active?.bridge.destroy();
    active?.extensions.destroy();
    active?.shell.destroy();
    active?.source.close();
    active?.releaseFonts();
    active = { shell, extensions, source, releaseFonts, bridge };
    layout.setBridge(bridge, viewControls);
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
  const theme = createNewFabricTheme();
  await mount({
    input: envelopeInputFor(theme),
    envelope: theme,
  });
  status.textContent = "Fabric editor ready";
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

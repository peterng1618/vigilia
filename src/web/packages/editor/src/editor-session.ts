import {
  type Artboard,
  type Binding,
  bumpSemanticVersion,
  type FabricPalette,
  type FabricThemeEnvelope,
  type FabricThemeEnvelopeInput,
  type SampleSource,
} from "@vigilia/renderer-core";
import { applyArrange, canArrange } from "./arrange.js";
import { type ArtboardPanel, createArtboardPanel } from "./artboard-panel.js";
import { AssetManager, createAssetPanel } from "./asset-manager/index.js";
import { ChartManager } from "./chart-manager/index.js";
import type { EditorActionFacade } from "./editor-shell/session-facade.js";
import { type EditorShell } from "./editor-shell.js";
import {
  applyFontTrio,
  type CuratedFontFace,
  fontTrio,
} from "./font-catalog.js";
import { previewFontFace, releaseFontPreview } from "./font-preview.js";
import {
  createIndicatorManager,
  type IndicatorManager,
} from "./indicator-manager/index.js";
import { createLayerPanel, type LayerPanel } from "./layer-panel.js";
import { LiveRuntime } from "./live-runtime.js";
import { createNewTextDefaults } from "./new-object-defaults.js";
import {
  createNewObjectPanel,
  type NewObjectPanel,
} from "./new-object-panel.js";
import {
  createPalettePanel,
  type PalettePanel,
  reassignPaletteToken,
} from "./palette-manager/index.js";
import { parseThemePackage, serializeThemePackage } from "./persist.js";
import {
  confirmDocumentReplacement,
  PersistenceManager,
} from "./persistence-manager/index.js";
import type { RunDisplayMode } from "./run-placeholder.js";
import {
  createSelectionInspector,
  type SelectionInspector,
} from "./selection-inspector/index.js";
import { ShortcutManager } from "./shortcut-manager/index.js";
import { createSnapManager, type SnapManager } from "./snap-manager/index.js";
import {
  createThemeLibraryClient,
  type ThemeLibraryClient,
  type ThemeLibraryEntry,
} from "./theme-library-client.js";
import {
  createTypePresetPanel,
  reassignTypePresetToken,
  type TypePresetPanel,
  type TypePresets,
} from "./type-preset-manager/index.js";

export interface EditorPanelHosts {
  /** Semantic layer tree and arrange controls. */
  readonly layers: HTMLElement;
  /** Text and chart creation. */
  readonly add: HTMLElement;
  /** Imported asset list and controls. */
  readonly assets: HTMLElement;
  /** Document-level panels shown when nothing is selected. */
  readonly document: HTMLElement;
  /** Chart settings and bindings, shown for a chart selection. */
  readonly chart: HTMLElement;
  /** Properties of the selected object, shown in the Design tab. */
  readonly selection: HTMLElement;
}

export interface EditorSessionOptions {
  readonly shell: EditorShell;
  readonly source: SampleSource;
  readonly envelope: FabricThemeEnvelopeInput;
  readonly assets?: Readonly<Record<string, Uint8Array>>;
  readonly panelHosts: EditorPanelHosts;
  readonly libraryClient?: ThemeLibraryClient;
  readonly onNew: () => Promise<void>;
  readonly onOpen?: () => void;
  readonly onOpenPackage?: () => void;
  readonly onOpenTheme?: (
    envelope: FabricThemeEnvelope,
    assets: Readonly<Record<string, Uint8Array>>,
  ) => Promise<void>;
  readonly onSaved: (message?: string) => void;
  readonly onError?: (message: string) => void;
  readonly onBindingsChange?: () => void;
}

/** Owns Vigilia editor composition on the native Fabric canvas. */
export class EditorSession {
  readonly charts: ChartManager;
  readonly #runtime: LiveRuntime;
  readonly #artboard: ArtboardPanel;
  readonly #palette: PalettePanel;
  readonly #types: TypePresetPanel;
  readonly #newObjects: NewObjectPanel;
  readonly #selection: SelectionInspector;
  readonly #layers: LayerPanel;
  readonly #snapping: SnapManager;
  readonly #indicators: IndicatorManager;
  readonly #persistence: PersistenceManager;
  readonly #assets = new AssetManager();
  readonly #assetPanel: HTMLElement;
  readonly #shortcuts = new ShortcutManager();
  readonly #panelHosts: EditorPanelHosts;
  readonly #options: EditorSessionOptions;
  readonly #shell: EditorShell;
  #envelope: FabricThemeEnvelopeInput;
  readonly #onBindingsChange: (() => void) | undefined;

  constructor(options: EditorSessionOptions) {
    if (options.shell.scene === undefined) {
      throw new Error(
        "The editor shell needs a scene adapter for Vigilia extensions.",
      );
    }
    this.#envelope = options.envelope;
    this.#shell = options.shell;
    this.#assets.load(
      options.envelope.assets === undefined
        ? {}
        : { assets: options.envelope.assets },
      options.assets ?? {},
    );
    this.#onBindingsChange = options.onBindingsChange;

    // The File menu dispatches these through `actionFacade`; the section that
    // used to hold the buttons is gone.
    this.#options = options;
    this.#panelHosts = options.panelHosts;
    this.#layers = createLayerPanel(
      options.panelHosts.layers,
      options.shell.editor,
    );
    this.#snapping = createSnapManager({
      canvas: options.shell.editor.canvas,
      bounds: () => {
        const artboard = this.#envelope.artboard;
        return {
          left: 0,
          top: 0,
          right: artboard.width,
          bottom: artboard.height,
          centerX: artboard.width / 2,
          centerY: artboard.height / 2,
        };
      },
      errors: options.shell.editor.errorManager,
    });
    this.#indicators = createIndicatorManager({
      canvas: options.shell.editor.canvas,
    });
    this.#artboard = createArtboardPanel(
      options.panelHosts.document,
      this.#envelope.globals,
      (artboard) => this.#setArtboard(options.shell, artboard),
      {
        assets: this.#assets.declarations,
        onMetadataChange: (metadata) => this.#setMetadata(metadata),
      },
    );
    this.#artboard.render(this.#envelope.artboard, this.#envelope.metadata);
    this.#palette = createPalettePanel(
      options.panelHosts.document,
      (palette) => this.#setPalette(options.shell, palette),
      (id, replacement) => this.#deletePalette(options.shell, id, replacement),
    );
    this.#palette.render(this.#envelope.globals?.palette);
    this.#types = createTypePresetPanel(
      options.panelHosts.document,
      (presets) => this.#setTypes(options.shell, presets),
      (id, replacement) => this.#deleteType(options.shell, id, replacement),
      {
        preview: async (face) => {
          await this.#runFontAction(options, () => previewFontFace(face));
        },
        applyFace: async (id, face) => {
          await this.#runFontAction(options, () =>
            this.applyPresetFace(id, face),
          );
        },
        applyTrio: async (id) => {
          await this.#runFontAction(options, () => this.applyFontTrio(id));
        },
      },
    );
    this.#types.render(
      this.#envelope.globals?.typePresets as TypePresets | undefined,
    );
    this.#selection = createSelectionInspector(options.panelHosts.selection, {
      editor: options.shell.editor,
      ...(options.envelope.globals === undefined
        ? {}
        : { globals: options.envelope.globals }),
    });
    this.charts = new ChartManager({
      editor: options.shell.editor,
      scene: options.shell.scene,
      source: options.source,
      ...(options.envelope.bindings === undefined
        ? {}
        : { bindings: options.envelope.bindings }),
      ...(options.envelope.globals === undefined
        ? {}
        : { globals: options.envelope.globals }),
      panelHost: options.panelHosts.chart,
      onBindingsChange: (id, bindings) => this.#setBindings(id, bindings),
    });
    this.#newObjects = createNewObjectPanel(
      options.panelHosts.add,
      options.shell.editor,
      this.#envelope.globals,
      { addChart: (family) => this.charts.addChart(family) },
    );
    this.#runtime = new LiveRuntime({
      canvas: options.shell.editor.canvas,
      source: options.source,
      ...(options.envelope.bindings === undefined
        ? {}
        : { bindings: options.envelope.bindings }),
      ...(options.envelope.globals === undefined
        ? {}
        : { globals: options.envelope.globals }),
    });
    this.#assetPanel = createAssetPanel(
      options.panelHosts.assets,
      this.#assets,
      options.shell.editor,
      () => {
        this.#artboard.setAssets(this.#assets.declarations);
        this.#refreshBackgroundMedia(options.shell);
      },
      (assetId) => this.#envelope.artboard.backgroundMedia?.assetId === assetId,
    );
    this.#refreshBackgroundMedia(options.shell);
    this.#persistence = new PersistenceManager(
      this.#snapshot(options.shell),
      this.#assets.assets,
    );
    this.#shortcuts.register("file.save", () => {
      void this.#save(options);
    });
    this.#shortcuts.register("file.open", () => {
      void this.#open(options);
    });
    this.#shortcuts.register("file.new", () => {
      void this.#new(options);
    });
    this.#shortcuts.register("edit.undo", () => {
      void options.shell.editor.historyManager.undo();
    });
    this.#shortcuts.register("edit.redo", () => {
      void options.shell.editor.historyManager.redo();
    });
    this.#shortcuts.register("edit.delete", () => {
      options.shell.editor.deletionManager.deleteActive();
    });
    this.#shortcuts.register("edit.copy", () => {
      void options.shell.editor.clipboardManager.copy();
    });
    this.#shortcuts.register("edit.cut", () => {
      void options.shell.editor.clipboardManager.cut();
    });
    this.#shortcuts.register("edit.duplicate", () => {
      void options.shell.editor.clipboardManager.duplicate();
    });
    this.#shortcuts.register("edit.group", () => {
      options.shell.editor.groupingManager.group();
    });
    this.#shortcuts.register("edit.ungroup", () => {
      options.shell.editor.groupingManager.ungroup();
    });
  }

  get envelope(): FabricThemeEnvelopeInput {
    return this.#envelope;
  }

  /** Reachability only: the shell menus dispatch through the existing owners,
   * including the private document actions the panel section used to call. */
  actionFacade(): EditorActionFacade {
    const options = this.#options;
    const editor = options.shell.editor;
    return {
      newDocument: () => this.#new(options),
      openPackage: () => this.#open(options),
      savePackage: () => this.#save(options),
      releasePackage: () => this.#release(options),
      openLibrary: () => this.#openLibrary(options),
      saveLibrary: () => this.#saveLibrary(options),
      addText: () => {
        const content = "New text";
        editor.textManager.addText({
          text: content,
          ...createNewTextDefaults(this.#envelope.globals, content),
        });
      },
      addChart: (family) => this.charts.addChart(family),
      arrange: (action) => applyArrange(editor, action),
      canArrange: (action) => canArrange(editor, action),
      undo: () => void editor.historyManager.undo(),
      redo: () => void editor.historyManager.redo(),
      copy: () => void editor.clipboardManager.copy(),
      cut: () => void editor.clipboardManager.cut(),
      deleteActive: () => void editor.deletionManager.deleteActive(),
      duplicate: () => void editor.clipboardManager.duplicate(),
      group: () => editor.groupingManager.group(),
      ungroup: () => editor.groupingManager.ungroup(),
    };
  }

  setSource(source: SampleSource): void {
    this.#runtime.setSource(source);
    this.charts.setSource(source);
  }

  refresh(): void {
    this.#runtime.refresh();
    this.charts.refresh();
  }

  /** How value runs read while authoring (§89). */
  runDisplay(): RunDisplayMode {
    return this.#runtime.runDisplay;
  }

  setRunDisplay(mode: RunDisplayMode): void {
    this.#runtime.setRunDisplay(mode);
  }

  async hydrateAssets(shell: EditorShell): Promise<void> {
    await this.#assets.hydrate(shell.editor.canvas);
  }

  async applyFontTrio(id: string): Promise<FabricThemeEnvelope> {
    const trio = fontTrio(id);
    if (trio === undefined) throw new Error(`Unknown font trio "${id}".`);
    const bytes = await Promise.all(
      trio.faces.map((face) => this.#downloadFace(face)),
    );
    for (const [index, face] of trio.faces.entries()) {
      await this.#assets.adoptFont(face, bytes[index]!);
    }
    const presets = this.#envelope.globals?.typePresets as
      | TypePresets
      | undefined;
    if (presets !== undefined)
      this.#setTypes(this.#shell, applyFontTrio(presets, trio));
    this.#shell.editor.historyManager.saveState();
    return this.#snapshot(this.#shell);
  }

  async applyPresetFace(
    id: string,
    face: CuratedFontFace,
  ): Promise<FabricThemeEnvelope> {
    const presets = this.#envelope.globals?.typePresets as
      | TypePresets
      | undefined;
    const preset = presets?.[id];
    if (preset === undefined) throw new Error(`Unknown type preset "${id}".`);
    const bytes = await this.#downloadFace(face);
    await this.#assets.adoptFont(face, bytes);
    this.#setTypes(this.#shell, {
      ...presets,
      [id]: {
        ...preset,
        value: {
          ...preset.value,
          family: face.family,
          weight: face.weight,
          face: { assetId: face.id },
        },
      },
    });
    this.#shell.editor.historyManager.saveState();
    return this.#snapshot(this.#shell);
  }

  destroy(): void {
    this.#shortcuts.destroy();
    this.#persistence.destroy();
    this.#assets.destroy();
    releaseFontPreview();
    this.#assetPanel.remove();
    this.charts.destroy();
    this.#selection.root.remove();
    this.#artboard.root.remove();
    this.#palette.root.remove();
    this.#types.root.remove();
    this.#newObjects.root.remove();
    this.#layers.destroy();
    this.#snapping.destroy();
    this.#indicators.destroy();
  }

  async #save(options: EditorSessionOptions): Promise<void> {
    try {
      const current = this.#snapshot(options.shell);
      await this.#persistence.save(current, this.#assets.assets);
      options.onSaved("Theme package saved");
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  async #saveLibrary(options: EditorSessionOptions): Promise<void> {
    const current = this.#snapshot(options.shell);
    const result = serializeThemePackage(current, this.#assets.assets);
    if (!result.ok) {
      options.onError?.(result.message);
      return;
    }
    const client = options.libraryClient ?? createThemeLibraryClient();
    try {
      await client.save(current.id, result.bytes);
      this.#persistence.markSaved(current, this.#assets.assets);
      options.onSaved("Saved to library");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      options.onError?.(`Could not save to library: ${msg}`);
    }
  }

  async #openLibrary(options: EditorSessionOptions): Promise<void> {
    if (!(await this.#confirmReplacement(options))) return;
    const client = options.libraryClient ?? createThemeLibraryClient();
    try {
      const themes = await client.list();
      if (themes.length === 0) {
        options.onError?.("No themes in host library.");
        return;
      }
      const selectedId = await promptThemeSelection(themes);
      if (selectedId === undefined) return;
      const bytes = await client.open(selectedId);
      const parsed = parseThemePackage(bytes);
      if (!parsed.ok) {
        options.onError?.(`Could not open theme: ${parsed.message}`);
        return;
      }
      if (options.onOpenTheme !== undefined) {
        await options.onOpenTheme(parsed.envelope, parsed.assets);
      }
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  async #open(options: EditorSessionOptions): Promise<void> {
    if (!(await this.#confirmReplacement(options))) return;
    if (options.onOpenPackage !== undefined) {
      options.onOpenPackage();
    } else if (options.onOpen !== undefined) {
      options.onOpen();
    }
  }

  async #new(options: EditorSessionOptions): Promise<void> {
    if (!(await this.#confirmReplacement(options))) return;
    await options.onNew();
  }

  async #confirmReplacement(options: {
    readonly shell: EditorShell;
    readonly onSaved: (message?: string) => void;
  }): Promise<boolean> {
    const current = this.#snapshot(options.shell);

    if (this.#persistence.isDirty(current, this.#assets.assets)) {
      const choice = await confirmDocumentReplacement();

      if (choice === "cancel") return false;
      if (choice === "save") {
        await this.#persistence.save(current, this.#assets.assets);
        options.onSaved("Theme package saved");
      }
    }
    return true;
  }

  #setArtboard(shell: EditorShell, artboard: Artboard): void {
    this.#envelope = { ...this.#envelope, artboard };
    shell.setArtboard(artboard);
    this.#refreshBackgroundMedia(shell);
    this.#artboard.render(artboard, this.#envelope.metadata);
  }

  async #release(options: EditorSessionOptions): Promise<void> {
    const level = window.prompt("Release bump: major, minor or patch", "patch");
    if (level !== "major" && level !== "minor" && level !== "patch") return;
    try {
      const beforeRelease = serializeThemePackage(
        this.#snapshot(options.shell),
        this.#assets.assets,
      );
      if (!beforeRelease.ok) throw new Error(beforeRelease.message);
      const version = bumpSemanticVersion(
        this.#envelope.metadata?.version,
        level,
      );
      this.#setMetadata({ ...this.#envelope.metadata, version });
      await this.#save(options);
      options.onSaved(`Released ${version}`);
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  #setMetadata(metadata: FabricThemeEnvelopeInput["metadata"]): void {
    if (metadata === undefined || Object.keys(metadata).length === 0) {
      const { metadata: _metadata, ...withoutMetadata } = this.#envelope;
      this.#envelope = withoutMetadata;
    } else {
      this.#envelope = { ...this.#envelope, metadata };
    }
  }

  #refreshBackgroundMedia(shell: EditorShell): void {
    shell.setBackgroundMedia(this.#assets.declarations, (assetId) =>
      this.#assets.backgroundSource(assetId),
    );
  }

  #setBindings(id: string, bindings: readonly Binding[]): void {
    this.#envelope = {
      ...this.#envelope,
      bindings: { ...this.#envelope.bindings, [id]: bindings },
    };
    this.#runtime.setBindings(this.#envelope.bindings ?? {});
    this.#onBindingsChange?.();
  }

  #setPalette(shell: EditorShell, palette: FabricPalette): void {
    this.#envelope = {
      ...this.#envelope,
      globals: { ...this.#envelope.globals, palette },
    };
    shell.setGlobals(this.#envelope.globals);
    this.#runtime.setGlobals(this.#envelope.globals);
    this.charts.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#artboard.setGlobals(this.#envelope.globals);
    this.#selection.setGlobals(this.#envelope.globals);
    this.#palette.render(palette);
  }

  #deletePalette(shell: EditorShell, id: string, replacement: string): void {
    if (id === "none" || id === replacement) return;
    const { from, to, artboard, palette } = reassignPaletteToken(
      shell.editor.canvas,
      this.#envelope.artboard,
      this.#envelope.globals?.palette ?? {},
      id,
      replacement,
    );
    this.charts.reassignPaletteReferences(from, to);
    this.#envelope = {
      ...this.#envelope,
      artboard,
      globals: { ...this.#envelope.globals, palette },
    };
    shell.setArtboard(artboard);
    shell.setGlobals(this.#envelope.globals);
    this.#runtime.setGlobals(this.#envelope.globals);
    this.charts.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#artboard.setGlobals(this.#envelope.globals);
    this.#selection.setGlobals(this.#envelope.globals);
    this.#artboard.render(artboard);
    this.#palette.render(palette);
  }

  #setTypes(shell: EditorShell, typePresets: TypePresets): void {
    this.#envelope = {
      ...this.#envelope,
      globals: { ...this.#envelope.globals, typePresets },
    };
    shell.setGlobals(this.#envelope.globals);
    this.#runtime.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#types.render(typePresets);
  }

  async #downloadFace(face: CuratedFontFace): Promise<Uint8Array> {
    const response = await fetch(face.sourceUrl);
    if (!response.ok)
      throw new Error(
        `Could not download ${face.family} (${response.status}).`,
      );
    return new Uint8Array(await response.arrayBuffer());
  }

  async #runFontAction(
    options: EditorSessionOptions,
    action: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  #deleteType(shell: EditorShell, id: string, replacement: string): void {
    if (id === replacement) return;
    const typePresets = reassignTypePresetToken(
      shell.editor.canvas,
      (this.#envelope.globals?.typePresets ?? {}) as TypePresets,
      id,
      replacement,
    );
    this.#envelope = {
      ...this.#envelope,
      globals: { ...this.#envelope.globals, typePresets },
    };
    shell.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#types.render(typePresets);
  }

  #snapshot(shell: EditorShell): FabricThemeEnvelope {
    return shell.snapshot({
      ...this.#envelope,
      ...(this.#assets.declarations.length === 0
        ? {}
        : { assets: this.#assets.declarations }),
    });
  }
}

export async function promptThemeSelection(
  themes: readonly ThemeLibraryEntry[],
): Promise<string | undefined> {
  const dialog = document.createElement("dialog");
  const select = document.createElement("select");
  for (const t of themes) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `${t.name} (${t.id})`;
    select.append(opt);
  }
  dialog.innerHTML =
    '<form method="dialog"><p>Open from library:</p><div class="theme-select-container"></div><button value="open">Open</button><button value="cancel">Cancel</button></form>';
  dialog.querySelector(".theme-select-container")?.append(select);
  document.body.append(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => {
        const value = dialog.returnValue === "open" ? select.value : undefined;
        dialog.remove();
        resolve(value);
      },
      { once: true },
    );
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.returnValue = "open";
      dialog.dispatchEvent(new Event("close"));
    }
  });
}

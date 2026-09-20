import {
  type Artboard,
  type Binding,
  bumpSemanticVersion,
  type FabricPalette,
  type FabricThemeEnvelope,
  type FabricThemeEnvelopeInput,
  type SampleSource,
} from "@vigilia/renderer-core";
import {
  reassignObjectPaletteReferences,
  reassignObjectTypePresetReferences,
} from "@vigilia/scene-fabric";
import { type ForkShell } from "../fork-shell.js";
import { createArtboardPanel, type ArtboardPanel } from "../artboard-panel.js";
import { createPalettePanel, type PalettePanel } from "../palette-panel.js";
import {
  createTypePresetPanel,
  type TypePresetPanel,
  type TypePresets,
} from "../type-preset-panel.js";
import {
  createNewObjectPanel,
  type NewObjectPanel,
} from "../new-object-panel.js";
import { createLayerPanel, type LayerPanel } from "../layer-panel.js";
import { ChartManager } from "../chart-manager/index.js";
import {
  PersistenceManager,
  confirmDocumentReplacement,
} from "../persistence-manager/index.js";
import { ShortcutManager } from "../shortcut-manager/index.js";
import { serializeThemePackage, parseThemePackage } from "../persist.js";
import {
  createThemeLibraryClient,
  type ThemeLibraryClient,
  type ThemeLibraryEntry,
} from "../theme-library-client.js";
import { AssetManager, createAssetPanel } from "../asset-manager/index.js";
import {
  applyFontTrio,
  fontTrio,
  type CuratedFontFace,
} from "../font-catalog.js";
import { previewFontFace, releaseFontPreview } from "../font-preview.js";
import { LiveRuntime } from "../live-runtime.js";

export interface ForkExtensionsOptions {
  readonly shell: ForkShell;
  readonly source: SampleSource;
  readonly envelope: FabricThemeEnvelopeInput;
  readonly assets?: Readonly<Record<string, Uint8Array>>;
  readonly panelHost: HTMLElement;
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

/** Composition root for Vigilia-specific behaviour layered above the fork. */
export class ForkExtensions {
  readonly charts: ChartManager;
  readonly #runtime: LiveRuntime;
  readonly #artboard: ArtboardPanel;
  readonly #palette: PalettePanel;
  readonly #types: TypePresetPanel;
  readonly #newObjects: NewObjectPanel;
  readonly #layers: LayerPanel;
  readonly #persistence: PersistenceManager;
  readonly #assets = new AssetManager();
  readonly #assetPanel: HTMLElement;
  readonly #shortcuts = new ShortcutManager();
  readonly #fileSection: HTMLElement;
  readonly #shell: ForkShell;
  #envelope: FabricThemeEnvelopeInput;
  readonly #onBindingsChange: (() => void) | undefined;

  constructor(options: ForkExtensionsOptions) {
    if (options.shell.scene === undefined) {
      throw new Error(
        "The fork shell needs a scene adapter for Vigilia extensions.",
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

    const fileSection = document.createElement("section");
    fileSection.dataset["vigiliaFileActions"] = "";
    const fileHeading = document.createElement("h2");
    fileHeading.textContent = "Package & Library";
    fileSection.append(fileHeading);

    const openPackageBtn = document.createElement("button");
    openPackageBtn.type = "button";
    openPackageBtn.textContent = "Open package";
    openPackageBtn.addEventListener("click", () => {
      void this.#open(options);
    });

    const savePackageBtn = document.createElement("button");
    savePackageBtn.type = "button";
    savePackageBtn.textContent = "Save package";
    savePackageBtn.addEventListener("click", () => {
      void this.#save(options);
    });

    const releaseBtn = document.createElement("button");
    releaseBtn.type = "button";
    releaseBtn.dataset["vigiliaThemeRelease"] = "";
    releaseBtn.textContent = "Release package";
    releaseBtn.addEventListener("click", () => {
      void this.#release(options);
    });

    const openLibraryBtn = document.createElement("button");
    openLibraryBtn.type = "button";
    openLibraryBtn.textContent = "Open library";
    openLibraryBtn.addEventListener("click", () => {
      void this.#openLibrary(options);
    });

    const saveLibraryBtn = document.createElement("button");
    saveLibraryBtn.type = "button";
    saveLibraryBtn.textContent = "Save to library";
    saveLibraryBtn.addEventListener("click", () => {
      void this.#saveLibrary(options);
    });

    fileSection.append(
      openPackageBtn,
      savePackageBtn,
      releaseBtn,
      openLibraryBtn,
      saveLibraryBtn,
    );
    options.panelHost.prepend(fileSection);
    this.#fileSection = fileSection;

    this.#newObjects = createNewObjectPanel(
      options.panelHost,
      options.shell.editor,
      this.#envelope.globals,
    );
    this.#layers = createLayerPanel(options.panelHost, options.shell.editor);
    this.#artboard = createArtboardPanel(
      options.panelHost,
      this.#envelope.globals,
      (artboard) => this.#setArtboard(options.shell, artboard),
      {
        assets: this.#assets.declarations,
        onMetadataChange: (metadata) => this.#setMetadata(metadata),
      },
    );
    this.#artboard.render(this.#envelope.artboard, this.#envelope.metadata);
    this.#palette = createPalettePanel(
      options.panelHost,
      (palette) => this.#setPalette(options.shell, palette),
      (id, replacement) => this.#deletePalette(options.shell, id, replacement),
    );
    this.#palette.render(this.#envelope.globals?.palette);
    this.#types = createTypePresetPanel(
      options.panelHost,
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
      panelHost: options.panelHost,
      onBindingsChange: (id, bindings) => this.#setBindings(id, bindings),
    });
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
      options.panelHost,
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
  }

  get envelope(): FabricThemeEnvelopeInput {
    return this.#envelope;
  }

  setSource(source: SampleSource): void {
    this.#runtime.setSource(source);
    this.charts.setSource(source);
  }

  refresh(): void {
    this.#runtime.refresh();
    this.charts.refresh();
  }

  async hydrateAssets(shell: ForkShell): Promise<void> {
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
    this.#fileSection.remove();
    this.#artboard.root.remove();
    this.#palette.root.remove();
    this.#types.root.remove();
    this.#newObjects.root.remove();
    this.#layers.destroy();
  }

  async #save(options: ForkExtensionsOptions): Promise<void> {
    try {
      const current = this.#snapshot(options.shell);
      await this.#persistence.save(current, this.#assets.assets);
      options.onSaved("Theme package saved");
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  async #saveLibrary(options: ForkExtensionsOptions): Promise<void> {
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

  async #openLibrary(options: ForkExtensionsOptions): Promise<void> {
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

  async #open(options: ForkExtensionsOptions): Promise<void> {
    if (!(await this.#confirmReplacement(options))) return;
    if (options.onOpenPackage !== undefined) {
      options.onOpenPackage();
    } else if (options.onOpen !== undefined) {
      options.onOpen();
    }
  }

  async #new(options: ForkExtensionsOptions): Promise<void> {
    if (!(await this.#confirmReplacement(options))) return;
    await options.onNew();
  }

  async #confirmReplacement(options: {
    readonly shell: ForkShell;
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

  #setArtboard(shell: ForkShell, artboard: Artboard): void {
    this.#envelope = { ...this.#envelope, artboard };
    shell.setArtboard(artboard);
    this.#refreshBackgroundMedia(shell);
    this.#artboard.render(artboard, this.#envelope.metadata);
  }

  async #release(options: ForkExtensionsOptions): Promise<void> {
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

  #refreshBackgroundMedia(shell: ForkShell): void {
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

  #setPalette(shell: ForkShell, palette: FabricPalette): void {
    this.#envelope = {
      ...this.#envelope,
      globals: { ...this.#envelope.globals, palette },
    };
    shell.setGlobals(this.#envelope.globals);
    this.#runtime.setGlobals(this.#envelope.globals);
    this.charts.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#artboard.setGlobals(this.#envelope.globals);
    this.#palette.render(palette);
  }

  #deletePalette(shell: ForkShell, id: string, replacement: string): void {
    if (id === "none" || id === replacement) return;
    const from = `palette.${id}` as const;
    const to = `palette.${replacement}` as const;
    reassignObjectPaletteReferences(shell.editor.canvas, from, to);
    this.charts.reassignPaletteReferences(from, to);
    const artboard = { ...this.#envelope.artboard };
    for (const property of ["background", "barColor"] as const) {
      const value = artboard[property];
      if (value !== undefined && "ref" in value && value.ref === from)
        artboard[property] = { ref: to };
    }
    const palette = { ...this.#envelope.globals?.palette };
    delete palette[id];
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
    this.#artboard.render(artboard);
    this.#palette.render(palette);
  }

  #setTypes(shell: ForkShell, typePresets: TypePresets): void {
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
    options: ForkExtensionsOptions,
    action: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  #deleteType(shell: ForkShell, id: string, replacement: string): void {
    if (id === replacement) return;
    const from = `typePresets.${id}` as const;
    const to = `typePresets.${replacement}` as const;
    reassignObjectTypePresetReferences(shell.editor.canvas, from, to);
    const typePresets = { ...this.#envelope.globals?.typePresets };
    delete typePresets[id];
    this.#envelope = {
      ...this.#envelope,
      globals: { ...this.#envelope.globals, typePresets },
    };
    shell.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#types.render(typePresets as TypePresets);
  }

  #snapshot(shell: ForkShell): FabricThemeEnvelope {
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

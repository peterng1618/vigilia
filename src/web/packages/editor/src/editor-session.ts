import {
  type Artboard,
  type Binding,
  bumpSemanticVersion,
  type FabricPalette,
  type FabricThemeEnvelope,
  type FabricThemeEnvelopeInput,
  type SampleSource,
} from "@vigilia/renderer-core";
import { sceneBoxesOf } from "@vigilia/scene-fabric";
import { ActiveSelection, type FabricObject } from "fabric/es";
import { applyArrange, canArrange } from "./arrange.js";
import { type ArtboardPanel, createArtboardPanel } from "./artboard-panel.js";
import { AssetManager } from "./asset-manager/index.js";
import { createAssetPanel } from "./asset-manager/panel.js";
import {
  type CanvasNudge,
  createCanvasNudge,
  stepFor,
} from "./canvas-nudge.js";
import { insertCard } from "./card-library.js";
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
import { LiveRuntime } from "./live-runtime.js";
import {
  chooseArtboardSize,
  type NewDocumentAnswer,
} from "./new-document-chooser.js";
import {
  createNewObjectPanel,
  insertNewShape,
  insertNewText,
  type NewObjectPanel,
} from "./new-object-panel.js";
import {
  createPalettePanel,
  type PalettePanel,
  paletteTokenUsage,
  reassignPaletteToken,
} from "./palette-manager/index.js";
import { serializeThemePackage } from "./persist.js";
import {
  confirmDocumentReplacement,
  PersistenceManager,
} from "./persistence-manager/index.js";
import type { RunDisplayMode } from "./run-placeholder.js";
import {
  createSelectionInspector,
  type SelectionInspector,
} from "./selection-inspector/index.js";
import {
  createDocumentReferencesPanel,
  type DocumentReferencesPanel,
} from "./selection-inspector/style.js";
import { ShortcutManager } from "./shortcut-manager/index.js";
import { createSnapManager, type SnapManager } from "./snap-manager/index.js";
import {
  createThemeLibraryClient,
  ThemeConflictError,
  type ThemeLibraryClient,
} from "./theme-library-client.js";
import {
  promptThemeConflict,
  promptThemeSelection,
} from "./theme-library-dialog.js";
import { captureThumbnail } from "./thumbnail-capture.js";
import {
  createTypePresetPanel,
  reassignTypePresetToken,
  type TypePresetPanel,
  type TypePresets,
} from "./type-preset-manager/index.js";

/**
 * The stored document a session descends from, and what that document declared.
 *
 * A save names the first to say which version it was built from; the second is
 * what lets it leave an asset the stored folder already holds out of the
 * request, because a declared `sha256` that has not moved is proof the bytes
 * have not either. Keeping them in one value is the point — a base without its
 * hashes would upload the whole theme every time, which is what this exists to
 * stop.
 */
interface LibraryBase {
  readonly id: string;
  readonly hashes: ReadonlyMap<string, string>;
}

/** The base of a document, paired with the hashes that document declares. */
function libraryBase(
  id: string | undefined,
  declarations: readonly { readonly path: string; readonly sha256?: string }[],
): LibraryBase | undefined {
  if (id === undefined) {
    return undefined;
  }
  return {
    id,
    hashes: new Map(
      declarations.flatMap((declared) =>
        declared.sha256 === undefined
          ? []
          : [[declared.path, declared.sha256] as const],
      ),
    ),
  };
}

export interface EditorPanelHosts {
  /** Text and chart creation. */
  readonly add: HTMLElement;
  /** Imported asset list and controls. */
  readonly assets: HTMLElement;
  /** The document's own panels, in the Document pane: the artboard, palette
      and type presets it edits, and the references they resolve to. Shown by
      the pane, not by an empty selection — a theme setting must stay reachable
      while something is selected. */
  readonly document: HTMLElement;
  /** Properties of the selected object, in the right column. */
  readonly selection: HTMLElement;
}

export interface EditorSessionOptions {
  readonly shell: EditorShell;
  readonly source: SampleSource;
  readonly envelope: FabricThemeEnvelopeInput;
  /**
   * The document's declared assets and their bytes, already loaded.
   *
   * Passed in rather than built here because the shell revives the scene before
   * this session exists, and Fabric enlivens an image from `src` alone: the
   * bytes have to be resolvable by then or a pasted image's dead `blob:` URL
   * costs the object itself, not just its picture. Whoever mounts a document
   * loads one manager and hands it to both.
   */
  readonly assetManager: AssetManager;
  /** The picture the opened package carried, if it carried one. A save that
   *  cannot render one of its own keeps this rather than losing it. */
  readonly thumbnail?: Uint8Array;
  readonly panelHosts: EditorPanelHosts;
  readonly libraryClient?: ThemeLibraryClient;
  /** The stored document this one was opened from, when it was opened from
   *  the library. Every save made from here is checked against it. */
  readonly libraryBase?: string;
  /** Creates a blank document at the artboard the author chose. The chooser
   *  itself is the session's, so the size is asked before the open document is
   *  even offered up for replacement. */
  readonly onNew: (answer: NewDocumentAnswer) => Promise<void>;
  /** Creates a document from the reference composition, as a template. */
  readonly onNewFromStarter: () => Promise<void>;
  readonly onOpen?: () => void;
  readonly onOpenPackage?: () => void;
  /** §7's `?` reference. The sheet is chrome and belongs to `createShellLayout`,
   *  and the dispatcher belongs to this session, so the gesture crosses back
   *  through the same door every other modal prompt uses. Optional, so the four
   *  existing construction sites — and every test that builds a session — keep
   *  compiling and simply do nothing. */
  readonly onShowShortcuts?: () => void;
  readonly onOpenTheme?: (
    envelope: FabricThemeEnvelope,
    assets: Readonly<Record<string, Uint8Array>>,
    /** The stored document this one came from. Opening a theme builds a new
     *  session, so the base has to travel with it or the session replacing
     *  this one would save with no idea what it is based on. */
    base?: string,
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
  readonly #documentReferences: DocumentReferencesPanel;
  readonly #snapping: SnapManager;
  readonly #indicators: IndicatorManager;
  readonly #persistence: PersistenceManager;
  readonly #assets: AssetManager;
  readonly #assetPanel: HTMLElement;
  readonly #shortcuts = new ShortcutManager();
  readonly #nudge: CanvasNudge;
  readonly #panelHosts: EditorPanelHosts;
  readonly #options: EditorSessionOptions;
  readonly #shell: EditorShell;
  #envelope: FabricThemeEnvelopeInput;
  /**
   * The stored document this one descends from, or nothing when it descends
   * from nothing. It is the base every library save is checked against, so it
   * is cleared wherever the document is replaced by something else: a base that
   * outlived its document would make the next save look stale when it is not.
   *
   * The hashes travel with it because the pair is one claim: the base says this
   * document is the one stored, and the hashes say what that document declared.
   * Without the second half a save cannot tell an asset the author never
   * touched from one they replaced, and sends bytes nobody changed.
   */
  #libraryBase: LibraryBase | undefined;
  /** The picture this document arrived with, which a save falls back to. */
  #thumbnail: Uint8Array | undefined;
  /** The source the runtime reads, which a new source replaces. */
  #source: SampleSource;
  readonly #onBindingsChange: (() => void) | undefined;
  /** Told the document may have moved; see `#writeEnvelope`. */
  readonly #documentChangeListeners = new Set<() => void>();
  readonly #announceChange = (): void => {
    for (const listener of this.#documentChangeListeners) listener();
  };

  constructor(options: EditorSessionOptions) {
    if (options.shell.scene === undefined) {
      throw new Error(
        "The editor shell needs a scene adapter for Vigilia extensions.",
      );
    }
    this.#envelope = options.envelope;
    this.#shell = options.shell;
    this.#thumbnail = options.thumbnail;
    this.#assets = options.assetManager;
    this.#libraryBase = libraryBase(
      options.libraryBase,
      this.#assets.declarations,
    );
    this.#onBindingsChange = options.onBindingsChange;

    /**
     * An undo rebuilds the scene from JSON, and an imported image's persisted
     * `src` is the object URL `image-manager` revoked the moment it decoded.
     * The revived image therefore has nothing to draw and drops out of the
     * document — which is what made undo "remove the asset outright" instead
     * of undoing the transform, the move or the restack the author asked for.
     *
     * The package bytes are the authority, and `AssetManager.hydrate` is
     * already how a revived image is given them: the session ran it once, on
     * open, and never again.
     */
    options.shell.editor.canvas.on(
      "editor:history-state-loaded" as never,
      (() => {
        void this.hydrateAssets(options.shell).catch(() => undefined);
      }) as never,
    );

    // `history-manager` fires the first when a recorded edit lands, which is
    // the signal the rest of the shell already reads as "the document moved".
    // Adding and removing move it too, and are listed so the unsaved marker
    // does not depend on a path happening to record history.
    for (const event of [
      "editor:edit-committed",
      "object:added",
      "object:removed",
    ]) {
      options.shell.editor.canvas.on(
        event as never,
        this.#announceChange as never,
      );
    }

    // The File menu dispatches these through `actionFacade`; the section that
    // used to hold the buttons is gone.
    this.#options = options;
    this.#panelHosts = options.panelHosts;
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
        // The panel's own comment said the scene was not its to read, so it
        // stated a rule true at every size and therefore said nothing. It is
        // given the scene now that the counting lives with it.
        sceneBoxes: () =>
          sceneBoxesOf(options.shell.editor.canvas.getObjects()),
        // The figure is derived, so it needs the event that says the scene
        // moved. Without it the panel prints a number that only refreshes when
        // the artboard changes, and an author marking a deliberate bleed sees
        // no change on the surface they are looking at.
        canvasEvents: {
          on: (event, handler) =>
            options.shell.editor.canvas.on(event as never, handler as never),
          off: (event, handler) =>
            options.shell.editor.canvas.off(event as never, handler as never),
        },
      },
    );
    this.#artboard.render(this.#envelope.artboard, this.#envelope.metadata);
    this.#palette = createPalettePanel(
      options.panelHosts.document,
      (palette) => this.#setPalette(options.shell, palette),
      (id, replacement) => this.#deletePalette(options.shell, id, replacement),
      {
        // The same walk the delete uses, so the figure beside a token and the
        // references a deletion will move cannot disagree about the scene.
        usage: () =>
          paletteTokenUsage(
            options.shell.editor.canvas,
            this.#envelope.globals?.palette ?? {},
          ),
      },
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
      // Bindings are envelope state, so the inspector reads and writes them
      // through the session rather than holding a second copy of them.
      nodeBindings: (id) => this.#envelope.bindings?.[id] ?? [],
      onNodeBindingsChange: (id, bindings) => this.#setBindings(id, bindings),
      // Pulled, not held: the inspector must see the source the runtime is
      // using, not the one the session was constructed with.
      sampleSource: () => this.#source,
      // The panel already owns a preset's fields and sits in the same tab, so
      // revealing it is bringing the author to it, not drawing a second copy.
      revealTypePresets: () => {
        this.#types.root.scrollIntoView({ block: "start" });
      },
      // The shell owns the glass handle; the inspector writes the property and
      // asks it to re-resolve.
      refreshGlass: () => options.shell.refreshGlass(),
      // A chart's own fields. A getter, because the chart manager is built
      // below — and because a chart selection is the only thing that asks.
      chartFields: () => this.charts.fields,
    });
    this.#selection.setLocale(options.envelope.metadata?.themeLanguage);
    // Entering inline editing asks the runtime for the authoring view: the
    // shell built the text manager before this session existed, so the
    // dependency is installed here rather than passed in.
    options.shell.editor.textManager.setAuthoringView((object) =>
      this.#runtime.showAuthoringView(object),
    );
    // A refused in-place edit left Fabric's flat text standing where the
    // authored runs belong. The runtime owns what an object paints, so the
    // put-back goes through it rather than a second repaint path here.
    options.shell.editor.textManager.setRepaint(() => this.#runtime.refresh());
    this.#documentReferences = createDocumentReferencesPanel(
      options.panelHosts.document,
      // Pulled, not held: the panel is mounted for the session and read-only, so
      // this cannot show a copy of globals that a theme edit has since changed.
      { globals: () => this.#envelope.globals },
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
      onBindingsChange: (id, bindings) => this.#setBindings(id, bindings),
    });
    this.#newObjects = createNewObjectPanel(
      options.panelHosts.add,
      options.shell.editor,
      this.#envelope.globals,
      {
        addChart: (family) => this.charts.addChart(family),
        insertCard: (cardId) => this.#insertCard(cardId),
      },
    );
    this.#source = options.source;
    this.#runtime = new LiveRuntime({
      canvas: options.shell.editor.canvas,
      source: options.source,
      ...(options.envelope.bindings === undefined
        ? {}
        : { bindings: options.envelope.bindings }),
      ...(options.envelope.globals === undefined
        ? {}
        : { globals: options.envelope.globals }),
      ...(options.envelope.metadata?.themeLanguage === undefined
        ? {}
        : { themeLanguage: options.envelope.metadata.themeLanguage }),
    });
    // A pasted image must be a declared asset, not a blob URL: the half-only
    // path saves a document whose image is a handle into this session's memory
    // and is gone from every other tab, every other browser and every reload —
    // silently, because the save succeeds.
    options.shell.editor.clipboardManager.setImageImporter((file) =>
      this.#assets.placeImage(options.shell.editor, file),
    );
    // Same reason, same shape: a pasted or duplicated object is given a new id
    // by the clipboard, and a binding is keyed by the object that shows it, so
    // the copy's readings have to be re-keyed by whoever owns the envelope.
    // Without this a duplicated card arrives claiming to be a CPU card, shows
    // nothing, and its runs point at the original's binding ids — which the
    // validator refuses as a duplicate, so the save fails for the session.
    options.shell.editor.clipboardManager.setBindings({
      read: () => this.#envelope.bindings ?? {},
      write: (bindings) => this.#addBindings(bindings),
    });
    this.#assetPanel = createAssetPanel(
      options.panelHosts.assets,
      this.#assets,
      options.shell.editor,
      () => {
        this.#artboard.setAssets(this.#assets.declarations);
        this.#refreshBackgroundMedia(options.shell);
      },
      (assetId) => this.#holdsAsset(assetId),
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
      // First: a burst's entry is not recorded until it closes, so an undo
      // inside the idle window would find nothing to step back to.
      this.#nudge.endBurst();
      void options.shell.editor.historyManager.undo();
    });
    this.#shortcuts.register("edit.redo", () => {
      this.#nudge.endBurst();
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
    // Context-only, so it is registered here rather than in `PRODUCT_SHORTCUTS`:
    // no menu or tooltip displays "Escape".
    this.#shortcuts.register("view.exit-group", () => {
      options.shell.editor.groupingManager.exitGroup();
    });
    // §7's `?` reference. The manager dispatches; the sheet is chrome and lives
    // in the shell, so the gesture leaves through the session's own callback.
    this.#shortcuts.register("help.shortcuts", () => {
      options.onShowShortcuts?.();
    });
    this.#shortcuts.register("canvas.front", () => {
      options.shell.editor.layerManager.bringToFront();
    });
    this.#shortcuts.register("canvas.back", () => {
      options.shell.editor.layerManager.sendToBack();
    });

    const canvas = options.shell.editor.canvas;
    // The theme's full-artboard background rect is `selectable: false`, but it
    // *is* returned by `getObjects()`. Selecting it would let the next nudge or
    // drag move the background off the artboard, so it is filtered out here.
    // Locked objects are selectable now, so this filter no longer excludes
    // them; `object-lock-manager` owns that, dropping locked members from a
    // selection once it exists. Snapping makes the opposite call — a locked
    // object *is* alignable against — so this filter is deliberately stricter
    // than `snap-manager`'s.
    const selectableObjects = (): FabricObject[] =>
      canvas.getObjects().filter((object) => object.selectable === true);

    this.#shortcuts.register("canvas.select-all", () => {
      const objects = selectableObjects();
      // An `ActiveSelection` of one object is not a selection.
      if (objects.length < 2) return;
      canvas.discardActiveObject();
      canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
      canvas.requestRenderAll();
    });

    this.#nudge = createCanvasNudge({
      canvas,
      history: options.shell.editor.historyManager,
    });

    // Four literal registrations, not a loop over a key map: `ProductShortcutId`
    // is a closed union and a template literal is not assignable to it without a
    // cast.
    this.#shortcuts.register("canvas.nudge-left", (event) => {
      this.#nudge.nudgeBy(-stepFor(event), 0);
    });
    this.#shortcuts.register("canvas.nudge-right", (event) => {
      this.#nudge.nudgeBy(stepFor(event), 0);
    });
    this.#shortcuts.register("canvas.nudge-up", (event) => {
      this.#nudge.nudgeBy(0, -stepFor(event));
    });
    this.#shortcuts.register("canvas.nudge-down", (event) => {
      this.#nudge.nudgeBy(0, stepFor(event));
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
      newFromStarter: () => this.#newFromStarter(options),
      openPackage: () => this.#open(options),
      savePackage: () => this.#save(options),
      releasePackage: () => this.#release(options),
      openLibrary: () => this.#openLibrary(options),
      saveLibrary: () => this.#saveLibrary(options),
      addText: () => insertNewText(editor, this.#envelope.globals),
      addShape: (kind) => insertNewShape(editor, this.#envelope.globals, kind),
      addChart: (family) => this.charts.addChart(family),
      insertCard: (cardId) => this.#insertCard(cardId),
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
      isDirty: () => this.isDirty(),
      publishableDocument: () => {
        // A document with no stored base has no folder, and a published
        // document's assets are served from the theme's own folder — so a
        // display given one would render a theme with holes. The base's own
        // `id` is a content hash of the stored document, not the folder it
        // lives in, so the id published under is the document's.
        if (this.#libraryBase === undefined) return undefined;
        const envelope = this.#snapshot(this.#shell);
        return { id: envelope.id, envelope };
      },
      subscribeDocumentChange: (listener) =>
        this.subscribeDocumentChange(listener),
    };
  }

  setSource(source: SampleSource): void {
    this.#source = source;
    this.#runtime.setSource(source);
    this.charts.setSource(source);
  }

  refresh(): void {
    this.#runtime.refresh();
    this.charts.refresh();
  }

  /**
   * The refresh loop's own call, and a separate method from `refresh` because
   * the two halves of a repaint want different cadences.
   *
   * Charts animate, so they keep the author's rate. Text does not: a reading
   * that changes once a second was being re-measured thirty times a second
   * across every text object in the document, which cost the same whether the
   * author was mid-gesture or had walked away. `LiveRuntime.tick` owns the two
   * text cadences; this is the loop asking for them beside the charts.
   */
  tick(): void {
    this.#runtime.tick();
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
    this.#nudge.dispose();
    this.#documentChangeListeners.clear();
    this.#persistence.destroy();
    this.#assets.destroy();
    releaseFontPreview();
    this.#assetPanel.remove();
    this.charts.destroy();
    this.#selection.root.remove();
    this.#documentReferences.destroy();
    this.#artboard.destroy();
    this.#palette.root.remove();
    this.#types.root.remove();
    this.#newObjects.root.remove();
    this.#snapping.destroy();
    this.#indicators.destroy();
  }

  async #save(options: EditorSessionOptions): Promise<void> {
    try {
      const current = this.#snapshot(options.shell);
      // The package carries the theme's picture so whoever receives the file
      // can see the look without installing anything.
      await this.#persistence.save(
        current,
        this.#assets.assets,
        (await this.#capture(options)) ?? this.#thumbnail,
      );
      this.#announceChange();
      options.onSaved("Theme package saved");
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  /** The picture a save ships, or the one this document arrived with: a
   *  capture that fails must cost the preview, not the theme. */
  async #picture(
    options: EditorSessionOptions,
  ): Promise<Uint8Array | undefined> {
    return (await this.#capture(options)) ?? this.#thumbnail;
  }

  /** The browser already has the theme on screen, so it is the right place to
   *  render it; a failure here is not a failure of what is being saved. */
  async #capture(
    options: EditorSessionOptions,
  ): Promise<Uint8Array | undefined> {
    try {
      return await captureThumbnail(
        options.shell.editor.canvas,
        undefined,
        options.shell.backdrop(),
      );
    } catch {
      return undefined;
    }
  }

  async #saveLibrary(options: EditorSessionOptions): Promise<void> {
    const current = this.#snapshot(options.shell);
    const client = options.libraryClient ?? createThemeLibraryClient();
    try {
      // The library is a folder, so the theme goes as its document and its
      // declared bytes. Building an archive here would compress data the host
      // is about to write uncompressed and inflate again on the next read.
      await this.#writeLibrary(client, current, options, false);
      options.onSaved("Saved to library");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // The editor's own words for a save that did not happen, whether it was
      // refused or merely failed — the document is untouched either way, and
      // `markSaved` was not reached, so the author still has it.
      options.onError?.(`Could not save to library: ${msg}`);
      if (error instanceof ThemeConflictError) {
        await this.#resolveConflict(current, options, client);
      }
    }
  }

  /**
   * The save itself, so a deliberate overwrite after a refusal takes the same
   * road the refused save did — the same declared bytes, the same picture, and
   * the same move of the base onto what was just written.
   */
  async #writeLibrary(
    client: ThemeLibraryClient,
    current: FabricThemeEnvelope,
    options: EditorSessionOptions,
    overwrite: boolean,
  ): Promise<void> {
    const base = this.#libraryBase;
    this.#libraryBase = libraryBase(
      await client.save(
        current.id,
        {
          envelope: current,
          assets: this.#libraryPayload(base, overwrite),
          ...(base === undefined ? {} : { base: base.id }),
        },
        { overwrite },
      ),
      this.#assets.declarations,
    );

    const png = await this.#picture(options);
    if (png !== undefined && client.saveThumbnail !== undefined) {
      try {
        await client.saveThumbnail(current.id, png);
      } catch (error) {
        options.shell.editor.errorManager.warn(
          "controls",
          `Saved, but the library picture failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.#persistence.markSaved(current, this.#assets.assets);
    // The document did not move, but whether it is saved just changed, and the
    // marker reads that question rather than watching the scene.
    this.#announceChange();
  }

  /**
   * The bytes this save has to carry, which is only the ones the stored folder
   * does not already hold.
   *
   * An asset the author has not touched since they opened the theme is left
   * out, and the host takes it from the folder it is replacing — a 438 KB
   * backdrop that has not moved does not go over the wire again. It may do that
   * only because this save went out with the base the editor opened with, and
   * the host's guard has already said the stored document is that one.
   *
   * A save with no base is a first save, and a deliberate overwrite stands the
   * guard down, so both carry the whole theme: there is nothing to reconstruct
   * from, and on the second road what is on disk is not the document this save
   * came from.
   */
  #libraryPayload(
    base: LibraryBase | undefined,
    overwrite: boolean,
  ): Readonly<Record<string, Uint8Array>> {
    const all = this.#assets.assets;
    if (base === undefined || overwrite) {
      return all;
    }
    const payload: Record<string, Uint8Array> = {};
    for (const declared of this.#assets.declarations) {
      const sha256 = declared.sha256;
      if (sha256 !== undefined && base.hashes.get(declared.path) === sha256) {
        continue;
      }
      // A declaration with no bytes is a document that is already broken; the
      // host refuses a theme that names an asset nobody can produce, which is
      // the honest answer, and sending an empty file would not be.
      const bytes = all[declared.path];
      if (bytes !== undefined) {
        payload[declared.path] = bytes;
      }
    }
    return payload;
  }

  /**
   * What an author wants done about a save the host refused. Nothing is thrown
   * away on either road, and the third answer keeps both: reloading takes the
   * stored document, overwriting sends the author's own with the guard stood
   * down for this one save, and dismissing it leaves the document exactly as it
   * was so they can copy anything out of it first.
   */
  async #resolveConflict(
    current: FabricThemeEnvelope,
    options: EditorSessionOptions,
    client: ThemeLibraryClient,
  ): Promise<void> {
    const choice = await promptThemeConflict();
    if (choice === "reload") {
      const opened = await client.open(current.id);
      this.#libraryBase = libraryBase(
        opened.base,
        opened.envelope.assets ?? [],
      );
      await options.onOpenTheme?.(opened.envelope, opened.assets, opened.base);
      return;
    }
    if (choice !== "overwrite") {
      return;
    }
    try {
      await this.#writeLibrary(client, current, options, true);
      options.onSaved("Saved to library");
    } catch (error) {
      options.onError?.(
        `Could not save to library: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async #openLibrary(options: EditorSessionOptions): Promise<void> {
    if (!(await this.#confirmReplacement(options))) return;
    const client = options.libraryClient ?? createThemeLibraryClient();
    try {
      // The client goes in so a delete raised from this dialog reaches the host
      // this session is already talking to, rather than one the dialog builds.
      const choice = await promptThemeSelection(
        await client.list(),
        undefined,
        {
          client,
        },
      );
      if (choice === undefined) return;
      // A template is not a stored theme: it is not in the host's library, so
      // there is nothing to fetch and nothing the author could have deleted.
      // The editor already holds it, which is why it is offered at all.
      if (choice.kind === "template") {
        this.#libraryBase = undefined;
        await options.onNewFromStarter();
        return;
      }
      const opened = await client.open(choice.id);
      if (options.onOpenTheme !== undefined) {
        this.#libraryBase = libraryBase(
          opened.base,
          opened.envelope.assets ?? [],
        );
        await options.onOpenTheme(opened.envelope, opened.assets, opened.base);
      }
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  async #open(options: EditorSessionOptions): Promise<void> {
    if (!(await this.#confirmReplacement(options))) return;
    // A package is a file the author brought in, not a stored theme, so the
    // next save is a first save and claims no base.
    this.#libraryBase = undefined;
    if (options.onOpenPackage !== undefined) {
      options.onOpenPackage();
    } else if (options.onOpen !== undefined) {
      options.onOpen();
    }
  }

  async #new(options: EditorSessionOptions): Promise<void> {
    // The chooser first, then the replacement question: an author who opens
    // `New` and then thinks better of it must not be asked to confirm
    // discarding their work on the way to deciding they wanted none of it.
    // It opens on the display the artboard being replaced is, so a document
    // already settled on an upright lens is not thrown back to the 16:9 one
    // without being asked.
    //
    // The whole answer travels, not just its size: the display the author
    // picked is what the new document is shown through, and dropping it here
    // is what left a portrait artboard inside a landscape frame.
    const answer = await chooseArtboardSize(this.#envelope.artboard);
    if (answer === undefined) return;
    if (!(await this.#confirmReplacement(options))) return;
    this.#libraryBase = undefined;
    await options.onNew(answer);
  }

  async #newFromStarter(options: EditorSessionOptions): Promise<void> {
    if (!(await this.#confirmReplacement(options))) return;
    this.#libraryBase = undefined;
    await options.onNewFromStarter();
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

  /**
   * The envelope-side asset references, which no Fabric object carries.
   *
   * The artboard's background media is a DOM sibling of the canvas, and a type
   * preset's face is a reference in `globals` — neither is an object, so the
   * canvas walk the asset panel does cannot see either. A font whose bytes went
   * away under a live preset would leave a theme that validates and renders
   * nothing.
   */
  #holdsAsset(assetId: string): boolean {
    if (this.#envelope.artboard.backgroundMedia?.assetId === assetId)
      return true;
    const presets = this.#envelope.globals?.typePresets as
      | TypePresets
      | undefined;
    return Object.values(presets ?? {}).some(
      (preset) => preset.value.face?.assetId === assetId,
    );
  }

  /**
   * The document as the author last left it. Every write after the constructor
   * goes through here, so a panel that changes the theme name, a palette token
   * or a binding cannot leave the unsaved marker reading "saved" — the failure
   * being one setter missing a line, which nothing else would notice.
   */
  #writeEnvelope(envelope: FabricThemeEnvelopeInput): void {
    this.#envelope = envelope;
    this.#announceChange();
  }

  /** Whether the document differs from what was last saved. Pulled, never held:
   *  the comparison already exists for the replace prompt, and a stored flag
   *  would be one more thing to keep true. */
  isDirty(): boolean {
    return this.#persistence.isDirty(
      this.#snapshot(this.#shell),
      this.#assets.assets,
    );
  }

  /** Told "look again", not told the answer: a path that announces without
   *  having changed anything costs a recompute rather than a wrong marker. */
  subscribeDocumentChange(listener: () => void): () => void {
    this.#documentChangeListeners.add(listener);
    return () => {
      this.#documentChangeListeners.delete(listener);
    };
  }

  #setArtboard(shell: EditorShell, artboard: Artboard): void {
    this.#writeEnvelope({ ...this.#envelope, artboard });
    shell.setArtboard(artboard);
    this.#refreshBackgroundMedia(shell);
    this.#artboard.render(artboard, this.#envelope.metadata);
  }

  async #release(options: EditorSessionOptions): Promise<void> {
    const level = window.prompt("Release bump: major, minor or patch", "patch");
    if (level !== "major" && level !== "minor" && level !== "patch") return;
    try {
      // **The one archive left in this file, and it is not a round trip.**
      // Nothing is stored here: the package is built so the release refuses a
      // theme that would not export, and the archive is then downloaded by
      // `#save`. The library is a folder (ADR-0017); the export is not.
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
      this.#writeEnvelope(withoutMetadata);
    } else {
      this.#writeEnvelope({ ...this.#envelope, metadata });
    }
    // The language is the one metadata field that changes what is painted, and
    // `metadata` is the only way to set it, so this is the only push site needed
    // — unlike the globals fan-out above, which four separate setters repeat.
    this.#pushLocale();
  }

  #pushLocale(): void {
    const themeLanguage = this.#envelope.metadata?.themeLanguage;
    // Two receivers, not four: the editor paints bound text only through the
    // live runtime, and the inspector's run preview is the other place a
    // formatted reading is written. `runs.ts`'s own `applyAuthoredText` calls
    // pass no bindings, so they resolve no reading and need no language.
    this.#runtime.setThemeLanguage(themeLanguage);
    this.#selection.setLocale(themeLanguage);
  }

  #refreshBackgroundMedia(shell: EditorShell): void {
    shell.setBackgroundMedia(this.#assets.declarations, (assetId) =>
      this.#assets.backgroundSource(assetId),
    );
  }

  #setBindings(id: string, bindings: readonly Binding[]): void {
    this.#addBindings({ [id]: bindings });
  }

  /**
   * The one writer of the envelope's bindings, whoever is writing them.
   *
   * A single object's list and an inserted card's whole subtree are the same
   * fact — a reading is keyed by the object that shows it — so they share one
   * write and one fan-out. Charts are in that fan-out because a chart's series
   * *are* its bindings: a chart manager holding only what it was constructed
   * with draws every inserted card's sparkline with no series at all.
   */
  #addBindings(additions: Readonly<Record<string, readonly Binding[]>>): void {
    this.#writeEnvelope({
      ...this.#envelope,
      bindings: { ...this.#envelope.bindings, ...additions },
    });
    const bindings = this.#envelope.bindings ?? {};
    this.#runtime.setBindings(bindings);
    this.charts.setBindings(bindings);
    this.#onBindingsChange?.();
  }

  /** One card, as a unit. The copy's readings are envelope state, so they land
   * through the one writer above rather than beside it.
   *
   * **The refusal is reported here rather than thrown at a caller.** Three
   * surfaces dispatch this — the Add pane, the Insert menu and the canvas
   * context menu — and two of them hold a `void`, so a thrown refusal reached
   * nobody on those: the author clicked a card, nothing happened, nothing was
   * said, and an unhandled rejection went to the console. Reporting at the one
   * owner is what makes it told once on every surface, and the Add pane's
   * `constructing` does not double-report because nothing rejects.
   */
  #insertCard(cardId: string): void {
    void insertCard(this.#options.shell.editor, cardId, {
      globals: this.#envelope.globals,
      ...(this.#envelope.bindings === undefined
        ? {}
        : { bindings: this.#envelope.bindings }),
      onBindings: (bindings) => this.#addBindings(bindings),
    }).catch((error: unknown) => {
      this.#options.shell.editor.errorManager.warn(
        "controls",
        error instanceof Error ? error.message : String(error),
      );
    });
  }

  #setPalette(shell: EditorShell, palette: FabricPalette): void {
    this.#writeEnvelope({
      ...this.#envelope,
      globals: { ...this.#envelope.globals, palette },
    });
    shell.setGlobals(this.#envelope.globals);
    this.#runtime.setGlobals(this.#envelope.globals);
    this.charts.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#artboard.setGlobals(this.#envelope.globals);
    this.#selection.setGlobals(this.#envelope.globals);
    this.#documentReferences.render();
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
    this.#writeEnvelope({
      ...this.#envelope,
      artboard,
      globals: { ...this.#envelope.globals, palette },
    });
    shell.setArtboard(artboard);
    shell.setGlobals(this.#envelope.globals);
    this.#runtime.setGlobals(this.#envelope.globals);
    this.charts.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#artboard.setGlobals(this.#envelope.globals);
    this.#selection.setGlobals(this.#envelope.globals);
    this.#documentReferences.render();
    this.#artboard.render(artboard);
    this.#palette.render(palette);
  }

  #setTypes(shell: EditorShell, typePresets: TypePresets): void {
    this.#writeEnvelope({
      ...this.#envelope,
      globals: { ...this.#envelope.globals, typePresets },
    });
    shell.setGlobals(this.#envelope.globals);
    this.#runtime.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#types.render(typePresets);
    this.#documentReferences.render();
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
    this.#writeEnvelope({
      ...this.#envelope,
      globals: { ...this.#envelope.globals, typePresets },
    });
    shell.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#types.render(typePresets);
    this.#documentReferences.render();
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

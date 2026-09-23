import {
  type Artboard,
  type AssetReference,
  type FabricThemeEnvelope,
  type FabricThemeEnvelopeInput,
  type FitMode,
  type Globals,
  resolveStyleValue,
  type ScenePlan,
  validateFabricThemeEnvelope,
} from "@vigilia/renderer-core";
import {
  applyObjectPalettePaints,
  applyObjectTypePresets,
  type BackgroundMediaSource,
  createSceneAdapter,
  cssArtboardPaint,
  disposeScene,
  fabricArtboardPaint,
  mountBackgroundMedia,
  reviveScene,
  reviveThemeEnvelope,
  type SceneAdapter,
  serialiseScene,
  serialiseThemeEnvelope,
} from "@vigilia/scene-fabric";
import {
  ActiveSelection,
  type ActiveSelectionOptions,
  Canvas,
  classRegistry,
  type FabricObject,
} from "fabric/es";
import { createClipboardManager } from "./clipboard-manager/index.js";
import { applyEditorControls } from "./controls-manager/index.js";
import { createCropManager } from "./crop-manager/index.js";
import { createDeletionManager } from "./deletion-manager/index.js";
import type { EditorInteraction } from "./editor-interaction.js";
import { createErrorManager } from "./error-manager/index.js";
import { createGroupingManager } from "./grouping-manager/index.js";
import { EditorHistory } from "./history-manager/index.js";
import { createImageManager } from "./image-manager/index.js";
import { createLayerManager } from "./layer-manager/index.js";
import { createObjectLockManager } from "./object-lock-manager/index.js";
import { createTextManager } from "./text-manager/index.js";

export interface EditorShellOptions {
  readonly host: HTMLElement;
  readonly artboard: Artboard;
  readonly plan?: ScenePlan;
  /** A validated v2 document revives directly into the interactive canvas. */
  readonly envelope?: FabricThemeEnvelope;
  readonly assets?: readonly AssetReference[];
  readonly resolveAsset?: (
    assetId: string,
  ) => BackgroundMediaSource | undefined;
}

export interface EditorShell {
  readonly editor: EditorInteraction;
  readonly scene?: SceneAdapter;
  snapshot(input: FabricThemeEnvelopeInput): FabricThemeEnvelope;
  setArtboard(artboard: Artboard): void;
  setBackgroundMedia(
    assets: readonly AssetReference[],
    resolveAsset: (assetId: string) => BackgroundMediaSource | undefined,
  ): void;
  setGlobals(globals: Globals | undefined): void;
  setFitMode(fitMode: FitMode): void;
  destroy(): void;
}

const EDITOR_CONTAINER_ID = "vigilia-fabric-editor";
let nextEditorContainer = 1;

class SelectionOrderedActiveSelection extends ActiveSelection {
  constructor(
    objects: FabricObject[] = [],
    options: Partial<ActiveSelectionOptions> = {},
  ) {
    super(objects, { ...options, multiSelectionStacking: "selection-order" });
  }
}

classRegistry.setClass(SelectionOrderedActiveSelection, "ActiveSelection");

function fitArtboardViewport(
  container: HTMLElement,
  host: HTMLElement,
  artboard: EditorShellOptions["artboard"],
  fitMode: FitMode,
): number | undefined {
  const scale =
    fitMode === "contain"
      ? Math.min(
          host.clientWidth / artboard.width,
          host.clientHeight / artboard.height,
        )
      : Math.max(
          host.clientWidth / artboard.width,
          host.clientHeight / artboard.height,
        );

  if (!Number.isFinite(scale) || scale <= 0) return undefined;

  container.style.width = `${artboard.width * scale}px`;
  container.style.height = `${artboard.height * scale}px`;
  return scale;
}

function fitCanvasViewport(
  editor: EditorInteraction,
  container: HTMLElement,
  host: HTMLElement,
  artboard: EditorShellOptions["artboard"],
  fitMode: FitMode,
): void {
  const scale = fitArtboardViewport(container, host, artboard, fitMode);

  if (scale === undefined) return;

  const width = artboard.width * scale;
  const height = artboard.height * scale;
  editor.canvas.setDimensions({ width, height });
  editor.canvas.setViewportTransform([
    scale,
    0,
    0,
    scale,
    (width - artboard.width * scale) / 2,
    (height - artboard.height * scale) / 2,
  ]);
  editor.canvas.requestRenderAll();
}

function applyArtboardPaint(
  editor: EditorInteraction,
  host: HTMLElement,
  artboard: Artboard,
  globals: Globals | undefined,
): void {
  const issues: Parameters<typeof resolveStyleValue>[3] = [];
  const resolve = (value: Artboard["background"]): unknown => {
    return resolveStyleValue(value, globals ?? {}, "artboard", issues);
  };
  editor.canvas.backgroundColor =
    fabricArtboardPaint(
      resolve(artboard.background),
      artboard.width,
      artboard.height,
    ) ?? "";
  host.style.background =
    cssArtboardPaint(resolve(artboard.barColor)) ?? "#000";
  applyObjectPalettePaints(editor.canvas, globals);
  applyObjectTypePresets(editor.canvas, globals);
  editor.canvas.requestRenderAll();
}

function createNativeEditor(
  container: HTMLElement,
  artboard: Artboard,
): EditorInteraction {
  applyEditorControls();
  const element = document.createElement("canvas");
  container.append(element);
  const canvas = new Canvas(element, {
    width: artboard.width,
    height: artboard.height,
  });
  const history = new EditorHistory({
    canvas,
    serialize: serialiseScene,
    revive: reviveScene,
  });
  history.reset();
  const save = (): void => history.save();
  /** A completed mouse-driven move/scale/rotate needs the same history entry
   * explicit actions get; Fabric only reports it after the gesture ends. */
  canvas.on("object:modified", save);
  const errors = createErrorManager(canvas);
  const deletion = createDeletionManager(canvas, save);
  const images = createImageManager(canvas, save);
  return {
    canvas,
    historyManager: {
      saveState: save,
      resetHistory: () => history.reset(),
      undo: () => history.undo(),
      redo: () => history.redo(),
      suspend: () => history.suspend(),
    },
    textManager: createTextManager(canvas, save),
    imageManager: images,
    layerManager: createLayerManager(canvas, save),
    objectLockManager: createObjectLockManager(canvas, save),
    errorManager: errors,
    cropManager: createCropManager({
      canvas,
      save,
      suspend: () => history.suspend(),
      errors,
    }),
    deletionManager: deletion,
    clipboardManager: createClipboardManager({
      canvas,
      save,
      errors,
      deletion,
      importImage: (input) => images.importImage(input),
    }),
    groupingManager: createGroupingManager({
      canvas,
      save,
      suspend: () => history.suspend(),
    }),
    destroy: () => canvas.dispose(),
  };
}

/** Mounts the native editor with Vigilia's chart-resource lifecycle hook. */
export async function mountEditorShell({
  host,
  artboard,
  plan,
  envelope,
  assets,
  resolveAsset,
}: EditorShellOptions): Promise<EditorShell> {
  if (plan !== undefined && envelope !== undefined) {
    throw new Error(
      "An editor shell accepts either a scene plan or a Fabric envelope, not both.",
    );
  }
  if (envelope !== undefined) {
    const validation = validateFabricThemeEnvelope(envelope);
    if (!validation.ok) {
      throw new Error(
        `Invalid Fabric theme: ${validation.issues[0]?.message ?? "unknown validation error"}`,
      );
    }
  }
  const container = document.createElement("div");
  container.id = `${EDITOR_CONTAINER_ID}-${nextEditorContainer}`;
  nextEditorContainer += 1;
  /** The retired image-editor package exposed its instance as `window[containerId]`
   * for devtools/e2e access; keep that contract on the numbered id, which stays
   * stable even after the container's own `id` attribute is reset below. */
  const debugKey = container.id;
  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.margin = "auto";
  container.style.visibility = "hidden";
  let currentArtboard = artboard;
  let globals: Globals | undefined = envelope?.globals;
  let fitMode: FitMode = currentArtboard.fitMode ?? "contain";
  // The returned scale is irrelevant here; sizing the container is the point,
  // and the editor is fitted explicitly once mounted below.
  fitArtboardViewport(container, host, currentArtboard, fitMode);
  host.append(container);
  let mounted: EditorInteraction | undefined;
  const resize =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => {
          if (mounted !== undefined)
            fitCanvasViewport(
              mounted,
              container,
              host,
              currentArtboard,
              fitMode,
            );
        });
  resize?.observe(host);

  try {
    const editor = createNativeEditor(container, artboard);
    mounted = editor;
    (window as unknown as Record<string, unknown>)[debugKey] = editor;
    fitCanvasViewport(editor, container, host, currentArtboard, fitMode);

    if (envelope !== undefined) {
      await reviveThemeEnvelope(editor.canvas, envelope);
      editor.historyManager.resetHistory();
    }
    applyArtboardPaint(editor, host, currentArtboard, globals);

    const scene =
      plan === undefined && envelope === undefined
        ? undefined
        : createSceneAdapter({ canvas: editor.canvas });

    if (plan !== undefined) {
      scene?.apply(plan);
    }

    host.replaceChildren(container);
    container.id = EDITOR_CONTAINER_ID;
    container.style.visibility = "";
    let mediaAssets = assets ?? envelope?.assets;
    let mediaResolve = resolveAsset;
    let media =
      mediaResolve === undefined
        ? undefined
        : mountBackgroundMedia({
            host: container,
            artboard: currentArtboard,
            assets: mediaAssets,
            resolveAsset: mediaResolve,
          });

    return {
      editor,
      ...(scene === undefined ? {} : { scene }),
      snapshot(input) {
        const next = serialiseThemeEnvelope(editor.canvas, input);
        const validation = validateFabricThemeEnvelope(next);
        if (!validation.ok) {
          throw new Error(
            `Invalid Fabric theme: ${validation.issues[0]?.message ?? "unknown validation error"}`,
          );
        }
        return validation.envelope;
      },
      setArtboard(nextArtboard) {
        currentArtboard = nextArtboard;
        fitMode = currentArtboard.fitMode ?? "contain";
        fitCanvasViewport(editor, container, host, currentArtboard, fitMode);
        applyArtboardPaint(editor, host, currentArtboard, globals);
        if (media !== undefined && mediaResolve !== undefined) {
          media.update({
            artboard: currentArtboard,
            assets: mediaAssets,
            resolveAsset: mediaResolve,
          });
        }
      },
      setBackgroundMedia(nextAssets, nextResolveAsset) {
        media?.destroy();
        mediaAssets = nextAssets;
        mediaResolve = nextResolveAsset;
        media = mountBackgroundMedia({
          host: container,
          artboard: currentArtboard,
          assets: mediaAssets,
          resolveAsset: mediaResolve,
        });
      },
      setGlobals(nextGlobals) {
        globals = nextGlobals;
        applyArtboardPaint(editor, host, currentArtboard, globals);
      },
      setFitMode(nextFitMode) {
        fitMode = nextFitMode;
        fitCanvasViewport(editor, container, host, currentArtboard, fitMode);
      },
      destroy() {
        resize?.disconnect();
        media?.destroy();
        scene?.dispose();
        disposeScene(editor.canvas);
        editor.clipboardManager.destroy();
        editor.destroy();
        delete (window as unknown as Record<string, unknown>)[debugKey];
      },
    };
  } catch (error) {
    resize?.disconnect();
    container.remove();
    throw error;
  }
}

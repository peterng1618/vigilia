import {
  type Artboard,
  type AssetReference,
  type FabricThemeEnvelope,
  type FabricThemeEnvelopeInput,
  type Globals,
  resolveStyleValue,
  type ScenePlan,
  validateFabricThemeEnvelope,
} from "@vigilia/renderer-core";
import {
  applyObjectPalettePaints,
  applyObjectTypePresets,
  artboardPaintKey,
  type BackdropMedia,
  type BackgroundMediaHandle,
  type BackgroundMediaSource,
  createGlass,
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
  Point,
  Rect,
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
import {
  createViewportManager,
  type ViewportManager,
} from "./viewport-manager/index.js";
import { bindViewportNavigation } from "./viewport-manager/navigation.js";

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
  /** The camera over the mounted canvas, for readouts and view controls. */
  readonly viewport: ViewportManager;
  readonly scene?: SceneAdapter;
  snapshot(input: FabricThemeEnvelopeInput): FabricThemeEnvelope;
  /**
   * Re-resolves the glass lifecycle. The handle this shell owns re-resolves on
   * its own when the canvas gains or loses an object; an authored treatment
   * written on a panel that is already there is neither, so the control that
   * writes it asks for this.
   */
  refreshGlass(): void;
  setArtboard(artboard: Artboard): void;
  setBackgroundMedia(
    assets: readonly AssetReference[],
    resolveAsset: (assetId: string) => BackgroundMediaSource | undefined,
  ): void;
  setGlobals(globals: Globals | undefined): void;
  setFitMode(): void;
  /**
   * The artboard's background media, for the capture path. The layer is a DOM
   * sibling the canvas cannot see, so the only thing that can put it in a
   * picture is something holding the handle (0007).
   */
  backdrop(): BackdropMedia | undefined;
  destroy(): void;
}

const EDITOR_CONTAINER_ID = "vigilia-fabric-editor";
let nextEditorContainer = 1;

/** Last resolved artboard paint per mounted shell; the plate is only rebuilt
 * when its paint or its size changes. */
interface PaintMemo {
  background: string | undefined;
}

class SelectionOrderedActiveSelection extends ActiveSelection {
  constructor(
    objects: FabricObject[] = [],
    options: Partial<ActiveSelectionOptions> = {},
  ) {
    super(objects, { ...options, multiSelectionStacking: "selection-order" });
  }
}

classRegistry.setClass(SelectionOrderedActiveSelection, "ActiveSelection");

/** The artboard plate: a bounded region of the canvas, so the pasteboard stays
 * visible around it. `canvas.backgroundColor` cannot do this — Fabric fills it
 * as one path and the viewport transform never bounds that fill — and a
 * `clipPath` would hide the objects outside the artboard too. */
function artboardPlate(artboard: Artboard, background: unknown): Rect {
  return new Rect({
    width: artboard.width,
    height: artboard.height,
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    fill:
      fabricArtboardPaint(background, artboard.width, artboard.height) ?? "",
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    // The authored paint belongs to the envelope's artboard, so the scene must
    // not carry a second copy of it.
    excludeFromExport: true,
  });
}

function applyArtboardPaint(
  editor: EditorInteraction,
  host: HTMLElement,
  artboard: Artboard,
  globals: Globals | undefined,
  memo: PaintMemo,
): void {
  const issues: Parameters<typeof resolveStyleValue>[3] = [];
  const resolve = (value: Artboard["background"]): unknown => {
    return resolveStyleValue(value, globals ?? {}, "artboard", issues);
  };
  const background = resolve(artboard.background);
  // A gradient is rebuilt only when the paint or the board's size changes, the
  // same memo the player keeps. The plate is rebuilt whenever it is missing,
  // because `loadFromJSON` clears the canvas it lived on.
  const paintKey = `${artboardPaintKey(background)}:${artboard.width}x${artboard.height}`;
  if (
    paintKey !== memo.background ||
    !(editor.canvas.backgroundImage instanceof Rect)
  ) {
    memo.background = paintKey;
    editor.canvas.backgroundImage = artboardPlate(artboard, background);
  }
  // A revived envelope from before the camera carried the artboard paint here;
  // left set it would cover the pasteboard again.
  editor.canvas.backgroundColor = "";
  host.style.background =
    cssArtboardPaint(resolve(artboard.barColor)) ?? "#000";
  applyObjectPalettePaints(editor.canvas, globals);
  applyObjectTypePresets(editor.canvas, globals);
  editor.canvas.requestRenderAll();
}

function createNativeEditor(input: {
  readonly container: HTMLElement;
  readonly host: HTMLElement;
  readonly artboard: () => Artboard;
}): EditorInteraction {
  const { container, host } = input;
  applyEditorControls();
  const element = document.createElement("canvas");
  container.append(element);
  // The canvas takes the host's size, not the artboard's: it is a viewport onto
  // the workspace now, and the camera chooses what part of it the artboard fills.
  const canvas = new Canvas(element, {
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
  });
  const viewport = createViewportManager({
    canvas,
    host,
    artboard: () => input.artboard(),
  });
  const unbindNavigation = bindViewportNavigation({ canvas, viewport });
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
  const text = createTextManager(canvas, save, (message) =>
    errors.warn("controls", message),
  );

  const grouping = createGroupingManager({
    canvas,
    save,
    suspend: () => history.suspend(),
  });
  /** Double-click enters the group the pointer resolved to. `text-manager` owns
   * this event too and returns early for a non-`IText` target, so a group
   * double-click reaches here untouched rather than being taken over. The scene
   * point goes with it: Fabric resolved the group, and only the manager can
   * re-resolve the child beneath it. */
  const enterGroupOnDoubleClick = (event: {
    readonly target?: unknown;
    readonly scenePoint?: Point;
  }): void => {
    const target = event.target;
    if (target === undefined || target === null) return;
    grouping.enterGroup({
      object: target as FabricObject,
      ...(event.scenePoint === undefined
        ? {}
        : { scenePoint: event.scenePoint }),
    });
  };
  canvas.on("mouse:dblclick" as never, enterGroupOnDoubleClick as never);

  return {
    canvas,
    viewport,
    historyManager: {
      saveState: save,
      resetHistory: () => history.reset(),
      undo: () => history.undo(),
      redo: () => history.redo(),
      suspend: () => history.suspend(),
    },
    textManager: text,
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
    groupingManager: grouping,
    destroy: () => {
      // Both double-click listeners outlive the canvas otherwise.
      text.destroy();
      grouping.destroy();
      canvas.off("mouse:dblclick" as never, enterGroupOnDoubleClick as never);
      unbindNavigation();
      viewport.destroy();
      // Disposal is asynchronous; a failure here must not be an unhandled
      // rejection during teardown.
      void canvas.dispose().catch(() => undefined);
    },
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
  container.style.visibility = "hidden";
  let currentArtboard = artboard;
  let globals: Globals | undefined = envelope?.globals;
  host.append(container);
  const paintMemo: PaintMemo = { background: undefined };
  let resize: ResizeObserver | undefined;

  try {
    const editor = createNativeEditor({
      container,
      host,
      artboard: () => currentArtboard,
    });
    (window as unknown as Record<string, unknown>)[debugKey] = editor;
    // The host drives the camera, so a host resize only needs the camera told.
    resize =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => editor.viewport.resize());
    resize?.observe(host);

    // Undo and redo revive the scene through `loadFromJSON`, which drops the
    // plate; the history manager's own post-revive signal is the point at which
    // the canvas is settled again. `canvas:cleared` fires too early — Fabric
    // re-applies the serialized background after it.
    const restorePlate = (): void => {
      applyArtboardPaint(editor, host, currentArtboard, globals, paintMemo);
    };
    editor.canvas.on("editor:history-state-loaded" as never, restorePlate);

    if (envelope !== undefined) {
      await reviveThemeEnvelope(editor.canvas, envelope);
      editor.historyManager.resetHistory();
    }

    const scene =
      plan === undefined && envelope === undefined
        ? undefined
        : createSceneAdapter({ canvas: editor.canvas });

    // After the plan, because the adapter's own artboard paint is a canvas
    // background and this shell owns the artboard region instead.
    if (plan !== undefined) {
      scene?.apply(plan);
    }
    applyArtboardPaint(editor, host, currentArtboard, globals, paintMemo);
    editor.viewport.zoomToFit();

    host.replaceChildren(container);
    container.id = EDITOR_CONTAINER_ID;
    container.style.visibility = "";
    let mediaAssets = assets ?? envelope?.assets;
    let mediaResolve = resolveAsset;
    const reportMediaError = (message: string): void => {
      editor.errorManager.warn("background-media", message);
    };
    // Every mount of the media layer goes through here, so the frame
    // subscription cannot be left off one of them. `setBackgroundMedia` is a
    // remount, not an update, and the session performs one during mount - the
    // layer that had the subscription was being torn down and replaced on every
    // editor start.
    const mountMedia = (): BackgroundMediaHandle | undefined =>
      mediaResolve === undefined
        ? undefined
        : mountBackgroundMedia({
            host: container,
            artboard: currentArtboard,
            assets: mediaAssets,
            resolveAsset: mediaResolve,
            onMediaError: reportMediaError,
            // The video is a DOM sibling, so Fabric never sees a frame change.
            onFrame: () => editor.canvas.requestRenderAll(),
          });
    let media = mountMedia();
    // The media layer is a DOM sibling of the canvas rather than a Fabric
    // object, so it has to be repositioned by hand whenever the camera moves.
    const placeMedia = (): void => {
      media?.setBounds(editor.viewport.artboardScreenRect());
    };
    editor.viewport.onChange(placeMedia);
    placeMedia();

    // After the media, because a glass panel samples that layer for its backdrop.
    // Always wired, never conditionally: the session replaces the layer through
    // `setBackgroundMedia` *after* this returns, so `media` is undefined here
    // even when the theme has a background. Omitting the option left the editor
    // sampling nothing at all.
    const glass = createGlass({
      canvas: editor.canvas,
      backdrop: () => media?.backdrop(),
      onGlassError: (message) => editor.errorManager.warn("glass", message),
    });

    return {
      editor,
      viewport: editor.viewport,
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
      refreshGlass: () => glass.sync(),
      setArtboard(nextArtboard) {
        currentArtboard = nextArtboard;
        // The camera frames the board; the authored fit mode belongs to the
        // player's letterbox, which the editor no longer draws.
        editor.viewport.zoomToFit();
        applyArtboardPaint(editor, host, currentArtboard, globals, paintMemo);
        if (media !== undefined && mediaResolve !== undefined) {
          media.update({
            artboard: currentArtboard,
            assets: mediaAssets,
            resolveAsset: mediaResolve,
          });
          placeMedia();
        }
      },
      setBackgroundMedia(nextAssets, nextResolveAsset) {
        media?.destroy();
        mediaAssets = nextAssets;
        mediaResolve = nextResolveAsset;
        media = mountMedia();
        placeMedia();
      },
      setGlobals(nextGlobals) {
        globals = nextGlobals;
        applyArtboardPaint(editor, host, currentArtboard, globals, paintMemo);
      },
      setFitMode() {
        // The authoring view always frames the whole board; `cover` is the
        // player's crop of it, which the stage does not draw.
        editor.viewport.zoomToFit();
      },
      backdrop: () => media?.backdrop(),
      destroy() {
        resize?.disconnect();
        glass.dispose();
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

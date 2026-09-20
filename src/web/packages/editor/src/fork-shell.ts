import initEditor, { type ImageEditor } from '@anu3ev/fabric-image-editor';
import { resolveStyleValue, validateFabricThemeEnvelope, type Artboard, type AssetReference, type FabricThemeEnvelope, type FabricThemeEnvelopeInput, type FitMode, type Globals, type ScenePlan } from '@vigilia/renderer-core';
import {
  createSceneAdapter,
  disposeScene,
  reviveScene,
  reviveThemeEnvelope,
  serialiseThemeEnvelope,
  serialiseScene,
  cssArtboardPaint,
  fabricArtboardPaint,
  applyObjectPalettePaints,
  applyObjectTypePresets,
  mountBackgroundMedia,
  type BackgroundMediaSource,
  type SceneAdapter,
} from '@vigilia/scene-fabric';

export interface ForkShellOptions {
  readonly host: HTMLElement;
  readonly artboard: Artboard;
  readonly plan?: ScenePlan;
  /** A validated v2 document revives directly into the interactive fork canvas. */
  readonly envelope?: FabricThemeEnvelope;
  readonly assets?: readonly AssetReference[];
  readonly resolveAsset?: (assetId: string) => BackgroundMediaSource | undefined;
}

export interface ForkShell {
  readonly editor: ImageEditor;
  readonly scene?: SceneAdapter;
  snapshot(input: FabricThemeEnvelopeInput): FabricThemeEnvelope;
  setArtboard(artboard: Artboard): void;
  setBackgroundMedia(assets: readonly AssetReference[], resolveAsset: (assetId: string) => BackgroundMediaSource | undefined): void;
  setGlobals(globals: Globals | undefined): void;
  setFitMode(fitMode: FitMode): void;
  destroy(): void;
}

const FORK_CONTAINER_ID = 'vigilia-fabric-editor';
let nextForkContainer = 1;

function fitArtboardViewport(container: HTMLElement, host: HTMLElement, artboard: ForkShellOptions['artboard'], fitMode: FitMode): number | undefined {
  const scale = fitMode === 'contain'
    ? Math.min(host.clientWidth / artboard.width, host.clientHeight / artboard.height)
    : Math.max(host.clientWidth / artboard.width, host.clientHeight / artboard.height);

  if (!Number.isFinite(scale) || scale <= 0) return undefined;

  container.style.width = `${artboard.width * scale}px`;
  container.style.height = `${artboard.height * scale}px`;
  return scale;
}

function fitCanvasViewport(editor: ImageEditor, container: HTMLElement, host: HTMLElement, artboard: ForkShellOptions['artboard'], fitMode: FitMode): void {
  const scale = fitArtboardViewport(container, host, artboard, fitMode);

  if (scale === undefined) return;

  const width = artboard.width * scale;
  const height = artboard.height * scale;
  editor.canvas.setDimensions({ width, height });
  editor.canvas.setViewportTransform([
    scale, 0, 0, scale,
    (width - artboard.width * scale) / 2,
    (height - artboard.height * scale) / 2,
  ]);
  editor.canvas.requestRenderAll();
}

function applyArtboardPaint(editor: ImageEditor, host: HTMLElement, artboard: Artboard, globals: Globals | undefined): void {
  const issues: Parameters<typeof resolveStyleValue>[3] = [];
  const resolve = (value: Artboard['background']): unknown => {
    return resolveStyleValue(value, globals ?? {}, 'artboard', issues);
  };
  editor.canvas.backgroundColor = fabricArtboardPaint(resolve(artboard.background), artboard.width, artboard.height) ?? '';
  host.style.background = cssArtboardPaint(resolve(artboard.barColor)) ?? '#000';
  applyObjectPalettePaints(editor.canvas, globals);
  applyObjectTypePresets(editor.canvas, globals);
  editor.canvas.requestRenderAll();
}

/** Mounts the adopted editor with Vigilia's chart-resource lifecycle hook. */
export async function mountForkShell({ host, artboard, plan, envelope, assets, resolveAsset }: ForkShellOptions): Promise<ForkShell> {
  if (plan !== undefined && envelope !== undefined) {
    throw new Error('A fork shell accepts either a scene plan or a Fabric envelope, not both.');
  }
  if (envelope !== undefined) {
    const validation = validateFabricThemeEnvelope(envelope);
    if (!validation.ok) {
      throw new Error(`Invalid Fabric theme: ${validation.issues[0]?.message ?? 'unknown validation error'}`);
    }
  }
  const container = document.createElement('div');
  container.id = `${FORK_CONTAINER_ID}-${nextForkContainer}`;
  nextForkContainer += 1;
  container.style.position = 'absolute';
  container.style.inset = '0';
  container.style.margin = 'auto';
  container.style.visibility = 'hidden';
  let currentArtboard = artboard;
  let globals: Globals | undefined = envelope?.globals;
  let fitMode: FitMode = currentArtboard.fitMode ?? 'contain';
  const initialScale = fitArtboardViewport(container, host, currentArtboard, fitMode);
  host.append(container);
  let mounted: ImageEditor | undefined;
  const resize = typeof ResizeObserver === 'undefined'
    ? undefined
    : new ResizeObserver(() => {
      if (mounted !== undefined) fitCanvasViewport(mounted, container, host, currentArtboard, fitMode);
    });
  resize?.observe(host);

  try {
    const editor = await initEditor(container.id, {
      montageAreaWidth: artboard.width,
      montageAreaHeight: artboard.height,
      editorContainerWidth: '100%',
      editorContainerHeight: '100%',
      defaultScale: initialScale ?? 1,
      resetObjectFitByDoubleClick: false,
      beforeHistoryStateLoad: disposeScene,
      serializeHistoryState: serialiseScene,
      reviveHistoryState: reviveScene,
    });
    mounted = editor;
    fitCanvasViewport(editor, container, host, currentArtboard, fitMode);

    if (envelope !== undefined) {
      await reviveThemeEnvelope(editor.canvas, envelope);
      editor.historyManager.resetHistory();
    }
    applyArtboardPaint(editor, host, currentArtboard, globals);

    const scene = plan === undefined && envelope === undefined ? undefined : createSceneAdapter({ canvas: editor.canvas });

    if (plan !== undefined) {
      scene?.apply(plan);
    }

    host.replaceChildren(container);
    container.id = FORK_CONTAINER_ID;
    container.style.visibility = '';
    let mediaAssets = assets ?? envelope?.assets;
    let mediaResolve = resolveAsset;
    let media = mediaResolve === undefined ? undefined : mountBackgroundMedia({
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
          throw new Error(`Invalid Fabric theme: ${validation.issues[0]?.message ?? 'unknown validation error'}`);
        }
        return validation.envelope;
      },
      setArtboard(nextArtboard) {
        currentArtboard = nextArtboard;
        fitMode = currentArtboard.fitMode ?? 'contain';
        fitCanvasViewport(editor, container, host, currentArtboard, fitMode);
        applyArtboardPaint(editor, host, currentArtboard, globals);
        if (media !== undefined && mediaResolve !== undefined) {
          media.update({ artboard: currentArtboard, assets: mediaAssets, resolveAsset: mediaResolve });
        }
      },
      setBackgroundMedia(nextAssets, nextResolveAsset) {
        media?.destroy();
        mediaAssets = nextAssets;
        mediaResolve = nextResolveAsset;
        media = mountBackgroundMedia({ host: container, artboard: currentArtboard, assets: mediaAssets, resolveAsset: mediaResolve });
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
        editor.destroy();
      },
    };
  } catch (error) {
    resize?.disconnect();
    container.remove();
    throw error;
  }
}

import initEditor, { type ImageEditor } from '@anu3ev/fabric-image-editor';
import { validateFabricThemeEnvelope, type FabricThemeEnvelope, type FabricThemeEnvelopeInput, type ScenePlan } from '@vigilia/renderer-core';
import {
  createSceneAdapter,
  disposeScene,
  reviveScene,
  reviveThemeEnvelope,
  serialiseThemeEnvelope,
  serialiseScene,
  type SceneAdapter,
} from '@vigilia/scene-fabric';

export interface ForkShellOptions {
  readonly host: HTMLElement;
  readonly artboard: {
    readonly width: number;
    readonly height: number;
  };
  readonly plan?: ScenePlan;
  /** A validated v2 document revives directly into the interactive fork canvas. */
  readonly envelope?: FabricThemeEnvelope;
}

export interface ForkShell {
  readonly editor: ImageEditor;
  readonly scene?: SceneAdapter;
  snapshot(input: FabricThemeEnvelopeInput): FabricThemeEnvelope;
  destroy(): void;
}

const FORK_CONTAINER_ID = 'vigilia-fabric-editor';
let nextForkContainer = 1;

function fitArtboardViewport(container: HTMLElement, host: HTMLElement, artboard: ForkShellOptions['artboard']): number | undefined {
  const scale = Math.min(host.clientWidth / artboard.width, host.clientHeight / artboard.height);

  if (!Number.isFinite(scale) || scale <= 0) return undefined;

  container.style.width = `${artboard.width * scale}px`;
  container.style.height = `${artboard.height * scale}px`;
  return scale;
}

function fitCanvasViewport(editor: ImageEditor, container: HTMLElement, host: HTMLElement, artboard: ForkShellOptions['artboard']): void {
  const scale = fitArtboardViewport(container, host, artboard);

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

/** Mounts the adopted editor with Vigilia's chart-resource lifecycle hook. */
export async function mountForkShell({ host, artboard, plan, envelope }: ForkShellOptions): Promise<ForkShell> {
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
  const initialScale = fitArtboardViewport(container, host, artboard);
  host.append(container);
  let mounted: ImageEditor | undefined;
  const resize = typeof ResizeObserver === 'undefined'
    ? undefined
    : new ResizeObserver(() => {
      if (mounted !== undefined) fitCanvasViewport(mounted, container, host, artboard);
    });
  resize?.observe(host);

  try {
    const editor = await initEditor(container.id, {
      montageAreaWidth: artboard.width,
      montageAreaHeight: artboard.height,
      editorContainerWidth: '100%',
      editorContainerHeight: '100%',
      defaultScale: initialScale ?? 1,
      beforeHistoryStateLoad: disposeScene,
      serializeHistoryState: serialiseScene,
      reviveHistoryState: reviveScene,
    });
    mounted = editor;
    fitCanvasViewport(editor, container, host, artboard);

    if (envelope !== undefined) {
      await reviveThemeEnvelope(editor.canvas, envelope);
    }

    const scene = plan === undefined && envelope === undefined ? undefined : createSceneAdapter({ canvas: editor.canvas });

    if (plan !== undefined) {
      scene?.apply(plan);
    }

    host.replaceChildren(container);
    container.id = FORK_CONTAINER_ID;
    container.style.visibility = '';

    return {
      editor,
      ...(scene === undefined ? {} : { scene }),
      snapshot(input) {
        return serialiseThemeEnvelope(editor.canvas, input);
      },
      destroy() {
        resize?.disconnect();
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

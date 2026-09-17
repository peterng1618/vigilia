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

function fitArtboardViewport(container: HTMLElement, host: HTMLElement, artboard: ForkShellOptions['artboard']): void {
  const scale = Math.min(host.clientWidth / artboard.width, host.clientHeight / artboard.height);

  if (!Number.isFinite(scale) || scale <= 0) return;

  container.style.width = `${artboard.width * scale}px`;
  container.style.height = `${artboard.height * scale}px`;
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
  container.id = FORK_CONTAINER_ID;
  container.style.position = 'absolute';
  container.style.inset = '0';
  container.style.margin = 'auto';
  fitArtboardViewport(container, host, artboard);
  host.replaceChildren(container);
  const resize = typeof ResizeObserver === 'undefined'
    ? undefined
    : new ResizeObserver(() => {
      fitArtboardViewport(container, host, artboard);
      window.dispatchEvent(new Event('resize'));
    });
  resize?.observe(host);

  try {
    const editor = await initEditor(FORK_CONTAINER_ID, {
      montageAreaWidth: artboard.width,
      montageAreaHeight: artboard.height,
      editorContainerWidth: '100%',
      editorContainerHeight: '100%',
      defaultScale: 1,
      beforeHistoryStateLoad: disposeScene,
      serializeHistoryState: serialiseScene,
      reviveHistoryState: reviveScene,
    });

    if (envelope !== undefined) {
      await reviveThemeEnvelope(editor.canvas, envelope);
    }

    const scene = plan === undefined && envelope === undefined ? undefined : createSceneAdapter({ canvas: editor.canvas });

    if (plan !== undefined) {
      scene?.apply(plan);
    }

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

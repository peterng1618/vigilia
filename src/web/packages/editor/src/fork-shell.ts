import initEditor, { type ImageEditor } from '@anu3ev/fabric-image-editor';
import type { ScenePlan } from '@vigilia/renderer-core';
import {
  createSceneAdapter,
  disposeScene,
  reviveScene,
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
}

export interface ForkShell {
  readonly editor: ImageEditor;
  readonly scene?: SceneAdapter;
  destroy(): void;
}

const FORK_CONTAINER_ID = 'vigilia-fabric-editor';

/** Mounts the adopted editor with Vigilia's chart-resource lifecycle hook. */
export async function mountForkShell({ host, artboard, plan }: ForkShellOptions): Promise<ForkShell> {
  const container = document.createElement('div');
  container.id = FORK_CONTAINER_ID;
  host.replaceChildren(container);

  try {
    const editor = await initEditor(FORK_CONTAINER_ID, {
      montageAreaWidth: artboard.width,
      montageAreaHeight: artboard.height,
      editorContainerWidth: '100%',
      editorContainerHeight: '100%',
      beforeHistoryStateLoad: disposeScene,
      serializeHistoryState: serialiseScene,
      reviveHistoryState: reviveScene,
    });

    const scene = plan === undefined ? undefined : createSceneAdapter({ canvas: editor.canvas });

    if (plan !== undefined) {
      scene?.apply(plan);
    }

    return {
      editor,
      ...(scene === undefined ? {} : { scene }),
      destroy() {
        scene?.dispose();
        disposeScene(editor.canvas);
        editor.destroy();
      },
    };
  } catch (error) {
    container.remove();
    throw error;
  }
}

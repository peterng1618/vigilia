declare module '@anu3ev/fabric-image-editor' {
  import type { Canvas, FabricObject } from 'fabric/es';
  import type { SerialisedScene } from '@vigilia/scene-fabric';

  export interface ImageEditor {
    readonly canvas: Canvas;
    readonly textManager: {
      addText(options?: Readonly<Record<string, unknown>>): FabricObject;
    };
    readonly layerManager: {
      bringToFront(object?: FabricObject): void;
      bringForward(object?: FabricObject): void;
      sendToBack(object?: FabricObject): void;
      sendBackwards(object?: FabricObject): void;
    };
    readonly objectLockManager: {
      lockObject(input?: { readonly object?: FabricObject }): void;
      unlockObject(input?: { readonly object?: FabricObject }): void;
    };
    readonly historyManager: {
      saveState(): void;
    };
    destroy(): void;
  }

  export interface ImageEditorOptions {
    readonly montageAreaWidth?: number;
    readonly montageAreaHeight?: number;
    readonly editorContainerWidth?: string;
    readonly editorContainerHeight?: string;
    readonly defaultScale?: number;
    readonly beforeHistoryStateLoad?: (canvas: Canvas) => void | Promise<void>;
    readonly serializeHistoryState?: (canvas: Canvas) => SerialisedScene;
    readonly reviveHistoryState?: (canvas: Canvas, state: SerialisedScene) => void | Promise<void>;
  }

  export default function initEditor(
    containerId: string,
    options?: ImageEditorOptions,
  ): Promise<ImageEditor>;
}

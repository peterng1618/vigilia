declare module '@anu3ev/fabric-image-editor' {
  import type { Canvas } from 'fabric/es';

  export interface ImageEditor {
    readonly canvas: Canvas;
    destroy(): void;
  }

  export interface ImageEditorOptions {
    readonly montageAreaWidth?: number;
    readonly montageAreaHeight?: number;
    readonly editorContainerWidth?: string;
    readonly editorContainerHeight?: string;
    readonly beforeHistoryStateLoad?: (canvas: Canvas) => void | Promise<void>;
  }

  export default function initEditor(
    containerId: string,
    options?: ImageEditorOptions,
  ): Promise<ImageEditor>;
}

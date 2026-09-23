import type { Canvas, FabricObject } from "fabric/es";
import type { ErrorManager } from "./error-manager/index.js";

/** Product panels depend only on the editor mechanics they exercise. */
export interface EditorInteraction {
  readonly canvas: Canvas;
  readonly imageManager: {
    importImage(options: {
      readonly source: File;
      readonly scale?: "image-contain" | "image-cover" | "scale-montage";
      readonly withoutAdding?: boolean;
      readonly withoutSave?: boolean;
    }): Promise<{ readonly image: FabricObject } | null>;
  };
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
    resetHistory(): void;
    undo(): Promise<void>;
    redo(): Promise<void>;
  };
  readonly errorManager: ErrorManager;
  destroy(): void;
}

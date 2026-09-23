import type { Canvas, FabricObject } from "fabric/es";

export interface ObjectLockManager {
  lockObject(input?: { readonly object?: FabricObject }): void;
  unlockObject(input?: { readonly object?: FabricObject }): void;
}

export function createObjectLockManager(
  canvas: Canvas,
  save: () => void,
): ObjectLockManager {
  return {
    lockObject: ({ object = canvas.getActiveObject() } = {}) => {
      object?.set({ selectable: false, evented: false, locked: true });
      save();
    },
    unlockObject: ({ object = canvas.getActiveObject() } = {}) => {
      object?.set({ selectable: true, evented: true, locked: false });
      save();
    },
  };
}

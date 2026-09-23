import type { Canvas, FabricObject } from "fabric/es";

/** Generic canvas stacking order; semantic layer projection lives in layer-panel.ts. */
export interface LayerManager {
  bringToFront(object?: FabricObject): void;
  bringForward(object?: FabricObject): void;
  sendToBack(object?: FabricObject): void;
  sendBackwards(object?: FabricObject): void;
}

export function createLayerManager(
  canvas: Canvas,
  save: () => void,
): LayerManager {
  return {
    bringToFront: (object = canvas.getActiveObject()) => {
      if (object !== undefined) canvas.bringObjectToFront(object);
      save();
    },
    bringForward: (object = canvas.getActiveObject()) => {
      if (object !== undefined) canvas.bringObjectForward(object);
      save();
    },
    sendToBack: (object = canvas.getActiveObject()) => {
      if (object !== undefined) canvas.sendObjectToBack(object);
      save();
    },
    sendBackwards: (object = canvas.getActiveObject()) => {
      if (object !== undefined) canvas.sendObjectBackwards(object);
      save();
    },
  };
}

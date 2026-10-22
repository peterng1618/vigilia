import { holderOf, targetsOf } from "@yunari/scene-fabric";
import { type Canvas, type FabricObject, Group } from "fabric/es";

/** Generic canvas stacking order; semantic layer projection lives in
 * editor-shell/layer-tree.ts. Each method reports whether a move happened. */
interface LayerManager {
  bringToFront(object?: FabricObject): boolean;
  bringForward(object?: FabricObject): boolean;
  sendToBack(object?: FabricObject): boolean;
  sendBackwards(object?: FabricObject): boolean;
}

export function createLayerManager(
  canvas: Canvas,
  save: () => void,
): LayerManager {
  const reorder = (
    object: FabricObject | undefined,
    move: (owner: Canvas | Group, object: FabricObject) => boolean,
  ): boolean => {
    if (object === undefined) return false;
    let moved = 0;
    for (const target of targetsOf(object)) {
      const owner = holderOf(canvas, target);
      // Membership is checked here rather than read off Fabric's boolean, which
      // answers true for an object it had to insert — that is the defect itself.
      if (!owner.getObjects().includes(target)) continue;
      if (move(owner, target)) moved += 1;
    }
    if (moved === 0) return false;
    // Only `StaticCanvas` requests the repaint from its stack-order hook;
    // `Group` merely marks itself dirty, so a move within a group needs this.
    canvas.requestRenderAll();
    save();
    return true;
  };
  return {
    bringToFront: (object = canvas.getActiveObject()) =>
      reorder(object, (owner, target) => owner.bringObjectToFront(target)),
    bringForward: (object = canvas.getActiveObject()) =>
      reorder(object, (owner, target) => owner.bringObjectForward(target)),
    sendToBack: (object = canvas.getActiveObject()) =>
      reorder(object, (owner, target) => owner.sendObjectToBack(target)),
    sendBackwards: (object = canvas.getActiveObject()) =>
      reorder(object, (owner, target) => owner.sendObjectBackwards(target)),
  };
}

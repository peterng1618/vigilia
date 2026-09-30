import {
  ActiveSelection,
  type Canvas,
  type FabricObject,
  Group,
} from "fabric/es";

/** Generic canvas stacking order; semantic layer projection lives in
 * editor-shell/layer-tree.ts. Each method reports whether a move happened. */
export interface LayerManager {
  bringToFront(object?: FabricObject): boolean;
  bringForward(object?: FabricObject): boolean;
  sendToBack(object?: FabricObject): boolean;
  sendBackwards(object?: FabricObject): boolean;
}

/** The collection that actually holds `object`. Fabric's stack methods read and
 * write only their own `_objects` and never check membership, so a move issued on
 * the canvas to a group child *inserts* it into the root and leaves it in both
 * arrays — painted and serialised twice. `parent` is the real owner and `group` is
 * not: Fabric repoints `group` at an `ActiveSelection` while a multi-selection is
 * live, but leaves `parent` on the owning group. */
function ownerOf(canvas: Canvas, object: FabricObject): Canvas | Group {
  return object.parent instanceof Group ? object.parent : canvas;
}

/** An `ActiveSelection` is not in `canvas._objects` at all, so handing one to a
 * stack method would insert the selection itself; its members are moved instead. */
function targetsOf(object: FabricObject): FabricObject[] {
  return object instanceof ActiveSelection ? object.getObjects() : [object];
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
      const owner = ownerOf(canvas, target);
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

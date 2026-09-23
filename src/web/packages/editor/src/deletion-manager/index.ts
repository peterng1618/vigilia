import { ActiveSelection, type Canvas, type FabricObject } from "fabric/es";

export interface DeletionManager {
  /** True when at least one object was removed. */
  deleteActive(): boolean;
}

/** A keyboard delete must respect the same lock the panels honour. */
function deletable(object: FabricObject): boolean {
  return object.get("locked") !== true;
}

export function createDeletionManager(
  canvas: Canvas,
  save: () => void,
): DeletionManager {
  return {
    deleteActive(): boolean {
      const active = canvas.getActiveObject();
      if (active === undefined) return false;
      const targets = (
        active instanceof ActiveSelection ? active.getObjects() : [active]
      ).filter(deletable);
      if (targets.length === 0) return false;

      canvas.discardActiveObject();
      canvas.remove(...targets);
      canvas.requestRenderAll();
      save();
      return true;
    },
  };
}

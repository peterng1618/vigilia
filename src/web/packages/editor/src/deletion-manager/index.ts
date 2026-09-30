import {
  ActiveSelection,
  type Canvas,
  type FabricObject,
  Group,
} from "fabric/es";

export interface DeletionManager {
  /** True when at least one object was removed. */
  deleteActive(): boolean;
}

/** A keyboard delete must respect the same lock the panels honour. */
function deletable(object: FabricObject): boolean {
  return object.get("locked") !== true;
}

/** The collection that actually holds `object`, which `canvas` does not when the
 * object is a group child: `Collection.remove` searches only its own `_objects`
 * and returns an empty removal for anything else. `parent` is the real owner even
 * while an `ActiveSelection` holds the object — Fabric leaves it there so
 * discarding the selection re-enters the group rather than orphaning the child. */
function ownerOf(object: FabricObject): Canvas | Group | undefined {
  const parent = object.parent;
  return parent instanceof Group ? parent : undefined;
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

      // Resolved before the selection is discarded: an `ActiveSelection` is one
      // of the things that put these objects where they are.
      const removals = targets.map(
        (object) => [ownerOf(object) ?? canvas, object] as const,
      );

      canvas.discardActiveObject();
      let removed = 0;
      for (const [owner, object] of removals) {
        if (owner.remove(object).length > 0) removed += 1;
      }
      // A removal that found nothing is not a deletion, and recording history
      // for it would leave the entry discarded as unchanged — the editor's state
      // and its claims agreeing on a scene that never moved.
      if (removed === 0) return false;
      canvas.requestRenderAll();
      save();
      return true;
    },
  };
}

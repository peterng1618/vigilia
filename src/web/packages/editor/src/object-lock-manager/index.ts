import { ActiveSelection, type Canvas, type FabricObject } from "fabric/es";

/** Fired when a lock is applied. `apply` writes the Fabric flags and fires no
    other event, so a surface that only re-reads on selection and history events
    — the selection inspector — would go on describing the object as editable. */
export const OBJECT_LOCK_CHANGED_EVENT = "editor:object-lock-changed";

export interface ObjectLockManager {
  lockObject(input?: { readonly object?: FabricObject }): void;
  unlockObject(input?: { readonly object?: FabricObject }): void;
  /** Releases the canvas listeners; the manager does not outlive its editor. */
  destroy(): void;
}

/**
 * "Cannot be transformed", in Fabric's own vocabulary and separate from
 * `selectable`, which is what keeps a locked object clickable. `hasControls` is
 * the load-bearing flag: it withdraws the handles, so the selection does not
 * promise a resize the `lock*` flags below then refuse.
 */
const TRANSFORM_LOCKED = {
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
} as const;

const TRANSFORM_FREE = {
  hasControls: true,
  lockMovementX: false,
  lockMovementY: false,
  lockScalingX: false,
  lockScalingY: false,
  lockRotation: false,
} as const;

const isLocked = (object: FabricObject): boolean =>
  object.get("locked") === true;

/** A multi-selection transforms its members through itself, so the flags above
 * go unconsulted and a locked object would ride along. `onSelect` is Fabric's
 * own hook for this but also gates a plain click, which would make a locked
 * object unselectable; dropping members after the selection exists keeps both. */
const keepLockedOutOfSelections = (canvas: Canvas): (() => void) => {
  const onSelectionChanged = (): void => {
    const active = canvas.getActiveObject();
    if (!(active instanceof ActiveSelection)) return;
    const locked = active.getObjects().filter(isLocked);
    if (locked.length === 0) return;
    for (const object of locked) active.remove(object);
    // Fabric discards a selection that empties, so the remainder is re-armed
    // here rather than assumed; a one-object remainder is not a selection, and
    // an emptied one has nothing left to select.
    const remaining = active.getObjects();
    const only = remaining.length === 1 ? remaining[0] : undefined;
    if (only !== undefined) canvas.setActiveObject(only);
    else if (remaining.length > 1) canvas.setActiveObject(active);
    else canvas.discardActiveObject();
    canvas.requestRenderAll();
  };
  for (const event of ["selection:created", "selection:updated"] as const) {
    canvas.on(event as never, onSelectionChanged as never);
  }
  return (): void => {
    for (const event of ["selection:created", "selection:updated"] as const) {
      canvas.off(event as never, onSelectionChanged as never);
    }
  };
};

export function createObjectLockManager(
  canvas: Canvas,
  save: () => void,
): ObjectLockManager {
  const unbind = keepLockedOutOfSelections(canvas);

  const apply = (object: FabricObject, locked: boolean): void => {
    object.set(locked ? TRANSFORM_LOCKED : TRANSFORM_FREE);
    object.set("locked", locked);
    // A locked object that is selected right now has to lose its handles now,
    // not on the next selection: `hasControls` is only read while drawing.
    object.setCoords();
    canvas.requestRenderAll();
    canvas.fire(
      OBJECT_LOCK_CHANGED_EVENT as never,
      { target: object } as never,
    );
  };

  // Undo rebuilds the scene, so a revived locked object is a new instance back
  // at Fabric's defaults. `locked` is the persisted state; the transform flags
  // are re-derived from it rather than persisted alongside it.
  const onHistoryLoaded = (): void => {
    const walk = (objects: readonly FabricObject[]): void => {
      for (const object of objects) {
        if (isLocked(object)) apply(object, true);
        const getObjects = (
          object as FabricObject & { getObjects?: () => FabricObject[] }
        ).getObjects;
        if (typeof getObjects === "function") walk(getObjects.call(object));
      }
    };
    walk(canvas.getObjects());
  };
  canvas.on("editor:history-state-loaded" as never, onHistoryLoaded as never);

  return {
    lockObject: ({ object = canvas.getActiveObject() } = {}) => {
      if (object === undefined || object === null) return;
      apply(object, true);
      save();
    },
    unlockObject: ({ object = canvas.getActiveObject() } = {}) => {
      if (object === undefined || object === null) return;
      apply(object, false);
      save();
    },
    destroy: () => {
      unbind();
      canvas.off(
        "editor:history-state-loaded" as never,
        onHistoryLoaded as never,
      );
    },
  };
}

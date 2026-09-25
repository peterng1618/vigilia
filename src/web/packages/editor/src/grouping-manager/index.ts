import {
  ActiveSelection,
  type Canvas,
  type FabricObject,
  Group,
  type Point,
} from "fabric/es";
import { findById } from "../editor-shell/layer-tree.js";

export interface GroupingManager {
  group(): Group | undefined;
  ungroup(): readonly FabricObject[] | undefined;
  /** Enters the group that owns `object`, or `object` itself, and selects it.
   * `scenePoint` picks the deepest child under the pointer instead: the flags
   * that make a group transparent to a pointer are only set here, so Fabric's
   * own hit test for the entering gesture still resolves to the group. */
  enterGroup(options?: {
    readonly object?: FabricObject;
    readonly scenePoint?: Point;
  }): FabricObject | undefined;
  /** Steps back out one level, clearing the through-selection flags. */
  exitGroup(): readonly FabricObject[] | undefined;
  readonly groupContext: () => readonly FabricObject[];
}

export interface GroupingManagerOptions {
  readonly canvas: Canvas;
  readonly save: () => void;
  readonly suspend: () => () => void;
}

const idOf = (object: FabricObject): string | undefined => {
  const id = (object as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
};

/** The nearest `Group` ancestor. Fabric keeps the owning group on `parent` even
 * while an `ActiveSelection` has taken the object off it, so one hop is the
 * whole walk. */
const ownerGroup = (object: FabricObject): Group | undefined => object.parent;

export function createGroupingManager(
  options: GroupingManagerOptions,
): GroupingManager {
  const { canvas, save } = options;

  /** Selection state, not authored content (§67): never persisted, never history. */
  let context: FabricObject[] = [];
  /** Which of the two through-selection flags this manager set, so `exitGroup`
   * restores only those and leaves an author's own flags alone. */
  const flagsSet = new Set<Group>();

  const makeSelectableThrough = (group: Group): void => {
    if (group.subTargetCheck && group.interactive) return;
    flagsSet.add(group);
    group.subTargetCheck = true;
    group.interactive = true;
  };

  const clearThroughFlags = (): void => {
    for (const group of flagsSet) {
      group.subTargetCheck = false;
      group.interactive = false;
    }
    flagsSet.clear();
  };

  /** Restoring history rebuilds the scene (`loadFromJSON`), so the entered
   * group is a *new* instance with the through-selection flags back at their
   * defaults, and the recorded context points at objects no longer on the
   * canvas. Re-resolve by id and re-apply, or `exitGroup` restores nothing. */
  const onHistoryLoaded = (): void => {
    const id = context.map(idOf).find((candidate) => candidate !== undefined);
    const found =
      id === undefined ? undefined : findById(canvas.getObjects(), id);
    if (!(found instanceof Group)) {
      context = [];
      flagsSet.clear();
      return;
    }
    context = [found];
    flagsSet.clear();
    makeSelectableThrough(found);
    canvas.requestRenderAll();
  };
  canvas.on("editor:history-state-loaded" as never, onHistoryLoaded);

  return {
    group(): Group | undefined {
      const active = canvas.getActiveObject();
      if (!(active instanceof ActiveSelection)) return undefined;
      const members = [...active.getObjects()];
      if (members.length < 2) return undefined;

      const release = options.suspend();
      try {
        canvas.discardActiveObject();
        const group = new Group(members);
        // `id` is Vigilia's own persisted property, not a Fabric GroupProps key.
        group.set("id", `group-${crypto.randomUUID()}`);
        for (const member of members) canvas.remove(member);
        canvas.add(group);
        canvas.setActiveObject(group);
        canvas.requestRenderAll();
        return group;
      } finally {
        release();
        save();
      }
    },

    ungroup(): readonly FabricObject[] | undefined {
      const active = canvas.getActiveObject();
      if (!(active instanceof Group)) return undefined;

      const release = options.suspend();
      try {
        // `removeAll` bakes the group transform into each child.
        const members = active.removeAll();
        canvas.remove(active);
        for (const member of members) {
          member.setCoords();
          canvas.add(member);
        }
        canvas.setActiveObject(new ActiveSelection(members, { canvas }));
        canvas.requestRenderAll();
        // The entered group is gone, so a later `exitGroup` would otherwise
        // re-select a destroyed object.
        context = [];
        flagsSet.delete(active);
        active.subTargetCheck = false;
        active.interactive = false;
        return members;
      } finally {
        release();
        save();
      }
    },

    enterGroup(input): FabricObject | undefined {
      const object = input?.object ?? canvas.getActiveObject();
      if (object === undefined || object === null) return undefined;
      // The double-click that enters a group resolves to the *group*, because a
      // group is only transparent to a pointer once the flags below are set — and
      // they are set here, after Fabric's own hit test has already run. So the
      // deepest child under the pointer is re-resolved once they are on, or the
      // gesture selects the group it was meant to enter.
      const entry = ownerGroup(object) ?? object;
      if (entry instanceof Group) makeSelectableThrough(entry);
      const point = input?.scenePoint;
      const deepest =
        entry instanceof Group && point !== undefined
          ? canvas.searchPossibleTargets([entry], point).target
          : undefined;
      const selected = deepest ?? object;
      // Recorded before `setActiveObject`: that call fires `selection:created`
      // synchronously, and the bridge re-reads the layer tree on it, so the
      // context must already be right when the panel renders.
      context = [entry];
      canvas.setActiveObject(selected);
      canvas.requestRenderAll();
      return selected;
    },

    exitGroup(): readonly FabricObject[] | undefined {
      const before = [...context];
      const target = context.pop();
      if (target === undefined) return undefined;
      clearThroughFlags();
      // An entry can only have been destroyed by an operation that also clears
      // the context (`ungroup`), so `target` is still on the canvas here.
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
      return before;
    },

    groupContext: () => context,
  };
}

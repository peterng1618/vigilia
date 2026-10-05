// @vitest-environment jsdom
import { serialiseScene } from "@vigilia/scene-fabric";
import { ActiveSelection, Canvas, Group, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createLayerManager } from "./index.js";

type Manager = ReturnType<typeof createLayerManager>;

/** Every move the layer manager exposes, in the shape the tests drive them. */
const MOVES = [
  ["bringToFront", (m: Manager) => m.bringToFront()],
  ["bringForward", (m: Manager) => m.bringForward()],
  ["sendToBack", (m: Manager) => m.sendToBack()],
  ["sendBackwards", (m: Manager) => m.sendBackwards()],
] as const;

/** A group of three rects on a canvas with one more rect at the root, so the
 * child under test sits between siblings and can move in every direction, and a
 * selection can straddle both collections. */
function scene() {
  const canvas = new Canvas(document.createElement("canvas"));
  const before = new Rect({ id: "before", width: 10, height: 10 });
  const child = new Rect({ id: "child", left: 30, width: 10, height: 10 });
  const after = new Rect({ id: "after", left: 60, width: 10, height: 10 });
  const group = new Group([before, child, after]);
  group.set("id", "group");
  const root = new Rect({ id: "root", left: 90, width: 10, height: 10 });
  canvas.add(root, group);
  return { canvas, before, child, after, group, root };
}

const idsOf = (objects: readonly unknown[]) =>
  objects.map((object) => (object as { id?: unknown }).id);

describe("LayerManager", () => {
  it("reorders the active object and saves history for each action", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const back = new Rect({ id: "back" });
    const front = new Rect({ id: "front" });
    canvas.add(back, front);
    canvas.setActiveObject(back);
    const save = vi.fn();
    const manager = createLayerManager(canvas, save);

    expect(manager.bringToFront()).toBe(true);
    expect(canvas.getObjects().at(-1)).toBe(back);

    expect(manager.sendToBack()).toBe(true);
    expect(canvas.getObjects().at(0)).toBe(back);

    expect(manager.bringForward()).toBe(true);
    expect(canvas.getObjects().at(1)).toBe(back);

    expect(manager.sendBackwards()).toBe(true);
    expect(canvas.getObjects().at(0)).toBe(back);

    expect(save).toHaveBeenCalledTimes(4);

    // `back` is now at the bottom, so this move finds nothing to do. It says so
    // rather than claiming a reorder, and records no history for it.
    expect(manager.sendBackwards()).toBe(false);
    expect(canvas.getObjects().at(0)).toBe(back);
    expect(save).toHaveBeenCalledTimes(4);
  });

  it("reports failure and saves nothing without a target object", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const manager = createLayerManager(canvas, save);

    for (const [, move] of MOVES) {
      expect(move(manager)).toBe(false);
    }

    expect(save).not.toHaveBeenCalled();
  });

  it("reports failure and saves nothing for a target in no collection", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const manager = createLayerManager(canvas, save);
    canvas.setActiveObject(new Rect({ id: "detached" }));

    for (const [, move] of MOVES) {
      expect(move(manager)).toBe(false);
    }

    expect(save).not.toHaveBeenCalled();
  });

  it.each(MOVES)("%s leaves a group child in its group", (_, move) => {
    const { canvas, child, group } = scene();
    const save = vi.fn();
    const manager = createLayerManager(canvas, save);
    canvas.setActiveObject(child);

    // Membership first: the duplication is the defect, the boolean is the claim.
    move(manager);

    expect(canvas.getObjects()).not.toContain(child);
    expect(canvas.getObjects()).toHaveLength(2);
    expect(group.getObjects()).toEqual(expect.arrayContaining([child]));
    expect(save).toHaveBeenCalledOnce();
  });

  it("reorders the group child among its siblings rather than at the root", () => {
    const { canvas, child, group } = scene();
    const manager = createLayerManager(canvas, vi.fn());
    canvas.setActiveObject(child);

    expect(manager.bringToFront()).toBe(true);

    expect(idsOf(group.getObjects())).toEqual(["before", "after", "child"]);
    expect(idsOf(canvas.getObjects())).toEqual(["root", "group"]);
  });

  it.each(MOVES)(
    "%s serialises a reordered group child exactly once",
    (_, move) => {
      const { canvas, child } = scene();
      const manager = createLayerManager(canvas, vi.fn());
      canvas.setActiveObject(child);

      move(manager);

      // The defect as a reader would see it: one entry in the scene, not two.
      const saved = serialiseScene(canvas);
      expect(idsOf(saved.objects)).toEqual(["root", "group"]);
      const children = (saved.objects[1]?.["objects"] ?? []) as unknown[];
      expect(idsOf(children)).toHaveLength(3);
      expect(
        idsOf(children).filter((id) => id === child.get("id")),
      ).toHaveLength(1);
    },
  );

  it("does the right thing per object for a mixed selection", () => {
    const { canvas, child, group, root } = scene();
    const manager = createLayerManager(canvas, vi.fn());
    canvas.setActiveObject(new ActiveSelection([child, root], { canvas }));

    expect(manager.bringToFront()).toBe(true);

    // The group child moves inside its group and the root object moves at the
    // root; neither is inserted into the collection that does not hold it, and
    // the selection itself is never handed to a stack method.
    expect(idsOf(group.getObjects())).toEqual(["before", "after", "child"]);
    expect(idsOf(canvas.getObjects())).toEqual(["group", "root"]);
    expect(canvas.getObjects()).not.toContain(child);
    expect(idsOf(serialiseScene(canvas).objects)).toEqual(["group", "root"]);
  });
});

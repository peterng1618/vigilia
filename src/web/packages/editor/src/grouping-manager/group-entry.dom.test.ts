// @vitest-environment jsdom
import { Canvas, Group, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createGroupingManager } from "./index.js";

describe("group entry", () => {
  it("enters a group and selects the child under the object", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const child = new Rect({ id: "child", width: 10, height: 10 });
    const group = new Group([child]);
    group.set("id", "group");
    canvas.add(group);
    const manager = createGroupingManager({
      canvas,
      save: vi.fn(),
      suspend: () => () => undefined,
    });

    expect(manager.enterGroup({ object: group })).toBe(group);
    expect(manager.groupContext()).toEqual([group]);

    // A child's pointer target resolves to the child, not the group.
    const target = manager.enterGroup({ object: child });
    expect(target).toBe(child);
    expect(canvas.getActiveObject()).toBe(child);
    // Asserted on the flags themselves, so a failure names the mechanism rather
    // than only the symptom: Fabric retargets only when both are true.
    expect(group.subTargetCheck).toBe(true);
    expect(group.interactive).toBe(true);

    expect(manager.exitGroup()).toEqual([group]);
    expect(canvas.getActiveObject()).toBe(group);
    expect(manager.groupContext()).toEqual([]);
    expect(group.subTargetCheck).toBe(false);
    expect(group.interactive).toBe(false);
  });

  it("clears the context when the group is ungrouped", () => {
    // Step 3 says this guard "is asserted below" — it was not, in either this
    // test or Step 6, so the guard could be deleted with the suite green. This is
    // Review Focus item 4: a stale context re-selects a destroyed group.
    const canvas = new Canvas(document.createElement("canvas"));
    const child = new Rect({ id: "child", width: 10, height: 10 });
    const group = new Group([child]);
    group.set("id", "group");
    canvas.add(group);
    canvas.setActiveObject(group);
    const manager = createGroupingManager({
      canvas,
      save: vi.fn(),
      suspend: () => () => undefined,
    });

    // `ungroup()` requires a Group to be active, so activate it before entering —
    // entering a group does not make it the canvas's active object.
    expect(manager.enterGroup({ object: child })).toBe(child);
    expect(manager.groupContext()).toEqual([group]);

    // The brief's fixture stops here, but `enterGroup` has just made the *child*
    // the canvas's active object, and `ungroup()` requires a Group to be active —
    // the precondition this test's own comment states. Re-activating the group is
    // that missing line, not a change to the guard under test.
    canvas.setActiveObject(group);

    // `removeAll` normally bakes the transform into the children; this fixture's
    // child is plain geometry, so the members it returns are what matters.
    expect(manager.ungroup()).toEqual([child]);

    expect(manager.groupContext()).toEqual([]);
    // The real failure the guard prevents: an exit now would re-select a group
    // that is no longer on the canvas.
    expect(canvas.getObjects()).not.toContain(group);
    expect(manager.exitGroup()).toBeUndefined();
  });
});

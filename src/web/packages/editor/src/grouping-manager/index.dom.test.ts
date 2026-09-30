// @vitest-environment jsdom
import { ActiveSelection, Canvas, Group, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createGroupingManager, GROUP_CONTEXT_EVENT } from "./index.js";

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const save = vi.fn();
  const release = vi.fn();
  const grouping = createGroupingManager({
    canvas,
    save,
    suspend: () => release,
  });
  return { canvas, grouping, save, release };
}

describe("GroupingManager", () => {
  it("groups the active selection into one identified group", () => {
    const { canvas, grouping, save, release } = setup();
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", left: 40, width: 10, height: 10 });
    canvas.add(first, second);
    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));

    const group = grouping.group();

    expect(group).toBeInstanceOf(Group);
    expect(group?.get("id")).toMatch(/^group-/);
    expect(canvas.getObjects()).toEqual([group]);
    expect(group?.getObjects()).toHaveLength(2);
    expect(save).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it("names the group, so the row never prints its uuid", () => {
    // A row with no authored name falls back to the id (see `object-name.ts`),
    // and a minted one is a uuid — readable by nobody. `newObjectName` is the
    // owner every other creator already goes through.
    const { canvas, grouping } = setup();
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", left: 40, width: 10, height: 10 });
    canvas.add(first, second);
    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));

    expect(grouping.group()?.get("name")).toBe("Group");
  });

  it("refuses to group fewer than two objects", () => {
    const { canvas, grouping, save } = setup();
    const only = new Rect({ id: "a", width: 10, height: 10 });
    canvas.add(only);
    canvas.setActiveObject(only);

    expect(grouping.group()).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });

  it("ungroups the active group back onto the canvas", () => {
    const { canvas, grouping, save } = setup();
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", left: 40, width: 10, height: 10 });
    const group = new Group([first, second]);
    group.set("id", "group-1");
    canvas.add(group);
    canvas.setActiveObject(group);

    const released = grouping.ungroup();

    expect(released).toHaveLength(2);
    expect(canvas.getObjects()).toHaveLength(2);
    expect(canvas.getObjects()).not.toContain(group);
    expect(save).toHaveBeenCalledOnce();
  });

  it("preserves world position through a group and ungroup round trip", () => {
    // Fabric 7 defaults originX/originY to "center", so a member's `left` IS its
    // world centre; the round trip must restore both exactly.
    const { canvas, grouping } = setup();
    const first = new Rect({
      id: "a",
      left: 10,
      top: 20,
      width: 10,
      height: 10,
    });
    const second = new Rect({
      id: "b",
      left: 60,
      top: 80,
      width: 10,
      height: 10,
    });
    canvas.add(first, second);
    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));

    grouping.group();
    const grouped = canvas
      .getObjects()
      .find((object) => object instanceof Group) as Group | undefined;
    const centres = new Map(
      grouped
        ?.getObjects()
        .map((object) => [object.get("id"), object.getCenterPoint()]),
    );
    grouping.ungroup();

    const byId = new Map(
      canvas.getObjects().map((object) => [object.get("id"), object]),
    );
    const restored = byId.get("a")!;
    expect(restored.getCenterPoint().x).toBeCloseTo(centres.get("a")!.x, 3);
    expect(restored.getCenterPoint().y).toBeCloseTo(centres.get("a")!.y, 3);
    expect(restored.getCenterPoint().x).toBeCloseTo(10, 3);
    expect(restored.getCenterPoint().y).toBeCloseTo(20, 3);
    expect(byId.get("b")?.getCenterPoint().x).toBeCloseTo(60, 3);
    expect(byId.get("b")?.getCenterPoint().y).toBeCloseTo(80, 3);
  });

  it("returns undefined when the active object is not a group", () => {
    const { canvas, grouping, save } = setup();
    const object = new Rect({ id: "a", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(grouping.ungroup()).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });
});

describe("GroupingManager announces its context", () => {
  it("fires on entry and on exit, and not when nothing changed", () => {
    // Entering a group does not move the selection — the group is already the
    // active object — so Fabric fires nothing and the layer panel has no way to
    // learn the context changed. Measured on the running editor: zero events.
    const canvas = new Canvas(document.createElement("canvas"));
    const seen: string[] = [];
    const onChange = (): void => {
      seen.push("changed");
    };
    canvas.on(GROUP_CONTEXT_EVENT as never, onChange);
    const grouping = createGroupingManager({
      canvas,
      save: vi.fn(),
      suspend: (): (() => void) => vi.fn(),
    });
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", left: 40, width: 10, height: 10 });
    canvas.add(first, second);
    const group = new Group([first, second]);
    canvas.add(group);
    canvas.setActiveObject(group);

    grouping.enterGroup({ object: group });
    expect(seen).toHaveLength(1);

    // Re-entering the same group is not a second level, so it says nothing.
    grouping.enterGroup({ object: group });
    expect(seen).toHaveLength(1);

    grouping.exitGroup();
    expect(seen).toHaveLength(2);

    // Leaving again with nothing entered changes nothing and announces nothing.
    grouping.exitGroup();
    expect(seen).toHaveLength(2);

    canvas.off(GROUP_CONTEXT_EVENT as never, onChange);
  });
});

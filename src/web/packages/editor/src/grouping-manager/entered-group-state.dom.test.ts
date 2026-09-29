// @vitest-environment jsdom
import { Canvas, FabricImage, Group, Rect, Textbox } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createGroupingManager } from "./index.js";

/** The state the manager applies to the canvas while a group is entered. */
const reachable = (canvas: Canvas): Record<string, boolean> =>
  Object.fromEntries(
    canvas
      .getObjects()
      .map((object) => [
        (object as { id?: string }).id ?? object.type,
        object.selectable === true,
      ]),
  );

function scene(): {
  canvas: Canvas;
  group: Group;
  outsider: Rect;
  text: Textbox;
} {
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  const outsider = new Rect({ id: "outsider", width: 10, height: 10 });
  const text = new Textbox("hello", { id: "text", width: 40, height: 20 });
  canvas.add(group, outsider, text);
  return { canvas, group, outsider, text };
}

const manager = (canvas: Canvas) =>
  createGroupingManager({
    canvas,
    save: vi.fn(),
    suspend: () => () => undefined,
  });

describe("entering a group", () => {
  it("makes every object outside the entered group unreachable on the artboard", () => {
    const { canvas, group, outsider } = scene();
    const grouping = manager(canvas);

    grouping.enterGroup({ object: group });

    // U6: the layer panel already says only the group's own layers are reachable.
    // The artboard has to agree, or the panel is describing a fiction.
    expect(reachable(canvas)).toEqual({
      group: true,
      outsider: false,
      text: false,
    });
    expect(outsider.selectable).toBe(false);
    expect(outsider.evented).toBe(false);
    // The group's own children are the point of entering it, so they are untouched.
    expect((group.getObjects()[0] as Rect).selectable).toBe(true);

    grouping.exitGroup();

    expect(reachable(canvas)).toEqual({
      group: true,
      outsider: true,
      text: true,
    });
  });

  it("restores an author's own flags rather than assuming the defaults", () => {
    const { canvas, group, outsider } = scene();
    // A locked layer stays locked on the way out; the manager never owned it.
    outsider.set("selectable", false);
    outsider.set("evented", false);
    const grouping = manager(canvas);

    grouping.enterGroup({ object: group });
    grouping.exitGroup();

    expect(outsider.selectable).toBe(false);
    expect(outsider.evented).toBe(false);
  });

  it("records no context for a double-click that is not a group", () => {
    // U7: a text box's double-click enters inline editing, and `editor-shell`
    // routes every double-click here. Recording that as a group entry left the
    // panel dimmed for every other layer until Escape.
    const { canvas, text } = scene();
    const grouping = manager(canvas);

    grouping.enterGroup({ object: text });

    expect(grouping.groupContext()).toEqual([]);
    expect(reachable(canvas)).toEqual({
      group: true,
      outsider: true,
      text: true,
    });
  });

  it("records no context for an image that is not a group", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = new FabricImage(document.createElement("img"), {
      id: "image-1",
    });
    canvas.add(image);
    const grouping = manager(canvas);

    grouping.enterGroup({ object: image });

    expect(grouping.groupContext()).toEqual([]);
  });

  it("leaves one level when the same group is entered again", () => {
    const { canvas, group } = scene();
    const grouping = manager(canvas);

    grouping.enterGroup({ object: group });
    expect(grouping.groupContext()).toEqual([group]);
    // A second double-click inside the entered group must not stack a context
    // the panel would then treat as two levels of "reachable".
    grouping.enterGroup({ object: group });

    expect(grouping.groupContext()).toEqual([group]);
  });

  it("leaves the previous group when a different one is entered", () => {
    const { canvas, group, outsider } = scene();
    const second = new Group([
      new Rect({ id: "child-2", width: 10, height: 10 }),
    ]);
    second.set("id", "group-2");
    canvas.add(second);
    const grouping = manager(canvas);

    grouping.enterGroup({ object: group });
    grouping.enterGroup({ object: second });

    expect(grouping.groupContext()).toEqual([second]);
    expect(outsider.selectable).toBe(false);
    expect(second.selectable).toBe(true);
  });

  it("re-applies the state to a group rebuilt by history", () => {
    const { canvas, group, outsider } = scene();
    const grouping = manager(canvas);
    grouping.enterGroup({ object: group });

    // `loadFromJSON` rebuilds the scene, so the manager's group instance is gone.
    const revived = new Group([
      new Rect({ id: "child", width: 10, height: 10 }),
    ]);
    revived.set("id", "group");
    canvas.remove(group);
    canvas.add(revived);
    canvas.fire("editor:history-state-loaded" as never);

    expect(grouping.groupContext()).toEqual([revived]);
    expect(outsider.selectable).toBe(false);
    expect(revived.subTargetCheck).toBe(true);
  });

  it("restores the artboard when the entered group is ungrouped", () => {
    const { canvas, group, outsider } = scene();
    const grouping = manager(canvas);
    grouping.enterGroup({ object: group });
    canvas.setActiveObject(group);

    grouping.ungroup();

    expect(grouping.groupContext()).toEqual([]);
    expect(outsider.selectable).toBe(true);
  });

  it("applies the state to a child that arrives after entry", () => {
    const { canvas, group } = scene();
    const grouping = manager(canvas);
    grouping.enterGroup({ object: group });

    // Duplicating inside a group can add a sibling to the canvas root before it
    // is taken into the group; it must not stay reachable behind the author's back.
    const late = new Rect({ id: "late", width: 4, height: 4 });
    canvas.add(late);

    expect(late.selectable).toBe(false);
    grouping.exitGroup();
    expect(late.selectable).toBe(true);
  });
});

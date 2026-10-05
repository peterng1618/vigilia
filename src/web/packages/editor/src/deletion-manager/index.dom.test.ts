// @vitest-environment jsdom
import { ActiveSelection, Canvas, Group, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createDeletionManager } from "./index.js";

describe("DeletionManager", () => {
  it("removes the active object and saves once", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape" });
    canvas.add(object);
    canvas.setActiveObject(object);
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(true);

    expect(canvas.getObjects()).toEqual([]);
    expect(canvas.getActiveObject()).toBeUndefined();
    expect(save).toHaveBeenCalledOnce();
  });

  it("removes every member of an active selection, not the wrapper", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const first = new Rect({ id: "a" });
    const second = new Rect({ id: "b" });
    canvas.add(first, second);
    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(true);

    expect(canvas.getObjects()).toEqual([]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("skips a locked object and reports that nothing was deleted", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", locked: true });
    canvas.add(object);
    canvas.setActiveObject(object);
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(false);

    expect(canvas.getObjects()).toEqual([object]);
    expect(save).not.toHaveBeenCalled();
  });

  it("deletes the unlocked members of a mixed selection", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const free = new Rect({ id: "a" });
    const locked = new Rect({ id: "b", locked: true });
    canvas.add(free, locked);
    canvas.setActiveObject(new ActiveSelection([free, locked], { canvas }));
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(true);

    expect(canvas.getObjects()).toEqual([locked]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("does nothing and saves nothing with an empty selection", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(false);

    expect(save).not.toHaveBeenCalled();
  });

  // The reported journey: enter a group, select a child, press Delete.
  it("removes a child from the group that holds it, not from the canvas", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const child = new Rect({ id: "child" });
    const group = new Group([child]);
    canvas.add(group);
    canvas.setActiveObject(child);
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(true);

    expect(group.getObjects()).toEqual([]);
    expect(canvas.getObjects()).toEqual([group]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("still removes a top-level group", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const group = new Group([new Rect({ id: "child" })]);
    canvas.add(group);
    canvas.setActiveObject(group);
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(true);

    expect(canvas.getObjects()).toEqual([]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("removes only the free member of a selection spanning a group", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const free = new Rect({ id: "free" });
    const child = new Rect({ id: "child" });
    const group = new Group([child]);
    canvas.add(free, group);
    canvas.setActiveObject(new ActiveSelection([free, child], { canvas }));
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(true);

    expect(group.getObjects()).toEqual([]);
    expect(canvas.getObjects()).toEqual([group]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("skips a locked group child and keeps the group", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const locked = new Rect({ id: "child", locked: true });
    const group = new Group([locked]);
    canvas.add(group);
    canvas.setActiveObject(locked);
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(false);

    expect(group.getObjects()).toEqual([locked]);
    expect(save).not.toHaveBeenCalled();
  });

  it("reports no deletion when the removal found nothing", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const orphan = new Rect({ id: "orphan" });
    canvas.setActiveObject(orphan);
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(false);

    expect(save).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { ActiveSelection, Canvas, Group, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSelectionToolbar } from "./index.js";
import type { EditorInteraction } from "../editor-interaction.js";

function editorFor(canvas: Canvas): EditorInteraction {
  return {
    canvas,
    imageManager: { importImage: vi.fn(async () => null) },
    textManager: { addText: vi.fn() },
    layerManager: {
      bringToFront: vi.fn(),
      bringForward: vi.fn(),
      sendToBack: vi.fn(),
      sendBackwards: vi.fn(),
    },
    objectLockManager: { lockObject: vi.fn(), unlockObject: vi.fn() },
    deletionManager: { deleteActive: vi.fn(() => true) },
    clipboardManager: {
      copy: vi.fn(async () => true),
      cut: vi.fn(async () => true),
      paste: vi.fn(async () => true),
      duplicate: vi.fn(async () => true),
      destroy: vi.fn(),
    },
    groupingManager: { group: vi.fn(), ungroup: vi.fn() },
    cropManager: {
      active: false,
      begin: vi.fn(() => true),
      setAspect: vi.fn(),
      apply: vi.fn(),
      cancel: vi.fn(),
    },
    errorManager: { error: vi.fn(), warn: vi.fn() },
    historyManager: {
      saveState: vi.fn(),
      resetHistory: vi.fn(),
      undo: vi.fn(async () => {}),
      redo: vi.fn(async () => {}),
      suspend: vi.fn(() => () => {}),
    },
    destroy: vi.fn(),
  } as unknown as EditorInteraction;
}

function visible(root: HTMLElement): boolean {
  return root.style.display !== "none";
}

describe("SelectionToolbar", () => {
  it("stays hidden until something is selected", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const toolbar = createSelectionToolbar(editorFor(canvas));

    expect(visible(toolbar.root)).toBe(false);
    toolbar.destroy();
  });

  it("shows the unlocked action set for a selected object", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    canvas.setActiveObject(object);
    canvas.fire("selection:created", { selected: [object] });

    expect(visible(toolbar.root)).toBe(true);
    const actions = [...toolbar.root.querySelectorAll("[data-vigilia-toolbar-action]")].map(
      (button) => button.getAttribute("data-vigilia-toolbar-action"),
    );
    expect(actions).toEqual([
      "duplicate",
      "lock",
      "front",
      "forward",
      "backward",
      "back",
      "group",
      "ungroup",
      "delete",
    ]);
    toolbar.destroy();
  });

  it("shows only unlock for a locked object", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10, locked: true });
    canvas.add(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    canvas.setActiveObject(object);
    canvas.fire("selection:created", { selected: [object] });

    const actions = [...toolbar.root.querySelectorAll("[data-vigilia-toolbar-action]")].map(
      (button) => button.getAttribute("data-vigilia-toolbar-action"),
    );
    expect(actions).toEqual(["unlock"]);
    toolbar.destroy();
  });

  it("hides during a transform and returns afterwards", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));
    canvas.fire("selection:created", { selected: [object] });

    canvas.fire("object:moving" as never, { target: object } as never);
    expect(visible(toolbar.root)).toBe(false);

    canvas.fire("object:modified" as never, { target: object } as never);
    expect(visible(toolbar.root)).toBe(true);
    toolbar.destroy();
  });

  it("hides when the selection clears", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));
    canvas.fire("selection:created", { selected: [object] });

    canvas.discardActiveObject();
    canvas.fire("selection:cleared" as never, {} as never);

    expect(visible(toolbar.root)).toBe(false);
    toolbar.destroy();
  });

  it("enables group only for a multi-object selection", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", width: 10, height: 10 });
    canvas.add(first, second);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    canvas.setActiveObject(first);
    canvas.fire("selection:created", { selected: [first] });
    expect(
      toolbar.root.querySelector<HTMLButtonElement>('[data-vigilia-toolbar-action="group"]')
        ?.disabled,
    ).toBe(true);

    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));
    canvas.fire("selection:updated" as never, { selected: [first, second] } as never);
    expect(
      toolbar.root.querySelector<HTMLButtonElement>('[data-vigilia-toolbar-action="group"]')
        ?.disabled,
    ).toBe(false);
    toolbar.destroy();
  });

  it("enables ungroup only for a group", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const group = new Group([new Rect({ id: "a", width: 10, height: 10 })]);
    group.set("id", "group-1");
    canvas.add(group);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    canvas.setActiveObject(group);
    canvas.fire("selection:created", { selected: [group] });

    expect(
      toolbar.root.querySelector<HTMLButtonElement>('[data-vigilia-toolbar-action="ungroup"]')
        ?.disabled,
    ).toBe(false);
    toolbar.destroy();
  });

  it("routes each action to its owning manager", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);
    const editor = editorFor(canvas);
    const toolbar = createSelectionToolbar(editor);
    canvas.fire("selection:created", { selected: [object] });

    const click = (action: string): void => {
      toolbar.root
        .querySelector<HTMLButtonElement>(`[data-vigilia-toolbar-action="${action}"]`)
        ?.click();
    };
    click("duplicate");
    click("lock");
    click("front");
    click("delete");

    expect(editor.clipboardManager.duplicate).toHaveBeenCalledOnce();
    expect(editor.objectLockManager.lockObject).toHaveBeenCalledOnce();
    expect(editor.layerManager.bringToFront).toHaveBeenCalledOnce();
    expect(editor.deletionManager.deleteActive).toHaveBeenCalledOnce();
    toolbar.destroy();
  });

  it("detaches every listener on destroy", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    toolbar.destroy();
    canvas.setActiveObject(object);

    expect(() => canvas.fire("selection:created", { selected: [object] })).not.toThrow();
    expect(toolbar.root.isConnected).toBe(false);
  });
});

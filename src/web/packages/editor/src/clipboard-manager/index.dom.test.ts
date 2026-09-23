// @vitest-environment jsdom
import { ActiveSelection, Canvas, Rect } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeletionManager } from "../deletion-manager/index.js";
import { createErrorManager } from "../error-manager/index.js";
import { createClipboardManager } from "./index.js";

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const save = vi.fn();
  const importImage = vi.fn(async () => null);
  const clipboard = createClipboardManager({
    canvas,
    save,
    errors: createErrorManager(canvas),
    deletion: createDeletionManager(canvas, save),
    importImage,
  });
  return { canvas, clipboard, save, importImage };
}

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => {}), write: vi.fn(async () => {}) },
  });
});

describe("ClipboardManager", () => {
  it("pastes a clone offset by ten on both axes with a fresh id", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({
      id: "shape",
      left: 20,
      top: 30,
      width: 10,
      height: 10,
    });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(await clipboard.copy()).toBe(true);
    expect(await clipboard.paste()).toBe(true);

    const objects = canvas.getObjects();
    expect(objects).toHaveLength(2);
    const pasted = objects[1]!;
    expect(pasted.left).toBe(30);
    expect(pasted.top).toBe(40);
    expect(pasted.get("id")).not.toBe("shape");
    expect(pasted.get("id")).toMatch(/^rect-/);
  });

  it("duplicates in one action without touching the clipboard", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({
      id: "shape",
      left: 0,
      top: 0,
      width: 10,
      height: 10,
    });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(await clipboard.duplicate()).toBe(true);

    expect(canvas.getObjects()).toHaveLength(2);
    expect(canvas.getObjects()[1]?.left).toBe(10);
  });

  it("cuts by copying then deleting", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(await clipboard.cut()).toBe(true);
    expect(canvas.getObjects()).toEqual([]);

    expect(await clipboard.paste()).toBe(true);
    expect(canvas.getObjects()).toHaveLength(1);
  });

  it("refuses to copy a locked object", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({ id: "shape", locked: true });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(await clipboard.copy()).toBe(false);
  });

  it("pastes every member of a copied selection", async () => {
    const { canvas, clipboard } = setup();
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", left: 40, width: 10, height: 10 });
    canvas.add(first, second);
    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));

    expect(await clipboard.copy()).toBe(true);
    expect(await clipboard.paste()).toBe(true);

    expect(canvas.getObjects()).toHaveLength(4);
    const ids = canvas.getObjects().map((object) => object.get("id"));
    expect(new Set(ids).size).toBe(4);
  });

  it("fires editor:object-pasted so charts can rehydrate", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);
    const pasted = vi.fn();
    canvas.on("editor:object-pasted" as never, pasted as never);

    await clipboard.copy();
    await clipboard.paste();

    expect(pasted).toHaveBeenCalledOnce();
  });

  it("imports an image file pasted from another application", async () => {
    const { canvas, importImage } = setup();
    const file = new File([new Uint8Array([1])], "shot.png", {
      type: "image/png",
    });
    const event = new Event("paste") as Event & { clipboardData: unknown };
    Object.defineProperty(event, "clipboardData", {
      value: {
        items: [{ type: "image/png", getAsFile: () => file }],
        getData: () => "",
      },
    });

    document.dispatchEvent(event);
    await vi.waitFor(() => expect(importImage).toHaveBeenCalledOnce());

    expect(importImage).toHaveBeenCalledWith({ source: file });
    await canvas.dispose();
  });

  it("stops listening for paste after destroy", async () => {
    const { clipboard, importImage } = setup();
    clipboard.destroy();
    const file = new File([new Uint8Array([1])], "shot.png", {
      type: "image/png",
    });
    const event = new Event("paste") as Event;
    Object.defineProperty(event, "clipboardData", {
      value: {
        items: [{ type: "image/png", getAsFile: () => file }],
        getData: () => "",
      },
    });

    document.dispatchEvent(event);

    expect(importImage).not.toHaveBeenCalled();
  });
});

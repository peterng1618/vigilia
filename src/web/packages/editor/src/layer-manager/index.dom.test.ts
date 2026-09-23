// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createLayerManager } from "./index.js";

describe("LayerManager", () => {
  it("reorders the active object and saves history for each action", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const back = new Rect({ id: "back" });
    const front = new Rect({ id: "front" });
    canvas.add(back, front);
    canvas.setActiveObject(back);
    const save = vi.fn();
    const manager = createLayerManager(canvas, save);

    manager.bringToFront();
    expect(canvas.getObjects().at(-1)).toBe(back);

    manager.sendToBack();
    expect(canvas.getObjects().at(0)).toBe(back);

    manager.bringForward();
    expect(canvas.getObjects().at(1)).toBe(back);

    manager.sendBackwards();
    expect(canvas.getObjects().at(0)).toBe(back);

    expect(save).toHaveBeenCalledTimes(4);
  });

  it("saves history even without a target object", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const manager = createLayerManager(canvas, save);

    manager.bringToFront();

    expect(save).toHaveBeenCalledOnce();
  });
});

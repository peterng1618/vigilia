// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createObjectLockManager } from "./index.js";

describe("ObjectLockManager", () => {
  it("locks and unlocks the active object and saves history", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape" });
    canvas.add(object);
    canvas.setActiveObject(object);
    const save = vi.fn();
    const manager = createObjectLockManager(canvas, save);

    manager.lockObject();
    expect(object.selectable).toBe(false);
    expect(object.evented).toBe(false);
    expect(object.get("locked")).toBe(true);

    manager.unlockObject();
    expect(object.selectable).toBe(true);
    expect(object.evented).toBe(true);
    expect(object.get("locked")).toBe(false);

    expect(save).toHaveBeenCalledTimes(2);
  });

  it("accepts an explicit object instead of the active selection", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape" });
    const save = vi.fn();
    const manager = createObjectLockManager(canvas, save);

    manager.lockObject({ object });

    expect(object.get("locked")).toBe(true);
    expect(save).toHaveBeenCalledOnce();
  });
});

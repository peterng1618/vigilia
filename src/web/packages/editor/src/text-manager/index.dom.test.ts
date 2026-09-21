// @vitest-environment jsdom
import { Canvas, IText } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createTextManager } from "./index.js";

describe("TextManager", () => {
  it("adds selected authored text and saves history", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const manager = createTextManager(canvas, save);

    const text = manager.addText({ text: "New text", fill: "#fff" });

    expect(text).toBeInstanceOf(IText);
    expect(canvas.getActiveObject()).toBe(text);
    expect(save).toHaveBeenCalledOnce();
  });
});

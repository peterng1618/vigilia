// @vitest-environment jsdom
import { IText } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { EditorActions } from "./editor-actions.js";

describe("EditorActions", () => {
  it("adds selected authored text and saves history", () => {
    const canvas = { add: vi.fn(), setActiveObject: vi.fn(), requestRenderAll: vi.fn() };
    const history = { save: vi.fn() };
    const actions = new EditorActions({ canvas: canvas as never, history });

    const text = actions.addText({ text: "New text", fill: "#fff" });

    expect(text).toBeInstanceOf(IText);
    expect(canvas.add).toHaveBeenCalledWith(text);
    expect(canvas.setActiveObject).toHaveBeenCalledWith(text);
    expect(history.save).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";
import { EditorHistory } from "./editor-history.js";

describe("EditorHistory", () => {
  it("revives an earlier authored scene without saving the revive", async () => {
    const canvas = { fire: vi.fn() };
    const scenes = [
      { version: "7.4.0", objects: [] },
      { version: "7.4.0", objects: [{ id: "later" }] },
    ];
    const serialize = vi.fn(() => scenes.shift()!);
    const revive = vi.fn(async () => {});
    const history = new EditorHistory({ canvas, serialize, revive });

    history.reset();
    history.save();
    await history.undo();

    expect(revive).toHaveBeenCalledWith(canvas, {
      version: "7.4.0",
      objects: [],
    });
    expect(serialize).toHaveBeenCalledTimes(2);
    expect(canvas.fire).toHaveBeenCalledWith("editor:history-state-loaded");
  });
});

import { describe, expect, it, vi } from "vitest";
import { EditorHistory } from "./index.js";

describe("EditorHistory", () => {
  it("revives an earlier authored scene without saving the revive", async () => {
    const canvas = { fire: vi.fn() };
    const scenes = [
      { version: "7.4.0", objects: [] },
      { version: "7.4.0", objects: [{ id: "later" }] },
    ];
    const serialize = vi.fn(() => scenes.shift()!);
    const revive = vi.fn(async () => {});
    const history = new EditorHistory({
      canvas: canvas as never,
      serialize,
      revive,
    });

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

  it("raises the commit on the canvas, and only when an entry is recorded", () => {
    const canvas = { fire: vi.fn() };
    let value = 0;
    const history = new EditorHistory({
      canvas: canvas as never,
      serialize: () => ({ value }) as never,
      revive: async () => {},
    });
    history.reset();

    // A refused edit changes nothing, so a save that records no entry is not
    // the fix and must not retire the reason the author was given.
    history.save();
    const release = history.suspend();
    value = 1;
    history.save();
    release();
    expect(canvas.fire).not.toHaveBeenCalled();

    history.save();
    expect(canvas.fire).toHaveBeenCalledTimes(1);
    expect(canvas.fire).toHaveBeenCalledWith("editor:edit-committed");
  });

  it("records one entry for a suspended burst, and none while suspended", async () => {
    let value = 0;
    const history = new EditorHistory({
      canvas: { fire: () => undefined } as never,
      serialize: () => ({ value }) as never,
      revive: async (_canvas, scene) => {
        value = (scene as unknown as { value: number }).value;
      },
    });
    history.reset();

    const release = history.suspend();
    value = 1;
    history.save(); // suppressed: the counter is non-zero
    release();
    history.save(); // the entry `endBurst` must produce

    value = 2;
    history.save();

    await history.undo();
    expect(value).toBe(1);
    await history.undo();
    expect(value).toBe(0); // straight past the burst: it is ONE entry
  });
});

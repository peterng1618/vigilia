import { describe, expect, it, vi } from "vitest";
import { EditorHistory } from "./index.js";

describe("EditorHistory", () => {
  it("revives an earlier authored scene without saving the revive", async () => {
    const canvas = { fire: vi.fn(), getActiveObject: () => undefined };
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
    const canvas = { fire: vi.fn(), getActiveObject: () => undefined };
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
      canvas: {
        fire: () => undefined,
        getActiveObject: () => undefined,
      } as never,
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

  it("steps one entry per press when two undos are still in flight", async () => {
    // An author who sees an undo do nothing hits the chord again, and a restore
    // is asynchronous: both presses reading `#index` before either finishes
    // land on the same entry, so two presses undo one edit and the rest of the
    // history looks unreachable.
    let value = 0;
    let reviving = 0;
    const history = new EditorHistory({
      canvas: {
        fire: () => undefined,
        getActiveObject: () => undefined,
      } as never,
      serialize: () => ({ value }) as never,
      revive: async (_canvas, scene) => {
        reviving += 1;
        while (reviving > 0) {
          reviving -= 1;
          await Promise.resolve();
        }
        value = (scene as unknown as { value: number }).value;
      },
    });
    history.reset();
    value = 1;
    history.save();
    value = 2;
    history.save();

    await Promise.all([history.undo(), history.undo()]);

    expect(value).toBe(0);
    await history.undo();
    expect(value).toBe(0);
  });
});

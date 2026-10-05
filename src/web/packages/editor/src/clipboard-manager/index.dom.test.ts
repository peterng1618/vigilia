// @vitest-environment jsdom
import type { Binding } from "@vigilia/renderer-core";
import { VIGILIA_TEXT_PROPERTY } from "@vigilia/scene-fabric";
import {
  ActiveSelection,
  Canvas,
  Group,
  type FabricObject,
  Rect,
  Textbox,
} from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeletionManager } from "../deletion-manager/index.js";
import { createErrorManager } from "../error-manager/index.js";
import { createClipboardManager, type ClipboardBindings } from "./index.js";

function setup(bindings?: ClipboardBindings["read"]) {
  const canvas = new Canvas(document.createElement("canvas"));
  const save = vi.fn();
  const importImage = vi.fn(async () => null);
  const clipboard = createClipboardManager({
    canvas,
    save,
    errors: createErrorManager(canvas),
    deletion: createDeletionManager(canvas, save),
    importImage,
    ...(bindings === undefined
      ? {}
      : { bindings: { read: bindings, write: vi.fn() } }),
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

  it("gives two members declaring one id an id each, rather than one id twice", async () => {
    // `createWidgetIdAllocator` memoises **by original**, so a group whose two
    // members declare the same id would be handed the same answer twice. That is
    // the envelope validator's `duplicate-id`: `snapshot()` throws on it and
    // every later save in the session fails, told nothing.
    const { canvas, clipboard } = setup();
    const first = new Rect({ width: 10, height: 10 });
    first.set("id", "twin");
    const second = new Rect({ left: 40, width: 10, height: 10 });
    second.set("id", "twin");
    const card = new Group([first, second], { subTargetCheck: false });
    canvas.add(card);
    canvas.setActiveObject(card);

    expect(await clipboard.duplicate()).toBe(true);

    const ids = (canvas.getObjects()[1] as Group)
      .getObjects()
      .map((part) => String(part.get("id")));
    expect(new Set(ids).size).toBe(2);
  });

  it("mints past the ids the canvas already holds, and reads as a copy", async () => {
    // Past what is already there *and* legible: one policy for what a fresh id
    // looks like, shared with the card library's insertion (`card-library.ts`),
    // rather than a uuid beside it.
    const { canvas, clipboard } = setup();
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);

    await clipboard.copy();
    await clipboard.paste();
    await clipboard.paste();

    const ids = canvas.getObjects().map((entry) => String(entry.get("id")));
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(["shape", "rect-shape", "rect-shape-2"]);
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

/**
 * A duplicated object carries its readings with it.
 *
 * `reassignIds` gave the copy and every descendant a new id, and nothing
 * remapped the envelope's `bindings`, which are **keyed by object id** — so the
 * copy arrived with none, `dropDanglingBindings` stripped the original's at the
 * next save, and a duplicated card claimed to be a CPU card, showed nothing,
 * and printed no key in the tree.
 *
 * The runs are half of it: a run names its binding by id, so copying a binding
 * *under the original's id* would leave two entries claiming one binding id —
 * the validator's `duplicate-id`, and an unsaveable session for the rest of the
 * editing session. Fresh binding ids with the runs repointed are the only shape
 * that keeps both the readings and the document valid.
 *
 * **Pre-existing, not this task's regression:** duplicating the starter's own
 * CPU card gave 0 bound parts before this too. Task 5 made the origin
 * durable, so it made the lie durable with it.
 */
describe("a duplicated object carries its readings", () => {
  /** The starter's own readings, keyed by the objects that show them. */
  const HELD: Readonly<Record<string, readonly Binding[]>> = {
    "cpu-card-value": [{ id: "cpu-card-load", semanticKey: "cpu.load" }],
    "cpu-card-caption": [{ id: "cpu-card-model", semanticKey: "cpu.brand" }],
  };

  /** The CPU card's two bound parts, as Fabric objects. */
  function boundParts(): FabricObject[] {
    const value = new Textbox("9%", { width: 100, height: 40 });
    value.set("id", "cpu-card-value");
    value.set(VIGILIA_TEXT_PROPERTY, {
      runs: [{ kind: "value", bindingId: "cpu-card-load" }],
    });
    const caption = new Textbox("Intel", { width: 100, height: 20 });
    caption.set("id", "cpu-card-caption");
    caption.set(VIGILIA_TEXT_PROPERTY, {
      runs: [{ kind: "value", bindingId: "cpu-card-model" }],
    });
    return [value, caption];
  }

  /** Duplicates the card with the document's readings installed, as the session does. */
  async function duplicateCard() {
    const written: Record<string, readonly Binding[]> = {};
    let held: Readonly<Record<string, readonly Binding[]>> = {};
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const clipboard = createClipboardManager({
      canvas,
      save,
      errors: createErrorManager(canvas),
      deletion: createDeletionManager(canvas, save),
      importImage: vi.fn(async () => null),
      bindings: {
        read: () => held,
        write: (additions) => {
          Object.assign(written, additions);
          held = { ...held, ...additions };
        },
      },
    });

    const card = new Group(boundParts(), { subTargetCheck: false });
    card.set("id", "group-cpu-card");
    canvas.add(card);
    held = HELD;

    expect(await clipboard.duplicate(card)).toBe(true);
    return { card, copy: canvas.getObjects()[1] as Group, held, written };
  }

  it("records the readings under the copy's own object ids", async () => {
    const { copy, written } = await duplicateCard();

    // Keyed by the id the copy actually has, which is the whole point: the
    // envelope's bindings are looked up by the id of the object showing them.
    const ids = (copy.getObjects() as FabricObject[]).map((part) =>
      String(part.get("id")),
    );
    expect(ids).toHaveLength(2);
    expect(written).toHaveProperty(ids[0] as string);
    expect(written).toHaveProperty(ids[1] as string);
    // And the original keeps its own — a copy is a copy, not a move.
    expect(written).not.toHaveProperty("cpu-card-value");
  });

  it("keeps the semantic key, and mints a binding id of its own", async () => {
    const { written } = await duplicateCard();
    const carried = Object.values(written).flat();

    // The key is what the reading *is*; the id is only what it is keyed by, and
    // one id is unique across the document.
    expect(carried.map((binding) => binding.semanticKey).sort()).toEqual([
      "cpu.brand",
      "cpu.load",
    ]);
    const ids = carried.map((binding) => binding.id);
    expect(ids).not.toContain("cpu-card-load");
    expect(ids).not.toContain("cpu-card-model");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points each run at the binding the copy carries", async () => {
    const { copy, written } = await duplicateCard();

    // THE defect: a run still naming the original's binding paints a
    // placeholder for a sensor sitting right there, and the copy's own binding
    // goes unread — the same defect `instantiateCard` names for an insertion.
    for (const part of copy.getObjects() as FabricObject[]) {
      const authored = part.get(VIGILIA_TEXT_PROPERTY) as {
        runs: readonly { bindingId: string }[];
      };
      const carried = written[String(part.get("id"))] ?? [];
      for (const run of authored.runs) {
        expect(carried.map((binding) => binding.id)).toContain(run.bindingId);
      }
    }
  });

  it("leaves the document saveable — no binding id claimed twice", async () => {
    const { held } = await duplicateCard();
    const ids = Object.values(held).flatMap((list) =>
      list.map((binding) => binding.id),
    );

    // The validator answers `duplicate-id` for one id used twice, and
    // `snapshot()` throws on it, so every later save in the session fails.
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4);
  });
});

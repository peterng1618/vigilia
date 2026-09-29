// @vitest-environment jsdom
import { VIGILIA_TEXT_PROPERTY } from "@vigilia/scene-fabric";
import { Canvas, IText, Textbox } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createTextManager } from "./index.js";

/**
 * A double-click on a bound run, and a width the author dragged.
 *
 * A value run has no text of its own, so a double-click that merely put a
 * cursor in the middle of a painted reading would make typing *insert* a
 * character into a value that no longer means anything. The run is selected, so
 * the first keystroke replaces it, and what was typed becomes the authored run.
 */

const TOKEN = "@ram.used.percent";
const AUTHORED = {
  runs: [
    {
      kind: "value" as const,
      bindingId: "load",
      typePreset: "typePresets.60-600",
    },
  ],
};

/** The starter's `ram-value`: an authored 180-wide box on a bound run. */
function reading(id = "ram-value"): Textbox {
  const object = new Textbox("MEM 61", {
    id,
    left: 40,
    top: 30,
    width: 180,
    fontSize: 32,
    originX: "left",
    originY: "top",
  });
  object.set(VIGILIA_TEXT_PROPERTY, {
    wrap: true,
    overflow: "ellipsis",
    align: "center",
    box: { width: 180, height: 72 },
    ...AUTHORED,
  });
  return object;
}

function scene(object: Textbox): Canvas {
  const canvas = new Canvas(document.createElement("canvas"));
  canvas.add(object);
  return canvas;
}

/**
 * Stands in for the session, which owns the run display this painting comes
 * from. The assertion is about the order the manager asks for it in, not about
 * which side owns it.
 */
function withAuthoringView(
  canvas: Canvas,
  save: () => void,
): ReturnType<typeof createTextManager> {
  const text = createTextManager(canvas, save);
  text.setAuthoringView((object) => {
    object.set("text", TOKEN);
  });
  return text;
}

describe("TextManager", () => {
  it("adds selected authored text and saves history", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const manager = createTextManager(canvas, save);

    const text = manager.addText({ text: "New text", fill: "#fff" });

    expect(text).toBeInstanceOf(IText);
    expect(canvas.getActiveObject()).toBe(text);
    expect(save).toHaveBeenCalledOnce();
    expect(text.get("id")).toMatch(/^text-[0-9a-f-]{36}$/);
  });

  it("keeps a caller-supplied id instead of generating one", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const manager = createTextManager(canvas, vi.fn());

    const text = manager.addText({ text: "New text", id: "explicit-id" });

    expect(text.get("id")).toBe("explicit-id");
  });
});

describe("double-clicking a bound run", () => {
  it("paints the token and syncs Fabric's textarea with it", () => {
    // Fabric enters inline editing on the first click's mouse-up, so the
    // object is already editing when the double-click arrives, and its hidden
    // textarea holds the reading. `selectAll` is what pushes the token into that
    // textarea; without the sync the author's first keystroke edits the reading
    // they can no longer see.
    const object = reading();
    const canvas = scene(object);
    const text = withAuthoringView(canvas, vi.fn());

    canvas.fire("mouse:dblclick", { target: object } as never);

    expect(object.isEditing).toBe(true);
    expect(object.text).toBe(TOKEN);
    expect(object.hiddenTextarea?.value).toBe(TOKEN);
    text.destroy();
  });

  it("selects the whole run, so typing replaces it rather than appending", () => {
    const object = reading();
    const canvas = scene(object);
    const text = withAuthoringView(canvas, vi.fn());
    canvas.setActiveObject(object);

    canvas.fire("mouse:dblclick", { target: object } as never);

    expect(object.isEditing).toBe(true);
    // Fabric's own double-click selects a word only while already editing, so
    // the selection has to be made here or the first keystroke inserts.
    expect([object.selectionStart, object.selectionEnd]).toEqual([
      0,
      object.text.length,
    ]);
    text.destroy();
  });

  it("keeps the binding when the author only looked at the run", () => {
    // Fabric's `exitEditing` (`index.mjs:17102-17105`) compares `_textBeforeEdit`
    // to decide whether to fire `modified`; it never restores it. So after a
    // double-click and nothing else, `text` is still the token the authoring
    // view painted, and writing that back would turn a sensor card into prose —
    // permanently, in both mounts, from a gesture that changed nothing.
    const object = reading();
    const canvas = scene(object);
    const text = withAuthoringView(canvas, vi.fn());
    canvas.fire("mouse:dblclick", { target: object } as never);

    expect(object.text).toBe(TOKEN);
    object.exitEditing();

    expect(object.get(VIGILIA_TEXT_PROPERTY)).toEqual({
      wrap: true,
      overflow: "ellipsis",
      align: "center",
      box: { width: 180, height: 72 },
      ...AUTHORED,
    });
    text.destroy();
  });

  it("writes what was typed back as the object's authored run", () => {
    const object = reading();
    const canvas = scene(object);
    const save = vi.fn();
    const text = withAuthoringView(canvas, save);
    canvas.setActiveObject(object);
    canvas.fire("mouse:dblclick", { target: object } as never);

    // What the author types lands on the object, and `editing:exited` is when
    // the content is worth keeping.
    object.set("text", "MEM 16.0 GB");
    object.exitEditing();

    const authored = object.get(VIGILIA_TEXT_PROPERTY) as {
      runs: Readonly<Record<string, unknown>>[];
    };
    // The value run became what the author typed, and kept its type preset.
    expect(authored.runs).toHaveLength(1);
    expect(authored.runs[0]).toMatchObject({
      kind: "literal",
      text: "MEM 16.0 GB",
      typePreset: "typePresets.60-600",
    });
    expect(save).toHaveBeenCalled();
    text.destroy();
  });
});

describe("a width the author dragged", () => {
  it("records it as the new authored box, on every step of the drag", () => {
    const object = reading();
    const canvas = scene(object);
    const save = vi.fn();
    const text = withAuthoringView(canvas, save);

    // The statement Fabric's `changeWidth` control executes
    // (`fabric/dist/index.mjs:6737`), then the event it fires around it.
    for (const width of [170, 150, 130, 120]) {
      object.set("width", width);
      canvas.fire("object:resizing", {
        transform: { target: object },
      } as never);
      const authored = object.get(VIGILIA_TEXT_PROPERTY) as {
        box?: { width: number };
      };
      expect(authored.box?.width, `step ${width}`).toBe(width);
    }
    text.destroy();
  });

  it("saves once, when the gesture ends, and not once per step", () => {
    // `save` is `history.save()`, a full `serialiseScene` and an undo entry per
    // call. A drag is dozens of `object:resizing` events, so saving on each
    // would be dozens of serialisations and dozens of undos. Fabric reports the
    // gesture as finished on `object:modified`, and that is where the codebase
    // already answers this — see `editor-shell.ts:213-215`.
    const object = reading();
    const canvas = scene(object);
    const save = vi.fn();
    const text = withAuthoringView(canvas, save);

    for (const width of [170, 150, 130, 120]) {
      object.set("width", width);
      canvas.fire("object:resizing", {
        transform: { target: object },
      } as never);
    }
    expect(save).not.toHaveBeenCalled();

    canvas.fire("object:modified", { target: object } as never);
    expect(save).toHaveBeenCalledOnce();
    text.destroy();
  });
});

describe("typing over an object that carries more than one run", () => {
  /**
   * A value and its unit: the shape a card is built from, and the shape Fabric
   * cannot edit. It hands back one flat string and no way to say which run each
   * character came from, so the only write available would drop the siblings.
   */
  function twoRuns(): Textbox {
    const object = new Textbox("42%", { id: "cpu-value", left: 40, top: 30 });
    object.set(VIGILIA_TEXT_PROPERTY, {
      runs: [
        { kind: "value" as const, bindingId: "load" },
        { kind: "literal" as const, text: "%" },
      ],
    });
    return object;
  }

  it("keeps both runs and says why, rather than flattening the object", () => {
    const object = twoRuns();
    const canvas = scene(object);
    const save = vi.fn();
    const warn = vi.fn();
    const text = createTextManager(canvas, save, warn);
    let repainted = 0;
    text.setRepaint(() => {
      repainted += 1;
    });
    canvas.setActiveObject(object);
    canvas.fire("mouse:dblclick", { target: object } as never);

    object.set("text", "typed over");
    object.exitEditing();

    const authored = object.get(VIGILIA_TEXT_PROPERTY) as {
      runs: readonly { kind: string }[];
    };
    expect(authored.runs).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("more than one run"),
    );
    // The canvas must not be left standing on text the document does not hold.
    expect(repainted).toBe(1);
    text.destroy();
  });
});

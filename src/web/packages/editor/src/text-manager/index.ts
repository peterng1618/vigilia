import {
  VIGILIA_TEXT_PROPERTY,
  type PlanTextObject,
} from "@vigilia/scene-fabric";
import { type Canvas, IText } from "fabric/es";
import type { TextContent, TextRun } from "@vigilia/renderer-core";

export interface TextManager {
  addText(options?: Readonly<Record<string, unknown>>): IText;
  /**
   * Who paints an object's authoring view when the author starts editing it.
   * The session owns the run display that painting comes from, and the shell
   * that creates this manager has no session yet, so it is set rather than
   * passed.
   */
  setAuthoringView(paint: (object: IText) => void): void;
  destroy(): void;
}

/** The runs and box this object was authored with, or nothing to write back. */
function authoredOf(object: PlanTextObject): TextContent | undefined {
  const authored = object.get(VIGILIA_TEXT_PROPERTY);
  return typeof authored === "object" &&
    authored !== null &&
    Array.isArray((authored as Record<string, unknown>)["runs"])
    ? (authored as TextContent)
    : undefined;
}

/**
 * What the author typed becomes the object's authored run.
 *
 * A value run has no text of its own, so there is nothing to keep the reading
 * *and* the words: typing over one replaces it with a literal, keeping the type
 * preset and colour it was painted with. The run editor turns it back into a
 * reading when the author wants one.
 */
function keepTypedText(object: PlanTextObject): void {
  const authored = authoredOf(object);
  if (authored === undefined) return;

  const first = authored.runs[0] as TextRun | undefined;
  object.set(VIGILIA_TEXT_PROPERTY, {
    ...authored,
    runs: [
      {
        kind: "literal",
        text: object.text,
        ...(first?.typePreset === undefined
          ? {}
          : { typePreset: first.typePreset }),
        ...(first?.style === undefined ? {} : { style: first.style }),
      },
    ],
  });
}

/**
 * A width the author dragged is the new authored box.
 *
 * Fabric's `changeWidth` writes through `set`, which re-enters
 * `initDimensions`; the scene's width guard puts the dragged number back before
 * `object:resizing` reports it, so what arrives here is the author's.
 */
function adoptResizedBox(object: object): void {
  const target = (object as { transform?: { target?: unknown } }).transform
    ?.target;
  if (!isText(target)) return;

  const authored = authoredOf(target);
  if (authored?.box === undefined) return;

  const scaleX = target.scaleX === 0 ? 1 : target.scaleX;
  target.set(VIGILIA_TEXT_PROPERTY, {
    ...authored,
    box: { ...authored.box, width: target.width * scaleX },
  });
}

function isText(value: unknown): value is PlanTextObject & {
  readonly width: number;
  readonly scaleX: number;
} {
  return value instanceof IText;
}

/**
 * A double-click on a text object: it shows the run's binding, selects the
 * whole run so typing replaces it, and keeps what was typed.
 *
 * Fabric owns the gesture — it enters editing itself, on the first click's
 * mouse-up — so what is left to the application is the authored side: the runs,
 * the box, and the history entry.
 */
export function createTextManager(
  canvas: Canvas,
  save: () => void,
): TextManager {
  let showAuthoringView: (object: IText) => void = () => {};

  const onDoubleClick = (event: { target?: unknown }): void => {
    const target = event.target;

    if (!(target instanceof IText)) {
      return;
    }

    // Fabric enters inline editing on the first click's mouse-up
    // (`Text.mouseUpHandler`, `index.mjs:17833`), so the object is usually
    // *already* editing by the time the double-click arrives, and the call
    // below is then Fabric's own no-op. Bailing on `isEditing` instead is what
    // left the first keystroke editing a reading: the token has to be painted
    // now, and the whole run selected, or Fabric's hidden textarea still holds
    // the reading and typing edits that rather than what is on screen.
    if (!target.isEditing) {
      target.enterEditing();
    }
    showAuthoringView(target);
    // Fabric writes the hidden textarea exactly once, as it enters editing
    // (`enterEditingImpl`, `index.mjs:16908`), and `_updateTextarea` then only
    // ever syncs the *selection*. So a run painted after that point is what the
    // author sees and not what their keystrokes edit — the first one lands in
    // the reading still in the box. Fabric publishes no call to rewrite the
    // value, so this repeats Fabric's own write rather than changing what
    // Fabric does. The upgrade path, if that field ever moves, is to paint the
    // token before `enterEditing` — which needs a signal that a *double*-click
    // is coming, and Fabric enters editing on the first click's mouse-up, so
    // there is none.
    const editing = target as IText & { hiddenTextarea?: HTMLTextAreaElement };
    if (editing.hiddenTextarea !== undefined) {
      editing.hiddenTextarea.value = target.text;
    }
    target.selectAll();
    // Fabric collapses the caret again after this handler — the second
    // mouse-up's own behaviour re-runs `initDelayedCursor` — so the whole-run
    // selection is re-asserted once every listener has had its say. A keystroke
    // can only arrive in a later task, by which point this has run.
    requestAnimationFrame(() => {
      if (target.isEditing) {
        target.selectAll();
        canvas.requestRenderAll();
      }
    });
    canvas.requestRenderAll();
    target.once("editing:exited", () => {
      keepTypedText(target);
      save();
    });
  };

  const onResizing = (event: object): void => {
    adoptResizedBox(event);
    save();
  };

  canvas.on("mouse:dblclick" as never, onDoubleClick as never);
  canvas.on("object:resizing" as never, onResizing as never);

  return {
    addText(options = {}) {
      const text = new IText(
        typeof options["text"] === "string" ? options["text"] : "",
        { id: `text-${crypto.randomUUID()}`, ...options },
      );
      canvas.add(text);
      canvas.setActiveObject(text);
      save();
      return text;
    },
    setAuthoringView(paint) {
      showAuthoringView = paint;
    },
    destroy() {
      canvas.off("mouse:dblclick" as never, onDoubleClick as never);
      canvas.off("object:resizing" as never, onResizing as never);
    },
  };
}

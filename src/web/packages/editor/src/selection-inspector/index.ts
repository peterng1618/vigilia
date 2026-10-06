import type {
  Binding,
  FabricGlobals,
  SampleSource,
} from "@vigilia/renderer-core";
import { applyAuthoredText } from "@vigilia/scene-fabric";
import type { FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import type { PropertySection } from "../editor-shell/controls/property-section.js";
import { uiCopy } from "../ui-copy.js";
import {
  type ChartFieldsPort,
  type ColumnContext,
  type ColumnSectionId,
  type GeometryKey,
  perKindColumn,
} from "./per-kind-column.js";

/**
 * Properties of the selected object. An author's most common action is "select a
 * thing, change a thing", which had no control surface at all: the inspector
 * offered only document-level settings.
 *
 * The surface itself — which sections a selection gets, and which question each
 * field answers — is `perKindColumn`, which returns it as data. This module owns
 * the object: which one is described (`target`), how a field writes it, and the
 * commit path. Reads the live Fabric object and writes through the canvas,
 * saving history once per committed edit (§67). Whole artboard units (§57).
 */

export interface SelectionInspector {
  readonly root: HTMLElement;
  /** Re-reads the active object; call on every selection change. */
  render(): void;
  /** Theme globals changed, so a displayed resolution may have too. */
  setGlobals(next: FabricGlobals | undefined): void;
  /** The document's language changed, so a formatted preview may have too. */
  setLocale(next: string | undefined): void;
}

/** The two dimensions a text object's authored box carries. */
type BoxKey = "width" | "height";

/**
 * The box a text object was authored with, when it has one.
 *
 * `vigiliaText.box` is the owner (ADR 0003): a `Textbox` cannot hold a box,
 * because `width` re-enters `initDimensions` and widens the object to its
 * longest run. So the Size fields write this rather than a scale, and read it
 * back, and the type stays the size its preset says it is.
 */
function authoredBoxOf(
  object: FabricObject,
  key: GeometryKey,
): number | undefined {
  if (key !== "width" && key !== "height") return undefined;
  const authored = object.get("vigiliaText") as
    | { readonly box?: { readonly width?: number; readonly height?: number } }
    | undefined;
  const value = authored?.box?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/** Whether the object is a text object, whose size is a box and not a scale. */
function isTextObject(object: FabricObject): boolean {
  const authored = object.get("vigiliaText");
  return typeof authored === "object" && authored !== null;
}

/**
 * The object's own drawn edge, when it is not the number the Size fields show.
 *
 * `vigiliaText.box` is stored **unscaled** — `assertBoxHeight` puts the object
 * back at `box.height / scaleY` precisely so the scale can be reapplied by
 * `boxFrom` — so a text object carrying a scale draws a box larger than the
 * number in the field. Measured on the running editor: a 140 × 27 box at
 * `scaleX/scaleY 2` read 140 and **27** in the Size pair and drew an edge of
 * 280 × 54.
 *
 * The field cannot show the drawn edge instead. `write` puts the number the
 * author types into `vigiliaText.box`, so a Size field reading the edge would
 * name a number it is about to overwrite — and it would be wrong on the next
 * render, which is exactly the kind of quiet disagreement this reports instead.
 *
 * Only a text object with a box can disagree: for anything else `readField`
 * already returns the scaled edge, and a box-less text object's height *is*
 * Fabric's measurement. A difference under one whole unit is the field's own
 * rounding, not a disagreement.
 */
function measuredEdgeOf(
  object: FabricObject,
): { readonly width: number; readonly height: number } | undefined {
  if (!isTextObject(object)) return undefined;
  const authoredWidth = authoredBoxOf(object, "width");
  const authoredHeight = authoredBoxOf(object, "height");
  if (authoredWidth === undefined && authoredHeight === undefined) {
    return undefined;
  }

  const drawn = {
    width: Math.round(object.width * object.scaleX),
    height: Math.round(object.height * object.scaleY),
  };
  const shown = {
    width: Math.round(authoredWidth ?? drawn.width),
    height: Math.round(authoredHeight ?? drawn.height),
  };
  return drawn.width === shown.width && drawn.height === shown.height
    ? undefined
    : drawn;
}

/**
 * Writes one dimension of the authored box, keeping the other.
 *
 * A text object inserted by the editor has no box yet — its width is Fabric's
 * measurement until an author types one. Writing the height alone would then
 * create `{ height }` with no width, and `authoredBox` would multiply an
 * `undefined` width by the scale on the next text change: the object loses its
 * width and stops producing a bounding rect. Both dimensions start from the
 * object's own measured edge, so the first Size field an author fills in gives a
 * whole box rather than half of one.
 */
function writeAuthoredBox(
  object: FabricObject,
  key: BoxKey,
  value: number,
): void {
  const authored = object.get("vigiliaText") as Record<string, unknown>;
  const box = (authored["box"] ?? {}) as {
    width?: number;
    height?: number;
  };
  const measured = (dimension: BoxKey): number =>
    box[dimension] ??
    (typeof object.get(dimension) === "number"
      ? (object.get(dimension) as number)
      : 0);

  object.set("vigiliaText", {
    ...authored,
    box: {
      ...box,
      width: measured("width"),
      height: measured("height"),
      [key]: value,
    },
  });
}

/**
 * Fabric reports geometry in the object's own origin; these read whole artboard
 * units (§57). Position is the object's own `left`/`top` — its placement in the
 * artboard — not the drawn box, which also includes any stroke and the group
 * context, so the numbers an author types match what they placed.
 */
function readField(object: FabricObject, key: GeometryKey): number {
  const box = authoredBoxOf(object, key);
  if (box !== undefined) return box;
  if (key === "width") return object.width * object.scaleX;
  if (key === "height") return object.height * object.scaleY;
  if (key === "left") return object.left;
  if (key === "top") return object.top;
  return object.angle;
}

export interface SelectionInspectorOptions {
  readonly editor: EditorInteraction;
  /** Theme globals, so a token's resolution can be shown. */
  readonly globals?: FabricGlobals;
  /**
   * A node's bindings, and the way to write them back. They belong to the theme
   * envelope rather than to the Fabric object, so the session owns them and the
   * inspector asks for them by node id.
   */
  readonly nodeBindings?: (nodeId: string) => readonly Binding[];
  readonly onNodeBindingsChange?: (
    nodeId: string,
    bindings: readonly Binding[],
  ) => void;
  /**
   * The live sample source, so a value run can say whether a reading has
   * arrived for it. A getter rather than a source: the session replaces its
   * source when the author switches between preview and live, and the panel is
   * mounted for the session rather than rebuilt.
   */
  readonly sampleSource?: () => SampleSource;
  /**
   * Brings the existing type-preset panel into view. The panel owns a preset's
   * fields, so a text selection links there instead of duplicating them.
   */
  readonly revealTypePresets?: () => void;
  /**
   * Re-resolves the glass lifecycle. The handle belongs to the shell that
   * created it and re-resolves on its own only when the canvas gains or loses
   * an object, so an authored treatment written on a panel that is already
   * there reaches it through this. Required rather than optional: without it the
   * enable control would accept an edit and paint nothing.
   */
  readonly refreshGlass: () => void;
  /**
   * The chart owner's own fields, for a chart selection.
   *
   * A getter rather than the port: the chart manager is built after this
   * inspector, in the session that owns both, so the column asks for them at
   * render time — and the owner a later document mount replaces is the one it
   * gets.
   */
  readonly chartFields?: () => ChartFieldsPort | undefined;
}

/** The input types that hold a caret. A checkbox has focus and nothing to type. */
const TEXT_ENTRY: ReadonlySet<string> = new Set([
  "text",
  "number",
  "search",
  "url",
  "tel",
  "email",
  "password",
]);

/**
 * The field the author is typing into, named by the data hook it carries.
 *
 * A re-render replaces a section's body, and a field that was focused is one of
 * the elements it replaces — so the caret would land on nothing. The hook is
 * what survives the rebuild: the same field keeps the same `data-vigilia-*`
 * value, so focus can be put back in it.
 *
 * **Only a caret-bearing field is put back.** Restoring every focused element
 * gave focus its own consequences back: `focus` is what opens the glass
 * control's reason popup, so a re-render while that checkbox was focused
 * re-opened a popup the author had just dismissed with Escape. The requirement
 * is the caret, and a checkbox has none to move.
 */
function focusedControl():
  | { readonly hook: string; readonly value: string }
  | undefined {
  const active = document.activeElement;
  const typing =
    (active instanceof HTMLInputElement && TEXT_ENTRY.has(active.type)) ||
    active instanceof HTMLTextAreaElement;
  if (!typing) return undefined;
  const [hook, value] =
    Object.entries((active as HTMLElement).dataset)[0] ?? [];
  return hook === undefined ? undefined : { hook, value: value ?? "" };
}

function restoreFocus(
  root: HTMLElement,
  focused: { readonly hook: string; readonly value: string } | undefined,
): void {
  if (focused === undefined) return;
  const attribute = `data-${focused.hook.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  )}`;
  root.querySelector<HTMLElement>(`[${attribute}="${focused.value}"]`)?.focus();
}

export function createSelectionInspector(
  host: HTMLElement,
  options: SelectionInspectorOptions,
): SelectionInspector {
  const editor = options.editor;
  let globals = options.globals;
  /** The document's language; a format preview is spelled in it. */
  let locale: string | undefined;
  const root = document.createElement("section");
  root.dataset["vigiliaPanel"] = "selection";
  host.append(root);

  /**
   * The sections this inspector has built, kept for its whole life. Rebuilding
   * the column from this map is what keeps an open section open: a fresh
   * `propertySection` would start at its default every render.
   */
  const sections = new Map<ColumnSectionId, PropertySection>();

  const selected = (): FabricObject | undefined =>
    editor.canvas.getActiveObject() ?? undefined;

  /**
   * The object the fields currently describe. Restoring history rebuilds the
   * scene and drops Fabric's selection, so an author who undoes an edit would
   * otherwise lose the panel they were working in. The object's Vigilia id
   * survives the restore, so the fields re-bind to the same object.
   */
  let bound: FabricObject | undefined;

  const objectById = (id: unknown): FabricObject | undefined => {
    if (typeof id !== "string") {
      return undefined;
    }

    const find = (
      objects: readonly FabricObject[],
    ): FabricObject | undefined => {
      for (const object of objects) {
        if (object.get("id") === id) {
          return object;
        }

        const children = (
          object as { getObjects?: () => FabricObject[] }
        ).getObjects?.();
        if (children !== undefined) {
          const nested = find(children);
          if (nested !== undefined) {
            return nested;
          }
        }
      }

      return undefined;
    };

    return find(editor.canvas.getObjects());
  };

  /**
   * The object to describe: the live selection, else the last one still present.
   *
   * A crop session is the exception: it makes its own frame the active object,
   * so following the selection would describe that frame rather than the image
   * the author is cropping. The session names its image, and the fields stay
   * bound to it until the session ends.
   */
  const target = (): FabricObject | undefined => {
    const cropping = editor.cropManager.target;
    if (cropping !== undefined) {
      bound = cropping;
      return cropping;
    }

    const active = selected();

    if (active !== undefined) {
      bound = active;
      return active;
    }

    if (bound !== undefined && objectById(bound.get("id")) !== undefined) {
      bound = objectById(bound.get("id"));
      return bound;
    }

    bound = undefined;
    return undefined;
  };

  /** Writes one field to the object without rendering or saving history, so a
      caller can batch several writes into one entry. */
  const write = (
    object: FabricObject,
    key: GeometryKey,
    value: number,
  ): void => {
    switch (key) {
      case "left":
        object.set({ left: value });
        break;
      case "top":
        object.set({ top: value });
        break;
      case "width": {
        // A text object's width is the box its text wraps inside, not a scale
        // on the type. Writing `scaleX` instead stretched every glyph: a 24px
        // caption asked for a 220-unit box came back at 3.4× the size, and the
        // H field squashed the same type to 0.44 of its height. The authored box
        // is the owner, and the renderer re-asserts it.
        if (isTextObject(object)) {
          writeAuthoredBox(object, "width", value);
          applyAuthoredText(editor.canvas, globals);
          break;
        }
        // Scale rather than resize: a chart's own width is its raster size.
        const next = value / (object.width <= 0 ? 1 : object.width);
        object.set({ scaleX: next });
        break;
      }
      case "height": {
        if (isTextObject(object)) {
          writeAuthoredBox(object, "height", value);
          applyAuthoredText(editor.canvas, globals);
          break;
        }
        const next = value / (object.height <= 0 ? 1 : object.height);
        object.set({ scaleY: next });
        break;
      }
      case "angle":
        object.set({ angle: value });
        break;
    }

    object.setCoords();
  };

  /** One entry per committed edit, matching the dock's own actions. */
  const commit = (): void => {
    editor.canvas.requestRenderAll();
    editor.historyManager.saveState();
  };

  /**
   * The target may have changed while a field held focus; re-render rather
   * than write to an object the panel no longer describes. Every committing
   * field asks this first, so a stale event cannot mutate the selection that
   * has since been replaced.
   */
  const stillTarget = (object: FabricObject): boolean => {
    if (target() === object) return true;
    render();
    return false;
  };

  const render = (): void => {
    const focused = focusedControl();
    root.replaceChildren();
    const object = target();

    if (object === undefined) {
      // One line naming where to choose from, rather than an empty column: the
      // panel is the only thing on this tab that explains its own emptiness.
      const line = document.createElement("p");
      line.className = "vigilia-resolution";
      line.dataset["vigiliaNothingSelected"] = "";
      line.textContent = uiCopy.inspectorFields.nothingSelected;
      root.append(line);
      return;
    }

    const heading = document.createElement("h2");
    heading.textContent = uiCopy.inspectorFields.selection;
    root.append(heading);

    // A locked object is refused where the editor refuses it, and only there.
    // Refused today: delete, duplicate, copy, cut and lock
    // (`object-actions.ts` gates them on `!locked`), nudging (`canvas-nudge`
    // filters it out) and arrange (`canArrange` refuses a locked member). Not
    // refused anywhere: the four ordering actions, and group/ungroup, whose
    // `eligible` predicates read the selection's kind and membership but never
    // its lock; and run bindings, which `#setBindings` writes without reading
    // one. Gating those here would advertise a refusal that never happens, so
    // only the fields that write the object directly are withheld — and the
    // read-only sections still render, because the author can still read them.
    if (object.get("locked") === true) {
      const note = document.createElement("p");
      note.className = "vigilia-resolution";
      note.textContent = uiCopy.inspectorFields.locked;
      root.append(note);
    }

    const chartFields = options.chartFields?.();
    const context: ColumnContext = {
      editor,
      globals,
      locale,
      geometry: {
        read: readField,
        write,
        measuredEdge: measuredEdgeOf,
      },
      stillTarget,
      commit,
      rerender: render,
      revealTypePresets: options.revealTypePresets,
      refreshGlass: options.refreshGlass,
      nodeBindings: options.nodeBindings,
      onNodeBindingsChange: options.onNodeBindingsChange,
      sampleSource: options.sampleSource,
      ...(chartFields === undefined ? {} : { chartFields }),
      sections,
    };

    for (const section of perKindColumn(object, context)) {
      root.append(section.root);
    }

    restoreFocus(root, focused);
  };

  // Fabric reports a finished drag/resize/rotate as `object:modified`; the fields
  // must follow it or they would show stale numbers.
  editor.canvas.on("object:modified", render);
  editor.canvas.on("selection:created", render);
  editor.canvas.on("selection:updated", render);
  editor.canvas.on("selection:cleared", render);
  // A deletion fires no selection event — the active object is discarded first,
  // so the panel went on showing the deleted object's name and geometry while
  // the layer list and canvas had both moved on. The three surfaces disagreed
  // about what the document contained.
  editor.canvas.on("object:removed", render);
  editor.canvas.on("object:added", render);
  // Restoring history rebuilds the scene and drops the selection; the fields
  // must re-bind to the same object rather than vanishing.
  editor.canvas.on("editor:history-state-loaded" as never, render);

  render();

  return {
    root,
    render,
    setGlobals(next) {
      globals = next;
      render();
    },
    setLocale(next) {
      locale = next;
      render();
    },
  };
}

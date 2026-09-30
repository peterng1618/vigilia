import type {
  Binding,
  FabricGlobals,
  SampleSource,
} from "@vigilia/renderer-core";
import { applyAuthoredText } from "@vigilia/scene-fabric";
import type { FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { linkedPair } from "../editor-shell/controls/linked-pair.js";
import { numberField } from "../editor-shell/controls/number-field.js";
import { uiCopy } from "../ui-copy.js";
import {
  type AppearanceContext,
  createNameField,
  createOpacityField,
  createResolutionLine,
  createTypePresetReveal,
  paintReferencesOf,
  resolveToken,
  resolveTypePreset,
  typePresetOf,
} from "./appearance.js";
import { createCropRow } from "./crop.js";
import { createGlassFields } from "./glass.js";
import { createPanelFields } from "./panel.js";
import { createRunEditor, type RunBindingPort } from "./runs.js";

/**
 * Properties of the selected object. An author's most common action is "select a
 * thing, change a thing", which had no control surface at all: the inspector
 * offered only document-level settings.
 *
 * Reads the live Fabric object and writes through the canvas, saving history once
 * per committed edit (§67). Whole artboard units (§57).
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
/** A geometry field, in whole artboard units. */
interface GeometryField {
  readonly key: "left" | "top" | "width" | "height" | "angle";
  readonly label: string;
  readonly min?: number;
}

const GEOMETRY_FIELDS: Readonly<Record<GeometryField["key"], GeometryField>> = {
  left: { key: "left", label: uiCopy.inspectorFields.x },
  top: { key: "top", label: uiCopy.inspectorFields.y },
  width: { key: "width", label: uiCopy.inspectorFields.width, min: 1 },
  height: { key: "height", label: uiCopy.inspectorFields.height, min: 1 },
  angle: { key: "angle", label: uiCopy.inspectorFields.rotation },
};

/**
 * The box a text object was authored with, when it has one.
 *
 * `vigiliaText.box` is the owner (ADR 0003): a `Textbox` cannot hold a box,
 * because `width` re-enters `initDimensions` and widens the object to its
 * longest run. So the Size fields below write this rather than a scale, and
 * read it back, and the type stays the size its preset says it is.
 */
function authoredBoxOf(
  object: FabricObject,
  key: GeometryField["key"],
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
  key: "width" | "height",
  value: number,
): void {
  const authored = object.get("vigiliaText") as Record<string, unknown>;
  const box = (authored["box"] ?? {}) as {
    width?: number;
    height?: number;
  };
  const measured = (dimension: "width" | "height"): number =>
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
function readField(object: FabricObject, key: GeometryField["key"]): number {
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
}

export function createSelectionInspector(
  host: HTMLElement,
  options: SelectionInspectorOptions,
): SelectionInspector {
  const editor = options.editor;
  let globals = options.globals;
  /** The document's language; a format preview is spelled in it. */
  let locale: string | undefined;
  const context = (): AppearanceContext => ({ editor, globals });
  const root = document.createElement("section");
  root.dataset["vigiliaPanel"] = "selection";
  host.append(root);

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
    key: GeometryField["key"],
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
    root.replaceChildren();
    const object = target();

    if (object === undefined) {
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
    // only the fields that write the object directly are withheld.
    const locked = object.get("locked") === true;
    if (locked) {
      const note = document.createElement("p");
      note.className = "vigilia-resolution";
      note.textContent = uiCopy.inspectorFields.locked;
      root.append(note);
    }

    if (!locked) {
      // What the object is called, above the numbers that describe it: this is
      // the field the layer list and every reference-facing surface read.
      root.append(
        createNameField(context(), object, (candidate) =>
          stillTarget(candidate),
        ),
      );

      const geometry = document.createElement("div");

      /** A refused edit restores the field itself (the primitives own that);
          the panel only has to report it, as it always has. */
      const refused = (): void => {
        editor.errorManager.warn(
          "controls",
          uiCopy.inspectorFields.invalidValue,
        );
      };

      // X/Y and W/H are pairs — an author reads and edits them together — while
      // rotation stands alone. The pair primitive keeps the two boxes on one
      // `.vigilia-field-row` line, as the artboard panel's Size row does.
      const pair = (
        rowLabel: string,
        first: GeometryField,
        second: GeometryField,
      ): HTMLElement =>
        linkedPair({
          rowLabel,
          first: {
            label: first.label,
            value: Math.round(readField(object, first.key)),
            data: "vigiliaGeometry",
            dataValue: first.key,
          },
          second: {
            label: second.label,
            value: Math.round(readField(object, second.key)),
            data: "vigiliaGeometry",
            dataValue: second.key,
          },
          ...(first.min === undefined ? {} : { min: first.min }),
          invalidMessage: uiCopy.inspectorFields.invalidValue,
          onReject: refused,
          // Each half writes only its own key: X/Y and W/H are independent, and
          // writing the sibling would quantise a fractional dimension the author
          // never touched.
          onCommitFirst: (value) => {
            if (!stillTarget(object)) return;
            write(object, first.key, value);
            commit();
          },
          onCommitSecond: (value) => {
            if (!stillTarget(object)) return;
            write(object, second.key, value);
            commit();
          },
        }).row;

      geometry.append(
        pair(
          uiCopy.inspectorFields.position,
          GEOMETRY_FIELDS.left,
          GEOMETRY_FIELDS.top,
        ),
        pair(
          uiCopy.inspectorFields.size,
          GEOMETRY_FIELDS.width,
          GEOMETRY_FIELDS.height,
        ),
      );

      const rotation = numberField({
        label: GEOMETRY_FIELDS.angle.label,
        value: Math.round(readField(object, "angle")),
        data: "vigiliaGeometry",
        dataValue: "angle",
        invalidMessage: uiCopy.inspectorFields.invalidValue,
        onReject: refused,
        onCommit: (value) => {
          if (!stillTarget(object)) return;
          write(object, "angle", value);
          commit();
        },
      });
      geometry.append(rotation.row);

      // Crop sits with the geometry it changes, and only for a selection that
      // can hold one — an image, which is the only kind `canCrop` admits.
      const crop = createCropRow(editor, object, stillTarget);
      if (crop !== undefined) geometry.append(crop);

      root.append(geometry);
    }

    // Appearance, and what the object's references actually resolve to. The
    // resolution lines are read-only, so a locked object still gets them: the
    // author can see what the object is made of even when they cannot move it.
    const appearance = document.createElement("div");
    if (!locked) {
      appearance.append(
        createOpacityField(context(), object, (candidate) =>
          stillTarget(candidate),
        ),
      );
      // Panel material, for a selection whose kind can carry it.
      const panelFields = createPanelFields(context(), object, {
        stillTarget: () => stillTarget(object),
        commit,
        onChange: render,
      });
      if (panelFields !== undefined) appearance.append(panelFields);
      // Frosted glass, for a selection whose backdrop can actually be sampled.
      const glassFields = createGlassFields(context(), object, {
        stillTarget: () => stillTarget(object),
        commit,
        onChange: render,
        refreshGlass: options.refreshGlass,
      });
      if (glassFields !== undefined) appearance.append(glassFields);
    }
    const references = paintReferencesOf(object);
    if (references.length === 0) {
      appearance.append(
        createResolutionLine(
          uiCopy.inspectorFields.paint,
          undefined,
          undefined,
        ),
      );
    } else {
      for (const { label, ref } of references) {
        appearance.append(
          createResolutionLine(
            label,
            ref,
            resolveToken(context().globals, ref),
          ),
        );
      }
    }

    // Type belongs to a text object; a shape has none, so it gets no line.
    const preset = typePresetOf(object);
    if (preset !== undefined) {
      appearance.append(
        createResolutionLine(
          uiCopy.inspectorFields.runPreset,
          preset,
          resolveTypePreset(context().globals, preset),
        ),
      );
      const reveal = options.revealTypePresets;
      if (reveal !== undefined) {
        appearance.append(createTypePresetReveal(reveal));
      }
    }

    root.append(appearance);

    // Styled runs, for a text object (§89). Nothing is shown for a run-less
    // selection, so a shape's inspector stays as it was.
    const id = object.get("id");
    const inspectable = object as unknown as {
      get(n: string): unknown;
      set(n: string, v: unknown): void;
    };
    // Without an id there is no node to key a binding by, so the run list stays
    // what it was: a purely visual editor.
    const port: RunBindingPort | undefined =
      typeof id !== "string" || id.length === 0
        ? undefined
        : {
            bindings: () => options.nodeBindings?.(id) ?? [],
            setBindings: (next) => options.onNodeBindingsChange?.(id, next),
          };

    root.append(
      createRunEditor(
        editor,
        globals,
        inspectable,
        render,
        port,
        locale,
        options.sampleSource,
      ).root,
    );
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

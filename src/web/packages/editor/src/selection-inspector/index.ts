import type { Binding, FabricGlobals } from "@vigilia/renderer-core";
import type { FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { linkedPair } from "../editor-shell/controls/linked-pair.js";
import { numberField } from "../editor-shell/controls/number-field.js";
import { uiCopy } from "../ui-copy.js";
import {
  type AppearanceContext,
  createOpacityField,
  createResolutionLine,
  createTypePresetReveal,
  paintReferenceOf,
  resolveToken,
  resolveTypePreset,
  typePresetOf,
} from "./appearance.js";
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
 * Fabric reports geometry in the object's own origin; these read whole artboard
 * units (§57). Position is the object's own `left`/`top` — its placement in the
 * artboard — not the drawn box, which also includes any stroke and the group
 * context, so the numbers an author types match what they placed.
 */
function readField(object: FabricObject, key: GeometryField["key"]): number {
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
   * Brings the existing type-preset panel into view. The panel owns a preset's
   * fields, so a text selection links there instead of duplicating them.
   */
  readonly revealTypePresets?: () => void;
}

export function createSelectionInspector(
  host: HTMLElement,
  options: SelectionInspectorOptions,
): SelectionInspector {
  const editor = options.editor;
  let globals = options.globals;
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

  /** The object to describe: the live selection, else the last one still present. */
  const target = (): FabricObject | undefined => {
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

  /** Writes one field to the object without rendering or saving history; the
      caller batches both halves of a pair into one entry. */
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
        // Scale rather than resize: a chart's own width is its raster size.
        const next = value / (object.width <= 0 ? 1 : object.width);
        object.set({ scaleX: next });
        break;
      }
      case "height": {
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

  const render = (): void => {
    root.replaceChildren();
    const object = target();

    if (object === undefined) {
      return;
    }

    const heading = document.createElement("h2");
    heading.textContent = uiCopy.inspectorFields.selection;
    root.append(heading);

    const geometry = document.createElement("div");

    /** A refused edit restores the field itself (the primitives own that);
        the panel only has to report it, as it always has. */
    const refused = (): void => {
      editor.errorManager.warn("controls", uiCopy.inspectorFields.invalidValue);
    };

    /** The target may have changed while a field held focus; re-render rather
        than write to an object the panel no longer describes. */
    const stillTarget = (): boolean => {
      if (target() === object) return true;
      render();
      return false;
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
        onReject: refused,
        onCommit: (firstValue, secondValue) => {
          if (!stillTarget()) return;
          write(object, first.key, firstValue);
          write(object, second.key, secondValue);
          // One entry for the pair, matching a single field's edit.
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
        if (!stillTarget()) return;
        write(object, "angle", value);
        commit();
      },
    });
    geometry.append(rotation.row);

    root.append(geometry);

    // Appearance, and what the object's references actually resolve to.
    const appearance = document.createElement("div");
    appearance.append(createOpacityField(context(), object, render));

    const reference = paintReferenceOf(object);
    appearance.append(
      createResolutionLine(
        uiCopy.inspectorFields.paint,
        reference,
        resolveToken(context().globals, reference),
      ),
    );

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
      createRunEditor(editor, globals, inspectable, render, port).root,
    );
  };

  // Fabric reports a finished drag/resize/rotate as `object:modified`; the fields
  // must follow it or they would show stale numbers.
  editor.canvas.on("object:modified", render);
  editor.canvas.on("selection:created", render);
  editor.canvas.on("selection:updated", render);
  editor.canvas.on("selection:cleared", render);
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
  };
}

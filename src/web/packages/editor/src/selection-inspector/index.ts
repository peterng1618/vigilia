import type { Globals } from "@vigilia/renderer-core";
import type { FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { uiCopy } from "../ui-copy.js";
import {
  type AppearanceContext,
  createOpacityField,
  createResolutionLine,
  paintReferenceOf,
  resolveToken,
} from "./appearance.js";

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
  setGlobals(next: Globals | undefined): void;
}

/** A geometry field, in whole artboard units. */
interface GeometryField {
  readonly key: "left" | "top" | "width" | "height" | "angle";
  readonly label: string;
  readonly min?: number;
}

const GEOMETRY_FIELDS: readonly GeometryField[] = [
  { key: "left", label: uiCopy.inspectorFields.x },
  { key: "top", label: uiCopy.inspectorFields.y },
  { key: "width", label: uiCopy.inspectorFields.width, min: 1 },
  { key: "height", label: uiCopy.inspectorFields.height, min: 1 },
  { key: "angle", label: uiCopy.inspectorFields.rotation },
];

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
  readonly globals?: Globals;
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

  /** Reverts the field to the object's current value, refusing invalid input. */
  const reject = (
    input: HTMLInputElement,
    object: FabricObject,
    key: GeometryField["key"],
  ): void => {
    input.value = String(Math.round(readField(object, key)));
    editor.errorManager.warn("controls", uiCopy.inspectorFields.invalidValue);
  };

  const apply = (
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
    editor.canvas.requestRenderAll();
    // One entry per committed edit, matching the dock's own actions.
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

    const grid = document.createElement("div");
    grid.className = "vigilia-selection-grid";

    for (const field of GEOMETRY_FIELDS) {
      const label = document.createElement("label");
      label.textContent = field.label;
      const input = document.createElement("input");
      input.type = "number";
      input.step = "1";
      input.dataset["vigiliaGeometry"] = field.key;
      if (field.min !== undefined) input.min = String(field.min);
      input.value = String(Math.round(readField(object, field.key)));

      input.addEventListener("change", () => {
        // The target may have changed while the field held focus.
        if (target() !== object) {
          render();
          return;
        }

        const value = Number(input.value);
        if (
          !Number.isFinite(value) ||
          (field.min !== undefined && value < field.min)
        ) {
          reject(input, object, field.key);
          return;
        }

        apply(object, field.key, value);
        // Re-read: the write may have moved the drawn box (e.g. rotation).
        input.value = String(Math.round(readField(object, field.key)));
      });

      label.append(input);
      grid.append(label);
    }

    root.append(grid);

    // Appearance, and what the object's references actually resolve to.
    const appearance = document.createElement("div");
    appearance.className = "vigilia-selection-appearance";
    appearance.append(createOpacityField(context(), object, render));

    const reference = paintReferenceOf(object);
    appearance.append(
      createResolutionLine(
        uiCopy.inspectorFields.paint,
        reference,
        resolveToken(context().globals, reference),
      ),
    );
    root.append(appearance);
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

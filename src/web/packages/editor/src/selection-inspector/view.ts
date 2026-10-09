import { objectName } from "@vigilia/renderer-core";
import type { FabricObject } from "fabric/es";
import { uiCopy } from "../ui-copy.js";
import {
  type ColumnContext,
  type ColumnSectionId,
  type GeometryKey,
  type GeometryPort,
  type SelectionKind,
  selectionKindOf,
} from "./per-kind-column.js";

/**
 * The column as a value.
 *
 * Every leaf is a primitive, an array or a plain object, so a test can round-trip
 * it through JSON and a renderer can diff it. A Fabric object here would be the
 * one thing [ADR-0039] forbids — React holds this view and never the object it
 * describes, and the imperative edit port below is the only way back.
 */

export interface SelectionView {
  readonly targetRevision: number;
  readonly subject:
    | { readonly name: string; readonly kindLine: string }
    | undefined;
  readonly locked: boolean;
  readonly sections: readonly ColumnSectionView[];
}

export interface ColumnSectionView {
  readonly id: ColumnSectionId;
  readonly title: string;
  readonly readOnly: boolean;
  readonly defaultOpen: boolean;
  /** Flat, one control each. */
  readonly fields: readonly FieldView[];
  /** The sub-surfaces that are not one control. */
  readonly extras: readonly ExtraView[];
}

export type FieldView =
  | {
      readonly id: string;
      readonly control: "text";
      readonly label: string;
      readonly value: string;
      readonly refused?: string;
    }
  | {
      readonly id: string;
      readonly control: "number";
      readonly label: string;
      readonly value: number;
      readonly unit?: string;
      readonly refused?: string;
    }
  | {
      readonly id: string;
      readonly control: "toggle";
      readonly label: string;
      readonly checked: boolean;
      readonly refused?: string;
    }
  | {
      readonly id: string;
      readonly control: "select";
      readonly label: string;
      readonly value: string;
      readonly options: readonly {
        readonly id: string;
        readonly name: string;
      }[];
    }
  | {
      readonly id: string;
      readonly control: "slider";
      readonly label: string;
      readonly value: number;
      readonly min: number;
      readonly max: number;
    }
  | {
      readonly id: string;
      readonly control: "segmented";
      readonly label: string;
      readonly value: string;
      readonly options: readonly {
        readonly id: string;
        readonly name: string;
      }[];
    }
  | {
      readonly id: string;
      readonly control: "swatch";
      readonly label: string;
      readonly value: string;
    }
  | {
      readonly id: string;
      readonly control: "readOnly";
      readonly label: string;
      readonly value: string;
    };

/** The four sub-surfaces that are not one control. Each names one React
    component in this family; no other kind is added without amending this. */
export type ExtraView =
  | { readonly kind: "runs"; readonly nodeId: string }
  | { readonly kind: "crop" }
  | { readonly kind: "chartContent" }
  | { readonly kind: "chartPaint" };

/**
 * The read-only context the projection needs: the same shapes the column already
 * takes, not an injected copy of every pure predicate. `geometry` is the read
 * half of the port `index.ts` owns, so a value is never re-derived here.
 */
export type ProjectionPorts = Pick<
  ColumnContext,
  "globals" | "locale" | "nodeBindings" | "sampleSource"
> & {
  readonly geometry: Pick<GeometryPort, "read" | "measuredEdge">;
};

/**
 * The column's one way to write.
 *
 * `index.ts` owns the dispatcher and the write funnel behind it. An edit carries
 * the target revision the view was projected from; the dispatcher compares it
 * with the live target before it writes, so a control whose draft outlived its
 * selection is refused rather than writing an old value into a new object.
 */
export interface SelectionEdits {
  readonly commit: (
    expectedRevision: number,
    fieldId: string,
    value: string | number | boolean,
  ) => boolean;
}

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
export function isTextObject(object: FabricObject): boolean {
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
export function measuredEdgeOf(
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
 * Fabric reports geometry in the object's own origin; these read whole artboard
 * units (§57). Position is the object's own `left`/`top` — its placement in the
 * artboard — not the drawn box, which also includes any stroke and the group
 * context, so the numbers an author types match what they placed.
 */
export function readField(object: FabricObject, key: GeometryKey): number {
  const box = authoredBoxOf(object, key);
  if (box !== undefined) return box;
  if (key === "width") return object.width * object.scaleX;
  if (key === "height") return object.height * object.scaleY;
  if (key === "left") return object.left;
  if (key === "top") return object.top;
  return object.angle;
}

/** The word the column shows for each kind of thing it can describe. The five
    layer kinds keep their one owner; a multi-selection has no layer kind and is
    named by the copy table's own word for a selection. */
const KIND_WORD: Readonly<Record<SelectionKind, string>> = {
  text: uiCopy.panels.layerKinds.text,
  shape: uiCopy.panels.layerKinds.shape,
  chart: uiCopy.panels.layerKinds.chart,
  group: uiCopy.panels.layerKinds.group,
  image: uiCopy.panels.layerKinds.image,
  activeSelection: uiCopy.inspectorFields.selection,
};

/**
 * What the column says the selection is. The name falls back to the id exactly
 * as the layer row does, so an unnamed object reads as the thing the rest of the
 * editor already calls it.
 */
function subjectNameOf(object: FabricObject): string {
  return objectName(object) ?? String(object.get("id") ?? "");
}

/** The key a binding on this node carries, when one does. The subject's second
    line is about the object, and the key is the fact a reader needs to tell two
    otherwise identical rows apart. */
function bindingKeyOf(
  object: FabricObject,
  ports: ProjectionPorts,
): string | undefined {
  const id = object.get("id");
  if (typeof id !== "string" || id.length === 0) return undefined;
  return ports.nodeBindings?.(id)[0]?.semanticKey;
}

/**
 * The projection. Reads only, through the owners — it resolves no target of its
 * own (`index.ts`'s `target()` decides which object is described and hands it
 * here) and it holds no writer and no DOM.
 */
export function projectSelection(
  target: FabricObject | undefined,
  targetRevision: number,
  ports: ProjectionPorts,
): SelectionView {
  if (target === undefined) {
    return { targetRevision, subject: undefined, locked: false, sections: [] };
  }

  return {
    targetRevision,
    subject: {
      name: subjectNameOf(target),
      kindLine: uiCopy.inspectorFields.subjectKind(
        KIND_WORD[selectionKindOf(target)],
        bindingKeyOf(target, ports),
      ),
    },
    locked: target.get("locked") === true,
    // The five sections are projected where they are rendered; every field rule
    // still lives in the per-kind builders, so this view describes the subject
    // the column opens with and nothing that is not yet a value.
    sections: [],
  };
}

import type { Binding } from "@vigilia/renderer-core";
import { isObjectName } from "@vigilia/renderer-core";
import type { FabricObject } from "fabric/es";
import type {
  ChartContentFieldsView,
  ChartPaintFieldsView,
} from "../chart-manager/chart-fields.js";
import { rowNameOf } from "../editor-shell/layer-tree.js";
import { uiCopy } from "../ui-copy.js";
import {
  type ColumnContext,
  type ColumnSection,
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
  /**
   * How many rows the section holds: its fields, its extras and the body it
   * does not render itself yet. An extra counts once however many controls it
   * carries — it is one row in this count's vocabulary, the same way a run
   * editor is — and it counts only while `rendersExtra` says the column renders
   * it, so the header can never claim a row that is not there.
   *
   * It lives in the value because the header prints it: collapsing a section is
   * ordering, not removal, so a closed Position still says how much it holds.
   */
  readonly count: number;
  /** Flat, one control each. */
  readonly fields: readonly FieldView[];
  /** The sub-surfaces that are not one control. */
  readonly extras: readonly ExtraView[];
}

/**
 * The `data-*` hooks a row's own focus target carries.
 *
 * The hook is not the field identity: `data-vigilia-geometry` names five values,
 * so a suite reads `[data-vigilia-geometry="width"]` and then reads `.value` off
 * the element the hook is on. Fields carry the attribute names, and the renderer
 * spreads them onto the control itself, never a wrapper — a hook on a wrapper is
 * a broken locator wearing a passing test.
 */
export type FieldHooks = Readonly<Record<`data-${string}`, string>>;

interface FieldBase {
  readonly id: string;
  readonly label: string;
  readonly data: FieldHooks;
  readonly refused?: string;
}

/** One entry in a list control: the stored value, and the name it shows. */
export interface FieldOption {
  readonly id: string;
  readonly name: string;
}

/**
 * One half of a paired row: two numbers sharing a line, each committing its
 * own. A pair is not one control — each half has its own id, its own hook and
 * its own commit — but they share a row and a set of bounds, which is what the
 * geometry lines (`X`/`Y`, `W`/`H`, a line's two ends) are.
 */
export interface PairHalfView {
  /** The field id the half commits through, not the DOM hook. */
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly data: FieldHooks;
  readonly integer?: boolean;
}

export type FieldView =
  | (FieldBase & {
      readonly control: "text";
      readonly value: string;
      /** A multi-line field: a polyline's points and a path's data are
          documents, not one-line answers. */
      readonly multiline?: boolean;
      readonly rows?: number;
    })
  | (FieldBase & {
      readonly control: "number";
      readonly value: number;
      readonly unit?: string;
      readonly min?: number;
      readonly max?: number;
      /**
       * The field's owner says the value is a whole one. Rotation's legacy
       * `numberField` refused a fraction, and the control set has no other way
       * to say so — a per-field check would be dropped again by each section
       * that converts its own geometry fields.
       */
      readonly integer?: boolean;
    })
  | (FieldBase & {
      readonly control: "pair";
      readonly halves: readonly PairHalfView[];
    })
  /**
   * A line of prose, not a control: bible §5.1's "a border means editable", so a
   * note carries no well. The size-disagreement line is the one it exists for.
   */
  | {
      readonly id: string;
      readonly control: "note";
      readonly value: string;
      readonly data: FieldHooks;
    }
  | (FieldBase & { readonly control: "toggle"; readonly checked: boolean })
  | (FieldBase & {
      readonly control: "select";
      readonly value: string;
      readonly options: readonly FieldOption[];
    })
  | (FieldBase & {
      readonly control: "slider";
      readonly value: number;
      readonly min: number;
      readonly max: number;
      /**
       * The owner says the value is whole. A slider steps by 1, so this is not
       * the step — it is the same declaration the number arm carries, kept here
       * because sides, a sweep and the glass blur refused a fraction as numbers
       * and still must as sliders. The boundary (`WRITABLE_FIELD_IDS`) is the
       * copy that enforces it.
       */
      readonly integer?: boolean;
    })
  | (FieldBase & {
      readonly control: "segmented";
      readonly value: string;
      readonly options: readonly FieldOption[];
    })
  /**
   * A paint reference, as bible §5's *swatch well*: the list is still the only
   * way to change the value and the swatch is a picture of it, resolved by the
   * caller so nothing here is a second resolver. `colour` is that picture — the
   * selected token's colour, or `transparent` when the value is empty or no
   * longer resolves.
   */
  | (FieldBase & {
      readonly control: "swatch";
      readonly value: string;
      readonly options: readonly FieldOption[];
      readonly colour: string;
    })
  | (FieldBase & { readonly control: "readOnly"; readonly value: string });

/** One entry in a run editor's dropdowns: the stored reference, and its name. */
export interface RunOptionView {
  readonly id: string;
  readonly name: string;
}

/**
 * One run of a text object, as the run editor renders it.
 *
 * The run editor is the one sub-surface the row union cannot express, so it
 * crosses the boundary as this value plus the imperative `RunEdits` port below
 * — never as the Fabric object, whose `runs` are what it reads.
 */
export interface RunRowView {
  /**
   * What the row *is*, for React's key: a run carries no id, so the projection
   * derives one from the run's identity fields and disambiguates a repeat.
   * Keying by `index` instead reconciles a draft onto the wrong run the moment
   * a run that is not the last is removed; keying by the text remounts the row
   * under the caret, because `ControlText` commits on Enter. `projectRuns`
   * carries the rule and its residual.
   */
  readonly id: string;
  readonly index: number;
  readonly kind: "literal" | "value";
  /** What the row is called: a reading's key, or the prose it says. */
  readonly label: string;
  readonly text: string;
  readonly typePreset: string;
  readonly colour: string;
  /**
   * The binding this run names, for the note's `data-vigilia-run-binding` — the
   * key `run.bindingId` carried before the column was React, and what a spec
   * reads to learn *which* binding a value run failed to resolve. `""` for
   * prose, which names no binding. It is not the row's ordinal: that is
   * `index`, and it rides the row's own `data-vigilia-run` hook.
   */
  readonly bindingId: string;
  /** The semantic key a value run reads, or `""` for prose. */
  readonly sourceKey: string;
  readonly unitDisplay: string;
  /** The note under a value run, and the problem it carries when one is. */
  readonly bindingNote?: string;
  readonly bindingProblem?: "undeclared" | "unmapped";
  /** Present on a value run whose binding is declared and pinned to an instant. */
  readonly format?: string;
  readonly formatDefault?: string;
  readonly zone?: string;
}

/** Everything the run editor renders, projected from the object it describes. */
export interface RunsView {
  readonly nodeId: string;
  readonly runs: readonly RunRowView[];
  readonly layout: {
    readonly align: string;
    readonly verticalAlign: string;
    readonly wrap: string;
    readonly overflow: string;
  };
  readonly presets: readonly RunOptionView[];
  readonly palettes: readonly RunOptionView[];
  /**
   * What each palette reference the editor offers currently resolves to, so a
   * swatch is a picture of the value rather than a second resolver. Keyed by
   * reference; a reference that no longer resolves is absent.
   */
  readonly swatchValues: Readonly<Record<string, string>>;
  readonly unitOptions: readonly RunOptionView[];
  /** What a value run may read; the prose option is the row's own first entry. */
  readonly sources: readonly RunOptionView[];
  readonly zones: readonly string[];
  /** True when the node declares bindings at all — it has an id to hang them on. */
  readonly bindable: boolean;
  /** A last run is not removable: a text object with no runs paints nothing. */
  readonly removable: boolean;
  readonly locale: string | undefined;
  readonly notes: readonly string[];
}

/**
 * The crop row, as a value: whether a session is open, and whether this
 * selection can start one. The ratios it offers are `crop.ts`'s own list, read
 * by the component rather than copied into every published view.
 */
export interface CropView {
  /** A session is open, so the row shows its own controls and ignores the selection. */
  readonly active: boolean;
  /** This selection can hold a crop, so the row offers to start one. */
  readonly canStart: boolean;
}

/** The crop row's one way to write, beside `SelectionEdits`. */
export interface CropEdits {
  readonly begin: () => boolean;
  readonly setAspect: (ratio: number) => void;
  readonly apply: () => void;
  readonly cancel: () => void;
}

/**
 * The four sub-surfaces that are not one control. Each names one React
 * component in this family; no other kind is added without amending this.
 */
export type ExtraView =
  | { readonly kind: "runs"; readonly nodeId: string; readonly runs: RunsView }
  | { readonly kind: "crop"; readonly crop: CropView }
  | {
      readonly kind: "chartContent";
      readonly content: ChartContentFieldsView;
    }
  | { readonly kind: "chartPaint"; readonly paint: ChartPaintFieldsView };

/**
 * The run editor's one way to write, beside `SelectionEdits`.
 *
 * A run is an authored value — a whole `TextRun`, or the layout map it shares
 * with its siblings — and React holds only the projected `RunsView`, never the
 * run it describes. So the port is expressed as intent keyed by run index, and
 * `index.ts` resolves it against the live object it owns: it reads the run, keeps
 * the fields the edit does not name, and records one history entry.
 */
export interface RunEdits {
  readonly setRunText: (index: number, text: string) => boolean;
  readonly setRunPreset: (index: number, ref: string) => boolean;
  readonly setRunColour: (index: number, ref: string) => boolean;
  readonly setUnitDisplay: (index: number, value: string) => boolean;
  readonly setSource: (index: number, semanticKey: string) => boolean;
  readonly setFormat: (index: number, format: string) => boolean;
  readonly setZone: (index: number, zone: string) => boolean;
  readonly writeLayout: (patch: TextLayoutPatch) => boolean;
  readonly addRun: () => boolean;
  readonly removeRun: (index: number) => boolean;
}

/** The text layout keys the run editor writes, whichever are present. */
export interface TextLayoutPatch {
  readonly align?: string;
  readonly verticalAlign?: string;
  readonly wrap?: boolean;
  readonly overflow?: string;
}

/** The bindings a node declares, read and written through the session. */
export interface RunBindingPort {
  readonly bindings: () => readonly Binding[];
  readonly setBindings: (bindings: readonly Binding[]) => void;
}

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
 * The field ids the dispatcher can write, and what a value of each must be.
 *
 * The geometry keys were the first five; a Text column's name and a Layer
 * column's opacity joined them when their sections moved to React. Membership is
 * the eligibility rule: a field id absent here reaches no writer, so a control
 * that renders a hook the dispatcher does not know is refused rather than
 * silently accepted.
 *
 * The kind is the boundary's own copy of the rule its control carries, and for
 * `angle` the two are `"integer"` here and `integer: true` on its `FieldView`.
 * The control is a convenience; this table is what must hold, so a fraction
 * that a wrongly-built control let through is still refused here.
 */
type WritableKind =
  | "number"
  | "integer"
  | "name"
  | "boolean"
  | "text"
  | "reference";
const WRITABLE_FIELD_IDS: ReadonlyMap<string, WritableKind> = new Map([
  ["left", "integer"],
  ["top", "integer"],
  ["width", "integer"],
  ["height", "integer"],
  ["angle", "integer"],
  ["opacity", "number"],
  ["name", "name"],
  // The bleed mark, and a shape's own geometry. The pre-plan surface refused a
  // typed fraction on every one of these (`numberField`'s unconditional
  // `Number.isInteger`), so the boundary copies that rule rather than trusting
  // the control to have kept it.
  ["bleeds", "boolean"],
  ["shape-sides", "integer"],
  ["shape-line-x1", "integer"],
  ["shape-line-y1", "integer"],
  ["shape-line-x2", "integer"],
  ["shape-line-y2", "integer"],
  ["shape-angle-startAngle", "integer"],
  ["shape-angle-endAngle", "integer"],
  ["shape-points", "text"],
  ["shape-path", "text"],
  // Paint. The four whole-number fields are `"integer"` for the same reason the
  // geometry ids are: the pre-plan `numberField` refused a typed fraction on
  // every one of them, and `ControlNumber`'s `integer` flag is a convenience the
  // boundary must not depend on. A token field carries a `palette.` reference or
  // `""` for none — the boundary checks the shape, not the token.
  ["panel-fill", "reference"],
  ["panel-stroke", "reference"],
  ["panel-shadow", "reference"],
  ["panel-border", "integer"],
  ["panel-radius", "integer"],
  ["panel-shadow-blur", "integer"],
  ["panel-shadow-offset", "integer"],
  ["glass-enabled", "boolean"],
  ["glass-blur", "integer"],
]);

/** Why an edit was refused; `undefined` means it may reach the write funnel. */
export type EditRefusal = "stale" | "locked" | "unknown" | "invalid";

/**
 * The guard in front of the write funnel, as a pure decision so it can be
 * driven without a React control.
 *
 * An edit carries the revision the view was projected from and the live object
 * carries its own; a mismatch is a draft that outlived its selection, refused
 * **before** the funnel, because the funnel would resolve the *current* target
 * and write an old draft into a newly selected object. Lock and field
 * eligibility are re-checked here too: a control cannot be trusted to have
 * checked them, and a field that writes the object directly is withheld from a
 * locked one.
 *
 * The value rule is per field: a number must be finite, a whole-number field
 * must be whole, and a name must be one the document envelope would accept —
 * refused rather than coerced or truncated.
 */
export function editRefusal(
  edit: {
    readonly expectedRevision: number;
    readonly fieldId: string;
    readonly value: string | number | boolean;
  },
  live: { readonly targetRevision: number; readonly locked: boolean },
): EditRefusal | undefined {
  if (edit.expectedRevision !== live.targetRevision) return "stale";
  if (live.locked) return "locked";
  const kind = WRITABLE_FIELD_IDS.get(edit.fieldId);
  if (kind === undefined) return "unknown";
  if (kind === "name") {
    if (typeof edit.value !== "string") return "invalid";
    const trimmed = edit.value.trim();
    return trimmed === "" || isObjectName(trimmed) ? undefined : "invalid";
  }
  if (kind === "boolean") {
    return typeof edit.value === "boolean" ? undefined : "invalid";
  }
  if (kind === "text") {
    // A multi-line draft (a polyline's points, a path's data) is parsed by the
    // writer; the boundary only insists it is a string, never `Number("")`'s zero.
    return typeof edit.value === "string" ? undefined : "invalid";
  }
  if (kind === "reference") {
    // A paint reference is a token id or the empty string a cleared picker
    // writes. The writer resolves it through the palette owner; the boundary
    // only refuses a value that is not one.
    return typeof edit.value === "string" &&
      (edit.value === "" || edit.value.startsWith("palette."))
      ? undefined
      : "invalid";
  }
  if (typeof edit.value !== "number" || !Number.isFinite(edit.value)) {
    // Refuse rather than coerce: a non-finite number is not a dimension.
    return "invalid";
  }
  // `angle` was whole units before its field was converted, and a rotated
  // object's own angle is the only thing the write would move.
  if (kind === "integer" && !Number.isInteger(edit.value)) return "invalid";
  return undefined;
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
 * What the column says the selection is called. The rule is `layer-tree`'s one
 * owner, so the subject prints exactly what that object's own layer row prints —
 * two copies of the fallback chain already disagreed about a nameless object
 * with a blank id.
 */
function subjectNameOf(object: FabricObject): string {
  return rowNameOf(object, KIND_WORD[selectionKindOf(object)]);
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
 * The value half of a rendered section: what the column says about it, without
 * the DOM it still holds.
 *
 * `ColumnSection.body` is the imperative half of the React conversion — the
 * field builders return `HTMLElement`s until Tasks 3–6 convert them — and it
 * must not cross into a view: Review Focus 1 walks a `SelectionView` for a DOM
 * node, so an element in a `ColumnSectionView` fails the plan's own guard. The
 * strip is here rather than at the call site so that guard has one place to
 * watch.
 */
function sectionViewOf(section: ColumnSection): ColumnSectionView {
  return {
    id: section.id,
    title: section.title,
    readOnly: section.readOnly,
    defaultOpen: section.defaultOpen,
    count: section.count,
    fields: section.fields,
    extras: section.extras,
  };
}

/**
 * The projection. Reads only, through the owners — it resolves no target of its
 * own (`index.ts`'s `target()` decides which object is described and hands it
 * here) and it holds no writer and no DOM. The rendered sections are handed in
 * and reduced to their values, so the view the column renders is the one list of
 * sections and not a second copy of it.
 */
export function projectSelection(
  target: FabricObject | undefined,
  targetRevision: number,
  ports: ProjectionPorts,
  sections: readonly ColumnSection[] = [],
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
    sections: sections.map(sectionViewOf),
  };
}

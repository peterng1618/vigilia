import type { FabricGlobals } from "@vigilia/renderer-core";
import {
  applyObjectPalettePaints,
  type FabricPaintRefs,
  paintPropertyFor,
  VIGILIA_PAINT_PROPERTY,
  Arc,
  Wedge,
} from "@vigilia/scene-fabric";
import {
  Circle,
  Ellipse,
  type FabricObject,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Shadow,
  Triangle,
} from "fabric/es";
import { linkedPair } from "../editor-shell/controls/linked-pair.js";
import { numberField } from "../editor-shell/controls/number-field.js";
import { cornersForSides } from "../new-object-defaults.js";
import { uiCopy } from "../ui-copy.js";
import { type AppearanceContext, resolveToken } from "./appearance.js";

/**
 * A shape's authored material: which tokens paint its fill, border and shadow,
 * the native geometry that makes them visible, and whatever belongs to that one
 * kind of shape. Everything here is a property Fabric already owns, so an
 * author can edit it, save it, undo it and read it back — no second model beside
 * the scene.
 *
 * Paint resolves through `applyObjectPalettePaints`, the same owner the editor
 * uses when a palette changes, so a field and a palette edit cannot disagree
 * about what a reference means.
 */

/** The paint properties a panel may reference, matching `FabricPaintRefs`. */
type PaintProperty = keyof FabricPaintRefs;

/**
 * A starting blur for a shadow the author has just given a colour. A colour
 * alone draws nothing, so the committed edit must leave something visible —
 * and the blur field appears with it, so this is a value to move, not a rule.
 */
const DEFAULT_PANEL_SHADOW_BLUR = 8;

/**
 * How far a newly shadowed panel's shadow falls below it. A shadow with no
 * offset is a symmetric halo, not a shadow: the captured editor evidence showed
 * the light panel token drawing a white glow around the panel until this moved.
 */
const DEFAULT_PANEL_SHADOW_OFFSET = 4;

export interface PanelFieldHooks {
  /** False once the panel describes a different object; the edit is refused. */
  readonly stillTarget: () => boolean;
  /** Repaints and records: one history entry per committed edit. */
  readonly commit: () => void;
  /** Re-reads the object, so the fields show what was just written. */
  readonly onChange: () => void;
}

/**
 * Whether these fields apply at all. Every primitive Fabric 7 ships owns a
 * fill, a stroke, a border width and a shadow, so all of them get the same
 * fields; a chart, an image, a text object or a group would be offered controls
 * that accept an edit and apply none.
 *
 * The corner radius is narrower and is offered for a rectangle alone, because
 * `rx` is a `Rect` property and no other class reads it.
 *
 * Checked on the live class rather than the persisted `"type"` string: Fabric
 * lowercases `object.type`, and only the scene JSON spells it `Rect`.
 *
 * `Arc` and `Wedge` are named even though both extend `Circle` and are already
 * admitted by that arm. A kind listed only by its parent reads as an oversight
 * to the next reader, and the day someone drops `Circle` from this list — it
 * owns no radius field of its own — the two swept kinds lose their material
 * without anything here saying so.
 */
export function supportsPanelFields(object: FabricObject): boolean {
  return (
    object instanceof Rect ||
    object instanceof Circle ||
    object instanceof Ellipse ||
    object instanceof Triangle ||
    object instanceof Polygon ||
    object instanceof Polyline ||
    object instanceof Line ||
    object instanceof Path ||
    object instanceof Arc ||
    object instanceof Wedge
  );
}

/**
 * Whether this shape's own geometry includes the two ends of a sweep.
 *
 * Asked on the class, and that is the whole point: `Circle` carries
 * `startAngle`/`endAngle` of its own and defaults them to 0 and 360, so a full
 * disc and a closed-up arc are the same pair of numbers. A gate that read the
 * values would take the fields away exactly when an author had swept a shape
 * all the way round, and they would only come back on a reload — and a gate that
 * read the layer's *name* instead would take them away when an author renamed
 * the row, which is the same defect wearing a different hat.
 *
 * `Wedge` extends `Circle` and `Arc` extends it too, so both kinds are named
 * once here and neither can be added without being seen.
 */
function hasSweep(object: FabricObject): boolean {
  return object instanceof Arc || object instanceof Wedge;
}

/** The object's own stored references. Only `writeRef` writes, and it spreads
    first, so nothing here can mutate the object behind the validator. Exported
    for the same reason `writeRef` is: the frosted-glass control reads this
    object's fill before it decides whether to move it. */
export function paintRefs(object: FabricObject): FabricPaintRefs {
  const value = object.get(VIGILIA_PAINT_PROPERTY);
  return typeof value === "object" && value !== null
    ? (value as FabricPaintRefs)
    : {};
}

/**
 * Sets one property's reference and leaves the others alone. Palette identity
 * is per property: choosing a fill must not re-point a border or a shadow the
 * author already set, and clearing one must not clear the rest.
 *
 * Exported because the frosted-glass control writes this object's fill too, and
 * a second copy of the spread would be a second place that decides what a paint
 * reference set means.
 */
export function writeRef(
  object: FabricObject,
  property: PaintProperty,
  ref: `palette.${string}` | undefined,
): void {
  const next: { -readonly [K in PaintProperty]?: `palette.${string}` } = {
    ...paintRefs(object),
  };
  if (ref === undefined) delete next[property];
  else next[property] = ref;
  object.set(VIGILIA_PAINT_PROPERTY, next);
}

interface TokenFieldOptions {
  readonly label: string;
  readonly data: string;
  readonly context: AppearanceContext;
  readonly selected: `palette.${string}` | undefined;
  /**
   * Fabric's `Shadow.color` is a string, and the envelope refuses a gradient
   * reference rather than dropping it at paint time, so a gradient is never
   * offered where one cannot be applied.
   */
  readonly solidOnly?: boolean;
  readonly onCommit: (ref: `palette.${string}` | undefined) => void;
}

/** A labelled palette-token picker, named by the token's own name. */
function tokenField(options: TokenFieldOptions): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "vigilia-field";
  const label = document.createElement("label");
  label.htmlFor = `vigilia-token-${options.data}`;
  label.textContent = options.label;
  const select = document.createElement("select");
  select.id = label.htmlFor;
  select.dataset[options.data] = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = uiCopy.inspectorFields.notSet;
  select.append(none);
  for (const token of tokenOptions(
    options.context.globals,
    options.solidOnly === true,
  )) {
    const option = document.createElement("option");
    option.value = `palette.${token.id}`;
    option.textContent = token.name;
    select.append(option);
  }
  select.value = options.selected ?? "";
  select.addEventListener("change", () => {
    const value = select.value;
    options.onCommit(value === "" ? undefined : (value as `palette.${string}`));
  });
  row.append(label, select);
  return row;
}

/** The theme's tokens, each under the name its author gave it. */
function tokenOptions(
  globals: FabricGlobals | undefined,
  solidOnly: boolean,
): ReadonlyArray<{ readonly id: string; readonly name: string }> {
  return Object.entries(globals?.palette ?? {})
    .filter(
      ([id, entry]) =>
        id !== "none" && !(solidOnly && entry.value.kind !== "solid"),
    )
    .map(([id, entry]) => ({ id, name: entry.name }));
}

/** The panel's appearance fields, or nothing when it is not a panel. */
export function createPanelFields(
  context: AppearanceContext,
  object: FabricObject,
  hooks: PanelFieldHooks,
): HTMLElement | undefined {
  if (!supportsPanelFields(object)) return undefined;

  const root = document.createElement("div");
  const refs = paintRefs(object);
  /** An unfilled path is stroked; one of the controls below paints that ink. */
  const paintProperty = paintPropertyFor(object);

  /** A refused edit restores the field itself; this only reports it. */
  const refused = (): void =>
    context.editor.errorManager.warn(
      "controls",
      uiCopy.inspectorFields.invalidValue,
    );

  /** One committed edit: refuse a stale one, then repaint and record once. */
  const commit = (write: () => void): void => {
    if (!hooks.stillTarget()) return;
    write();
    hooks.commit();
    hooks.onChange();
  };
  /** A reference change, resolved by the owner the palette editor also uses.
   *
   *  The channel is the shell's own, and it is here rather than only in
   *  `applyArtboardPaint` because this pass is whole-canvas: it walks every
   *  object, so an arc anywhere in the scene loses its fill on an inspector
   *  edit that had nothing to do with it. Passing nothing here is what made
   *  that silent. */
  const commitRef = (write: () => void): void => {
    commit(() => {
      write();
      applyObjectPalettePaints(context.editor.canvas, context.globals, {
        onRefusedPaint: (message) =>
          context.editor.errorManager.warn("paint", message),
      });
    });
  };

  root.append(
    // One control, and which property it writes is the scene's own decision:
    // an unfilled path is stroked, so its paint is ink. See `paintPropertyFor`.
    tokenField({
      label:
        paintProperty === "stroke"
          ? uiCopy.inspectorFields.panelInk
          : uiCopy.inspectorFields.panelFill,
      data: "vigiliaPanelFill",
      context,
      selected: refs[paintProperty],
      onCommit: (ref) =>
        commitRef(() => {
          writeRef(object, paintProperty, ref);
          // No reference means no resolver will clear it, so the live paint is
          // cleared here rather than left at the last token's colour.
          if (ref === undefined) object.set(paintProperty, "");
        }),
    }),
    // Not offered twice: on an unfilled path the control above already writes
    // the stroke, and two fields on one property is a coin toss for the author.
    ...(paintProperty === "stroke"
      ? []
      : [
          tokenField({
            label: uiCopy.inspectorFields.panelStroke,
            data: "vigiliaPanelStroke",
            context,
            selected: refs.stroke,
            onCommit: (ref) =>
              commitRef(() => {
                writeRef(object, "stroke", ref);
                if (ref === undefined) object.set("stroke", "");
              }),
          }),
        ]),
    numberField({
      label: uiCopy.inspectorFields.panelBorder,
      value: Math.round(object.get("strokeWidth") as number),
      min: 0,
      data: "vigiliaPanelBorder",
      invalidMessage: uiCopy.inspectorFields.invalidValue,
      onReject: refused,
      onCommit: (value) => commit(() => object.set("strokeWidth", value)),
    }).row,
    // A rectangle's alone: `rx` belongs to `Rect`, and a radius box over any
    // other shape would read back `NaN` and write a property nothing draws.
    ...(object instanceof Rect
      ? [
          numberField({
            label: uiCopy.inspectorFields.panelRadius,
            value: Math.round(object.get("rx") as number),
            min: 0,
            data: "vigiliaPanelRadius",
            invalidMessage: uiCopy.inspectorFields.invalidValue,
            onReject: refused,
            // Both axes, because Fabric derives `ry` from `rx` only while it is
            // unset; persisting one and reading the other back would depend on
            // that default.
            onCommit: (value) =>
              commit(() => object.set({ rx: value, ry: value })),
          }).row,
        ]
      : []),
    tokenField({
      label: uiCopy.inspectorFields.panelShadow,
      data: "vigiliaPanelShadow",
      context,
      selected: refs.shadowColor,
      solidOnly: true,
      onCommit: (ref) =>
        commitRef(() => {
          writeRef(object, "shadowColor", ref);
          if (ref === undefined) {
            object.set("shadow", null);
            return;
          }
          // An existing shadow keeps its blur and offsets; only its colour is
          // re-resolved, from the reference just written.
          if (object.get("shadow") instanceof Shadow) return;
          object.set(
            "shadow",
            new Shadow({
              color: resolveToken(context.globals, ref) ?? "",
              blur: DEFAULT_PANEL_SHADOW_BLUR,
              offsetX: 0,
              offsetY: DEFAULT_PANEL_SHADOW_OFFSET,
            }),
          );
        }),
    }),
  );

  // Only offered when there is a shadow for it to change: a blur box over a
  // panel with no shadow accepts an edit and applies none.
  const shadow = object.get("shadow");
  if (shadow instanceof Shadow) {
    /** Writes one native shadow property, if the shadow is still there. */
    const shadowNumber = (
      label: string,
      data: string,
      min: number | undefined,
      read: (live: Shadow) => number,
      write: (live: Shadow, value: number) => void,
    ): HTMLElement =>
      numberField({
        label,
        value: Math.round(read(shadow)),
        ...(min === undefined ? {} : { min }),
        data,
        invalidMessage: uiCopy.inspectorFields.invalidValue,
        onReject: refused,
        onCommit: (value) =>
          commit(() => {
            const live = object.get("shadow");
            if (live instanceof Shadow) write(live, value);
          }),
      }).row;

    root.append(
      shadowNumber(
        uiCopy.inspectorFields.panelShadowBlur,
        "vigiliaPanelShadowBlur",
        0,
        (live) => live.blur,
        (live, value) => {
          live.blur = value;
        },
      ),
      // Unbounded, because Fabric's own `offsetY` is: a shadow above a panel is
      // legitimate, and a floor of zero would display a value the field then
      // refused to accept on the author's next edit.
      shadowNumber(
        uiCopy.inspectorFields.panelShadowOffset,
        "vigiliaPanelShadowOffset",
        undefined,
        (live) => live.offsetY,
        (live, value) => {
          live.offsetY = value;
        },
      ),
    );
  }

  root.append(...createShapeFields(object, hooks, refused));

  return root;
}

/** The fewest sides a closed shape can have, and the most an author can ask
    for: two is a line, and past this the count is a mistake rather than a
    design. */
const MIN_POLYGON_SIDES = 3;
const MAX_POLYGON_SIDES = 32;

/** A polyline with fewer than two corners has no length to draw. */
const MIN_POLYLINE_POINTS = 2;

/**
 * The bounds on a sweep's ends. Fabric's own `Circle` documents `startAngle` as
 * 0–359 and `endAngle` as 1–360, and the full turn is 360 rather than 0, so the
 * two ends share one closed range rather than each having a half-open one the
 * other cannot satisfy.
 */
const MIN_SWEEP_DEGREES = 0;
const MAX_SWEEP_DEGREES = 360;

let shapeFieldSeq = 0;

/**
 * Adopts geometry the author just typed, and drops the scale that belonged to
 * the geometry it replaced.
 *
 * A polygon's points, a polyline's points and a path's commands are all
 * **absolute coordinates in the object's own space**, so any `scaleX`/`scaleY`
 * on the object is a scale from a different drawing. Measured: a path sized to
 * 28 × 28 and then given 14 × 14 of new data drew **1 × 3 units** — the new
 * data multiplied by the old drawing's scale, which is the order every icon in
 * a dashboard is built in (insert, size, then draw).
 *
 * So the data wins and the scale goes back to 1, which leaves the object at the
 * size its own geometry measures and makes the W and H fields mean what they
 * mean on every other shape. This is the rule the polygon branch above already
 * keeps — *"the points remain the only persisted truth"* — completed.
 */
function adoptGeometry(object: FabricObject): void {
  // Every caller is a `Polygon`, a `Polyline` or a `Path`; all three re-measure
  // from their own geometry through this one method.
  (object as FabricObject & { setDimensions(): void }).setDimensions();
  object.set({ scaleX: 1, scaleY: 1 });
}

/**
 * The geometry that belongs to this one kind of shape.
 *
 * A circle, an ellipse and a triangle own none: each is fully described by the
 * width and height the general fields already carry, and a field that derived
 * one of those would be a second way to say the same number.
 */
function createShapeFields(
  object: FabricObject,
  hooks: PanelFieldHooks,
  refused: () => void,
): readonly HTMLElement[] {
  /** One committed edit. `setCoords` because every field here moves a corner,
      a handle or an endpoint, and a stale control box outlives the render. */
  const commit = (write: () => void): void => {
    if (!hooks.stillTarget()) return;
    write();
    object.setCoords();
    hooks.commit();
    hooks.onChange();
  };
  const rows: HTMLElement[] = [];

  // A polygon before a polyline: Fabric's `Polygon` is a closed `Polyline`, so
  // the narrower test has to come first or a polygon would be given both.
  if (object instanceof Polygon) {
    const sides = numberField({
      label: uiCopy.inspectorFields.shapeSides,
      value: object.points.length,
      min: MIN_POLYGON_SIDES,
      max: MAX_POLYGON_SIDES,
      data: "vigiliaShapeSides",
      invalidMessage: uiCopy.inspectorFields.invalidValue,
      onReject: refused,
      onCommit: (value) =>
        commit(() => {
          const { minX, minY, width, height } = boundsOf(object.points);
          object.set(
            "points",
            cornersForSides(value, width, height).map((corner) => ({
              x: corner.x + minX,
              y: corner.y + minY,
            })),
          );
          // Fabric does not re-measure a points change on its own, so the
          // object would keep the old box until something else asked for it.
          adoptGeometry(object);
        }),
    });
    rows.push(sides.row);
  } else if (object instanceof Polyline) {
    const points = textArea({
      label: uiCopy.inspectorFields.shapePoints,
      value: pointsOf(object),
      data: "vigiliaShapePoints",
      invalidMessage: uiCopy.inspectorFields.invalidValue,
      onCommit: (value) => {
        const parsed = parsedPoints(value);
        if (parsed === undefined) {
          refused();
          return false;
        }
        commit(() => {
          object.set("points", parsed);
          adoptGeometry(object);
        });
        return true;
      },
    });
    rows.push(points.row);
  }

  if (object instanceof Line) {
    const ends = (
      rowLabel: string,
      x: "x1" | "x2",
      y: "y1" | "y2",
    ): HTMLElement =>
      linkedPair({
        rowLabel,
        first: {
          label: uiCopy.inspectorFields.x,
          value: Math.round(object.get(x) as number),
          data: "vigiliaShapeLine",
          dataValue: x,
        },
        second: {
          label: uiCopy.inspectorFields.y,
          value: Math.round(object.get(y) as number),
          data: "vigiliaShapeLine",
          dataValue: y,
        },
        invalidMessage: uiCopy.inspectorFields.invalidValue,
        onReject: refused,
        onCommitFirst: (value) => commit(() => object.set(x, value)),
        onCommitSecond: (value) => commit(() => object.set(y, value)),
      }).row;

    rows.push(
      ends(uiCopy.inspectorFields.shapeStart, "x1", "y1"),
      ends(uiCopy.inspectorFields.shapeEnd, "x2", "y2"),
    );
  }

  if (hasSweep(object)) {
    // Bounded at both ends, and deliberately *not* cross-checked against each
    // other: a start past its end is a legal full turn expressed the other way
    // round, and Fabric draws it. Refusing it would mean a second rule about
    // what a sweep means, held here as well as in the geometry. What is refused
    // is a value outside 0–360, by the field's own bound.
    rows.push(
      ...(["startAngle", "endAngle"] as const).map(
        (key) =>
          numberField({
            label:
              key === "startAngle"
                ? uiCopy.inspectorFields.shapeStartAngle
                : uiCopy.inspectorFields.shapeEndAngle,
            value: object.get(key) as number,
            min: MIN_SWEEP_DEGREES,
            max: MAX_SWEEP_DEGREES,
            data: "vigiliaShapeAngle",
            dataValue: key,
            invalidMessage: uiCopy.inspectorFields.invalidValue,
            onReject: refused,
            // Both angles are the object's own Fabric properties, so the write is
            // the same one a save makes and a reopen reads — there is no second
            // copy of the sweep for this panel to disagree with.
            onCommit: (value) => commit(() => object.set(key, value)),
          }).row,
      ),
    );
  }

  if (object instanceof Path) {
    rows.push(
      textArea({
        label: uiCopy.inspectorFields.shapePath,
        value: pathDataOf(object),
        data: "vigiliaShapePath",
        rows: 3,
        invalidMessage: uiCopy.inspectorFields.invalidValue,
        onCommit: (value) => {
          const parsed = parsedPath(value);
          if (parsed === undefined) {
            refused();
            return false;
          }
          commit(() => {
            object.set("path", parsed);
            adoptGeometry(object);
          });
          return true;
        },
      }).row,
    );
  }

  return rows;
}

/** The box a set of points occupies, in the object's own untransformed space —
    the space the general W and H fields scale, not the space they display. */
function boundsOf(points: readonly { x: number; y: number }[]): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    minX,
    minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

/** A polyline's corners as one point per line, which is the format the field
    shows and the only one it reads. */
function pointsOf(polyline: Polyline): string {
  return polyline.points.map(({ x, y }) => `${x}, ${y}`).join("\n");
}

/**
 * The typed points, or nothing. A line that is not exactly two finite numbers
 * refuses the whole edit: `Number("")` is 0, so a half-typed point would
 * otherwise collapse a corner onto the origin.
 */
function parsedPoints(text: string): { x: number; y: number }[] | undefined {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  if (lines.length < MIN_POLYLINE_POINTS) return undefined;
  const points = lines.map(parsedPoint);
  return points.some((point) => point === undefined)
    ? undefined
    : (points as { x: number; y: number }[]);
}

function parsedPoint(line: string): { x: number; y: number } | undefined {
  const [x, y, ...rest] = line.split(/[\s,]+/).filter((token) => token !== "");
  if (x === undefined || y === undefined || rest.length > 0) return undefined;
  const point = { x: Number(x), y: Number(y) };
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    ? point
    : undefined;
}

/** The stored commands as the SVG data that produced them, so the field shows
    the author something they can edit rather than Fabric's tuple form. */
function pathDataOf(path: Path): string {
  const commands: unknown = path.get("path");
  if (typeof commands === "string") return commands;
  if (!Array.isArray(commands)) return "";
  return commands
    .filter((command): command is readonly unknown[] => Array.isArray(command))
    .map((command) => command.map(String).join(" "))
    .join(" ");
}

/**
 * The typed data as Fabric's own parser reads it, or nothing.
 *
 * Read through `Path` rather than a second parser, so the commands stored are
 * the ones Fabric would have produced. Refused on two grounds: data it cannot
 * parse comes back empty, and a lone moveto has no extent at all — either would
 * replace a real shape with one nothing can see or select.
 */
function parsedPath(text: string): unknown[] | undefined {
  const parsed = new Path(text);
  const path: unknown = parsed.get("path");
  if (!Array.isArray(path) || path.length === 0) return undefined;
  if (parsed.width === 0 && parsed.height === 0) return undefined;
  return path;
}

interface TextAreaOptions {
  readonly label: string;
  readonly value: string;
  readonly data: string;
  readonly rows?: number;
  readonly invalidMessage?: string;
  readonly onReject?: () => void;
  /** False refuses the edit, so the field is put back to what it held. */
  readonly onCommit: (value: string) => boolean;
}

interface TextArea {
  readonly row: HTMLElement;
  readonly input: HTMLTextAreaElement;
  setValue(value: string): void;
  refuse(restoreTo?: string): void;
}

/**
 * A labelled multi-line field that owns its rejected-edit rollback, as
 * `numberInput` does. A text field is needed twice on this panel — a polyline's
 * points and a path's data are both documents, not numbers — and neither is
 * worth a primitive of its own.
 */
function textArea(options: TextAreaOptions): TextArea {
  let last = options.value;
  const row = document.createElement("div");
  row.className = "vigilia-field";
  const label = document.createElement("label");
  label.htmlFor = `vigilia-shape-${++shapeFieldSeq}`;
  label.textContent = options.label;
  const input = document.createElement("textarea");
  input.id = label.htmlFor;
  input.rows = options.rows ?? 5;
  input.dataset[options.data] = "";
  input.value = last;
  const alert = document.createElement("p");
  alert.setAttribute("role", "alert");
  alert.textContent =
    options.invalidMessage ?? uiCopy.inspectorFields.invalidValue;

  const refuse = (restoreTo = last): void => {
    last = restoreTo;
    input.value = restoreTo;
    if (alert.parentElement === null) row.append(alert);
    options.onReject?.();
  };

  // `change`, never per keystroke: half-typed data is not an edit.
  input.addEventListener("change", () => {
    if (!options.onCommit(input.value)) {
      refuse();
      return;
    }
    last = input.value;
    alert.remove();
  });

  row.append(label, input);
  return {
    row,
    input,
    setValue: (value) => {
      last = value;
      input.value = value;
    },
    refuse,
  };
}

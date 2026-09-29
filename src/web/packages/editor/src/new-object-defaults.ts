import {
  type ChartContent,
  type ChartFamily,
  defaultBarSettings,
  defaultGaugeSettings,
  defaultLineSettings,
  defaultPieSettings,
  type FabricGlobals,
  type TypePreset,
} from "@vigilia/renderer-core";
import {
  type FabricPaintRefs,
  fabricArtboardPaint,
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_TEXT_PROPERTY,
} from "@vigilia/scene-fabric";
import {
  Circle,
  Ellipse,
  type FabricObject,
  type Gradient,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Triangle,
} from "fabric/es";
import { uiCopy } from "./ui-copy.js";

/** Semantic defaults for a new object; generic construction remains editor-owned. */
export interface NewPaintDefaults {
  readonly fill: unknown;
  readonly [VIGILIA_PAINT_PROPERTY]: FabricPaintRefs;
}

export interface NewTextDefaults extends NewPaintDefaults {
  /** What the layer list shows until the author renames it; the id stays the key. */
  readonly name: string;
  /** Placement, so a new object does not straddle the artboard corner. */
  readonly left: number;
  readonly top: number;
  /** Artboard coordinates, as `NewPanelDefaults` already sets them, so the
      inspector's X and Y are the text's own edges rather than its middle. */
  readonly originX: "left";
  readonly originY: "top";
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight?: string | number;
  readonly lineHeight?: number;
  readonly [VIGILIA_TEXT_PROPERTY]: {
    readonly runs: readonly [
      {
        readonly kind: "literal";
        readonly text: string;
        readonly typePreset: `typePresets.${string}`;
        readonly style: {
          readonly color: { readonly ref: `palette.${string}` };
        };
      },
    ];
  };
}

/** Where a new object is placed, inset from the artboard corner. */
export const NEW_OBJECT_INSET = 40;

/**
 * What a newly inserted object is called until the author renames it: the label
 * of the control that made it. The Add pane already spells every object, so
 * reusing those words is the naming this repo has — and a new object that
 * arrived as a bare uuid would leave the layer list unreadable from the first
 * click, with nothing to tell two panels apart.
 *
 * Every kind the Add pane can insert is covered. A shape excluded here would
 * not fall back to its id but to the panel name, so an ellipse would be listed
 * as a Panel — a second object wearing the first one's name is worse than no
 * name at all.
 */
export function newObjectName(
  kind: "panel" | "text" | ChartFamily | ShapeKind,
): string {
  if (kind === "text") return uiCopy.panels.text;
  if (kind === "panel") return uiCopy.panels.panel;
  if (kind in uiCopy.chartFamilies) {
    return uiCopy.chartFamilies[kind as ChartFamily];
  }
  return uiCopy.shapeKinds[kind as ShapeKind];
}

/** A new panel's size in whole artboard units: a card, not a full artboard. */
export const NEW_PANEL_SIZE = { width: 360, height: 200 } as const;

/**
 * A new panel's corner radius, measured off the reference theme rather than
 * chosen: its card border first appears 10px in from the top-left corner on
 * both axes.
 */
export const NEW_PANEL_RADIUS = 10;

export interface NewPanelDefaults extends NewPaintDefaults {
  /** Narrowed from `NewPaintDefaults`, so a panel goes straight into Fabric's
      own `Rect` constructor without a cast at the call site. */
  readonly fill: string | Gradient<"linear">;
  /** What the layer list shows until the author renames it; the id stays the key. */
  readonly name: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly rx: number;
  readonly ry: number;
  /** Artboard coordinates, so the inspector's X and Y are the panel's edges. */
  readonly originX: "left";
  readonly originY: "top";
}

/** Artboard coordinates, so the inspector's X and Y are the shape's edges. */
const PLACED = {
  left: NEW_OBJECT_INSET,
  top: NEW_OBJECT_INSET,
  originX: "left",
  originY: "top",
} as const;

/**
 * The surface a new shape is filled with, and where it lands. One rule for
 * every kind: a shape an author draws a card on must be as legible as a panel.
 */
function newShapeSurface(
  globals: FabricGlobals | undefined,
): Omit<NewPanelDefaults, "width" | "height" | "rx" | "ry" | "name"> {
  const [id, entry] = surfacePalette(globals, "shape", CARD_SURFACE_TOKENS);
  const fill = fabricArtboardPaint(
    entry.value,
    NEW_PANEL_SIZE.width,
    NEW_PANEL_SIZE.height,
  );

  if (fill === undefined)
    throw new Error(`Palette token "palette.${id}" cannot paint a new shape.`);

  return {
    ...PLACED,
    fill,
    [VIGILIA_PAINT_PROPERTY]: { fill: `palette.${id}` },
  };
}

/** Supplies a surface-backed, sized, rounded placement for a new panel. */
export function createNewPanelDefaults(
  globals: FabricGlobals | undefined,
): NewPanelDefaults {
  return {
    ...newShapeSurface(globals),
    name: newObjectName("panel"),
    width: NEW_PANEL_SIZE.width,
    height: NEW_PANEL_SIZE.height,
    rx: NEW_PANEL_RADIUS,
    ry: NEW_PANEL_RADIUS,
  };
}

/**
 * The primitive shapes Fabric 7 ships, in the order the Add pane offers them.
 * One list: the pane's buttons, the geometry below and the inspector's own
 * fields all read it, so a shape is never described in two places.
 */
export const SHAPE_KINDS = [
  "rect",
  "circle",
  "ellipse",
  "triangle",
  "polygon",
  "polyline",
  "line",
  "path",
] as const;

export type ShapeKind = (typeof SHAPE_KINDS)[number];

/**
 * A stroke wide enough to read at artboard scale, and the round caps and joins
 * an open shape's corners need: a miter on a sharp polyline runs a long spike
 * past the point the author placed.
 */
const NEW_SHAPE_STROKE_WIDTH = 2;

/**
 * An open shape is stroked rather than filled — a polyline, a line and a path
 * are what they are drawn with — so it takes a content token, which is the
 * palette's own answer to "a colour visible against the surface".
 */
function newShapeStroke(globals: FabricGlobals | undefined): {
  readonly fill: null;
  readonly stroke: string | Gradient<"linear">;
  readonly strokeWidth: number;
  readonly strokeLineCap: "round";
  readonly strokeLineJoin: "round";
  readonly [VIGILIA_PAINT_PROPERTY]: { readonly stroke: `palette.${string}` };
} & typeof PLACED {
  const [id, entry] = firstPalette(globals);
  const stroke = fabricArtboardPaint(entry.value, 1, 1);

  if (stroke === undefined)
    throw new Error(`Palette token "palette.${id}" cannot paint a new shape.`);

  return {
    ...PLACED,
    fill: null,
    stroke,
    strokeWidth: NEW_SHAPE_STROKE_WIDTH,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    [VIGILIA_PAINT_PROPERTY]: { stroke: `palette.${id}` },
  };
}

/**
 * A hexagon rather than a triangle: a triangle has its own entry, and three is
 * the one side count that cannot show what the side-count field does.
 */
export const NEW_POLYGON_SIDES = 6;

/**
 * Evenly spaced corners around a box, scaled to fill it.
 *
 * The one place a shape is described by something other than its points: Fabric
 * 7 dropped `numPoints`, so the count an author edits is recomputed into the
 * corners the scene actually stores — the same thing Fabric 5 did, and the
 * points remain the only persisted truth. Filling the box rather than inscribing
 * a circle in it is what keeps the side count from silently resizing a shape
 * whose width and height the author already set.
 */
export function cornersForSides(
  sides: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const unit = Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / sides;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  // An even spread never reaches the unit circle on both axes, so each is
  // stretched to the box: a hexagon with a corner at the top is otherwise
  // 86.6 % of the width the author set.
  const reachX = width / (2 * Math.max(...unit.map(({ x }) => Math.abs(x))));
  const reachY = height / (2 * Math.max(...unit.map(({ y }) => Math.abs(y))));
  return unit.map(({ x, y }) => ({
    x: width / 2 + x * reachX,
    y: height / 2 + y * reachY,
  }));
}

/** An open line across the new-shape box, rising left to right. */
const NEW_POLYLINE_POINTS = [
  { x: 0, y: NEW_PANEL_SIZE.height },
  { x: NEW_PANEL_SIZE.width / 3, y: NEW_PANEL_SIZE.height / 3 },
  { x: (NEW_PANEL_SIZE.width * 2) / 3, y: (NEW_PANEL_SIZE.height * 2) / 3 },
  { x: NEW_PANEL_SIZE.width, y: 0 },
];

/**
 * An arrow, as the SVG data a path is authored in. A path is arbitrary data, so
 * its default is the one shape here that no other entry draws and whose own
 * field is visibly worth editing.
 */
const NEW_PATH = `M 0 ${NEW_PANEL_SIZE.height / 2} L ${NEW_PANEL_SIZE.width / 2} ${NEW_PANEL_SIZE.height / 2} L ${NEW_PANEL_SIZE.width / 2} ${NEW_PANEL_SIZE.height / 4} L ${NEW_PANEL_SIZE.width} ${NEW_PANEL_SIZE.height / 2} L ${NEW_PANEL_SIZE.width / 2} ${(NEW_PANEL_SIZE.height * 3) / 4} L ${NEW_PANEL_SIZE.width / 2} ${NEW_PANEL_SIZE.height} L 0 ${NEW_PANEL_SIZE.height / 2} Z`;

/**
 * Constructs one new shape.
 *
 * The class lives here rather than at the click site because Fabric takes a
 * polygon's points, a line's endpoints and a path's commands as constructor
 * arguments, not as options: eight option bags would be eight wrong calls. Where
 * the object lands and how the edit is recorded stay with the editor.
 */
export function createNewShape(
  id: string,
  globals: FabricGlobals | undefined,
  kind: ShapeKind,
): FabricObject {
  const { width, height } = NEW_PANEL_SIZE;
  // Beside the id in every branch: a shape the author inserted must be as
  // nameable as a text object, and an unnamed one is listed by its uuid.
  const name = newObjectName(kind);

  switch (kind) {
    case "rect":
      // The panel defaults carry the panel's own name, so this one's wins.
      return new Rect({ id, ...createNewPanelDefaults(globals), name });
    case "circle":
      return new Circle({
        id,
        name,
        ...newShapeSurface(globals),
        radius: height / 2,
      });
    case "ellipse":
      return new Ellipse({
        id,
        name,
        ...newShapeSurface(globals),
        rx: width / 2,
        ry: height / 2,
      });
    case "triangle":
      return new Triangle({
        id,
        name,
        ...newShapeSurface(globals),
        width,
        height,
      });
    case "polygon": {
      // A value rather than a fresh literal: Fabric infers its options type
      // from one, and the inferred type has no room for the authored `id`.
      const options = { id, name, ...newShapeSurface(globals) };
      return new Polygon(
        cornersForSides(NEW_POLYGON_SIDES, width, height),
        options,
      );
    }
    case "polyline":
      return new Polyline(NEW_POLYLINE_POINTS, {
        id,
        name,
        ...newShapeStroke(globals),
      });
    case "line":
      return new Line([0, 0, width, height], {
        id,
        name,
        ...newShapeStroke(globals),
      });
    case "path":
      return new Path(NEW_PATH, { id, name, ...newShapeSurface(globals) });
  }
}

/** Supplies valid authored references without making defaults document state. */
export function createNewPaintDefaults(
  globals: FabricGlobals | undefined,
): NewPaintDefaults {
  const [id, entry] = firstPalette(globals);
  const ref = `palette.${id}` as const;
  const fill = fabricArtboardPaint(entry.value, 1, 1);

  if (fill === undefined)
    throw new Error(`Palette token "${ref}" cannot paint a new object.`);

  return { fill, [VIGILIA_PAINT_PROPERTY]: { fill: ref } };
}

/** Supplies the paint and per-run typography required by a new text object. */
export function createNewTextDefaults(
  globals: FabricGlobals | undefined,
  text: string,
): NewTextDefaults {
  const paint = createNewPaintDefaults(globals);
  const [id, preset] = firstTypePreset(globals);
  const typePreset = `typePresets.${id}` as const;
  const color = paint[VIGILIA_PAINT_PROPERTY].fill;

  if (color === undefined)
    throw new Error("New text requires a palette reference.");

  return {
    ...paint,
    name: newObjectName("text"),
    // Fabric's own default is (0,0), which puts a new object on the artboard
    // corner where it is awkward to select. Charts already start inset; text
    // must too.
    left: NEW_OBJECT_INSET,
    top: NEW_OBJECT_INSET,
    originX: "left",
    originY: "top",
    fontFamily: preset.family,
    fontSize: preset.size,
    ...(preset.weight === undefined ? {} : { fontWeight: preset.weight }),
    ...(preset.lineHeight === undefined
      ? {}
      : { lineHeight: preset.lineHeight }),
    [VIGILIA_TEXT_PROPERTY]: {
      runs: [
        { kind: "literal", text, typePreset, style: { color: { ref: color } } },
      ],
    },
  };
}

/** Supplies token-backed chart settings without making defaults document state. */
export function createNewChartDefaults(
  globals: FabricGlobals | undefined,
  family: "gauge",
): Extract<ChartContent, { readonly family: "gauge" }>["settings"];
export function createNewChartDefaults(
  globals: FabricGlobals | undefined,
  family: "line",
): Extract<ChartContent, { readonly family: "line" }>["settings"];
export function createNewChartDefaults(
  globals: FabricGlobals | undefined,
  family: "bar",
): Extract<ChartContent, { readonly family: "bar" }>["settings"];
export function createNewChartDefaults(
  globals: FabricGlobals | undefined,
  family: "pie",
): Extract<ChartContent, { readonly family: "pie" }>["settings"];
export function createNewChartDefaults(
  globals: FabricGlobals | undefined,
  family: ChartFamily,
): ChartContent["settings"];
export function createNewChartDefaults(
  globals: FabricGlobals | undefined,
  family: ChartFamily,
): ChartContent["settings"] {
  const paint = createNewPaintDefaults(globals)[VIGILIA_PAINT_PROPERTY].fill;
  const surface = surfacePalette(globals, "chart", SURFACE_TOKENS);

  if (paint === undefined) {
    throw new Error("New charts require a palette reference.");
  }

  // A chart needs both: content (its data) and a surface (its track). Using the
  // content token for the track would paint the background in the data colour.
  const ref = { ref: paint } as const;
  const surfaceRef = { ref: `palette.${surface[0]}` } as const;

  switch (family) {
    case "gauge":
      return { ...defaultGaugeSettings, track: surfaceRef, progress: ref };
    case "line": {
      const { area: _area, ...settings } = defaultLineSettings;
      return { ...settings, stroke: ref, palette: [ref] };
    }
    case "bar":
      return { ...defaultBarSettings, fill: ref, track: surfaceRef };
    case "pie":
      return {
        ...defaultPieSettings,
        palette: [ref],
        remainderFill: surfaceRef,
      };
  }
}

/**
 * The token a new object is painted with. Not simply the first entry: a palette
 * conventionally starts with its background and letterbox colours, so taking
 * the first one paints new content in the canvas colour — invisible, and
 * therefore impossible to select or edit.
 *
 * A token named for content is preferred, then one that is not a known
 * surface, then anything that is not the transparent fallback.
 */
const CONTENT_TOKENS = ["text", "ink", "foreground", "primary", "accent"];
/** `charttrack` is here because a palette that has it was naming that job: the
    token exists to be a chart's track. Without it, a palette whose only surface
    is `chartTrack` falls through to the first entry — which for the blank
    theme's palette is `text` — and a new gauge arrives with its track painted
    in the colour of its own data, so it draws nothing. The lookup lowercases
    both sides, so the candidate is spelled in lower case. */
const SURFACE_TOKENS = [
  "background",
  "bars",
  "scene",
  "surface",
  "track",
  "charttrack",
];

/** The surfaces a *card* takes, ahead of the scene's own: a shape filled with
    the backdrop is that backdrop again, and nothing an author can select. */
const CARD_SURFACE_TOKENS = ["panel", "frost", ...SURFACE_TOKENS];

/** The token for a surface an object draws on: a chart track, a card fill.
    `what` names the object in the refusal, so a palette-less panel is not told
    it needed a chart. `candidates` is that job's surface vocabulary — a card
    and a chart track are not the same surface, and the caller owns which. */
function surfacePalette(
  globals: FabricGlobals | undefined,
  what: string,
  candidates: readonly string[],
): readonly [string, NonNullable<FabricGlobals["palette"]>[string]] {
  const entries = Object.entries(globals?.palette ?? {}).filter(
    ([id]) => id !== "none",
  );
  const selected =
    candidates
      .map((name) => entries.find(([id]) => id.toLowerCase() === name))
      .find((entry) => entry !== undefined) ?? entries[0];

  if (selected === undefined)
    throw new Error(`A new ${what} requires a palette token.`);
  return selected;
}

function firstPalette(
  globals: FabricGlobals | undefined,
): readonly [string, NonNullable<FabricGlobals["palette"]>[string]] {
  const entries = Object.entries(globals?.palette ?? {}).filter(
    ([id]) => id !== "none",
  );

  const selected =
    CONTENT_TOKENS.map((name) =>
      entries.find(([id]) => id.toLowerCase() === name),
    ).find((entry) => entry !== undefined) ??
    entries.find(([id]) => !SURFACE_TOKENS.includes(id.toLowerCase())) ??
    entries[0];

  if (selected === undefined)
    throw new Error("New objects require a palette token.");
  return selected;
}

/**
 * The preset a new text object uses. Not simply the first entry: presets are
 * conventionally ordered smallest first, so the first is usually a caption too
 * small to inspect comfortably.
 *
 * A body-role preset is preferred, the largest of them, with the largest
 * remaining preset as the fallback. Heading presets are excluded: a 70px clock
 * face is not a sensible default for a fresh text object.
 */
function firstTypePreset(
  globals: FabricGlobals | undefined,
): readonly [string, TypePreset] {
  let body: readonly [string, TypePreset] | undefined;
  let largest: readonly [string, TypePreset] | undefined;

  for (const [id, entry] of Object.entries(globals?.typePresets ?? {})) {
    if (!isTypePreset(entry.value)) continue;

    if (largest === undefined || entry.value.size > largest[1].size) {
      largest = [id, entry.value];
    }

    if (entry.value.trioRole !== "body") continue;

    if (body === undefined || entry.value.size > body[1].size) {
      body = [id, entry.value];
    }
  }

  const chosen = body ?? largest;

  if (chosen === undefined) {
    throw new Error("New text requires a type preset.");
  }

  return chosen;
}

function isTypePreset(value: unknown): value is TypePreset {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)["family"] === "string" &&
    typeof (value as Record<string, unknown>)["size"] === "number"
  );
}

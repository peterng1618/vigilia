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

/** Semantic defaults for a new object; generic construction remains editor-owned. */
export interface NewPaintDefaults {
  readonly fill: unknown;
  readonly [VIGILIA_PAINT_PROPERTY]: FabricPaintRefs;
}

export interface NewTextDefaults extends NewPaintDefaults {
  /** Placement, so a new object does not straddle the artboard corner. */
  readonly left: number;
  readonly top: number;
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
    // Fabric's own default is (0,0) with a centre origin, which puts a new
    // object half off the artboard corner where it is awkward to select. Charts
    // already start inset; text must too.
    left: NEW_OBJECT_INSET,
    top: NEW_OBJECT_INSET,
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
  const surface = surfacePalette(globals);

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
const SURFACE_TOKENS = ["background", "bars", "scene", "surface", "track"];

/** The token for a surface a chart draws on, such as its track. */
function surfacePalette(
  globals: FabricGlobals | undefined,
): readonly [string, NonNullable<FabricGlobals["palette"]>[string]] {
  const entries = Object.entries(globals?.palette ?? {}).filter(
    ([id]) => id !== "none",
  );
  const selected =
    SURFACE_TOKENS.map((name) =>
      entries.find(([id]) => id.toLowerCase() === name),
    ).find((entry) => entry !== undefined) ?? entries[0];

  if (selected === undefined)
    throw new Error("New charts require a palette token.");
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

function firstTypePreset(
  globals: FabricGlobals | undefined,
): readonly [string, TypePreset] {
  for (const [id, entry] of Object.entries(globals?.typePresets ?? {})) {
    if (isTypePreset(entry.value)) return [id, entry.value];
  }
  throw new Error("New text requires a type preset.");
}

function isTypePreset(value: unknown): value is TypePreset {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)["family"] === "string" &&
    typeof (value as Record<string, unknown>)["size"] === "number"
  );
}

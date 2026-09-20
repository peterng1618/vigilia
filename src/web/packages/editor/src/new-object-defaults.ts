import {
  defaultBarSettings,
  defaultGaugeSettings,
  defaultLineSettings,
  defaultPieSettings,
  type ChartContent,
  type ChartFamily,
  type FabricGlobals,
  type TypePreset,
} from "@vigilia/renderer-core";
import {
  fabricArtboardPaint,
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_TEXT_PROPERTY,
  type FabricPaintRefs,
} from "@vigilia/scene-fabric";

/** Semantic defaults for a fork-created object; generic construction remains fork-owned. */
export interface NewPaintDefaults {
  readonly fill: unknown;
  readonly [VIGILIA_PAINT_PROPERTY]: FabricPaintRefs;
}

export interface NewTextDefaults extends NewPaintDefaults {
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

/** Supplies the paint and per-run typography required by a new fork text object. */
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
  family: ChartFamily,
): ChartContent["settings"] {
  const paint = createNewPaintDefaults(globals)[VIGILIA_PAINT_PROPERTY].fill;

  if (paint === undefined) {
    throw new Error("New charts require a palette reference.");
  }

  const ref = { ref: paint } as const;

  switch (family) {
    case "gauge":
      return { ...defaultGaugeSettings, track: ref, progress: ref };
    case "line": {
      const { area: _area, ...settings } = defaultLineSettings;
      return { ...settings, stroke: ref, palette: [ref] };
    }
    case "bar":
      return { ...defaultBarSettings, fill: ref, track: ref };
    case "pie":
      return { ...defaultPieSettings, palette: [ref], remainderFill: ref };
  }
}

function firstPalette(
  globals: FabricGlobals | undefined,
): readonly [string, NonNullable<FabricGlobals["palette"]>[string]] {
  const entries = Object.entries(globals?.palette ?? {});
  const selected =
    entries.find(([id]) => id !== "none") ??
    entries.find(([id]) => id === "none");
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

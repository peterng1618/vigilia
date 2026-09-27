import type { FabricPalette } from "@vigilia/renderer-core";

/**
 * The starter theme's palette, type presets and the two lookups the scene
 * helpers need from them.
 *
 * Its own module because `new-fabric-theme.ts` had reached 874 lines against
 * `AGENTS.md`'s 800-line stop, and the globals are a separable responsibility:
 * they are the document's vocabulary, and every object in the scene is written
 * against them rather than against the scene body.
 */

export const text = "#ecf5ff";
export const dim = "#a8bed0";
export const panel = "#081523d9";

export const starterPalette = {
  none: { name: "None", value: { kind: "solid", color: "transparent" } },
  background: {
    name: "Background",
    value: { kind: "solid", color: "#0c0e13" },
  },
  bars: { name: "Letterbox bars", value: { kind: "solid", color: "#000000" } },
  scene: {
    name: "Scene background",
    value: {
      kind: "gradient",
      angle: 90,
      stops: [
        { offset: 0, color: "#355473" },
        { offset: 0.42, color: "#16283d" },
        { offset: 1, color: "#07111d" },
      ],
    },
  },
  headerWash: {
    name: "Header wash",
    value: { kind: "solid", color: "#06101a70" },
  },
  text: { name: "Text", value: { kind: "solid", color: text } },
  dim: { name: "Muted text", value: { kind: "solid", color: dim } },
  panel: { name: "Panel", value: { kind: "solid", color: panel } },
  panelStroke: {
    name: "Panel outline",
    value: { kind: "solid", color: "#9fc7e52b" },
  },
  cyan: { name: "Cyan", value: { kind: "solid", color: "#7dbde0" } },
  cyanMuted: {
    name: "Muted cyan",
    value: { kind: "solid", color: "#7dbde044" },
  },
  lightCyan: { name: "Light cyan", value: { kind: "solid", color: "#82c8e9" } },
  iconBlue: { name: "Icon blue", value: { kind: "solid", color: "#7ec7f0" } },
  cloud: { name: "Cloud", value: { kind: "solid", color: "#b9d7f2" } },
  pin: { name: "Location pin", value: { kind: "solid", color: "#8fc6e6" } },
  purple: { name: "Purple", value: { kind: "solid", color: "#a98bff" } },
  green: { name: "Green", value: { kind: "solid", color: "#71e7c1" } },
  gold: { name: "Gold", value: { kind: "solid", color: "#f3c879" } },
  signal: { name: "Signal", value: { kind: "solid", color: "#6ee1c0" } },
  status: { name: "Status", value: { kind: "solid", color: "#48d9b0" } },
  chartTrack: {
    name: "Chart track",
    value: { kind: "solid", color: "#2a2f3a" },
  },
  chartBlue: { name: "Chart blue", value: { kind: "solid", color: "#4db8ff" } },
  chartPurple: {
    name: "Chart purple",
    value: { kind: "solid", color: "#ae7cff" },
  },
  gaugeProgress: {
    name: "Gauge progress",
    value: {
      kind: "gradient",
      angle: 0,
      stops: [
        { offset: 0, color: "#41b8ff" },
        { offset: 1, color: "#bc75ff" },
      ],
    },
  },
  trendArea: {
    name: "Trend area",
    value: {
      kind: "gradient",
      angle: 90,
      stops: [
        { offset: 0, color: "#4db8ff66" },
        { offset: 1, color: "#4db8ff00" },
      ],
    },
  },
  thermalFill: {
    name: "Thermal fill",
    value: {
      kind: "gradient",
      angle: 0,
      stops: [
        { offset: 0, color: "#48d9b0" },
        { offset: 1, color: "#f3bb68" },
      ],
    },
  },
  thermalTrack: {
    name: "Thermal track",
    value: { kind: "solid", color: "#183145" },
  },
} as const satisfies FabricPalette;

export type StarterPaletteId = keyof typeof starterPalette;

const paletteIds: Readonly<Record<string, StarterPaletteId>> = {
  [text]: "text",
  [dim]: "dim",
  [panel]: "panel",
  "#06101a70": "headerWash",
  "#9fc7e52b": "panelStroke",
  "#7dbde0": "cyan",
  "#7dbde044": "cyanMuted",
  "#82c8e9": "lightCyan",
  "#7ec7f0": "iconBlue",
  "#b9d7f2": "cloud",
  "#8fc6e6": "pin",
  "#a98bff": "purple",
  "#71e7c1": "green",
  "#f3c879": "gold",
  "#6ee1c0": "signal",
  "#48d9b0": "status",
};

export const starterTypePresets = {
  "11-400": {
    name: "Caption",
    value: {
      family: "Segoe UI, sans-serif",
      size: 11,
      weight: "400",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "11-500": {
    name: "Caption medium",
    value: {
      family: "Segoe UI, sans-serif",
      size: 11,
      weight: "500",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "12-400": {
    name: "Overline",
    value: {
      family: "Segoe UI, sans-serif",
      size: 12,
      weight: "400",
      // Measured off the reference: 6.5px at 12px is 0.54 em, and the ink gap
      // between letters divided by cap height came out at 0.75 there.
      letterSpacing: 6.5,
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "13-400": {
    name: "Body small",
    value: {
      family: "Segoe UI, sans-serif",
      size: 13,
      weight: "400",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "13-600": {
    name: "Section label",
    value: {
      family: "Segoe UI, sans-serif",
      size: 13,
      weight: "600",
      // Untracked, and deliberately so. The reference theme has no all-caps
      // section label — its card titles are sentence case — so there is nothing
      // there to measure a value against, and any number here would be invented.
      // Tracked, it also overflows: 7px wraps all five of these labels onto a
      // second line inside boxes sized for one. Task 7 recomposes these titles
      // to the reference's sentence case.
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "14-400": {
    name: "Body",
    value: {
      family: "Segoe UI, sans-serif",
      size: 14,
      weight: "400",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "15-400": {
    name: "Body large",
    value: {
      family: "Segoe UI, sans-serif",
      size: 15,
      weight: "400",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "16-400": {
    name: "Date",
    value: {
      family: "Segoe UI, sans-serif",
      size: 16,
      weight: "400",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "17-500": {
    name: "Period",
    value: {
      family: "Segoe UI, sans-serif",
      size: 17,
      weight: "500",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "32-500": {
    name: "Wordmark",
    value: {
      family: "Segoe UI, sans-serif",
      size: 32,
      weight: "500",
      // Measured off the reference, not judged by eye: the six inter-letter
      // gaps average 94px against a 78px cap height — a ratio of 1.205, and
      // uniform across every pair, which is tracking rather than side bearings.
      // At a 0.72 em cap height that is 0.87 em, so 28px here.
      letterSpacing: 28,
      lineHeight: 1.18,
      trioRole: "heading",
    },
  },
  "36-600": {
    name: "Metric",
    value: {
      family: "Segoe UI, sans-serif",
      size: 36,
      weight: "600",
      lineHeight: 1.18,
      trioRole: "heading",
    },
  },
  "70-300": {
    name: "Clock",
    value: {
      family: "Segoe UI, sans-serif",
      size: 70,
      weight: "300",
      // Untracked, and so are the metric, date and period above: a numeral's
      // advance is a grid cell, and opening it up breaks the column.
      lineHeight: 1.18,
      trioRole: "heading",
    },
  },
  "72-600": {
    name: "Reading",
    value: {
      family: "Segoe UI, sans-serif",
      // Measured off the reference's CPU card rather than chosen: its "32"
      // occupies 68 rows of the 1672-wide target, which at a 0.72 em figure
      // height is a 94px face, and 1280/1672 of that is 72 here.
      size: 72,
      weight: "600",
      // Untracked, for the reason the clock above gives.
      lineHeight: 1.18,
      trioRole: "heading",
    },
  },
  mono: {
    name: "Mono",
    value: {
      family: "Segoe UI, sans-serif",
      size: 14,
      weight: "400",
      lineHeight: 1.18,
      trioRole: "mono",
    },
  },
} as const;

/** Fabric's `charSpacing` in 1/1000 em, for the presets that track. */
export function charSpacingPx(
  presetId: string,
  fontSize: number,
): number | undefined {
  // `as const` gives each preset its own literal type, and the untracked ones
  // have no `letterSpacing` key at all, so the lookup is widened to read one.
  const value = (
    starterTypePresets[presetId as keyof typeof starterTypePresets]?.value as
      | { readonly letterSpacing?: number }
      | undefined
  )?.letterSpacing;
  return typeof value === "number" ? (value / fontSize) * 1000 : undefined;
}

export function paletteIdFor(value: unknown): StarterPaletteId {
  if (typeof value === "string" && paletteIds[value] !== undefined)
    return paletteIds[value];
  throw new Error(
    `Starter scene paint "${String(value)}" has no palette token.`,
  );
}

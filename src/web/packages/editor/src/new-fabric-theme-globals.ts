import type { FabricPalette } from "@vigilia/renderer-core";

/**
 * The starter theme's palette, type presets and the two lookups the scene
 * helpers need from them.
 *
 * Its own module because `new-fabric-theme.ts` outgrew `AGENTS.md`'s 800-line
 * stop, and the globals are a separable responsibility: they are the document's
 * vocabulary, and every object in the scene is written against them rather than
 * against the scene body.
 */

export const panel = "#081523d9";

/** One colour per device family, so a card's reading and its icon cannot drift apart. */

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
  text: { name: "Text", value: { kind: "solid", color: "#ecf5ff" } },
  dim: { name: "Muted text", value: { kind: "solid", color: "#a8bed0" } },
  panel: { name: "Panel", value: { kind: "solid", color: "#081523d9" } },
  panelStroke: {
    name: "Panel outline",
    value: { kind: "solid", color: "#9fc7e52b" },
  },
  rule: { name: "Rule", value: { kind: "solid", color: "#7dbde0" } },
  cpu: { name: "CPU", value: { kind: "solid", color: "#4da3ff" } },
  gpu: { name: "GPU", value: { kind: "solid", color: "#a98bff" } },
  ram: { name: "RAM", value: { kind: "solid", color: "#2ee6a8" } },
  vram: { name: "VRAM", value: { kind: "solid", color: "#c964e8" } },
  down: { name: "Download", value: { kind: "solid", color: "#22d3ee" } },
  chartTrack: {
    name: "Chart track",
    value: { kind: "solid", color: "#223047" },
  },
  sparkArea: {
    name: "Sparkline area",
    value: {
      kind: "gradient",
      angle: 90,
      stops: [
        { offset: 0, color: "#4da3ff66" },
        { offset: 1, color: "#4da3ff00" },
      ],
    },
  },
  storageFill: {
    name: "Storage fill",
    value: {
      kind: "gradient",
      angle: 0,
      stops: [
        { offset: 0, color: "#3f7fe0" },
        { offset: 1, color: "#5ea2ff" },
      ],
    },
  },
} as const satisfies FabricPalette;

export type StarterPaletteId = keyof typeof starterPalette;

/**
 * The solid colour behind each token, for the Fabric fields a scene object also
 * writes beside its `vigiliaPaint` reference.
 *
 * A v2 object carries the resolved colour *and* the reference, so the reference
 * is the thing that has to be right; this is the resolved half, read from the
 * same token rather than restated at every call site.
 */
export const solidOf: Readonly<Record<string, string>> = {
  text: "#ecf5ff",
  dim: "#a8bed0",
  panel: "#081523d9",
  rule: "#7dbde0",
  cpu: "#4da3ff",
  gpu: "#a98bff",
  ram: "#2ee6a8",
  vram: "#c964e8",
  down: "#22d3ee",
  chartTrack: "#223047",
};

export const starterTypePresets = {
  // Body first: `createNewTextDefaults` and the chart defaults take the first
  // preset as a new object's, so the order here is the editor's default face.
  "20-400": {
    name: "Caption",
    value: {
      family: "Segoe UI, sans-serif",
      size: 20,
      weight: "400",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "17-400": {
    name: "Overline",
    value: {
      family: "Segoe UI, sans-serif",
      size: 17,
      weight: "400",
      // Measured off the reference's "SYSTEM INSIGHTS": the six glyph advances
      // across "SYSTEM" run 16px apart at a 12px cap height, which is 0.29 em of
      // the 17px face once the letter's own advance is taken out.
      letterSpacing: 6,
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "20-500": {
    name: "Rate",
    value: {
      family: "Segoe UI, sans-serif",
      size: 20,
      weight: "500",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "24-400": {
    name: "Card title",
    value: {
      family: "Segoe UI, sans-serif",
      size: 24,
      weight: "400",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "24-500": {
    name: "Period",
    value: {
      family: "Segoe UI, sans-serif",
      size: 24,
      weight: "500",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "32-400": {
    name: "Date",
    value: {
      family: "Segoe UI, sans-serif",
      size: 32,
      weight: "400",
      lineHeight: 1.18,
      trioRole: "body",
    },
  },
  "36-500": {
    name: "Wordmark",
    value: {
      family: "Segoe UI, sans-serif",
      size: 36,
      weight: "500",
      // Measured off the reference, not judged by eye: the glyphs of "VIGILIA"
      // stand 26px cap height and the five advances between them average 45px
      // at a 36px face, which is 0.78 em once each letter's own advance is out.
      letterSpacing: 28,
      lineHeight: 1.18,
      trioRole: "heading",
    },
  },
  "44-600": {
    name: "Share",
    value: {
      family: "Segoe UI, sans-serif",
      size: 44,
      weight: "600",
      lineHeight: 1.18,
      trioRole: "heading",
    },
  },
  "46-600": {
    name: "Ring unit",
    value: {
      family: "Segoe UI, sans-serif",
      size: 46,
      weight: "600",
      lineHeight: 1.18,
      trioRole: "heading",
    },
  },
  "60-600": {
    name: "Ring reading",
    value: {
      family: "Segoe UI, sans-serif",
      size: 60,
      weight: "600",
      lineHeight: 1.18,
      trioRole: "heading",
    },
  },
  "90-600": {
    name: "Card reading",
    value: {
      family: "Segoe UI, sans-serif",
      size: 90,
      weight: "600",
      // Untracked, for the reason the clock below gives.
      lineHeight: 1.18,
      trioRole: "heading",
    },
  },
  "108-300": {
    name: "Clock",
    value: {
      family: "Segoe UI, sans-serif",
      size: 108,
      weight: "300",
      // Untracked, and so is every reading: a numeral's advance is a grid cell,
      // and opening it up breaks the column it sits in.
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

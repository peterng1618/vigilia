/** Artboard sizes, derived from a ratio, an orientation and a resolution.
    A new document picks one; a document with a size the presets cannot name
    keeps it, because the numeric fields are the same fields (§ artboard panel). */

export type ArtboardRatioId = "16:9" | "19.5:9" | "4:3";
export type ArtboardResolutionId = "1080p" | "2k" | "4k";
export type ArtboardOrientation = "landscape" | "portrait";

export interface ArtboardSize {
  readonly width: number;
  readonly height: number;
}

export const ARTBOARD_RATIOS: ReadonlyArray<{
  readonly id: ArtboardRatioId;
  readonly ratio: number;
}> = [
  { id: "16:9", ratio: 16 / 9 },
  { id: "19.5:9", ratio: 19.5 / 9 },
  { id: "4:3", ratio: 4 / 3 },
];

/** A resolution names the **short** edge — 19.5:9 at 1080p is 2340 × 1080, not
    1080 × 585 — so every ratio at one resolution shares a short edge and the
    long edge is the ratio's work. */
export const ARTBOARD_RESOLUTIONS: ReadonlyArray<{
  readonly id: ArtboardResolutionId;
  readonly shortEdge: number;
}> = [
  { id: "1080p", shortEdge: 1080 },
  { id: "2k", shortEdge: 1440 },
  { id: "4k", shortEdge: 2160 },
];

export const ARTBOARD_ORIENTATIONS: ReadonlyArray<ArtboardOrientation> = [
  "landscape",
  "portrait",
];

/** The one a new document opens on: the ratio and resolution a wall display is
    measured in, and the orientation a wall is hung. */
export const DEFAULT_ARTBOARD_PRESET = {
  ratio: "16:9",
  resolution: "1080p",
  orientation: "landscape",
} as const satisfies {
  ratio: ArtboardRatioId;
  resolution: ArtboardResolutionId;
  orientation: ArtboardOrientation;
};

export interface ArtboardPresetChoice {
  readonly ratio: ArtboardRatioId;
  readonly resolution: ArtboardResolutionId;
  readonly orientation: ArtboardOrientation;
}

/** Portrait is landscape with the two edges swapped, so one number per entry
    covers both and the two orientations cannot drift apart. */
export function artboardSize(
  ratio: ArtboardRatioId,
  resolution: ArtboardResolutionId,
  orientation: ArtboardOrientation,
): ArtboardSize {
  const shortEdge = ARTBOARD_RESOLUTIONS.find(
    (entry) => entry.id === resolution,
  )?.shortEdge;
  const factor = ARTBOARD_RATIOS.find((entry) => entry.id === ratio)?.ratio;
  if (shortEdge === undefined || factor === undefined) {
    // Refuse rather than default: this is a trust boundary for anything
    // persisting a size, and a silently-defaulted artboard is a document the
    // author did not draw.
    throw new RangeError(`no artboard preset for ${ratio} at ${resolution}`);
  }
  const longEdge = Math.round(shortEdge * factor);
  return orientation === "portrait"
    ? { width: shortEdge, height: longEdge }
    : { width: longEdge, height: shortEdge };
}

/** Every size the presets can name, built once: a panel showing a document
    needs to ask which one it is holding, and that is the owner's question. */
const EVERY_PRESET: ReadonlyArray<ArtboardSize & ArtboardPresetChoice> =
  ARTBOARD_ORIENTATIONS.flatMap((orientation) =>
    ARTBOARD_RESOLUTIONS.flatMap((resolution) =>
      ARTBOARD_RATIOS.map((ratio) => ({
        ...artboardSize(ratio.id, resolution.id, orientation),
        ratio: ratio.id,
        resolution: resolution.id,
        orientation,
      })),
    ),
  );

/** The three ids a size came from, or `undefined` when none of them do — a
    size the author typed, or a hand-edited theme. A caller showing a control
    must not claim a preset the document is not at. */
export function artboardPresetFor(
  size: ArtboardSize,
): ArtboardPresetChoice | undefined {
  const match = EVERY_PRESET.find(
    (preset) => preset.width === size.width && preset.height === size.height,
  );
  if (match === undefined) return undefined;
  return {
    ratio: match.ratio,
    resolution: match.resolution,
    orientation: match.orientation,
  };
}

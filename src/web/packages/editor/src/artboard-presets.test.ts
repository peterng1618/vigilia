import { describe, expect, it } from "vitest";
import {
  ARTBOARD_ORIENTATIONS,
  ARTBOARD_RATIOS,
  ARTBOARD_RESOLUTIONS,
  artboardPresetFor,
  type ArtboardOrientation,
  type ArtboardRatioId,
  type ArtboardResolutionId,
  artboardSize,
} from "./artboard-presets.js";

/** The whole table, in full. The rule here is arithmetic, so the test is the
    rule — a derived entry is worth a line of its own rather than a loop. */
const LANDSCAPE: ReadonlyArray<
  readonly [ArtboardRatioId, ArtboardResolutionId, number, number]
> = [
  ["16:9", "1080p", 1920, 1080],
  ["16:9", "2k", 2560, 1440],
  ["16:9", "4k", 3840, 2160],
  ["19.5:9", "1080p", 2340, 1080],
  ["19.5:9", "2k", 3120, 1440],
  ["19.5:9", "4k", 4680, 2160],
  ["4:3", "1080p", 1440, 1080],
  ["4:3", "2k", 1920, 1440],
  ["4:3", "4k", 2880, 2160],
];

const RATIO_IDS: ReadonlyArray<ArtboardRatioId> = ["16:9", "19.5:9", "4:3"];
const RESOLUTION_IDS: ReadonlyArray<ArtboardResolutionId> = [
  "1080p",
  "2k",
  "4k",
];
const ORIENTATIONS: ReadonlyArray<ArtboardOrientation> = [
  "landscape",
  "portrait",
];

describe("artboard presets", () => {
  it.each(LANDSCAPE)(
    "derives %s landscape at %s as %d x %d",
    (ratio, resolution, width, height) => {
      expect(artboardSize(ratio, resolution, "landscape")).toEqual({
        width,
        height,
      });
    },
  );

  it.each(LANDSCAPE)(
    "derives %s portrait at %s as that row's two numbers swapped",
    (ratio, resolution, width, height) => {
      expect(artboardSize(ratio, resolution, "portrait")).toEqual({
        width: height,
        height: width,
      });
    },
  );

  it("derives every entry as a positive even integer on both edges", () => {
    for (const ratio of RATIO_IDS) {
      for (const resolution of RESOLUTION_IDS) {
        for (const orientation of ORIENTATIONS) {
          const { width, height } = artboardSize(
            ratio,
            resolution,
            orientation,
          );
          const edges = { ratio, resolution, orientation, width, height };
          // An odd artboard is a half-pixel on a panel border.
          for (const edge of [width, height]) {
            expect(Number.isInteger(edge), JSON.stringify(edges)).toBe(true);
            expect(edge % 2, JSON.stringify(edges)).toBe(0);
            expect(edge, JSON.stringify(edges)).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("offers every ratio and resolution it can derive", () => {
    expect(ARTBOARD_RATIOS.map((entry) => entry.id)).toEqual(RATIO_IDS);
    expect(ARTBOARD_RESOLUTIONS.map((entry) => entry.id)).toEqual(
      RESOLUTION_IDS,
    );
    expect(ARTBOARD_ORIENTATIONS).toEqual(ORIENTATIONS);
  });

  it("names a resolution by its short edge, not its long one", () => {
    expect(ARTBOARD_RESOLUTIONS.map((entry) => entry.shortEdge)).toEqual([
      1080, 1440, 2160,
    ]);
  });

  it("refuses an id it does not have, rather than defaulting one", () => {
    // A silently-defaulted artboard is a document the author did not draw.
    expect(() =>
      artboardSize("21:9" as ArtboardRatioId, "1080p", "landscape"),
    ).toThrow(RangeError);
    expect(() =>
      artboardSize("16:9", "8k" as ArtboardResolutionId, "landscape"),
    ).toThrow(RangeError);
  });
});

describe("matching a document's size back to its preset", () => {
  it("names the preset a derived size came from", () => {
    expect(artboardPresetFor({ width: 1920, height: 1080 })).toEqual({
      ratio: "16:9",
      resolution: "1080p",
      orientation: "landscape",
    });
    expect(artboardPresetFor({ width: 1080, height: 2340 })).toEqual({
      ratio: "19.5:9",
      resolution: "1080p",
      orientation: "portrait",
    });
  });

  it("has no answer for a size the author typed", () => {
    expect(artboardPresetFor({ width: 1000, height: 700 })).toBeUndefined();
    expect(artboardPresetFor({ width: 1920, height: 1079 })).toBeUndefined();
  });

  it("derives back to the very size it matched", () => {
    for (const ratio of RATIO_IDS) {
      for (const resolution of RESOLUTION_IDS) {
        for (const orientation of ORIENTATIONS) {
          const size = artboardSize(ratio, resolution, orientation);
          expect(artboardPresetFor(size)).toEqual({
            ratio,
            resolution,
            orientation,
          });
        }
      }
    }
  });
});

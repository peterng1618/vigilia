import { describe, expect, it } from "vitest";
import {
  ARTBOARD_ORIENTATIONS,
  ARTBOARD_RATIOS,
  artboardOrientation,
  artboardSize,
  DEFAULT_ARTBOARD_PRESET,
} from "./artboard-presets.js";
import {
  DEFAULT_DISPLAY_LENS,
  DISPLAY_LENSES,
  displayLens,
  displayLensGroups,
  displayLensIdForShape,
} from "./display-lens.js";

/**
 * The list is `ARTBOARD_RATIOS` × `ARTBOARD_ORIENTATIONS`, not a second one.
 *
 * A lens written here alone is a number nothing else can check it against, and
 * the portrait id is the one place that is easy to get wrong: `9:19.5` is not
 * an `ArtboardRatioId`, so it is the reciprocal of `19.5:9` and has to be
 * derived rather than typed. Both are measured against the owner rather than
 * against a list repeated here.
 */
describe("the display lenses are the presets' shapes, each way up", () => {
  it("is the ratios crossed with the orientations", () => {
    expect(
      DISPLAY_LENSES.map((lens) => [lens.shape.ratio, lens.shape.orientation]),
    ).toEqual(
      ARTBOARD_ORIENTATIONS.flatMap((orientation) =>
        ARTBOARD_RATIOS.map((entry) => [entry.id, orientation]),
      ),
    );
    expect(
      DISPLAY_LENSES.length,
      "a portrait theme is not left with no preview to look through",
    ).toBe(ARTBOARD_RATIOS.length * ARTBOARD_ORIENTATIONS.length);
  });

  it("frames the shape it names, at the aspect the presets build that shape", () => {
    for (const lens of DISPLAY_LENSES) {
      const size = artboardSize(
        lens.shape.ratio,
        "1080p",
        lens.shape.orientation,
      );
      expect(lens.aspect, `${lens.id} frames its own shape`).toBeCloseTo(
        size.width / size.height,
        12,
      );
    }
  });

  it("names a landscape lens by its ratio and a portrait one by the reciprocal", () => {
    // The reciprocal is the wrinkle: a portrait id is not an `ArtboardRatioId`,
    // so it is derived from the landscape one rather than written beside it.
    expect(
      DISPLAY_LENSES.filter(
        (lens) => lens.shape.orientation === "landscape",
      ).map((lens) => lens.id),
    ).toEqual(ARTBOARD_RATIOS.map((entry) => entry.id));

    for (const lens of DISPLAY_LENSES.filter(
      (l) => l.shape.orientation === "portrait",
    )) {
      const [wide, tall] = lens.shape.ratio.split(":");
      expect(lens.id, `${lens.shape.ratio} turned`).toBe(`${tall}:${wide}`);
      expect(
        ARTBOARD_RATIOS.some((entry) => entry.id === lens.id),
        `${lens.id} is deliberately not an ArtboardRatioId`,
      ).toBe(false);
    }
  });

  it("resolves a shape to the lens that frames it", () => {
    for (const lens of DISPLAY_LENSES) {
      expect(displayLensIdForShape(lens.shape)).toBe(lens.id);
      expect(displayLens(lens.id).aspect).toBe(lens.aspect);
    }
  });

  it("still opens on the shape a new theme opens at", () => {
    // The starter is 1672 × 941, which is 16:9. The default is that lens by
    // lookup, so widening the list must not move it to the first entry, nor to
    // whatever entry now sits where the old default was.
    expect(DEFAULT_DISPLAY_LENS).toBe("16:9");
    expect(displayLens(DEFAULT_DISPLAY_LENS).shape).toEqual({
      ratio: DEFAULT_ARTBOARD_PRESET.ratio,
      orientation: DEFAULT_ARTBOARD_PRESET.orientation,
    });
  });
});

describe("the groups lead with the artboard's own orientation", () => {
  it.each([
    { width: 2340, height: 1080 },
    { width: 1080, height: 2340 },
    // A square is not taller than wide, so it takes landscape — the owner's
    // ruling, kept because it keeps the logic to one comparison.
    { width: 1000, height: 1000 },
  ])("leads with %o, and always offers the other half too", (size) => {
    const groups = displayLensGroups(artboardOrientation(size));

    expect(groups[0]?.orientation).toBe(artboardOrientation(size));
    expect(groups).toHaveLength(ARTBOARD_ORIENTATIONS.length);
    // Nothing is filtered out: the previews are what a theme can be *seen*
    // through, not the shapes it may be.
    expect(groups.flatMap((group) => group.lenses)).toHaveLength(
      DISPLAY_LENSES.length,
    );
  });
});

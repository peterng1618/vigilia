import { describe, expect, it } from "vitest";
import { placement } from "./background-media.js";

/**
 * The one placement owner: the DOM layer and the glass sampler both size the
 * media through this function, so these cases pin the arithmetic they share.
 */

const BOX = { width: 200, height: 100 };
const SOURCE = { width: 100, height: 100 };

describe("placement", () => {
  it("covers: max scale, cropped, centred", () => {
    expect(
      placement({
        box: BOX,
        source: SOURCE,
        fit: "cover",
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toEqual({ left: 0, top: -50, width: 200, height: 200 });
  });

  it("contains: min scale, letterboxed, centred", () => {
    expect(
      placement({
        box: BOX,
        source: SOURCE,
        fit: "contain",
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toEqual({ left: 50, top: 0, width: 100, height: 100 });
  });

  it("fills: both axes stretched", () => {
    expect(
      placement({
        box: BOX,
        source: SOURCE,
        fit: "fill",
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toEqual({ left: 0, top: 0, width: 200, height: 100 });
  });

  it("scale multiplies about the box centre", () => {
    expect(
      placement({
        box: BOX,
        source: SOURCE,
        fit: "cover",
        scale: 1.5,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toEqual({ left: -50, top: -100, width: 300, height: 300 });
  });

  it("offset shifts by a fraction of the box", () => {
    expect(
      placement({
        box: BOX,
        source: SOURCE,
        fit: "cover",
        scale: 1.5,
        offsetX: 0.25,
        offsetY: 0,
      }),
    ).toEqual({ left: 0, top: -100, width: 300, height: 300 });
  });

  it("falls back to the box before the source has a size", () => {
    expect(
      placement({
        box: BOX,
        source: undefined,
        fit: "contain",
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toEqual({ left: 0, top: 0, width: 200, height: 100 });
  });

  it("refuses to produce NaN or negative sizes", () => {
    const zero = placement({
      box: { width: 0, height: 0 },
      source: SOURCE,
      fit: "cover",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    for (const value of Object.values(zero))
      expect(Number.isFinite(value)).toBe(true);
    const far = placement({
      box: BOX,
      source: SOURCE,
      fit: "contain",
      scale: 1,
      offsetX: 1,
      offsetY: 1,
    });
    expect(far.width).toBeGreaterThan(0);
    expect(far.height).toBeGreaterThan(0);
  });
});

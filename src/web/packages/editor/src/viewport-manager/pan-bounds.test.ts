import { describe, expect, it } from "vitest";
import { PAN_OVERSCROLL_MARGIN, clampPan } from "./pan-bounds.js";

const viewport = { width: 1000, height: 800 };
const artboard = { width: 1280, height: 720 };

describe("clampPan", () => {
  it("leaves an offset that keeps the artboard comfortably visible", () => {
    expect(
      clampPan({ viewport, zoom: 1, artboard, offset: { x: 0, y: 0 } }),
    ).toEqual({ x: 0, y: 0 });
  });

  it("stops the artboard being pushed off the right edge", () => {
    const clamped = clampPan({
      viewport,
      zoom: 1,
      artboard,
      offset: { x: 99999, y: 0 },
    });
    // The artboard's left edge cannot pass the viewport's right edge minus the margin.
    expect(clamped.x).toBe(viewport.width - PAN_OVERSCROLL_MARGIN);
  });

  it("stops the artboard being pushed off the left edge", () => {
    const clamped = clampPan({
      viewport,
      zoom: 1,
      artboard,
      offset: { x: -99999, y: 0 },
    });
    expect(clamped.x).toBe(PAN_OVERSCROLL_MARGIN - artboard.width);
  });

  it("keeps the whole artboard reachable at a zoom above fit", () => {
    // At 4x the artboard is wider than the viewport. Panning to its right edge
    // must still be possible, so the lower bound moves out with the artwork.
    const clamped = clampPan({
      viewport,
      zoom: 4,
      artboard,
      offset: { x: -99999, y: 0 },
    });
    expect(clamped.x).toBe(PAN_OVERSCROLL_MARGIN - artboard.width * 4);
  });

  it("clamps each axis on its own", () => {
    // The whole artboard fits vertically at 1x, so y is pulled back inside while
    // x — tied to a different extent — is left where the caller put it.
    const clamped = clampPan({
      viewport,
      zoom: 1,
      artboard,
      offset: { x: -200, y: -99999 },
    });
    expect(clamped).toEqual({
      x: -200,
      y: PAN_OVERSCROLL_MARGIN - artboard.height,
    });
  });
});

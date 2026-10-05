// @vitest-environment jsdom

/**
 * What a swept angle **measures**, rather than what it is asked for.
 *
 * The whole point of this primitive is the shape: a quarter-disc is drawn by
 * hand today, as an SVG path, because the vocabulary cannot say "90° of a
 * circle". Asserting `startAngle === 90` would pass for a shape that renders
 * nothing, or a chord, or a full disc — every one of which carries those two
 * numbers. Only the drawn pixels say whether the sweep is the one asked for, so
 * these cases render and count.
 *
 * The comparison is against the exact area of the figure, with a tolerance wide
 * enough for antialiasing on the boundary and far too narrow to hide a chord. A
 * quarter-disc and the chord that closes it differ by half the radius squared:
 * at radius 80 that is 3200 px against a total near 5000, so nothing that is
 * quietly the wrong figure passes here.
 */

import { VIGILIA_PAINT_PROPERTY } from "@vigilia/scene-fabric";
import { type FabricObject, StaticCanvas } from "fabric/es";
import { describe, expect, it } from "vitest";
import { createNewShape, type ShapeKind } from "./new-object-defaults.js";

/** Radius large enough that a chord-versus-sector mistake is unmissable. */
const RADIUS = 80;
/** A pixel is opaque or it is not; the boundary is antialiased either way. */
const OPAQUE = 127;
/** 2% of the figure, which is antialiasing's share and not a shape's. */
const TOLERANCE = 0.02;

/** The palette a new shape draws its paint from. */
const globals = {
  palette: {
    background: {
      name: "Background",
      value: { kind: "solid" as const, color: "#000000" },
    },
  },
} as never;

const placement = { left: 0, top: 0 };

/** Painted pixels of one shape, drawn with whatever paint it arrived with. */
function paintedPixels(shape: FabricObject): number {
  const size = RADIUS * 2 + 8;
  const canvas = new StaticCanvas(document.createElement("canvas"), {
    width: size,
    height: size,
  });
  // The paint is left exactly as the shape carries it. Overriding `fill` here
  // would be the difference between measuring the geometry and measuring a
  // different geometry: a forced fill closes an open sweep into a chord, so the
  // one case that exists to prove the arc has no interior would prove the
  // opposite. Alpha counts either way — a black fill is as opaque as a white
  // one — so the colour never mattered and forcing it only cost the claim.
  shape.set("left", size / 2);
  shape.set("top", size / 2);
  shape.set("originX", "center");
  shape.set("originY", "center");
  canvas.add(shape);
  canvas.renderAll();

  const { data } = canvas.getContext().getImageData(0, 0, size, size);
  let painted = 0;
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 0) > OPAQUE) painted += 1;
  }
  canvas.destroy();
  return painted;
}

/** The exact area of a sector of `sweep` degrees, and of the disc. */
function sectorArea(sweep: number): number {
  return (sweep / 360) * Math.PI * RADIUS * RADIUS;
}

/** Builds a shape of `kind` and puts its sweep at `sweep` degrees from 0. */
function swept(kind: ShapeKind, sweep: number): FabricObject {
  const shape = createNewShape(`shape-${kind}`, globals, kind, placement);
  shape.set({ startAngle: 0, endAngle: sweep, radius: RADIUS });
  // `width`/`height` follow the radius, and the inspector reads those; keeping
  // them in step is what the author would see after typing the sweep.
  shape.set({ width: RADIUS * 2, height: RADIUS * 2 });
  return shape;
}

describe("a swept angle, measured", () => {
  it.each([
    { sweep: 90, quarter: true },
    { sweep: 180, quarter: false },
    { sweep: 270, quarter: false },
  ])(
    "draws a $sweep degree wedge as that fraction of the disc",
    ({ sweep, quarter }) => {
      const painted = paintedPixels(swept("wedge", sweep));
      const expected = sectorArea(sweep);

      // Stated as a ratio so the case survives a change of radius: the claim is
      // "this fraction of the circle", and a chord would land near
      // 1 − (sweep/180) of it rather than near 1.
      expect(painted / expected).toBeGreaterThan(1 - TOLERANCE);
      expect(painted / expected).toBeLessThan(1 + TOLERANCE);
      if (quarter) {
        // Named because this is the case the primitive exists for, and because
        // it is the one a chord would fail: a 90° sweep closed by its chord is
        // two thirds the size of the quarter-disc it is asked to be.
        expect(painted).toBeGreaterThan(sectorArea(90) * 0.9);
      }
    },
  );

  it("draws a full sweep as the whole disc rather than nothing", () => {
    // 0→360 is the degenerate pair the two angle fields could produce, and a
    // wedge whose radii land on the same point must still be a disc.
    const painted = paintedPixels(swept("wedge", 360));
    const expected = Math.PI * RADIUS * RADIUS;

    expect(painted / expected).toBeGreaterThan(1 - TOLERANCE);
    expect(painted / expected).toBeLessThan(1 + TOLERANCE);
  });

  it("draws an open arc as a curve, with no interior to fill", () => {
    const painted = paintedPixels(swept("arc", 90));

    // The contrast case, and the reason the two kinds are not one. An arc has
    // no interior: what it draws is the sweep itself, so its painted area is
    // the stroke's, orders of magnitude below the sector it spans.
    expect(painted).toBeLessThan(sectorArea(90) * 0.2);
  });

  it("leaves an arc unfilled, so the sweep is not mistaken for a region", () => {
    const arc = createNewShape("shape-arc", globals, "arc", placement);

    // A closed figure's paint belongs to its interior; an open one is stroked,
    // exactly as a polyline and a line already are. An arc that arrived filled
    // would flood the area between the sweep and its chord.
    expect(arc.get(VIGILIA_PAINT_PROPERTY)).toEqual({
      stroke: expect.any(String),
    });
    expect(arc.fill).toBeNull();
  });

  it("fills a wedge, because its interior is the region the author asked for", () => {
    const wedge = createNewShape("shape-wedge", globals, "wedge", placement);

    expect(wedge.get(VIGILIA_PAINT_PROPERTY)).toEqual({
      fill: expect.any(String),
    });
  });
});

// @vitest-environment jsdom

/**
 * The frosted treatment on the shapes that joined it: Circle, Ellipse, Triangle
 * and Polygon. What is proved here is **the clip path**, not the blur —
 * `node-canvas` accepts `ctx.filter` and ignores it — so every case asks whether
 * the frosted surface is confined to the shape's own geometry.
 *
 * The probe is the same each time: a point **inside the object's bounding box
 * and outside the shape**. A clip built from the bounding box reaches it; a clip
 * built from the shape's own geometry does not. That is what makes this a
 * rendering test rather than a check that a treatment exists, and it is why the
 * file is separate from `glass.dom.test.ts` rather than inside it.
 *
 * Every point is chosen with margin. A probe one pixel outside a shape lands on
 * the clip's antialiased edge and reads a faint wash instead of nothing, which
 * is a test that passes for the wrong reason.
 *
 * `docs/decisions/0015-glass-clips-any-closed-path-not-only-rects.md`.
 */

import {
  Circle,
  Ellipse,
  type FabricObject,
  Point,
  Polygon,
  Polyline,
  Triangle,
} from "fabric/es";
import { describe, expect, it } from "vitest";
import { type Stage, stage } from "./glass-test-stage.js";

/** A solid magenta backdrop, so the frosted region is unmistakable. */
function magenta(): Stage {
  return stage({
    texture: false,
    backdrop: () => ({
      paint: (ctx, region) => {
        ctx.fillStyle = "#ff00ff";
        ctx.fillRect(0, 0, region.width, region.height);
        return true;
      },
    }),
  });
}

interface Frosted {
  /** The same scene with the treatment on. */
  readonly s: Stage;
  /** The same scene without it, which is what an unclipped probe still reads. */
  readonly without: Stage;
}

/**
 * Renders `make()` twice, once carrying the treatment and once not. Glass leaves
 * a point it does not cover exactly as it found it, so the pair proves both
 * halves at once: equal outside the shape, magenta inside it.
 */
function frosted(make: (withGlass: boolean) => FabricObject): Frosted {
  const s = magenta();
  const without = magenta();
  s.canvas.add(make(true));
  without.canvas.add(make(false));
  s.canvas.renderAll();
  without.canvas.renderAll();
  return { s, without };
}

/** The treatment, applied only when asked for. */
const GLASS = { vigiliaGlass: { blurRadius: 24 } };

describe("glass on the closed shapes", () => {
  it("clips a circle to the disc, not to the box around it", () => {
    // radius 20 at (100,100): the bounding box runs 80..120, and (82, 82) is
    // 25.5 from the centre — 5.5px clear of the disc, well inside the square.
    const { s, without } = frosted(
      (withGlass) =>
        new Circle({
          left: 100,
          top: 100,
          radius: 20,
          fill: "transparent",
          ...(withGlass ? GLASS : {}),
        }),
    );
    expect(s.errors).toEqual([]);
    expect(s.draws, "the circle composites").toHaveLength(1);

    // Outside the disc: the media never arrives, so the two agree.
    expect(s.pixel(82, 82)).toEqual(without.pixel(82, 82));
    expect(without.pixel(82, 82)[3], "and there is nothing to agree with").toBe(
      0,
    );
    // Inside: opaque magenta, where without glass the canvas is clear.
    expect(s.pixel(100, 100)[3]).toBe(255);
    expect(without.pixel(100, 100)[3]).toBeLessThan(255);
  });

  it("clips an ellipse to its own radii, which a square would exceed", () => {
    // rx 30, ry 12: the box runs 70..130 by 88..112, and (72, 90) is inside
    // that box while (28/30)² + (10/12)² = 1.57 puts it outside the ellipse.
    const { s, without } = frosted(
      (withGlass) =>
        new Ellipse({
          left: 100,
          top: 100,
          rx: 30,
          ry: 12,
          fill: "transparent",
          ...(withGlass ? GLASS : {}),
        }),
    );
    expect(s.errors).toEqual([]);
    expect(s.draws).toHaveLength(1);

    expect(s.pixel(72, 90)).toEqual(without.pixel(72, 90));
    expect(without.pixel(72, 90)[3]).toBe(0);
    expect(s.pixel(100, 100)[3]).toBe(255);
  });

  it("clips a triangle to its three corners, not to the box around them", () => {
    // 40x40 at (100,100), so the vertices are (80,120), (100,80) and (120,120).
    // The left edge runs from (80,120) up to (100,80), reaching x=98 at y=84 —
    // so (84, 84) is 14px clear of the hypotenuse and only 4px inside the box.
    const { s, without } = frosted(
      (withGlass) =>
        new Triangle({
          left: 100,
          top: 100,
          width: 40,
          height: 40,
          fill: "transparent",
          ...(withGlass ? GLASS : {}),
        }),
    );
    expect(s.errors).toEqual([]);
    expect(s.draws).toHaveLength(1);

    expect(s.pixel(84, 84)).toEqual(without.pixel(84, 84));
    expect(without.pixel(84, 84)[3]).toBe(0);
    // On the centre line, 10px clear of each sloping edge.
    expect(s.pixel(100, 100)[3]).toBe(255);
  });

  it("clips a polygon to its own points, about its own pathOffset", () => {
    // A diamond. Fabric centres the points on `pathOffset` before painting, and
    // the clip has to use the same frame or the frost lands beside the shape.
    // (80, 80) is 40 (L1) from the centre, against a 25 radius, and sits in the
    // corner of the 75..125 bounding box.
    const { s, without } = frosted(
      (withGlass) =>
        new Polygon(
          [
            new Point(0, -25),
            new Point(25, 0),
            new Point(0, 25),
            new Point(-25, 0),
          ],
          {
            left: 100,
            top: 100,
            fill: "transparent",
            ...(withGlass ? GLASS : {}),
          },
        ),
    );
    expect(s.errors).toEqual([]);
    expect(s.draws).toHaveLength(1);

    expect(s.pixel(80, 80)).toEqual(without.pixel(80, 80));
    expect(without.pixel(80, 80)[3]).toBe(0);
    expect(s.pixel(100, 100)[3]).toBe(255);
  });

  it("refuses an open path rather than clipping it to its box", () => {
    // The exclusion, proved where the renderer can still be handed one. A
    // validated theme never gets this far — `renderer-core` refuses the
    // treatment on a `Polyline` at import — so this is the hand-edited scene
    // and the check that it degrades into a report rather than into a frosted
    // box around a shape with no interior.
    const s = magenta();
    s.canvas.add(
      new Polyline([new Point(0, -25), new Point(25, 25), new Point(-25, 25)], {
        left: 100,
        top: 100,
        fill: "transparent",
        ...GLASS,
      }),
    );
    s.canvas.renderAll();

    expect(s.draws, "nothing composites").toHaveLength(0);
    expect(s.errors[0]).toContain("no closed path to clip");
    // The proof that this is the geometry and not the class name: a `Polyline`
    // is a sibling of `Polygon` here, not a parent, so nothing about the
    // instance hierarchy could have made the test pass by accident.
    const polyline = s.canvas.getObjects()[0] as Polyline;
    expect(polyline).toBeInstanceOf(Polyline);
    expect(polyline).not.toBeInstanceOf(Polygon);
  });
});

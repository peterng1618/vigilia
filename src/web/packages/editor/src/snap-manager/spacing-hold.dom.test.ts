// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSnapManager } from "./index.js";

/** Two flanking shapes with the active one between them, so equal spacing is
 * reachable. The two flankers are 60 wide and the active object is 40. */
function scene() {
  const canvas = new Canvas(document.createElement("canvas"));
  const snapping = createSnapManager({
    canvas,
    // The artboard's centre is deliberately far from the equal-spacing position.
    // At centreX 200 it coincides with it, and the artboard's own centre guide
    // then produces the same `200` the equal-spacing hold would — so the fixture
    // would pass without any spacing logic existing at all.
    bounds: () => ({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 300,
      centerX: 500,
      centerY: 150,
    }),
    errors: { error: vi.fn(), warn: vi.fn() } as never,
  });
  // Explicit left/top origin: Fabric 7's Rect defaults to a centre origin, which
  // would make `left` the shape's centre and shift every edge by half its width.
  const rect = (options: Record<string, unknown>): Rect =>
    new Rect({ originX: "left", originY: "top", ...options });
  // Left ends at 161, right starts at 280: a gap a 41-wide bounded object (40
  // plus its stroke) splits evenly at 200. The flankers must also span the
  // active object's band: an equal-spacing chain only forms between objects
  // overlapping on the perpendicular axis, so shorter flankers are invisible to
  // the spacing calculator and nothing holds.
  const left = rect({ id: "left", left: 100, top: 0, width: 60, height: 300 });
  const right = rect({
    id: "right",
    left: 280,
    top: 0,
    width: 60,
    height: 300,
  });
  const active = rect({
    id: "active",
    left: 200,
    top: 180,
    width: 40,
    height: 40,
  });
  canvas.add(left, right, active);
  canvas.setActiveObject(active);
  return { canvas, snapping, active };
}

/** Re-positions the object and fires one step, as Fabric does per pointermove. */
function move(
  canvas: Canvas,
  target: unknown,
  offset: number,
  e: object = {},
): void {
  (target as Rect).set({ left: offset });
  canvas.fire("object:moving" as never, { target, e } as never);
}

/** Measured 2026-09-25 by sweeping this fixture: the object reads 200 at every
 * offset from 195 to 210 and follows the pointer from 211 on. The window is the
 * acquire threshold (SNAP_THRESHOLD, 5) extended by SPACING_SNAP_HOLD_MARGIN (5),
 * so 205 is the last offset a fresh acquire could reach and 206-210 can only be
 * the hold. Measure it, as the comment's derivation is what makes this test
 * honest — deriving the window from the constants alone would not catch a
 * fixture that never acquired. */
const HOLD_STEP = 210;
/** Past the first releasing offset (211), so this step cannot straddle it. */
const RELEASE_STEP = 221;

describe("equal-spacing hold", () => {
  it("keeps the chosen spacing while the pointer stays near it", () => {
    const { canvas, snapping, active } = scene();
    canvas.fire("mouse:down" as never, { target: active } as never);

    move(canvas, active, 200);
    expect(active.left).toBe(200);

    // 210 is past the acquire threshold and inside the release window: a fresh
    // acquire cannot reach 200 from here, so reading 200 proves the hold.
    move(canvas, active, HOLD_STEP);
    expect(active.left).toBe(200);

    snapping.destroy();
  });

  it("releases once the pointer moves well past the margin", () => {
    const { canvas, snapping, active } = scene();
    canvas.fire("mouse:down" as never, { target: active } as never);

    move(canvas, active, 200);
    move(canvas, active, RELEASE_STEP);
    // Outside the release window the hold lets go and the object follows the
    // pointer, rather than staying welded to the spacing guide.
    expect(active.left).toBe(RELEASE_STEP);

    snapping.destroy();
  });
});

// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSnapManager } from "../index.js";

/** The raw width multiplier whose moved right edge lands inside SNAP_THRESHOLD
 * of the anchor's left edge. Task 8 imports it, so it lives here, defined once. */
export const SNAPPING_MULTIPLIER = 1.53;

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const snapped = createSnapManager({
    canvas,
    bounds: () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      centerX: 400,
      centerY: 300,
    }),
    errors: { error: vi.fn(), warn: vi.fn() } as never,
  });
  // strokeWidth 0: `getObjectExactBounds` reads `getBoundingRect()`, which
  // includes a non-uniform stroke, so a default 1px stroke would make the
  // geometry 201x81 and every expected number below wrong.
  // The anchor's left edge is 270; the resized object's right edge starts at 160.
  const anchor = new Rect({
    id: "a",
    left: 300,
    top: 40,
    width: 60,
    height: 60,
    strokeWidth: 0,
  });
  const resized = new Rect({
    id: "b",
    left: 60,
    top: 300,
    width: 200,
    height: 80,
    strokeWidth: 0,
  });
  canvas.add(anchor, resized);
  canvas.setActiveObject(resized);

  const transform = {
    target: resized,
    action: "scaleX",
    corner: "mr",
    // Fabric's own _getOriginFromCorner forces "left"/"center" for `mr`.
    originX: "left",
    originY: "center",
    original: { scaleX: 1, scaleY: 1, originX: "left", originY: "center" },
  };
  // Fabric fires `object:scaling` only after it has already resized the object,
  // so the gesture's start geometry comes from `mouse:down`, which carries the
  // transform Fabric built there. One pointerdown, then the resize steps.
  // `scenePoint`, not `pointer`: Fabric's `_handleEvent` builds the payload
  // from `getEventPoints` (scenePoint/viewportPoint), and only `object:scaling`
  // gets a `pointer`. Sending `pointer` here would test a payload Fabric never
  // sends, and a controller reading only `pointer` would never start a session.
  const down = (): void => {
    canvas.fire(
      "mouse:down" as never,
      {
        e: {},
        target: resized,
        scenePoint: { x: 160, y: 300 },
        transform,
      } as never,
    );
  };
  /** One mr-handle step. Returns the width Fabric itself would have produced, so
   * a test can compare "what the raw drag gives" against "what the controller
   * gives" — the controller may legitimately change the scale. */
  const resize = (e: object, widthScale: number): number => {
    // Mirror Fabric's pre-transform result so the controller sees the state it
    // would really see. This is setup, not the behaviour under test: asserting
    // that getScaledWidth() equals 200 * widthScale after this call proves
    // nothing, because this line produced it.
    resized.set({ scaleX: widthScale, scaleY: 1 });
    resized.setCoords();
    canvas.fire(
      "object:scaling" as never,
      {
        e,
        target: resized,
        pointer: { x: 160, y: 300 },
        transform,
      } as never,
    );
    return 200 * widthScale;
  };
  return { canvas, snapped, resized, down, resize };
}

describe("scale snapping", () => {
  it("snaps a resize onto a neighbour's edge", () => {
    const { snapped, resized, down, resize } = setup();
    down();

    // The raw right edge lands at 266, four short of the anchor's 270 left edge,
    // so the raw width (306) and the snapped width (310) differ — the assertion
    // can fail when the controller does nothing.
    const raw = resize({}, SNAPPING_MULTIPLIER);
    expect(raw).toBe(306);
    expect(resized.getScaledWidth()).toBe(310);
    snapped.destroy();
  });

  it("re-plans on every scaling step, not once per gesture", () => {
    const { snapped, resized, down, resize } = setup();
    down();
    // Far from the neighbour, so the first step resolves to itself and the raw
    // value stands — this is the assertion that would catch a controller that
    // snapped unconditionally.
    expect(resize({}, 0.6)).toBe(120);
    expect(resized.getScaledWidth()).toBe(120);
    // The second step must be planned, not rejected as a duplicate.
    resize({}, SNAPPING_MULTIPLIER);
    expect(resized.getScaledWidth()).toBe(310);
    snapped.destroy();
  });
});

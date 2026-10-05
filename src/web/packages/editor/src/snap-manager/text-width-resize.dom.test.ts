// @vitest-environment jsdom
import { Canvas, Group, Point, Rect, Textbox } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSnapManager } from "./index.js";

/** Fabric 7 objects are centre-origin by default, so every position below is a
 * centre and the edges are half a width away from it.
 *
 * The anchor's left edge sits at 302. The text box is centred at 200 with a
 * width of 200, so it spans 100..300 and its right edge starts two short of the
 * guide. `mr` holds the left edge, so landing on 302 widens the box by exactly
 * the 2 it was short — the raw width (200) and the snapped width (202) differ,
 * which is what lets this case fail when the controller does nothing. */
const RAW_WIDTH = 200;
const SNAPPED_WIDTH = 202;

function setup({
  grouped = false,
  skewed = false,
}: {
  grouped?: boolean;
  skewed?: boolean;
} = {}) {
  const canvas = new Canvas(document.createElement("canvas"));
  const errors = { error: vi.fn(), warn: vi.fn() };
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
    errors: errors as never,
  });
  // strokeWidth 0: `getObjectExactBounds` reads `getBoundingRect()`, which
  // includes the stroke, so a default 1px stroke would move every edge below.
  const anchor = new Rect({
    id: "a",
    left: 332,
    top: 40,
    width: 60,
    height: 60,
    strokeWidth: 0,
  });
  const textbox = new Textbox("snapping label", {
    id: "b",
    left: 200,
    top: 340,
    width: RAW_WIDTH,
    fontSize: 20,
    strokeWidth: 0,
    ...(skewed ? { skewX: 0.2 } : {}),
  });
  if (grouped) {
    // `_enterGroup` sets `group` and `parent` on the child, which is what the
    // guard reads. The group is unrotated, so only the guard can stop this child
    // from snapping — a removal of the guard turns the test red.
    canvas.add(
      anchor,
      new Group([textbox], { subTargetCheck: true, interactive: true }),
    );
  } else {
    canvas.add(anchor, textbox);
    canvas.setActiveObject(textbox);
  }

  // Fabric gives a Textbox `changeWidth` side controls, so this gesture arrives
  // as `resizing` on a canonical `width` — never as a scale. Its own
  // `getOriginFromCorner` holds `mr` at "left"/"center".
  const transform = {
    target: textbox,
    action: "resizing",
    corner: "mr",
    originX: "left",
    originY: "center",
  };
  // Fabric fires `object:resizing` only after it has already changed the width,
  // so the gesture's start geometry comes from `mouse:down`.
  const down = (): void => {
    canvas.fire(
      "mouse:down" as never,
      {
        e: {},
        target: textbox,
        scenePoint: { x: 300, y: 340 },
        transform,
      } as never,
    );
  };
  /** One handle step, mirroring Fabric's pre-transform result. */
  const resize = (e: object, width: number): number => {
    // Setup, not behaviour under test: what Fabric leaves behind before the
    // controller sees the event. Its `changeWidth` handler is wrapped in
    // `wrapWithFixedAnchor`, so the left edge is back at 100 on every step.
    textbox.set({ width });
    textbox.setPositionByOrigin(new Point(100, 340), "left", "center" as never);
    textbox.setCoords();
    canvas.fire(
      "object:resizing" as never,
      { e, target: textbox, pointer: { x: 300, y: 340 }, transform } as never,
    );
    return width;
  };
  return { canvas, errors, snapped, textbox, down, resize };
}

/** A step that throws is swallowed by the manager's guard, so surface it. */
function expectNoStepFailure({ errors }: ReturnType<typeof setup>): void {
  expect(errors.error).not.toHaveBeenCalled();
}

describe("text width resize snapping", () => {
  it("snaps a text box's side handle onto a neighbour's edge", () => {
    const harness = setup();
    const { snapped, textbox, down, resize } = harness;
    down();

    // The raw right edge lands at 300, two short of the anchor's 302 left edge.
    expect(resize({}, RAW_WIDTH)).toBe(RAW_WIDTH);
    expectNoStepFailure(harness);
    expect(textbox.width).toBe(SNAPPED_WIDTH);
    expect(textbox.getScaledWidth()).toBe(SNAPPED_WIDTH);
    snapped.destroy();
  });

  it("re-plans on every step, not once per gesture", () => {
    const harness = setup();
    const { snapped, textbox, down, resize } = harness;
    down();

    // Far from the neighbour, so the first step resolves to itself.
    expect(resize({}, 100)).toBe(100);
    expect(textbox.width).toBe(100);
    resize({}, RAW_WIDTH);
    expectNoStepFailure(harness);
    expect(textbox.width).toBe(SNAPPED_WIDTH);
    snapped.destroy();
  });

  it("leaves the raw width alone while Ctrl is held", () => {
    const { snapped, textbox, down, resize } = setup();
    down();

    expect(resize({ ctrlKey: true }, RAW_WIDTH)).toBe(RAW_WIDTH);
    expect(textbox.width).toBe(RAW_WIDTH);
    snapped.destroy();
  });

  it("snaps the same step when Ctrl is not held", () => {
    const { snapped, textbox, down, resize } = setup();
    down();

    resize({}, RAW_WIDTH);
    expect(textbox.width).not.toBe(RAW_WIDTH);
    snapped.destroy();
  });

  it("refuses a group child, whose bounds plane is the group's", () => {
    const { snapped, textbox, down, resize } = setup({ grouped: true });
    down();

    expect(resize({}, RAW_WIDTH)).toBe(RAW_WIDTH);
    expect(textbox.width).toBe(RAW_WIDTH);
    snapped.destroy();
  });

  it("refuses skewed text, whose width vector is not the linear model", () => {
    const { snapped, textbox, down, resize } = setup({ skewed: true });
    down();

    expect(resize({}, RAW_WIDTH)).toBe(RAW_WIDTH);
    expect(textbox.width).toBe(RAW_WIDTH);
    snapped.destroy();
  });
});

// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { renderSnappingGuides } from "./guide-renderer.js";

function contextSpy(canvas: Canvas) {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    transform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    fillText: vi.fn(),
    translate: vi.fn(),
    rect: vi.fn(),
    closePath: vi.fn(),
    arcTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    lineWidth: 0,
    strokeStyle: "",
    fillStyle: "",
    font: "",
    textAlign: "" as CanvasTextAlign,
    textBaseline: "" as CanvasTextBaseline,
  };
  vi.spyOn(canvas, "getSelectionContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return context;
}

describe("renderSnappingGuides", () => {
  it("strokes a dashed guide and always restores the context", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const context = contextSpy(canvas);

    renderSnappingGuides({
      canvas,
      guideBounds: { left: 0, top: 0, right: 100, bottom: 100 },
      guides: [{ type: "vertical", position: 50 }],
      spacingGuides: [],
    });

    expect(context.save).toHaveBeenCalledOnce();
    expect(context.setLineDash).toHaveBeenCalledWith([4, 4]);
    expect(context.strokeStyle).toBe("#3D8BF4");
    expect(context.stroke).toHaveBeenCalled();
    expect(context.restore).toHaveBeenCalledOnce();
  });

  it("touches nothing when there are no guides", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const context = contextSpy(canvas);

    renderSnappingGuides({
      canvas,
      guideBounds: { left: 0, top: 0, right: 100, bottom: 100 },
      guides: [],
      spacingGuides: [],
    });

    expect(context.save).not.toHaveBeenCalled();
    expect(context.stroke).not.toHaveBeenCalled();
  });

  it("keeps the hairline one screen pixel wide as the camera zooms", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const context = contextSpy(canvas);

    for (const zoom of [0.5, 1, 2, 4]) {
      vi.clearAllMocks();
      canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
      renderSnappingGuides({
        canvas,
        guideBounds: { left: 0, top: 0, right: 100, bottom: 100 },
        guides: [{ type: "vertical", position: 50 }],
        spacingGuides: [],
      });
      // The context is scaled by the viewport transform before stroking, so the
      // SCENE width must be 1/zoom for the painted width to stay 1 screen pixel.
      expect(context.lineWidth).toBeCloseTo(1 / zoom, 10);
    }
  });

  it("clamps guides to the given bounds rather than the viewport", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const context = contextSpy(canvas);
    // Zoomed IN far enough that the viewport is much smaller than the artboard,
    // which is where "clamp to the viewport" and "clamp to the artboard" differ.
    canvas.setViewportTransform([4, 0, 0, 4, 0, 0]);

    renderSnappingGuides({
      canvas,
      guideBounds: { left: 0, top: 0, right: 1280, bottom: 720 },
      guides: [{ type: "vertical", position: 50 }],
      spacingGuides: [],
    });

    // A vertical guide spans the bounds' full height: 0 to 720, not the 0-to-37.5
    // the viewport covers at 4x. `new Canvas(document.createElement("canvas"))`
    // gives a 300x150 backing store — measured, not assumed — so the viewport
    // bounds here are 0-75 by 0-37.5, far inside the 1280x720 artboard.
    const ys = context.moveTo.mock.calls
      .concat(context.lineTo.mock.calls)
      .map((call) => call[1] as number);
    expect(Math.min(...ys)).toBeCloseTo(0, 5);
    expect(Math.max(...ys)).toBeCloseTo(720, 5);
  });

  it("paints spacing guides before the context is restored", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const context = contextSpy(canvas);

    for (const zoom of [0.5, 1, 2, 4]) {
      vi.clearAllMocks();
      canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
      renderSnappingGuides({
        canvas,
        guideBounds: { left: 0, top: 0, right: 100, bottom: 100 },
        guides: [],
        spacingGuides: [
          {
            type: "vertical",
            axis: 30,
            refStart: 0,
            refEnd: 10,
            activeStart: 20,
            activeEnd: 30,
            distance: 10,
          },
        ],
      });

      // Exactly one stroke: `guides` is empty, and `drawGuideLabel` only fills.
      expect(context.stroke).toHaveBeenCalledOnce();
      // The spacing pass must stroke while the save/transform block is still open.
      // The first `restore` is a label's, so the stroke has to precede it; move the
      // `drawSpacingGuides` call below the outer `context.restore()` and this
      // inverts, because that outer restore becomes the first one.
      expect(context.stroke.mock.invocationCallOrder[0]).toBeLessThan(
        context.restore.mock.invocationCallOrder[0] as number,
      );
    }
  });
});

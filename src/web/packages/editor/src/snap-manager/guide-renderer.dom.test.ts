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
});

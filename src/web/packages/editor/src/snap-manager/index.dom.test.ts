// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createErrorManager } from "../error-manager/index.js";
import { createSnapManager } from "./index.js";

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const snapping = createSnapManager({
    canvas,
    bounds: () => ({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      centerX: 200,
      centerY: 150,
    }),
    errors: createErrorManager(canvas),
  });
  return { canvas, snapping };
}

describe("SnapManager", () => {
  it("nudges a dragged object onto a neighbour's edge", () => {
    const { canvas, snapping } = setup();
    const anchor = new Rect({
      id: "a",
      left: 100,
      top: 20,
      width: 40,
      height: 40,
    });
    const dragged = new Rect({
      id: "b",
      left: 98,
      top: 150,
      width: 40,
      height: 40,
    });
    canvas.add(anchor, dragged);
    canvas.setActiveObject(dragged);

    canvas.fire("mouse:down" as never, { target: dragged } as never);
    canvas.fire("object:moving" as never, { target: dragged } as never);

    expect(dragged.left).toBe(100);
    snapping.destroy();
  });

  it("leaves an object alone when no neighbour is within the threshold", () => {
    const { canvas, snapping } = setup();
    const anchor = new Rect({
      id: "a",
      left: 0,
      top: 20,
      width: 40,
      height: 40,
    });
    const dragged = new Rect({
      id: "b",
      left: 250,
      top: 150,
      width: 40,
      height: 40,
    });
    canvas.add(anchor, dragged);
    canvas.setActiveObject(dragged);

    canvas.fire("mouse:down" as never, { target: dragged } as never);
    canvas.fire("object:moving" as never, { target: dragged } as never);

    expect(dragged.left).toBe(250);
    snapping.destroy();
  });

  it("skips a locked neighbour as a snap target", () => {
    const { canvas, snapping } = setup();
    const locked = new Rect({
      id: "a",
      left: 100,
      top: 20,
      width: 40,
      height: 40,
      locked: true,
    });
    const dragged = new Rect({
      id: "b",
      left: 98,
      top: 150,
      width: 40,
      height: 40,
    });
    canvas.add(locked, dragged);
    canvas.setActiveObject(dragged);

    canvas.fire("mouse:down" as never, { target: dragged } as never);
    canvas.fire("object:moving" as never, { target: dragged } as never);

    expect(dragged.left).toBe(98);
    snapping.destroy();
  });

  it("detaches every listener on destroy", () => {
    const { canvas, snapping } = setup();
    const dragged = new Rect({
      id: "b",
      left: 98,
      top: 150,
      width: 40,
      height: 40,
    });
    canvas.add(
      new Rect({ id: "a", left: 100, top: 20, width: 40, height: 40 }),
      dragged,
    );
    canvas.setActiveObject(dragged);

    snapping.destroy();
    canvas.fire("mouse:down" as never, { target: dragged } as never);
    canvas.fire("object:moving" as never, { target: dragged } as never);

    expect(dragged.left).toBe(98);
  });
});

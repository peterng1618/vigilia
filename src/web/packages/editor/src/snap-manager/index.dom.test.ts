// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSnapManager } from "./index.js";

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const logged = vi.fn();
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
    errors: { error: logged, warn: vi.fn() } as never,
  });
  return { canvas, snapping, logged };
}

describe("SnapManager", () => {
  /** Fires one movement step; each step carries its own browser event, as a real pointermove does. */
  function move(canvas: Canvas, target: unknown, e: object = {}): void {
    canvas.fire("object:moving" as never, { target, e } as never);
  }

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
    move(canvas, dragged);

    expect(dragged.left).toBe(100);
    snapping.destroy();
  });

  it("re-plans every movement step of one drag", () => {
    const { canvas, snapping } = setup();
    // A two-step drag with no neighbour near either step: only the second read
    // can tell a re-planning step from a cached one.
    const anchor = new Rect({
      id: "a",
      left: 100,
      top: 20,
      width: 40,
      height: 40,
    });
    const dragged = new Rect({
      id: "b",
      left: 200,
      top: 150,
      width: 40,
      height: 40,
    });
    canvas.add(anchor, dragged);
    canvas.setActiveObject(dragged);

    canvas.fire("mouse:down" as never, { target: dragged } as never);
    dragged.set({ left: 120, top: 150 });
    move(canvas, dragged);
    dragged.set({ left: 99, top: 150 });
    move(canvas, dragged);

    expect(dragged.left).toBe(100);
    snapping.destroy();
  });

  it("leaves the raw position alone while Ctrl is held", () => {
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
      left: 98.4,
      top: 150,
      width: 40,
      height: 40,
    });
    canvas.add(anchor, dragged);
    canvas.setActiveObject(dragged);

    canvas.fire("mouse:down" as never, { target: dragged } as never);
    move(canvas, dragged, { ctrlKey: true });

    expect(dragged.left).toBe(98.4);
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
    move(canvas, dragged);

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
    move(canvas, dragged);

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
    move(canvas, dragged);

    expect(dragged.left).toBe(98);
  });

  it("survives a whole-pixel drag step that resolves to a zero delta", () => {
    const { canvas, snapping, logged } = setup();
    // Far from every neighbour and the artboard edge: the resolver returns the
    // dragged position itself, so the first step is a zero-delta plan.
    const dragged = new Rect({
      id: "b",
      left: 98,
      top: 150,
      width: 40,
      height: 40,
    });
    canvas.add(
      new Rect({ id: "a", left: 250, top: 20, width: 40, height: 40 }),
      dragged,
    );
    canvas.setActiveObject(dragged);

    canvas.fire("mouse:down" as never, { target: dragged } as never);
    // Whole-pixel drag: the resolver's pixel rounding returns a zero-delta
    // plan. The pending token must still be verified so the next step runs.
    dragged.set({ left: 99, top: 151 });
    move(canvas, dragged);
    dragged.set({ left: 120, top: 160 });
    move(canvas, dragged);

    expect(dragged.left).toBe(120);
    expect(logged).not.toHaveBeenCalled();
    snapping.destroy();
  });
});

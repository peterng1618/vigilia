// @vitest-environment jsdom

import { Canvas, Point } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, createViewportManager } from "./index.js";

// jsdom cannot drawImage an undecoded img inside Fabric's render pass; a proxy
// over a real context forwards everything, no-ops only drawImage, and swallows
// Fabric's node-canvas-only `patternQuality` writes.
beforeEach(() => {
  const real = document.createElement("canvas").getContext("2d");
  if (real !== null) {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        new Proxy(real, {
          get(target, property) {
            if (property === "drawImage") return (): void => {};
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
          set(target, property, value) {
            if (property === "patternQuality") return true;
            return Reflect.set(target, property, value);
          },
        }) as unknown as CanvasRenderingContext2D,
    );
  }
});

function setup() {
  const host = document.createElement("div");
  Object.defineProperties(host, {
    clientWidth: { value: 1000 },
    clientHeight: { value: 800 },
  });
  const canvas = new Canvas(document.createElement("canvas"));
  const camera = createViewportManager({
    canvas,
    host,
    artboard: () => ({ width: 1280, height: 720 }),
  });
  return { canvas, camera, host };
}

describe("viewport camera", () => {
  it("clamps zoom to its limits", () => {
    const { camera } = setup();
    camera.zoomToPoint(new Point(0, 0), 9999);
    expect(camera.zoom()).toBe(MAX_ZOOM);
    camera.zoomToPoint(new Point(0, 0), 0.000001);
    expect(camera.zoom()).toBe(MIN_ZOOM);
  });

  it("fits the whole artboard into the host", () => {
    const { camera } = setup();
    camera.zoomToFit();
    // contain-fit of 1280x720 into 1000x800 is limited by width.
    expect(camera.zoom()).toBeCloseTo(1000 / 1280, 5);
  });

  it("keeps the point under the cursor fixed while zooming", () => {
    const { canvas, camera } = setup();
    // A real MouseEvent, not {x, y}: getScenePoint resolves through getPointer,
    // which reads event.clientX/clientY. A bare object yields NaN on both sides
    // and toBeCloseTo can never pass on NaN.
    const at = (x: number, y: number) =>
      canvas.getScenePoint(
        new MouseEvent("pointermove", { clientX: x, clientY: y }),
      );

    // Anchor: at the identity transform the scene point IS the event's own
    // coordinates. jsdom reports a zero-size, unlaid-out element, so without
    // this the invariant below could hold by comparing 0 to 0.
    const identity = at(400, 300);
    expect(identity.x).toBe(400);
    expect(identity.y).toBe(300);

    camera.zoomToFit();
    const before = at(400, 300);
    expect(before.x).not.toBe(400);

    camera.zoomToPoint(new Point(400, 300), camera.zoom() * 2);
    const after = at(400, 300);
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  it("restores the view after panning far away", () => {
    const { camera } = setup();
    camera.zoomToFit();
    camera.panBy(-100000, -100000);
    camera.zoomToFit();
    expect(camera.zoom()).toBeCloseTo(1000 / 1280, 5);
  });

  it("notifies subscribers until they unsubscribe", () => {
    const { camera } = setup();
    const listener = vi.fn();
    const unsubscribe = camera.onChange(listener);

    camera.panBy(10, 10);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    camera.panBy(10, 10);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

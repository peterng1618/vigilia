// @vitest-environment jsdom

import { Canvas, Point } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createViewportManager, MAX_ZOOM, MIN_ZOOM } from "./index.js";

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
  // Read through a live holder rather than a fixed `value`, so a test can
  // resize the host the way a window does.
  const size = { width: 1000, height: 800 };
  Object.defineProperties(host, {
    clientWidth: { get: () => size.width },
    clientHeight: { get: () => size.height },
  });
  const canvas = new Canvas(document.createElement("canvas"));
  const camera = createViewportManager({
    canvas,
    host,
    artboard: () => ({ width: 1280, height: 720 }),
  });
  return {
    canvas,
    camera,
    host,
    /** The seam the ResizeObserver drives, driven directly instead. */
    resizeHost(width: number, height: number): void {
      size.width = width;
      size.height = height;
      camera.resize();
    },
  };
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

  it("reports the artboard rect in canvas coordinates, not client ones", () => {
    const { camera } = setup();
    camera.zoomToFit();
    // contain-fit of 1280x720 into 1000x800 is 0.78125, so the board draws
    // 1000x562.5 centred: a 118.75px band above and below.
    const scale = 1000 / 1280;
    expect(camera.artboardScreenRect()).toEqual({
      left: 0,
      top: (800 - 720 * scale) / 2,
      width: 1000,
      height: 720 * scale,
    });
  });

  it("moves the artboard rect with the pan", () => {
    const { camera } = setup();
    camera.zoomToFit();
    const before = camera.artboardScreenRect();
    camera.panBy(40, -25);
    expect(camera.artboardScreenRect()).toEqual({
      ...before,
      left: before.left + 40,
      top: before.top - 25,
    });
  });
});

describe("viewport camera on a host resize", () => {
  it("re-fits a camera that was showing the whole artboard", () => {
    const { camera, resizeHost } = setup();
    camera.zoomToFit();
    // Contain-fit of 1280x720 into 1000x800 is 0.78125.
    expect(camera.zoom()).toBeCloseTo(1000 / 1280, 5);

    resizeHost(400, 800);

    // The board was whole in the old box, so it is whole in the new one. A
    // camera that only held its zoom would leave 1290 of the board's pixels
    // past the right edge and the badge reading a number for the wrong view.
    const scale = 400 / 1280;
    expect(camera.zoom()).toBeCloseTo(scale, 5);
    expect(camera.artboardScreenRect()).toEqual({
      left: (400 - 1280 * scale) / 2,
      top: (800 - 720 * scale) / 2,
      width: 400,
      height: 720 * scale,
    });
  });

  it("re-fits on every step of a shrinking host", () => {
    const { camera, resizeHost } = setup();
    camera.zoomToFit();
    for (const width of [900, 700, 500, 300]) {
      resizeHost(width, 800);
      expect(camera.zoom()).toBeCloseTo(width / 1280, 5);
    }
  });

  it("keeps the zoom an author chose", () => {
    const { camera, resizeHost } = setup();
    camera.zoomToFit();
    camera.zoomToPoint(new Point(500, 400), camera.zoom() * 2);
    const zoomed = camera.zoom();
    expect(zoomed).toBeCloseTo((1000 / 1280) * 2, 5);

    resizeHost(400, 800);

    // The revert this replaces re-centred on every resize, which is what broke
    // `keeps the point under the cursor fixed while zooming`: a zoom the author
    // asked for is not the camera's to undo.
    expect(camera.zoom()).toBeCloseTo(zoomed, 5);
  });

  it("keeps the pan an author made", () => {
    const { camera, resizeHost } = setup();
    camera.zoomToFit();
    camera.panBy(-200, -50);
    const panned = camera.artboardScreenRect();

    resizeHost(500, 800);

    expect(camera.artboardScreenRect()).toEqual(panned);
  });

  it("keeps the point under the cursor across a resize", () => {
    const { canvas, camera, resizeHost } = setup();
    const at = (x: number, y: number) =>
      canvas.getScenePoint(
        new MouseEvent("pointermove", { clientX: x, clientY: y }),
      );

    camera.zoomToFit();
    camera.zoomToPoint(new Point(400, 300), camera.zoom() * 2);
    const before = at(400, 300);

    resizeHost(500, 700);

    // Read through the same accessor as the zooming test, so this pins the
    // camera not having moved rather than a transform tuple restated here.
    const after = at(400, 300);
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  it("fits again after the author takes the camera off fit", () => {
    const { camera, resizeHost } = setup();
    camera.zoomToFit();
    camera.panBy(-200, 0);
    resizeHost(400, 800);
    // Held: a pan is the author's, and the row is not about taking it back.
    expect(camera.zoom()).toBeCloseTo(1000 / 1280, 5);

    camera.zoomToFit();
    resizeHost(400, 800);

    expect(camera.zoom()).toBeCloseTo(400 / 1280, 5);
  });

  it("still sizes the canvas to the host", () => {
    const { canvas, resizeHost } = setup();
    resizeHost(640, 480);
    expect(canvas.getWidth()).toBe(640);
    expect(canvas.getHeight()).toBe(480);
  });

  it("refits nothing on the resize at construction", () => {
    // There is no camera yet: the canvas still carries Fabric's own 300x150
    // default and the identity transform, which is not a fit for this board. A
    // predicate that read the host — already at its real size by the time the
    // manager is built — would compare identity against that host and could
    // claim a fit nobody chose. `zoomToFit` is what establishes the first view.
    const { camera } = setup();
    expect(camera.zoom()).toBe(1);
    expect(camera.artboardScreenRect()).toEqual({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    });
  });
});

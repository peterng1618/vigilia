// @vitest-environment jsdom

import type { BackdropMedia } from "@vigilia/scene-fabric";
import type { Canvas } from "fabric/es";
import { describe, expect, it } from "vitest";
import { captureCanvas } from "./thumbnail-capture.js";

/** The plane the capture hands the backdrop sampler, in export pixels. */
function deviceFor(
  viewport: number[],
  artboard: { width: number; height: number },
  maxEdge?: number,
): { region: unknown; device: unknown } {
  let seen: { region: unknown; device: unknown } | undefined;
  const backdrop: BackdropMedia = {
    artboard,
    paint(_ctx, region, device) {
      seen = { region, device };
      return true;
    },
  };
  // jsdom has no Fabric canvas, and the compositing question is the plane the
  // media is drawn at, not Fabric's re-render. The export canvas is sized the
  // way `toCanvasElement` sizes it: the logical canvas times the multiplier.
  const canvas = {
    width: 1000,
    height: 500,
    viewportTransform: viewport,
    toCanvasElement: (multiplier: number) => {
      const shot = document.createElement("canvas");
      shot.width = 1000 * multiplier;
      shot.height = 500 * multiplier;
      return shot;
    },
  } as unknown as Canvas;
  captureCanvas(canvas, backdrop, maxEdge);
  if (seen === undefined) throw new Error("the backdrop was never painted");
  return seen;
}

describe("the capture's artboard plane", () => {
  it("places the media where the camera put the artboard", () => {
    // Zoom 0.4, offset 60/30, exported 1:1: the media covers a
    // quarter-scale artboard where the camera put it.
    const { region, device } = deviceFor(
      [0.4, 0, 0, 0.4, 60, 30],
      {
        width: 1000,
        height: 500,
      },
      1000,
    );
    expect(region).toEqual({ left: 0, top: 0, width: 1000, height: 500 });
    expect(device).toEqual({ left: 60, top: 30, width: 400, height: 200 });
  });

  it("scales the plane by the export multiplier, not just the zoom", () => {
    const { device } = deviceFor(
      [0.4, 0, 0, 0.4, 60, 30],
      {
        width: 1000,
        height: 500,
      },
      250,
    );
    expect(device).toEqual({ left: 15, top: 7.5, width: 100, height: 50 });
  });

  it("paints no media when the camera is degenerate", () => {
    expect(() =>
      deviceFor([0, 0, 0, 0, 0, 0], { width: 1000, height: 500 }),
    ).toThrow("the backdrop was never painted");
  });
});

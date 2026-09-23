// @vitest-environment jsdom
import { Canvas, FabricImage, Rect } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createErrorManager } from "../error-manager/index.js";
import { createCropManager, cropClipRect } from "./index.js";

// jsdom cannot drawImage an undecoded img inside Fabric's render pass; a proxy
// over a real context forwards everything, no-ops only drawImage, and swallows
// Fabric's node-canvas-only `patternQuality` writes. restoreMocks clears the spy
// after each test, so it is re-installed per test.
beforeEach(() => {
  const real = document.createElement("canvas").getContext("2d");
  if (real === null) return;
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
      }) as CanvasRenderingContext2D,
  );
});

function imageObject(options: Record<string, unknown> = {}): FabricImage {
  const element = document.createElement("img");
  Object.defineProperty(element, "naturalWidth", { value: 400 });
  Object.defineProperty(element, "naturalHeight", { value: 200 });
  const image = new FabricImage(element, { id: "image-1", ...options });
  image.set({ width: 400, height: 200 });
  return image;
}

function manager(canvas: Canvas, save = vi.fn()) {
  return createCropManager({
    canvas,
    save,
    suspend: () => () => {},
    errors: createErrorManager(canvas),
  });
}

describe("cropClipRect", () => {
  it("converts a centred frame to unscaled image-local units", () => {
    expect(
      cropClipRect({
        imageCentreX: 100,
        imageCentreY: 100,
        scaleX: 2,
        scaleY: 2,
        frame: { centreX: 100, centreY: 100, width: 200, height: 100 },
      }),
    ).toEqual({ width: 100, height: 50, left: 0, top: 0 });
  });

  it("offsets a frame that is not centred on the image", () => {
    expect(
      cropClipRect({
        imageCentreX: 100,
        imageCentreY: 100,
        scaleX: 2,
        scaleY: 4,
        frame: { centreX: 140, centreY: 60, width: 80, height: 40 },
      }),
    ).toEqual({ width: 40, height: 10, left: 20, top: -10 });
  });

  it("refuses a non-finite or non-positive scale", () => {
    const base = {
      imageCentreX: 0,
      imageCentreY: 0,
      scaleY: 1,
      frame: { centreX: 0, centreY: 0, width: 10, height: 10 },
    };
    expect(() => cropClipRect({ ...base, scaleX: 0 })).toThrow();
    expect(() => cropClipRect({ ...base, scaleX: Number.NaN })).toThrow();
  });
});

describe("CropManager", () => {
  it("adds an export-excluded frame over the active image", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const crop = manager(canvas);

    expect(crop.begin()).toBe(true);
    expect(crop.active).toBe(true);
    const frame = canvas.getObjects().find((object) => object !== image);
    expect(frame).toBeInstanceOf(Rect);
    expect(frame?.excludeFromExport).toBe(true);
  });

  it("refuses to crop a rotated image and warns", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject({ angle: 30 });
    canvas.add(image);
    canvas.setActiveObject(image);
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
    const crop = manager(canvas);

    expect(crop.begin()).toBe(false);
    expect(crop.active).toBe(false);
    expect(canvas.getObjects()).toEqual([image]);
    expect(warned).toHaveBeenCalledOnce();
    warned.mockRestore();
  });

  it("refuses to start when the active object is not an image", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const shape = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(shape);
    canvas.setActiveObject(shape);
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
    const crop = manager(canvas);

    expect(crop.begin()).toBe(false);
    warned.mockRestore();
  });

  it("commits a clipPath and one history entry on apply", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const save = vi.fn();
    const crop = manager(canvas, save);
    crop.begin();

    crop.apply();

    expect(image.clipPath).toBeInstanceOf(Rect);
    expect(crop.active).toBe(false);
    expect(canvas.getObjects()).toEqual([image]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("leaves the image untouched and saves nothing on cancel", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const save = vi.fn();
    const crop = manager(canvas, save);
    crop.begin();

    crop.cancel();

    expect(image.clipPath).toBeUndefined();
    expect(crop.active).toBe(false);
    expect(canvas.getObjects()).toEqual([image]);
    expect(save).not.toHaveBeenCalled();
  });

  it("releases history suspension exactly once per session", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const release = vi.fn();
    const crop = createCropManager({
      canvas,
      save: vi.fn(),
      suspend: () => release,
      errors: createErrorManager(canvas),
    });

    crop.begin();
    crop.apply();
    crop.apply();

    expect(release).toHaveBeenCalledOnce();
  });

  it("locks the frame to an aspect ratio", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const crop = manager(canvas);
    crop.begin();

    crop.setAspect(1);

    const frame = canvas
      .getObjects()
      .find((object): object is Rect => object !== image) as Rect;
    expect(frame.getScaledWidth()).toBeCloseTo(frame.getScaledHeight(), 5);
  });
});

// @vitest-environment jsdom
import { Canvas, FabricImage } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { boundedImportSize, boundedImageElement, createImageManager } from "./index.js";

/** jsdom never loads images; capture decode's src and resolve the load event. */
function interceptDecode(): { readonly urls: string[] } {
  const urls: string[] = [];
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "src",
  )!;
  vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(
    function (this: HTMLImageElement, value: string) {
      urls.push(value);
      descriptor.set!.call(this, value);
      this.dispatchEvent(new Event("load"));
    },
  );
  return { urls };
}

function decodedImage(
  width: number,
  height: number,
): HTMLImageElement {
  const element = document.createElement("img");
  Object.defineProperty(element, "naturalWidth", { value: width });
  Object.defineProperty(element, "naturalHeight", { value: height });
  return element;
}

describe("ImageManager", () => {
  it("imports, adds and selects an image, then saves history", async () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const manager = createImageManager(canvas, save);
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:image");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    const element = decodedImage(200, 100);
    vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(
      function (this: HTMLImageElement, value: string) {
        Object.defineProperty(this, "naturalWidth", { value: 200 });
        Object.defineProperty(this, "naturalHeight", { value: 100 });
        this.dispatchEvent(new Event("load"));
      },
    );
    const file = new File(["pixels"], "logo.png", { type: "image/png" });

    const result = await manager.importImage({ source: file });

    expect(result?.image).toBeInstanceOf(FabricImage);
    expect(canvas.getActiveObject()).toBe(result?.image);
    expect(save).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:image");
    expect(result?.image.get("id")).toMatch(/^image-[0-9a-f-]{36}$/);
    expect(result?.image.get("format")).toBe("png");
  });

  it("derives format from the source MIME type", async () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const manager = createImageManager(canvas, vi.fn());
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    interceptDecode();
    const file = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });

    const result = await manager.importImage({ source: file });

    expect(result?.image.get("format")).toBe("svg");
  });

  it("skips adding and saving when withoutAdding is set", async () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const manager = createImageManager(canvas, save);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    interceptDecode();
    const file = new File(["pixels"], "logo.png", { type: "image/png" });

    await manager.importImage({ source: file, withoutAdding: true });

    expect(canvas.getActiveObject()).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });
});

describe("boundedImportSize", () => {
  it("leaves an image within the bound untouched", () => {
    expect(boundedImportSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it("scales the longest edge down to the bound and preserves aspect", () => {
    expect(boundedImportSize(8192, 4096)).toEqual({ width: 4096, height: 2048 });
    expect(boundedImportSize(4096, 8192)).toEqual({ width: 2048, height: 4096 });
  });

  it("never rounds a bounded edge below one pixel", () => {
    expect(boundedImportSize(10000, 1)).toEqual({ width: 4096, height: 1 });
  });

  it("refuses a non-finite or non-positive dimension", () => {
    expect(() => boundedImportSize(Number.NaN, 100)).toThrow();
    expect(() => boundedImportSize(0, 100)).toThrow();
    expect(() => boundedImportSize(100, -1)).toThrow();
  });

  it("honours an explicit bound", () => {
    expect(boundedImportSize(1000, 500, 100)).toEqual({
      width: 100,
      height: 50,
    });
  });
});

describe("boundedImageElement", () => {
  it("returns an oversized element downscaled through a canvas", () => {
    const context = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const source = decodedImage(8192, 4096);

    const bounded = boundedImageElement(source);

    expect(bounded).not.toBe(source);
    expect((bounded as HTMLCanvasElement).width).toBe(4096);
    expect((bounded as HTMLCanvasElement).height).toBe(2048);
    expect(context.drawImage).toHaveBeenCalledWith(
      source,
      0,
      0,
      4096,
      2048,
    );
  });

  it("returns the source unchanged when it already fits", () => {
    const source = decodedImage(1920, 1080);

    expect(boundedImageElement(source)).toBe(source);
  });
});

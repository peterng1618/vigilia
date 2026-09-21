// @vitest-environment jsdom
import { Canvas, FabricImage } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createImageManager } from "./index.js";

describe("ImageManager", () => {
  it("imports, adds and selects an image, then saves history", async () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const manager = createImageManager(canvas, save);
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:image");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    const set = vi.fn();
    const image = Object.assign(Object.create(FabricImage.prototype), {
      set,
    }) as FabricImage;
    vi.spyOn(FabricImage, "fromURL").mockResolvedValue(image);
    const file = new File(["pixels"], "logo.png", { type: "image/png" });

    const result = await manager.importImage({ source: file });

    expect(result).toEqual({ image });
    expect(canvas.getActiveObject()).toBe(image);
    expect(save).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:image");
    expect(set).toHaveBeenCalledWith({
      id: expect.stringMatching(/^image-[0-9a-f-]{36}$/),
      format: "png",
    });
  });

  it("derives format from the source MIME type", async () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const manager = createImageManager(canvas, vi.fn());
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const set = vi.fn();
    const image = Object.assign(Object.create(FabricImage.prototype), {
      set,
    }) as FabricImage;
    vi.spyOn(FabricImage, "fromURL").mockResolvedValue(image);
    const file = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });

    await manager.importImage({ source: file });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ format: "svg" }),
    );
  });

  it("skips adding and saving when withoutAdding is set", async () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();
    const manager = createImageManager(canvas, save);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const image = Object.assign(Object.create(FabricImage.prototype), {
      set() {},
    }) as FabricImage;
    vi.spyOn(FabricImage, "fromURL").mockResolvedValue(image);
    const file = new File(["pixels"], "logo.png", { type: "image/png" });

    await manager.importImage({ source: file, withoutAdding: true });

    expect(canvas.getActiveObject()).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });
});

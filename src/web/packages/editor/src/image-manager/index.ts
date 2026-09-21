import { FabricImage, type Canvas, type FabricObject } from "fabric/es";

export interface ImageManager {
  importImage(options: {
    readonly source: File;
    readonly scale?: "image-contain" | "image-cover" | "scale-montage";
    readonly withoutAdding?: boolean;
    readonly withoutSave?: boolean;
  }): Promise<{ readonly image: FabricObject } | null>;
}

export function createImageManager(canvas: Canvas, save: () => void): ImageManager {
  return {
    async importImage(options) {
      const url = URL.createObjectURL(options.source);
      try {
        const image = await FabricImage.fromURL(url);
        if (!options.withoutAdding) {
          canvas.add(image);
          canvas.setActiveObject(image);
          if (!options.withoutSave) save();
        }
        return { image };
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  };
}

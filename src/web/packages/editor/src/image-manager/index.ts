import { type Canvas, FabricImage, type FabricObject } from "fabric/es";
import { newObjectName } from "../new-object-defaults.js";

/**
 * Decoded-pixel ceiling for imported and rehydrated images. Unrelated to
 * `MAX_ARTBOARD_DIMENSION`, which bounds document geometry, not pixels.
 */
export const MAX_IMPORT_IMAGE_EDGE = 4096;

export interface ImageManager {
  importImage(options: {
    readonly source: File;
    readonly scale?: "image-contain" | "image-cover" | "scale-montage";
    readonly withoutAdding?: boolean;
    readonly withoutSave?: boolean;
  }): Promise<{ readonly image: FabricObject } | null>;
  /** Revokes every object URL still held. */
  destroy(): void;
}

/** The MIME subtype (e.g. "png" from "image/png"); empty when unrecognised. */
function formatOf(mimeType: string): string {
  return /^[^/]+\/([^+;]+)/.exec(mimeType)?.[1] ?? "";
}

export function boundedImportSize(
  width: number,
  height: number,
  maxEdge: number = MAX_IMPORT_IMAGE_EDGE,
): { readonly width: number; readonly height: number } {
  for (const value of [width, height, maxEdge]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        "An image bound needs finite, positive width, height and maximum edge.",
      );
    }
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Both attachment points bound the element, so Open cannot change the geometry
 * import produced.
 */
export function boundedImageElement(
  source: HTMLImageElement,
  maxEdge: number = MAX_IMPORT_IMAGE_EDGE,
): HTMLImageElement | HTMLCanvasElement {
  const natural = {
    width: Math.max(1, source.naturalWidth),
    height: Math.max(1, source.naturalHeight),
  };
  const bounded = boundedImportSize(natural.width, natural.height, maxEdge);
  if (bounded.width === natural.width && bounded.height === natural.height) {
    return source;
  }
  const canvas = document.createElement("canvas");
  canvas.width = bounded.width;
  canvas.height = bounded.height;
  const context = canvas.getContext("2d");
  // A context is unavailable only when the browser refuses one; the unbounded
  // element still renders correctly, so import proceeds rather than failing.
  if (context === null) return source;
  context.drawImage(source, 0, 0, bounded.width, bounded.height);
  return canvas;
}

async function decode(url: string): Promise<HTMLImageElement> {
  const element = document.createElement("img");
  element.alt = "";
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    element.addEventListener("load", () => resolve(element), { once: true });
    element.addEventListener(
      "error",
      () => reject(new Error("Could not decode the selected image.")),
      { once: true },
    );
  });
  element.src = url;
  return loaded;
}

export function createImageManager(
  canvas: Canvas,
  save: () => void,
): ImageManager {
  /**
   * Every object URL this session minted.
   *
   * An image's persisted `src` is its object URL, and a history entry names it
   * for as long as that entry can be restored — which outlives the image
   * instance, because undo replaces every object with a new one. Revoking on
   * removal therefore broke redo, and revoking on decode (what this did) broke
   * undo outright: Fabric could not enliven the image and dropped it, so undo
   * deleted the author's asset instead of the edit they asked it to reverse.
   *
   * The list is bounded by the number of imports in one editing session and is
   * released with the manager.
   */
  const live = new Set<string>();

  return {
    async importImage(options) {
      const url = URL.createObjectURL(options.source);
      let decoded: HTMLImageElement;
      try {
        decoded = await decode(url);
      } catch (error) {
        // Nothing decoded and no history entry will ever name this URL, so this
        // is the one case where revoking immediately is right.
        URL.revokeObjectURL(url);
        throw error;
      }
      live.add(url);
      const image = new FabricImage(boundedImageElement(decoded));
      image.set({
        id: `image-${crypto.randomUUID()}`,
        name: newObjectName("image"),
        format: formatOf(options.source.type),
      });
      if (!options.withoutAdding) {
        canvas.add(image);
        canvas.setActiveObject(image);
        if (!options.withoutSave) save();
      }
      return { image };
    },

    destroy(): void {
      for (const url of live) URL.revokeObjectURL(url);
      live.clear();
    },
  };
}

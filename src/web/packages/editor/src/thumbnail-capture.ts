import type { Canvas } from "fabric/es";

/**
 * A PNG of the artboard, for the theme library to show.
 *
 * Rendered from the editor's own canvas, which already has the theme on screen
 * with its fonts loaded: the picture is this machine's rendering, which is what
 * a consumer choosing a look wants to see. No second renderer is involved (§31).
 */

/** Longest edge of the stored picture; a library card needs no more. */
const MAX_EDGE = 640;

export async function captureThumbnail(
  canvas: Canvas,
  maxEdge = MAX_EDGE,
): Promise<Uint8Array | undefined> {
  const width = canvas.width;
  const height = canvas.height;

  if (!(width > 0) || !(height > 0)) {
    // Nothing has been laid out yet; a picture would be blank.
    return undefined;
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const source = canvas.toCanvasElement(scale);
  const blob = await new Promise<Blob | null>((resolve) =>
    source.toBlob((result) => resolve(result), "image/png"),
  );

  if (blob === null) {
    return undefined;
  }

  return new Uint8Array(await blob.arrayBuffer());
}

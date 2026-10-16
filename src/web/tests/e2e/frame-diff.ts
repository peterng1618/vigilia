/**
 * The frame-differencing measure: where a treatment landed, read from two
 * decoded captures of the same scene.
 *
 * One instrument, because `vg-516` was two of them: a thresholded frost box is
 * only a measurement if every caller differences the same way, and the two
 * harnesses that read the same frost 3.6 % apart differed in nothing but which
 * untreated capture was the baseline. The comparison is against the **object's
 * own box** read from the page rather than against another reading of the
 * frost, so the instrument is never compared with itself.
 *
 * A screenshot decoded in Node rather than a readback on the live canvas: a
 * readback races Fabric's repaint.
 */

/**
 * 6/255: above what a PNG round-trip and the 1.5 % grain leave behind, and far
 * below the tens of luma a 30 % tint and a blur of this backdrop move.
 */
export const THRESHOLD = 6;

export interface Frame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export async function decode(shot: Buffer): Promise<Frame> {
  const { createCanvas, loadImage } = await import("canvas");
  const image = await loadImage(shot);
  const surface = createCanvas(image.width, image.height);
  const context = surface.getContext("2d");
  context.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: context.getImageData(0, 0, image.width, image.height).data,
  };
}

export const luma = (frame: Frame, x: number, y: number): number => {
  const i = (y * frame.width + x) * 4;
  return (
    0.2126 * (frame.data[i] ?? 0) +
    0.7152 * (frame.data[i + 1] ?? 0) +
    0.0722 * (frame.data[i + 2] ?? 0)
  );
};

/** Where the treatment landed: the box of the pixels the two captures differ on. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function frostBox(frosted: Frame, bare: Frame): Box | undefined {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let area = 0;
  for (let y = 0; y < frosted.height; y += 1)
    for (let x = 0; x < frosted.width; x += 1)
      if (Math.abs(luma(frosted, x, y) - luma(bare, x, y)) > THRESHOLD) {
        area += 1;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  // A scene the treatment never reached measures nothing.
  return area === 0 ? undefined : { left, top, right, bottom };
}

/**
 * The frost the treatment reached **inside `region`**, as frame pixels.
 *
 * `frostBox` answers "where is the treatment in this frame", which for a
 * two-object scene is the union of both frosts. Reading **one** object's extent
 * means restricting the count to a region every baseline is measured through,
 * and keeping the pixels for the outline comparison below.
 */
export function frostWithin(
  frosted: Frame,
  bare: Frame,
  region: Box,
): Set<number> {
  const pixels = new Set<number>();
  for (let y = region.top; y <= region.bottom; y += 1)
    for (let x = region.left; x <= region.right; x += 1)
      if (Math.abs(luma(frosted, x, y) - luma(bare, x, y)) > THRESHOLD)
        pixels.add(y * frosted.width + x);
  return pixels;
}

/** The box a pixel set covers. */
export function boxOf(
  frame: Frame,
  pixels: ReadonlySet<number>,
): Box | undefined {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const index of pixels) {
    const x = index % frame.width;
    const y = (index - x) / frame.width;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  return left === Number.POSITIVE_INFINITY
    ? undefined
    : { left, top, right, bottom };
}

/** How far a pixel sits from a box's own outline, inside it or out. */
function distanceToOutline(box: Box, x: number, y: number): number {
  const inside =
    x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  if (!inside)
    return Math.hypot(
      Math.max(box.left - x, 0, x - box.right),
      Math.max(box.top - y, 0, y - box.bottom),
    );
  return Math.min(x - box.left, box.right - x, y - box.top, box.bottom - y);
}

/**
 * The pixels crossing the threshold under exactly one of two baselines, and how
 * far the deepest of them sits from the reference frost's own outline.
 *
 * `vg-516`'s 462 px sat on the rect box's outer rim. A rim is where the frost's
 * own coverage is fractional, so a baseline that differs by even a luma flips
 * those pixels and nothing else; a disagreement reaching the interior is a
 * different finding, and this number is what tells them apart.
 */
export function outlineDifference(
  a: ReadonlySet<number>,
  b: ReadonlySet<number>,
  frame: Frame,
  outline: Box,
): { only: number; deepest: number } {
  let only = 0;
  let deepest = 0;
  const consider = (index: number): void => {
    only += 1;
    const x = index % frame.width;
    const y = (index - x) / frame.width;
    const distance = distanceToOutline(outline, x, y);
    if (distance > deepest) deepest = distance;
  };
  for (const index of a) if (!b.has(index)) consider(index);
  for (const index of b) if (!a.has(index)) consider(index);
  return { only, deepest };
}

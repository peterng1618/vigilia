import { uiCopy } from "./ui-copy.js";

/**
 * Names the scene objects this artboard does not contain, and which way the
 * composition ran off the frame.
 *
 * The player is the only place that can measure this: Fabric clips the canvas
 * to the artboard rect (`adapter.ts`), so an object outside it is drawn
 * nowhere — not shrunk, not scaled away, simply never painted. A phone and a
 * wall display lose it identically, so a reader cannot tell a short dashboard
 * from a broken one. The artboard panel owns what a size means and states the
 * rule to the author; this is the display's half, measured rather than assumed.
 */

/** One object in artboard units, as Fabric reports it for the scene plane. */
export interface SceneBox {
  readonly visible: boolean;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ArtboardSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Artboard units of slack at an edge. Fabric's own coordinates are fractional,
 * so a panel the author placed flush against the edge must not be reported as
 * cropped over a rounding error; at the tightest fit this repo offers, a unit
 * is a fraction of a pixel.
 */
const EDGE_TOLERANCE = 1;

/**
 * Objects a reader cannot see, or that must not be counted as lost.
 *
 * An object the author hid is not cropped, so counting it would put a false
 * cause next to the real one; an object with no area paints nothing at any
 * position. Both are the author's own doing, and this notice exists to say what
 * the *artboard* lost.
 */
function countable(box: SceneBox): boolean {
  return box.visible && box.width > 0 && box.height > 0;
}

function right(box: SceneBox): number {
  return box.left + box.width;
}

function bottom(box: SceneBox): number {
  return box.top + box.height;
}

/**
 * What the display is not showing, or `undefined` when it shows all of it.
 * `total` is every countable object, so the line reads as a proportion of the
 * dashboard rather than a bare complaint.
 */
export function cropNoticeText(
  boxes: readonly SceneBox[],
  artboard: ArtboardSize,
): string | undefined {
  const counted = boxes.filter(countable);
  const outside = counted.filter(
    (box) =>
      box.left < -EDGE_TOLERANCE ||
      box.top < -EDGE_TOLERANCE ||
      right(box) > artboard.width + EDGE_TOLERANCE ||
      bottom(box) > artboard.height + EDGE_TOLERANCE,
  );

  if (outside.length === 0) {
    return undefined;
  }

  // The sides, in a fixed order so the same theme always reads the same way.
  // A composition too wide for its frame is the common case — a ratio change
  // narrows the width and leaves the height alone — and naming the side is
  // what tells a reader the frame is too narrow rather than the content wrong.
  const edges: string[] = [];
  if (outside.some((box) => right(box) > artboard.width + EDGE_TOLERANCE)) {
    edges.push(uiCopy.croppedEdges.right);
  }
  if (outside.some((box) => bottom(box) > artboard.height + EDGE_TOLERANCE)) {
    edges.push(uiCopy.croppedEdges.bottom);
  }
  if (outside.some((box) => box.left < -EDGE_TOLERANCE)) {
    edges.push(uiCopy.croppedEdges.left);
  }
  if (outside.some((box) => box.top < -EDGE_TOLERANCE)) {
    edges.push(uiCopy.croppedEdges.top);
  }

  return uiCopy.cropped(outside.length, counted.length, edges);
}

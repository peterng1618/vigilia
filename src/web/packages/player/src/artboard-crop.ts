import {
  bottom,
  countable,
  EDGE_TOLERANCE,
  outsideBoxes,
  right,
  type ArtboardSize,
  type SceneBox,
} from "@vigilia/scene-fabric";
import { uiCopy } from "./ui-copy.js";

/**
 * Names the scene objects this artboard does not contain, and which way the
 * composition ran off the frame.
 *
 * The player is the surface that made this necessary: Fabric clips the canvas
 * to the artboard rect (`adapter.ts`), so an object outside it is drawn nowhere —
 * not shrunk, not scaled away, simply never painted. A phone and a wall display
 * lose it identically, so a reader cannot tell a short dashboard from a broken
 * one. The artboard panel owns what a size means and states the rule to the
 * author; this is the display's half.
 *
 * **The counting is not here.** Which objects the artboard does not contain is
 * a fact about the scene, and the editor needs the same number for the same
 * reason — it changes the artboard and is the one surface where the figure is
 * actionable. So it lives in `scene-fabric` and this module supplies only what
 * a display says about it.
 */
export type { ArtboardSize, SceneBox };
export { countable, EDGE_TOLERANCE };

export function cropNoticeText(
  boxes: readonly SceneBox[],
  artboard: ArtboardSize,
): string | undefined {
  const counted = boxes.filter(countable);
  const outside = outsideBoxes(boxes, artboard);

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

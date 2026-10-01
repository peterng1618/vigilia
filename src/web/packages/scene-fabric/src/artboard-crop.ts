import { type FabricObject, Group } from "fabric/es";

/**
 * Which scene objects an artboard does not contain.
 *
 * Both surfaces need this and only one had it. The player counts because
 * Fabric clips its canvas to the artboard rect (`adapter.ts`), so an object
 * outside is drawn nowhere — not shrunk, not scaled away, simply never painted —
 * and a reader cannot tell a short dashboard from a broken one. The editor
 * changes the artboard and kept saying the same sentence at every size, which is
 * the same measurement with the number left out.
 *
 * The counting lives here rather than in either surface because it is a fact
 * about the scene, not about what a display or an inspector chooses to say
 * about it.
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
export const EDGE_TOLERANCE = 1;

/**
 * Objects that can count. An object the author hid is not cropped, so counting
 * it would put a false cause next to the real one; an object with no area
 * paints nothing at any position. Both are the author's own doing.
 */
export function countable(box: SceneBox): boolean {
  return box.visible && box.width > 0 && box.height > 0;
}

export function right(box: SceneBox): number {
  return box.left + box.width;
}

export function bottom(box: SceneBox): number {
  return box.top + box.height;
}

/** Which edges ran off the frame, in a fixed order so a theme reads the same. */
export function outsideEdges(
  boxes: readonly SceneBox[],
  artboard: ArtboardSize,
): readonly ("left" | "right" | "top" | "bottom")[] {
  const outside = outsideBoxes(boxes, artboard);
  const edges: ("left" | "right" | "top" | "bottom")[] = [];
  if (outside.some((box) => right(box) > artboard.width + EDGE_TOLERANCE)) {
    edges.push("right");
  }
  if (outside.some((box) => bottom(box) > artboard.height + EDGE_TOLERANCE)) {
    edges.push("bottom");
  }
  if (outside.some((box) => box.left < -EDGE_TOLERANCE)) edges.push("left");
  if (outside.some((box) => box.top < -EDGE_TOLERANCE)) edges.push("top");
  return edges;
}

/**
 * How many countable objects the artboard does not contain, out of how many it
 * could. The total is what makes the figure a proportion of the dashboard
 * rather than a bare complaint.
 */
export function outsideCount(
  boxes: readonly SceneBox[],
  artboard: ArtboardSize,
): { readonly outside: number; readonly counted: number } {
  const counted = boxes.filter(countable);
  const outside = counted.filter(
    (box) =>
      box.left < -EDGE_TOLERANCE ||
      box.top < -EDGE_TOLERANCE ||
      right(box) > artboard.width + EDGE_TOLERANCE ||
      bottom(box) > artboard.height + EDGE_TOLERANCE,
  );
  return { outside: outside.length, counted: counted.length };
}

export function outsideBoxes(
  boxes: readonly SceneBox[],
  artboard: ArtboardSize,
): readonly SceneBox[] {
  return boxes
    .filter(countable)
    .filter(
      (box) =>
        box.left < -EDGE_TOLERANCE ||
        box.top < -EDGE_TOLERANCE ||
        right(box) > artboard.width + EDGE_TOLERANCE ||
        bottom(box) > artboard.height + EDGE_TOLERANCE,
    );
}

/**
 * Fabric objects as the boxes this counts, groups flattened to their children.
 *
 * A group is a box AND its children, not one or the other: the group is what
 * Fabric draws and what a display loses, and its children are what an author
 * selects and moves.
 */
export function sceneBoxesOf(objects: readonly FabricObject[]): SceneBox[] {
  return objects.flatMap((object) => {
    const rect = object.getBoundingRect();
    // An object that has not been laid out reports no rect, and reading it
    // would take the whole editor down over a count.
    if (rect === undefined) return [];
    const box: SceneBox = {
      visible: object.visible,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    return object instanceof Group
      ? [box, ...sceneBoxesOf(object.getObjects())]
      : [box];
  });
}

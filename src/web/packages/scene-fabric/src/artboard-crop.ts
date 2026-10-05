import { objectBleeds } from "@vigilia/renderer-core";
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
  /**
   * Whether the author marked this object's overhang as deliberate.
   *
   * False is the default and not a third state: `objectBleeds` reads absence
   * and a malformed value alike as "not marked", so a scene authored before
   * the flag — and a file too broken to trust — count exactly as they did.
   */
  readonly bleeds: boolean;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /**
   * 0 at the canvas root, one deeper inside a group.
   *
   * `sceneBoxesOf` emits a box before its own children, so the depth alone
   * says which boxes are a box's ancestors — which is what lets the counting
   * below stop at a group that is already outside instead of reporting its
   * parts again.
   */
  readonly depth: number;
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
 * paints nothing at any position; an object the author marked as bleeding has
 * already been said to run off on purpose. All three are the author's own doing.
 *
 * The exclusion lives here rather than in a branch of each reader because
 * `outsideCount`, `outsideEdges` and `outsideBoxes` all go through
 * `countedBoxes`, and both surfaces are handed boxes by `sceneBoxesOf`. A mark
 * honoured anywhere else would let the editor's count and the player's notice
 * disagree about the same theme — the split this flag exists to close.
 *
 * **A marked box is skipped, not descended-past.** The mark silences the object
 * it is on and nothing else: the walk carries on into a marked group's children,
 * each judged for itself. That is the plan's stated behaviour twice over — "a
 * marked object hiding a *real* problem (it must not suppress warnings about its
 * own internal parts)", and "marking a group does not silence its children" — and
 * a watermark here would suppress exactly the internal-part warning they are
 * about. An author who marks a card and still sees a notice for a panel that
 * genuinely sits outside it is being told something true.
 *
 * It also means a marked card that hangs off the edge reports once per part. That
 * is a real cost and it is **not settled here**: whether that is noise the plan
 * has not anticipated is a question above this file, not one a task answers by
 * editing the traversal.
 */
export function countable(box: SceneBox): boolean {
  return box.visible && !box.bleeds && box.width > 0 && box.height > 0;
}

export function right(box: SceneBox): number {
  return box.left + box.width;
}

export function bottom(box: SceneBox): number {
  return box.top + box.height;
}

/** Whether the artboard does not contain the box. */
function beyond(box: SceneBox, artboard: ArtboardSize): boolean {
  return (
    box.left < -EDGE_TOLERANCE ||
    box.top < -EDGE_TOLERANCE ||
    right(box) > artboard.width + EDGE_TOLERANCE ||
    bottom(box) > artboard.height + EDGE_TOLERANCE
  );
}

/**
 * The boxes a crop notice is made of, in one traversal.
 *
 * `sceneBoxesOf` emits a group before its own children, so one pass with a
 * single depth watermark is enough to know that a box sits inside a group the
 * count already reported. That group is the thing the artboard does not
 * contain: what a display loses is the card, not the seven boxes inside it, and
 * a starter whose cards are groups would otherwise report one cropped card
 * eight times — which destroys the number's only job, telling a reader that a
 * short dashboard is not a broken one.
 *
 * A group the artboard *does* contain is descended into, so a part that runs
 * off on its own is still reported as itself.
 */
function countedBoxes(
  boxes: readonly SceneBox[],
  artboard: ArtboardSize,
): { readonly counted: number; readonly outside: readonly SceneBox[] } {
  const outside: SceneBox[] = [];
  let counted = 0;
  // The depth of the node already reported as outside, or undefined while the
  // walk is outside no such subtree.
  let reportedAt: number | undefined;
  for (const box of boxes) {
    if (reportedAt !== undefined) {
      // Deeper than it, so it belongs to that node rather than standing alone.
      if (box.depth > reportedAt) continue;
      // Back at its level or above: this subtree is over.
      reportedAt = undefined;
    }
    if (!countable(box)) continue;
    counted += 1;
    if (beyond(box, artboard)) {
      outside.push(box);
      reportedAt = box.depth;
    }
  }
  return { counted, outside };
}

/** Which edges ran off the frame, in a fixed order so a theme reads the same. */
export function outsideEdges(
  boxes: readonly SceneBox[],
  artboard: ArtboardSize,
): readonly ("left" | "right" | "top" | "bottom")[] {
  const outside = countedBoxes(boxes, artboard).outside;
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
  const { counted, outside } = countedBoxes(boxes, artboard);
  return { outside: outside.length, counted };
}

/** The boxes the artboard does not contain, one per thing that is lost. */
export function outsideBoxes(
  boxes: readonly SceneBox[],
  artboard: ArtboardSize,
): readonly SceneBox[] {
  return countedBoxes(boxes, artboard).outside;
}

/**
 * Fabric objects as the boxes this counts, groups flattened to their children.
 *
 * A group is a box AND its children, not one or the other: the group is what
 * Fabric draws and what a display loses, and its children are what an author
 * selects and moves.
 */
export function sceneBoxesOf(
  objects: readonly FabricObject[],
  depth = 0,
): SceneBox[] {
  return objects.flatMap((object) => {
    const rect = object.getBoundingRect();
    // An object that has not been laid out reports no rect, and reading it
    // would take the whole editor down over a count.
    if (rect === undefined) return [];
    const box: SceneBox = {
      visible: object.visible,
      // Read here, once, so both surfaces see the same mark. The editor writes
      // the property and the phone reads the box; a second read site would be a
      // second chance for the two to disagree.
      bleeds: objectBleeds(object),
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      depth,
    };
    return object instanceof Group
      ? [box, ...sceneBoxesOf(object.getObjects(), depth + 1)]
      : [box];
  });
}

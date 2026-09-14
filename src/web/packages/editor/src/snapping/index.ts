import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
import { placeNodes, unionBounds, type Point } from '../geometry.js';
import {
  collectSnapTargets,
  snapMove,
  thresholdInDocumentUnits,
  type SnapGuide,
} from './resolver.js';

/**
 * Snap threshold in viewport pixels, converted to document units per gesture.
 *
 * Pixels rather than document units on purpose: a snap should feel the same
 * regardless of how far the artboard is zoomed, and the conversion needs the
 * live scale, which only exists during a gesture.
 */
const SNAP_PIXELS = 7;

/**
 * Where a dragged thing lands, and the guides that explain why.
 *
 * ## Persisted / derived / transient
 *
 * All of it is transient. The guides are what the overlay draws mid-gesture
 * and nothing else; they never reach the document, and they are cleared when
 * a gesture ends rather than left for the next one to inherit.
 *
 * ## Snapping applies to a move, not a resize
 *
 * A snapped resize needs the moving *edge* compared against targets rather
 * than the whole box, which is a different calculation. It is left off rather
 * than approximated with the wrong one — a resize that snapped its far edge
 * would be worse than one that does not snap at all.
 */
export class SnappingManager implements EditorManager {
  public readonly editor: EditorCore;

  #guides: readonly SnapGuide[] = [];

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  /** The guides to draw right now. Empty outside a gesture. */
  public get guides(): readonly SnapGuide[] {
    return this.#guides;
  }

  /**
   * Adjusts a move delta so the moving bounds land on a nearby edge or
   * centre, and remembers the guides that explain the result.
   *
   * `movingIds` is **what the gesture will actually transform**, which is not
   * always what is selected: moving a group moves its children, so a
   * selection holding both transforms the group alone (§57). The shell used
   * to pass the selection instead, which is the same set in every case
   * reachable today — but "what moves" is the question this is asking, and
   * asking it directly is what keeps the answer right when the two diverge.
   *
   * Descendants need no special handling: `collectSnapTargets` already drops
   * any node whose ancestor is excluded, so a moving group never offers its
   * own children as alignments.
   *
   * @returns the delta to use — unchanged when nothing was near enough, or
   * when the moving set has no bounds to measure.
   */
  public resolveMove(input: {
    readonly movingIds: readonly string[];
    readonly delta: Point;
    /** Viewport scale, for converting the pixel threshold. */
    readonly scale: number;
  }): Point {
    const document_ = this.editor.document.current;
    const placements = placeNodes(document_.nodes);
    const moving = new Set(input.movingIds);
    const bounds = unionBounds(placements.filter((node) => moving.has(node.id)));

    if (bounds === undefined) {
      this.clear();

      return input.delta;
    }

    const snapped = snapMove(
      bounds,
      input.delta,
      collectSnapTargets(placements, document_.artboard, moving),
      { threshold: thresholdInDocumentUnits(SNAP_PIXELS, input.scale) },
    );

    this.#guides = snapped.guides;

    return snapped.delta;
  }

  /** Drops the guides — the end of a gesture, or a move that cannot snap. */
  public clear(): void {
    this.#guides = [];
  }

  public destroy(): void {
    this.clear();
  }
}

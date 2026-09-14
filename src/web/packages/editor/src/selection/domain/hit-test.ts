import type { ThemeNode } from '@vigilia/renderer-core';
import {
  boundsContain,
  boundsIntersect,
  containsPoint,
  placeNodes,
  worldBounds,
  type Bounds,
  type PlacedNode,
  type Point,
} from '../../geometry.js';

/**
 * Which node a gesture is aimed at.
 *
 * ## The rule, and why it is not "smallest" or "nearest"
 *
 * The topmost node containing the point wins. Topmost means last in paint order
 * (§137: child order alone determines stacking), so a later sibling beats an
 * earlier one and a child beats its parent.
 *
 * That sounds obvious and the alternatives are worse in specific ways. Picking
 * the *smallest* container would make a small decorative dot unselectable
 * whenever it sat on top of a panel. Picking the *nearest by centre* would make
 * clicking near the edge of a large node select something else entirely. "What
 * you see on top is what you get" is the only rule that matches what the screen
 * shows, because the screen is showing paint order.
 *
 * ## Groups are selected, not entered
 *
 * A click selects the outermost group rather than the leaf inside it, which is
 * what every editor does and what makes a widget feel like one object. Entering
 * a group is an explicit act ({@link hitTestInside}), normally a double-click.
 *
 * ## Locked and hidden
 *
 * §61 is explicit: a locked object "stays inspectable in the tree but cannot
 * transform until unlocked" — so locked nodes are still *selectable* here, and
 * refusing the transform is the transform layer's job. Hidden nodes are not
 * hit-testable at all: they are not on screen, and a click that selected
 * something invisible would be indistinguishable from a click that missed.
 */

export interface HitTestOptions {
  /**
   * Groups already entered, outermost first.
   *
   * Inside an entered group, its children become directly selectable and its
   * siblings still are not. This is what makes double-click-to-enter behave the
   * way authors expect.
   */
  readonly enteredGroups?: readonly string[];
  /** Include locked nodes. True by default, per §61. */
  readonly includeLocked?: boolean;
}

/**
 * The node a click at `point` should select, or undefined for empty canvas.
 *
 * @param point World (artboard) coordinates. Convert from the viewport with
 *   `viewportToDocument` before calling.
 */
export function hitTest(
  nodes: readonly ThemeNode[],
  point: Point,
  options: HitTestOptions = {},
): string | undefined {
  const placed = placeNodes(nodes);
  const entered = options.enteredGroups ?? [];
  const includeLocked = options.includeLocked ?? true;

  // Backwards: paint order puts the topmost node last.
  for (let index = placed.length - 1; index >= 0; index--) {
    const node = placed[index]!;

    if (!node.visible) {
      continue;
    }

    if (!includeLocked && node.locked) {
      continue;
    }

    if (!containsPoint(node, point)) {
      continue;
    }

    return selectableAncestor(node, entered);
  }

  return undefined;
}

/**
 * The node a click should select, given which groups have been entered.
 *
 * Walks up to the outermost ancestor that is *not* inside an entered group. A
 * node whose ancestors are all entered is selected directly.
 */
function selectableAncestor(node: PlacedNode, entered: readonly string[]): string {
  for (const ancestor of node.ancestors) {
    if (!entered.includes(ancestor)) {
      return ancestor;
    }
  }

  return node.id;
}

/**
 * The deepest node at a point, ignoring grouping.
 *
 * For "enter the group and select what is actually under the cursor" — the
 * double-click gesture — and for a tree view that wants to reveal a leaf.
 */
export function hitTestDeep(
  nodes: readonly ThemeNode[],
  point: Point,
  options: HitTestOptions = {},
): string | undefined {
  const placed = placeNodes(nodes);
  const includeLocked = options.includeLocked ?? true;

  for (let index = placed.length - 1; index >= 0; index--) {
    const node = placed[index]!;

    if (!node.visible || (!includeLocked && node.locked)) {
      continue;
    }

    if (containsPoint(node, point)) {
      return node.id;
    }
  }

  return undefined;
}

/** Alias that reads better at the call site for a double-click. */
export const hitTestInside = hitTestDeep;

export interface MarqueeOptions extends HitTestOptions {
  /**
   * Require a node to be fully inside the marquee.
   *
   * Off by default: touching is the convention in every drawing tool, and
   * requiring containment makes a marquee useless for grabbing a row of items
   * that extends past the drag.
   */
  readonly requireFullyInside?: boolean;
}

/**
 * Nodes a marquee rectangle selects, in paint order.
 *
 * Uses axis-aligned bounds, which are deliberately loose for a rotated node: a
 * rotated rectangle's bounds include corners the shape does not cover, so a
 * marquee that merely clips those corners still selects it. That errs toward
 * selecting, which is recoverable with a modifier-click; erring the other way
 * makes a node the author can see inside the marquee refuse to be selected.
 */
export function marqueeSelect(
  nodes: readonly ThemeNode[],
  marquee: Bounds,
  options: MarqueeOptions = {},
): string[] {
  const placed = placeNodes(nodes);
  const entered = options.enteredGroups ?? [];
  const includeLocked = options.includeLocked ?? true;
  const normalized = normalizeBounds(marquee);

  const selected: string[] = [];

  for (const node of placed) {
    if (!node.visible || (!includeLocked && node.locked)) {
      continue;
    }

    // A group's own bounds are its transform box, which may be smaller than its
    // children. Selecting by the group's box would miss a group whose children
    // spill outside it, so groups are matched through their children instead.
    if (node.type === 'group') {
      continue;
    }

    if (node.width <= 0 || node.height <= 0) {
      continue;
    }

    const bounds = worldBounds(node);
    const hit = options.requireFullyInside === true
      ? boundsContain(normalized, bounds)
      : boundsIntersect(normalized, bounds);

    if (!hit) {
      continue;
    }

    const target = selectableAncestor(node, entered);

    if (!selected.includes(target)) {
      selected.push(target);
    }
  }

  return selected;
}

/**
 * Orders a rectangle's edges.
 *
 * A marquee is dragged from wherever the pointer went down, so right may be
 * left of left. Every consumer would otherwise have to remember that.
 */
export function normalizeBounds(bounds: Bounds): Bounds {
  return {
    left: Math.min(bounds.left, bounds.right),
    right: Math.max(bounds.left, bounds.right),
    top: Math.min(bounds.top, bounds.bottom),
    bottom: Math.max(bounds.top, bounds.bottom),
  };
}

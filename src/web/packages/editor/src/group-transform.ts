import type { ThemeDocument, ThemeNode, Transform } from '@vigilia/renderer-core';

import { findNode } from './commands.js';
import { placeNodes, unionBounds } from './geometry.js';

/**
 * A group's transform: derived from its children, and editable anyway.
 *
 * ## Why this exists
 *
 * Spec 0011 D2 makes a group an editor entity rather than a drawable, so it
 * stores no transform. A first reading of that removed the X/Y/width/height
 * rows from the inspector altogether — which was wrong, and the user caught it:
 * **moving and rotating a group is something an author does**, so per D0 it
 * belongs in the inspector. What changed is where the value lives, not whether
 * it can be set.
 *
 * So the rows are shown from the union of child world bounds, and editing one
 * rewrites the children:
 *
 * | Row | Editing it |
 * |---|---|
 * | `x`, `y` | applies the delta to every child |
 * | `rotation` | always reads 0 — see the note below |
 *
 * **There is no size row.** Resizing a group is not an operation (user,
 * 2026-09-13): only position and rotation are. The derived `width`/`height`
 * are still computed, because the selection outline needs them, but they are
 * not offered for editing.
 *
 * ## Rotation is not implemented here, deliberately
 *
 * Rotating a group must rotate its children **about the group's derived
 * centre**, which changes each child's `rotation` *and* its `x`/`y`. Applying
 * the angle to each child individually rotates each about its own centre, which
 * is a different operation and visibly wrong — the same latent bug that sits in
 * `applyGesture`'s unreachable multi-node rotate branch.
 *
 * Rather than ship a row that does the wrong thing, {@link groupTransformOf}
 * reports rotation as 0 and {@link applyGroupTransform} refuses to change it.
 * A row that cannot work must not pretend to (D0's converse).
 */

/** Whether a node is a group, narrowed so `children` is reachable. */
function isGroup(node: ThemeNode | undefined): node is ThemeNode & {
  readonly type: 'group';
  readonly children: readonly ThemeNode[];
} {
  return node?.type === 'group';
}

/**
 * The transform an inspector should show for a group.
 *
 * @returns The derived box, or `undefined` when the id is not a group or the
 *   group has no children with any size — where a union of nothing has no
 *   honest answer and showing zeros would invite an author to type into a field
 *   that cannot move anything.
 */
export function groupTransformOf(
  document_: ThemeDocument,
  groupId: string,
): Transform | undefined {
  const node = findNode(document_.nodes, groupId);

  if (!isGroup(node)) {
    return undefined;
  }

  // Placed from the document root so the bounds are in world space, matching
  // what the selection outline draws.
  const placements = placeNodes(document_.nodes);
  const ids = new Set(collectDescendants(node));
  const bounds = unionBounds(placements.filter((placement) => ids.has(placement.id)));

  if (bounds === undefined) {
    return undefined;
  }

  return {
    x: Math.round(bounds.left),
    y: Math.round(bounds.top),
    width: Math.round(bounds.right - bounds.left),
    height: Math.round(bounds.bottom - bounds.top),
    // A group stores no rotation, and deriving one from a rotated child would
    // be a guess. See the module note.
    rotation: 0,
  };
}

function collectDescendants(node: ThemeNode): string[] {
  if (!isGroup(node)) {
    return [node.id];
  }

  return node.children.flatMap(collectDescendants);
}

/**
 * Turns an edit of a group's derived transform into child transforms.
 *
 * @returns A map of child id to new transform, empty when nothing should
 *   change — so a caller can skip an undo entry by size, the same contract the
 *   gesture layer uses.
 */
export function applyGroupTransform(
  document_: ThemeDocument,
  groupId: string,
  property: 'x' | 'y' | 'rotation',
  value: number,
): ReadonlyMap<string, Transform> {
  const current = groupTransformOf(document_, groupId);
  const node = findNode(document_.nodes, groupId);

  if (current === undefined || !isGroup(node)) {
    return new Map();
  }

  // Refused rather than approximated — the module note says why.
  if (property === 'rotation') {
    return new Map();
  }

  const delta = value - (current[property] ?? 0);

  return delta === 0 ? new Map() : translated(node.children, property, delta);
}

/** Shifts every descendant along one axis. */
function translated(
  nodes: readonly ThemeNode[],
  axis: 'x' | 'y',
  delta: number,
): ReadonlyMap<string, Transform> {
  const out = new Map<string, Transform>();

  const visit = (children: readonly ThemeNode[]): void => {
    for (const child of children) {
      // Only the outermost layer moves. A group's children are positioned in
      // the group's parent space, so shifting a child *and* its descendants
      // would move the descendants twice (§57).
      out.set(child.id, {
        ...child.transform,
        [axis]: Math.round((child.transform?.[axis] ?? 0) + delta),
      });
    }
  };

  visit(nodes);

  return out;
}

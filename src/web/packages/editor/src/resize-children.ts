import type { ThemeDocument, ThemeNode, Transform } from '@vigilia/renderer-core';

import { findNode } from './commands.js';
import type { Handle } from './transform-gesture.js';

/**
 * Resizing a group scales what is inside it.
 *
 * ## The bug this fixes
 *
 * A group's `width`/`height` is its own box and nothing more: `plan.ts` lays
 * children out from *their* transforms, so changing a group's size moved the
 * selection outline and left every child exactly where it was. Dragging the
 * east handle of a panel widened the box from 453 to 533 while the background,
 * the title and the chart all kept their old widths — and the history recorded
 * "Resize element" for what was visually a no-op. Panels are the main unit of
 * dashboard layout, so this made the obvious way to lay one out do nothing.
 *
 * `transform-gesture.ts` is right that it produces a transform for the node
 * being dragged; a group's children are a *consequence* of that, which is why
 * this is a separate pure step over the gesture's output rather than a change
 * inside it.
 *
 * ## What scales, and what deliberately does not
 *
 * Geometry scales: `x`, `y`, `width` and `height`, recursively, by the same
 * factors the group changed by. That is exact in this format even for a rotated
 * child, because rotation is about the node's own centre — the box scales in
 * the parent's space and the rotation rides along. It is not a true shear of a
 * rotated child, but it is predictable and representable, where a shear is
 * neither.
 *
 * **`fontSize` and other style values do not scale.** Doubling a panel should
 * give more room, not double the type — matching what every design tool does
 * when you resize a frame rather than use a scale tool. An author who wants
 * larger text sets it, and a global makes that one edit (§75).
 *
 * **Locked descendants scale too**, which is a judgement call worth naming.
 * §61 stops a locked node being *directly* dragged, and that still holds — the
 * gesture layer filters it. But the operation here was authorised on the
 * ancestor, and scaling every child except one produces a panel whose contents
 * no longer line up: a corrupted layout is worse than an ignored lock.
 */

/** Scales `x`/`y`/`width`/`height` by the given factors, leaving the rest alone. */
function scaleTransform(transform: Transform, sx: number, sy: number): Transform {
  // Built by spreading rather than assigning, because with
  // exactOptionalPropertyTypes writing `x: undefined` is a different type from
  // omitting `x` — and a transform with an explicit undefined would serialise
  // into the document as a null.
  return {
    ...transform,
    ...(transform.x === undefined ? {} : { x: transform.x * sx }),
    ...(transform.y === undefined ? {} : { y: transform.y * sy }),
    ...(transform.width === undefined ? {} : { width: transform.width * sx }),
    ...(transform.height === undefined ? {} : { height: transform.height * sy }),
  };
}

function scaleSubtree(
  nodes: readonly ThemeNode[],
  sx: number,
  sy: number,
  into: Map<string, Transform>,
): void {
  for (const node of nodes) {
    // A node already carrying an explicit transform from the gesture is not
    // overwritten — the dragged group itself is in the map.
    if (node.transform !== undefined && !into.has(node.id)) {
      into.set(node.id, scaleTransform(node.transform, sx, sy));
    }

    if (node.type === 'group') {
      // The same factors apply at every depth: a child's own box has just
      // scaled by them, so its children must scale by them to stay in place
      // within it.
      scaleSubtree(node.children, sx, sy, into);
    }
  }
}

/**
 * Expands a gesture's transforms with the descendants of any resized group.
 *
 * Returns the input unchanged for a move or a rotate — a move already carries
 * children (they are positioned in the parent's space), and a rotation is about
 * the group's centre, so neither needs this.
 */
export function withScaledDescendants(
  document_: ThemeDocument,
  transforms: ReadonlyMap<string, Transform>,
  handle: Handle,
): ReadonlyMap<string, Transform> {
  if (handle === 'move' || handle === 'rotate') {
    return transforms;
  }

  const expanded = new Map(transforms);

  for (const [id, next] of transforms) {
    const node = findNode(document_.nodes, id);

    if (node?.type !== 'group') {
      continue;
    }

    const before = node.transform;
    const beforeWidth = before?.width;
    const beforeHeight = before?.height;

    // Without a starting size there is no ratio to apply. Scaling from zero is
    // undefined rather than infinite, so the children are left alone instead of
    // being sent to NaN.
    const sx = beforeWidth !== undefined && beforeWidth !== 0 ? (next.width ?? 0) / beforeWidth : 1;
    const sy =
      beforeHeight !== undefined && beforeHeight !== 0 ? (next.height ?? 0) / beforeHeight : 1;

    if (sx === 1 && sy === 1) {
      continue;
    }

    scaleSubtree(node.children, sx, sy, expanded);
  }

  return expanded;
}

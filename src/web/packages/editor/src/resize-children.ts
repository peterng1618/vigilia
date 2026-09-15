import type { ThemeDocument, ThemeNode, Transform } from '@vigilia/renderer-core';

import { findNode } from './commands.js';
import type { Handle } from './transform-gesture.js';

/** Legacy group-resize consequence: scale descendant geometry, never styles. */

function scaleTransform(transform: Transform, sx: number, sy: number): Transform {
  // Omit absent keys; exactOptionalPropertyTypes distinguishes them from undefined.
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
    if (node.transform !== undefined && !into.has(node.id)) {
      into.set(node.id, scaleTransform(node.transform, sx, sy));
    }

    if (node.type === 'group') {
      scaleSubtree(node.children, sx, sy, into);
    }
  }
}

/** Expand resize transforms with group descendants; moves/rotations need no rewrite. */
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

    // Zero/absent source dimensions have no meaningful scale ratio.
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

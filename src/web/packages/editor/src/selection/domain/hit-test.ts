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

/** Legacy selection rules until Fabric owns hit-testing. Topmost visible node wins. */

export interface HitTestOptions {
  /** Entered groups, outermost first; their children become directly selectable. */
  readonly enteredGroups?: readonly string[];
  /** Locked nodes remain selectable by default (§61). */
  readonly includeLocked?: boolean;
}

export function hitTest(
  nodes: readonly ThemeNode[],
  point: Point,
  options: HitTestOptions = {},
): string | undefined {
  const placed = placeNodes(nodes);
  const entered = options.enteredGroups ?? [];
  const includeLocked = options.includeLocked ?? true;

  for (let index = placed.length - 1; index >= 0; index--) {
    const node = placed[index]!;

    if (!node.visible || (!includeLocked && node.locked) || !containsPoint(node, point)) {
      continue;
    }

    return selectableAncestor(node, entered);
  }

  return undefined;
}

/** Select the outermost ancestor not inside an entered group. */
function selectableAncestor(node: PlacedNode, entered: readonly string[]): string {
  for (const ancestor of node.ancestors) {
    if (!entered.includes(ancestor)) {
      return ancestor;
    }
  }

  return node.id;
}

/** Deepest visible hit, ignoring group-selection promotion. */
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

export const hitTestInside = hitTestDeep;

export interface MarqueeOptions extends HitTestOptions {
  readonly requireFullyInside?: boolean;
}

/** Marquee uses loose axis-aligned bounds; groups are selected through child hits. */
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

    if (node.type === 'group' || node.width <= 0 || node.height <= 0) {
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

/** Normalize a drag rectangle regardless of drag direction. */
export function normalizeBounds(bounds: Bounds): Bounds {
  return {
    left: Math.min(bounds.left, bounds.right),
    right: Math.max(bounds.left, bounds.right),
    top: Math.min(bounds.top, bounds.bottom),
    bottom: Math.max(bounds.top, bounds.bottom),
  };
}

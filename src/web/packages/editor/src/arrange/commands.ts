import type { ThemeDocument, ThemeNode, Transform } from '@vigilia/renderer-core';
import {
  IDENTITY,
  localMatrix,
  multiply,
  outermostOnly,
  placeNodes,
  unionBounds,
  worldBounds,
  type Bounds,
  type Matrix2D,
  type PlacedNode,
} from '../geometry.js';
import { collectIds, deleteNodes, findNode, insertNodes, updateTransforms } from '../commands.js';

/**
 * Legacy grouping/alignment until Fabric owns these operations. Ungroup refuses
 * transform compositions that would introduce shear not representable by the schema.
 */

export type ArrangeRefusal =
  | 'nothing-selected'
  | 'needs-two'
  | 'mixed-parents'
  | 'not-a-group'
  | 'would-shear'
  | 'locked';

export interface ArrangeResult {
  readonly document: ThemeDocument;
  readonly refused?: ArrangeRefusal;
  readonly select?: readonly string[];
}

export function describeRefusal(refusal: ArrangeRefusal): string {
  switch (refusal) {
    case 'nothing-selected':
      return 'Nothing selected';
    case 'needs-two':
      return 'Select at least two elements';
    case 'mixed-parents':
      return 'Select elements from one group at a time';
    case 'not-a-group':
      return 'Select a group to ungroup';
    case 'would-shear':
      return 'Cannot ungroup: the group scales one axis and holds a rotated child';
    case 'locked':
      return 'Locked (§61)';
  }
}

/** Group same-parent nodes, preserving child and paint order. */
export function groupNodes(
  document_: ThemeDocument,
  ids: readonly string[],
  groupId: string,
): ArrangeResult {
  const placements = placeNodes(document_.nodes);
  const chosen = outermostOnly(placements, ids);

  if (chosen.length === 0) {
    return { document: document_, refused: 'nothing-selected' };
  }

  if (chosen.length < 2) {
    return { document: document_, refused: 'needs-two' };
  }

  const parents = new Set(
    chosen.map((id) => placements.find((placement) => placement.id === id)?.ancestors.at(-1)),
  );

  if (parents.size > 1) {
    return { document: document_, refused: 'mixed-parents' };
  }

  const parentId = [...parents][0];
  const siblings = parentId === undefined ? document_.nodes : childrenOf(document_, parentId);

  if (siblings === undefined) {
    return { document: document_, refused: 'mixed-parents' };
  }

  const members = siblings.filter((node) => chosen.includes(node.id));

  if (members.length !== chosen.length) {
    return { document: document_, refused: 'mixed-parents' };
  }

  // Group geometry is expressed in the shared parent's coordinate space.
  const box = parentSpaceBounds(members);

  const children = members.map((node) => ({
    ...node,
    transform: {
      ...(node.transform ?? {}),
      x: (node.transform?.x ?? 0) - box.left,
      y: (node.transform?.y ?? 0) - box.top,
    },
  }));

  const group: ThemeNode = {
    id: groupId,
    type: 'group',
    name: 'Group',
    transform: {
      x: box.left,
      y: box.top,
      width: box.right - box.left,
      height: box.bottom - box.top,
    },
    children,
  };

  const topmost = members.at(-1);
  const index = siblings.findIndex((node) => node.id === topmost?.id);
  const removed = deleteNodes(document_, new Set(chosen));
  const shift = siblings.slice(0, index).filter((node) => chosen.includes(node.id)).length;

  return {
    document: insertNodes(removed, [group], parentId, index - shift),
    select: [groupId],
  };
}

/** Ungroup by composing group transform into each child; refuse shear. */
export function ungroupNodes(
  document_: ThemeDocument,
  ids: readonly string[],
): ArrangeResult {
  const groups = ids
    .map((id) => findNode(document_.nodes, id))
    .filter((node): node is ThemeNode & { type: 'group' } => node?.type === 'group');

  if (groups.length === 0) {
    return { document: document_, refused: 'not-a-group' };
  }

  if (groups.some((group) => group.locked === true)) {
    return { document: document_, refused: 'locked' };
  }

  let next = document_;
  const selected: string[] = [];

  for (const group of groups) {
    const composed: ThemeNode[] = [];

    for (const child of group.children) {
      const transform = composeTransforms(group.transform, child.transform);

      if (transform === undefined) {
        return { document: document_, refused: 'would-shear' };
      }

      // Preserve inherited hidden state after removing the group.
      const childWithTransform = { ...child, transform } as ThemeNode;
      composed.push(group.visible === false ? { ...childWithTransform, visible: false } : childWithTransform);
      selected.push(child.id);
    }

    const placements = placeNodes(next.nodes);
    const placement = placements.find((candidate) => candidate.id === group.id);
    const parentId = placement?.ancestors.at(-1);
    const siblings = parentId === undefined ? next.nodes : childrenOf(next, parentId);
    const index = siblings?.findIndex((node) => node.id === group.id) ?? -1;

    next = insertNodes(
      deleteNodes(next, new Set([group.id])),
      composed,
      parentId,
      index < 0 ? undefined : index,
    );
  }

  return { document: next, select: selected };
}

export type AlignEdge = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';

/** Align within the selection's own bounds. */
export function alignNodes(
  document_: ThemeDocument,
  ids: readonly string[],
  edge: AlignEdge,
): ArrangeResult {
  const { movable, refused } = arrangeable(document_, ids);

  if (refused !== undefined) {
    return { document: document_, refused };
  }

  const total = unionBounds(movable);

  if (total === undefined) {
    return { document: document_, refused: 'nothing-selected' };
  }

  const transforms = new Map<string, Transform>();

  for (const placement of movable) {
    const node = findNode(document_.nodes, placement.id);

    if (node === undefined) {
      continue;
    }

    const box = worldBounds(placement);
    const delta = alignDelta(edge, box, total);

    if (delta.x === 0 && delta.y === 0) {
      continue;
    }

    transforms.set(placement.id, shift(node.transform, delta, placement));
  }

  return { document: updateTransforms(document_, transforms) };
}

/** Distribute equal gaps; outermost items define the span. */
export function distributeNodes(
  document_: ThemeDocument,
  ids: readonly string[],
  axis: 'x' | 'y',
): ArrangeResult {
  const { movable, refused } = arrangeable(document_, ids);

  if (refused !== undefined) {
    return { document: document_, refused };
  }

  if (movable.length < 3) {
    return { document: document_, refused: 'needs-two' };
  }

  const sorted = [...movable].sort((a, b) =>
    axis === 'x'
      ? worldBounds(a).left - worldBounds(b).left
      : worldBounds(a).top - worldBounds(b).top,
  );

  const first = worldBounds(sorted[0]!);
  const last = worldBounds(sorted.at(-1)!);

  const span =
    axis === 'x' ? last.right - first.left : last.bottom - first.top;
  const used = sorted.reduce((total, placement) => {
    const box = worldBounds(placement);

    return total + (axis === 'x' ? box.right - box.left : box.bottom - box.top);
  }, 0);

  const gap = (span - used) / (sorted.length - 1);
  const transforms = new Map<string, Transform>();
  let cursor = axis === 'x' ? first.left : first.top;

  for (const placement of sorted) {
    const node = findNode(document_.nodes, placement.id);
    const box = worldBounds(placement);
    const size = axis === 'x' ? box.right - box.left : box.bottom - box.top;
    const current = axis === 'x' ? box.left : box.top;
    const delta = cursor - current;

    if (node !== undefined && Math.abs(delta) > 1e-9) {
      transforms.set(
        placement.id,
        shift(node.transform, axis === 'x' ? { x: delta, y: 0 } : { x: 0, y: delta }, placement),
      );
    }

    cursor += size + gap;
  }

  return { document: updateTransforms(document_, transforms) };
}

function arrangeable(
  document_: ThemeDocument,
  ids: readonly string[],
): { movable: PlacedNode[]; refused?: ArrangeRefusal } {
  const placements = placeNodes(document_.nodes);
  const chosen = outermostOnly(placements, ids);
  const movable = placements.filter(
    (placement) => chosen.includes(placement.id) && !placement.locked,
  );

  if (movable.length === 0) {
    return { movable, refused: 'nothing-selected' };
  }

  if (movable.length < 2) {
    return { movable, refused: 'needs-two' };
  }

  return { movable };
}

function alignDelta(edge: AlignEdge, box: Bounds, total: Bounds): { x: number; y: number } {
  switch (edge) {
    case 'left':
      return { x: total.left - box.left, y: 0 };
    case 'right':
      return { x: total.right - box.right, y: 0 };
    case 'centre':
      return {
        x: (total.left + total.right) / 2 - (box.left + box.right) / 2,
        y: 0,
      };
    case 'top':
      return { x: 0, y: total.top - box.top };
    case 'bottom':
      return { x: 0, y: total.bottom - box.bottom };
    case 'middle':
      return {
        x: 0,
        y: (total.top + total.bottom) / 2 - (box.top + box.bottom) / 2,
      };
  }
}

/** Convert a world-space alignment delta to the node's parent space. */
function shift(
  transform: Transform | undefined,
  delta: { x: number; y: number },
  placement: PlacedNode,
): Transform {
  const linear: Matrix2D = { ...placement.parentMatrix, e: 0, f: 0 };
  const determinant = linear.a * linear.d - linear.b * linear.c;

  const local =
    determinant === 0 || !Number.isFinite(determinant)
      ? delta
      : {
          x: (linear.d * delta.x - linear.c * delta.y) / determinant,
          y: (linear.a * delta.y - linear.b * delta.x) / determinant,
        };

  return {
    ...(transform ?? {}),
    x: (transform?.x ?? 0) + local.x,
    y: (transform?.y ?? 0) + local.y,
  };
}

/** Compose group and child transforms; undefined means the result would shear. */
export function composeTransforms(
  group: Transform | undefined,
  child: Transform | undefined,
): Transform | undefined {
  const groupRotation = group?.rotation ?? 0;
  const groupScaleX = group?.scaleX ?? 1;
  const groupScaleY = group?.scaleY ?? 1;
  const childRotation = child?.rotation ?? 0;

  const uniform = groupScaleX === groupScaleY;
  const childUnrotated = ((childRotation % 360) + 360) % 360 === 0;

  if (!uniform && !childUnrotated) {
    return undefined;
  }

  const rotation = groupRotation + childRotation;

  // Bake group scale into child size; preserve the child's own scale factors.
  const scaleX = child?.scaleX ?? 1;
  const scaleY = child?.scaleY ?? 1;
  const width = (child?.width ?? 0) * groupScaleX;
  const height = (child?.height ?? 0) * groupScaleY;

  const target = multiply(localMatrix(child), localMatrix(group));

  const base: Transform = {
    ...withoutPosition(child),
    ...(rotation === 0 ? {} : { rotation }),
    ...(scaleX === 1 ? {} : { scaleX }),
    ...(scaleY === 1 ? {} : { scaleY }),
    ...(child?.width === undefined ? {} : { width }),
    ...(child?.height === undefined ? {} : { height }),
  };

  const placed = localMatrix(base);

  return {
    ...base,
    x: target.e - placed.e,
    y: target.f - placed.f,
  };
}

function withoutPosition(transform: Transform | undefined): Transform {
  const { x: _x, y: _y, ...rest } = transform ?? {};

  return rest;
}

/** Bounds of siblings in their shared parent's space. */
function parentSpaceBounds(nodes: readonly ThemeNode[]): Bounds {
  const boxes = nodes.map((node) =>
    worldBounds({
      id: node.id,
      type: node.type,
      matrix: localMatrix(node.transform),
      parentMatrix: IDENTITY,
      width: node.transform?.width ?? 0,
      height: node.transform?.height ?? 0,
      depth: 0,
      ancestors: [],
      visible: true,
      locked: false,
    }),
  );

  return boxes.reduce((total, next) => ({
    left: Math.min(total.left, next.left),
    top: Math.min(total.top, next.top),
    right: Math.max(total.right, next.right),
    bottom: Math.max(total.bottom, next.bottom),
  }));
}

function childrenOf(document_: ThemeDocument, parentId: string): readonly ThemeNode[] | undefined {
  const parent = findNode(document_.nodes, parentId);

  return parent?.type === 'group' ? parent.children : undefined;
}

export function freeGroupId(document_: ThemeDocument, base = 'group'): string {
  const taken = collectIds(document_.nodes);

  if (!taken.has(base)) {
    return base;
  }

  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;

    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

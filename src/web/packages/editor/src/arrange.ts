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
} from './geometry.js';
import { collectIds, deleteNodes, findNode, insertNodes, updateTransforms } from './commands.js';

/**
 * Grouping, ungrouping, alignment and distribution.
 *
 * Pure: document in, document out. Every rule about what is *refused* lives
 * here too, and each refusal returns the document unchanged so the caller skips
 * the undo entry by identity.
 *
 * ## Why some of these refuse instead of approximating
 *
 * §57 says transforms **compose** rather than being baked. Grouping and
 * ungrouping move a node between parents, which is the one operation that
 * cannot honour that: the node's coordinates have to be re-expressed in a new
 * parent's space, and for some ancestries the result is not representable at
 * all.
 *
 * The format allows a transform to be `translate × rotate(θ) × scale(sx, sy)`
 * about the node's centre. Composing two of those gives a linear part
 * `R(a)·S(g) · R(b)·S(c)`, which collapses back into the same form only when
 *
 * - the outer scale is **uniform** — then it commutes with the inner rotation —
 *   or
 * - the inner rotation is **zero**.
 *
 * Otherwise the product is a **shear**, and no `{rotation, scaleX, scaleY}`
 * expresses it. Baking it approximately would move the author's artwork by an
 * amount nobody asked for, so {@link ungroupNodes} refuses and says why.
 *
 * This is not a theoretical case: a group scaled 2× on one axis containing a
 * rotated child is three clicks away.
 */

/** Why an arrange operation could not be performed. */
export type ArrangeRefusal =
  | 'nothing-selected'
  | 'needs-two'
  | 'mixed-parents'
  | 'not-a-group'
  | 'would-shear'
  | 'locked';

export interface ArrangeResult {
  readonly document: ThemeDocument;
  /** Set when the document was returned unchanged. */
  readonly refused?: ArrangeRefusal;
  /** Ids to select afterwards, when the operation changed what should be selected. */
  readonly select?: readonly string[];
}

/** Human-readable, for a status bar. */
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

/**
 * Wraps the selection in a new group.
 *
 * The group takes the selection's bounding box in the shared parent's space,
 * and each child's coordinates become relative to it. Children keep their
 * relative paint order, and the group is inserted where the **topmost** member
 * was, so grouping does not change what covers what.
 *
 * Refuses a selection spanning more than one parent. Re-parenting across
 * ancestries needs each node's coordinates re-expressed in a different space,
 * which is the shear problem described in the module comment — and "group these
 * three, two of which are in another group" has no obvious right answer anyway.
 */
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

  // Document order, so the group's children keep the paint order they had.
  const members = siblings.filter((node) => chosen.includes(node.id));

  if (members.length !== chosen.length) {
    return { document: document_, refused: 'mixed-parents' };
  }

  // The box in the PARENT's space, which is the space the group's own transform
  // is written in. Using world bounds here would offset the group by every
  // ancestor's translation.
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

  // Insert where the topmost member was, so the group covers exactly what its
  // contents covered.
  const topmost = members.at(-1);
  const index = siblings.findIndex((node) => node.id === topmost?.id);
  const removed = deleteNodes(document_, new Set(chosen));
  const shift = siblings.slice(0, index).filter((node) => chosen.includes(node.id)).length;

  return {
    document: insertNodes(removed, [group], parentId, index - shift),
    select: [groupId],
  };
}

/**
 * Replaces each selected group with its children.
 *
 * Each child's transform absorbs the group's, so nothing moves. That is the one
 * place this editor bakes a transform, and it is unavoidable: the child is
 * changing parents, so its coordinates must be re-expressed.
 *
 * Refuses when the composition is not representable — see the module comment.
 */
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

      composed.push({ ...child, transform } as ThemeNode);
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

/** Which edge or axis to align to. */
export type AlignEdge = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';

/**
 * Aligns the selection within its own bounding box.
 *
 * To the selection's bounds rather than the artboard's: aligning two nodes to
 * the artboard's left edge stacks them in a corner, which is never what the
 * gesture means. A single node has bounds equal to itself, so aligning one node
 * is a no-op rather than a jump — hence the two-node requirement.
 */
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

/**
 * Spreads the selection so the **gaps** between neighbours are equal.
 *
 * Equal gaps, not equal centre spacing. With mixed sizes the two differ, and
 * equal gaps is what "distribute" means to anyone looking at the result — equal
 * centres leaves a wide element visually crowding its neighbours.
 *
 * The outermost two do not move: they define the span.
 */
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
    // Two nodes are already "distributed" whatever the spacing, so this would
    // be a no-op that still wrote an undo entry.
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

/** The selection, filtered to what may actually be arranged. */
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

/**
 * Applies a world-space delta to a node's own coordinates.
 *
 * The delta is measured between world bounds, and `x`/`y` are in the parent's
 * space (§57) — the same conversion a drag needs, and wrong in the same
 * invisible way if skipped.
 */
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

/**
 * A child's transform with its parent group's absorbed into it.
 *
 * Returns undefined when the result would be a shear — see the module comment.
 */
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

  // The group's scale goes into the child's SIZE, and its own scale factors are
  // left alone — a scaled group is usually a layout decision, and a baked size
  // is what an author edits next. Multiplying both would apply the group's
  // scale twice, which is exactly what the first version did: a 2× group made
  // its child 2× bigger *and* kept it at scale 2, so it ended up 4× on screen.
  //
  // The child's own scale still multiplies its size at render time, so the
  // product `size × scale` is preserved either way.
  const scaleX = child?.scaleX ?? 1;
  const scaleY = child?.scaleY ?? 1;
  const width = (child?.width ?? 0) * groupScaleX;
  const height = (child?.height ?? 0) * groupScaleY;

  const target = multiply(localMatrix(child), localMatrix(group));

  // Solve for x/y instead of deriving them: `localMatrix` applies the
  // translation LAST, so whatever the rotate-scale part produces, x/y are
  // exactly the difference between where it lands and where it must land.
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

/** Bounds of a set of siblings in their shared parent's space. */
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

/** An id for a new group that is free in this document. */
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

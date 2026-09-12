import type { ThemeNode, Transform } from '@vigilia/renderer-core';

/**
 * Node geometry in world (artboard) space.
 *
 * ## Why the editor needs this and the renderer does not
 *
 * The renderer never composes transforms in code: it nests absolutely
 * positioned elements and lets the browser do it. That is the right answer for
 * drawing — one uniform artboard transform (§51), group-local child coordinates
 * (§57), no reflow — and it is useless for editing, because hit-testing and
 * transform handles need to know where a node actually *is*.
 *
 * So this composes the same chain the DOM composes, explicitly. The two must
 * agree; where they could disagree is called out at each step below, because a
 * handle drawn 3 px from the thing it grabs is the most obvious possible bug.
 *
 * ## Matrices rather than rectangles
 *
 * A rotated node has no axis-aligned box that is both tight and correct, so
 * hit-testing a rotated element against a rectangle is wrong at the corners.
 * Instead every node gets an affine matrix, and a point is tested by inverse-
 * transforming it into the node's own space and comparing against
 * `0,0 → width,height`. That is exact for any composition of translation,
 * rotation and scale, which is all the format allows (§57).
 */

/**
 * A 2D affine matrix, in the same component order CSS uses:
 * `matrix(a, b, c, d, e, f)`.
 *
 * ```
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 * ```
 */
export interface Matrix2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const IDENTITY: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** `first` then `second`, i.e. the matrix product `second × first`. */
export function multiply(first: Matrix2D, second: Matrix2D): Matrix2D {
  return {
    a: second.a * first.a + second.c * first.b,
    b: second.b * first.a + second.d * first.b,
    c: second.a * first.c + second.c * first.d,
    d: second.b * first.c + second.d * first.d,
    e: second.a * first.e + second.c * first.f + second.e,
    f: second.b * first.e + second.d * first.f + second.f,
  };
}

export function applyMatrix(matrix: Matrix2D, point: Point): Point {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}

/**
 * Inverse of an affine matrix, or undefined when it has none.
 *
 * A zero determinant is reachable from a valid document — `scaleX: 0` is
 * allowed by the schema — so this returns undefined rather than producing
 * infinities that would make every subsequent hit-test true.
 */
export function invert(matrix: Matrix2D): Matrix2D | undefined {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;

  if (determinant === 0 || !Number.isFinite(determinant)) {
    return undefined;
  }

  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  };
}

/**
 * The matrix for one node's own transform, relative to its parent.
 *
 * Order matters and must match the DOM exactly. `mount.ts` sets `left`/`top`
 * (a translation) and then a CSS `transform` of `rotate() scale()` with
 * `transform-origin: 50% 50%` — so the rotation and scale happen about the
 * node's centre, *after* it has been positioned. Composing them in any other
 * order puts a rotated node somewhere the browser does not.
 */
export function localMatrix(transform: Transform | undefined): Matrix2D {
  const t = transform ?? {};
  const x = t.x ?? 0;
  const y = t.y ?? 0;
  const width = t.width ?? 0;
  const height = t.height ?? 0;
  const rotation = t.rotation ?? 0;
  const scaleX = t.scaleX ?? 1;
  const scaleY = t.scaleY ?? 1;

  const translate: Matrix2D = { ...IDENTITY, e: x, f: y };

  if (rotation === 0 && scaleX === 1 && scaleY === 1) {
    return translate;
  }

  // About the centre, which is what `transform-origin: 50% 50%` means: move the
  // origin to the centre, transform, move back.
  const centreX = width / 2;
  const centreY = height / 2;

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const rotateScale: Matrix2D = {
    a: cos * scaleX,
    b: sin * scaleX,
    c: -sin * scaleY,
    d: cos * scaleY,
    e: 0,
    f: 0,
  };

  const toCentre: Matrix2D = { ...IDENTITY, e: -centreX, f: -centreY };
  const fromCentre: Matrix2D = { ...IDENTITY, e: centreX, f: centreY };

  return multiply(multiply(multiply(toCentre, rotateScale), fromCentre), translate);
}

/** A node placed in world space, with everything the editor needs about it. */
export interface PlacedNode {
  readonly id: string;
  readonly type: ThemeNode['type'];
  /** Document→node matrix: use its inverse to bring a world point into node space. */
  readonly matrix: Matrix2D;
  /**
   * The composed matrix of this node's ancestors, without its own transform.
   *
   * Needed to convert a gesture: a node's `x`/`y` are expressed in its
   * PARENT's space (§57), while a pointer delta arrives in document space. For
   * a translation-only ancestor chain the two are the same, which is why a
   * rotated group is where the difference shows up — the drag would go sideways.
   */
  readonly parentMatrix: Matrix2D;
  readonly width: number;
  readonly height: number;
  /** Depth in the tree; 0 for a root. */
  readonly depth: number;
  /** Ancestor ids, outermost first. */
  readonly ancestors: readonly string[];
  readonly visible: boolean;
  /** §61: a locked node stays selectable and inspectable, but must not transform. */
  readonly locked: boolean;
}

/**
 * Flattens the tree into world-space placements, in **paint order**.
 *
 * Paint order is document order (§137): a parent before its children, an earlier
 * sibling before a later one. So the last entry that contains a point is the
 * topmost one under it — which is why {@link hitTest} walks this backwards.
 */
export function placeNodes(nodes: readonly ThemeNode[]): PlacedNode[] {
  const placed: PlacedNode[] = [];

  const walk = (
    list: readonly ThemeNode[],
    parentMatrix: Matrix2D,
    depth: number,
    ancestors: readonly string[],
    parentVisible: boolean,
  ): void => {
    for (const node of list) {
      const matrix = multiply(localMatrix(node.transform), parentMatrix);
      // A hidden group hides its children, whatever they say about themselves —
      // `display: none` on the group removes the whole subtree from the page.
      const visible = parentVisible && node.visible !== false;

      placed.push({
        id: node.id,
        type: node.type,
        matrix,
        parentMatrix,
        width: node.transform?.width ?? 0,
        height: node.transform?.height ?? 0,
        depth,
        ancestors,
        visible,
        locked: node.locked === true,
      });

      if (node.type === 'group') {
        walk(node.children, matrix, depth + 1, [...ancestors, node.id], visible);
      }
    }
  };

  walk(nodes, IDENTITY, 0, [], true);

  return placed;
}

/**
 * Drops any id whose ancestor is also in the set.
 *
 * A selection may legitimately contain both a group and something inside it —
 * shift-click the group, enter it, shift-click a child — and a gesture must then
 * move the group only. Moving both applies the delta **twice** to the child,
 * because moving a group already moves its children: a 100 px drag moves the
 * child 200 px, and it slides out of its own group.
 *
 * Observed exactly that way before this existed: a drag of one leaf inside a
 * nested group moved it (200, 80) for a (100, 40) pointer delta.
 *
 * Order is preserved, so the caller's pick order survives.
 */
export function outermostOnly(
  placements: readonly PlacedNode[],
  ids: readonly string[],
): string[] {
  const selected = new Set(ids);
  const byId = new Map(placements.map((placement) => [placement.id, placement]));

  return ids.filter((id) => {
    const placement = byId.get(id);

    // An id with no placement no longer exists in the tree. Kept rather than
    // dropped: this function answers one question, and pruning is
    // `pruneSelection`'s job.
    return (
      placement === undefined ||
      !placement.ancestors.some((ancestor) => selected.has(ancestor))
    );
  });
}

/** True when a world-space point falls inside a placed node's own box. */
export function containsPoint(node: PlacedNode, point: Point): boolean {
  if (node.width <= 0 || node.height <= 0) {
    // A zero-sized node is legal in the format and impossible to click. Giving
    // it a click target would make an invisible node steal a gesture.
    return false;
  }

  const inverse = invert(node.matrix);

  if (inverse === undefined) {
    return false;
  }

  const local = applyMatrix(inverse, point);

  return local.x >= 0 && local.x <= node.width && local.y >= 0 && local.y <= node.height;
}

/** The four corners of a placed node, in world space, clockwise from top-left. */
export function corners(node: PlacedNode): [Point, Point, Point, Point] {
  return [
    applyMatrix(node.matrix, { x: 0, y: 0 }),
    applyMatrix(node.matrix, { x: node.width, y: 0 }),
    applyMatrix(node.matrix, { x: node.width, y: node.height }),
    applyMatrix(node.matrix, { x: 0, y: node.height }),
  ];
}

/** Axis-aligned bounds of a placed node in world space. */
export interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * The axis-aligned bounds a rotated node actually occupies.
 *
 * Used for marquee selection and for alignment, where the question is "what
 * area does this cover" rather than "is this point inside it". Hit-testing uses
 * {@link containsPoint} instead, because these bounds are deliberately loose
 * for a rotated node.
 */
export function worldBounds(node: PlacedNode): Bounds {
  const points = corners(node);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom
  );
}

/** Bounds covering several placements, or undefined for none. */
export function unionBounds(nodes: readonly PlacedNode[]): Bounds | undefined {
  if (nodes.length === 0) {
    return undefined;
  }

  return nodes.map(worldBounds).reduce((total, next) => ({
    left: Math.min(total.left, next.left),
    top: Math.min(total.top, next.top),
    right: Math.max(total.right, next.right),
    bottom: Math.max(total.bottom, next.bottom),
  }));
}

import type { ThemeNode, Transform } from '@vigilia/renderer-core';

/** Legacy editor geometry until Fabric fully replaces custom interaction math. */

/** CSS-order 2D affine matrix: `matrix(a, b, c, d, e, f)`. */
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

/** `first` then `second`, i.e. `second × first`. */
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

/** Return undefined for singular transforms such as `scaleX: 0`. */
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

/** Match DOM transform order: position, then center-origin rotate/scale. */
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

export interface PlacedNode {
  readonly id: string;
  readonly type: ThemeNode['type'];
  readonly matrix: Matrix2D;
  /** Ancestor transform only; converts world-space gestures into parent space. */
  readonly parentMatrix: Matrix2D;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly ancestors: readonly string[];
  readonly visible: boolean;
  readonly locked: boolean;
}

/** Flatten the tree into world-space placements in paint order. */
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

/** Remove selected descendants whose ancestor is also selected, preserving order. */
export function outermostOnly(
  placements: readonly PlacedNode[],
  ids: readonly string[],
): string[] {
  const selected = new Set(ids);
  const byId = new Map(placements.map((placement) => [placement.id, placement]));

  return ids.filter((id) => {
    const placement = byId.get(id);

    return (
      placement === undefined ||
      !placement.ancestors.some((ancestor) => selected.has(ancestor))
    );
  });
}

/** Exact hit-test by inverse-transforming into node-local space. */
export function containsPoint(node: PlacedNode, point: Point): boolean {
  if (node.width <= 0 || node.height <= 0) {
    return false;
  }

  const inverse = invert(node.matrix);

  if (inverse === undefined) {
    return false;
  }

  const local = applyMatrix(inverse, point);

  return local.x >= 0 && local.x <= node.width && local.y >= 0 && local.y <= node.height;
}

/** Four world-space corners, clockwise from top-left. */
export function corners(node: PlacedNode): [Point, Point, Point, Point] {
  return [
    applyMatrix(node.matrix, { x: 0, y: 0 }),
    applyMatrix(node.matrix, { x: node.width, y: 0 }),
    applyMatrix(node.matrix, { x: node.width, y: node.height }),
    applyMatrix(node.matrix, { x: 0, y: node.height }),
  ];
}

export interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Axis-aligned world bounds for marquee/alignment, not precise hit-testing. */
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

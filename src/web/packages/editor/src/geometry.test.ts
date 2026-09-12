import { describe, expect, it } from 'vitest';
import {
  IDENTITY,
  applyMatrix,
  boundsContain,
  boundsIntersect,
  containsPoint,
  corners,
  invert,
  localMatrix,
  multiply,
  placeNodes,
  unionBounds,
  worldBounds,
} from './geometry.js';
import type { ThemeNode } from '@vigilia/renderer-core';

function rect(id: string, transform: ThemeNode['transform']): ThemeNode {
  return { id, type: 'rectangle', transform } as ThemeNode;
}

function group(id: string, transform: ThemeNode['transform'], children: ThemeNode[]): ThemeNode {
  return { id, type: 'group', transform, children } as ThemeNode;
}

const find = (nodes: readonly ThemeNode[], id: string) =>
  placeNodes(nodes).find((node) => node.id === id)!;

describe('matrix arithmetic', () => {
  it('multiplies in first-then-second order', () => {
    const translate = { ...IDENTITY, e: 10, f: 0 };
    const scale = { ...IDENTITY, a: 2, d: 2 };

    // Translate then scale: the translation is scaled too.
    expect(applyMatrix(multiply(translate, scale), { x: 0, y: 0 })).toEqual({ x: 20, y: 0 });
    // Scale then translate: the translation is not.
    expect(applyMatrix(multiply(scale, translate), { x: 0, y: 0 })).toEqual({ x: 10, y: 0 });
  });

  it('inverts a transform exactly', () => {
    const matrix = localMatrix({ x: 30, y: 40, width: 100, height: 50, rotation: 37 });
    const inverse = invert(matrix)!;

    const point = { x: 12.5, y: 7.25 };
    const roundTripped = applyMatrix(inverse, applyMatrix(matrix, point));

    expect(roundTripped.x).toBeCloseTo(point.x, 10);
    expect(roundTripped.y).toBeCloseTo(point.y, 10);
  });

  it('returns undefined rather than infinities for a collapsed transform', () => {
    // `scaleX: 0` is legal in the schema. Dividing by a zero determinant would
    // produce infinities, and every subsequent hit-test would match.
    expect(invert(localMatrix({ width: 10, height: 10, scaleX: 0 }))).toBeUndefined();
  });
});

describe('localMatrix', () => {
  it('is a plain translation when there is nothing else', () => {
    expect(localMatrix({ x: 5, y: 7, width: 10, height: 10 })).toEqual({
      ...IDENTITY,
      e: 5,
      f: 7,
    });
  });

  it('rotates about the centre, matching transform-origin: 50% 50%', () => {
    // The DOM sets left/top then rotates about the element's own centre. If this
    // composed in another order, every handle on a rotated node would be drawn
    // somewhere the browser did not put the node.
    const matrix = localMatrix({ x: 0, y: 0, width: 100, height: 100, rotation: 90 });
    const centre = applyMatrix(matrix, { x: 50, y: 50 });

    expect(centre.x).toBeCloseTo(50, 10);
    expect(centre.y).toBeCloseTo(50, 10);

    // The top-left corner lands where the top-right was.
    const topLeft = applyMatrix(matrix, { x: 0, y: 0 });
    expect(topLeft.x).toBeCloseTo(100, 10);
    expect(topLeft.y).toBeCloseTo(0, 10);
  });

  it('scales about the centre too', () => {
    const matrix = localMatrix({ x: 0, y: 0, width: 100, height: 100, scaleX: 2, scaleY: 2 });

    expect(applyMatrix(matrix, { x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
    expect(applyMatrix(matrix, { x: 0, y: 0 })).toEqual({ x: -50, y: -50 });
  });

  it('treats an absent transform as the origin', () => {
    expect(localMatrix(undefined)).toEqual(IDENTITY);
  });
});

describe('placeNodes', () => {
  it('composes nested group transforms', () => {
    // §57: a child's coordinates are group-local, so world position is the
    // chain. Getting this wrong is invisible until a group is moved.
    const nodes = [
      group('outer', { x: 100, y: 50 }, [
        group('inner', { x: 10, y: 5 }, [rect('leaf', { x: 1, y: 2, width: 10, height: 10 })]),
      ]),
    ];

    const leaf = find(nodes, 'leaf');
    expect(applyMatrix(leaf.matrix, { x: 0, y: 0 })).toEqual({ x: 111, y: 57 });
  });

  it('records depth and ancestors', () => {
    const nodes = [group('outer', {}, [group('inner', {}, [rect('leaf', {})])])];
    const leaf = find(nodes, 'leaf');

    expect(leaf.depth).toBe(2);
    expect(leaf.ancestors).toEqual(['outer', 'inner']);
  });

  it('emits nodes in paint order', () => {
    const nodes = [
      rect('first', {}),
      group('g', {}, [rect('child-a', {}), rect('child-b', {})]),
      rect('last', {}),
    ];

    expect(placeNodes(nodes).map((node) => node.id)).toEqual([
      'first',
      'g',
      'child-a',
      'child-b',
      'last',
    ]);
  });

  it('propagates invisibility to children', () => {
    // The DOM puts `display: none` on the group, which removes the subtree —
    // so a visible child of a hidden group is not on screen either.
    const nodes = [
      { ...group('g', {}, [rect('child', {})]), visible: false } as ThemeNode,
    ];

    expect(find(nodes, 'child').visible).toBe(false);
  });

  it('reports locked without acting on it', () => {
    // §61: locked stays selectable; refusing the transform is elsewhere.
    const nodes = [{ ...rect('r', {}), locked: true } as ThemeNode];
    expect(find(nodes, 'r').locked).toBe(true);
  });
});

describe('containsPoint', () => {
  const nodes = [rect('r', { x: 10, y: 10, width: 100, height: 50 })];
  const node = find(nodes, 'r');

  it('accepts a point inside and on the edge', () => {
    expect(containsPoint(node, { x: 60, y: 30 })).toBe(true);
    expect(containsPoint(node, { x: 10, y: 10 })).toBe(true);
    expect(containsPoint(node, { x: 110, y: 60 })).toBe(true);
  });

  it('rejects a point outside', () => {
    expect(containsPoint(node, { x: 9.9, y: 30 })).toBe(false);
    expect(containsPoint(node, { x: 60, y: 61 })).toBe(false);
  });

  it('is exact for a rotated node, where a bounding box would not be', () => {
    // The whole reason this uses matrices. A 45°-rotated square's bounding box
    // includes corners the square does not cover.
    const rotated = find([rect('r', { x: 0, y: 0, width: 100, height: 100, rotation: 45 })], 'r');

    // Centre is inside either way.
    expect(containsPoint(rotated, { x: 50, y: 50 })).toBe(true);
    // The bounding-box corner is outside the rotated shape.
    const bounds = worldBounds(rotated);
    expect(containsPoint(rotated, { x: bounds.left + 1, y: bounds.top + 1 })).toBe(false);
  });

  it('never matches a zero-sized node', () => {
    // Legal in the format, impossible to see, and it would steal a gesture.
    const zero = find([rect('z', { x: 0, y: 0, width: 0, height: 0 })], 'z');
    expect(containsPoint(zero, { x: 0, y: 0 })).toBe(false);
  });
});

describe('bounds', () => {
  it('covers all four corners of a rotated node', () => {
    const rotated = find([rect('r', { x: 0, y: 0, width: 100, height: 20, rotation: 90 })], 'r');
    const bounds = worldBounds(rotated);

    // A 100×20 box rotated 90° about its centre occupies 20×100, centred where
    // it was.
    expect(bounds.right - bounds.left).toBeCloseTo(20, 10);
    expect(bounds.bottom - bounds.top).toBeCloseTo(100, 10);
  });

  it('orders corners clockwise from the top-left', () => {
    const node = find([rect('r', { x: 0, y: 0, width: 10, height: 4 })], 'r');

    expect(corners(node)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 0, y: 4 },
    ]);
  });

  it('detects intersection and containment', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    const b = { left: 5, top: 5, right: 20, bottom: 20 };
    const inside = { left: 2, top: 2, right: 4, bottom: 4 };

    expect(boundsIntersect(a, b)).toBe(true);
    expect(boundsContain(a, inside)).toBe(true);
    expect(boundsContain(a, b)).toBe(false);
  });

  it('treats touching edges as intersecting', () => {
    // A marquee dragged exactly to a node's edge should catch it: the author
    // can see the line touching the shape.
    expect(
      boundsIntersect({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 }),
    ).toBe(true);
  });

  it('unions several placements, and returns undefined for none', () => {
    const nodes = [
      rect('a', { x: 0, y: 0, width: 10, height: 10 }),
      rect('b', { x: 100, y: 50, width: 10, height: 10 }),
    ];

    expect(unionBounds(placeNodes(nodes))).toEqual({
      left: 0,
      top: 0,
      right: 110,
      bottom: 60,
    });
    expect(unionBounds([])).toBeUndefined();
  });
});

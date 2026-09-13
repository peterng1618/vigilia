import { describe, expect, it } from 'vitest';
import type { ThemeDocument, ThemeNode, Transform } from '@vigilia/renderer-core';

import { applyGroupTransform, groupTransformOf } from './group-transform.js';

function rect(id: string, transform: Transform): ThemeNode {
  return { id, type: 'rectangle', transform };
}

function group(id: string, children: readonly ThemeNode[]): ThemeNode {
  return { id, type: 'group', children } as ThemeNode;
}

function doc(nodes: readonly ThemeNode[]): ThemeDocument {
  return {
    schemaVersion: 1,
    id: 'group-transform-fixture',
    artboard: { width: 1000, height: 1000 },
    nodes,
  };
}

/** Two children, so the union is wider than either. */
const panel = doc([
  group('panel', [
    rect('a', { x: 100, y: 50, width: 100, height: 40 }),
    rect('b', { x: 250, y: 50, width: 50, height: 40 }),
  ]),
]);

describe('groupTransformOf', () => {
  it('derives the box from the union of its children', () => {
    expect(groupTransformOf(panel, 'panel')).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 40,
      rotation: 0,
    });
  });

  it('reports rotation as 0 rather than guessing from a rotated child', () => {
    const tilted = doc([group('g', [rect('r', { x: 0, y: 0, width: 10, height: 10, rotation: 30 })])]);

    expect(groupTransformOf(tilted, 'g')?.rotation).toBe(0);
  });

  it('is undefined for a non-group', () => {
    expect(groupTransformOf(panel, 'a')).toBeUndefined();
  });

  it('is undefined for a group with no children, where zeros would mislead', () => {
    expect(groupTransformOf(doc([group('empty', [])]), 'empty')).toBeUndefined();
  });
});

describe('applyGroupTransform — the row is editable even though it is derived', () => {
  it('moves every child by the delta when x changes', () => {
    // The regression this fixes: removing the row entirely meant an author
    // could not move a group from the inspector at all.
    const moves = applyGroupTransform(panel, 'panel', 'x', 140);

    expect(moves.get('a')?.x).toBe(140);
    expect(moves.get('b')?.x).toBe(290);
    // The cross axis is untouched.
    expect(moves.get('a')?.y).toBe(50);
  });

  it('moves on y independently', () => {
    const moves = applyGroupTransform(panel, 'panel', 'y', 70);

    expect(moves.get('a')?.y).toBe(70);
    expect(moves.get('b')?.y).toBe(70);
    expect(moves.get('a')?.x).toBe(100);
  });

  it('still derives width and height, which the selection outline needs', () => {
    // Derived but not editable: resizing a group is not an operation, so
    // `applyGroupTransform` takes no size property at all — the type rejects it
    // rather than a guard refusing it at runtime.
    const derived = groupTransformOf(panel, 'panel');

    expect(derived?.width).toBe(200);
    expect(derived?.height).toBe(40);
  });

  it('refuses rotation rather than rotating each child about its own centre', () => {
    // That is a different operation and visibly wrong. A row that cannot work
    // must not pretend to.
    expect(applyGroupTransform(panel, 'panel', 'rotation', 45).size).toBe(0);
  });

  it('produces nothing for a no-op edit, so no undo entry is written', () => {
    expect(applyGroupTransform(panel, 'panel', 'x', 100).size).toBe(0);
    expect(applyGroupTransform(panel, 'panel', 'y', 50).size).toBe(0);
  });

  it('keeps geometry integral', () => {
    // Whole units, per D1.
    const moves = applyGroupTransform(panel, 'panel', 'x', 137);

    for (const transform of moves.values()) {
      expect(Number.isInteger(transform.x ?? 0)).toBe(true);
    }
  });
});

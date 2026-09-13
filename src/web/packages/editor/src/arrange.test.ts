import { describe, expect, it } from 'vitest';
import type { ThemeDocument, ThemeNode, Transform } from '@vigilia/renderer-core';
import {
  alignNodes,
  composeTransforms,
  distributeNodes,
  freeGroupId,
  groupNodes,
  ungroupNodes,
} from './arrange.js';
import { applyMatrix, localMatrix, multiply, placeNodes, worldBounds } from './geometry.js';
import { findNode } from './commands.js';

function rect(id: string, transform: Transform): ThemeNode {
  return { id, type: 'rectangle', transform };
}

function doc(nodes: readonly ThemeNode[]): ThemeDocument {
  return {
    schemaVersion: 1,
    id: 'arrange-fixture',
    artboard: { width: 1000, height: 1000 },
    nodes,
  };
}

/** Where a node's top-left corner lands in world space. */
function cornerOf(document_: ThemeDocument, id: string) {
  const placement = placeNodes(document_.nodes).find((candidate) => candidate.id === id);

  if (placement === undefined) {
    throw new Error(`no placement for ${id}`);
  }

  return applyMatrix(placement.matrix, { x: 0, y: 0 });
}

function boundsOf(document_: ThemeDocument, id: string) {
  const placement = placeNodes(document_.nodes).find((candidate) => candidate.id === id);

  if (placement === undefined) {
    throw new Error(`no placement for ${id}`);
  }

  return worldBounds(placement);
}

describe('groupNodes', () => {
  const flat = doc([
    rect('a', { x: 10, y: 20, width: 50, height: 50 }),
    rect('b', { x: 100, y: 40, width: 50, height: 30 }),
    rect('c', { x: 200, y: 0, width: 10, height: 10 }),
  ]);

  it('wraps the selection in a group whose box is their bounds', () => {
    const { document: next, select } = groupNodes(flat, ['a', 'b'], 'g1');

    expect(select).toEqual(['g1']);

    const group = findNode(next.nodes, 'g1');
    expect(group?.transform).toEqual({ x: 10, y: 20, width: 140, height: 50 });
  });

  it('leaves every member exactly where it was on screen', () => {
    const { document: next } = groupNodes(flat, ['a', 'b'], 'g1');

    // The whole point: grouping is a structural change, not a visual one.
    expect(cornerOf(next, 'a')).toEqual(cornerOf(flat, 'a'));
    expect(cornerOf(next, 'b')).toEqual(cornerOf(flat, 'b'));
  });

  it('keeps the members in paint order, whatever order they were picked', () => {
    const { document: next } = groupNodes(flat, ['b', 'a'], 'g1');
    const group = findNode(next.nodes, 'g1');

    expect(group?.type === 'group' && group.children.map((child) => child.id)).toEqual(['a', 'b']);
  });

  it('puts the group where the topmost member was, so nothing changes what covers what', () => {
    // `b` was above `a` and below `c`; the group takes b's slot.
    const { document: next } = groupNodes(flat, ['a', 'b'], 'g1');

    expect(next.nodes.map((node) => node.id)).toEqual(['g1', 'c']);
  });

  it('groups inside a group, relative to that group', () => {
    const nested = doc([
      {
        id: 'outer',
        type: 'group',
        transform: { x: 300, y: 300, width: 200, height: 200 },
        children: [
          rect('x', { x: 10, y: 10, width: 20, height: 20 }),
          rect('y', { x: 50, y: 50, width: 20, height: 20 }),
        ],
      },
    ]);

    const { document: next } = groupNodes(nested, ['x', 'y'], 'g1');
    const group = findNode(next.nodes, 'g1');

    // In the OUTER group's space, not the document's: using world bounds here
    // would offset the new group by the outer group's translation.
    expect(group?.transform).toEqual({ x: 10, y: 10, width: 60, height: 60 });
    expect(cornerOf(next, 'x')).toEqual(cornerOf(nested, 'x'));
  });

  it('refuses fewer than two nodes', () => {
    expect(groupNodes(flat, ['a'], 'g1').refused).toBe('needs-two');
    expect(groupNodes(flat, [], 'g1').refused).toBe('nothing-selected');
  });

  it('refuses a selection spanning two parents', () => {
    const mixed = doc([
      rect('top', { x: 0, y: 0, width: 10, height: 10 }),
      {
        id: 'outer',
        type: 'group',
        transform: { x: 100, y: 100, width: 100, height: 100 },
        children: [rect('inside', { x: 0, y: 0, width: 10, height: 10 })],
      },
    ]);

    const result = groupNodes(mixed, ['top', 'inside'], 'g1');

    expect(result.refused).toBe('mixed-parents');
    expect(result.document).toBe(mixed);
  });

  it('includes a rotated member by its axis-aligned extent', () => {
    // A rotated node's bounds are wider than its width, and the group must
    // contain what the node actually covers.
    const rotated = doc([
      rect('a', { x: 0, y: 0, width: 100, height: 10, rotation: 90 }),
      rect('b', { x: 200, y: 0, width: 10, height: 10 }),
    ]);

    const { document: next } = groupNodes(rotated, ['a', 'b'], 'g1');
    const group = findNode(next.nodes, 'g1');

    // Rotating 100×10 by 90° about its centre spans x 45…55, y −45…55.
    expect(group?.transform?.x).toBeCloseTo(45, 6);
    expect(group?.transform?.y).toBeCloseTo(-45, 6);
    expect(group?.transform?.width).toBeCloseTo(210 - 45, 6);
  });
});

describe('ungroupNodes', () => {
  it('absorbs a translation-only group and nothing moves', () => {
    const document_ = doc([
      {
        id: 'g',
        type: 'group',
        transform: { x: 100, y: 50, width: 100, height: 100 },
        children: [rect('a', { x: 10, y: 20, width: 30, height: 30 })],
      },
    ]);

    const { document: next, select } = ungroupNodes(document_, ['g']);

    expect(select).toEqual(['a']);
    expect(findNode(next.nodes, 'g')).toBeUndefined();
    expect(findNode(next.nodes, 'a')?.transform).toMatchObject({ x: 110, y: 70 });
    expect(cornerOf(next, 'a')).toEqual(cornerOf(document_, 'a'));
  });

  it('absorbs a rotated group into a rotated child, exactly', () => {
    const document_ = doc([
      {
        id: 'g',
        type: 'group',
        transform: { x: 100, y: 50, width: 200, height: 200, rotation: 30 },
        children: [rect('a', { x: 10, y: 20, width: 60, height: 40, rotation: 15 })],
      },
    ]);

    const { document: next } = ungroupNodes(document_, ['g']);

    expect(findNode(next.nodes, 'a')?.transform?.rotation).toBeCloseTo(45, 9);

    // Every corner, not just the origin: a rotation composed about the wrong
    // centre still puts the top-left in the right place.
    const before = boundsOf(document_, 'a');
    const after = boundsOf(next, 'a');

    expect(after.left).toBeCloseTo(before.left, 6);
    expect(after.top).toBeCloseTo(before.top, 6);
    expect(after.right).toBeCloseTo(before.right, 6);
    expect(after.bottom).toBeCloseTo(before.bottom, 6);
  });

  it('absorbs a uniformly scaled group by baking the size', () => {
    const document_ = doc([
      {
        id: 'g',
        type: 'group',
        transform: { x: 0, y: 0, width: 100, height: 100, scaleX: 2, scaleY: 2 },
        children: [rect('a', { x: 10, y: 10, width: 20, height: 20 })],
      },
    ]);

    const { document: next } = ungroupNodes(document_, ['g']);
    const before = boundsOf(document_, 'a');
    const after = boundsOf(next, 'a');

    expect(after).toEqual(before);
    // Size baked rather than left as a scale factor, because a scaled group is
    // a layout decision and the size is what the author edits next.
    expect(findNode(next.nodes, 'a')?.transform?.width).toBeCloseTo(40, 9);
  });

  it('refuses when the composition would be a shear', () => {
    // Non-uniform group scale around a rotated child. R·S(2,1)·R(20°) is not
    // expressible as rotate-then-scale, so there is no honest answer.
    const document_ = doc([
      {
        id: 'g',
        type: 'group',
        transform: { x: 0, y: 0, width: 100, height: 100, scaleX: 2, scaleY: 1 },
        children: [rect('a', { x: 10, y: 10, width: 20, height: 20, rotation: 20 })],
      },
    ]);

    const result = ungroupNodes(document_, ['g']);

    expect(result.refused).toBe('would-shear');
    expect(result.document).toBe(document_);
  });

  it('allows a non-uniform group when the child is not rotated', () => {
    const document_ = doc([
      {
        id: 'g',
        type: 'group',
        transform: { x: 0, y: 0, width: 100, height: 100, scaleX: 2, scaleY: 1 },
        children: [rect('a', { x: 10, y: 10, width: 20, height: 20 })],
      },
    ]);

    const { document: next, refused } = ungroupNodes(document_, ['g']);

    expect(refused).toBeUndefined();

    const before = boundsOf(document_, 'a');
    const after = boundsOf(next, 'a');

    expect(after.left).toBeCloseTo(before.left, 6);
    expect(after.right).toBeCloseTo(before.right, 6);
  });

  it('refuses a non-group and a locked group (§61)', () => {
    const document_ = doc([
      rect('a', { x: 0, y: 0, width: 10, height: 10 }),
      {
        id: 'locked',
        type: 'group',
        locked: true,
        transform: { x: 0, y: 0, width: 10, height: 10 },
        children: [rect('b', { x: 0, y: 0, width: 5, height: 5 })],
      },
    ]);

    expect(ungroupNodes(document_, ['a']).refused).toBe('not-a-group');
    expect(ungroupNodes(document_, ['locked']).refused).toBe('locked');
  });

  it('restores the children to the group\'s place in paint order', () => {
    const document_ = doc([
      rect('under', { x: 0, y: 0, width: 10, height: 10 }),
      {
        id: 'g',
        type: 'group',
        transform: { x: 0, y: 0, width: 10, height: 10 },
        children: [rect('a', { x: 0, y: 0, width: 5, height: 5 })],
      },
      rect('over', { x: 0, y: 0, width: 10, height: 10 }),
    ]);

    const { document: next } = ungroupNodes(document_, ['g']);

    expect(next.nodes.map((node) => node.id)).toEqual(['under', 'a', 'over']);
  });

  it('preserves hidden state so ungrouping a hidden group does not reveal children', () => {
    const document_ = doc([
      {
        id: 'hidden-group',
        type: 'group',
        visible: false,
        transform: { x: 0, y: 0, width: 10, height: 10 },
        children: [
          rect('child-default', { x: 0, y: 0, width: 5, height: 5 }),
          { ...rect('child-explicit-visible', { x: 5, y: 5, width: 5, height: 5 }), visible: true },
          { ...rect('child-already-hidden', { x: 2, y: 2, width: 5, height: 5 }), visible: false },
        ],
      },
    ]);

    const { document: next } = ungroupNodes(document_, ['hidden-group']);

    expect(findNode(next.nodes, 'child-default')?.visible).toBe(false);
    expect(findNode(next.nodes, 'child-explicit-visible')?.visible).toBe(false);
    expect(findNode(next.nodes, 'child-already-hidden')?.visible).toBe(false);
  });
});

describe('composeTransforms', () => {
  it('produces a transform whose matrix equals the composed one', () => {
    const group: Transform = { x: 7, y: 11, width: 80, height: 60, rotation: 25, scaleX: 1.5, scaleY: 1.5 };
    const child: Transform = { x: 3, y: 5, width: 20, height: 10, rotation: 40 };

    const composed = composeTransforms(group, child);
    const expected = multiply(localMatrix(child), localMatrix(group));
    const actual = localMatrix(composed);

    // The child's own box changes size when the group scales, so the matrices
    // are compared on where a corner LANDS rather than component by component.
    for (const point of [
      { x: 0, y: 0 },
      { x: 20, y: 10 },
    ]) {
      const want = applyMatrix(expected, point);
      const got = applyMatrix(actual, {
        x: point.x * 1.5,
        y: point.y * 1.5,
      });

      expect(got.x).toBeCloseTo(want.x, 6);
      expect(got.y).toBeCloseTo(want.y, 6);
    }
  });

  it('returns undefined rather than a shear', () => {
    expect(
      composeTransforms({ scaleX: 2, scaleY: 1, width: 10, height: 10 }, { rotation: 10 }),
    ).toBeUndefined();
  });

  it('treats a 360° child rotation as unrotated', () => {
    // Same orientation, so the composition is representable — refusing here
    // would be an arithmetic accident rather than a rule.
    expect(
      composeTransforms({ scaleX: 2, scaleY: 1, width: 10, height: 10 }, { rotation: 360 }),
    ).toBeDefined();
  });
});

describe('alignNodes', () => {
  const document_ = doc([
    rect('a', { x: 0, y: 0, width: 100, height: 20 }),
    rect('b', { x: 50, y: 100, width: 40, height: 20 }),
    rect('c', { x: 200, y: 200, width: 60, height: 20 }),
  ]);

  it('aligns to the selection bounds, not the artboard', () => {
    const { document: next } = alignNodes(document_, ['a', 'b', 'c'], 'left');

    // Everything moves to x 0 because `a` already starts there — aligning to
    // the artboard's left would be the same here, so the real assertion is the
    // next test.
    expect(findNode(next.nodes, 'b')?.transform?.x).toBe(0);
    expect(findNode(next.nodes, 'c')?.transform?.x).toBe(0);
  });

  it('aligns right to the rightmost member', () => {
    const { document: next } = alignNodes(document_, ['a', 'b'], 'right');

    // `a` spans to 100, `b` to 90, so `b` moves right by 10 and `a` stays.
    expect(findNode(next.nodes, 'b')?.transform?.x).toBe(60);
    expect(findNode(next.nodes, 'a')?.transform?.x).toBe(0);
  });

  it('centres on the selection midpoint', () => {
    const { document: next } = alignNodes(document_, ['a', 'b'], 'centre');

    // Selection spans 0…100, midpoint 50. `a` is already centred there.
    expect(findNode(next.nodes, 'a')?.transform?.x).toBe(0);
    expect(findNode(next.nodes, 'b')?.transform?.x).toBe(30);
  });

  it('aligns vertically without touching x', () => {
    const { document: next } = alignNodes(document_, ['a', 'b'], 'top');

    expect(findNode(next.nodes, 'b')?.transform).toMatchObject({ x: 50, y: 0 });
  });

  it('writes into the parent space when the parent is transformed', () => {
    const nested = doc([
      {
        id: 'outer',
        type: 'group',
        transform: { x: 0, y: 0, width: 400, height: 400, scaleX: 2, scaleY: 2 },
        children: [
          rect('x', { x: 0, y: 0, width: 50, height: 10 }),
          rect('y', { x: 100, y: 100, width: 50, height: 10 }),
        ],
      },
    ]);

    const { document: next } = alignNodes(nested, ['x', 'y'], 'left');

    // A world-space delta of −200 inside a 2× group is −100 locally. Writing
    // the world delta straight into `x` would overshoot by a factor of two.
    expect(findNode(next.nodes, 'y')?.transform?.x).toBeCloseTo(0, 6);
    expect(boundsOf(next, 'y').left).toBeCloseTo(boundsOf(next, 'x').left, 6);
  });

  it('refuses a single node, and skips a locked one (§61)', () => {
    expect(alignNodes(document_, ['a'], 'left').refused).toBe('needs-two');

    const withLocked = doc([
      rect('a', { x: 0, y: 0, width: 10, height: 10 }),
      { ...rect('b', { x: 100, y: 0, width: 10, height: 10 }), locked: true },
    ]);

    // One movable node left, so there is nothing to align it to.
    expect(alignNodes(withLocked, ['a', 'b'], 'left').refused).toBe('needs-two');
  });
});

describe('distributeNodes', () => {
  it('equalises the gaps, not the centres', () => {
    // Widths 10, 40, 10 across 0…160. Used 60, so three gaps of (160−60)/2 = 50.
    const document_ = doc([
      rect('a', { x: 0, y: 0, width: 10, height: 10 }),
      rect('b', { x: 20, y: 0, width: 40, height: 10 }),
      rect('c', { x: 150, y: 0, width: 10, height: 10 }),
    ]);

    const { document: next } = distributeNodes(document_, ['a', 'b', 'c'], 'x');

    expect(findNode(next.nodes, 'a')?.transform?.x).toBeCloseTo(0, 9);
    expect(findNode(next.nodes, 'b')?.transform?.x).toBeCloseTo(60, 9);
    expect(findNode(next.nodes, 'c')?.transform?.x).toBeCloseTo(150, 9);

    // Equal gaps: 60−10 = 50, and 150−100 = 50.
    const boxes = ['a', 'b', 'c'].map((id) => boundsOf(next, id));
    expect(boxes[1]!.left - boxes[0]!.right).toBeCloseTo(boxes[2]!.left - boxes[1]!.right, 9);
  });

  it('leaves the outermost two alone', () => {
    const document_ = doc([
      rect('a', { x: 0, y: 0, width: 10, height: 10 }),
      rect('b', { x: 17, y: 0, width: 10, height: 10 }),
      rect('c', { x: 100, y: 0, width: 10, height: 10 }),
    ]);

    const { document: next } = distributeNodes(document_, ['a', 'b', 'c'], 'x');

    expect(findNode(next.nodes, 'a')?.transform?.x).toBe(0);
    expect(findNode(next.nodes, 'c')?.transform?.x).toBe(100);
  });

  it('sorts by position rather than by selection order', () => {
    const document_ = doc([
      rect('a', { x: 100, y: 0, width: 10, height: 10 }),
      rect('b', { x: 0, y: 0, width: 10, height: 10 }),
      rect('c', { x: 40, y: 0, width: 10, height: 10 }),
    ]);

    const { document: next } = distributeNodes(document_, ['a', 'b', 'c'], 'x');

    // `b` is leftmost and `a` rightmost, so those are the fixed ends.
    expect(findNode(next.nodes, 'b')?.transform?.x).toBe(0);
    expect(findNode(next.nodes, 'a')?.transform?.x).toBe(100);
    // Span 0…110 holding 30 of content: two gaps of 40, so `c` lands at 50.
    // (Written as 45 first — a midpoint, which is what equal *centres* would
    // give. The difference between the two rules is the point of this module.)
    expect(findNode(next.nodes, 'c')?.transform?.x).toBeCloseTo(50, 9);
  });

  it('refuses fewer than three', () => {
    const document_ = doc([
      rect('a', { x: 0, y: 0, width: 10, height: 10 }),
      rect('b', { x: 50, y: 0, width: 10, height: 10 }),
    ]);

    // Two nodes are "distributed" at any spacing, so this would be a no-op
    // that still wrote an undo entry.
    expect(distributeNodes(document_, ['a', 'b'], 'x').refused).toBe('needs-two');
  });
});

describe('freeGroupId', () => {
  it('avoids every id in the document, at any depth', () => {
    const document_ = doc([
      rect('group', { x: 0, y: 0, width: 1, height: 1 }),
      {
        id: 'wrapper',
        type: 'group',
        transform: { x: 0, y: 0, width: 1, height: 1 },
        children: [rect('group-2', { x: 0, y: 0, width: 1, height: 1 })],
      },
    ]);

    expect(freeGroupId(document_)).toBe('group-3');
  });
});

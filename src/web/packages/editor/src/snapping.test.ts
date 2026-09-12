import { describe, expect, it } from 'vitest';
import {
  collectSnapTargets,
  snapMove,
  thresholdInDocumentUnits,
  type SnapTarget,
} from './snapping.js';
import { placeNodes } from './geometry.js';
import type { ThemeNode } from '@vigilia/renderer-core';

const artboard = { width: 1000, height: 600 };

function rect(id: string, x: number, y: number, width: number, height: number, extra = {}): ThemeNode {
  return { id, type: 'rectangle', transform: { x, y, width, height }, ...extra } as ThemeNode;
}

const dragged = { left: 100, top: 100, right: 200, bottom: 150 };

function targetsFor(nodes: readonly ThemeNode[], exclude: string[] = []): SnapTarget[] {
  return collectSnapTargets(placeNodes(nodes), artboard, new Set(exclude));
}

describe('collectSnapTargets', () => {
  it('always offers the artboard edges and centre', () => {
    const targets = collectSnapTargets([], artboard);

    expect(targets.filter((t) => t.source === 'artboard')).toHaveLength(6);
    expect(targets).toContainEqual({ axis: 'x', position: 500, source: 'artboard', kind: 'centre' });
    expect(targets).toContainEqual({ axis: 'y', position: 600, source: 'artboard', kind: 'end' });
  });

  it('offers each node\'s edges and centre on both axes', () => {
    const targets = targetsFor([rect('a', 300, 200, 100, 50)]);
    const fromA = targets.filter((t) => t.source === 'a');

    expect(fromA).toHaveLength(6);
    expect(fromA).toContainEqual({ axis: 'x', position: 350, source: 'a', kind: 'centre' });
    expect(fromA).toContainEqual({ axis: 'y', position: 250, source: 'a', kind: 'end' });
  });

  it('excludes the nodes being dragged, so a selection cannot fight itself', () => {
    const targets = targetsFor([rect('a', 0, 0, 10, 10), rect('b', 50, 50, 10, 10)], ['a']);

    expect(targets.some((t) => t.source === 'a')).toBe(false);
    expect(targets.some((t) => t.source === 'b')).toBe(true);
  });

  it('excludes a child of a dragged group', () => {
    // The child moves with the group, so its edges are not an independent
    // alignment — snapping to them would mean snapping to yourself.
    const nodes = [
      {
        id: 'g',
        type: 'group',
        transform: { x: 0, y: 0 },
        children: [rect('child', 10, 10, 20, 20)],
      } as ThemeNode,
    ];

    expect(targetsFor(nodes, ['g']).some((t) => t.source === 'child')).toBe(false);
  });

  it('ignores hidden and zero-sized nodes', () => {
    // A guide pointing at an invisible edge cannot explain itself.
    const nodes = [
      rect('hidden', 0, 0, 10, 10, { visible: false }),
      rect('zero', 0, 0, 0, 0),
      rect('real', 0, 0, 10, 10),
    ];

    const sources = new Set(targetsFor(nodes).map((t) => t.source));

    expect(sources.has('hidden')).toBe(false);
    expect(sources.has('zero')).toBe(false);
    expect(sources.has('real')).toBe(true);
  });

  it('uses the rotated bounds of a rotated node', () => {
    const nodes = [
      { id: 'r', type: 'rectangle', transform: { x: 0, y: 0, width: 100, height: 20, rotation: 90 } } as ThemeNode,
    ];

    // Rotated about its centre (50, 10), so it occupies x 40…60.
    const xs = targetsFor(nodes)
      .filter((t) => t.source === 'r' && t.axis === 'x')
      .map((t) => t.position);

    // Rotation goes through sin/cos, so the far edge arrives as
    // 60.00000000000001. Compared approximately rather than rounded in the
    // implementation: a snap target is used for comparison, and rounding it
    // would make an exact alignment miss by the rounding error.
    expect(xs[0]).toBeCloseTo(40, 9);
    expect(xs[1]).toBeCloseTo(50, 9);
    expect(xs[2]).toBeCloseTo(60, 9);
  });
});

describe('snapMove', () => {
  const targets: SnapTarget[] = [
    { axis: 'x', position: 300, source: 'a', kind: 'start' },
    { axis: 'y', position: 400, source: 'a', kind: 'start' },
  ];

  it('pulls a near miss onto the target', () => {
    // Dragging +198 would put the left edge at 298; the target is 300.
    const result = snapMove(dragged, { x: 198, y: 0 }, targets, { threshold: 8 });

    expect(result.delta.x).toBe(200);
    expect(result.guides[0]).toMatchObject({ source: 'a', axis: 'x', moved: 'start' });
  });

  it('leaves a far miss alone', () => {
    // +50 puts the box at left 150, centre 200, right 250 — all far from the
    // x target at 300. The first version of this test used +150, which lands
    // the CENTRE exactly on 300: it snapped, correctly, and the test was wrong.
    // Worth keeping as a note, because "only the leading edge snaps" is the
    // natural wrong assumption here.
    const result = snapMove(dragged, { x: 50, y: 0 }, targets, { threshold: 8 });

    expect(result.delta).toEqual({ x: 50, y: 0 });
    expect(result.guides).toEqual([]);
  });

  it('snaps each axis independently', () => {
    // What makes aligning into a grid of panels feel effortless: left edge to
    // one neighbour, vertical centre to another.
    const result = snapMove(dragged, { x: 197, y: 302 }, targets, { threshold: 8 });

    expect(result.delta).toEqual({ x: 200, y: 300 });
    expect(result.guides).toHaveLength(2);
  });

  it('snaps the trailing edge and the centre, not only the leading edge', () => {
    // The dragged box is 100 wide. Moving +150 puts its right edge at 350;
    // a target at 352 should pull it.
    const edgeTargets: SnapTarget[] = [{ axis: 'x', position: 352, source: 'b', kind: 'end' }];
    const result = snapMove(dragged, { x: 150, y: 0 }, edgeTargets, { threshold: 8 });

    expect(result.delta.x).toBe(152);
    expect(result.guides[0]?.moved).toBe('end');
  });

  it('prefers a centre alignment when an edge is equally close', () => {
    // Same distance either way; a centre-to-centre alignment is almost always
    // what was meant, and an arbitrary tie-break would make the same drag snap
    // differently depending on iteration order.
    const tie: SnapTarget[] = [
      { axis: 'x', position: 205, source: 'edge', kind: 'start' },
      { axis: 'x', position: 255, source: 'mid', kind: 'centre' },
    ];

    // After +100: left 200, centre 250, right 300. Both targets are 5 away.
    const result = snapMove(dragged, { x: 100, y: 0 }, tie, { threshold: 8 });

    expect(result.guides[0]).toMatchObject({ source: 'mid', kind: 'centre', moved: 'centre' });
  });

  it('takes the nearest target when several are in range', () => {
    const many: SnapTarget[] = [
      { axis: 'x', position: 290, source: 'far', kind: 'start' },
      { axis: 'x', position: 299, source: 'near', kind: 'start' },
    ];

    const result = snapMove(dragged, { x: 200, y: 0 }, many, { threshold: 20 });

    expect(result.guides[0]?.source).toBe('near');
    expect(result.delta.x).toBe(199);
  });

  it('does nothing when disabled', () => {
    const result = snapMove(dragged, { x: 198, y: 0 }, targets, { threshold: 8, disabled: true });

    expect(result.delta.x).toBe(198);
    expect(result.guides).toEqual([]);
  });

  it('does nothing with a zero threshold', () => {
    expect(snapMove(dragged, { x: 198, y: 0 }, targets, { threshold: 0 }).delta.x).toBe(198);
  });

  it('reports which part of the dragged box landed, for drawing', () => {
    // An author needs to see which alignment they got, not just that something
    // moved.
    const result = snapMove(dragged, { x: 198, y: 0 }, targets, { threshold: 8 });

    expect(result.guides[0]).toEqual({
      axis: 'x',
      position: 300,
      source: 'a',
      kind: 'start',
      moved: 'start',
    });
  });
});

describe('thresholdInDocumentUnits', () => {
  it('divides by the artboard scale', () => {
    // A threshold in document units with a pixel value would be sticky at 25 %
    // zoom and imperceptible at 400 %.
    expect(thresholdInDocumentUnits(8, 2)).toBe(4);
    expect(thresholdInDocumentUnits(8, 0.5)).toBe(16);
  });

  it('passes the value through for a degenerate scale', () => {
    // Scale is 0 while an artboard has no visible area, which is a transient
    // state rather than an error.
    expect(thresholdInDocumentUnits(8, 0)).toBe(8);
    expect(thresholdInDocumentUnits(8, Number.NaN)).toBe(8);
  });
});

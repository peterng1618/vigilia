import { describe, expect, it } from 'vitest';
import { hitTest, hitTestDeep, marqueeSelect, normalizeBounds } from './hit-test.js';
import type { ThemeNode } from '@vigilia/renderer-core';

function rect(id: string, x: number, y: number, width: number, height: number, extra = {}): ThemeNode {
  return { id, type: 'rectangle', transform: { x, y, width, height }, ...extra } as ThemeNode;
}

function group(id: string, x: number, y: number, children: ThemeNode[], extra = {}): ThemeNode {
  return { id, type: 'group', transform: { x, y }, children, ...extra } as ThemeNode;
}

describe('hitTest', () => {
  it('picks the topmost node, not the smallest', () => {
    // A small dot on a panel must be selectable. "Smallest wins" would work
    // here by accident; the rule is paint order, and the next test is the one
    // that distinguishes them.
    const nodes = [rect('panel', 0, 0, 200, 100), rect('dot', 90, 45, 10, 10)];

    expect(hitTest(nodes, { x: 95, y: 50 })).toBe('dot');
  });

  it('picks a later sibling over an earlier one of the same size', () => {
    // §137: child order alone determines stacking. Identical boxes, so only
    // order can decide — and it must match what is drawn on top.
    const nodes = [rect('under', 0, 0, 100, 100), rect('over', 0, 0, 100, 100)];

    expect(hitTest(nodes, { x: 50, y: 50 })).toBe('over');
  });

  it('picks a large node over a small one that is beneath it', () => {
    // The case that rules out "smallest wins": the small node is painted first,
    // so the large one is genuinely on top and is what the author sees.
    const nodes = [rect('small', 40, 40, 20, 20), rect('large', 0, 0, 200, 200)];

    expect(hitTest(nodes, { x: 50, y: 50 })).toBe('large');
  });

  it('returns undefined on empty canvas', () => {
    expect(hitTest([rect('r', 0, 0, 10, 10)], { x: 500, y: 500 })).toBeUndefined();
  });

  it('selects the outermost group, not the leaf inside it', () => {
    // A widget should feel like one object until the author says otherwise.
    const nodes = [group('card', 100, 100, [rect('label', 0, 0, 50, 20)])];

    expect(hitTest(nodes, { x: 120, y: 110 })).toBe('card');
  });

  it('selects a child directly once its group is entered', () => {
    const nodes = [
      group('card', 100, 100, [rect('label', 0, 0, 50, 20), rect('value', 0, 30, 50, 20)]),
    ];

    expect(hitTest(nodes, { x: 120, y: 140 }, { enteredGroups: ['card'] })).toBe('value');
  });

  it('still selects the outer group when only an inner group is entered', () => {
    const nodes = [group('outer', 0, 0, [group('inner', 0, 0, [rect('leaf', 0, 0, 50, 50)])])];

    // Entering `inner` without `outer` is not a state the UI produces, but the
    // walk must not skip an un-entered ancestor just because a deeper one is
    // listed — that would let a click reach inside a group the author never
    // opened.
    expect(hitTest(nodes, { x: 10, y: 10 }, { enteredGroups: ['inner'] })).toBe('outer');
  });

  it('ignores hidden nodes entirely', () => {
    // Not on screen: a click that selected it would be indistinguishable from a
    // click that missed.
    const nodes = [rect('under', 0, 0, 100, 100), rect('hidden', 0, 0, 100, 100, { visible: false })];

    expect(hitTest(nodes, { x: 50, y: 50 })).toBe('under');
  });

  it('ignores children of a hidden group', () => {
    const nodes = [
      rect('under', 0, 0, 100, 100),
      group('g', 0, 0, [rect('child', 0, 0, 100, 100)], { visible: false }),
    ];

    expect(hitTest(nodes, { x: 50, y: 50 })).toBe('under');
  });

  it('selects a locked node by default (§61)', () => {
    // "Stays inspectable in the tree but cannot transform until unlocked" —
    // so selection is allowed and the transform layer refuses instead.
    const nodes = [rect('locked', 0, 0, 100, 100, { locked: true })];

    expect(hitTest(nodes, { x: 50, y: 50 })).toBe('locked');
  });

  it('can be asked to skip locked nodes', () => {
    const nodes = [rect('under', 0, 0, 100, 100), rect('locked', 0, 0, 100, 100, { locked: true })];

    expect(hitTest(nodes, { x: 50, y: 50 }, { includeLocked: false })).toBe('under');
  });

  it('hits a rotated node only where the shape actually is', () => {
    const rotated = [
      {
        id: 'r',
        type: 'rectangle',
        transform: { x: 0, y: 0, width: 100, height: 20, rotation: 90 },
      } as ThemeNode,
    ];

    // Rotated 90° about its centre (50, 10), so it now occupies x 40…60,
    // y −40…60. A bounding-box hit test would accept the second point.
    expect(hitTest(rotated, { x: 50, y: 55 })).toBe('r');
    expect(hitTest(rotated, { x: 90, y: 10 })).toBeUndefined();
  });
});

describe('hitTestDeep', () => {
  it('reaches the leaf regardless of grouping', () => {
    const nodes = [group('card', 100, 100, [rect('label', 0, 0, 50, 20)])];

    expect(hitTestDeep(nodes, { x: 120, y: 110 })).toBe('label');
  });

  it('returns the group itself when the point misses every child', () => {
    // The group's own box can be larger than its children.
    const nodes = [
      {
        id: 'card',
        type: 'group',
        transform: { x: 0, y: 0, width: 200, height: 200 },
        children: [rect('label', 0, 0, 10, 10)],
      } as ThemeNode,
    ];

    expect(hitTestDeep(nodes, { x: 150, y: 150 })).toBe('card');
  });
});

describe('marqueeSelect', () => {
  const nodes = [
    rect('a', 0, 0, 50, 50),
    rect('b', 100, 0, 50, 50),
    rect('c', 0, 100, 50, 50),
  ];

  it('selects everything the rectangle touches', () => {
    // Touching rather than containing is the convention in every drawing tool,
    // and containment makes a marquee useless for a row that extends past the
    // drag.
    expect(marqueeSelect(nodes, { left: 25, top: 25, right: 125, bottom: 75 })).toEqual(['a', 'b']);
  });

  it('can require full containment', () => {
    expect(
      marqueeSelect(nodes, { left: 25, top: 25, right: 125, bottom: 75 }, { requireFullyInside: true }),
    ).toEqual([]);

    expect(
      marqueeSelect(nodes, { left: -5, top: -5, right: 155, bottom: 55 }, { requireFullyInside: true }),
    ).toEqual(['a', 'b']);
  });

  it('accepts a rectangle dragged in any direction', () => {
    // The pointer may go down at the bottom-right.
    expect(marqueeSelect(nodes, { left: 125, top: 75, right: 25, bottom: 25 })).toEqual(['a', 'b']);
  });

  it('returns groups once, not each matching child', () => {
    const grouped = [group('card', 0, 0, [rect('one', 0, 0, 20, 20), rect('two', 30, 0, 20, 20)])];

    expect(marqueeSelect(grouped, { left: -10, top: -10, right: 100, bottom: 100 })).toEqual(['card']);
  });

  it('matches a group through its children, not its own box', () => {
    // A group's transform box may be smaller than the children it contains —
    // matching on the box alone would miss a group whose content spills out.
    const grouped = [
      {
        id: 'card',
        type: 'group',
        transform: { x: 0, y: 0, width: 1, height: 1 },
        children: [rect('spilling', 200, 200, 50, 50)],
      } as ThemeNode,
    ];

    expect(marqueeSelect(grouped, { left: 190, top: 190, right: 300, bottom: 300 })).toEqual(['card']);
  });

  it('selects children directly inside an entered group', () => {
    const grouped = [group('card', 0, 0, [rect('one', 0, 0, 20, 20), rect('two', 30, 0, 20, 20)])];

    expect(
      marqueeSelect(grouped, { left: -10, top: -10, right: 100, bottom: 100 }, { enteredGroups: ['card'] }),
    ).toEqual(['one', 'two']);
  });

  it('skips hidden and zero-sized nodes', () => {
    const mixed = [
      rect('visible', 0, 0, 10, 10),
      rect('hidden', 0, 0, 10, 10, { visible: false }),
      rect('zero', 0, 0, 0, 0),
    ];

    expect(marqueeSelect(mixed, { left: -5, top: -5, right: 50, bottom: 50 })).toEqual(['visible']);
  });

  it('returns results in paint order', () => {
    // So "align to the first" and a list in a status bar agree with the canvas.
    expect(marqueeSelect(nodes, { left: -10, top: -10, right: 200, bottom: 200 })).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('normalizeBounds', () => {
  it('orders the edges', () => {
    expect(normalizeBounds({ left: 10, top: 20, right: 0, bottom: 5 })).toEqual({
      left: 0,
      top: 5,
      right: 10,
      bottom: 20,
    });
  });
});

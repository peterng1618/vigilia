import { describe, expect, it } from 'vitest';
import {
  collectIds,
  deleteNodes,
  findNode,
  insertNodes,
  renameNode,
  reorderNode,
  setNodeFlags,
  updateStyle,
  updateChartSettings,
  updateTransforms,
} from './commands.js';
import { validateThemeDocument } from '@vigilia/renderer-core';
import type { ThemeDocument, ThemeNode } from '@vigilia/renderer-core';

function rect(id: string, x = 0): ThemeNode {
  return { id, type: 'rectangle', transform: { x, y: 0, width: 10, height: 10 } } as ThemeNode;
}

const document_: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 800, height: 600 },
  nodes: [
    rect('a'),
    {
      id: 'g',
      type: 'group',
      transform: { x: 100, y: 100 },
      children: [rect('b'), rect('c')],
    } as ThemeNode,
    rect('d'),
  ],
};

describe('updateTransforms', () => {
  it('replaces transforms anywhere in the tree', () => {
    const next = updateTransforms(
      document_,
      new Map([['b', { x: 5, y: 5, width: 20, height: 20 }]]),
    );

    expect(findNode(next.nodes, 'b')?.transform).toEqual({ x: 5, y: 5, width: 20, height: 20 });
  });

  it('rounds away floating-point dirt from the gesture maths', () => {
    // Dragging a node 37 px wrote 89.99999999999994 into the document, because
    // every gesture composes and inverts matrices and the error survives. The
    // inspector then showed a fourteen-digit number in a 60 px field and a
    // re-save produced a noisy diff for a drag that had visually landed round.
    const next = updateTransforms(
      document_,
      new Map([['b', { x: 89.99999999999994, y: 59.99999999999999, rotation: 14.999999999 }]]),
    );

    expect(findNode(next.nodes, 'b')?.transform).toEqual({ x: 90, y: 60, rotation: 15 });
  });

  it('rounds a typed fraction to the nearest whole unit', () => {
    // Geometry is integral by decision, so a fraction lands on a unit rather
    // than being refused — the author gets 121, not an error.
    const next = updateTransforms(document_, new Map([['b', { x: 120.75, y: 0.4 }]]));

    expect(findNode(next.nodes, 'b')?.transform).toEqual({ x: 121, y: 0 });
  });

  it('leaves scale alone, because a multiplier is not a unit', () => {
    // Rounding scaleX to 1 would silently discard an authored 0.9.
    const next = updateTransforms(document_, new Map([['b', { scaleX: 0.9, scaleY: 1.4 }]]));

    expect(findNode(next.nodes, 'b')?.transform).toEqual({ scaleX: 0.9, scaleY: 1.4 });
  });

  it('never writes -0, which would serialise into the document', () => {
    const next = updateTransforms(document_, new Map([['b', { x: -0.0001, y: -0 }]]));

    expect(Object.is(findNode(next.nodes, 'b')?.transform?.x, -0)).toBe(false);
    expect(Object.is(findNode(next.nodes, 'b')?.transform?.y, -0)).toBe(false);
  });

  it('updates several at once', () => {
    const next = updateTransforms(
      document_,
      new Map([
        ['a', { x: 1, y: 1 }],
        ['d', { x: 2, y: 2 }],
      ]),
    );

    expect(findNode(next.nodes, 'a')?.transform).toEqual({ x: 1, y: 1 });
    expect(findNode(next.nodes, 'd')?.transform).toEqual({ x: 2, y: 2 });
  });

  it('leaves the original document untouched', () => {
    updateTransforms(document_, new Map([['a', { x: 99 }]]));

    expect(findNode(document_.nodes, 'a')?.transform?.x).toBe(0);
  });

  it('returns the same document for an empty change', () => {
    expect(updateTransforms(document_, new Map())).toBe(document_);
  });

  it('shares untouched subtrees by reference', () => {
    // Reference equality is what lets a UI skip re-rendering a panel that did
    // not change.
    const next = updateTransforms(document_, new Map([['a', { x: 1 }]]));

    expect(findNode(next.nodes, 'g')).toBe(findNode(document_.nodes, 'g'));
  });
});

describe('updateStyle', () => {
  it('merges properties', () => {
    const withFill = updateStyle(document_, 'a', { fill: { value: '#fff' } });
    const withBoth = updateStyle(withFill, 'a', { opacity: { value: 0.5 } });

    expect(findNode(withBoth.nodes, 'a')?.style).toEqual({
      fill: { value: '#fff' },
      opacity: { value: 0.5 },
    });
  });

  it('deletes a property set to undefined, rather than storing it', () => {
    // `{ ref: undefined }` is not a valid style value (§75 requires exactly one
    // of ref or value) and storing it would fail validation on save. This is
    // how an inspector says "back to the default".
    const withFill = updateStyle(document_, 'a', { fill: { value: '#fff' } });
    const cleared = updateStyle(withFill, 'a', { fill: undefined });

    expect(findNode(cleared.nodes, 'a')?.style).toBeUndefined();
  });

  it('drops an emptied style map entirely', () => {
    const touched = updateStyle(document_, 'a', { fill: { value: '#fff' } });
    const reverted = updateStyle(touched, 'a', { fill: undefined });

    // So a saved document does not carry `"style": {}` on every node someone
    // touched and reverted.
    expect('style' in (findNode(reverted.nodes, 'a') as object)).toBe(false);
  });

  it('produces a document that still validates', () => {
    const next = updateStyle(document_, 'a', { fill: { value: '#ff0000' } });

    expect(validateThemeDocument(next).ok).toBe(true);
  });
});

describe('updateChartSettings', () => {
  it('replaces only authored settings on the selected chart', () => {
    const chart = {
      id: 'chart', type: 'chart', transform: { width: 100, height: 100 },
      content: { family: 'gauge', settings: { startAngle: 90, endAngle: -270, min: 0, max: 100, thickness: 10, track: { kind: 'solid', color: '#000' }, progress: { kind: 'solid', color: '#fff' }, roundCap: true } },
    } as ThemeNode;
    const source = { ...document_, nodes: [chart, ...document_.nodes] };
    const settings = { ...chart.content.settings, thickness: 20 };
    const next = updateChartSettings(source, 'chart', settings);

    expect(findNode(next.nodes, 'chart')?.content).toEqual({ family: 'gauge', settings });
    expect(findNode(source.nodes, 'chart')?.content).not.toBe(settings);
  });
});

describe('renameNode and setNodeFlags', () => {
  it('renames without touching the id (§75)', () => {
    const next = renameNode(document_, 'a', 'Header bar');
    const node = findNode(next.nodes, 'a')!;

    expect(node.name).toBe('Header bar');
    expect(node.id).toBe('a');
  });

  it('sets visibility and lock', () => {
    const next = setNodeFlags(document_, 'b', { visible: false, locked: true });
    const node = findNode(next.nodes, 'b')!;

    expect(node.visible).toBe(false);
    expect(node.locked).toBe(true);
  });
});

describe('deleteNodes', () => {
  it('removes a top-level node', () => {
    const next = deleteNodes(document_, new Set(['a']));

    expect(next.nodes.map((node) => node.id)).toEqual(['g', 'd']);
  });

  it('removes a child from inside a group', () => {
    const next = deleteNodes(document_, new Set(['b']));
    const group = findNode(next.nodes, 'g')!;

    expect(group.type).toBe('group');
    if (group.type === 'group') {
      expect(group.children.map((child) => child.id)).toEqual(['c']);
    }
  });

  it('removes a group with its children', () => {
    // They cannot exist without a parent, and promoting them would silently
    // change the design.
    const next = deleteNodes(document_, new Set(['g']));

    expect(collectIds(next.nodes)).toEqual(new Set(['a', 'd']));
  });

  it('returns the same document for an empty set', () => {
    expect(deleteNodes(document_, new Set())).toBe(document_);
  });
});

describe('insertNodes', () => {
  it('appends to the root by default, which is topmost (§137)', () => {
    // Last is on top, where a paste or a new element should be: visible.
    const next = insertNodes(document_, [rect('new')]);

    expect(next.nodes.at(-1)?.id).toBe('new');
  });

  it('inserts at an index', () => {
    const next = insertNodes(document_, [rect('new')], undefined, 1);

    expect(next.nodes.map((node) => node.id)).toEqual(['a', 'new', 'g', 'd']);
  });

  it('inserts into a group', () => {
    const next = insertNodes(document_, [rect('new')], 'g');
    const group = findNode(next.nodes, 'g')!;

    if (group.type === 'group') {
      expect(group.children.map((child) => child.id)).toEqual(['b', 'c', 'new']);
    }
  });

  it('clamps an out-of-range index instead of producing holes', () => {
    expect(insertNodes(document_, [rect('new')], undefined, 99).nodes.at(-1)?.id).toBe('new');
    expect(insertNodes(document_, [rect('new')], undefined, -5).nodes[0]?.id).toBe('new');
  });

  it('returns the same document when nothing is inserted', () => {
    expect(insertNodes(document_, [])).toBe(document_);
  });
});

describe('reorderNode', () => {
  it('brings a node to the front and back', () => {
    expect(reorderNode(document_, 'a', 'front').nodes.map((n) => n.id)).toEqual(['g', 'd', 'a']);
    expect(reorderNode(document_, 'd', 'back').nodes.map((n) => n.id)).toEqual(['d', 'a', 'g']);
  });

  it('steps one position at a time', () => {
    expect(reorderNode(document_, 'a', 'forward').nodes.map((n) => n.id)).toEqual(['g', 'a', 'd']);
    expect(reorderNode(document_, 'd', 'backward').nodes.map((n) => n.id)).toEqual(['a', 'd', 'g']);
  });

  it('stops at the ends rather than wrapping', () => {
    expect(reorderNode(document_, 'a', 'backward').nodes.map((n) => n.id)).toEqual(['a', 'g', 'd']);
    expect(reorderNode(document_, 'd', 'forward').nodes.map((n) => n.id)).toEqual(['a', 'g', 'd']);
  });

  it('reorders within a group, not across parents', () => {
    // Moving between parents changes the coordinate space a transform is
    // expressed in, so doing both at once would move the node on screen while
    // claiming to reorder it.
    const next = reorderNode(document_, 'b', 'front');
    const group = findNode(next.nodes, 'g')!;

    if (group.type === 'group') {
      expect(group.children.map((child) => child.id)).toEqual(['c', 'b']);
    }
    expect(next.nodes.map((node) => node.id)).toEqual(['a', 'g', 'd']);
  });

  it('returns the same document for an unknown id', () => {
    expect(reorderNode(document_, 'nope', 'front')).toBe(document_);
  });
});

describe('lookups', () => {
  it('finds a node at any depth', () => {
    expect(findNode(document_.nodes, 'c')?.id).toBe('c');
    expect(findNode(document_.nodes, 'nope')).toBeUndefined();
  });

  it('collects every id', () => {
    expect(collectIds(document_.nodes)).toEqual(new Set(['a', 'g', 'b', 'c', 'd']));
  });
});

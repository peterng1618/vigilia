import { describe, expect, it } from 'vitest';
import type { ThemeNode } from '@vigilia/renderer-core';
import { emptySelection, setSelection } from './selection/domain/selection-state.js';
import { buildLayerTree } from './layers-model.js';

function rect(id: string, overrides: Partial<ThemeNode> = {}): ThemeNode {
  return {
    id,
    name: id,
    type: 'rectangle',
    transform: { x: 0, y: 0, width: 10, height: 10 },
    ...overrides,
  } as ThemeNode;
}

describe('buildLayerTree', () => {
  it('lists topmost siblings first, the reverse of paint order (§137)', () => {
    const rows = buildLayerTree([rect('bottom'), rect('middle'), rect('top')], emptySelection);

    expect(rows.map((row) => row.id)).toEqual(['top', 'middle', 'bottom']);
  });

  it('flattens groups with depth and parent identity', () => {
    const nodes: readonly ThemeNode[] = [
      {
        id: 'outer',
        name: 'Outer',
        type: 'group',
        transform: { x: 0, y: 0, width: 20, height: 20 },
        children: [
          rect('under'),
          {
            id: 'inner',
            name: 'Inner',
            type: 'group',
            transform: { x: 0, y: 0, width: 10, height: 10 },
            children: [rect('leaf')],
          },
        ],
      },
    ];

    const rows = buildLayerTree(nodes, emptySelection);

    expect(rows.map(({ id, depth, parentId }) => ({ id, depth, parentId }))).toEqual([
      { id: 'outer', depth: 0, parentId: undefined },
      { id: 'inner', depth: 1, parentId: 'outer' },
      { id: 'leaf', depth: 2, parentId: 'inner' },
      { id: 'under', depth: 1, parentId: 'outer' },
    ]);
  });

  it('distinguishes explicit hiding from inherited hiding', () => {
    const nodes: readonly ThemeNode[] = [
      {
        id: 'hidden-group',
        name: 'Hidden group',
        type: 'group',
        visible: false,
        transform: { x: 0, y: 0, width: 20, height: 20 },
        children: [rect('visible-child'), rect('hidden-child', { visible: false })],
      },
    ];

    const [group, hiddenChild, visibleChild] = buildLayerTree(nodes, emptySelection);

    expect(group).toMatchObject({ visible: false, selfHidden: true, ancestorHidden: false });
    expect(visibleChild).toMatchObject({ visible: false, selfHidden: false, ancestorHidden: true });
    expect(hiddenChild).toMatchObject({ visible: false, selfHidden: true, ancestorHidden: true });
  });

  it('uses the same node-local lock state as placement and hit-testing', () => {
    const nodes: readonly ThemeNode[] = [
      {
        id: 'locked-group',
        name: 'Locked group',
        type: 'group',
        locked: true,
        transform: { x: 0, y: 0, width: 20, height: 20 },
        children: [rect('child')],
      },
    ];

    const [group, child] = buildLayerTree(nodes, emptySelection);

    expect(group).toMatchObject({ locked: true });
    expect(child).toMatchObject({ locked: false });
  });

  it('marks every selected row without changing document order', () => {
    const nodes = [rect('a'), rect('b')];
    const selection = setSelection(emptySelection, ['a', 'b']);
    const rows = buildLayerTree(nodes, selection);

    expect(rows.map(({ id, selected }) => ({ id, selected }))).toEqual([
      { id: 'b', selected: true },
      { id: 'a', selected: true },
    ]);
  });

  it('falls back to id when a node has no display name', () => {
    const nodeWithoutName: ThemeNode = {
      id: 'unnamed',
      type: 'rectangle',
      transform: { x: 0, y: 0, width: 10, height: 10 },
    };
    const rows = buildLayerTree([nodeWithoutName], emptySelection);

    expect(rows[0]?.name).toBe('unnamed');
  });
});

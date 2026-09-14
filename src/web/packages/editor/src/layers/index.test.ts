import { describe, expect, it } from 'vitest';
import type { ThemeDocument } from '@vigilia/renderer-core';
import { EditorCore } from '../core/editor.js';
import { setNodeFlags } from '../commands.js';

const base: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 800, height: 600 },
  nodes: [
    {
      id: 'g',
      type: 'group',
      transform: { x: 0, y: 0, width: 200, height: 100 },
      children: [{ id: 'child', type: 'rectangle', transform: { x: 0, y: 0, width: 50, height: 50 } }],
    },
    { id: 'box', type: 'rectangle', transform: { x: 300, y: 0, width: 50, height: 50 } },
  ],
};

const editor = (): EditorCore => new EditorCore({ document: base });

describe('the rows are derived, never stored', () => {
  it('lists the tree topmost first', () => {
    const core = editor();

    expect(core.layers.rows().map((row) => row.id)).toEqual(['box', 'g', 'child']);
  });

  it('follows the selection without being told', () => {
    // No invalidation step: the rows are computed from the selection each
    // time. Caching them is how a layer panel ends up confidently stale.
    const core = editor();

    expect(core.layers.rows().find((row) => row.id === 'box')?.selected).toBe(false);

    core.selection.applyClick('box');

    expect(core.layers.rows().find((row) => row.id === 'box')?.selected).toBe(true);
  });

  it('follows a document edit without being told', () => {
    const core = editor();

    core.document.commit('Hide', setNodeFlags(base, 'box', { visible: false }));

    expect(core.layers.rows().find((row) => row.id === 'box')?.visible).toBe(false);
  });
});

describe('effective visibility, not declared visibility', () => {
  it('reads a child of a hidden group as hidden', () => {
    // The child never says it is hidden. The author sees it disappear, so the
    // row has to agree with the canvas rather than with the node.
    const core = editor();

    core.document.commit('Hide', setNodeFlags(base, 'g', { visible: false }));

    expect(core.layers.rows().find((row) => row.id === 'child')?.visible).toBe(false);
  });
});

describe('tracking a gesture', () => {
  it('builds from the visible document, so a preview is reflected', () => {
    // Built from `visible` rather than `current`: during a drag the panel
    // should track the gesture, not lag a commit behind the canvas.
    const core = editor();

    core.document.preview(setNodeFlags(base, 'box', { visible: false }));

    expect(core.layers.rows().find((row) => row.id === 'box')?.visible).toBe(false);
    expect(core.document.current.nodes.find((node) => node.id === 'box')?.visible).toBeUndefined();
  });
});

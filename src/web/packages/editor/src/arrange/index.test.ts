import { describe, expect, it } from 'vitest';
import type { ThemeDocument, ThemeNode } from '@vigilia/renderer-core';
import { EditorCore } from '../core/editor.js';

const box = (id: string, x: number): ThemeNode => ({
  id,
  type: 'rectangle',
  transform: { x, y: 0, width: 20, height: 20 },
});

const base: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 800, height: 600 },
  nodes: [box('a', 0), box('b', 100), box('c', 300)],
};

const editor = (): EditorCore => new EditorCore({ document: base });

describe('grouping', () => {
  it('commits, selects the new group, and allocates its id from the document', () => {
    const core = editor();

    core.selection.set(['a', 'b']);

    expect(core.arrange.group('Group')).toBe(true);

    const group = core.document.current.nodes.find((node) => node.type === 'group');

    expect(group).toBeDefined();
    expect(core.selection.ids).toEqual([group!.id]);
    expect(core.document.undoLabel).toBe('Group');
  });

  it('prunes the ids the operation consumed', () => {
    // The children moved inside the group, so a selection still naming them
    // would apply the next edit to nodes that are no longer top level.
    const core = editor();

    core.selection.set(['a', 'b']);
    core.arrange.group('Group');

    expect(core.selection.ids).not.toContain('a');
  });
});

describe('refusing out loud', () => {
  it('says why, commits nothing, and reports that nothing happened', () => {
    // A refusal that silently does nothing reads as a broken shortcut.
    const core = editor();

    core.selection.set(['a']);

    expect(core.arrange.group('Group')).toBe(false);
    expect(core.document.canUndo).toBe(false);
    expect(core.notice.message).toBe('Select at least two elements');
  });

  it('clears a previous refusal once an operation succeeds', () => {
    const core = editor();

    core.selection.set(['a']);
    core.arrange.group('Group');

    expect(core.notice.message).toBeDefined();

    core.selection.set(['a', 'b']);
    core.arrange.group('Group');

    expect(core.notice.message).toBeUndefined();
  });
});

describe('aligning and distributing', () => {
  it('aligns the selection to its own leftmost edge', () => {
    const core = editor();

    core.selection.set(['a', 'b']);

    expect(core.arrange.align('left', 'Align left')).toBe(true);
    expect(core.document.current.nodes[1]!.transform?.x).toBe(0);
    expect(core.document.undoLabel).toBe('Align left');
  });

  it('needs three to distribute, and says so with two', () => {
    const core = editor();

    core.selection.set(['a', 'b']);

    expect(core.arrange.distribute('x', 'Distribute horizontally')).toBe(false);
    expect(core.notice.message).toBeDefined();
  });

  it('equalises the gaps across three', () => {
    const core = editor();

    core.selection.set(['a', 'b', 'c']);

    expect(core.arrange.distribute('x', 'Distribute horizontally')).toBe(true);

    const xs = core.document.current.nodes.map((node) => node.transform?.x ?? 0);

    expect(xs[1]! - xs[0]!).toBeCloseTo(xs[2]! - xs[1]!);
  });
});

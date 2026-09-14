import { describe, expect, it } from 'vitest';
import type { ThemeDocument } from '@vigilia/renderer-core';
import { EditorCore } from '../core/editor.js';

const base: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 800, height: 600 },
  globals: {
    palette: { ink: { name: 'Ink', value: '#101418' }, spare: { name: 'Spare', value: '#ffffff' } },
  },
  nodes: [
    {
      id: 'r',
      type: 'rectangle',
      transform: { x: 0, y: 0, width: 10, height: 10 },
      style: { fill: { ref: 'palette.ink' } },
    },
  ],
};

const editor = (): EditorCore => new EditorCore({ document: base });

describe('applying a token edit', () => {
  it('commits one undo step with a label naming what happened', () => {
    const core = editor();

    expect(core.globals.apply({ kind: 'value', group: 'palette', key: 'ink', value: '#ff0000' })).toBe(
      true,
    );
    expect(core.document.undoLabel).toBe('Set ink');
    expect(core.document.current.globals?.palette?.['ink']?.value).toBe('#ff0000');
  });

  it('names a rekey differently from a rename, because it rewrote references', () => {
    const core = editor();

    core.globals.apply({ kind: 'name', group: 'palette', key: 'ink', name: 'Body ink' });

    expect(core.document.undoLabel).toBe('Rename token');

    core.globals.apply({ kind: 'key', group: 'palette', key: 'ink', nextKey: 'body' });

    expect(core.document.undoLabel).toBe('Change token key');
    expect(core.document.current.nodes[0]!.style?.['fill']).toEqual({ ref: 'palette.body' });
  });

  it('adds a token seeded from its group', () => {
    const core = editor();

    expect(core.globals.apply({ kind: 'add', group: 'palette' })).toBe(true);

    const palette = core.document.current.globals?.palette ?? {};

    expect(Object.keys(palette).length).toBe(3);
  });
});

describe('refusing', () => {
  it('records no undo entry for an edit that does not apply', () => {
    // Identity means refusal. Committing anyway would leave an undo entry
    // that does nothing when undone.
    const core = editor();

    expect(core.globals.apply({ kind: 'key', group: 'palette', key: 'ink', nextKey: 'not a key' })).toBe(
      false,
    );
    expect(core.document.canUndo).toBe(false);
  });

  it('explains a refused deletion by counting what still references it', () => {
    // Spec 0011 D3: a referenced token cannot be inlined away, so the author
    // has to reassign first. "Nothing happened" is the least useful way to
    // say that.
    const core = editor();
    const action = { kind: 'delete', group: 'palette', key: 'ink' } as const;

    expect(core.globals.apply(action)).toBe(false);
    expect(core.globals.refusalReason(action)).toBe(
      'ink is used 1 time — reassign those first',
    );
  });

  it('has nothing to add when an unreferenced token deletes cleanly', () => {
    const core = editor();
    const action = { kind: 'delete', group: 'palette', key: 'spare' } as const;

    expect(core.globals.refusalReason(action)).toBeUndefined();
    expect(core.globals.apply(action)).toBe(true);
  });

  it('says nothing about a refusal that is visible in the field itself', () => {
    const core = editor();

    expect(
      core.globals.refusalReason({ kind: 'key', group: 'palette', key: 'ink', nextKey: 'not a key' }),
    ).toBeUndefined();
  });
});

describe('usage', () => {
  it('reports every token with what references it', () => {
    const core = editor();
    const usage = core.globals.usage();

    expect(usage.length).toBeGreaterThan(0);
  });
});

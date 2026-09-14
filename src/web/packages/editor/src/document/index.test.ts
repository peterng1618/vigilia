import { describe, expect, it } from 'vitest';
import type { ThemeDocument } from '@vigilia/renderer-core';
import { EditorCore } from '../core/editor.js';
import { updateTransforms } from '../commands.js';

const base: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 800, height: 600 },
  nodes: [{ id: 'r', type: 'rectangle', transform: { x: 0, y: 0, width: 10, height: 10 } }],
};

const moved = (x: number): ThemeDocument =>
  updateTransforms(base, new Map([['r', { x, y: 0, width: 10, height: 10 }]]));

const editor = (): EditorCore => new EditorCore({ document: base });

describe('the manager holds what the pure module returns', () => {
  it('opens on the document it was given, clean and with nothing to undo', () => {
    const core = editor();

    expect(core.document.current).toBe(base);
    expect(core.document.visible).toBe(base);
    expect(core.document.canUndo).toBe(false);
    expect(core.document.canRedo).toBe(false);
    expect(core.document.isDirty).toBe(false);
  });

  it('advances through undo and redo', () => {
    const core = editor();

    core.document.commit('Move', moved(5));

    expect(core.document.canUndo).toBe(true);
    expect(core.document.undoLabel).toBe('Move');

    core.document.undo();

    expect(core.document.current).toBe(base);
    expect(core.document.canRedo).toBe(true);

    core.document.redo();

    expect(core.document.current.nodes[0]!.transform?.x).toBe(5);
  });
});

describe('refusal is identity, and the manager reports it', () => {
  it('returns false and records nothing when the document did not change', () => {
    // Every document edit here returns the same object when it did not apply.
    // Call sites used to re-implement that check; one of them forgot, which is
    // the "every inspector edit commits even a no-op" defect.
    const core = editor();

    const changed = core.document.commit('Nothing', base);

    expect(changed).toBe(false);
    expect(core.document.canUndo).toBe(false);
    expect(core.document.isDirty).toBe(false);
  });

  it('returns true when it did change', () => {
    const core = editor();

    expect(core.document.commit('Move', moved(5))).toBe(true);
  });
});

describe('a gesture is one undo entry (§67)', () => {
  it('keeps previews out of history and commits once at the end', () => {
    const core = editor();

    for (const x of [1, 2, 3, 4, 5]) {
      core.document.preview(moved(x));
    }

    expect(core.document.visible.nodes[0]!.transform?.x).toBe(5);
    expect(core.document.current).toBe(base);
    expect(core.document.canUndo).toBe(false);

    expect(core.document.commitPreview('Move element')).toBe(true);
    expect(core.document.current.nodes[0]!.transform?.x).toBe(5);
    expect(core.document.undoLabel).toBe('Move element');
  });

  it('commits nothing when the gesture previewed nothing', () => {
    // A press and release that never moved. Committing here is what used to
    // leave a phantom entry that made the following undo look dead.
    const core = editor();

    expect(core.document.commitPreview('Move element')).toBe(false);
    expect(core.document.canUndo).toBe(false);
  });

  it('discards a cancelled gesture entirely', () => {
    const core = editor();

    core.document.preview(moved(5));
    core.document.cancelPreview();

    expect(core.document.visible).toBe(base);
    expect(core.document.previewed).toBeUndefined();
    expect(core.document.canUndo).toBe(false);
  });
});

describe('saving and replacing', () => {
  it('marks clean without clearing history (§139)', () => {
    const core = editor();

    core.document.commit('Move', moved(5));
    core.document.markSaved();

    expect(core.document.isDirty).toBe(false);
    expect(core.document.canUndo).toBe(true);
  });

  it('starts a fresh history on replace, so undo cannot cross a file boundary', () => {
    const core = editor();

    core.document.commit('Move', moved(5));
    core.document.replace(base);

    expect(core.document.current).toBe(base);
    expect(core.document.canUndo).toBe(false);
    expect(core.document.isDirty).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HISTORY_LIMIT,
  canRedo,
  canUndo,
  cancelPreview,
  commit,
  createHistory,
  isDirty,
  markSaved,
  preview,
  redo,
  redoLabel,
  replaceDocument,
  undo,
  undoLabel,
  visibleDocument,
} from './history.js';
import { updateTransforms } from './commands.js';
import type { ThemeDocument } from '@vigilia/renderer-core';

const base: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 800, height: 600 },
  nodes: [{ id: 'r', type: 'rectangle', transform: { x: 0, y: 0, width: 10, height: 10 } }],
};

const moved = (x: number): ThemeDocument =>
  updateTransforms(base, new Map([['r', { x, y: 0, width: 10, height: 10 }]]));

describe('previews keep a gesture out of history (§67)', () => {
  it('shows a preview without recording it', () => {
    // A drag emits a transform per pointer move. Recording each one would make
    // undo rewind a drag pixel by pixel.
    let history = createHistory(base);

    for (const x of [1, 2, 3, 4, 5]) {
      history = preview(history, moved(x));
    }

    expect(visibleDocument(history).nodes[0]!.transform?.x).toBe(5);
    expect(canUndo(history)).toBe(false);
    expect(history.past).toEqual([]);
  });

  it('records exactly one entry when the gesture commits', () => {
    let history = createHistory(base);
    history = preview(history, moved(3));
    history = preview(history, moved(7));
    history = commit(history, 'Move', moved(7));

    expect(history.past).toHaveLength(1);
    expect(history.preview).toBeUndefined();
  });

  it('abandons a preview on cancel', () => {
    const history = cancelPreview(preview(createHistory(base), moved(9)));

    expect(visibleDocument(history)).toBe(base);
  });

  it('renders the committed document once a gesture ends', () => {
    const history = commit(preview(createHistory(base), moved(4)), 'Move', moved(4));

    expect(visibleDocument(history)).toBe(history.current);
  });
});

describe('undo and redo', () => {
  it('steps back and forward', () => {
    let history = createHistory(base);
    history = commit(history, 'Move', moved(10));
    history = commit(history, 'Move again', moved(20));

    expect(history.current.nodes[0]!.transform?.x).toBe(20);

    history = undo(history);
    expect(history.current.nodes[0]!.transform?.x).toBe(10);

    history = undo(history);
    expect(history.current).toBe(base);
    expect(canUndo(history)).toBe(false);

    history = redo(history);
    expect(history.current.nodes[0]!.transform?.x).toBe(10);
  });

  it('does nothing at either end', () => {
    const empty = createHistory(base);

    expect(undo(empty)).toBe(empty);
    expect(redo(empty)).toBe(empty);
  });

  it('discards the redo branch when a new edit lands', () => {
    // Keeping it would let an author redo their way into a document that never
    // existed.
    let history = commit(createHistory(base), 'A', moved(10));
    history = undo(history);

    expect(canRedo(history)).toBe(true);

    history = commit(history, 'B', moved(99));

    expect(canRedo(history)).toBe(false);
    expect(history.current.nodes[0]!.transform?.x).toBe(99);
  });

  it('ignores a commit that changed nothing', () => {
    // A gesture that ended where it started should not leave an entry that
    // appears to do nothing when undone.
    const history = commit(createHistory(base), 'Move', base);

    expect(history.past).toEqual([]);
  });

  it('cancels a preview when undoing mid-gesture', () => {
    // Undo should reverse the last completed edit, not leave an uncommitted one
    // on screen.
    let history = commit(createHistory(base), 'Move', moved(10));
    history = preview(history, moved(55));
    history = undo(history);

    expect(history.preview).toBeUndefined();
    expect(visibleDocument(history)).toBe(base);
  });

  it('names the edit for a menu', () => {
    const history = commit(createHistory(base), 'Move 3 elements', moved(1));

    expect(undoLabel(history)).toBe('Move 3 elements');
    expect(redoLabel(history)).toBeUndefined();
    expect(redoLabel(undo(history))).toBe('Move 3 elements');
  });

  it('bounds the stack, keeping the most recent steps', () => {
    let history = createHistory(base, 3);

    for (const x of [1, 2, 3, 4, 5]) {
      history = commit(history, `Move ${x}`, moved(x));
    }

    expect(history.past).toHaveLength(3);
    // An entry is labelled with the edit it would REVERSE and holds the
    // document from before that edit, so the newest entry is "Move 5". Undo's
    // menu item therefore reads "Undo Move 5", which is what an author expects.
    expect(history.past.map((entry) => entry.label)).toEqual(['Move 3', 'Move 4', 'Move 5']);
  });

  it('refuses a limit below one', () => {
    expect(createHistory(base, 0).limit).toBe(1);
    expect(DEFAULT_HISTORY_LIMIT).toBeGreaterThan(10);
  });
});

describe('dirty state (§139)', () => {
  it('starts clean', () => {
    expect(isDirty(createHistory(base))).toBe(false);
  });

  it('becomes dirty on an edit and clean on save', () => {
    let history = commit(createHistory(base), 'Move', moved(10));
    expect(isDirty(history)).toBe(true);

    history = markSaved(history);
    expect(isDirty(history)).toBe(false);
  });

  it('keeps history after a save, so the author can undo past it', () => {
    // "Save marks history clean without clearing it." Clearing on save is the
    // common shortcut and it discards work someone may want back.
    let history = commit(createHistory(base), 'Move', moved(10));
    history = markSaved(history);

    expect(canUndo(history)).toBe(true);

    history = undo(history);
    expect(history.current).toBe(base);
    // Undone past the save point, so dirty again.
    expect(isDirty(history)).toBe(true);
  });

  it('reports clean again when undone back to the saved document', () => {
    // Exact because edits are immutable and share structure: undoing restores
    // the identical object, so a reference comparison is correct here.
    let history = markSaved(createHistory(base));
    history = commit(history, 'Move', moved(10));
    history = undo(history);

    expect(isDirty(history)).toBe(false);
  });

  it('does not treat an in-progress preview as unsaved work', () => {
    // Someone who started dragging and pressed escape has not edited anything.
    const history = preview(createHistory(base), moved(10));

    expect(isDirty(history)).toBe(false);
  });
});

describe('replaceDocument', () => {
  it('clears history, because undoing into a different document is nonsense', () => {
    let history = commit(createHistory(base), 'Move', moved(10));
    const other: ThemeDocument = { ...base, id: 'other' };

    history = replaceDocument(history, other);

    expect(history.current).toBe(other);
    expect(canUndo(history)).toBe(false);
    expect(isDirty(history)).toBe(false);
  });

  it('keeps the configured limit', () => {
    const history = replaceDocument(createHistory(base, 7), base);
    expect(history.limit).toBe(7);
  });
});

import type { ThemeDocument } from '@vigilia/renderer-core';

/**
 * Undo, redo, and knowing whether there is anything to save.
 *
 * ## One entry per gesture (§67)
 *
 * A drag emits a new transform on every pointer move. If each one were recorded,
 * undo would rewind a drag pixel by pixel, and §67 is explicit that a gesture is
 * one transaction.
 *
 * That is enforced by shape rather than by discipline: this store holds a
 * committed document and an optional **preview**. A live gesture writes previews,
 * which are visible to the renderer and invisible to history; `commit` is called
 * once, when the gesture ends. There is no way to accidentally record an
 * intermediate frame, because recording only happens in `commit`.
 *
 * ## Whole documents, not inverse operations
 *
 * Each entry keeps the document as it was. Inverse operations are where undo
 * goes wrong — "un-delete" must restore a node, its position among its siblings,
 * and anything that referenced it — and every one of those is a chance to be
 * subtly wrong in a way that corrupts a save. Documents are bounded at 5000
 * nodes and edits share structure, so this costs little and cannot be subtly
 * wrong.
 *
 * ## Save marks clean without clearing (§139)
 *
 * After a save, the author can still undo past the save point; the document is
 * simply not dirty any more. Clearing history on save is the common shortcut and
 * it throws away work the author may still want back.
 */

export interface HistoryEntry {
  /** Shown in a menu — "Move 3 elements", "Resize", "Delete". */
  readonly label: string;
  readonly document: ThemeDocument;
}

export interface History {
  /** Undo stack, oldest first. The last entry is the state before `current`. */
  readonly past: readonly HistoryEntry[];
  readonly current: ThemeDocument;
  /** Redo stack, nearest first. */
  readonly future: readonly HistoryEntry[];
  /**
   * An uncommitted in-progress edit, or undefined.
   *
   * The renderer draws this when present. History never sees it.
   */
  readonly preview: ThemeDocument | undefined;
  /** The document as it was when last saved, for the dirty check. */
  readonly savedDocument: ThemeDocument;
  readonly limit: number;
}

/**
 * How many undo steps to keep.
 *
 * CHOSEN, NOT MEASURED. Deep enough that an author will not hit it in a working
 * session, shallow enough that a bounded number of documents stays bounded in
 * memory. Worth revisiting with a real measurement of document size once the
 * editor exists.
 */
export const DEFAULT_HISTORY_LIMIT = 100;

export function createHistory(
  document: ThemeDocument,
  limit = DEFAULT_HISTORY_LIMIT,
): History {
  return {
    past: [],
    current: document,
    future: [],
    preview: undefined,
    savedDocument: document,
    limit: Math.max(1, limit),
  };
}

/** The document to render: the preview if a gesture is in flight, else the committed one. */
export function visibleDocument(history: History): ThemeDocument {
  return history.preview ?? history.current;
}

/**
 * Shows an uncommitted edit.
 *
 * Called on every pointer move during a drag. Deliberately does not touch the
 * undo stack — that is the whole point.
 */
export function preview(history: History, document: ThemeDocument): History {
  return { ...history, preview: document };
}

/** Abandons an in-progress gesture, e.g. on escape. */
export function cancelPreview(history: History): History {
  return history.preview === undefined ? history : { ...history, preview: undefined };
}

/**
 * Records an edit as one undo step.
 *
 * A commit whose document is identical by reference is ignored, so a gesture
 * that ended where it started does not leave an entry that appears to do
 * nothing when undone.
 */
export function commit(
  history: History,
  label: string,
  document: ThemeDocument,
): History {
  if (document === history.current) {
    return cancelPreview(history);
  }

  const past = [...history.past, { label, document: history.current }];

  return {
    ...history,
    // Oldest entries fall off the back. The limit counts undo steps, so the
    // slice keeps the most recent ones.
    past: past.length > history.limit ? past.slice(past.length - history.limit) : past,
    current: document,
    // Any new edit invalidates the redo branch. Keeping it would let an author
    // redo their way into a document that never existed.
    future: [],
    preview: undefined,
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/**
 * Steps back one entry.
 *
 * Cancels any in-progress preview first: undoing mid-gesture should undo the
 * last completed edit, not silently keep an uncommitted one on screen.
 */
export function undo(history: History): History {
  const previous = history.past.at(-1);

  if (previous === undefined) {
    return cancelPreview(history);
  }

  return {
    ...history,
    past: history.past.slice(0, -1),
    current: previous.document,
    future: [{ label: previous.label, document: history.current }, ...history.future],
    preview: undefined,
  };
}

export function redo(history: History): History {
  const next = history.future[0];

  if (next === undefined) {
    return cancelPreview(history);
  }

  return {
    ...history,
    past: [...history.past, { label: next.label, document: history.current }],
    current: next.document,
    future: history.future.slice(1),
    preview: undefined,
  };
}

/** Label of the edit undo would reverse, for a menu item. */
export function undoLabel(history: History): string | undefined {
  return history.past.at(-1)?.label;
}

export function redoLabel(history: History): string | undefined {
  return history.future[0]?.label;
}

/**
 * Marks the current document as saved **without clearing history** (§139).
 *
 * The author can still undo past a save. That is deliberate: clearing on save
 * is the common shortcut and it discards work someone may want back, while
 * costing nothing to keep.
 */
export function markSaved(history: History): History {
  return { ...history, savedDocument: history.current };
}

/**
 * Whether there are unsaved changes.
 *
 * Compared by reference, which is exact *because* edits are immutable and share
 * structure: undoing back to the saved document restores the identical object,
 * so this correctly reports clean again — something a deep comparison would
 * also do but at a cost on every keystroke.
 *
 * An in-progress preview does not count as dirty. It is not an edit until it is
 * committed, and treating it as one would mark a document dirty just because
 * someone started dragging and pressed escape.
 */
export function isDirty(history: History): boolean {
  return history.current !== history.savedDocument;
}

/**
 * Replaces the document and clears history — "new" or "open".
 *
 * §139 wants the prompt and then a clear "only after successful replacement",
 * so this is the successful-replacement step. Keeping the old history would let
 * an author undo the *previous* document into the new one, which is nonsense.
 */
export function replaceDocument(history: History, document: ThemeDocument): History {
  return createHistory(document, history.limit);
}

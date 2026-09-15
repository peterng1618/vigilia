import type { ThemeDocument } from '@vigilia/renderer-core';

/**
 * Immutable document history. Live gestures write `preview`; only `commit`
 * creates an undo step (§67). Saving marks the current reference clean without
 * clearing history (§139).
 */

export interface HistoryEntry {
  readonly label: string;
  readonly document: ThemeDocument;
}

export interface History {
  readonly past: readonly HistoryEntry[];
  readonly current: ThemeDocument;
  readonly future: readonly HistoryEntry[];
  /** Uncommitted document shown during a live gesture. */
  readonly preview: ThemeDocument | undefined;
  readonly savedDocument: ThemeDocument;
  readonly limit: number;
}

/** Chosen bounded default; revisit only with measured document-memory pressure. */
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

export function visibleDocument(history: History): ThemeDocument {
  return history.preview ?? history.current;
}

/** Show an edit without touching undo history. */
export function preview(history: History, document: ThemeDocument): History {
  return { ...history, preview: document };
}

export function cancelPreview(history: History): History {
  return history.preview === undefined ? history : { ...history, preview: undefined };
}

/** Record one committed edit; reference-identical no-ops are ignored. */
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
    past: past.length > history.limit ? past.slice(past.length - history.limit) : past,
    current: document,
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

/** Undo the last committed edit; discard any live preview first. */
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

export function undoLabel(history: History): string | undefined {
  return history.past.at(-1)?.label;
}

export function redoLabel(history: History): string | undefined {
  return history.future[0]?.label;
}

/** Mark current committed state clean without clearing undo/redo history. */
export function markSaved(history: History): History {
  return { ...history, savedDocument: history.current };
}

/** Immutable edits make reference comparison exact; previews are not dirty. */
export function isDirty(history: History): boolean {
  return history.current !== history.savedDocument;
}

/** Replace the document and reset history; old-document undo must not cross files. */
export function replaceDocument(history: History, document: ThemeDocument): History {
  return createHistory(document, history.limit);
}

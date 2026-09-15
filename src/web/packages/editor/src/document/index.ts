import type { ThemeDocument } from '@vigilia/renderer-core';
import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
import {
  canRedo,
  canUndo,
  cancelPreview,
  commit,
  createHistory,
  isDirty,
  markSaved,
  preview,
  redo,
  replaceDocument,
  undo,
  undoLabel,
  visibleDocument,
  type History,
} from './history.js';

/** Holds document history while keeping history rules pure in `history.ts`. */
export class DocumentManager implements EditorManager {
  public readonly editor: EditorCore;

  #history: History;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
    this.#history = createHistory(editor.options.document);
  }

  /** Committed state used by edits and saves. */
  public get current(): ThemeDocument {
    return this.#history.current;
  }

  /** Preview during a live gesture, otherwise the committed state. */
  public get visible(): ThemeDocument {
    return visibleDocument(this.#history);
  }

  public get previewed(): ThemeDocument | undefined {
    return this.#history.preview;
  }

  public get canUndo(): boolean {
    return canUndo(this.#history);
  }

  public get canRedo(): boolean {
    return canRedo(this.#history);
  }

  public get isDirty(): boolean {
    return isDirty(this.#history);
  }

  public get undoLabel(): string | undefined {
    return undoLabel(this.#history);
  }

  /** Commit one edit; returns false for an identity/no-op refusal. */
  public commit(label: string, next: ThemeDocument): boolean {
    const before = this.#history.current;

    this.#history = commit(this.#history, label, next);

    return this.#history.current !== before;
  }

  /** Show an uncommitted gesture state without creating history. */
  public preview(next: ThemeDocument): void {
    this.#history = preview(this.#history, next);
  }

  public cancelPreview(): void {
    this.#history = cancelPreview(this.#history);
  }

  /** Commit the current preview as one undo step, or no-op if none exists. */
  public commitPreview(label: string): boolean {
    const previewed = this.#history.preview;

    if (previewed === undefined) {
      this.cancelPreview();

      return false;
    }

    return this.commit(label, previewed);
  }

  public undo(): void {
    this.#history = undo(this.#history);
  }

  public redo(): void {
    this.#history = redo(this.#history);
  }

  public markSaved(): void {
    this.#history = markSaved(this.#history);
  }

  /** Replacing a file starts a fresh history. */
  public replace(next: ThemeDocument): void {
    this.#history = replaceDocument(this.#history, next);
  }

  public destroy(): void {}
}

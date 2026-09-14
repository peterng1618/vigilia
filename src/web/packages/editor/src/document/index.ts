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

/**
 * The document, and every way it is allowed to change.
 *
 * ## Why this exists as a manager
 *
 * `history.ts` is pure and stays pure — it takes a `History` and returns a new
 * one, which is what makes every undo rule testable in Node. But *something*
 * has to hold the current value, and that something was a `let` in the shell's
 * closure that eighteen call sites reassigned. Nothing else could read the
 * document, so nothing else could be written without going through the shell.
 *
 * This owns the value and delegates every decision to the pure module.
 *
 * ## Refusal is identity, and it is decided here
 *
 * Every document edit in this editor returns the *same object* when it did not
 * apply — a refused value, an unknown key, a no-op arrange. Committing then
 * would leave an undo entry that does nothing when undone, so each call site
 * used to write `if (next !== document_)` for itself. One of them forgot,
 * which is the open "every inspector edit commits even a no-op" defect.
 *
 * {@link commit} makes that the rule rather than the convention: it ignores an
 * unchanged document and reports whether anything happened, so a caller that
 * needs to react to a refusal can, and one that does not is still correct.
 */
export class DocumentManager implements EditorManager {
  public readonly editor: EditorCore;

  #history: History;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
    this.#history = createHistory(editor.options.document);
  }

  /**
   * The committed document — what an edit applies to and what a save writes.
   *
   * Not what the renderer draws mid-gesture; that is {@link visible}.
   */
  public get current(): ThemeDocument {
    return this.#history.current;
  }

  /**
   * What to draw: the in-flight preview if there is one, else the committed
   * document.
   */
  public get visible(): ThemeDocument {
    return visibleDocument(this.#history);
  }

  /** The uncommitted gesture in flight, if any. */
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

  /** Label of the edit undo would reverse, for a menu item or the status bar. */
  public get undoLabel(): string | undefined {
    return undoLabel(this.#history);
  }

  /**
   * Records an edit as one undo step.
   *
   * @returns whether the committed document actually changed. `false` means
   * the edit was refused and no history entry was made — the caller may want
   * to explain why, or force a panel to snap back to the real value.
   */
  public commit(label: string, next: ThemeDocument): boolean {
    const before = this.#history.current;

    this.#history = commit(this.#history, label, next);

    return this.#history.current !== before;
  }

  /**
   * Shows an uncommitted edit — called on every pointer move during a drag.
   *
   * Deliberately does not touch the undo stack: §67 wants one entry per
   * gesture, and that is enforced by there being no way to record from here.
   */
  public preview(next: ThemeDocument): void {
    this.#history = preview(this.#history, next);
  }

  /** Abandons an in-progress gesture, leaving no trace in history. */
  public cancelPreview(): void {
    this.#history = cancelPreview(this.#history);
  }

  /**
   * Commits whatever the gesture previewed, or cancels if it previewed
   * nothing.
   *
   * The end of a drag, in one call. Both halves lived at the call site before,
   * and the "previewed nothing" branch is the one that is easy to omit — it is
   * what stops a press-and-release leaving a phantom entry.
   */
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

  /**
   * Marks the current document saved **without clearing history** (§139), so
   * an author can still undo past the save point.
   */
  public markSaved(): void {
    this.#history = markSaved(this.#history);
  }

  /**
   * Replaces the document and starts a fresh history — "open".
   *
   * An undo that crossed a file boundary would restore half of another theme,
   * so the stack does not survive.
   */
  public replace(next: ThemeDocument): void {
    this.#history = replaceDocument(this.#history, next);
  }

  public destroy(): void {
    // Nothing acquired: no listeners, no timers. The document is dropped with
    // the manager.
  }
}

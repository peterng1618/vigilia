import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';

/**
 * The status bar's one-off message.
 *
 * ## Why a manager for one string
 *
 * Because the string is how the editor refuses out loud. Arrange operations
 * decline for reasons an author cannot see from the selection — "these two are
 * in different groups", "ungrouping this would shear a child" — and a refusal
 * that silently does nothing reads as a broken shortcut. Every one of those
 * sites needs somewhere to say why.
 *
 * Before this it was a `let` in the shell's closure, and each of the six sites
 * that set it also had to remember to repaint the status bar. Two of them
 * didn't: clearing the notice on pointerdown left a stale refusal on screen
 * for the whole of the next drag, because the early return for a resize handle
 * never reached a redraw.
 *
 * Now setting it emits, and the status bar is repainted because the message
 * changed rather than because a caller remembered.
 */
export class NoticeManager implements EditorManager {
  public readonly editor: EditorCore;

  #message: string | undefined;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  /** The current message, or `undefined` when there is nothing to say. */
  public get message(): string | undefined {
    return this.#message;
  }

  /** Says something. Replaces whatever was there. */
  public show(message: string): void {
    this.#set(message);
  }

  /**
   * Drops the message.
   *
   * Called at the start of a gesture: a new action supersedes whatever the
   * last refusal was about, and leaving it up would attach an old explanation
   * to a new thing.
   */
  public clear(): void {
    this.#set(undefined);
  }

  public destroy(): void {
    this.#message = undefined;
  }

  /**
   * Sets and emits — but only on an actual change.
   *
   * `clear()` runs on every pointerdown, so without this guard the status bar
   * would be repainted on every press for no reason, and a subscriber could
   * not treat the event as meaning "this is different now".
   */
  #set(message: string | undefined): void {
    if (message === this.#message) {
      return;
    }

    this.#message = message;
    this.editor.events.emit('notice:changed', { message });
  }
}

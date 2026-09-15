import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
import { applyFieldChange, labelForField, type FieldChange } from './apply.js';
import { describeSelection, type InspectorSection } from './model.js';

/**
 * What the inspector shows for the current selection, and what an edit to a
 * field does to the document.
 *
 * ## Both halves, one owner
 *
 * `model.ts` turns a selection into field descriptors; `apply.ts` turns a
 * field change back into a document. They are two directions of one contract
 * — a field's key is the only thing connecting them — and they were two
 * modules with a shell in between holding the identity check that decided
 * whether an edit counted.
 *
 * ## Refusal has to be visible
 *
 * A refused edit returns the same document, so nothing commits. That is
 * correct and it is also invisible: the field still shows what the author
 * typed. Telling the caller an edit was refused is the whole reason
 * {@link edit} returns a boolean rather than nothing — the panel has to be
 * forced to redraw so the value snaps back to what the document actually
 * says.
 *
 * `parseNumeric` in `model.ts` is why this matters more than it sounds. A
 * number input reports the empty string for any content it cannot parse, and
 * `Number('') === 0`, so coercing would commit a zero for a half-typed `1e`
 * and make an element vanish. It refuses instead.
 */
export class InspectorManager implements EditorManager {
  public readonly editor: EditorCore;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  /**
   * The sections to draw for the current selection.
   *
   * Built from the **committed** document, not the visible one: the panel
   * describes what has been decided, and re-rendering it on every frame of a
   * drag would fight the author's cursor for focus.
   */
  public sections(): readonly InspectorSection[] {
    return describeSelection(this.editor.document.current, this.editor.selection.ids);
  }

  /**
   * Applies a field edit to every selected node that accepts it.
   *
   * @returns whether the document changed. `false` means refused — an
   * out-of-range number, an unparseable one, a property the node cannot carry
   * — and the caller must redraw anyway so the field stops showing a value
   * the document never took.
   */
  public edit(key: string, change: FieldChange): boolean {
    return this.editor.document.commit(
      labelForField(key),
      applyFieldChange(this.editor.document.current, this.editor.selection.ids, key, change),
    );
  }

  public destroy(): void {
    // Nothing acquired: both directions are pure functions over the document.
  }
}

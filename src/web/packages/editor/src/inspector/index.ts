import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
import { applyFieldChange, labelForField, type FieldChange } from './apply.js';
import { describeSelection, type InspectorSection } from './model.js';

/** Owns both directions of the inspector field-key contract: describe and apply. */
export class InspectorManager implements EditorManager {
  public readonly editor: EditorCore;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  /** Use committed state so live gesture frames do not steal field focus. */
  public sections(): readonly InspectorSection[] {
    return describeSelection(this.editor.document.current, this.editor.selection.ids);
  }

  /** False means refused/no-op; caller redraws so invalid input snaps back. */
  public edit(key: string, change: FieldChange): boolean {
    return this.editor.document.commit(
      labelForField(key),
      applyFieldChange(this.editor.document.current, this.editor.selection.ids, key, change),
    );
  }

  public destroy(): void {
    // No owned resources.
  }
}

import type { GlobalRef, ThemeDocument } from '@vigilia/renderer-core';
import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
import {
  addGlobal,
  collectGlobalUsage,
  deleteGlobal,
  nextGlobalKey,
  referencesTo,
  rekeyGlobal,
  renameGlobal,
  setGlobalValue,
  type GlobalUsage,
} from './commands.js';
import type { GlobalAction } from './domain/global-action.js';
import { seedForGroup } from './domain/groups.js';

/**
 * Theme-level tokens — the palette, fonts, sizes, spacing and assets a
 * document's nodes reference instead of carrying literal values.
 *
 * ## What this fixes
 *
 * `applyGlobalAction` and `labelForGlobalAction` lived at the *bottom of
 * `main.ts`*, below the `start()` call, three hundred lines from the panel
 * callback that used them and in a file about none of it. They were pure
 * document logic marooned in the shell because the shell was the only thing
 * that could see both the panel's vocabulary and the command module.
 *
 * ## Refusal, and saying why
 *
 * Every command here returns the document unchanged when the edit does not
 * apply — an invalid key, a duplicate, an unknown token — so
 * {@link DocumentManager.commit} skips it by identity and no undo entry
 * appears that does nothing.
 *
 * Deletion is the case that needs more than silence. Spec 0011 D3 means a
 * referenced token cannot be inlined away, so the author has to reassign
 * first, and "nothing happened" is the least useful way to say that. That
 * explanation is produced here rather than at the call site, because it is
 * part of what refusing a deletion *means*.
 */
export class GlobalsManager implements EditorManager {
  public readonly editor: EditorCore;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  /** Every token, with what references it — what the panel draws. */
  public usage(): readonly GlobalUsage[] {
    return collectGlobalUsage(this.editor.document.current);
  }

  /**
   * Applies a panel action and commits it as one undo step.
   *
   * @returns whether the document changed. `false` means the edit was
   * refused; {@link refusalReason} says why, when there is something to say.
   */
  public apply(action: GlobalAction): boolean {
    return this.editor.document.commit(labelFor(action), this.#next(action));
  }

  /**
   * Why an action was refused, or `undefined` when there is nothing useful to
   * add.
   *
   * Only deletion currently has an explanation worth showing. A refused
   * rename or rekey is visible in the field itself, which snaps back.
   */
  public refusalReason(action: GlobalAction): string | undefined {
    if (action.kind !== 'delete') {
      return undefined;
    }

    const reference = `${action.group}.${action.key}` as GlobalRef;
    const uses = referencesTo(this.editor.document.current, reference).length;

    if (uses === 0) {
      return undefined;
    }

    return `${action.key} is used ${uses} time${uses === 1 ? '' : 's'} — reassign those first`;
  }

  public destroy(): void {
    // Nothing acquired: every method reads the document through its manager.
  }

  /** The document this action would produce, or the same one if it refuses. */
  #next(action: GlobalAction): ThemeDocument {
    const document_ = this.editor.document.current;

    switch (action.kind) {
      case 'add': {
        const seed = seedForGroup(action.group);
        const key = nextGlobalKey(
          document_,
          action.group,
          action.group === 'palette' ? 'colour' : 'token',
        );

        return addGlobal(document_, action.group, key, seed);
      }
      case 'value':
        return setGlobalValue(document_, action.group, action.key, action.value);
      case 'name':
        return renameGlobal(document_, action.group, action.key, action.name);
      case 'key':
        return rekeyGlobal(document_, action.group, action.key, action.nextKey);
      case 'delete':
        return deleteGlobal(document_, action.group, action.key);
    }
  }
}

/**
 * The undo label for an action.
 *
 * A rekey is named differently from a display rename on purpose: that one
 * rewrote every reference in the document, and the label should say so.
 */
function labelFor(action: GlobalAction): string {
  switch (action.kind) {
    case 'add':
      return 'Add token';
    case 'value':
      return `Set ${action.key}`;
    case 'name':
      return 'Rename token';
    case 'key':
      return 'Change token key';
    case 'delete':
      return 'Delete token';
  }
}

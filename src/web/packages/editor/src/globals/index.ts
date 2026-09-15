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

/** Owns theme-token actions; commands remain pure and identity-no-op on refusal. */
export class GlobalsManager implements EditorManager {
  public readonly editor: EditorCore;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  public usage(): readonly GlobalUsage[] {
    return collectGlobalUsage(this.editor.document.current);
  }

  /** Apply one panel action as one undo step. */
  public apply(action: GlobalAction): boolean {
    return this.editor.document.commit(labelFor(action), this.#next(action));
  }

  /** Referenced-token deletion needs explicit feedback; other refusals visibly snap back. */
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
    // No owned resources.
  }

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

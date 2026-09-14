import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
import {
  alignNodes,
  describeRefusal,
  distributeNodes,
  freeGroupId,
  groupNodes,
  ungroupNodes,
  type AlignEdge,
  type ArrangeResult,
} from './commands.js';

/**
 * Grouping, ungrouping, aligning and distributing.
 *
 * ## What the manager adds over the pure commands
 *
 * `commands.ts` answers "what document does this produce, or why not" and
 * nothing else — every operation returns an {@link ArrangeResult} carrying the
 * document, an optional refusal and an optional new selection. Four call sites
 * in the shell each took that apart the same way: show the refusal, commit if
 * it changed, apply the selection, prune, redraw.
 *
 * That sequence is the operation's contract, not the caller's business, and
 * getting one step of it wrong is silent. It lives here once.
 *
 * ## Why refusals are spoken aloud
 *
 * These operations decline for reasons an author cannot see from the
 * selection — "these two are in different groups", "ungrouping this would
 * shear a child". A refusal that silently does nothing reads as a broken
 * shortcut, so every one of them reaches the status bar.
 */
export class ArrangeManager implements EditorManager {
  public readonly editor: EditorCore;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  /**
   * Groups the selection under a new group node.
   *
   * The group's id is allocated here rather than by the caller: it has to be
   * free in *this* document, which is a fact about the document rather than
   * about whoever pressed Ctrl+G.
   */
  public group(label: string): boolean {
    const document_ = this.editor.document.current;

    return this.#apply(
      groupNodes(document_, this.editor.selection.ids, freeGroupId(document_)),
      label,
    );
  }

  public ungroup(label: string): boolean {
    return this.#apply(
      ungroupNodes(this.editor.document.current, this.editor.selection.ids),
      label,
    );
  }

  public align(edge: AlignEdge, label: string): boolean {
    return this.#apply(
      alignNodes(this.editor.document.current, this.editor.selection.ids, edge),
      label,
    );
  }

  public distribute(axis: 'x' | 'y', label: string): boolean {
    return this.#apply(
      distributeNodes(this.editor.document.current, this.editor.selection.ids, axis),
      label,
    );
  }

  public destroy(): void {
    // Nothing acquired.
  }

  /**
   * Commits a result, or explains why there is nothing to commit.
   *
   * @returns whether anything changed — `false` for a refusal, so a caller can
   * skip a redraw it does not need.
   */
  #apply(result: ArrangeResult, label: string): boolean {
    if (result.refused !== undefined) {
      this.editor.notice.show(describeRefusal(result.refused));

      return false;
    }

    this.editor.notice.clear();
    this.editor.document.commit(label, result.document);

    // Selection before pruning: an operation that created a group wants that
    // group selected, and the prune then drops whatever the operation
    // consumed. Doing it the other way round selects ids that no longer exist
    // and prunes nothing.
    if (result.select !== undefined) {
      this.editor.selection.set(result.select);
    }

    this.editor.selection.pruneToDocument();

    return true;
  }
}

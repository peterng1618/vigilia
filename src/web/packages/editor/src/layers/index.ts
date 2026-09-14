import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
import { buildLayerTree, type LayerRow } from './tree.js';

/**
 * The document as a list of rows — the layer panel's view of the tree.
 *
 * ## Derived, never stored
 *
 * There is no layer state. A row's indentation, its selectedness and whether
 * it reads as hidden or locked are all *computed* from the document and the
 * selection every time they are asked for, which is why opening a file or
 * undoing a delete cannot leave the panel showing something that no longer
 * exists.
 *
 * That is worth stating because the obvious alternative — caching rows and
 * invalidating them — is how a layer panel ends up disagreeing with the
 * canvas, and the disagreement is always in the direction of the panel being
 * confidently stale.
 *
 * ## Effective visibility, not declared visibility
 *
 * A row shows whether a node is *effectively* visible: a child of a hidden
 * group reads as hidden even though its own `visible` is unset, because that
 * is what the author sees. `buildLayerTree` resolves that through
 * `placeNodes`, and the panel draws what it is told.
 */
export class LayersManager implements EditorManager {
  public readonly editor: EditorCore;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  /**
   * Every row, topmost first.
   *
   * Built from the **visible** document, so the panel tracks a drag in
   * progress rather than lagging a gesture behind the canvas.
   */
  public rows(): readonly LayerRow[] {
    return buildLayerTree(this.editor.document.visible.nodes, this.editor.selection.state);
  }

  public destroy(): void {
    // Nothing acquired: the rows are derived on demand.
  }
}

import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
import { buildLayerTree, type LayerRow } from './tree.js';

/** Derived layer view; no cached layer state to drift from document/selection. */
export class LayersManager implements EditorManager {
  public readonly editor: EditorCore;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  /** Topmost-first rows from the visible document, including live gesture previews. */
  public rows(): readonly LayerRow[] {
    return buildLayerTree(this.editor.document.visible.nodes, this.editor.selection.state);
  }

  public destroy(): void {}
}

import type { ThemeNode } from '@vigilia/renderer-core';
import { placeNodes } from './geometry.js';
import { nodeLabel } from './node-label.js';
import type { SelectionState } from './selection.js';

/**
 * A single row in the layer panel tree.
 *
 * Rows are flattened for rendering, with hierarchy expressed via `depth`.
 * Order is **top-to-bottom = topmost-to-bottommost** (reverse paint order),
 * matching standard graphic design software conventions.
 */
export interface LayerRow {
  readonly id: string;
  readonly name: string;
  readonly type: ThemeNode['type'];
  readonly depth: number;
  readonly parentId: string | undefined;
  /** Whether the node itself has visible !== false and no ancestor hides it. */
  readonly visible: boolean;
  /** Whether the node itself has an explicit visible: false. */
  readonly selfHidden: boolean;
  /** Whether an ancestor group is hidden, overriding this node's visibility. */
  readonly ancestorHidden: boolean;
  /** Whether this node is locked (§61), as owned by `placeNodes`. */
  readonly locked: boolean;
  /** Whether this node itself has an explicit locked: true. */
  readonly selfLocked: boolean;
  /** Whether this node is currently selected. */
  readonly selected: boolean;
  /** Whether this node is a group. */
  readonly isGroup: boolean;
}

/**
 * Projects a document's node tree into a flattened list of layer rows.
 *
 * Pure function: takes nodes and selection state, returns pure row data.
 * Does not touch the DOM.
 */
export function buildLayerTree(
  nodes: readonly ThemeNode[],
  selection: SelectionState,
): readonly LayerRow[] {
  const rows: LayerRow[] = [];
  const placements = new Map(placeNodes(nodes).map((placed) => [placed.id, placed]));

  const walk = (
    list: readonly ThemeNode[],
    depth: number,
    parentId: string | undefined,
    ancestorHidden: boolean,
  ): void => {
    // Sibling order in ThemeDocument.nodes is paint order (§137): first child
    // is painted first (bottommost), last child is painted last (topmost).
    // The layer panel shows topmost on top, so siblings are reversed.
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const node = list[index]!;
      const placement = placements.get(node.id);
      const selfHidden = node.visible === false;
      const selfLocked = node.locked === true;
      const isGroup = node.type === 'group';
      const selected = selection.ids.includes(node.id);

      rows.push({
        id: node.id,
        name: nodeLabel(node),
        type: node.type,
        depth,
        parentId,
        // `placeNodes` owns effective visibility. Recomputing inheritance here
        // would let layer state drift from hit-testing and the canvas.
        visible: placement?.visible ?? false,
        selfHidden,
        ancestorHidden,
        // Lock is node-local today; `placeNodes` owns that interpretation too.
        locked: placement?.locked ?? false,
        selfLocked,
        selected,
        isGroup,
      });

      if (isGroup) {
        walk(node.children, depth + 1, node.id, ancestorHidden || selfHidden);
      }
    }
  };

  walk(nodes, 0, undefined, false);
  return rows;
}

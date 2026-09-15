import type { ThemeNode } from '@vigilia/renderer-core';
import { placeNodes } from '../geometry.js';
import { nodeLabel } from '../node-label.js';
import type { SelectionState } from '../selection/domain/selection-state.js';

/** Flat layer row; hierarchy is `depth`, order is topmost-first. */
export interface LayerRow {
  readonly id: string;
  readonly name: string;
  readonly type: ThemeNode['type'];
  readonly depth: number;
  readonly parentId: string | undefined;
  readonly visible: boolean;
  readonly selfHidden: boolean;
  readonly ancestorHidden: boolean;
  readonly locked: boolean;
  readonly selfLocked: boolean;
  readonly selected: boolean;
  readonly isGroup: boolean;
}

/** Pure document tree → layer rows. Effective visibility/lock come from `placeNodes`. */
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
    // Document order is bottom→top paint order; layer UI reverses siblings.
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
        visible: placement?.visible ?? false,
        selfHidden,
        ancestorHidden,
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

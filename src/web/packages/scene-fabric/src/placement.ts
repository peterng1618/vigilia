import type { PlanBox, PlanNode } from '@vigilia/renderer-core';

/**
 * The single top-left → centre conversion. Plan boxes are parent-local and
 * top-left anchored; Fabric 7 uses centre origins.
 */

export interface FabricPlacement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export function placementFor(box: PlanBox): FabricPlacement {
  return {
    left: box.x + box.width / 2,
    top: box.y + box.height / 2,
    width: box.width,
    height: box.height,
    angle: box.rotation,
    scaleX: box.scaleX,
    scaleY: box.scaleY,
  };
}

export interface GroupExtent {
  readonly width: number;
  readonly height: number;
}

/** Convert a plan child's top-left group space to Fabric's centre-local group space. */
export function withinGroup(box: PlanBox, group: GroupExtent): PlanBox {
  return { ...box, x: box.x - group.width / 2, y: box.y - group.height / 2 };
}

/**
 * Give sizeless groups a stable non-zero extent from their children. Fabric
 * culls 0×0 objects before drawing descendants; DOM groups did not.
 */
export function drawnBox(node: PlanNode): PlanBox {
  if (node.content.kind !== 'group' || (node.box.width > 0 && node.box.height > 0)) {
    return node.box;
  }

  let width = node.box.width;
  let height = node.box.height;

  for (const child of node.children) {
    const box = drawnBox(child);

    width = Math.max(width, box.x + box.width * box.scaleX);
    height = Math.max(height, box.y + box.height * box.scaleY);
  }

  return { ...node.box, width, height };
}

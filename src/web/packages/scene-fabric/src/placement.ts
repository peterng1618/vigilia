import type { PlanBox } from '@vigilia/renderer-core';

/**
 * The top-left → centre conversion, and the only copy of it.
 *
 * A `PlanBox` is top-left anchored, in artboard pixels, local to its parent
 * group (§57). Fabric's `left`/`top` mean the **centre** of an object, because
 * Fabric 7 deprecated every origin except `center` — see `chart-object.ts` for
 * why pinning `'left'` was the worse option. So every object this package
 * creates needs two additions, and spec 0013 requires them to exist in exactly
 * one place: a second copy that disagreed by half a box would put content
 * visibly but explicably wrong, which is the hardest kind of bug to see in a
 * dashboard full of centred content.
 *
 * ## Why rotation and scale need no conversion at all
 *
 * `mount.ts` wrote `rotate() scale()` with `transform-origin: 50% 50%`. CSS
 * applies that right-to-left — scale, then rotate, both about the centre — and
 * a Fabric object's matrix is `translate ∘ rotate ∘ scale` about its origin,
 * which is the centre. Same operations, same order, same pivot, and degrees
 * clockwise in both. The numbers carry straight across.
 *
 * Note this is the **creation** direction only. Once a scene is persisted in
 * Fabric's own format (stage 3), geometry comes off the revived object and the
 * plan stops being its source; `PlanBox` narrows to newly created nodes. This
 * function is that narrow path, not a general translator.
 */

/** Geometry as Fabric wants it: centre-anchored. */
export interface FabricPlacement {
  /** Centre x, not the left edge. */
  readonly left: number;
  /** Centre y, not the top edge. */
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** Degrees clockwise, Fabric's own name for it. */
  readonly angle: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

/** Converts a plan box into Fabric's centre-anchored geometry. */
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

/** Just enough of an enclosing group to place a child inside it. */
export interface GroupExtent {
  readonly width: number;
  readonly height: number;
}

/**
 * The same box, expressed relative to an enclosing group's centre.
 *
 * A Fabric group's children live in a space whose origin is the group's
 * **centre**, while a plan child's box is relative to the group's **top-left**
 * (§57). The difference is half the group's size — so it depends on the group's
 * size and not on its position, which is why moving a group never needs this.
 *
 * Applied to the box rather than to the placement, so everything downstream —
 * the centre conversion above, and text alignment, which reads box edges —
 * works in one consistent space without each knowing about groups.
 *
 * **Creation does not need it.** `Group.add()` converts a child out of the
 * plane the group's own `left`/`top` live in by inverting the group's matrix,
 * and `fabric-nodes.ts` builds each group at its content origin precisely so
 * that inversion *is* this subtraction. Updating a child does need it: there is
 * no `add()` then, and the child's coordinates are already group-local.
 */
export function withinGroup(box: PlanBox, group: GroupExtent): PlanBox {
  return { ...box, x: box.x - group.width / 2, y: box.y - group.height / 2 };
}

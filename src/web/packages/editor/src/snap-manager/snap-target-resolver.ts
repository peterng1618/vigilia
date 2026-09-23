import type { Canvas, FabricObject } from "fabric/es";

import { getObjectBounds, getObjectExactBounds } from "./bounds.js";
import {
  collectExcludedObjects,
  shouldIgnoreObject,
} from "./excluded-objects.js";
import type { Bounds } from "./types.js";

/** How to compute the bounds of objects available for snapping. */
export type SnapTargetBoundsMode = "exact" | "rounded";

/** An object and its bounds inside one snap-target snapshot. */
export type ResolvedSnapTarget = Readonly<{
  bounds: Bounds;
  object: FabricObject;
  snapshotIndex: number;
}>;

/** Picks objects to snap against and computes their bounds in the given mode. */
export class SnapTargetResolver {
  /** The canvas holding the objects available to the current snapshot. */
  private readonly canvas: Canvas;

  /** Creates a snap-target resolver for an editor canvas. */
  constructor({ canvas }: { canvas: Canvas }) {
    this.canvas = canvas;
  }

  /** Returns eligible objects with computed bounds in canvas order. */
  public resolve({
    activeObject,
    mode,
  }: {
    activeObject?: FabricObject | null;
    mode: SnapTargetBoundsMode;
  }): ResolvedSnapTarget[] {
    const excluded = collectExcludedObjects(
      activeObject === undefined ? {} : { activeObject },
    );
    const objects: FabricObject[] = [];
    const targets: ResolvedSnapTarget[] = [];

    this.canvas.forEachObject((object) => {
      if (!shouldIgnoreObject({ object, excluded })) objects.push(object);
    });

    for (
      let snapshotIndex = 0;
      snapshotIndex < objects.length;
      snapshotIndex += 1
    ) {
      const object = objects[snapshotIndex];
      if (object === undefined) continue;
      const bounds = this._resolveBounds({ mode, object });
      if (!bounds) continue;

      targets.push({ bounds, object, snapshotIndex });
    }

    return targets;
  }

  /** Computes one target's bounds in the resolver's configured mode. */
  private _resolveBounds({
    mode,
    object,
  }: {
    mode: SnapTargetBoundsMode;
    object: FabricObject;
  }): Bounds | null {
    return mode === "exact"
      ? getObjectExactBounds({ object })
      : getObjectBounds({ object });
  }
}

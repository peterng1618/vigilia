import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
import { placeNodes, unionBounds, type Point } from '../geometry.js';
import {
  collectSnapTargets,
  snapMove,
  thresholdInDocumentUnits,
  type SnapGuide,
} from './resolver.js';

/** Viewport-pixel tolerance; converted per gesture so zoom does not change feel. */
const SNAP_PIXELS = 7;

/** Owns transient move-snapping guides. Resize snapping is intentionally absent. */
export class SnappingManager implements EditorManager {
  public readonly editor: EditorCore;

  #guides: readonly SnapGuide[] = [];

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  public get guides(): readonly SnapGuide[] {
    return this.#guides;
  }

  /** Snap the actual moving set, not necessarily the full selection. */
  public resolveMove(input: {
    readonly movingIds: readonly string[];
    readonly delta: Point;
    readonly scale: number;
  }): Point {
    const document_ = this.editor.document.current;
    const placements = placeNodes(document_.nodes);
    const moving = new Set(input.movingIds);
    const bounds = unionBounds(placements.filter((node) => moving.has(node.id)));

    if (bounds === undefined) {
      this.clear();

      return input.delta;
    }

    const snapped = snapMove(
      bounds,
      input.delta,
      collectSnapTargets(placements, document_.artboard, moving),
      { threshold: thresholdInDocumentUnits(SNAP_PIXELS, input.scale) },
    );

    this.#guides = snapped.guides;

    return snapped.delta;
  }

  public clear(): void {
    this.#guides = [];
  }

  public destroy(): void {
    this.clear();
  }
}

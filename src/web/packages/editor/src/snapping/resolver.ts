import type { Bounds, PlacedNode, Point } from '../geometry.js';
import { worldBounds } from '../geometry.js';

/** Legacy edge/centre snapping until the Fabric editor foundation replaces it. */

export interface SnapTarget {
  readonly axis: 'x' | 'y';
  readonly position: number;
  readonly source: string;
  readonly kind: 'start' | 'centre' | 'end';
}

export interface SnapGuide extends SnapTarget {
  readonly moved: 'start' | 'centre' | 'end';
}

export interface SnapResult {
  readonly delta: Point;
  readonly guides: readonly SnapGuide[];
}

export interface SnapOptions {
  /** Maximum correction in document units. */
  readonly threshold: number;
  readonly disabled?: boolean;
}

/** Collect artboard and visible-node edge/centre targets, excluding dragged content. */
export function collectSnapTargets(
  nodes: readonly PlacedNode[],
  artboard: { readonly width: number; readonly height: number },
  exclude: ReadonlySet<string> = new Set(),
): SnapTarget[] {
  const targets: SnapTarget[] = [
    { axis: 'x', position: 0, source: 'artboard', kind: 'start' },
    { axis: 'x', position: artboard.width / 2, source: 'artboard', kind: 'centre' },
    { axis: 'x', position: artboard.width, source: 'artboard', kind: 'end' },
    { axis: 'y', position: 0, source: 'artboard', kind: 'start' },
    { axis: 'y', position: artboard.height / 2, source: 'artboard', kind: 'centre' },
    { axis: 'y', position: artboard.height, source: 'artboard', kind: 'end' },
  ];

  for (const node of nodes) {
    if (!node.visible || exclude.has(node.id) || node.width <= 0 || node.height <= 0) {
      continue;
    }

    // Children of a dragged ancestor move with it and are not independent targets.
    if (node.ancestors.some((ancestor) => exclude.has(ancestor))) {
      continue;
    }

    const bounds = worldBounds(node);

    targets.push(
      { axis: 'x', position: bounds.left, source: node.id, kind: 'start' },
      { axis: 'x', position: (bounds.left + bounds.right) / 2, source: node.id, kind: 'centre' },
      { axis: 'x', position: bounds.right, source: node.id, kind: 'end' },
      { axis: 'y', position: bounds.top, source: node.id, kind: 'start' },
      { axis: 'y', position: (bounds.top + bounds.bottom) / 2, source: node.id, kind: 'centre' },
      { axis: 'y', position: bounds.bottom, source: node.id, kind: 'end' },
    );
  }

  return targets;
}

/** Apply the nearest independent correction on each axis. */
export function snapMove(
  bounds: Bounds,
  delta: Point,
  targets: readonly SnapTarget[],
  options: SnapOptions,
): SnapResult {
  if (options.disabled === true || options.threshold <= 0) {
    return { delta, guides: [] };
  }

  const moved: Bounds = {
    left: bounds.left + delta.x,
    right: bounds.right + delta.x,
    top: bounds.top + delta.y,
    bottom: bounds.bottom + delta.y,
  };

  const x = bestCorrection(
    [
      { moved: 'start', position: moved.left },
      { moved: 'centre', position: (moved.left + moved.right) / 2 },
      { moved: 'end', position: moved.right },
    ],
    targets.filter((target) => target.axis === 'x'),
    options.threshold,
  );

  const y = bestCorrection(
    [
      { moved: 'start', position: moved.top },
      { moved: 'centre', position: (moved.top + moved.bottom) / 2 },
      { moved: 'end', position: moved.bottom },
    ],
    targets.filter((target) => target.axis === 'y'),
    options.threshold,
  );

  const guides: SnapGuide[] = [];

  if (x !== undefined) {
    guides.push({ ...x.target, moved: x.moved });
  }
  if (y !== undefined) {
    guides.push({ ...y.target, moved: y.moved });
  }

  return {
    delta: {
      x: delta.x + (x?.correction ?? 0),
      y: delta.y + (y?.correction ?? 0),
    },
    guides,
  };
}

interface Candidate {
  readonly moved: 'start' | 'centre' | 'end';
  readonly position: number;
}

interface Correction {
  readonly correction: number;
  readonly target: SnapTarget;
  readonly moved: 'start' | 'centre' | 'end';
}

/** Nearest correction wins; exact ties prefer centre-to-centre alignment. */
function bestCorrection(
  candidates: readonly Candidate[],
  targets: readonly SnapTarget[],
  threshold: number,
): Correction | undefined {
  let best: Correction | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestIsCentre = false;

  for (const target of targets) {
    for (const candidate of candidates) {
      const correction = target.position - candidate.position;
      const distance = Math.abs(correction);

      if (distance > threshold) {
        continue;
      }

      const isCentre = candidate.moved === 'centre' && target.kind === 'centre';
      const closer = distance < bestDistance - 1e-9;
      const tied = Math.abs(distance - bestDistance) <= 1e-9;

      if (closer || (tied && isCentre && !bestIsCentre)) {
        best = { correction, target, moved: candidate.moved };
        bestDistance = distance;
        bestIsCentre = isCentre;
      }
    }
  }

  return best;
}

/** Convert a viewport-pixel snap tolerance to document units. */
export function thresholdInDocumentUnits(pixels: number, artboardScale: number): number {
  if (!Number.isFinite(artboardScale) || artboardScale <= 0) {
    return pixels;
  }

  return pixels / artboardScale;
}

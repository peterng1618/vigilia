import type { Bounds, PlacedNode, Point } from '../geometry.js';
import { worldBounds } from '../geometry.js';

/**
 * Snapping a drag to the things already on the artboard.
 *
 * ## What it snaps to, and why that list
 *
 * Edges and centres, of other nodes and of the artboard. Nothing else — no
 * grid, no equal-spacing distribution, no baseline detection. Those are all
 * useful and all speculative; edges and centres are what an author reaches for
 * when aligning a dashboard, and they are what the guides can honestly explain.
 *
 * ## The threshold is in viewport pixels, converted by the caller
 *
 * A snap threshold has to feel the same whatever the zoom, so it is a *screen*
 * distance. But everything here works in document space, so the caller divides
 * its pixel threshold by the artboard scale before passing it in. Getting that
 * backwards makes snapping unusable at either extreme — sticky at 25 % zoom, and
 * imperceptible at 400 %.
 *
 * ## One correction per axis
 *
 * The nearest candidate on each axis wins independently, so a node can snap its
 * left edge to one neighbour and its vertical centre to another. That is what
 * makes aligning into a grid of panels feel effortless, and it is also why the
 * result carries the *guides* that matched: an author needs to see which
 * alignment they got, not just that something moved.
 */

/** An alignment a node can snap to. */
export interface SnapTarget {
  readonly axis: 'x' | 'y';
  /** Position in document space. */
  readonly position: number;
  /**
   * What produced it — a node id, or `artboard`.
   *
   * Carried so a guide can be drawn to the thing it aligned with rather than
   * across the whole canvas, which is the difference between a guide that
   * explains itself and a line that just appears.
   */
  readonly source: string;
  /** Which part of the source: its near edge, centre or far edge. */
  readonly kind: 'start' | 'centre' | 'end';
}

/** A snap that was applied, for drawing. */
export interface SnapGuide extends SnapTarget {
  /** Which part of the dragged box landed on it. */
  readonly moved: 'start' | 'centre' | 'end';
}

export interface SnapResult {
  /** The delta to use instead of the raw one. */
  readonly delta: Point;
  readonly guides: readonly SnapGuide[];
}

export interface SnapOptions {
  /** Maximum correction, in **document** units. See the note above about zoom. */
  readonly threshold: number;
  /** Skip snapping entirely — normally bound to a modifier key. */
  readonly disabled?: boolean;
}

/**
 * Collects every alignment the artboard offers.
 *
 * `exclude` is the set being dragged: a node must not snap to itself, and a
 * multi-selection must not snap to its own members, or the selection would
 * fight its own alignment.
 */
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
    // Hidden nodes offer no alignment: there is nothing on screen to align to,
    // and a guide pointing at an invisible edge is unexplainable.
    if (!node.visible || exclude.has(node.id) || node.width <= 0 || node.height <= 0) {
      continue;
    }

    // Excluded if any ancestor is being dragged — a child moves with its group,
    // so its edges are not independent alignments.
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

/**
 * Adjusts a move so the dragged bounds align with something.
 *
 * @param bounds Where the dragged content started, in document space.
 * @param delta The raw pointer delta.
 */
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

/**
 * The smallest correction that brings any candidate onto any target.
 *
 * Ties break toward a **centre** alignment, then toward the earlier target.
 * That ordering is deliberate: when an edge and a centre are equally close, the
 * centre is almost always what the author meant, and an arbitrary tie-break
 * would make the same drag snap differently depending on iteration order.
 */
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

/**
 * Converts a pixel threshold into document units.
 *
 * Trivial, and here because the conversion is the part that gets forgotten:
 * snapping done in document units with a pixel threshold is sticky when zoomed
 * out and imperceptible when zoomed in.
 */
export function thresholdInDocumentUnits(pixels: number, artboardScale: number): number {
  if (!Number.isFinite(artboardScale) || artboardScale <= 0) {
    return pixels;
  }

  return pixels / artboardScale;
}

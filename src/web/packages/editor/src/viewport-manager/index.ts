import { type Canvas, Point } from "fabric/es";
import { clampPan } from "./pan-bounds.js";

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;

/** How much of the host a framed selection fills. */
const SELECTION_FIT_FILL = 0.9;

/** Relative slack on "is this the fitted zoom". A wheel notch moves the zoom by
 * about a tenth, so this separates rounding noise from any real zoom change. */
const FIT_SCALE_EPSILON = 1e-6;

/** Slack on the artboard's edges, in screen px, for the same reason. */
const FIT_EDGE_EPSILON = 1e-6;

/** A box the camera is looking into, in screen px. Named once because the fit
 * helpers all take one and a resize has to compare two of them. */
interface Viewport {
  width: number;
  height: number;
}

export interface ViewportManager {
  zoom(): number;
  /** Zoom about a point in canvas-screen coordinates. */
  zoomToPoint(point: Point, zoom: number): void;
  zoomBy(factor: number): void;
  zoomToFit(): void;
  zoomToSelection(): void;
  reset(): void;
  panBy(deltaX: number, deltaY: number): void;
  /** Where the artboard draws inside the canvas element, in canvas coordinates
   * — the frame `viewportTransform` is in. Add the canvas's own client offset
   * for page coordinates. */
  artboardScreenRect(): {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  /** Re-measure after the host element changed size. A camera that was showing
   * the whole artboard is re-fitted to the new box; one the author has zoomed or
   * panned is held, so a window nudge cannot move a view they set. */
  resize(): void;
  /** Subscribes to camera changes; returns the unsubscribe function. */
  onChange(listener: () => void): () => void;
  destroy(): void;
}

export interface ViewportManagerInput {
  readonly canvas: Canvas;
  readonly host: HTMLElement;
  readonly artboard: () => { readonly width: number; readonly height: number };
}

/**
 * Camera over the Fabric canvas: the only writer of its viewport transform, so
 * every pan and zoom passes the same clamp.
 *
 * Camera state is not document geometry (§57) and never enters authored history
 * (§67). It is read back out of `canvas.viewportTransform` rather than mirrored,
 * because Fabric's `zoomToPoint` is the other writer of that tuple.
 */
export function createViewportManager({
  canvas,
  host,
  artboard,
}: ViewportManagerInput): ViewportManager {
  const listeners = new Set<() => void>();
  const observer =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => resize());

  /** An unlaid-out host measures 0; writing that would collapse the canvas. */
  const viewportSize = (): Viewport | undefined => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
    if (width <= 0 || height <= 0) return undefined;
    return { width, height };
  };

  const transform = (): {
    scale: number;
    translateX: number;
    translateY: number;
  } => {
    const vpt = canvas.viewportTransform;
    return { scale: vpt[0], translateX: vpt[4], translateY: vpt[5] };
  };

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  /** The artboard's rect in canvas space, derived from the same transform the
   * camera writes. The media layer is a DOM sibling of the canvas, so it only
   * stays aligned with the board if it is told this rect after every camera
   * change. */
  const artboardScreenRect = (): {
    left: number;
    top: number;
    width: number;
    height: number;
  } => {
    const vpt = canvas.viewportTransform;
    const scale = vpt[0];
    const board = artboard();
    return {
      left: vpt[4],
      top: vpt[5],
      width: board.width * scale,
      height: board.height * scale,
    };
  };

  /** Writes the canonical transform back, clamped and ordered. */
  const commit = (
    scale: number,
    translateX: number,
    translateY: number,
  ): void => {
    const viewport = viewportSize();
    if (viewport === undefined) return;
    const clamped = clampPan({
      viewport,
      zoom: scale,
      artboard: artboard(),
      offset: { x: translateX, y: translateY },
    });
    canvas.setViewportTransform([scale, 0, 0, scale, clamped.x, clamped.y]);
    canvas.requestRenderAll();
  };

  const zoom = (): number => canvas.getZoom();

  const fitScaleFor = (viewport: Viewport): number => {
    const board = artboard();
    const scale = Math.min(
      viewport.width / board.width,
      viewport.height / board.height,
    );
    if (!Number.isFinite(scale) || scale <= 0) return zoom();
    return Math.min(Math.max(scale, MIN_ZOOM), MAX_ZOOM);
  };

  const fitScale = (): number => {
    const viewport = viewportSize();
    if (viewport === undefined) return zoom();
    return fitScaleFor(viewport);
  };

  /** Where a fit puts the camera in `viewport`, after the same clamp every
   * commit passes through, so "the camera is fitted" and "the camera is where
   * a fit would have put it" cannot disagree about a clamped centre. */
  const fitTransformIn = (
    viewport: Viewport,
  ): { scale: number; translateX: number; translateY: number } => {
    const scale = fitScaleFor(viewport);
    const board = artboard();
    const offset = clampPan({
      viewport,
      zoom: scale,
      artboard: board,
      offset: {
        x: (viewport.width - board.width * scale) / 2,
        y: (viewport.height - board.height * scale) / 2,
      },
    });
    return { scale, translateX: offset.x, translateY: offset.y };
  };

  /** Whether the camera is where a fit would have put it in `viewport`.
   *
   * Derived from the transform rather than remembered as a flag. A flag would
   * have to be cleared by every writer of the tuple — `panBy`, `zoomToPoint`,
   * and Fabric's own `zoomToPoint`, which this module does not own — and one
   * writer missed is a resize that silently discards the author's pan. Read
   * this way it cannot go stale, and it is false at construction unless the
   * identity transform happens to be a fit for the box. */
  const isFittedIn = (viewport: Viewport): boolean => {
    const fit = fitTransformIn(viewport);
    const { scale, translateX, translateY } = transform();
    return (
      Math.abs(scale - fit.scale) <= fit.scale * FIT_SCALE_EPSILON &&
      Math.abs(translateX - fit.translateX) <= FIT_EDGE_EPSILON &&
      Math.abs(translateY - fit.translateY) <= FIT_EDGE_EPSILON
    );
  };

  const zoomToFit = (): void => {
    const viewport = viewportSize();
    if (viewport === undefined) return;
    const board = artboard();
    const scale = fitScale();
    // At fit zoom the artboard is smaller than the host on one axis; centre it.
    commit(
      scale,
      (viewport.width - board.width * scale) / 2,
      (viewport.height - board.height * scale) / 2,
    );
    notify();
  };

  function resize(): void {
    const viewport = viewportSize();
    if (viewport === undefined) return;
    // The host already reports its new size by the time an observer runs, so
    // the box the camera was framed in is the canvas' own dimensions — the
    // value `setDimensions` has not overwritten yet. Reading the host here
    // would compare the camera against a box it was never fitted to.
    const wasFitted = isFittedIn({
      width: canvas.getWidth(),
      height: canvas.getHeight(),
    });
    canvas.setDimensions(viewport);
    if (wasFitted) {
      // A fitted view follows its window. A camera the author has moved is
      // theirs: re-centring it on every size change yanks the view back under
      // them, which is what broke the point-under-cursor invariant when this
      // was tried as an unconditional re-centre.
      zoomToFit();
      return;
    }
    const { scale, translateX, translateY } = transform();
    commit(scale, translateX, translateY);
    notify();
  }

  const zoomToPoint = (point: Point, next: number): void => {
    if (!Number.isFinite(next)) return;
    const target = Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
    canvas.zoomToPoint(point, target);
    const { scale, translateX, translateY } = transform();
    commit(scale, translateX, translateY);
    notify();
  };

  const panBy = (deltaX: number, deltaY: number): void => {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    const { scale, translateX, translateY } = transform();
    commit(scale, translateX + deltaX, translateY + deltaY);
    notify();
  };

  observer?.observe(host);
  resize();

  return {
    zoom,
    zoomToPoint,
    zoomBy(factor) {
      const viewport = viewportSize();
      if (viewport === undefined) return;
      zoomToPoint(
        new Point(viewport.width / 2, viewport.height / 2),
        zoom() * factor,
      );
    },
    zoomToFit,
    zoomToSelection() {
      const active = canvas.getActiveObject();
      if (active === undefined) return zoomToFit();
      const viewport = viewportSize();
      if (viewport === undefined) return;
      const bounds = active.getBoundingRect();
      const scale = Math.min(
        viewport.width / Math.max(bounds.width, 1),
        viewport.height / Math.max(bounds.height, 1),
      );
      const next = Math.min(
        Math.max(scale * SELECTION_FIT_FILL, MIN_ZOOM),
        MAX_ZOOM,
      );
      commit(
        next,
        viewport.width / 2 - (bounds.left + bounds.width / 2) * next,
        viewport.height / 2 - (bounds.top + bounds.height / 2) * next,
      );
      notify();
    },
    reset() {
      commit(1, 0, 0);
      notify();
    },
    panBy,
    artboardScreenRect,
    resize,
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      observer?.disconnect();
      listeners.clear();
    },
  };
}

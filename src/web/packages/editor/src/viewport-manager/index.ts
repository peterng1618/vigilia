import { type Canvas, Point } from "fabric/es";
import {
  DEFAULT_DISPLAY_LENS,
  type DisplayLensId,
  displayLens,
  type ScreenRect,
  screenRect,
} from "../display-lens.js";
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
  /**
   * The lens the stage looks through. `undefined` is Fit — the whole stage,
   * with no display in it.
   *
   * **A view preference, never document content** (§67): it is what the camera
   * is aimed at, in the same way the zoom is, and choosing one writes the
   * viewport transform and nothing else. A device does not resize, reshape or
   * record anything about the artboard.
   */
  display(): DisplayLensId | undefined;
  /** Aims the camera at that display, or at the whole stage for `undefined`. */
  showDisplay(id: DisplayLensId | undefined): void;
  /**
   * Whether the camera is where a fit of what it looks through would have put
   * it, right now.
   *
   * Read from the transform rather than remembered as a flag, for the reason
   * `resize` reads it the same way: a flag has to be cleared by every writer of
   * the tuple, and one that misses is a control reporting a framing the camera
   * is not in. `reset` is the writer that misses — 100 % leaves no display
   * behind, and no display reads as Fit to anything keyed on it alone.
   */
  isFitted(): boolean;
  /** Where the artboard draws inside the canvas element, in canvas coordinates
   * — the frame `viewportTransform` is in. Add the canvas's own client offset
   * for page coordinates. */
  artboardScreenRect(): ScreenRect;
  /** The display's own screen in canvas coordinates — the window the stage
   * looks through, and where its frame is drawn. `undefined` under Fit,
   * because there is no screen to draw. */
  displayScreenRect(): ScreenRect | undefined;
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

  /**
   * The display the stage looks through, or `undefined` for Fit.
   *
   * Starts on the default rather than on Fit, because the starter is drawn in
   * the shape the default lens is and opening on Fit would letterbox the
   * reference composition on the very first paint. Read through the lens rather
   * than mirrored into React: it is camera state, like the zoom.
   */
  let lens: DisplayLensId | undefined = DEFAULT_DISPLAY_LENS;

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
  const artboardScreenRect = (): ScreenRect => {
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

  /**
   * The box the camera frames the artboard inside: the display's screen, or
   * the whole host under Fit.
   *
   * A display is a *window onto* the stage rather than a replacement for it,
   * which is why it is measured against the host: the author still gets the
   * whole canvas to work in, and the screen is the part of it the camera
   * presents through. Its origin is carried because a fit centres the artboard
   * in *this* box, and that is what makes a wide display letterbox a square
   * artboard rather than scale it to the corners.
   */
  const framingBox = (viewport: Viewport): ScreenRect => {
    if (lens === undefined) {
      return {
        left: 0,
        top: 0,
        width: viewport.width,
        height: viewport.height,
      };
    }
    return screenRect(viewport, displayLens(lens).aspect);
  };

  const displayScreenRect = (): ScreenRect | undefined => {
    const viewport = viewportSize();
    if (viewport === undefined || lens === undefined) return undefined;
    return screenRect(viewport, displayLens(lens).aspect);
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

  /** Contain-fit the artboard into `box` — the display's screen when one is
   *  chosen, the whole host under Fit.
   *
   *  Contain, never cover. A display that cropped the artboard to fill itself
   *  would show the author a composition their display never presents, which
   *  is the one thing a lens must not do; the bars where the two aspects
   *  differ are the truth about the mismatch. */
  const fitScaleFor = (box: ScreenRect): number => {
    const board = artboard();
    const scale = Math.min(box.width / board.width, box.height / board.height);
    if (!Number.isFinite(scale) || scale <= 0) return zoom();
    return Math.min(Math.max(scale, MIN_ZOOM), MAX_ZOOM);
  };

  /** Where a fit puts the camera in `viewport`, after the same clamp every
   * commit passes through, so "the camera is fitted" and "the camera is where
   * a fit would have put it" cannot disagree about a clamped centre. */
  const fitTransformIn = (
    viewport: Viewport,
  ): { scale: number; translateX: number; translateY: number } => {
    const box = framingBox(viewport);
    const scale = fitScaleFor(box);
    const board = artboard();
    const offset = clampPan({
      viewport,
      zoom: scale,
      artboard: board,
      // Centred in the display's screen rather than in the host. That is the
      // whole of the difference between a lens and a zoom: the same scale,
      // framed at the display's shape instead of the window's.
      offset: {
        x: box.left + (box.width - board.width * scale) / 2,
        y: box.top + (box.height - board.height * scale) / 2,
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
    // Through `fitTransformIn` rather than recomputing the centre here, so a
    // fit cannot disagree with the predicate that decides whether a resize
    // should perform one — which is exactly the disagreement that made an
    // author's pan vanish on the window nudge that was meant to keep it.
    const { scale, translateX, translateY } = fitTransformIn(viewport);
    commit(scale, translateX, translateY);
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
      // About the framing box's centre, not the host's: under a lens the host
      // centre is not on the screen, and stepping +/− would walk the camera off
      // the display a step at a time.
      const box = framingBox(viewport);
      zoomToPoint(
        new Point(box.left + box.width / 2, box.top + box.height / 2),
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
      const box = framingBox(viewport);
      const scale = Math.min(
        box.width / Math.max(bounds.width, 1),
        box.height / Math.max(bounds.height, 1),
      );
      const next = Math.min(
        Math.max(scale * SELECTION_FIT_FILL, MIN_ZOOM),
        MAX_ZOOM,
      );
      commit(
        next,
        box.left + box.width / 2 - (bounds.left + bounds.width / 2) * next,
        box.top + box.height / 2 - (bounds.top + bounds.height / 2) * next,
      );
      notify();
    },
    reset() {
      // 100 % is an alternative to a display, not a zoom inside one: a screen
      // drawn around a camera parked at 1:1 would be a frame around nothing.
      lens = undefined;
      commit(1, 0, 0);
      notify();
    },
    panBy,
    artboardScreenRect,
    displayScreenRect,
    isFitted() {
      const viewport = viewportSize();
      return viewport !== undefined && isFittedIn(viewport);
    },
    display: () => lens,
    showDisplay(id) {
      // Re-frames even when the display is unchanged. Choosing the display an
      // author has zoomed away from is how they get back to the whole
      // composition, so an early return here would make the control look
      // broken on exactly the press it exists for.
      lens = id;
      zoomToFit();
    },
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

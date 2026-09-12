/**
 * The artboard transform: how a theme's logical coordinate space maps onto a
 * real viewport.
 *
 * §51 requires **one uniform transform applied to all content** — UI-bearing
 * backgrounds, strokes, typography and shadows alike — and §57 forbids automatic
 * element reflow. Everything the renderer draws goes through this.
 *
 * Spec: `.agents/specs/0001-artboard-transform.md`.
 */

/** How the artboard is fitted into the viewport. Mirrors the schema's `fitMode`. */
export type FitMode = 'contain' | 'cover';

/** A logical artboard size, in document units. */
export interface ArtboardSize {
  readonly width: number;
  readonly height: number;
}

/** A viewport size, in CSS pixels. */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Letterbox bars left over in `contain` mode, in viewport pixels.
 *
 * At most one axis is non-zero. Each value is the size of **one** bar, so the
 * pair of bars on that axis together account for twice it.
 */
export interface ArtboardBars {
  /** Bar width on each of the left and right edges. */
  readonly x: number;
  /** Bar height on each of the top and bottom edges. */
  readonly y: number;
}

/**
 * Document-space region hidden off each edge in `cover` mode.
 *
 * At most one axis is non-zero. Expressed in **document** units rather than
 * viewport pixels so the editor can draw the crop preview in the same
 * coordinate space as the content (§55).
 */
export interface ArtboardCrop {
  /** Document units hidden off each of the left and right edges. */
  readonly x: number;
  /** Document units hidden off each of the top and bottom edges. */
  readonly y: number;
}

/** The computed mapping from document space to viewport space. */
export interface ArtboardTransform {
  /**
   * The single uniform scale factor. Never split into x and y — non-uniform
   * scaling would distort strokes, glyphs and shadows (§51).
   */
  readonly scale: number;

  /** Viewport-space x of the artboard origin. Negative in `cover` when cropping horizontally. */
  readonly offsetX: number;

  /** Viewport-space y of the artboard origin. Negative in `cover` when cropping vertically. */
  readonly offsetY: number;

  readonly fitMode: FitMode;

  /** Letterbox bars. Always zero in `cover`. */
  readonly bars: ArtboardBars;

  /** Hidden document region. Always zero in `contain`. */
  readonly crop: ArtboardCrop;

  /**
   * True when the viewport has no area, so `scale` is 0 and nothing is visible.
   * Happens legitimately — a hidden element, a phone mid-rotation — so it is a
   * state to handle, not an error (§124: pause rendering when hidden).
   */
  readonly isDegenerate: boolean;
}

export interface ComputeArtboardTransformInput {
  readonly artboard: ArtboardSize;
  readonly viewport: ViewportSize;
  /** Defaults to `contain`, matching the schema default. */
  readonly fitMode?: FitMode;
}

/**
 * Computes the artboard transform.
 *
 * @throws RangeError if the artboard is non-positive, or any input is non-finite.
 *   An invalid document is a programming error — failing loudly beats rendering
 *   a silently wrong scene.
 */
export function computeArtboardTransform(
  input: ComputeArtboardTransformInput,
): ArtboardTransform {
  const { artboard, viewport } = input;
  const fitMode = input.fitMode ?? 'contain';

  assertFinite(artboard.width, 'artboard.width');
  assertFinite(artboard.height, 'artboard.height');
  assertFinite(viewport.width, 'viewport.width');
  assertFinite(viewport.height, 'viewport.height');

  if (artboard.width <= 0 || artboard.height <= 0) {
    throw new RangeError(
      `Artboard must have positive dimensions; got ${artboard.width}x${artboard.height}.`,
    );
  }

  // A negative viewport is meaningless but reachable (a collapsed flex child
  // reporting a negative rect). Clamp rather than throw: it is a transient
  // layout state, not a broken document.
  const viewportWidth = Math.max(0, viewport.width);
  const viewportHeight = Math.max(0, viewport.height);

  if (viewportWidth === 0 || viewportHeight === 0) {
    return {
      scale: 0,
      offsetX: 0,
      offsetY: 0,
      fitMode,
      bars: { x: 0, y: 0 },
      crop: { x: 0, y: 0 },
      isDegenerate: true,
    };
  }

  const ratioX = viewportWidth / artboard.width;
  const ratioY = viewportHeight / artboard.height;

  // §53: contain uses the smaller ratio so the whole design fits.
  // §55: cover uses the larger ratio so the design fills and crops.
  const scale = fitMode === 'contain' ? Math.min(ratioX, ratioY) : Math.max(ratioX, ratioY);

  const scaledWidth = artboard.width * scale;
  const scaledHeight = artboard.height * scale;

  // Exact centring in both modes. Deliberately NOT rounded — rounding to whole
  // pixels reintroduces drift and visible jitter when the viewport changes by
  // one pixel.
  const offsetX = (viewportWidth - scaledWidth) / 2;
  const offsetY = (viewportHeight - scaledHeight) / 2;

  if (fitMode === 'contain') {
    return {
      scale,
      offsetX,
      offsetY,
      fitMode,
      // Leftover space, halved into one bar per edge. Non-negative by
      // construction: contain never overflows.
      bars: { x: Math.max(0, offsetX), y: Math.max(0, offsetY) },
      crop: { x: 0, y: 0 },
      isDegenerate: false,
    };
  }

  return {
    scale,
    offsetX,
    offsetY,
    fitMode,
    bars: { x: 0, y: 0 },
    // Overflow converted back into document units, so the editor's crop preview
    // shares the content's coordinate space. Offsets are <= 0 here.
    crop: {
      x: Math.max(0, -offsetX / scale),
      y: Math.max(0, -offsetY / scale),
    },
    isDegenerate: false,
  };
}

/** A point in either coordinate space. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Maps a document-space point into viewport space. */
export function documentToViewport(transform: ArtboardTransform, point: Point): Point {
  return {
    x: point.x * transform.scale + transform.offsetX,
    y: point.y * transform.scale + transform.offsetY,
  };
}

/**
 * Maps a viewport-space point back into document space — the editor's
 * hit-testing path.
 *
 * Exact inverse of {@link documentToViewport} for finite input. Returns the
 * artboard origin for a degenerate transform, where no inverse exists.
 */
export function viewportToDocument(transform: ArtboardTransform, point: Point): Point {
  if (transform.scale === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale,
  };
}

/**
 * The transform as a CSS `transform` value, for a host element whose
 * `transform-origin` is `0 0`.
 *
 * Translate precedes scale so the offsets stay in viewport pixels rather than
 * being multiplied by the scale.
 */
export function toCssTransform(transform: ArtboardTransform): string {
  return `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`;
}

/**
 * True when the design is fully visible — i.e. nothing is cropped.
 *
 * Always true for `contain`. True for `cover` only when the aspect ratios match
 * exactly, which is the one case where the two modes coincide.
 */
export function isFullyVisible(transform: ArtboardTransform): boolean {
  return !transform.isDegenerate && transform.crop.x === 0 && transform.crop.y === 0;
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number; got ${value}.`);
  }
}

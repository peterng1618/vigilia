/** Uniform mapping from logical artboard coordinates to a viewport. */

export type FitMode = 'contain' | 'cover';

export interface ArtboardSize {
  readonly width: number;
  readonly height: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/** Size of one letterbox bar per axis, in viewport pixels. */
export interface ArtboardBars {
  readonly x: number;
  readonly y: number;
}

/** Document-space amount cropped from each edge in cover mode. */
export interface ArtboardCrop {
  readonly x: number;
  readonly y: number;
}

export interface ArtboardTransform {
  /** Single uniform scale; split x/y scaling would distort authored content. */
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly fitMode: FitMode;
  readonly bars: ArtboardBars;
  readonly crop: ArtboardCrop;
  /** Legitimate zero-area viewport state, e.g. hidden or mid-rotation. */
  readonly isDegenerate: boolean;
}

export interface ComputeArtboardTransformInput {
  readonly artboard: ArtboardSize;
  readonly viewport: ViewportSize;
  readonly fitMode?: FitMode;
}

/** Computes the centred contain/cover transform. Invalid artboard geometry throws. */
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

  // Viewport collapse is transient layout state, not an invalid document.
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
  const scale = fitMode === 'contain' ? Math.min(ratioX, ratioY) : Math.max(ratioX, ratioY);

  const scaledWidth = artboard.width * scale;
  const scaledHeight = artboard.height * scale;

  // Keep fractional offsets; rounding causes one-pixel resize jitter.
  const offsetX = (viewportWidth - scaledWidth) / 2;
  const offsetY = (viewportHeight - scaledHeight) / 2;

  if (fitMode === 'contain') {
    return {
      scale,
      offsetX,
      offsetY,
      fitMode,
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
    crop: {
      x: Math.max(0, -offsetX / scale),
      y: Math.max(0, -offsetY / scale),
    },
    isDegenerate: false,
  };
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function documentToViewport(transform: ArtboardTransform, point: Point): Point {
  return {
    x: point.x * transform.scale + transform.offsetX,
    y: point.y * transform.scale + transform.offsetY,
  };
}

/** Exact inverse for finite transforms; degenerate transforms map to the origin. */
export function viewportToDocument(transform: ArtboardTransform, point: Point): Point {
  if (transform.scale === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale,
  };
}

/** CSS transform for a host using `transform-origin: 0 0`. */
export function toCssTransform(transform: ArtboardTransform): string {
  return `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`;
}

export function isFullyVisible(transform: ArtboardTransform): boolean {
  return !transform.isDegenerate && transform.crop.x === 0 && transform.crop.y === 0;
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number; got ${value}.`);
  }
}

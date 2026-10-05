/** Visible margin past the artboard edge before panning is stopped, in screen px. */
export const PAN_OVERSCROLL_MARGIN = 48;

/** Keeps at least the artboard's edge (plus the margin) inside the viewport. */
export function clampPan({
  viewport,
  zoom,
  artboard,
  offset,
}: {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly zoom: number;
  readonly artboard: { readonly width: number; readonly height: number };
  readonly offset: { readonly x: number; readonly y: number };
}): { readonly x: number; readonly y: number } {
  const width = artboard.width * zoom;
  const height = artboard.height * zoom;
  // The artboard's left edge may sit anywhere from just inside the viewport's
  // right edge (margin included) to just past its own right edge off-screen
  // left. Below fit zoom that range is empty, so it is ordered with min/max
  // rather than assumed.
  return {
    x: clampAxis(
      offset.x,
      PAN_OVERSCROLL_MARGIN - width,
      viewport.width - PAN_OVERSCROLL_MARGIN,
    ),
    y: clampAxis(
      offset.y,
      PAN_OVERSCROLL_MARGIN - height,
      viewport.height - PAN_OVERSCROLL_MARGIN,
    ),
  };
}

function clampAxis(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, Math.min(low, high)), Math.max(low, high));
}

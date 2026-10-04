import { ARTBOARD_RATIOS, type ArtboardRatioId } from "./artboard-presets.js";

/**
 * The displays a theme can be seen through, and the lens the stage looks
 * through to show it.
 *
 * **The lens, never the document.** Choosing one changes what the camera looks
 * at and at what shape; the artboard keeps whatever dimensions the author gave
 * it. A theme at 3:1 and one at 4000×4000 both author in the same stage, and
 * each is only ever *shown* through one of these.
 *
 * Named `Display` rather than `Device` because `device` already means a sensor
 * here — `host/src/settings/devices.ts`, and the theme's own device readings —
 * and a lens that framed *those* would be a different idea. The word the spec
 * uses is the display, and this is the same thing.
 */
export type DisplayLensId = "phone-landscape" | "phone-portrait" | "wall-panel";

export interface DisplayLens {
  readonly id: DisplayLensId;
  /** Width ÷ height of the display's screen. */
  readonly aspect: number;
}

/**
 * A ratio's number, from the one owner of artboard ratios.
 *
 * Read rather than restated: `19.5:9` written here as well as there is a
 * number that can drift, and a lens that quietly stopped being a phone is
 * invisible until somebody measures it.
 *
 * A missing id throws rather than defaulting, for the reason `artboardSize`
 * does: a default would frame the stage at a shape nobody chose, and the
 * frame is the only thing saying which shape that is.
 */
function ratioOf(id: ArtboardRatioId): number {
  const found = ARTBOARD_RATIOS.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new RangeError(`no artboard ratio named ${id}`);
  }
  return found.ratio;
}

const phone = ratioOf("19.5:9");
const wall = ratioOf("16:9");

/**
 * Portrait is the same display turned, so one number covers both and the two
 * orientations cannot drift apart — the reason `artboardSize` swaps its edges
 * rather than restating them.
 */
export const DISPLAY_LENSES: readonly DisplayLens[] = [
  { id: "phone-landscape", aspect: phone },
  { id: "phone-portrait", aspect: 1 / phone },
  { id: "wall-panel", aspect: wall },
];

/**
 * The lens the editor opens on: a landscape phone, which is the shape the
 * starter theme is already drawn in, so the reference composition is framed
 * correctly the moment the editor opens rather than after a click.
 */
export const DEFAULT_DISPLAY_LENS: DisplayLensId = "phone-landscape";

export function displayLens(id: DisplayLensId): DisplayLens {
  const found = DISPLAY_LENSES.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new RangeError(`no display lens named ${id}`);
  }
  return found;
}

/**
 * A box in canvas coordinates — the frame `viewportTransform` is in — so the
 * same numbers place the on-stage frame and frame the artboard.
 */
export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The largest rect of `aspect` that fits `viewport`, centred.
 *
 * The screen is sized to the window it is viewed in rather than at a fixed
 * pixel size, so the lens is the same shape at any stage size and the artboard
 * inside it is what carries the scale. Nothing here names an artboard: this is
 * the window, and the artboard is fitted into it by the camera.
 */
export function screenRect(
  viewport: { readonly width: number; readonly height: number },
  aspect: number,
): ScreenRect {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new RangeError(
      `a display aspect must be positive and finite, not ${aspect}`,
    );
  }
  const width = Math.min(viewport.width, viewport.height * aspect);
  const height = width / aspect;
  return {
    left: (viewport.width - width) / 2,
    top: (viewport.height - height) / 2,
    width,
    height,
  };
}

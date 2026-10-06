import {
  ARTBOARD_RATIOS,
  type ArtboardRatioId,
  type ArtboardShape,
  DEFAULT_ARTBOARD_PRESET,
} from "./artboard-presets.js";

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
  /** The artboard shape this display is measured in, and what a new theme
   *  arrives at when the author says which display it is for.
   *
   *  **A shape, never a size.** No resolution: a display says what shape the
   *  screen is, and a resolution is the author's later choice in the panel.
   *  Fixing one here would be the redesign's own failure — silently settling
   *  a second thing nobody asked about. */
  readonly shape: ArtboardShape;
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

/** A lens's aspect, read from the shape it names rather than written beside
 *  it — the same reason `ratioOf` exists, one step further on. Portrait is the
 *  same display turned, so one ratio covers both orientations and the two
 *  cannot drift apart, which is also why `artboardSize` swaps its edges. */
function lens(id: DisplayLensId, shape: ArtboardShape): DisplayLens {
  const wide = ratioOf(shape.ratio);
  return {
    id,
    shape,
    aspect: shape.orientation === "portrait" ? 1 / wide : wide,
  };
}

/** The two physical displays, named by the ratio each is measured in. The
 *  phone's two entries share one ratio rather than two spellings of it. */
const phone: ArtboardShape = { ratio: "19.5:9", orientation: "landscape" };
const wall: ArtboardShape = { ratio: "16:9", orientation: "landscape" };

export const DISPLAY_LENSES: readonly DisplayLens[] = [
  lens("phone-landscape", phone),
  lens("phone-portrait", { ratio: phone.ratio, orientation: "portrait" }),
  lens("wall-panel", wall),
];

/**
 * The lens the editor opens on: the shape a new document opens at, read out of
 * `DEFAULT_ARTBOARD_PRESET` rather than written here.
 *
 * **The starter is what makes that shape the right one.** It is 1672 × 941 —
 * 1.7768, which is 16:9 — so the wall panel frames the reference composition
 * edge to edge the moment the editor opens, and a 19.5:9 lens would spend about
 * 18 % of a 1600 px stage on bars around it. The default used to claim a
 * landscape phone, on the stated grounds that the starter is drawn in one; it
 * is not, and the claim cost the stage 287 px of nothing.
 *
 * Resolved rather than typed, for the reason `ratioOf` exists: a second number
 * here is a second answer to the same question, and the two had already
 * drifted apart. A shape no lens frames throws, exactly as a missing ratio
 * does — a default would frame the stage at a shape nobody chose.
 */
export const DEFAULT_DISPLAY_LENS: DisplayLensId = lensIdForShape({
  ratio: DEFAULT_ARTBOARD_PRESET.ratio,
  orientation: DEFAULT_ARTBOARD_PRESET.orientation,
});

/** The lens showing `shape`, or a throw rather than the nearest one. */
function lensIdForShape(shape: ArtboardShape): DisplayLensId {
  const found = DISPLAY_LENSES.find(
    (entry) =>
      entry.shape.ratio === shape.ratio &&
      entry.shape.orientation === shape.orientation,
  );
  if (found === undefined) {
    throw new RangeError(
      `no display lens shows a ${shape.orientation} ${shape.ratio} artboard`,
    );
  }
  return found.id;
}

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

import {
  ARTBOARD_ORIENTATIONS,
  ARTBOARD_RATIOS,
  type ArtboardOrientation,
  type ArtboardRatioId,
  type ArtboardShape,
  DEFAULT_ARTBOARD_PRESET,
} from "./artboard-presets.js";

/** A ratio's own name stood on its side — `19.5:9` as `9:19.5`. A type rather
 *  than a list, because the portrait names are nowhere written down: they are
 *  the landscape ones, read the other way up. */
type Upright<Id extends string> = Id extends `${infer W}:${infer H}`
  ? `${H}:${W}`
  : never;

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
 *
 * **Each lens is named by the aspect it frames.** "Phone" and "wall panel" say
 * where a screen happens to hang and mean different things to different people;
 * the ratio is the fact the lens actually holds, so it is the only name here
 * that cannot be argued with.
 *
 * **A portrait id is the reciprocal, not a second ratio id.** `ArtboardRatioId`
 * holds landscape ratios only, so `9:19.5` is deliberately not one — widening
 * that type would put six shapes into the artboard presets', the chooser's and
 * the validator's vocabulary, and the persisted shape list is not what needs a
 * portrait name. The number still comes from the landscape entry through
 * `ratioOf`, so nothing writes a ratio twice.
 */
export type DisplayLensId = ArtboardRatioId | Upright<ArtboardRatioId>;

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
 * number that can drift, and a lens whose id and aspect quietly disagree is
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
 *  cannot drift apart, which is also why `artboardSize` swaps its edges.
 *
 *  The id comes out of the shape for the same reason: a lens named `9:19.5` is
 *  a second spelling of `19.5:9`, and two spellings of one number is the drift
 *  `ratioOf` exists to prevent. */
function lens(shape: ArtboardShape): DisplayLens {
  const wide = ratioOf(shape.ratio);
  const upright = shape.orientation === "portrait";
  return {
    id: upright ? turned(shape.ratio) : shape.ratio,
    shape,
    aspect: upright ? 1 / wide : wide,
  };
}

/** A ratio's own id turned on its side — the name the portrait lens of the same
 *  shape carries. Split from the id rather than written out, so a ratio added
 *  to the presets brings its upright id with it instead of needing a second
 *  entry here that can disagree with the first. The split is a pair because
 *  every `ArtboardRatioId` holds exactly one colon. */
function turned(id: ArtboardRatioId): Upright<ArtboardRatioId> {
  const [wide, tall] = id.split(":") as [string, string];
  return `${tall}:${wide}` as Upright<ArtboardRatioId>;
}

/**
 * Every shape the artboard presets name, each way up: `ARTBOARD_RATIOS` crossed
 * with `ARTBOARD_ORIENTATIONS`, six lenses derived rather than written.
 *
 * **Derived, so a lens cannot name a shape the presets cannot build.** A fourth
 * ratio in `artboard-presets.ts` is a fourth pair of previews here with nothing
 * to add to this file — and a lens whose ratio was written here alone would be
 * a number nothing else can check it against, which is the whole argument for
 * `ratioOf` above.
 *
 * **The cross product is not a constraint on the artboard.** These are the
 * common device shapes to *look through*, offered because an author whose theme
 * is for a phone wants the phone's proportions; a super thin strip and a square
 * are not in the table and are not the less authorable for it. The panel's
 * width and height fields and its Custom size are untouched, and nothing here
 * is ever written into the document (§67).
 */
export const DISPLAY_LENSES: readonly DisplayLens[] =
  ARTBOARD_ORIENTATIONS.flatMap((orientation) =>
    ARTBOARD_RATIOS.map((entry) => lens({ ratio: entry.id, orientation })),
  );

/** One orientation's previews, under the label the pickers head them with. */
export interface DisplayLensGroup {
  readonly orientation: ArtboardOrientation;
  readonly lenses: readonly DisplayLens[];
}

/**
 * The lenses by orientation, the artboard's own orientation first.
 *
 * **One list, grouped once, for both pickers.** The display menu and the
 * new-theme chooser ask the same question — which previews suit this theme — and
 * either building its own groups would be a second answer to it. Landscape and
 * portrait are two labels rather than one run of six, because an author reading
 * a list of ratios cannot see at a glance which four of them will not help.
 *
 * **Ordered by the artboard through the predicate that already exists.** Both
 * callers read the orientation with `artboardOrientation` — the very function
 * `nearestArtboardPreset` reads its own through — so a portrait theme leads
 * with the portrait previews and the two cannot come to disagree about what a
 * size is. A square is not taller than wide and leads with landscape: the
 * owner's ruling, kept because it keeps the logic to one comparison.
 */
export function displayLensGroups(
  leading: ArtboardOrientation,
): readonly DisplayLensGroup[] {
  const groups: DisplayLensGroup[] = [];
  for (const group of groupedLenses) {
    if (group.orientation === leading) groups.unshift(group);
    else groups.push(group);
  }
  return groups;
}

/** Built once from the list above; `displayLensGroups` only reorders it. */
const groupedLenses: readonly DisplayLensGroup[] = ARTBOARD_ORIENTATIONS.map(
  (orientation) => ({
    orientation,
    lenses: DISPLAY_LENSES.filter(
      (entry) => entry.shape.orientation === orientation,
    ),
  }),
);

/**
 * The lens the editor opens on: the shape a new document opens at, read out of
 * `DEFAULT_ARTBOARD_PRESET` rather than written here.
 *
 * **The starter is what makes that shape the right one.** It is 1672 × 941 —
 * 1.7768, which is 16:9 — so the 16:9 lens frames the reference composition
 * edge to edge the moment the editor opens, and a 19.5:9 lens would spend about
 * 18 % of a 1600 px stage on bars around it. The default used to claim a 19.5:9
 * lens, on the stated grounds that the starter is drawn in one; it is not, and
 * the claim cost the stage 287 px of nothing.
 *
 * Resolved rather than typed, for the reason `ratioOf` exists: a second number
 * here is a second answer to the same question, and the two had already
 * drifted apart. A shape no lens frames throws, exactly as a missing ratio
 * does — a default would frame the stage at a shape nobody chose.
 */
export const DEFAULT_DISPLAY_LENS: DisplayLensId = displayLensIdForShape({
  ratio: DEFAULT_ARTBOARD_PRESET.ratio,
  orientation: DEFAULT_ARTBOARD_PRESET.orientation,
});

/** The lens showing `shape`, or a throw rather than the nearest one. Also the
 *  answer `DEFAULT_DISPLAY_LENS` is built from, so a shape the table cannot
 *  frame is refused where the table is read rather than by each caller. */
export function displayLensIdForShape(shape: ArtboardShape): DisplayLensId {
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

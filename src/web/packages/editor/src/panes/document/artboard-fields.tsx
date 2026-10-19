import {
  type Artboard,
  type AssetReference,
  BACKGROUND_MEDIA_FITS,
  type FabricPalette,
  type Globals,
  MAX_ARTBOARD_DIMENSION,
  paletteTokenOptions,
} from "@vigilia/renderer-core";
import { outsideCount, type SceneBox } from "@vigilia/scene-fabric";
import { useId } from "react";
import {
  ARTBOARD_ORIENTATIONS,
  ARTBOARD_RATIOS,
  ARTBOARD_RESOLUTIONS,
  artboardPresetFor,
  artboardSize,
  nearestArtboardPreset,
} from "../../artboard-presets.js";
import { ControlPair } from "../../components/ui/control-pair.js";
import {
  type ControlOption,
  ControlSelect,
} from "../../components/ui/control-select.js";
import { uiCopy } from "../../ui-copy.js";

/**
 * The board the theme is drawn on: the size, the three controls that derive one,
 * the paint behind it and the media under that.
 *
 * **The document is the state.** Every value here is read from `artboard` and
 * every edit leaves as a whole new artboard, so a control cannot hold a reading
 * the document does not — which is what the imperative panel had to repair by
 * hand, re-applying the palette references on every commit because the selects
 * were the only place they lived.
 *
 * **The note is derived, never stored.** What a size costs comes from
 * `scene-fabric`'s own count over the boxes the scene reports, so the editor and
 * the player cannot disagree about the same theme, and nothing on disk can go
 * stale. `boxes` is a reading rather than a port: the panel takes a fresh one
 * every time it draws, and a fresh array is what makes the figure follow the
 * scene.
 */
interface ArtboardFieldsProps {
  readonly artboard: Artboard;
  readonly globals: Globals | undefined;
  readonly assets: readonly AssetReference[];
  readonly boxes: readonly SceneBox[] | undefined;
  readonly onCommit: (next: Artboard) => void;
}

export function ArtboardFields(props: ArtboardFieldsProps): React.JSX.Element {
  const { artboard, globals, assets, boxes, onCommit } = props;
  // The size note's id, minted here because this component renders the note and
  // hands the id to the controls it describes.
  const noteId = `vigilia-artboard-note-${useId().replace(/[^\w-]/g, "")}`;
  const matching = artboardPresetFor(artboard);
  const commit = (patch: Partial<Artboard>): void =>
    onCommit({ ...artboard, ...patch });

  /** The pair commits both halves, so the size is refused here as well as in
   *  each field: a document holding a width of 0 is one no display can frame. */
  const commitSize = (width: number, height: number): void => {
    if (!isDimension(width) || !isDimension(height)) return;
    commit({ width, height });
  };

  /**
   * The three controls choose a size together, so any one of them writes a whole
   * derived size. The one the author moved is taken as read and the two left on
   * the Custom reading take **the preset nearest this document's size** — which
   * is what `nearestArtboardPreset` answers and what the new-document chooser
   * opens on for the same size, so a 1280 × 2778 phone is not answered with a
   * 16:9 landscape offer it is not holding.
   */
  const commitPreset = (
    which: "ratio" | "orientation" | "resolution",
    id: string,
  ): void => {
    const nearest = nearestArtboardPreset(artboard);
    const chosen = {
      ratio:
        which === "ratio"
          ? presetId(id, nearest.ratio)
          : shown(matching?.ratio, nearest.ratio),
      orientation:
        which === "orientation"
          ? presetId(id, nearest.orientation)
          : shown(matching?.orientation, nearest.orientation),
      resolution:
        which === "resolution"
          ? presetId(id, nearest.resolution)
          : shown(matching?.resolution, nearest.resolution),
    };
    const derived = artboardSize(
      chosen.ratio,
      chosen.resolution,
      chosen.orientation,
    );
    commit({ width: derived.width, height: derived.height });
  };

  /** A palette reference, or the removal of one. A literal is in no option of
   *  this control, so the blank reading is the author clearing a reference and
   *  never a literal being dropped behind their back. */
  const commitPalette = (value: string): void => {
    const next = { ...artboard };
    setPaletteReference(next, value, artboard.background);
    onCommit(next);
  };

  const commitMedia = (assetId: string): void => {
    if (assetId === "") {
      const { backgroundMedia: _dropped, ...withoutMedia } = artboard;
      onCommit(withoutMedia);
      return;
    }
    commit({
      backgroundMedia: {
        assetId,
        fit: artboard.backgroundMedia?.fit ?? "theme",
      },
    });
  };

  /** A mode this control did not offer is refused rather than clamped: the
   *  options come from the same list the model publishes, so a string that is
   *  not in it is a stale control and not a third mode. */
  const commitFit = (fit: string): void => {
    const assetId = artboard.backgroundMedia?.assetId;
    const next = BACKGROUND_MEDIA_FITS.find((mode) => mode === fit);
    if (assetId === undefined || next === undefined) return;
    commit({ backgroundMedia: { assetId, fit: next } });
  };

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <ControlSelect
        label={uiCopy.panels.ratio}
        data={{ "data-vigilia-artboard-ratio": "" }}
        describedById={noteId}
        value={matching?.ratio ?? ""}
        options={ratioOptions()}
        onChange={(id) => commitPreset("ratio", id)}
      />
      <ControlSelect
        label={uiCopy.panels.orientation}
        data={{ "data-vigilia-artboard-orientation": "" }}
        describedById={noteId}
        value={matching?.orientation ?? ""}
        options={orientationOptions()}
        onChange={(id) => commitPreset("orientation", id)}
      />
      <ControlSelect
        label={uiCopy.panels.resolution}
        data={{ "data-vigilia-artboard-resolution": "" }}
        describedById={noteId}
        value={matching?.resolution ?? ""}
        options={resolutionOptions()}
        onChange={(id) => commitPreset("resolution", id)}
      />
      {/* The free size fields stay for a size no preset names, and the pair
          marks them W and H because the whole words do not fit beside two boxes
          in a 246px pane. */}
      <ControlPair
        label={uiCopy.panels.size}
        describedById={noteId}
        halves={[
          {
            label: uiCopy.panels.widthMark,
            value: artboard.width,
            data: { "data-vigilia-artboard-width": "" },
            integer: true,
            min: 1,
            max: MAX_ARTBOARD_DIMENSION,
            onCommit: (width) => commitSize(width, artboard.height),
          },
          {
            label: uiCopy.panels.heightMark,
            value: artboard.height,
            data: { "data-vigilia-artboard-height": "" },
            integer: true,
            min: 1,
            max: MAX_ARTBOARD_DIMENSION,
            onCommit: (height) => commitSize(artboard.width, height),
          },
        ]}
      />
      <p
        id={noteId}
        data-vigilia-artboard-note=""
        role="note"
        className="w-full text-xs text-muted"
      >
        {sizeNote(artboard, boxes)}
      </p>
      <ControlSelect
        label={uiCopy.panels.background}
        data={{ "data-vigilia-artboard-background": "" }}
        value={paletteReference(artboard.background)}
        options={paletteOptions(globals)}
        onChange={commitPalette}
      />
      <ControlSelect
        label={uiCopy.panels.backgroundMedia}
        data={{ "data-vigilia-background-asset": "" }}
        value={artboard.backgroundMedia?.assetId ?? ""}
        options={mediaOptions(assets)}
        onChange={commitMedia}
      />
      <ControlSelect
        label={uiCopy.panels.mediaFit}
        data={{ "data-vigilia-background-media-fit": "" }}
        value={artboard.backgroundMedia?.fit ?? "theme"}
        options={fitOptions()}
        onChange={commitFit}
      />
    </div>
  );
}

/** The rule, and the figure when the scene is available to read. Never a count
 *  this panel worked out for itself: `outsideCount` is `scene-fabric`'s, and
 *  every countable object is in it — nothing is excluded since the deliberate
 *  bleed mark went (`docs/decisions/0069`). */
function sizeNote(
  artboard: Artboard,
  boxes: readonly SceneBox[] | undefined,
): string {
  if (boxes === undefined) return uiCopy.panels.artboardSizeNote;
  const { outside, counted } = outsideCount(boxes, artboard);
  return outside === 0
    ? uiCopy.panels.artboardSizeNote
    : uiCopy.panels.artboardOutside(
        uiCopy.panels.artboardSizeNote,
        outside,
        counted,
      );
}

/** A reading, not a choice: an author cannot ask for a size that is not a
 *  preset, and cannot get stuck on one they chose by accident. It is shown
 *  because a document at such a size must say so rather than claim a preset it
 *  is not at. */
const CUSTOM: ControlOption = {
  id: "",
  name: uiCopy.panels.customSize,
  disabled: true,
};

function ratioOptions(): readonly ControlOption[] {
  return [
    ...ARTBOARD_RATIOS.map((entry) => ({ id: entry.id, name: entry.id })),
    CUSTOM,
  ];
}

function orientationOptions(): readonly ControlOption[] {
  return [
    ...ARTBOARD_ORIENTATIONS.map((id) => ({
      id,
      name: uiCopy.artboardOrientations[id],
    })),
    CUSTOM,
  ];
}

function resolutionOptions(): readonly ControlOption[] {
  return [
    ...ARTBOARD_RESOLUTIONS.map((entry) => ({
      id: entry.id,
      name: uiCopy.artboardResolutions[entry.id],
    })),
    CUSTOM,
  ];
}

/** The two boxes the media can fill, both with `cover`. The artboard's own
 *  content fit is a guarantee of the model and not a choice, so this is the only
 *  fit control the panel has.
 *
 *  The list is the model's own, so a mode added there is offered here and a mode
 *  removed there stops being offered — the panel is the third end of the set,
 *  not a copy of it. */
function fitOptions(): readonly ControlOption[] {
  return BACKGROUND_MEDIA_FITS.map((fit) => ({
    id: fit,
    name: uiCopy.fitModes[fit],
  }));
}

/** The palette tokens, plus the blank reading that clears the reference.
 *  `setGlobals` and an edit both redraw, so the list is never a stale copy.
 *  Every token is offered and named by the token owner's one list. */
function paletteOptions(
  globals: Globals | undefined,
): readonly ControlOption[] {
  return [
    { id: "", name: uiCopy.panels.notSet },
    // `Globals` types every group's values as `unknown`; the palette is the one
    // group whose values are `PalettePaint`, which is the cast the inspector's
    // own resolvers already make.
    ...paletteTokenOptions(globals?.palette as FabricPalette | undefined),
  ];
}

/** The declared assets a background can be: an image, an SVG or a video. A font
 *  is not a picture, and the artboard's `none` is the blank reading. */
function mediaOptions(
  assets: readonly AssetReference[],
): readonly ControlOption[] {
  return [
    { id: "", name: uiCopy.panels.none },
    ...assets
      .filter(
        (asset) =>
          asset.kind === "image" ||
          asset.kind === "svg" ||
          asset.kind === "video",
      )
      .map((asset) => ({ id: asset.id, name: asset.id })),
  ];
}

/** A preset id read back from one of the three controls. The Custom entry is
 *  disabled, so a blank id is not a choice an author can make; the fallback
 *  stands for the reading, not for an edit. */
function presetId<T extends string>(id: string, fallback: T): T {
  return id === "" ? fallback : (id as T);
}

/** What the control shows when the document is at a preset, or the nearest one
 *  when it is not — the two other controls' half of a single choice. */
function shown<T extends string>(value: T | undefined, fallback: T): T {
  return value ?? fallback;
}

function paletteReference(value: Artboard["background"]): string {
  return value !== undefined &&
    "ref" in value &&
    value.ref.startsWith("palette.")
    ? value.ref
    : "";
}

/** A value the control offers, or the removal of the reference. A literal — a
 *  hand-edited theme's colour, which is in no option here — survives every edit
 *  of this panel: the control never showed it, so the blank reading cannot be
 *  the author asking for it to go. */
function setPaletteReference(
  artboard: { background?: Artboard["background"] },
  value: string,
  current: Artboard["background"],
): void {
  if (value === "") {
    if (
      current === undefined ||
      ("ref" in current && current.ref.startsWith("palette."))
    )
      delete artboard.background;
    return;
  }
  artboard.background = { ref: value as `palette.${string}` };
}

function isDimension(value: number): boolean {
  return (
    Number.isInteger(value) && value > 0 && value <= MAX_ARTBOARD_DIMENSION
  );
}

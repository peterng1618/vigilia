import {
  type AssetReference,
  BACKGROUND_MEDIA_BOUNDS,
  BACKGROUND_MEDIA_DEFAULTS,
  BACKGROUND_MEDIA_FITS,
  type Background,
  type BackgroundMedia,
  type FabricGlobals,
  MAX_BACKGROUND_SCALE,
  MIN_BACKGROUND_SCALE,
  paletteTokenOptions,
} from "@yunari/renderer-core";
import { uiCopy } from "../ui-copy.js";
import { resolveToken } from "./appearance.js";
import { sectionView } from "./per-kind-column.js";
import type {
  ColumnSectionView,
  FieldOption,
  FieldView,
  PairHalfView,
} from "./view.js";

/**
 * The background's column, as values.
 *
 * The background is a selected subject that is no Fabric object, so it never
 * reaches `perKindColumn`: it answers the same two questions — what it shows,
 * and where its picture sits — and its sections cross the boundary as the same
 * `ColumnSectionView`s, so the column renders them unchanged. Lock is not a
 * question here: the background carries no lock to withhold the rows for.
 */

/** The palette reference the stored colour carries, or `""`. A literal is not a
    token this control offers, so it reads as no colour at all. */
function colourRef(background: Background | undefined): string {
  const colour = background?.color;
  return colour !== undefined &&
    "ref" in colour &&
    colour.ref.startsWith("palette.")
    ? colour.ref
    : "";
}

function colourField(
  background: Background | undefined,
  globals: FabricGlobals | undefined,
): FieldView {
  const ref = colourRef(background);
  return {
    id: "background.color",
    control: "swatch",
    label: uiCopy.panels.background,
    value: ref,
    options: [
      { id: "", name: uiCopy.inspectorFields.notSet },
      ...paletteTokenOptions(globals?.palette),
    ],
    // The picture is the resolved token, never a second resolver: `resolveToken`
    // is the palette's own answer, and a blank reads as nothing painted.
    colour: resolveToken(globals, ref) ?? "transparent",
    data: { "data-yunari-background": "" },
  };
}

/** The declared pictures a background can be, plus the blank reading that
    removes the media. A font is not a picture. */
function mediaOptions(
  assets: readonly AssetReference[],
): readonly FieldOption[] {
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

function mediaField(
  media: BackgroundMedia | undefined,
  assets: readonly AssetReference[],
): FieldView {
  return {
    id: "background.media",
    control: "select",
    label: uiCopy.panels.backgroundMedia,
    value: media?.assetId ?? "",
    options: mediaOptions(assets),
    data: { "data-yunari-background-asset": "" },
  };
}

/** The box the media is clipped to; a background with no media reads the model's
    default box so the row still says what a first picture would fill. */
function boundsField(media: BackgroundMedia | undefined): FieldView {
  return {
    id: "background.bounds",
    control: "select",
    label: uiCopy.panels.backgroundBounds,
    value: media?.bounds ?? "theme",
    options: BACKGROUND_MEDIA_BOUNDS.map((bounds) => ({
      id: bounds,
      name: uiCopy.fitModes[bounds],
    })),
    data: { "data-yunari-background-bounds": "" },
  };
}

function fitField(media: BackgroundMedia | undefined): FieldView {
  return {
    id: "background.fit",
    control: "select",
    label: uiCopy.panels.mediaFit,
    value: media?.fit ?? BACKGROUND_MEDIA_DEFAULTS.fit,
    options: BACKGROUND_MEDIA_FITS.map((fit) => ({
      id: fit,
      name: uiCopy.panels.backgroundFits[fit],
    })),
    data: { "data-yunari-background-fit": "" },
  };
}

/** The scale is stored as a fraction and shown as a percentage, so its bounds
    are the model's own, multiplied to the numbers the field prints. */
function scaleField(media: BackgroundMedia | undefined): FieldView {
  return {
    id: "background.scale",
    control: "number",
    label: uiCopy.panels.backgroundScale,
    value: media?.scale ?? BACKGROUND_MEDIA_DEFAULTS.scale,
    min: MIN_BACKGROUND_SCALE * 100,
    max: MAX_BACKGROUND_SCALE * 100,
    percent: true,
    data: { "data-yunari-background-scale": "" },
  };
}

/** Both offsets on one line. The halves carry no bounds — a half has none — so
    the `-1..1` refusal stays at the write boundary. */
function offsetField(media: BackgroundMedia | undefined): FieldView {
  const halves: readonly PairHalfView[] = [
    {
      id: "background.offsetX",
      label: uiCopy.inspectorFields.x,
      value: media?.offsetX ?? BACKGROUND_MEDIA_DEFAULTS.offsetX,
      percent: true,
      data: { "data-yunari-background-offset-x": "" },
    },
    {
      id: "background.offsetY",
      label: uiCopy.inspectorFields.y,
      value: media?.offsetY ?? BACKGROUND_MEDIA_DEFAULTS.offsetY,
      percent: true,
      data: { "data-yunari-background-offset-y": "" },
    },
  ];
  return {
    id: "background.offsetX-offsetY",
    control: "pair",
    label: uiCopy.panels.backgroundOffset,
    halves,
    data: {},
  };
}

export function backgroundColumn(input: {
  readonly background: Background | undefined;
  readonly assets: readonly AssetReference[];
  readonly globals: FabricGlobals | undefined;
}): readonly ColumnSectionView[] {
  const media = input.background?.media;
  return [
    sectionView("content", [
      colourField(input.background, input.globals),
      mediaField(media, input.assets),
    ]),
    sectionView("position", [
      boundsField(media),
      fitField(media),
      scaleField(media),
      offsetField(media),
    ]),
  ];
}

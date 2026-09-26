import {
  type Artboard,
  type AssetReference,
  formatInstant,
  type Globals,
  instantIn,
  MAX_ARTBOARD_DIMENSION,
  type ThemeMetadata,
} from "@vigilia/renderer-core";
import { linkedPair } from "./editor-shell/controls/linked-pair.js";
import { languageLabel, THEME_LANGUAGES } from "./theme-languages.js";
import { uiCopy } from "./ui-copy.js";

export interface ArtboardPanel {
  readonly root: HTMLElement;
  render(artboard: Artboard, metadata?: ThemeMetadata): void;
  setGlobals(globals: Globals | undefined): void;
  setAssets(assets: readonly AssetReference[]): void;
}

export interface ThemeSettingsOptions {
  readonly assets?: readonly AssetReference[];
  readonly onMetadataChange?: (metadata: ThemeMetadata) => void;
}

/** Product-owned document preview controls; Fabric objects retain their geometry.
    ponytail: the markup is dense rows now, but this stays an imperative panel —
    a React migration is a later step if it grows. */
export function createArtboardPanel(
  host: HTMLElement,
  globals: Globals | undefined,
  onChange: (artboard: Artboard) => void,
  options: ThemeSettingsOptions = {},
): ArtboardPanel {
  const root = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = uiCopy.panels.themeSettings;
  const name = textInput(uiCopy.panels.name, "vigiliaThemeName");
  const author = textInput(uiCopy.panels.author, "vigiliaThemeAuthor");
  const description = textInput(
    uiCopy.panels.description,
    "vigiliaThemeDescription",
  );
  const versionLabel = document.createElement("label");
  versionLabel.textContent = uiCopy.panels.releaseVersion;
  const version = document.createElement("output");
  version.dataset["vigiliaThemeVersion"] = "";
  const languageSample = document.createElement("output");
  languageSample.dataset["vigiliaThemeLanguageSample"] = "";
  const language = selectInput(uiCopy.panels.language, "vigiliaThemeLanguage");
  const fit = selectInput(uiCopy.panels.previewFit, "vigiliaArtboardFitMode");
  for (const fitMode of ["contain", "cover"] as const) {
    const option = document.createElement("option");
    option.value = fitMode;
    option.textContent = fitMode[0]!.toUpperCase() + fitMode.slice(1);
    fit.select.append(option);
  }
  const background = selectInput(
    uiCopy.panels.background,
    "vigiliaArtboardBackground",
  );
  const bars = selectInput(uiCopy.panels.barColour, "vigiliaArtboardBarColor");
  const media = selectInput(
    uiCopy.panels.backgroundMedia,
    "vigiliaBackgroundAsset",
  );
  const mediaFit = selectInput(
    uiCopy.panels.mediaFit,
    "vigiliaBackgroundMediaFit",
  );
  for (const fit of ["cover", "contain"] as const)
    mediaFit.select.append(new Option(fit, fit));
  refreshMediaOptions(media.select, options.assets);
  refreshPaletteOptions(background.select, globals);
  refreshPaletteOptions(bars.select, globals);
  let current: Artboard;
  let currentMetadata: ThemeMetadata | undefined;
  const submitArtboard = (width: number, height: number): void => {
    if (!isDimension(width) || !isDimension(height)) {
      render(current);
      return;
    }
    const next: Artboard = {
      ...current,
      width,
      height,
      fitMode: fit.select.value === "cover" ? "cover" : "contain",
    };
    setPaletteReference(
      next,
      "background",
      background.select.value,
      current.background,
    );
    setPaletteReference(next, "barColor", bars.select.value, current.barColor);
    onChange(
      media.select.value === ""
        ? omitBackgroundMedia(next)
        : {
            ...next,
            backgroundMedia: {
              assetId: media.select.value,
              fit: mediaFit.select.value === "contain" ? "contain" : "cover",
            },
          },
    );
  };
  // The artboard pair is the linked case: it submits one artboard size, so each
  // half carries the other's last accepted value.
  let artboardWidth = 0;
  let artboardHeight = 0;
  const size = linkedPair({
    rowLabel: uiCopy.panels.size,
    first: {
      label: uiCopy.panels.widthMark,
      value: 0,
      data: "vigiliaArtboardWidth",
    },
    second: {
      label: uiCopy.panels.heightMark,
      value: 0,
      data: "vigiliaArtboardHeight",
    },
    min: 1,
    max: MAX_ARTBOARD_DIMENSION,
    onCommitFirst: (width) => {
      artboardWidth = width;
      submitArtboard(artboardWidth, artboardHeight);
    },
    onCommitSecond: (height) => {
      artboardHeight = height;
      submitArtboard(artboardWidth, artboardHeight);
    },
  });
  const rows = [
    size.row,
    fit.row,
    background.row,
    bars.row,
    media.row,
    mediaFit.row,
  ];
  const submitMetadata = (): void => {
    const next = compactMetadata({
      ...currentMetadata,
      name: name.input.value,
      author: author.input.value,
      description: description.input.value,
      locale: language.select.value,
    });
    currentMetadata = next;
    options.onMetadataChange?.(next);
  };
  fit.select.addEventListener("change", submitFromSelects);
  background.select.addEventListener("change", submitFromSelects);
  bars.select.addEventListener("change", submitFromSelects);
  media.select.addEventListener("change", submitFromSelects);
  mediaFit.select.addEventListener("change", submitFromSelects);
  name.input.addEventListener("change", submitMetadata);
  author.input.addEventListener("change", submitMetadata);
  description.input.addEventListener("change", submitMetadata);
  // Registered before submitMetadata so the sample shows the new words in the
  // same turn the metadata is submitted.
  language.select.addEventListener("change", () => {
    refreshLanguageSample(languageSample, language.select.value);
  });
  language.select.addEventListener("change", submitMetadata);
  root.append(
    heading,
    fieldRow(name),
    fieldRow(author),
    fieldRow(description),
    language.row,
    versionLabel,
    version,
    ...rows,
  );
  languageSample.style.gridColumn = "1 / -1";
  language.row.append(languageSample);
  host.append(root);

  /** A select change carries no dimensions, so it re-commits the pair's
      last accepted values. */
  function submitFromSelects(): void {
    submitArtboard(artboardWidth, artboardHeight);
  }

  const render = (
    artboard: Artboard,
    metadata: ThemeMetadata | undefined = currentMetadata,
  ): void => {
    current = artboard;
    currentMetadata = metadata;
    size.setValues(artboard.width, artboard.height);
    artboardWidth = artboard.width;
    artboardHeight = artboard.height;
    fit.select.value = artboard.fitMode ?? "contain";
    background.select.value = paletteReference(artboard.background);
    bars.select.value = paletteReference(artboard.barColor);
    media.select.value = artboard.backgroundMedia?.assetId ?? "";
    mediaFit.select.value = artboard.backgroundMedia?.fit ?? "cover";
    name.input.value = metadata?.name ?? "";
    author.input.value = metadata?.author ?? "";
    description.input.value = metadata?.description ?? "";
    version.value = metadata?.version ?? "";
    refreshLanguageOptions(language.select, metadata?.locale);
    language.select.value = metadata?.locale ?? "en";
    refreshLanguageSample(languageSample, language.select.value);
  };

  return {
    root,
    render,
    setGlobals(nextGlobals) {
      refreshPaletteOptions(background.select, nextGlobals);
      refreshPaletteOptions(bars.select, nextGlobals);
      render(current);
    },
    setAssets(assets) {
      const selected = media.select.value;
      media.select.replaceChildren();
      refreshMediaOptions(media.select, assets);
      media.select.value = selected;
    },
  };
}

function fieldRow(field: {
  readonly label: HTMLLabelElement;
  readonly input: HTMLElement;
}): HTMLElement {
  const row = document.createElement("div");
  row.className = "vigilia-field";
  row.append(field.label, field.input);
  return row;
}

let selectSeq = 0;

function selectInput(
  text: string,
  data: string,
): { readonly row: HTMLElement; readonly select: HTMLSelectElement } {
  const row = document.createElement("div");
  row.className = "vigilia-field";
  const label = document.createElement("label");
  label.textContent = text;
  const select = document.createElement("select");
  select.dataset[data] = "";
  label.htmlFor = select.id = `vigilia-select-${++selectSeq}`;
  row.append(label, select);
  return { row, select };
}

function textInput(
  text: string,
  data:
    | "vigiliaThemeName"
    | "vigiliaThemeAuthor"
    | "vigiliaThemeDescription"
    | "vigiliaThemeVersion",
): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const label = document.createElement("label");
  label.textContent = text;
  const input = document.createElement("input");
  input.dataset[data] = "";
  return { label, input };
}

function compactMetadata(metadata: ThemeMetadata): ThemeMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== ""),
  ) as ThemeMetadata;
}

function refreshMediaOptions(
  select: HTMLSelectElement,
  assets: readonly AssetReference[] | undefined,
): void {
  select.append(new Option(uiCopy.panels.none, ""));
  for (const asset of assets ?? []) {
    if (
      asset.kind === "image" ||
      asset.kind === "svg" ||
      asset.kind === "video"
    )
      select.append(new Option(asset.id, asset.id));
  }
}

function omitBackgroundMedia(artboard: Artboard): Artboard {
  const { backgroundMedia: _backgroundMedia, ...withoutMedia } = artboard;
  return withoutMedia;
}

/**
 * The fifteen curated languages, plus the document's own when it declares one
 * outside them: a hand-edited or store-downloaded theme must not be silently
 * rewritten to English by the panel that displays it.
 */
function refreshLanguageOptions(
  select: HTMLSelectElement,
  declared?: string,
): void {
  select.replaceChildren();
  const tags =
    declared === undefined || THEME_LANGUAGES.includes(declared)
      ? THEME_LANGUAGES
      : [...THEME_LANGUAGES, declared];

  for (const tag of tags) {
    select.append(new Option(languageLabel(tag), tag));
  }
}

/** The words this language actually spells, for the instant a clock would read. */
function refreshLanguageSample(
  sample: HTMLOutputElement,
  locale: string,
): void {
  sample.textContent =
    formatInstant(instantIn(Date.now()), "MMMM dddd", undefined, locale) ?? "";
}

function refreshPaletteOptions(
  select: HTMLSelectElement,
  globals: Globals | undefined,
): void {
  const value = select.value;
  select.replaceChildren();
  const none = document.createElement("option");
  none.value = "";
  none.textContent = uiCopy.panels.notSet;
  select.append(none);
  for (const [id, entry] of Object.entries(globals?.palette ?? {})) {
    const option = document.createElement("option");
    option.value = `palette.${id}`;
    option.textContent = entry.name;
    select.append(option);
  }
  select.value = value;
}

function paletteReference(value: Artboard["background"]): string {
  return value !== undefined &&
    "ref" in value &&
    value.ref.startsWith("palette.")
    ? value.ref
    : "";
}

function setPaletteReference(
  artboard: {
    background?: Artboard["background"];
    barColor?: Artboard["barColor"];
  },
  property: "background" | "barColor",
  value: string,
  current: Artboard["background"],
): void {
  if (value === "") {
    if (
      current === undefined ||
      ("ref" in current && current.ref.startsWith("palette."))
    )
      delete artboard[property];
    return;
  }
  artboard[property] = { ref: value as `palette.${string}` };
}

function isDimension(value: number): boolean {
  return (
    Number.isInteger(value) && value > 0 && value <= MAX_ARTBOARD_DIMENSION
  );
}

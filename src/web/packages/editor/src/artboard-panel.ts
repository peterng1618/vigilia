import {
  type Artboard,
  type AssetReference,
  formatInstant,
  type Globals,
  instantIn,
  MAX_ARTBOARD_DIMENSION,
  type ThemeMetadata,
} from "@vigilia/renderer-core";
import {
  ARTBOARD_ORIENTATIONS,
  ARTBOARD_RATIOS,
  ARTBOARD_RESOLUTIONS,
  artboardPresetFor,
  artboardSize,
  DEFAULT_ARTBOARD_PRESET,
} from "./artboard-presets.js";
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
  const description = textArea(
    uiCopy.panels.description,
    "vigiliaThemeDescription",
  );
  const versionLabel = document.createElement("label");
  versionLabel.textContent = uiCopy.panels.releaseVersion;
  const version = document.createElement("output");
  version.dataset["vigiliaThemeVersion"] = "";
  // `output` is a labelable element, so the same pairing the editable fields
  // use names a value the author reads but never types.
  versionLabel.htmlFor = version.id = `vigilia-output-${++fieldSeq}`;
  const languageSample = document.createElement("output");
  languageSample.dataset["vigiliaThemeLanguageSample"] = "";
  // A status region announces itself, so it needs a name of its own: sharing
  // the control's "Language" would leave two things in the row called Language.
  languageSample.setAttribute("aria-label", uiCopy.panels.languageSample);
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
  /**
   * The three controls choose a size together, so a change to any of them
   * writes a whole derived size through `artboardSize`. The W and H boxes above
   * stay, because an author who wants an exact size no preset names still
   * types one — and then these three read that size as Custom rather than
   * claiming a preset the document is not at.
   */
  const ratio = selectInput(uiCopy.panels.ratio, "vigiliaArtboardRatio");
  const orientation = selectInput(
    uiCopy.panels.orientation,
    "vigiliaArtboardOrientation",
  );
  const resolution = selectInput(
    uiCopy.panels.resolution,
    "vigiliaArtboardResolution",
  );
  for (const entry of ARTBOARD_RATIOS) {
    ratio.select.append(new Option(entry.id, entry.id));
  }
  for (const id of ARTBOARD_ORIENTATIONS) {
    orientation.select.append(new Option(uiCopy.artboardOrientations[id], id));
  }
  for (const entry of ARTBOARD_RESOLUTIONS) {
    resolution.select.append(
      new Option(uiCopy.artboardResolutions[entry.id], entry.id),
    );
  }
  // Disabled, because Custom is a reading of the document and not a size an
  // author can ask for: selectable, it would either do nothing or strand them
  // on a value that derives nothing.
  for (const select of [ratio.select, orientation.select, resolution.select]) {
    const custom = new Option(uiCopy.panels.customSize, "");
    custom.disabled = true;
    select.append(custom);
  }
  /**
   * What a size costs, said once, next to the controls that set one.
   *
   * Every control here writes a size and nothing else: choosing 19.5:9
   * portrait from a 1672 × 941 composition is one click, and it leaves the
   * objects where they were, so a third of a dashboard ends up outside the
   * frame with the artboard still showing where that frame is. The panel owns
   * what a size means, and the scene is not its to read — so it states the
   * rule and no count, which is the one thing here it can say truthfully.
   */
  const sizeNote = document.createElement("p");
  sizeNote.dataset["vigiliaArtboardNote"] = "";
  sizeNote.id = `vigilia-artboard-note-${++fieldSeq}`;
  sizeNote.setAttribute("role", "note");
  sizeNote.textContent = uiCopy.panels.artboardSizeNote;
  // The row is a wrapping flex line, so the note takes a line of its own the
  // way the shell's own error line does. Styled here rather than in the shell
  // stylesheet because the panel is this module's own markup, and this is the
  // idiom `languageSample` already sets from the same file.
  sizeNote.style.cssText =
    "flex-basis:100%;margin:0;color:var(--shell-muted);font-size:12px";
  for (const control of [
    size.first,
    size.second,
    ratio.select,
    orientation.select,
    resolution.select,
  ]) {
    control.setAttribute("aria-describedby", sizeNote.id);
  }
  const rows = [
    size.row,
    ratio.row,
    orientation.row,
    resolution.row,
    fit.row,
    background.row,
    bars.row,
    media.row,
    mediaFit.row,
  ];
  // On the size row, because the width and height boxes are where an author
  // types a size of their own; the row wraps, so it takes a line of its own.
  size.row.append(sizeNote);
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
  ratio.select.addEventListener("change", submitPreset);
  orientation.select.addEventListener("change", submitPreset);
  resolution.select.addEventListener("change", submitPreset);
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
    fieldRow({ label: versionLabel, input: version }),
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

  /** A Custom control is one the document's own size left unset, and choosing
      any of the three means choosing all three — so the ones left Custom take
      the default the chooser opens on rather than leaving a size the controls
      then deny. */
  function submitPreset(): void {
    const chosen = {
      ratio: presetId(ratio.select, DEFAULT_ARTBOARD_PRESET.ratio),
      resolution: presetId(
        resolution.select,
        DEFAULT_ARTBOARD_PRESET.resolution,
      ),
      orientation: presetId(
        orientation.select,
        DEFAULT_ARTBOARD_PRESET.orientation,
      ),
    };
    ratio.select.value = chosen.ratio;
    resolution.select.value = chosen.resolution;
    orientation.select.value = chosen.orientation;
    const derived = artboardSize(
      chosen.ratio,
      chosen.resolution,
      chosen.orientation,
    );
    submitArtboard(derived.width, derived.height);
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
    const matching = artboardPresetFor(artboard);
    ratio.select.value = matching?.ratio ?? "";
    resolution.select.value = matching?.resolution ?? "";
    orientation.select.value = matching?.orientation ?? "";
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

let fieldSeq = 0;

/** A preset id read back from one of the three controls, or the default when
    that control is showing the Custom reading. The options are this module's
    own, so the value is an id it wrote or the empty reading. */
function presetId<T extends string>(select: HTMLSelectElement, fallback: T): T {
  return (select.value === "" ? fallback : select.value) as T;
}

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
  label.htmlFor = select.id = `vigilia-select-${++fieldSeq}`;
  row.append(label, select);
  return { row, select };
}

function textInput(
  text: string,
  data: "vigiliaThemeName" | "vigiliaThemeAuthor",
): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const label = document.createElement("label");
  label.textContent = text;
  const input = document.createElement("input");
  input.dataset[data] = "";
  label.htmlFor = input.id = `vigilia-text-${++fieldSeq}`;
  return { label, input };
}

/** A description is prose, so it is a `textarea` and not a one-line field: the
    starter's own sentence is 130 characters, which a 280px pane's single-line
    input shows the first twenty of. It takes the row's whole width the way the
    size note and the language sample do, because wrapped prose in a 72px label
    column's remaining sliver is still unreadable. */
function textArea(
  text: string,
  data: "vigiliaThemeDescription",
): {
  readonly label: HTMLLabelElement;
  readonly input: HTMLTextAreaElement;
} {
  const label = document.createElement("label");
  label.textContent = text;
  const input = document.createElement("textarea");
  input.dataset[data] = "";
  input.rows = 4;
  label.htmlFor = input.id = `vigilia-text-${++fieldSeq}`;
  label.style.gridColumn = "1 / -1";
  input.style.gridColumn = "1 / -1";
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

import type { ChartFamily } from "../theme/document.js";

/**
 * Which settings each chart family accepts, as editable field descriptors.
 *
 * The **one owner** of that question (AGENTS.md's one-owner rule). It previously had four
 * encodings that nothing related: the settings interfaces in `types.ts` and
 * `charts/*.ts`, the `default*Settings` objects, `validate.ts`'s `KNOWN_KEYS`
 * plus its `validateSettingsRange`, and the JSON schema. The editor had a
 * fifth — none at all, which is why no chart setting was editable despite all
 * four families being fully typed and validated.
 *
 * ## What this declares, and what it deliberately does not
 *
 * Scalar settings only: numbers, booleans and enumerations. **Paint is not
 * here.** `track`, `progress`, `stroke`, `fill`, `area`, `remainderFill` and
 * the two `palette` arrays are all `Fill` — `solid | thresholds | gradient` —
 * and spec 0011 puts colour at the theme level. Persisted chart paint now
 * references palette tokens; its control still needs to author those references
 * and threshold-band offsets without writing literal colours onto a chart.
 *
 * ## Grouping and hints
 *
 * A long list is a navigability problem and navigation is the answer: a field is
 * grouped, never trimmed. Every descriptor answers one **question** — its
 * `section` — and the five questions are ordered in one place,
 * `SETTINGS_SECTIONS`. A chart's own settings answer Content, because they are
 * what the chart shows; paint answers Paint. A `hint` is **required**: it says
 * what the setting does in the author's language, so the label never has to
 * carry the whole meaning, and a descriptor without one does not compile.
 * `advanced` marks a field for the collapsed-and-counted treatment, never for
 * removal.
 *
 * ## It does not restate the defaults
 *
 * A field carries no default value. The `default*Settings` objects already own
 * those and the option builders already apply them, so repeating one here would
 * be a fifth home for a number that is only correct in one place. A field with
 * no authored value shows its placeholder and the renderer's default applies —
 * the same rule the style rows follow.
 *
 * ## The range duplication that is still open
 *
 * `min`/`max` below agree with `validate.ts`'s `validateSettingsRange` and the
 * schema by inspection, not by construction. That function is also **not a
 * `switch`**: it handles gauge/bar, then line, then falls through to a block
 * commented `// Pie.` which runs unconditionally — so a fifth family's settings
 * would be range-checked as a pie. Driving it from this table is the next step
 * and closes both problems at once. Recorded here rather than left to be
 * rediscovered.
 */

/** How a settings field is edited. */
export type SettingsFieldKind = "number" | "boolean" | "select";

/** The question a settings field answers, in the order a surface shows them. */
export type SettingsSection =
  | "content"
  | "position"
  | "layer"
  | "paint"
  | "spends";

export interface SettingsSectionDefinition {
  readonly id: SettingsSection;
  /** The section's name in the author's language. */
  readonly label: string;
}

/**
 * The five questions, ordered — **the one place section order is decided**.
 *
 * Position and Layer stay separate because moving a thing and scaling it are
 * different mistakes (§4). A field's own place inside its section is its order
 * in the family array below, so this list orders the sections and nothing else.
 */
export const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = [
  { id: "content", label: "Content" },
  { id: "position", label: "Position" },
  { id: "layer", label: "Layer" },
  { id: "paint", label: "Paint" },
  { id: "spends", label: "Spends" },
];

export interface SettingsFieldDescriptor {
  /** The key inside the family's settings object. */
  readonly property: string;
  readonly label: string;
  readonly kind: SettingsFieldKind;
  /** The question this field answers; one of `SETTINGS_SECTIONS`. */
  readonly section: SettingsSection;
  /** What the setting does, in the author's language — never its label again. */
  readonly hint: string;
  /** Present when the field belongs behind the collapsed-and-counted treatment. */
  readonly advanced?: true;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** For `select`, the allowed values in the order a picker should list them. */
  readonly options?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}

/** Persisted chart paint settings; token choice is shared across editor surfaces. */
export interface ChartPaintFieldDescriptor {
  readonly property: string;
  readonly label: string;
  /** Paint answers one question; the paint tokens are what ink. */
  readonly section: SettingsSection;
  /** What the setting does, in the author's language — never its label again. */
  readonly hint: string;
  /** Present when the field belongs behind the collapsed-and-counted treatment. */
  readonly advanced?: true;
  /** A palette assigns one token to each existing series slot. */
  readonly multiple?: true;
}

const INTERPOLATION = [
  { value: "linear", label: "Linear" },
  { value: "smooth", label: "Smooth" },
  { value: "step", label: "Step" },
] as const;

const DASH = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
] as const;

const SAMPLING = [
  { value: "none", label: "None" },
  { value: "lttb", label: "LTTB" },
  { value: "average", label: "Average" },
] as const;

const ORIENTATION = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
] as const;

/**
 * Every scalar setting, per family.
 *
 * Keyed by `ChartFamily` as a `Record`, so a fifth family is a compile error
 * until it gains a row — the same mechanism the capability matrix uses.
 *
 * Array order is the likelihood order: the fields an author reaches for most sit
 * first, and it is the order the surface renders. Preserve it; do not re-sort.
 */
export const CHART_SETTINGS_FIELDS: Readonly<
  Record<ChartFamily, readonly SettingsFieldDescriptor[]>
> = {
  gauge: [
    // §85's gauge-arc approximation: angles are degrees, 0 at the right of
    // centre, 90 straight up.
    {
      property: "startAngle",
      label: "Start angle",
      kind: "number",
      section: "content",
      hint: "Where the drawn arc begins, in degrees — 0 points right of centre and 90 straight up.",
      min: -360,
      max: 360,
    },
    {
      property: "endAngle",
      label: "End angle",
      kind: "number",
      section: "content",
      hint: "Where the drawn arc stops; the reading sweeps from the start angle to here.",
      min: -360,
      max: 360,
    },
    {
      property: "min",
      label: "Minimum",
      kind: "number",
      section: "content",
      hint: "The value the arc's start stands for; a lower reading draws as an empty arc.",
    },
    {
      property: "max",
      label: "Maximum",
      kind: "number",
      section: "content",
      hint: "The value a full arc stands for; a higher reading draws full rather than rescaling the sweep.",
    },
    {
      property: "thickness",
      label: "Arc thickness",
      kind: "number",
      section: "content",
      hint: "How wide the ring is drawn, in pixels.",
      min: 0,
    },
    {
      property: "roundCap",
      label: "Rounded ends",
      kind: "boolean",
      section: "content",
      hint: "Rounds the two cut ends of the arc instead of leaving them square.",
    },
    {
      property: "gradientSegments",
      label: "Gradient segments",
      kind: "number",
      section: "content",
      hint: "How finely a gradient arc is approximated. The engine cannot draw a true angular gradient (§85).",
      min: 2,
      max: 256,
    },
  ],
  line: [
    {
      property: "lineWidth",
      label: "Line width",
      kind: "number",
      section: "content",
      hint: "How thick the line is drawn, in pixels.",
      min: 0,
    },
    {
      property: "interpolation",
      label: "Interpolation",
      kind: "select",
      section: "content",
      hint: "How samples are joined: straight segments, a smoothed curve, or steps.",
      options: INTERPOLATION,
    },
    {
      property: "dash",
      label: "Dash",
      kind: "select",
      section: "content",
      hint: "The stroke's own pattern — solid, dashed or dotted.",
      options: DASH,
    },
    {
      property: "showMarkers",
      label: "Show markers",
      kind: "boolean",
      section: "content",
      hint: "Draws a dot on each sample.",
    },
    {
      property: "markerSize",
      label: "Marker size",
      kind: "number",
      section: "content",
      hint: "The diameter of those dots, in pixels.",
      min: 0,
    },
    {
      property: "windowSeconds",
      label: "Visible history (s)",
      kind: "number",
      section: "content",
      hint: "How much history the plot spans. Bounded by the sample store, which keeps 300 s.",
      min: 1,
    },
    {
      property: "maxPoints",
      label: "Max points",
      kind: "number",
      section: "content",
      hint: "The hardest cap on drawn points; older ones are dropped, never interpolated over.",
      min: 2,
    },
    {
      property: "min",
      label: "Y minimum",
      kind: "number",
      section: "content",
      hint: "The value at the bottom of the axis; empty lets the data choose it.",
    },
    {
      property: "max",
      label: "Y maximum",
      kind: "number",
      section: "content",
      hint: "The value at the top of the axis; empty lets the data choose it.",
    },
    {
      property: "showAxes",
      label: "Show axes",
      kind: "boolean",
      section: "content",
      hint: "Draws the time and value axes and their grid.",
    },
    {
      property: "sampling",
      label: "Downsampling",
      kind: "select",
      section: "content",
      hint: "Render-time only. LTTB keeps the visible shape of a dense series at a fraction of the draw cost; it changes what is drawn, never what was measured.",
      options: SAMPLING,
    },
  ],
  bar: [
    {
      property: "orientation",
      label: "Orientation",
      kind: "select",
      section: "content",
      hint: "Whether bars grow sideways from the left or upward from the bottom.",
      options: ORIENTATION,
    },
    {
      property: "min",
      label: "Minimum",
      kind: "number",
      section: "content",
      hint: "The value an empty bar stands for; a lower reading draws empty.",
    },
    {
      property: "max",
      label: "Maximum",
      kind: "number",
      section: "content",
      hint: "The value a full bar stands for; a higher reading draws full rather than rescaling every bar.",
    },
    {
      property: "barWidth",
      label: "Bar width",
      kind: "number",
      section: "content",
      hint: "How thick each bar is, in pixels; empty sizes it to the category.",
      min: 0,
    },
    {
      property: "categoryGapPercent",
      label: "Category gap %",
      kind: "number",
      section: "content",
      hint: "How much of each category slot is left as space between bars.",
      min: 0,
      max: 100,
    },
    {
      property: "cornerRadius",
      label: "Corner radius",
      kind: "number",
      section: "content",
      hint: "How much the bar's own corners are rounded, in pixels.",
      min: 0,
    },
    {
      property: "trackCornerRadius",
      label: "Track corner radius",
      kind: "number",
      section: "content",
      hint: "The unfilled remainder's own rounding, beside the bar's. Empty leaves it square.",
      min: 0,
    },
    {
      property: "showAxes",
      label: "Show axes",
      kind: "boolean",
      section: "content",
      hint: "Draws the value axis with its labels and gridlines.",
    },
    {
      property: "showCategoryLabels",
      label: "Show labels",
      kind: "boolean",
      section: "content",
      hint: "Draws each series' name beside its own bar.",
    },
  ],
  pie: [
    {
      property: "innerRadiusPercent",
      label: "Inner radius %",
      kind: "number",
      section: "content",
      hint: "Zero is a full pie; anything above makes a donut.",
      min: 0,
      max: 100,
    },
    {
      property: "outerRadiusPercent",
      label: "Outer radius %",
      kind: "number",
      section: "content",
      hint: "How far out the ring reaches; 100 fills the available space.",
      min: 0,
      max: 100,
    },
    {
      property: "startAngle",
      label: "Start angle",
      kind: "number",
      section: "content",
      hint: "Where the first slice begins, in degrees — 0 points right of centre and 90 straight up.",
      min: -360,
      max: 360,
    },
    {
      property: "endAngle",
      label: "End angle",
      kind: "number",
      section: "content",
      hint: "Where the ring stops; empty closes it into a full circle.",
      min: -360,
      max: 360,
    },
    {
      property: "padAngle",
      label: "Slice gap",
      kind: "number",
      section: "content",
      hint: "The gap left between neighbouring slices, in degrees.",
      min: 0,
    },
    {
      property: "cornerRadius",
      label: "Corner radius",
      kind: "number",
      section: "content",
      hint: "How much each slice's outer corners are rounded, in pixels.",
      min: 0,
    },
    {
      property: "showLabels",
      label: "Show labels",
      kind: "boolean",
      section: "content",
      hint: "Draws each slice's name and its leader line.",
    },
  ],
};

/** The editable scalar settings for one family. */
export function settingsFieldsFor(
  family: ChartFamily,
): readonly SettingsFieldDescriptor[] {
  return CHART_SETTINGS_FIELDS[family];
}

export const CHART_PAINT_FIELDS: Readonly<
  Record<ChartFamily, readonly ChartPaintFieldDescriptor[]>
> = {
  gauge: [
    {
      property: "track",
      label: "Track paint",
      section: "paint",
      hint: "The unfilled ring the reading is drawn over.",
    },
    {
      property: "progress",
      label: "Progress paint",
      section: "paint",
      hint: "The arc that fills to show the reading.",
    },
  ],
  line: [
    {
      property: "stroke",
      label: "Stroke paint",
      section: "paint",
      hint: "The line's own colour, and the fallback for a series the palette does not cover.",
    },
    {
      property: "palette",
      label: "Series paint",
      section: "paint",
      hint: "One colour per series, cycled when there are more series than entries.",
      multiple: true,
    },
    {
      property: "area",
      label: "Area paint",
      section: "paint",
      hint: "The fill between the line and the axis; drawn for the first series only.",
    },
  ],
  bar: [
    {
      property: "fill",
      label: "Fill paint",
      section: "paint",
      hint: "The ink each bar is drawn in.",
    },
    {
      property: "track",
      label: "Track paint",
      section: "paint",
      hint: "The unfilled slot behind each bar; giving one turns the bars into progress bars.",
    },
  ],
  pie: [
    {
      property: "remainderFill",
      label: "Remainder paint",
      section: "paint",
      hint: "The slice standing for the part of a fixed total no sensor accounts for.",
    },
    {
      property: "palette",
      label: "Slice paint",
      section: "paint",
      hint: "One colour per slice, cycled when there are more slices than entries.",
      multiple: true,
    },
  ],
};

export function chartPaintFieldsFor(
  family: ChartFamily,
): readonly ChartPaintFieldDescriptor[] {
  return CHART_PAINT_FIELDS[family];
}

/**
 * The settings key a family's settings live under, e.g. `gaugeSettings`.
 *
 * Derived rather than listed, because `validate.ts` already derives the same
 * string the same way (`` `${family}Settings` ``) — two spellings of one
 * convention is how a rename breaks half a feature.
 */
export function settingsKeyFor(family: ChartFamily): string {
  return `${family}Settings`;
}

/**
 * Settings that exist in the types but are **not** editable here, and why.
 *
 * Exported so a test can assert this list and the editable list together
 * account for every property of each settings interface — otherwise a new
 * setting is simply invisible, which is the state every chart setting was in
 * before this file existed.
 */
export const NON_SCALAR_SETTINGS: Readonly<
  Record<ChartFamily, readonly string[]>
> = {
  // `Fill` values and animation: theme-level colour (D3) and a separate shape.
  gauge: ["track", "progress", "animation"],
  line: ["stroke", "palette", "area", "animation"],
  bar: ["fill", "track", "animation"],
  pie: ["remainderFill", "palette", "total", "animation"],
};

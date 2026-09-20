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

export interface SettingsFieldDescriptor {
  /** The key inside the family's settings object. */
  readonly property: string;
  readonly label: string;
  readonly kind: SettingsFieldKind;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** For `select`, the allowed values in the order a picker should list them. */
  readonly options?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  /** Shown when the field needs explaining more than its label allows. */
  readonly hint?: string;
}

/** Persisted chart paint settings; token choice is shared across editor surfaces. */
export interface ChartPaintFieldDescriptor {
  readonly property: string;
  readonly label: string;
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
      min: -360,
      max: 360,
    },
    {
      property: "endAngle",
      label: "End angle",
      kind: "number",
      min: -360,
      max: 360,
    },
    { property: "min", label: "Minimum", kind: "number" },
    { property: "max", label: "Maximum", kind: "number" },
    { property: "thickness", label: "Arc thickness", kind: "number", min: 0 },
    { property: "roundCap", label: "Rounded ends", kind: "boolean" },
    {
      property: "gradientSegments",
      label: "Gradient segments",
      kind: "number",
      min: 2,
      max: 256,
      hint: "How finely a gradient arc is approximated. The engine cannot draw a true angular gradient (§85).",
    },
  ],
  line: [
    { property: "lineWidth", label: "Line width", kind: "number", min: 0 },
    {
      property: "interpolation",
      label: "Interpolation",
      kind: "select",
      options: INTERPOLATION,
    },
    { property: "dash", label: "Dash", kind: "select", options: DASH },
    { property: "showMarkers", label: "Show markers", kind: "boolean" },
    { property: "markerSize", label: "Marker size", kind: "number", min: 0 },
    {
      property: "windowSeconds",
      label: "Visible history (s)",
      kind: "number",
      min: 1,
      hint: "How much history the plot spans. Bounded by the sample store, which keeps 300 s.",
    },
    { property: "maxPoints", label: "Max points", kind: "number", min: 2 },
    { property: "min", label: "Y minimum", kind: "number" },
    { property: "max", label: "Y maximum", kind: "number" },
    { property: "showAxes", label: "Show axes", kind: "boolean" },
    {
      property: "sampling",
      label: "Downsampling",
      kind: "select",
      options: SAMPLING,
      hint: "Render-time only. LTTB keeps the visible shape of a dense series at a fraction of the draw cost; it changes what is drawn, never what was measured.",
    },
  ],
  bar: [
    {
      property: "orientation",
      label: "Orientation",
      kind: "select",
      options: ORIENTATION,
    },
    { property: "min", label: "Minimum", kind: "number" },
    { property: "max", label: "Maximum", kind: "number" },
    { property: "barWidth", label: "Bar width", kind: "number", min: 0 },
    {
      property: "categoryGapPercent",
      label: "Category gap %",
      kind: "number",
      min: 0,
      max: 100,
    },
    {
      property: "cornerRadius",
      label: "Corner radius",
      kind: "number",
      min: 0,
    },
    { property: "showAxes", label: "Show axes", kind: "boolean" },
    { property: "showCategoryLabels", label: "Show labels", kind: "boolean" },
  ],
  pie: [
    {
      property: "innerRadiusPercent",
      label: "Inner radius %",
      kind: "number",
      min: 0,
      max: 100,
      hint: "Zero is a full pie; anything above makes a donut.",
    },
    {
      property: "outerRadiusPercent",
      label: "Outer radius %",
      kind: "number",
      min: 0,
      max: 100,
    },
    {
      property: "startAngle",
      label: "Start angle",
      kind: "number",
      min: -360,
      max: 360,
    },
    {
      property: "endAngle",
      label: "End angle",
      kind: "number",
      min: -360,
      max: 360,
    },
    { property: "padAngle", label: "Slice gap", kind: "number", min: 0 },
    {
      property: "cornerRadius",
      label: "Corner radius",
      kind: "number",
      min: 0,
    },
    { property: "showLabels", label: "Show labels", kind: "boolean" },
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
    { property: "track", label: "Track paint" },
    { property: "progress", label: "Progress paint" },
  ],
  line: [
    { property: "stroke", label: "Stroke paint" },
    { property: "palette", label: "Series paint", multiple: true },
    { property: "area", label: "Area paint" },
  ],
  bar: [
    { property: "fill", label: "Fill paint" },
    { property: "track", label: "Track paint" },
  ],
  pie: [
    { property: "remainderFill", label: "Remainder paint" },
    { property: "palette", label: "Slice paint", multiple: true },
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

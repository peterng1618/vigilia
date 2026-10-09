import {
  type Binding,
  type ChartContent,
  type ChartFamily,
  chartPaintFieldsFor,
  type FabricPalette,
  readSetting,
  SEMANTIC_KEYS,
  settingsFieldsFor,
} from "@vigilia/renderer-core";
import { isSettingVisible } from "../editor-shell/controls/settings-field.js";
import { uiCopy } from "../ui-copy.js";
import type {
  ChartAspectView,
  ChartContentFieldsView,
  ChartOptionView,
  ChartPaintFieldsView,
  ChartPaintRowView,
  ChartSeriesFieldsView,
  ChartSeriesRowView,
  ChartSettingView,
} from "./chart-fields.js";

/**
 * A chart's own fields, as the values the React column renders.
 *
 * The chart manager owns the chart — which one is selected, its settings, its
 * bindings — and this module owns only the reading that turns those into
 * controls' inputs. It builds no DOM and writes nothing: `chart-fields.tsx`
 * renders these values through plan 1's control set and calls back into the
 * manager's `ChartEdits`.
 *
 * Ids and datasets are what they were when the panel rendered these controls
 * into a Data tab, so every spec, screenshot and driver selector that addressed
 * `vigilia-chart-setting-*`, `vigilia-chart-binding-*` and
 * `vigilia-chart-paint-*` still addresses the same control.
 */

/** Everything the controls read, gathered by the owner so the column restates
    none of it: the family and settings off the object, the bindings off the
    envelope, and the ratio read off the object's own shape. */
export interface ChartFieldTarget {
  readonly id: string;
  readonly content: ChartContent;
  readonly bindings: readonly Binding[];
  readonly aspect?: number;
}

/**
 * How many readings a family draws, per `buildChartPlan`: a line series, a bar
 * and a slice are one binding each, and a gauge reads `bindings[0]` and nothing
 * else. So the gauge's second binding would be a control that accepts an edit
 * and applies none.
 */
const MAX_BINDINGS: Readonly<Record<ChartFamily, number>> = {
  gauge: 1,
  line: Number.POSITIVE_INFINITY,
  bar: Number.POSITIVE_INFINITY,
  pie: Number.POSITIVE_INFINITY,
};

/** The ratios the line-chart control group offers, widest last. It lives here
    because this is the group that offers them; `index.ts` reads it to decide
    which one a chart is at, rather than listing the three a second time. */
export const ASPECT_RATIOS: readonly number[] = [2, 3, 4];

/** The unit-display choices, from the one table that owns those words. */
const UNIT_OPTIONS: readonly ChartOptionView[] = Object.entries(
  uiCopy.unitDisplayOptions,
).map(([id, name]) => ({ id, name }));

function semanticKeyOptions(): readonly ChartOptionView[] {
  return SEMANTIC_KEYS.map((descriptor) => ({
    id: descriptor.key,
    name: descriptor.label,
  }));
}

/**
 * The ratio group, for the one family that has one.
 *
 * Read off the object rather than remembered from the last click, so a chart the
 * author dragged is described by its own shape. A ratio the chart is not at
 * leaves the group with nothing pressed rather than lighting up a neighbour.
 */
function aspectView(target: ChartFieldTarget): ChartAspectView {
  return {
    id: "vigilia-chart-aspect",
    label: "Aspect ratio",
    value: target.aspect === undefined ? "" : String(target.aspect),
    options: ASPECT_RATIOS.map((ratio) => ({
      id: String(ratio),
      name: `${ratio}:1`,
    })),
  };
}

function seriesRow(
  binding: Binding,
  moreThanOne: boolean,
): ChartSeriesRowView {
  // The series' own key is offered even when no descriptor declares it: a
  // document can name one the table no longer has, and a picker that dropped it
  // would show the series as reading nothing.
  const keys = new Set([
    binding.semanticKey,
    ...SEMANTIC_KEYS.map((descriptor) => descriptor.key),
  ]);
  return {
    binding,
    keyOptions: [...keys].map((key) => ({
      id: key,
      name: SEMANTIC_KEYS.find((descriptor) => descriptor.key === key)?.label ??
        key,
    })),
    removable: moreThanOne,
  };
}

function seriesFields(target: ChartFieldTarget): ChartSeriesFieldsView {
  const { bindings, content } = target;
  const full = bindings.length >= MAX_BINDINGS[content.family];
  return {
    id: "vigilia-chart-series",
    label: uiCopy.inspectorFields.runSeries,
    // The prompt is the chooser's own first entry, as it was when this was a
    // `<select>`: the value is consumed by the click that makes it, so the
    // control always shows what it is for rather than the series it just added.
    options: [
      { id: "", name: uiCopy.inspectorFields.runSeries },
      ...semanticKeyOptions(),
    ],
    refused: full,
    ...(full
      ? { full: uiCopy.inspectorFields.runSeriesFull(content.family) }
      : {}),
    unitOptions: UNIT_OPTIONS,
    rows: bindings.map((binding) => seriesRow(binding, bindings.length > 1)),
  };
}

/**
 * The family's settings, one row per descriptor the author can see here.
 *
 * A `visibleWhen` that does not match is not a question in this state, so it
 * renders nothing — unlike a refused field, which renders and says why.
 */
function settingRows(content: ChartContent): readonly ChartSettingView[] {
  const rows: ChartSettingView[] = [];

  for (const field of settingsFieldsFor(content.family)) {
    if (!isSettingVisible(field, content.settings)) continue;
    // A nested setting commits through its own `path`: a flat
    // `{...settings, [property]: value}` writes a key the validator accepts and
    // the renderer never reads, so the author's choice survives the click and
    // dies on reopen.
    const path = field.path ?? [field.property];
    const value = readSetting(content.settings, path);
    const id = `vigilia-chart-setting-${field.property}`;

    if (field.kind === "number") {
      rows.push({
        id,
        key: field.property,
        label: field.label,
        path,
        control: "number",
        // Absent is an empty box, never a zero: "empty lets the data choose it"
        // is what the descriptor's `optional` promises.
        value:
          typeof value === "number" && Number.isFinite(value)
            ? value
            : undefined,
        ...(field.min === undefined ? {} : { min: field.min }),
        ...(field.max === undefined ? {} : { max: field.max }),
        clearable: field.optional === true,
      });
      continue;
    }

    if (field.kind === "boolean") {
      rows.push({
        id,
        key: field.property,
        label: field.label,
        path,
        control: "toggle",
        value: value === true,
      });
      continue;
    }

    rows.push({
      id,
      key: field.property,
      label: field.label,
      path,
      control: "select",
      value: typeof value === "string" ? value : "",
      options: (field.options ?? []).map(optionView),
      clearable: field.optional === true,
    });
  }

  return rows;
}

function optionView(option: {
  readonly value: string;
  readonly label: string;
}): ChartOptionView {
  return { id: option.value, name: option.label };
}

/** What the chart shows: its family's settings, and the series it reads. */
export function chartContentView(
  target: ChartFieldTarget,
): ChartContentFieldsView {
  return {
    chartId: target.id,
    content: target.content,
    ...(target.content.family === "line" ? { aspect: aspectView(target) } : {}),
    series: seriesFields(target),
    rows: settingRows(target.content),
  };
}

/** One paint reference as a control: its label, its token, and the tokens it
    may name. A `multiple` field names its slices `palette.0`, `palette.1`, so
    the key carries the index — one control per slice, each with its own label. */
function paintRow(
  property: string,
  label: string,
  index: number | undefined,
  value: unknown,
  options: readonly ChartOptionView[],
): ChartPaintRowView {
  const key = index === undefined ? property : `${property}.${index}`;
  const ref = isPaletteReference(value) ? value.ref : "";
  return {
    id: `vigilia-chart-paint-${key.replaceAll(".", "-")}`,
    key,
    label: index === undefined ? label : `${label} ${index + 1}`,
    property,
    ...(index === undefined ? {} : { index }),
    ref,
    options,
    // A reference that is not a palette token has no valid choice to change it
    // to, and so has a palette that offers none: the row shows where the paint
    // is rather than accepting an edit that would write a token choice nobody
    // made.
    refused: ref === "" || options.length === 0,
  };
}

/** What ink: the family's own paint fields, one control per reference. */
export function chartPaintView(
  target: ChartFieldTarget,
  palette: FabricPalette | undefined,
): ChartPaintFieldsView {
  const { content } = target;
  const options: readonly ChartOptionView[] = Object.entries(
    palette ?? {},
  ).map(([tokenId, entry]) => ({ id: `palette.${tokenId}`, name: entry.name }));
  const settings = content.settings as unknown as Record<string, unknown>;
  const rows: ChartPaintRowView[] = [];

  for (const field of chartPaintFieldsFor(content.family)) {
    const value = settings[field.property];
    if (field.multiple === true && Array.isArray(value)) {
      value.forEach((paint, index) => {
        rows.push(
          paintRow(field.property, field.label, index, paint, options),
        );
      });
      continue;
    }
    if (!Array.isArray(value) && value !== undefined) {
      rows.push(
        paintRow(field.property, field.label, undefined, value, options),
      );
    }
  }

  return { chartId: target.id, content, rows };
}

function isPaletteReference(value: unknown): value is { readonly ref: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)["ref"] === "string"
  );
}

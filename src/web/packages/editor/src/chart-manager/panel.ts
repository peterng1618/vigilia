import {
  type Binding,
  type ChartContent,
  type ChartFamily,
  chartPaintFieldsFor,
  type FabricPalette,
  readSetting,
  removeSetting,
  SEMANTIC_KEYS,
  settingsFieldsFor,
  writeSetting,
} from "@vigilia/renderer-core";
import {
  isSettingVisible,
  settingsField,
} from "../editor-shell/controls/settings-field.js";
import { uiCopy } from "../ui-copy.js";

/**
 * The chart's own fields, as two bodies the per-kind column mounts.
 *
 * The chart manager owns the chart — which one is selected, its settings, its
 * bindings — and this module owns only the controls. `ChartFieldsPort` is what
 * the column asks for them with: a body per question, built fresh on every
 * render, so the section's count is the number of controls it actually holds.
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

/** The writes the chart owner accepts. Nothing here writes anything itself. */
export interface ChartFieldHandlers {
  readonly onSettings: (id: string, settings: ChartContent["settings"]) => void;
  readonly onBinding: (id: string, binding: Binding) => void;
  readonly onAspect: (id: string, ratio: number) => void;
  readonly onAddBinding: (id: string, semanticKey: string) => void;
  readonly onRemoveBinding: (id: string, bindingId: string) => void;
}

/**
 * What a chart's column asks its owner for. Two bodies, because a chart answers
 * Content (what it shows) and Paint (what ink) with different questions.
 */
export interface ChartFieldsPort {
  content(
    target: ChartFieldTarget,
    palette: FabricPalette | undefined,
  ): readonly HTMLElement[];
  paint(
    target: ChartFieldTarget,
    palette: FabricPalette | undefined,
  ): readonly HTMLElement[];
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

export function createChartFieldsPort(
  handlers: ChartFieldHandlers,
): ChartFieldsPort {
  return {
    content: (target, palette) => chartContentFields(target, palette, handlers),
    paint: (target, palette) => chartPaintFields(target, palette, handlers),
  };
}

/** What the chart shows: its family's settings, and the series it reads. */
export function chartContentFields(
  target: ChartFieldTarget,
  palette: FabricPalette | undefined,
  handlers: ChartFieldHandlers,
): readonly HTMLElement[] {
  const { id, content } = target;
  const body: HTMLElement[] = [];

  if (content.family === "line") {
    const aspect = document.createElement("section");
    aspect.append("Aspect ratio ");
    for (const ratio of [2, 3, 4]) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset["vigiliaChartAspect"] = String(ratio);
      button.textContent = `${ratio}:1`;
      // Three buttons that looked alike left no way to tell 2:1 from 3:1
      // after the click. `aria-pressed` is what the rest of the shell's
      // toggles already carry, so it states the active ratio to assistive
      // technology and to the eye through the same attribute.
      button.setAttribute("aria-pressed", String(target.aspect === ratio));
      button.addEventListener("click", () => handlers.onAspect(id, ratio));
      aspect.append(button);
    }
    body.push(aspect);
  }

  /**
   * The control that declares the *first* binding, which is what a chart
   * arrives without. A chooser of keys rather than a button: a binding
   * cannot exist without the key it names, so asking for both at once
   * removes the state where a chart holds one the panel would then have to
   * refuse or repair.
   */
  const series = uiCopy.inspectorFields.runSeries;
  const seriesLabel = document.createElement("label");
  const add = document.createElement("select");
  add.dataset["vigiliaChartBindingAdd"] = "";
  const prompt = document.createElement("option");
  prompt.value = "";
  prompt.textContent = series;
  add.append(prompt);
  for (const descriptor of SEMANTIC_KEYS) {
    const option = document.createElement("option");
    option.value = descriptor.key;
    option.textContent = descriptor.label;
    add.append(option);
  }
  add.addEventListener("change", () => {
    const key = add.value;
    // Reset first: a chooser that held its choice would create a second
    // series on every re-render of the fields.
    add.value = "";
    if (key !== "") handlers.onAddBinding(id, key);
  });
  seriesLabel.textContent = series;
  seriesLabel.htmlFor = add.id = "vigilia-chart-series";
  const full = target.bindings.length >= MAX_BINDINGS[content.family];
  add.disabled = full;
  body.push(seriesLabel, add);
  if (full) {
    const note = document.createElement("p");
    note.className = "vigilia-run-note";
    note.dataset["vigiliaChartBindingFull"] = "";
    note.textContent = uiCopy.inspectorFields.runSeriesFull(content.family);
    body.push(note);
  }

  for (const binding of target.bindings) {
    const label = document.createElement("label");
    label.textContent = `Binding: ${binding.id}`;
    const select = document.createElement("select");
    label.htmlFor = select.id = `vigilia-chart-binding-${binding.id}`;
    select.dataset["vigiliaBinding"] = binding.id;
    const keys = new Set([
      binding.semanticKey,
      ...SEMANTIC_KEYS.map((descriptor) => descriptor.key),
    ]);
    for (const key of keys) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent =
        SEMANTIC_KEYS.find((descriptor) => descriptor.key === key)?.label ??
        key;
      select.append(option);
    }
    select.value = binding.semanticKey;
    select.addEventListener("change", () =>
      handlers.onBinding(id, { ...binding, semanticKey: select.value }),
    );
    body.push(
      label,
      select,
      ...removeBindingControl(
        binding,
        (bindingId) => handlers.onRemoveBinding(id, bindingId),
        target.bindings.length > 1,
      ),
      ...bindingNumber(
        binding.id,
        "precision",
        "Precision",
        binding.precision,
        0,
        6,
        (precision) =>
          handlers.onBinding(id, without(binding, "precision", precision)),
      ),
      ...unitDisplay(binding, (unitDisplay) =>
        handlers.onBinding(id, without(binding, "unitDisplay", unitDisplay)),
      ),
      ...bindingNumber(
        binding.id,
        "scale",
        "Scale",
        binding.scale,
        undefined,
        undefined,
        (scale) => handlers.onBinding(id, without(binding, "scale", scale)),
      ),
      ...bindingNumber(
        binding.id,
        "offset",
        "Offset",
        binding.offset,
        undefined,
        undefined,
        (offset) => handlers.onBinding(id, without(binding, "offset", offset)),
      ),
    );
  }

  for (const field of settingsFieldsFor(content.family)) {
    // A `visibleWhen` that does not match is not a question in this state,
    // so it renders nothing — unlike a refused field, which renders and
    // says why.
    if (!isSettingVisible(field, content.settings)) continue;
    const path = field.path ?? [field.property];
    body.push(
      settingsField(field, {
        value: readSetting(content.settings, path),
        // A nested setting commits through its own `path`: a flat
        // `{...settings, [property]: value}` writes a key the validator
        // accepts and the renderer never reads, so the author's choice
        // survives the click and dies on reopen.
        onChange: (next) =>
          handlers.onSettings(id, commitSetting(content.settings, path, next)),
      }),
    );
  }

  return body;
}

/** What ink: the family's own paint fields, one control per reference. */
export function chartPaintFields(
  target: ChartFieldTarget,
  palette: FabricPalette | undefined,
  handlers: ChartFieldHandlers,
): readonly HTMLElement[] {
  const { id, content } = target;
  const body: HTMLElement[] = [];
  for (const field of chartPaintFieldsFor(content.family)) {
    const value = (content.settings as unknown as Record<string, unknown>)[
      field.property
    ];
    if (field.multiple && Array.isArray(value)) {
      value.forEach((paint, index) =>
        body.push(
          ...paintPicker(
            `${field.label} ${index + 1}`,
            `${field.property}.${index}`,
            paint,
            palette,
            (ref) =>
              handlers.onSettings(id, {
                ...content.settings,
                [field.property]: value.map((entry, item) =>
                  item === index ? { ref } : entry,
                ),
              } as ChartContent["settings"]),
          ),
        ),
      );
    } else if (!Array.isArray(value) && value !== undefined) {
      body.push(
        ...paintPicker(field.label, field.property, value, palette, (ref) =>
          handlers.onSettings(id, {
            ...content.settings,
            [field.property]: { ref },
          } as ChartContent["settings"]),
        ),
      );
    }
  }
  return body;
}

/**
 * Removes one series. Withheld on the last binding for the reason the add
 * control is disabled at the gauge's limit: a chart with nothing bound draws
 * its frame and no data, and a control that reaches that state is a control
 * that can empty a card.
 */
function removeBindingControl(
  binding: Binding,
  onRemove: (id: string) => void,
  moreThanOne: boolean,
): readonly HTMLElement[] {
  if (!moreThanOne) return [];
  const button = document.createElement("button");
  button.type = "button";
  button.dataset["vigiliaChartBindingRemove"] = binding.id;
  button.textContent = uiCopy.inspectorFields.removeSeries(binding.semanticKey);
  button.addEventListener("click", () => onRemove(binding.id));
  return [button];
}

function paintPicker(
  labelText: string,
  key: string,
  value: unknown,
  palette: FabricPalette | undefined,
  onChange: (ref: string) => void,
): readonly [HTMLLabelElement, HTMLSelectElement] {
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  // A `multiple` paint row names its slices `palette.0`, `palette.1`, so the id
  // carries the index — a control per slice, each with its own label.
  label.htmlFor = select.id = `vigilia-chart-paint-${key.replaceAll(".", "-")}`;
  select.dataset["vigiliaChartPaint"] = key;
  const current = isPaletteReference(value) ? value.ref : "";
  for (const [id, entry] of Object.entries(palette ?? {})) {
    const option = document.createElement("option");
    option.value = `palette.${id}`;
    option.textContent = entry.name;
    select.append(option);
  }
  select.value = current;
  select.disabled = current === "" || select.options.length === 0;
  select.addEventListener("change", () => onChange(select.value));
  return [label, select];
}

function isPaletteReference(value: unknown): value is { readonly ref: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)["ref"] === "string"
  );
}

function bindingNumber(
  bindingId: string,
  property: "precision" | "scale" | "offset",
  labelText: string,
  value: number | undefined,
  min: number | undefined,
  max: number | undefined,
  onChange: (value: number | undefined) => void,
): readonly [HTMLLabelElement, HTMLInputElement] {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  label.htmlFor = input.id = `vigilia-chart-binding-${bindingId}-${property}`;
  input.dataset["vigiliaBindingField"] = `${bindingId}.${property}`;
  input.type = "number";
  input.value = value === undefined ? "" : String(value);
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  input.addEventListener("change", () => {
    if (input.value === "") {
      onChange(undefined);
      return;
    }
    const next = Number(input.value);
    if (
      !Number.isFinite(next) ||
      (min !== undefined && next < min) ||
      (max !== undefined && next > max) ||
      (labelText === "Precision" && !Number.isInteger(next))
    ) {
      input.value = value === undefined ? "" : String(value);
      return;
    }
    onChange(next);
  });
  return [label, input];
}

function unitDisplay(
  binding: Binding,
  onChange: (value: Binding["unitDisplay"]) => void,
): readonly [HTMLLabelElement, HTMLSelectElement] {
  const label = document.createElement("label");
  label.textContent = uiCopy.panels.unitDisplay;
  const select = document.createElement("select");
  label.htmlFor =
    select.id = `vigilia-chart-binding-${binding.id}-unit-display`;
  select.dataset["vigiliaBindingField"] = `${binding.id}.unitDisplay`;
  for (const [value, text] of Object.entries(uiCopy.unitDisplayOptions)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  select.value = binding.unitDisplay ?? "";
  select.addEventListener("change", () =>
    onChange(
      select.value === ""
        ? undefined
        : (select.value as Binding["unitDisplay"]),
    ),
  );
  return [label, select];
}

function without<K extends keyof Binding>(
  binding: Binding,
  key: K,
  value: Binding[K] | undefined,
): Binding {
  if (value === undefined) {
    const { [key]: _removed, ...rest } = binding;
    return rest as Binding;
  }
  return { ...binding, [key]: value } as Binding;
}

/**
 * One committed setting, at the path its descriptor declares.
 *
 * `undefined` is the absent state, not a value: the field is one the settings
 * interface declares optional, so the key goes and the renderer decides again.
 */
function commitSetting(
  settings: ChartContent["settings"],
  path: readonly string[],
  value: unknown,
): ChartContent["settings"] {
  return value === undefined
    ? removeSetting(settings, path)
    : writeSetting(settings, path, value);
}

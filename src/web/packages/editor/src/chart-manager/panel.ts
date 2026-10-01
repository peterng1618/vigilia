import {
  type Binding,
  type ChartContent,
  type ChartFamily,
  chartPaintFieldsFor,
  type FabricPalette,
  SEMANTIC_KEYS,
  settingsFieldsFor,
} from "@vigilia/renderer-core";
import { uiCopy } from "../ui-copy.js";

export interface ChartPropertyPanel {
  readonly root: HTMLElement;
  render(
    chart:
      | {
          readonly id: string;
          readonly content: ChartContent;
          readonly bindings: readonly Binding[];
          /**
           * The ratio this chart is at, or `undefined` when it is at none the
           * control group offers — a chart dragged to an arbitrary shape names
           * no button rather than lighting up whichever is nearest. Read from
           * the chart rather than remembered from the last click, so it is
           * right after a drag too.
           */
          readonly aspect?: number;
        }
      | undefined,
    palette?: FabricPalette,
  ): void;
}

/**
 * How many readings a family draws, per `buildChartPlan`: a line series, a bar
 * and a slice are one binding each, and a gauge reads `bindings[0]` and nothing
 * else. So the gauge's second binding would be a control that accepts an edit
 * and applies none — the outcome `panel.ts`'s own doc comment rules out.
 */
const MAX_BINDINGS: Readonly<Record<ChartFamily, number>> = {
  gauge: 1,
  line: Number.POSITIVE_INFINITY,
  bar: Number.POSITIVE_INFINITY,
  pie: Number.POSITIVE_INFINITY,
};

export function createChartPropertyPanel(
  host: HTMLElement,
  onChange: (id: string, settings: ChartContent["settings"]) => void,
  onBindingChange: (id: string, binding: Binding) => void,
  onAspectChange: (id: string, ratio: number) => void,
  onAddBinding: (id: string, semanticKey: string) => void,
  onRemoveBinding: (id: string, bindingId: string) => void,
): ChartPropertyPanel {
  const root = document.createElement("section");
  host.prepend(root);

  return {
    root,
    render(chart, palette) {
      root.replaceChildren();
      if (chart === undefined) {
        root.textContent = uiCopy.panels.selectChart;
        return;
      }
      const heading = document.createElement("h2");
      heading.textContent = `${chart.content.family} chart`;
      root.append(heading);
      if (chart.content.family === "line") {
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
          button.setAttribute("aria-pressed", String(chart.aspect === ratio));
          button.addEventListener("click", () =>
            onAspectChange(chart.id, ratio),
          );
          aspect.append(button);
        }
        root.append(aspect);
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
        // series on every re-render of the panel.
        add.value = "";
        if (key !== "") onAddBinding(chart.id, key);
      });
      seriesLabel.textContent = series;
      seriesLabel.htmlFor = add.id = "vigilia-chart-series";
      const full = chart.bindings.length >= MAX_BINDINGS[chart.content.family];
      add.disabled = full;
      root.append(seriesLabel, add);
      if (full) {
        const note = document.createElement("p");
        note.className = "vigilia-run-note";
        note.dataset["vigiliaChartBindingFull"] = "";
        note.textContent = uiCopy.inspectorFields.runSeriesFull(
          chart.content.family,
        );
        root.append(note);
      }

      for (const binding of chart.bindings) {
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
          onBindingChange(chart.id, { ...binding, semanticKey: select.value }),
        );
        root.append(
          label,
          select,
          ...removeBindingControl(
            binding,
            (id) => onRemoveBinding(chart.id, id),
            chart.bindings.length > 1,
          ),
          ...bindingNumber(
            binding.id,
            "precision",
            "Precision",
            binding.precision,
            0,
            6,
            (precision) =>
              onBindingChange(
                chart.id,
                without(binding, "precision", precision),
              ),
          ),
          ...unitDisplay(binding, (unitDisplay) =>
            onBindingChange(
              chart.id,
              without(binding, "unitDisplay", unitDisplay),
            ),
          ),
          ...bindingNumber(
            binding.id,
            "scale",
            "Scale",
            binding.scale,
            undefined,
            undefined,
            (scale) =>
              onBindingChange(chart.id, without(binding, "scale", scale)),
          ),
          ...bindingNumber(
            binding.id,
            "offset",
            "Offset",
            binding.offset,
            undefined,
            undefined,
            (offset) =>
              onBindingChange(chart.id, without(binding, "offset", offset)),
          ),
        );
      }
      for (const field of settingsFieldsFor(chart.content.family)) {
        const label = document.createElement("label");
        label.textContent = field.label;
        const input = document.createElement(
          field.kind === "select" ? "select" : "input",
        );
        // Keyed by the setting itself, so it is unique across every field this
        // section builds and addressable by name in a test. This panel was the
        // one place in the shell where neither the control had an id nor its
        // label an `htmlFor`.
        label.htmlFor = input.id = `vigilia-chart-setting-${field.property}`;
        input.dataset["vigiliaChartSetting"] = field.property;
        const value = (
          chart.content.settings as unknown as Record<string, unknown>
        )[field.property];
        if (field.kind === "boolean") {
          const checkbox = input as HTMLInputElement;
          checkbox.type = "checkbox";
          checkbox.checked = value === true;
        } else if (field.kind === "number") {
          const number = input as HTMLInputElement;
          number.type = "number";
          number.value = value === undefined ? "" : String(value);
          if (field.min !== undefined) number.min = String(field.min);
          if (field.max !== undefined) number.max = String(field.max);
          number.step = String(field.step ?? 1);
        } else {
          for (const option of field.options ?? []) {
            const element = document.createElement("option");
            element.value = option.value;
            element.textContent = option.label;
            (input as HTMLSelectElement).append(element);
          }
          (input as HTMLSelectElement).value =
            typeof value === "string" ? value : "";
        }
        input.addEventListener("change", () => {
          const next =
            field.kind === "boolean"
              ? (input as HTMLInputElement).checked
              : field.kind === "number"
                ? Number((input as HTMLInputElement).value)
                : (input as HTMLSelectElement).value;
          if (field.kind === "number" && !Number.isFinite(next)) {
            this.render(chart);
            return;
          }
          onChange(chart.id, {
            ...chart.content.settings,
            [field.property]: next,
          } as ChartContent["settings"]);
        });
        root.append(label, input);
      }
      for (const field of chartPaintFieldsFor(chart.content.family)) {
        const value = (
          chart.content.settings as unknown as Record<string, unknown>
        )[field.property];
        if (field.multiple && Array.isArray(value)) {
          value.forEach((paint, index) =>
            root.append(
              ...paintPicker(
                `${field.label} ${index + 1}`,
                `${field.property}.${index}`,
                paint,
                palette,
                (ref) =>
                  onChange(chart.id, {
                    ...chart.content.settings,
                    [field.property]: value.map((entry, item) =>
                      item === index ? { ref } : entry,
                    ),
                  } as ChartContent["settings"]),
              ),
            ),
          );
        } else if (!Array.isArray(value) && value !== undefined) {
          root.append(
            ...paintPicker(field.label, field.property, value, palette, (ref) =>
              onChange(chart.id, {
                ...chart.content.settings,
                [field.property]: { ref },
              } as ChartContent["settings"]),
            ),
          );
        }
      }
    },
  };
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

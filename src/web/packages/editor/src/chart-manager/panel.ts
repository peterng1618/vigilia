import { SEMANTIC_KEYS, chartPaintFieldsFor, settingsFieldsFor, type Binding, type ChartContent, type FabricPalette } from '@vigilia/renderer-core';

export interface ForkChartPanel {
  readonly root: HTMLElement;
  render(chart: { readonly id: string; readonly content: ChartContent; readonly bindings: readonly Binding[] } | undefined, palette?: FabricPalette): void;
}

export function createForkChartPanel(
  host: HTMLElement,
  onChange: (id: string, settings: ChartContent['settings']) => void,
  onBindingChange: (id: string, binding: Binding) => void,
): ForkChartPanel {
  const root = document.createElement('section');
  host.prepend(root);

  return {
    root,
    render(chart, palette) {
      root.replaceChildren();
      if (chart === undefined) {
        root.textContent = 'Select a chart to edit its settings.';
        return;
      }
      const heading = document.createElement('h2');
      heading.textContent = `${chart.content.family} chart`;
      root.append(heading);
      for (const binding of chart.bindings) {
        const label = document.createElement('label');
        label.textContent = `Binding: ${binding.id}`;
        const select = document.createElement('select');
        select.dataset['vigiliaBinding'] = binding.id;
        const keys = new Set([binding.semanticKey, ...SEMANTIC_KEYS.map((descriptor) => descriptor.key)]);
        for (const key of keys) {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = SEMANTIC_KEYS.find((descriptor) => descriptor.key === key)?.label ?? key;
          select.append(option);
        }
        select.value = binding.semanticKey;
        select.addEventListener('change', () => onBindingChange(chart.id, { ...binding, semanticKey: select.value }));
        root.append(
          label,
          select,
          ...bindingNumber(binding.id, 'precision', 'Precision', binding.precision, 0, 6, (precision) => onBindingChange(chart.id, without(binding, 'precision', precision))),
          ...unitDisplay(binding, (unitDisplay) => onBindingChange(chart.id, without(binding, 'unitDisplay', unitDisplay))),
          ...bindingNumber(binding.id, 'scale', 'Scale', binding.scale, undefined, undefined, (scale) => onBindingChange(chart.id, without(binding, 'scale', scale))),
          ...bindingNumber(binding.id, 'offset', 'Offset', binding.offset, undefined, undefined, (offset) => onBindingChange(chart.id, without(binding, 'offset', offset))),
        );
      }
      for (const field of settingsFieldsFor(chart.content.family)) {
        const label = document.createElement('label');
        label.textContent = field.label;
        const input = document.createElement(field.kind === 'select' ? 'select' : 'input');
        input.dataset['vigiliaChartSetting'] = field.property;
        const value = (chart.content.settings as unknown as Record<string, unknown>)[field.property];
        if (field.kind === 'boolean') {
          const checkbox = input as HTMLInputElement;
          checkbox.type = 'checkbox'; checkbox.checked = value === true;
        } else if (field.kind === 'number') {
          const number = input as HTMLInputElement;
          number.type = 'number'; number.value = value === undefined ? '' : String(value);
          if (field.min !== undefined) number.min = String(field.min);
          if (field.max !== undefined) number.max = String(field.max);
          number.step = String(field.step ?? 1);
        } else {
          for (const option of field.options ?? []) {
            const element = document.createElement('option');
            element.value = option.value; element.textContent = option.label;
            (input as HTMLSelectElement).append(element);
          }
          (input as HTMLSelectElement).value = typeof value === 'string' ? value : '';
        }
        input.addEventListener('change', () => {
          const next = field.kind === 'boolean' ? (input as HTMLInputElement).checked
            : field.kind === 'number' ? Number((input as HTMLInputElement).value)
              : (input as HTMLSelectElement).value;
          if (field.kind === 'number' && !Number.isFinite(next)) { this.render(chart); return; }
          onChange(chart.id, { ...chart.content.settings, [field.property]: next } as ChartContent['settings']);
        });
        root.append(label, input);
      }
      for (const field of chartPaintFieldsFor(chart.content.family)) {
        const value = (chart.content.settings as unknown as Record<string, unknown>)[field.property];
        if (field.multiple && Array.isArray(value)) {
          value.forEach((paint, index) => root.append(...paintPicker(
            `${field.label} ${index + 1}`, `${field.property}.${index}`, paint, palette,
            (ref) => onChange(chart.id, { ...chart.content.settings, [field.property]: value.map((entry, item) => item === index ? { ref } : entry) } as ChartContent['settings']),
          )));
        } else if (!Array.isArray(value) && value !== undefined) {
          root.append(...paintPicker(
            field.label, field.property, value, palette,
            (ref) => onChange(chart.id, { ...chart.content.settings, [field.property]: { ref } } as ChartContent['settings']),
          ));
        }
      }
    },
  };
}

function paintPicker(
  labelText: string,
  key: string,
  value: unknown,
  palette: FabricPalette | undefined,
  onChange: (ref: string) => void,
): readonly [HTMLLabelElement, HTMLSelectElement] {
  const label = document.createElement('label');
  label.textContent = labelText;
  const select = document.createElement('select');
  select.dataset['vigiliaChartPaint'] = key;
  const current = isPaletteReference(value) ? value.ref : '';
  for (const [id, entry] of Object.entries(palette ?? {})) {
    const option = document.createElement('option');
    option.value = `palette.${id}`;
    option.textContent = entry.name;
    select.append(option);
  }
  select.value = current;
  select.disabled = current === '' || select.options.length === 0;
  select.addEventListener('change', () => onChange(select.value));
  return [label, select];
}

function isPaletteReference(value: unknown): value is { readonly ref: string } {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)['ref'] === 'string';
}

function bindingNumber(
  bindingId: string,
  property: 'precision' | 'scale' | 'offset',
  labelText: string,
  value: number | undefined,
  min: number | undefined,
  max: number | undefined,
  onChange: (value: number | undefined) => void,
): readonly [HTMLLabelElement, HTMLInputElement] {
  const label = document.createElement('label');
  label.textContent = labelText;
  const input = document.createElement('input');
  input.dataset['vigiliaBindingField'] = `${bindingId}.${property}`;
  input.type = 'number';
  input.value = value === undefined ? '' : String(value);
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  input.addEventListener('change', () => {
    if (input.value === '') {
      onChange(undefined);
      return;
    }
    const next = Number(input.value);
    if (!Number.isFinite(next) || (min !== undefined && next < min) || (max !== undefined && next > max) || (labelText === 'Precision' && !Number.isInteger(next))) {
      input.value = value === undefined ? '' : String(value);
      return;
    }
    onChange(next);
  });
  return [label, input];
}

function unitDisplay(binding: Binding, onChange: (value: Binding['unitDisplay']) => void): readonly [HTMLLabelElement, HTMLSelectElement] {
  const label = document.createElement('label');
  label.textContent = 'Unit display';
  const select = document.createElement('select');
  select.dataset['vigiliaBindingField'] = `${binding.id}.unitDisplay`;
  for (const [value, text] of [['', 'Default'], ['none', 'None'], ['short', 'Short'], ['long', 'Long']] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  select.value = binding.unitDisplay ?? '';
  select.addEventListener('change', () => onChange(select.value === '' ? undefined : select.value as Binding['unitDisplay']));
  return [label, select];
}

function without<K extends keyof Binding>(binding: Binding, key: K, value: Binding[K] | undefined): Binding {
  if (value === undefined) {
    const { [key]: _removed, ...rest } = binding;
    return rest as Binding;
  }
  return { ...binding, [key]: value } as Binding;
}

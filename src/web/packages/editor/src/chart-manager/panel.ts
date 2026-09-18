import { settingsFieldsFor, type ChartContent } from '@vigilia/renderer-core';

export interface ForkChartPanel {
  readonly root: HTMLElement;
  render(chart: { readonly id: string; readonly content: ChartContent } | undefined): void;
}

export function createForkChartPanel(
  host: HTMLElement,
  onChange: (id: string, settings: ChartContent['settings']) => void,
): ForkChartPanel {
  const root = document.createElement('section');
  host.append(root);

  return {
    root,
    render(chart) {
      root.replaceChildren();
      if (chart === undefined) {
        root.textContent = 'Select a chart to edit its settings.';
        return;
      }
      const heading = document.createElement('h2');
      heading.textContent = `${chart.content.family} chart`;
      root.append(heading);
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
    },
  };
}

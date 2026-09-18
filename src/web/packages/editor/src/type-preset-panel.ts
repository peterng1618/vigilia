import type { TypePreset } from '@vigilia/renderer-core';

export type TypePresets = Readonly<Record<string, { readonly name: string; readonly value: TypePreset }>>;

export interface TypePresetPanel { readonly root: HTMLElement; render(presets: TypePresets | undefined): void; }

/** Product-owned global type authoring. Text objects retain stable preset references. */
export function createTypePresetPanel(
  host: HTMLElement,
  onChange: (presets: TypePresets) => void,
  onDelete?: (id: string, replacement: string) => void,
): TypePresetPanel {
  const root = document.createElement('section');
  const heading = document.createElement('h2'); heading.textContent = 'Type presets';
  const select = document.createElement('select'); select.dataset['vigiliaTypePreset'] = '';
  const add = document.createElement('button'); add.type = 'button'; add.textContent = 'Add type';
  const fields = document.createElement('div'); root.append(heading, select, add, fields); host.append(root);
  let presets: TypePresets = {}; let selected = '';
  const draw = (): void => {
    select.replaceChildren(...Object.entries(presets).map(([id, entry]) => {
      const option = document.createElement('option'); option.value = id; option.textContent = entry.name; return option;
    }));
    if (presets[selected] === undefined) selected = Object.keys(presets)[0] ?? '';
    select.value = selected; fields.replaceChildren(); const entry = presets[selected]; if (entry !== undefined) fields.append(...controls(entry));
  };
  const commit = (entry: { readonly name: string; readonly value: TypePreset }): void => { presets = { ...presets, [selected]: entry }; onChange(presets); draw(); };
  const controls = (entry: { readonly name: string; readonly value: TypePreset }): HTMLElement[] => {
    const name = input('Name', 'vigiliaTypeName', entry.name); const family = input('Family', 'vigiliaTypeFamily', entry.value.family);
    const size = input('Size', 'vigiliaTypeSize', String(entry.value.size), 'number'); const weight = input('Weight', 'vigiliaTypeWeight', String(entry.value.weight ?? ''));
    const lineHeight = input('Line height', 'vigiliaTypeLineHeight', String(entry.value.lineHeight ?? ''));
    const update = (): void => { const nextSize = Number(size.value); const nextLine = lineHeight.value === '' ? undefined : Number(lineHeight.value); if (!Number.isFinite(nextSize) || nextSize <= 0 || (nextLine !== undefined && (!Number.isFinite(nextLine) || nextLine <= 0)) || name.value.trim() === '' || family.value.trim() === '') return; commit({ name: name.value.trim(), value: { family: family.value.trim(), size: nextSize, ...(weight.value.trim() === '' ? {} : { weight: weight.value.trim() }), ...(nextLine === undefined ? {} : { lineHeight: nextLine }) } }); };
    for (const control of [name, family, size, weight, lineHeight]) control.addEventListener('change', update);
    return [
      label('Name', name),
      label('Family', family),
      label('Size', size),
      label('Weight', weight),
      label('Line height', lineHeight),
      ...deletionControls(),
    ];
  };
  const deletionControls = (): HTMLElement[] => {
    if (onDelete === undefined) return [];
    const label = document.createElement('label');
    label.textContent = 'Reassign to';
    const replacement = document.createElement('select');
    replacement.dataset['vigiliaTypeReplacement'] = '';
    for (const [id, entry] of Object.entries(presets)) {
      if (id === selected) continue;
      const option = document.createElement('option');
      option.value = id;
      option.textContent = entry.name;
      replacement.append(option);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete type';
    remove.dataset['vigiliaTypeDelete'] = '';
    remove.disabled = replacement.options.length === 0;
    remove.addEventListener('click', () => {
      if (replacement.value !== '') onDelete(selected, replacement.value);
    });
    return [label, replacement, remove];
  };
  select.addEventListener('change', () => { selected = select.value; draw(); });
  add.addEventListener('click', () => { selected = nextId(presets); presets = { ...presets, [selected]: { name: 'New type', value: { family: 'Segoe UI, sans-serif', size: 16 } } }; onChange(presets); draw(); });
  return { root, render(next) { presets = next ?? {}; draw(); } };
}

function input(label: string, key: string, value: string, type = 'text'): HTMLInputElement { const control = document.createElement('input'); control.type = type; control.dataset[key] = ''; control.value = value; control.setAttribute('aria-label', label); return control; }
function label(text: string, control: HTMLInputElement): HTMLLabelElement { const result = document.createElement('label'); result.textContent = text; result.append(control); return result; }
function nextId(presets: TypePresets): string { for (let index = 1; ; index += 1) { const id = index === 1 ? 'type' : `type-${index}`; if (presets[id] === undefined) return id; } }

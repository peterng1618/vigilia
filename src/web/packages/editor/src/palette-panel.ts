import type { FabricPalette, FabricPaletteEntry, PalettePaint } from '@vigilia/renderer-core';

export interface PalettePanel {
  readonly root: HTMLElement;
  render(palette: FabricPalette | undefined): void;
}

/** Product-owned palette authoring; tokens retain stable ids so references stay valid. */
export function createPalettePanel(host: HTMLElement, onChange: (palette: FabricPalette) => void): PalettePanel {
  const root = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Palette';
  const select = document.createElement('select');
  select.dataset['vigiliaPaletteToken'] = '';
  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = 'Add colour';
  const fields = document.createElement('div');
  root.append(heading, select, add, fields);
  host.append(root);

  let palette: FabricPalette = {};
  let selected = '';
  const draw = (): void => {
    select.replaceChildren();
    for (const [id, entry] of Object.entries(palette)) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = entry.name;
      select.append(option);
    }
    if (palette[selected] === undefined) selected = Object.keys(palette)[0] ?? '';
    select.value = selected;
    fields.replaceChildren();
    const entry = palette[selected];
    if (entry !== undefined) fields.append(...paletteFields(entry));
  };
  const commit = (entry: FabricPaletteEntry): void => {
    if (selected === 'none') return;
    palette = { ...palette, [selected]: entry };
    onChange(palette);
    draw();
  };
  const paletteFields = (entry: FabricPaletteEntry): HTMLElement[] => {
    const name = textInput('Name', 'vigiliaPaletteName', entry.name);
    name.input.addEventListener('change', () => {
      const next = name.input.value.trim();
      if (next.length === 0) return draw();
      commit({ ...entry, name: next });
    });
    if (selected === 'none') {
      name.input.disabled = true;
      return [name.label, name.input];
    }
    const kind = document.createElement('select');
    kind.dataset['vigiliaPaletteKind'] = '';
    for (const value of ['solid', 'gradient'] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value === 'solid' ? 'Solid' : 'Linear gradient';
      kind.append(option);
    }
    kind.value = entry.value.kind;
    kind.addEventListener('change', () => {
      commit({ ...entry, value: kind.value === 'gradient' ? defaultGradient() : { kind: 'solid', color: '#ffffff' } });
    });
    const label = document.createElement('label');
    label.textContent = 'Paint';
    const controls = entry.value.kind === 'solid'
      ? solidFields(entry, entry.value, commit)
      : gradientFields(entry, entry.value, commit);
    return [name.label, name.input, label, kind, ...controls];
  };
  select.addEventListener('change', () => {
    selected = select.value;
    draw();
  });
  add.addEventListener('click', () => {
    selected = nextId(palette);
    palette = { ...palette, [selected]: { name: 'New colour', value: { kind: 'solid', color: '#ffffff' } } };
    onChange(palette);
    draw();
  });
  return {
    root,
    render(nextPalette) {
      palette = nextPalette ?? {};
      draw();
    },
  };
}

function solidFields(
  entry: FabricPaletteEntry,
  value: Extract<PalettePaint, { readonly kind: 'solid' }>,
  commit: (entry: FabricPaletteEntry) => void,
): HTMLElement[] {
  const color = textInput('Colour', 'vigiliaPaletteColor', value.color);
  color.input.addEventListener('change', () => {
    const next = color.input.value.trim();
    if (next.length === 0) return;
    commit({ ...entry, value: { kind: 'solid', color: next } });
  });
  return [color.label, color.input];
}

function gradientFields(
  entry: FabricPaletteEntry,
  value: Extract<PalettePaint, { readonly kind: 'gradient' }>,
  commit: (entry: FabricPaletteEntry) => void,
): HTMLElement[] {
  const angle = numberInput('Angle', 'vigiliaPaletteAngle', value.angle);
  angle.input.addEventListener('change', () => {
    const next = Number(angle.input.value);
    if (!Number.isFinite(next)) return;
    commit({ ...entry, value: { ...value, angle: next } });
  });
  const fields: HTMLElement[] = [angle.label, angle.input];
  for (const [index, stop] of value.stops.entries()) {
    const offset = numberInput(`Stop ${index + 1} position`, 'vigiliaPaletteStopOffset', stop.offset);
    offset.input.min = '0';
    offset.input.max = '1';
    offset.input.step = '0.01';
    const color = textInput(`Stop ${index + 1} colour`, 'vigiliaPaletteStopColor', stop.color);
    const update = (): void => {
      const nextOffset = Number(offset.input.value);
      const nextColor = color.input.value.trim();
      if (!Number.isFinite(nextOffset) || nextOffset < 0 || nextOffset > 1 || nextColor.length === 0) return;
      const stops = value.stops.map((current, stopIndex) => stopIndex === index ? { offset: nextOffset, color: nextColor } : current);
      if (stops.some((current, stopIndex) => stopIndex > 0 && current.offset < stops[stopIndex - 1]!.offset)) return;
      commit({ ...entry, value: { ...value, stops } });
    };
    offset.input.addEventListener('change', update);
    color.input.addEventListener('change', update);
    fields.push(offset.label, offset.input, color.label, color.input);
  }
  const last = value.stops.at(-1);
  if (last !== undefined) {
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = 'Add stop';
    add.dataset['vigiliaPaletteAddStop'] = '';
    add.addEventListener('click', () => {
      commit({ ...entry, value: { ...value, stops: [...value.stops, { offset: 1, color: last.color }] } });
    });
    fields.push(add);
  }
  return fields;
}

function textInput(text: string, key: string, value: string): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const label = document.createElement('label');
  label.textContent = text;
  const input = document.createElement('input');
  input.type = 'text';
  input.dataset[key] = '';
  input.value = value;
  return { label, input };
}

function numberInput(text: string, key: string, value: number): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const label = document.createElement('label');
  label.textContent = text;
  const input = document.createElement('input');
  input.type = 'number';
  input.dataset[key] = '';
  input.value = String(value);
  return { label, input };
}

function defaultGradient(): PalettePaint {
  return { kind: 'gradient', angle: 0, stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#000000' }] };
}

function nextId(palette: FabricPalette): string {
  for (let suffix = 1; ; suffix += 1) {
    const id = suffix === 1 ? 'colour' : `colour-${suffix}`;
    if (palette[id] === undefined) return id;
  }
}

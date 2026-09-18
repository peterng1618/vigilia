import { MAX_ARTBOARD_DIMENSION, type Artboard, type Globals } from '@vigilia/renderer-core';

export interface ArtboardPanel {
  readonly root: HTMLElement;
  render(artboard: Artboard): void;
}

/** Product-owned document preview controls; Fabric objects retain their geometry. */
export function createArtboardPanel(
  host: HTMLElement,
  globals: Globals | undefined,
  onChange: (artboard: Artboard) => void,
): ArtboardPanel {
  const root = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Artboard';
  const width = dimensionInput('Width');
  const height = dimensionInput('Height');
  const label = document.createElement('label');
  label.textContent = 'Preview fit';
  const select = document.createElement('select');
  select.dataset['vigiliaArtboardFitMode'] = '';
  for (const fitMode of ['contain', 'cover'] as const) {
    const option = document.createElement('option');
    option.value = fitMode;
    option.textContent = fitMode[0]!.toUpperCase() + fitMode.slice(1);
    select.append(option);
  }
  const background = paletteInput('Background', 'background', globals);
  const bars = paletteInput('Bar colour', 'barColor', globals);
  let current: Artboard;
  const submit = (): void => {
    const nextWidth = Number(width.input.value);
    const nextHeight = Number(height.input.value);
    if (!isDimension(nextWidth) || !isDimension(nextHeight)) {
      render(current);
      return;
    }
    const next: Artboard = {
      ...current,
      width: nextWidth,
      height: nextHeight,
      fitMode: select.value === 'cover' ? 'cover' : 'contain',
    };
    setPaletteReference(next, 'background', background.select.value, current.background);
    setPaletteReference(next, 'barColor', bars.select.value, current.barColor);
    onChange(next);
  };
  width.input.addEventListener('change', submit);
  height.input.addEventListener('change', submit);
  select.addEventListener('change', submit);
  background.select.addEventListener('change', submit);
  bars.select.addEventListener('change', submit);
  root.append(
    heading,
    width.label, width.input,
    height.label, height.input,
    label, select,
    background.label, background.select,
    bars.label, bars.select,
  );
  host.append(root);

  const render = (artboard: Artboard): void => {
    current = artboard;
    width.input.value = String(artboard.width);
    height.input.value = String(artboard.height);
    select.value = artboard.fitMode ?? 'contain';
    background.select.value = paletteReference(artboard.background);
    bars.select.value = paletteReference(artboard.barColor);
  };

  return {
    root,
    render,
  };
}

function paletteInput(
  text: string,
  property: 'background' | 'barColor',
  globals: Globals | undefined,
): { readonly label: HTMLLabelElement; readonly select: HTMLSelectElement } {
  const label = document.createElement('label');
  label.textContent = text;
  const select = document.createElement('select');
  select.dataset[`vigiliaArtboard${property[0]!.toUpperCase()}${property.slice(1)}`] = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Not set';
  select.append(none);
  for (const [id, entry] of Object.entries(globals?.palette ?? {})) {
    const option = document.createElement('option');
    option.value = `palette.${id}`;
    option.textContent = entry.name;
    select.append(option);
  }
  return { label, select };
}

function paletteReference(value: Artboard['background']): string {
  return value !== undefined && 'ref' in value && value.ref.startsWith('palette.') ? value.ref : '';
}

function setPaletteReference(
  artboard: { background?: Artboard['background']; barColor?: Artboard['barColor'] },
  property: 'background' | 'barColor',
  value: string,
  current: Artboard['background'],
): void {
  if (value === '') {
    if (current === undefined || ('ref' in current && current.ref.startsWith('palette.'))) delete artboard[property];
    return;
  }
  artboard[property] = { ref: value as `palette.${string}` };
}

function dimensionInput(text: string): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const label = document.createElement('label');
  label.textContent = text;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = String(MAX_ARTBOARD_DIMENSION);
  input.step = '1';
  input.dataset[`vigiliaArtboard${text}`] = '';
  return { label, input };
}

function isDimension(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_ARTBOARD_DIMENSION;
}

import { MAX_ARTBOARD_DIMENSION, type Artboard, type FitMode } from '@vigilia/renderer-core';

export interface ArtboardPanel {
  readonly root: HTMLElement;
  render(artboard: Artboard): void;
}

/** Product-owned document preview controls; Fabric objects retain their geometry. */
export function createArtboardPanel(host: HTMLElement, onChange: (artboard: Artboard) => void): ArtboardPanel {
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
  let current: Artboard;
  const submit = (): void => {
    const nextWidth = Number(width.input.value);
    const nextHeight = Number(height.input.value);
    if (!isDimension(nextWidth) || !isDimension(nextHeight)) {
      render(current);
      return;
    }
    onChange({
      ...current,
      width: nextWidth,
      height: nextHeight,
      fitMode: select.value === 'cover' ? 'cover' : 'contain',
    });
  };
  width.input.addEventListener('change', submit);
  height.input.addEventListener('change', submit);
  select.addEventListener('change', submit);
  root.append(heading, width.label, width.input, height.label, height.input, label, select);
  host.append(root);

  const render = (artboard: Artboard): void => {
    current = artboard;
    width.input.value = String(artboard.width);
    height.input.value = String(artboard.height);
    select.value = artboard.fitMode ?? 'contain';
  };

  return {
    root,
    render,
  };
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

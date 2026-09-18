import type { FitMode } from '@vigilia/renderer-core';

export interface ArtboardPanel {
  readonly root: HTMLElement;
  render(fitMode: FitMode): void;
}

/** Product-owned document preview controls; Fabric objects retain their geometry. */
export function createArtboardPanel(host: HTMLElement, onFitModeChange: (fitMode: FitMode) => void): ArtboardPanel {
  const root = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Artboard';
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
  select.addEventListener('change', () => {
    onFitModeChange(select.value === 'cover' ? 'cover' : 'contain');
  });
  root.append(heading, label, select);
  host.append(root);

  return {
    root,
    render(fitMode) {
      select.value = fitMode;
    },
  };
}

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createArtboardPanel } from './artboard-panel.js';

describe('artboard panel', () => {
  it('shows and returns the supported preview fit mode', () => {
    const change = vi.fn();
    const panel = createArtboardPanel(document.body, change);

    panel.render('cover');
    const select = panel.root.querySelector<HTMLSelectElement>('[data-vigilia-artboard-fit-mode]')!;
    expect(select.value).toBe('cover');

    select.value = 'contain';
    select.dispatchEvent(new Event('change'));
    expect(change).toHaveBeenCalledWith('contain');
  });
});

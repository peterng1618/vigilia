// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createArtboardPanel } from './artboard-panel.js';

describe('artboard panel', () => {
  it('shows and returns valid artboard properties', () => {
    const change = vi.fn();
    const panel = createArtboardPanel(document.body, change);

    panel.render({ width: 1280, height: 720, fitMode: 'cover' });
    const select = panel.root.querySelector<HTMLSelectElement>('[data-vigilia-artboard-fit-mode]')!;
    expect(select.value).toBe('cover');

    const width = panel.root.querySelector<HTMLInputElement>('[data-vigilia-artboard-width]')!;
    width.value = '1000';
    width.dispatchEvent(new Event('change'));
    expect(change).toHaveBeenCalledWith({ width: 1000, height: 720, fitMode: 'cover' });

    select.value = 'contain';
    select.dispatchEvent(new Event('change'));
    expect(change).toHaveBeenLastCalledWith({ width: 1000, height: 720, fitMode: 'contain' });
  });

  it('refuses an invalid dimension and restores the last valid value', () => {
    const change = vi.fn();
    const panel = createArtboardPanel(document.body, change);
    panel.render({ width: 1280, height: 720 });
    const width = panel.root.querySelector<HTMLInputElement>('[data-vigilia-artboard-width]')!;

    width.value = '0';
    width.dispatchEvent(new Event('change'));

    expect(change).not.toHaveBeenCalled();
    expect(width.value).toBe('1280');
  });
});

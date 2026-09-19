// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createAssetPanel } from './index.js';

describe('asset panel', () => {
  it('exposes local import, selected replacement, and protected removal controls', () => {
    const remove = vi.fn(() => false);
    const manager = { declarations: [{ id: 'logo', kind: 'image', path: 'assets/logo.png' }], remove };
    const editor = { canvas: { getObjects: () => [{ get: () => ({ assetId: 'logo', kind: 'image' }) }] } };

    const panel = createAssetPanel(document.body, manager as never, editor as never, vi.fn());

    expect(panel.querySelector('[data-vigilia-asset-import]')).not.toBeNull();
    expect(panel.querySelector('[data-vigilia-asset-replace]')).not.toBeNull();
    expect(panel.querySelector('[data-vigilia-asset-remove]')).not.toBeNull();
    (panel.querySelector('[data-vigilia-asset-remove]') as HTMLButtonElement).click();
    expect(remove).not.toHaveBeenCalled();
  });

  it('refuses removal when an artboard background references the asset', () => {
    const remove = vi.fn(() => false);
    const manager = { declarations: [{ id: 'hero', kind: 'image', path: 'assets/hero.png' }], remove };
    const editor = { canvas: { getObjects: () => [] } };

    const panel = createAssetPanel(document.body, manager as never, editor as never, vi.fn(), (id) => id === 'hero');
    (panel.querySelector('[data-vigilia-asset-remove]') as HTMLButtonElement).click();

    expect(remove).not.toHaveBeenCalled();
  });
});

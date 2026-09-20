import type { FabricThemeEnvelope } from '@vigilia/renderer-core';
import { describe, expect, it, vi } from 'vitest';
import { loadHostedFontAssets, loadHostedTheme } from './theme-loader.js';

const envelope: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: '7.4.0',
  id: 'living-room',
  artboard: { width: 1920, height: 1080 },
  scene: { version: '7.4.0', objects: [] },
};

describe('loadHostedTheme', () => {
  it('rejects invalid IDs before fetching', async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(loadHostedTheme('../escape', fetcher)).rejects.toThrow('Invalid theme id.');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects an unsuccessful host response', async () => {
    await expect(loadHostedTheme('living-room', async () => new Response('', { status: 404 }))).rejects.toThrow('404');
  });

  it('loads a validated hosted envelope', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(envelope));

    await expect(loadHostedTheme('living-room', fetcher)).resolves.toEqual(envelope);
    expect(fetcher).toHaveBeenCalledWith('/api/themes/living-room/document');
  });

  it('rejects an invalid hosted envelope', async () => {
    await expect(loadHostedTheme('living-room', async () => Response.json({ ...envelope, schemaVersion: 3 })))
      .rejects.toThrow('newer version');
  });

  it('fetches exact bytes for declared font assets only', async () => {
    const theme: FabricThemeEnvelope = { ...envelope, assets: [
      { id: 'inter-400', kind: 'font', path: 'assets/inter-400.woff2' },
      { id: 'logo', kind: 'image', path: 'assets/logo.png' },
    ] };
    const fetcher = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2])));

    await expect(loadHostedFontAssets('living-room', theme, fetcher)).resolves.toEqual({ 'assets/inter-400.woff2': new Uint8Array([1, 2]) });
    expect(fetcher).toHaveBeenCalledWith('/api/themes/living-room/assets/assets%2Finter-400.woff2');
  });

  it('rejects a failed declared font fetch', async () => {
    const theme: FabricThemeEnvelope = { ...envelope, assets: [
      { id: 'inter-400', kind: 'font', path: 'assets/inter-400.woff2' },
    ] };

    await expect(loadHostedFontAssets('living-room', theme, async () => new Response('', { status: 404 })))
      .rejects.toThrow('font asset');
  });
});

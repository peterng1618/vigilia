import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readThemePackage, writeThemePackage } from './index.js';

const envelope = {
  schemaVersion: 2 as const, fabricVersion: '7.4.0', id: 'demo',
  artboard: { width: 400, height: 300 },
  assets: [{ id: 'logo', kind: 'image' as const, path: 'assets/logo.png' }],
  scene: { version: '7.4.0', objects: [] },
};

describe('theme package', () => {
  it('round-trips a validated envelope and each declared asset', () => {
    const written = writeThemePackage({ envelope, assets: { 'assets/logo.png': new Uint8Array([1, 2, 3]) } });
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    const read = readThemePackage(written.bytes);
    expect(read).toMatchObject({ ok: true, envelope });
    if (read.ok) expect(read.assets['assets/logo.png']).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('refuses a valid ZIP whose declared entry exceeds the package bound', () => {
    const large = new Uint8Array(32 * 1024 * 1024 + 1);
    const theme = { ...envelope, assets: [{ id: 'large', kind: 'image' as const, path: 'assets/large.bin' }] };
    const bytes = zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: 'vigilia-theme-package', version: 1, theme: 'theme.json' })),
      'theme.json': strToU8(JSON.stringify(theme)),
      'assets/large.bin': [large, { level: 0 }],
    });

    expect(readThemePackage(bytes)).toMatchObject({ ok: false });
  });

  it('refuses an archive asset that the envelope does not declare', () => {
    const bytes = zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: 'vigilia-theme-package', version: 1, theme: 'theme.json' })),
      'theme.json': strToU8(JSON.stringify({ ...envelope, assets: [] })),
      'assets/extra.png': new Uint8Array([1]),
    });

    expect(readThemePackage(bytes)).toMatchObject({ ok: false });
  });
});

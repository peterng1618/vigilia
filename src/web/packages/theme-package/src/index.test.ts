import { describe, expect, it } from 'vitest';
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
});

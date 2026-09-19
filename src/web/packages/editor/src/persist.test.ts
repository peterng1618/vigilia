import { describe, expect, it } from 'vitest';
import type { FabricThemeEnvelope } from '@vigilia/renderer-core';
import { writeThemePackage } from '@vigilia/theme-package';
import {
  fileNameFor,
  parseThemePackage,
  serializeThemePackage,
} from './persist.js';

const validEnvelope: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: '7.4.0',
  id: 'living-room',
  artboard: { width: 1920, height: 1080 },
  metadata: { name: 'Living Room' },
  scene: { version: '7.4.0', objects: [] },
};

describe('parseThemePackage', () => {
  it('parses valid empty-asset packages', () => {
    const pkg = writeThemePackage({ envelope: validEnvelope, assets: {} });
    expect(pkg.ok).toBe(true);
    if (!pkg.ok) return;

    const result = parseThemePackage(pkg.bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.id).toBe('living-room');
    }
  });

  it('rejects corrupt bytes with a clear message', () => {
    const result = parseThemePackage(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
  });

  it('preserves each declared package asset', () => {
    const envelopeWithAssets: FabricThemeEnvelope = {
      ...validEnvelope,
      assets: [
        {
          id: 'img1',
          kind: 'image' as const,
          path: 'assets/image.png',
        },
      ],
    };
    const pkg = writeThemePackage({
      envelope: envelopeWithAssets,
      assets: { 'assets/image.png': new Uint8Array([1, 2, 3]) },
    });
    expect(pkg.ok).toBe(true);
    if (!pkg.ok) return;

    const result = parseThemePackage(pkg.bytes);
    expect(result).toMatchObject({ ok: true, envelope: envelopeWithAssets });
    if (result.ok) expect(result.assets['assets/image.png']).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('serializeThemePackage', () => {
  it('serializes valid empty-asset envelopes into packages', () => {
    const result = serializeThemePackage(validEnvelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = parseThemePackage(result.bytes);
      expect(parsed.ok).toBe(true);
    }
  });

  it('serializes assets with their declaration', () => {
    const envelope = {
      ...validEnvelope,
      assets: [
        {
          id: 'img1',
          kind: 'image' as const,
          path: 'assets/test.png',
        },
      ],
    };
    const result = serializeThemePackage(envelope, { 'assets/test.png': new Uint8Array([1, 2, 3]) });
    expect(result).toMatchObject({ ok: true });
  });
});

describe('fileNameFor', () => {
  it('uses the theme id with .vigilia-theme extension', () => {
    expect(fileNameFor(validEnvelope)).toBe('living-room.vigilia-theme');
  });

  it('falls back to theme.vigilia-theme when id is not filename-safe', () => {
    expect(fileNameFor({ id: '../../etc/passwd' })).toBe('theme.vigilia-theme');
  });
});

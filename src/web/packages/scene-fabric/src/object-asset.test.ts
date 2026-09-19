import { describe, expect, it } from 'vitest';
import { objectAssetReference, setObjectAssetReference } from './object-asset.js';

function object(): { get(name: string): unknown; set(name: string, value: unknown): void } {
  const values = new Map<string, unknown>();
  return {
    get: (name) => values.get(name),
    set: (name, value) => values.set(name, value),
  };
}

describe('Fabric asset references', () => {
  it('keeps a stable image or SVG reference on a Fabric object', () => {
    const target = object();

    setObjectAssetReference(target, { assetId: 'logo', kind: 'svg' });

    expect(objectAssetReference(target)).toEqual({ assetId: 'logo', kind: 'svg' });
  });

  it('ignores malformed persisted references', () => {
    const target = object();
    target.set('vigiliaAsset', { assetId: '', kind: 'gif', previewUrl: 'blob:local' });

    expect(objectAssetReference(target)).toBeUndefined();
  });
});

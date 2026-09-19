import { describe, expect, it } from 'vitest';
import {
  objectAssetReference,
  setObjectAssetReference,
  VIGILIA_ASSET_PROPERTY,
} from './object-asset.js';

describe('object asset references', () => {
  it('stores an image or SVG asset identity on a Fabric-like object', () => {
    let value: unknown;
    const object = {
      get: (name: string) => name === VIGILIA_ASSET_PROPERTY ? value : undefined,
      set: (name: string, next: unknown) => { if (name === VIGILIA_ASSET_PROPERTY) value = next; },
    };

    setObjectAssetReference(object, { assetId: 'logo', kind: 'svg' });

    expect(objectAssetReference(object)).toEqual({ assetId: 'logo', kind: 'svg' });
  });

  it('refuses malformed asset metadata', () => {
    expect(objectAssetReference({ get: () => ({ assetId: '', kind: 'image' }) })).toBeUndefined();
    expect(objectAssetReference({ get: () => ({ assetId: 'logo', kind: 'video' }) })).toBeUndefined();
  });
});

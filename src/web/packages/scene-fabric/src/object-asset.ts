/** Persisted package asset identity for a Fabric image. */
export const VIGILIA_ASSET_PROPERTY = 'vigiliaAsset';

export interface FabricAssetReference {
  readonly assetId: string;
  readonly kind: 'image' | 'svg';
}

type AssetObject = {
  get(name: string): unknown;
  set(name: string, value: unknown): unknown;
};

export function setObjectAssetReference(object: AssetObject, asset: FabricAssetReference): void {
  object.set(VIGILIA_ASSET_PROPERTY, asset);
}

export function objectAssetReference(object: Pick<AssetObject, 'get'>): FabricAssetReference | undefined {
  const value = object.get(VIGILIA_ASSET_PROPERTY);
  if (typeof value !== 'object' || value === null) return undefined;
  const asset = value as Record<string, unknown>;
  if (typeof asset['assetId'] !== 'string' || asset['assetId'].length === 0) return undefined;
  if (asset['kind'] !== 'image' && asset['kind'] !== 'svg') return undefined;
  return { assetId: asset['assetId'], kind: asset['kind'] };
}

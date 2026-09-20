/** Persisted reference to bytes declared by the editor's open theme package. */
export const VIGILIA_ASSET_PROPERTY = "vigiliaAsset";

export interface FabricAssetReference {
  readonly assetId: string;
  readonly kind: "image" | "svg";
}

type AssetObject = {
  get(name: string): unknown;
  set(name: string, value: unknown): unknown;
};

/** Set the only asset state that may enter Fabric JSON. */
export function setObjectAssetReference(
  object: AssetObject,
  reference: FabricAssetReference,
): void {
  if (!isFabricAssetReference(reference))
    throw new Error("Invalid Fabric asset reference.");
  object.set(VIGILIA_ASSET_PROPERTY, reference);
}

/** Read a validated asset reference without trusting arbitrary revived JSON. */
export function objectAssetReference(
  object: Pick<AssetObject, "get">,
): FabricAssetReference | undefined {
  const value = object.get(VIGILIA_ASSET_PROPERTY);
  return isFabricAssetReference(value) ? value : undefined;
}

function isFabricAssetReference(value: unknown): value is FabricAssetReference {
  if (typeof value !== "object" || value === null) return false;
  const reference = value as Record<string, unknown>;
  return (
    typeof reference["assetId"] === "string" &&
    reference["assetId"].trim().length > 0 &&
    (reference["kind"] === "image" || reference["kind"] === "svg") &&
    Object.keys(reference).length === 2
  );
}

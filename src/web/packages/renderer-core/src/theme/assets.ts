import { ASSET_PATH_PATTERN, type AssetReference } from "./document.js";

/** Resolves package-relative theme assets to loadable URLs. */

export type AssetResolver = (assetId: string) => string | undefined;

export interface AssetResolverOptions {
  /** URL prefix for package-relative asset paths. */
  readonly baseUrl: string;
}

/** Builds a resolver from declared assets. Unknown or unsafe references remain unresolved. */
export function createAssetResolver(
  assets: readonly AssetReference[] | undefined,
  options: AssetResolverOptions,
): AssetResolver {
  const base = options.baseUrl.endsWith("/")
    ? options.baseUrl
    : `${options.baseUrl}/`;
  const byId = new Map<string, AssetReference>();

  for (const asset of assets ?? []) {
    byId.set(asset.id, asset);
  }

  return (assetId: string): string | undefined => {
    const asset = byId.get(assetId);

    // Recheck at resolution time; callers may hold unvalidated draft documents.
    if (asset === undefined || !isSafeAssetPath(asset.path)) {
      return undefined;
    }

    // Encode filename segments without encoding separators.
    const encoded = asset.path.split("/").map(encodeURIComponent).join("/");

    return `${base}${encoded}`;
  };
}

/** Package-relative path under `assets/`, normalized and unable to escape. */
export function isSafeAssetPath(path: string): boolean {
  if (!ASSET_PATH_PATTERN.test(path)) {
    return false;
  }

  const segments = path.split("/");

  return !segments.includes("..") && !segments.includes(".");
}

export const noAssets: AssetResolver = () => undefined;

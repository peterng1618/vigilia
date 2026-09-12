import { ASSET_PATH_PATTERN, type AssetReference } from './document.js';

/**
 * Resolving an asset reference to something the renderer can load.
 *
 * A theme stores a **package-relative path** (`assets/ring.png`), never a URL.
 * That is what makes a theme portable: the same document works when the package
 * is served over LAN HTTP, unpacked into a staging directory, or previewed from
 * blob URLs in an editor. Only the resolver changes.
 *
 * ## The path check happens again here, deliberately
 *
 * `validate.ts` already rejects a `..` segment at import. This rejects it again
 * at resolve time, and the duplication is the point: these are different trust
 * boundaries. Validation runs on a document being imported; resolution runs on
 * whatever the caller holds now — which may have come from a draft, a
 * hand-edited file, or a code path added later that forgot to validate. A path
 * that escapes the package would otherwise become a request for a file outside
 * it, and on the host that is a file-disclosure bug rather than a rendering one.
 */

/** Maps an asset ID to a URL, or undefined if it cannot be resolved. */
export type AssetResolver = (assetId: string) => string | undefined;

export interface AssetResolverOptions {
  /**
   * Prefix joined to each asset's package-relative path.
   *
   * Must end with `/`. A base of `/` serves assets from the site root, which is
   * how the player's static files are laid out; the host will serve a
   * per-revision prefix so a published theme's assets are versioned and
   * HTTP-cacheable (§122).
   */
  readonly baseUrl: string;
}

/**
 * Builds a resolver over a document's declared assets.
 *
 * Unknown IDs resolve to undefined rather than to a guessed path. A guess would
 * produce a 404 that looks like a broken server instead of a theme that
 * references an asset it never declared — and the plan reports the latter as an
 * `unresolved-asset` issue.
 */
export function createAssetResolver(
  assets: readonly AssetReference[] | undefined,
  options: AssetResolverOptions,
): AssetResolver {
  const base = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  const byId = new Map<string, AssetReference>();

  for (const asset of assets ?? []) {
    byId.set(asset.id, asset);
  }

  return (assetId: string): string | undefined => {
    const asset = byId.get(assetId);

    if (asset === undefined || !isSafeAssetPath(asset.path)) {
      return undefined;
    }

    // Each segment is encoded separately: encodeURIComponent would escape the
    // separators and encodeURI would leave a `#` or `?` in a filename to be
    // read as a fragment or query.
    const encoded = asset.path.split('/').map(encodeURIComponent).join('/');

    return `${base}${encoded}`;
  };
}

/**
 * True when a path is package-relative, under `assets/`, and cannot escape.
 *
 * Exported because the host needs the same answer before opening a file, and
 * two implementations of "is this path safe" is how one of them ends up wrong.
 */
export function isSafeAssetPath(path: string): boolean {
  if (!ASSET_PATH_PATTERN.test(path)) {
    return false;
  }

  const segments = path.split('/');

  // `..` escapes; `.` is harmless but means the path was not normalised, and a
  // path that was not normalised is not one to reason about.
  return !segments.includes('..') && !segments.includes('.');
}

/** A resolver that resolves nothing. Useful as a default and in tests. */
export const noAssets: AssetResolver = () => undefined;

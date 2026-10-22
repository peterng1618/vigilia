/** The asset finder's wire contract, spoken by the host and the editor. */

export type SourceCategory = "font" | "icon" | "image" | "video";

/** `"local"` is a category no grid draws: it names a source that is a library
 *  on this PC rather than a provider, which is only Wallpaper Engine (R8). */
export type ListingCategory = SourceCategory | "local";

export interface AssetResult {
  /** The source's own id; the host prefixes it. */
  readonly id: string;
  readonly name: string;
  /** A URL the editor may render, or "". */
  readonly preview: string;
  readonly subtitle: string | undefined;
  /** "unknown" rather than "". */
  readonly licence: string;
  readonly sourceUrl: string;
}

export interface AssetSourceListing {
  readonly id: string;
  readonly label: string;
  readonly category: ListingCategory;
  /** "grid" searches; "font-picker" and "wallpaper-engine" are editor bodies. */
  readonly body: "grid" | "font-picker" | "wallpaper-engine";
  /** `null` on the wire when the source needs no credential. */
  readonly requires: string | null;
  readonly configurable: boolean;
  /** The host a search term is sent to, named by the first-search notice (§5).
   *  `null` when the term never leaves this computer. */
  readonly host: string | null;
}

export interface AssetSearchRequest {
  readonly query: string;
  readonly enabled: readonly string[];
  readonly cursors: Readonly<Record<string, string>>;
}

export interface AssetPage {
  readonly source: string;
  /** Ids already prefixed "<source>:<id>". */
  readonly results: readonly AssetResult[];
  readonly next: string | undefined;
  readonly failure:
    | { readonly reason: "failed"; readonly message: string }
    | { readonly reason: "needs-credential"; readonly credential: string }
    | undefined;
}

export interface AssetSearchAnswer {
  readonly pages: readonly AssetPage[];
}

/** What `GET /api/credentials` answers. Never carries the value. */
export interface CredentialRow {
  readonly id: string;
  readonly label: string;
  readonly set: boolean;
  /** The last four characters, or "" when unset. */
  readonly hint: string;
  /** Whether this host has a check to run, which is what enables Verify. */
  readonly verify: boolean;
  /** One sentence naming where the key comes from, or null when there is none. */
  readonly helpText: string | null;
  /** Where a person creates the key, or null when there is none. */
  readonly helpUrl: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A search body, kept to the sources this host knows.
 *
 * A stale browser preference is not a reason to fail a search: an unknown id is
 * dropped, so a disabled or removed source simply contributes no page.
 */
export function parseAssetSearchRequest(
  value: unknown,
  known: readonly string[],
): AssetSearchRequest | undefined {
  if (!isObject(value)) return undefined;

  const { query, enabled, cursors } = value;

  if (typeof query !== "string" || !Array.isArray(enabled)) return undefined;

  const knownIds = new Set(known);
  const enabledIds = enabled.filter(
    (id): id is string => typeof id === "string" && knownIds.has(id),
  );

  const parsedCursors: [string, string][] = [];
  if (isObject(cursors)) {
    for (const [id, cursor] of Object.entries(cursors)) {
      if (typeof cursor === "string") parsedCursors.push([id, cursor]);
    }
  }

  // `fromEntries` rather than assignment: `__proto__` is a legal source id and
  // assignment would reach the map's prototype instead of storing the cursor.
  return {
    query,
    enabled: enabledIds,
    cursors: Object.fromEntries(parsedCursors),
  };
}

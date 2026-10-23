import type { AssetResult, ListingCategory } from "@yunari/renderer-core";
import type { ThemeCreditsEntry } from "@yunari/theme-package";

/**
 * The asset source port.
 *
 * Every provider call is the host's: the browser holds no key and calls no
 * provider, and a source receives a credential only through this context, never
 * through a request body.
 */
export interface SourceContext {
  /** Never leaves the host. */
  readonly credential: (id: string) => string | undefined;
  readonly signal: AbortSignal;
  readonly fetch: typeof fetch;
}

export interface SourceBytes {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly filename: string;
}

export interface SearchPage {
  readonly results: readonly AssetResult[];
  readonly next: string | undefined;
}

export interface AssetSource {
  readonly id: string;
  readonly label: string;
  readonly category: ListingCategory;
  /** "grid" searches; "font-picker" and "wallpaper-engine" are editor bodies. */
  readonly body: "grid" | "font-picker" | "wallpaper-engine";
  readonly requires: string | undefined;
  readonly configurable: boolean;
  /** The host a search term reaches, or absent when it stays on this PC. */
  readonly host?: string;
  search(
    query: string,
    cursor: string | undefined,
    ctx: SourceContext,
  ): Promise<SearchPage>;
  bytesOf(
    resultId: string,
    ctx: SourceContext,
  ): Promise<SourceBytes | undefined>;
  creditsOf(result: AssetResult): ThemeCreditsEntry;
}

/**
 * Where the catalogue lives: its listing, and the pictures stored beside it.
 *
 * One owner for the address, so pointing the product at another repo is one
 * edit rather than a search.
 */

export const CATALOGUE_INDEX_URL =
  "https://raw.githubusercontent.com/peterng1618/yunari-store/main/index.json";

export const CATALOGUE_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/peterng1618/yunari-store@main/catalogue";

/** An item's picture. The entry's `thumbnail` is a path inside the repo, and a
 *  leading slash would double the separator the base already holds. */
export function catalogueThumbnailUrl(path: string): string {
  return `${CATALOGUE_CDN_BASE}/${path.replace(/^\/+/, "")}`;
}

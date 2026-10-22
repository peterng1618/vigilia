/**
 * Where the catalogue's published files are read from, owned once.
 *
 * The submitter writes an item's `packageUrl` from this and the validator
 * requires it exactly: a URL that merely ends with the right path could name
 * another host, and the host would download bytes the reviewed PR never carried.
 */

export const CATALOGUE_RAW_BASE =
  "https://raw.githubusercontent.com/peterng1618/vigilia-store/main";

/** The header's `packageUrl` for one catalogue id. */
export function cataloguePackageUrl(id: string): string {
  return `${CATALOGUE_RAW_BASE}/catalogue/${id}/${id}.zip`;
}

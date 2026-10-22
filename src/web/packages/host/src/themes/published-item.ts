import {
  type FabricThemeEnvelope,
  parseCatalogueItemFile,
} from "@vigilia/renderer-core";
import { isSemanticVersion, readThemePackage } from "@vigilia/theme-package";
import { CATALOGUE_RAW_BASE, cataloguePackageUrl } from "./catalogue-source.js";

/**
 * What the store already holds for an id, read before a submission computes its
 * version. A missing item is ordinary (the submission is a first release);
 * everything else that goes wrong is one of two sentences, never a URL, a path
 * or a response body.
 */

export interface PublishedItem {
  readonly version: string;
  readonly createdAt: string;
  readonly downloads: number;
  readonly favorites: number;
  readonly envelope: FabricThemeEnvelope;
}

export type PublishedItemResult =
  | { readonly ok: true; readonly item?: PublishedItem }
  | { readonly ok: false; readonly message: string };

const ITEM_UNREADABLE =
  "The store's copy of this theme could not be read; submit again when it is reachable.";
const PACKAGE_UNOPENABLE =
  "The store's copy of this theme cannot be opened, so its version cannot be computed.";

/** Long enough for a slow line, short enough that a stuck store is a refusal. */
const FETCH_TIMEOUT_MS = 15_000;

export async function readPublishedItem(
  id: string,
  options?: { readonly fetch?: typeof globalThis.fetch },
): Promise<PublishedItemResult> {
  const fetcher = options?.fetch ?? globalThis.fetch;

  const itemResponse = await get(
    fetcher,
    `${CATALOGUE_RAW_BASE}/catalogue/${id}/item.json`,
  );
  if (itemResponse === undefined) return refused(ITEM_UNREADABLE);
  // No item yet is the first publication, not a failure.
  if (itemResponse.status === 404) {
    await drain(itemResponse);
    return { ok: true };
  }
  if (!itemResponse.ok) {
    await drain(itemResponse);
    return refused(ITEM_UNREADABLE);
  }

  let body: unknown;
  try {
    body = await itemResponse.json();
  } catch {
    return refused(ITEM_UNREADABLE);
  }
  const parsed = parseCatalogueItemFile(body);
  if (!parsed.ok) return refused(ITEM_UNREADABLE);
  const file = parsed.file;
  if (!isSemanticVersion(file.version)) {
    return refused(
      `The store's copy of this theme records version "${file.version}", which cannot be bumped.`,
    );
  }

  // The fixed catalogue address, not the item's own `packageUrl`: a header
  // cannot choose where the host downloads from.
  const packageResponse = await get(fetcher, cataloguePackageUrl(id));
  if (packageResponse === undefined || !packageResponse.ok) {
    if (packageResponse !== undefined) await drain(packageResponse);
    return refused(PACKAGE_UNOPENABLE);
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await packageResponse.arrayBuffer());
  } catch {
    return refused(PACKAGE_UNOPENABLE);
  }
  const opened = readThemePackage(bytes);
  if (!opened.ok) return refused(PACKAGE_UNOPENABLE);
  // A package served under this id but carrying another item's envelope would
  // compute a version against the wrong document.
  if (opened.envelope.id !== id) return refused(PACKAGE_UNOPENABLE);

  return {
    ok: true,
    item: {
      version: file.version,
      createdAt: file.createdAt,
      downloads: file.downloads,
      favorites: file.favorites,
      envelope: opened.envelope,
    },
  };
}

/** A thrown fetch, an abort or a timeout is no answer at all. */
async function get(
  fetcher: typeof globalThis.fetch,
  url: string,
): Promise<Response | undefined> {
  try {
    return await fetcher(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return undefined;
  }
}

/** Releasing a body this module does not read is what frees the connection. */
async function drain(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

function refused(message: string): PublishedItemResult {
  return { ok: false, message };
}

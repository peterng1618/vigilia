import type { ItemRow, VersionRow } from "./types.js";

/** One stored item and the version a listing shows it at. */
export interface Listing {
  readonly item: ItemRow;
  readonly version: VersionRow;
}

/**
 * Every published item with its latest version, for the index.
 *
 * "Latest" is the greatest `created_at` — the finalize instant — with `rowid` as
 * the tiebreak, so it follows the ladder rather than the version text.
 */
export async function publishedListings(
  db: D1Database,
): Promise<readonly Listing[]> {
  const items = await db
    .prepare(
      "SELECT * FROM item WHERE status = 'published' ORDER BY updated_at DESC, id",
    )
    .all<ItemRow>();
  const versions = await db
    .prepare(
      `SELECT v.* FROM item_version v
       JOIN item i ON i.id = v.item_id
       WHERE i.status = 'published'
         AND v.rowid = (
           SELECT v2.rowid FROM item_version v2
           WHERE v2.item_id = v.item_id
           ORDER BY v2.created_at DESC, v2.rowid DESC
           LIMIT 1
         )`,
    )
    .all<VersionRow>();
  const latest = new Map(versions.results.map((row) => [row.item_id, row]));
  return items.results.flatMap((item) => {
    const version = latest.get(item.id);
    return version === undefined ? [] : [{ item, version }];
  });
}

export async function itemById(
  db: D1Database,
  itemId: string,
): Promise<ItemRow | undefined> {
  return (
    (await db
      .prepare("SELECT * FROM item WHERE id = ?")
      .bind(itemId)
      .first<ItemRow>()) ?? undefined
  );
}

/** Any state's newest version; the caller decides whether it may be shown. */
export async function latestVersion(
  db: D1Database,
  itemId: string,
): Promise<VersionRow | undefined> {
  return (
    (await db
      .prepare(
        `SELECT * FROM item_version WHERE item_id = ?
         ORDER BY created_at DESC, rowid DESC LIMIT 1`,
      )
      .bind(itemId)
      .first<VersionRow>()) ?? undefined
  );
}

export async function versionOf(
  db: D1Database,
  itemId: string,
  version: string,
): Promise<VersionRow | undefined> {
  return (
    (await db
      .prepare("SELECT * FROM item_version WHERE item_id = ? AND version = ?")
      .bind(itemId, version)
      .first<VersionRow>()) ?? undefined
  );
}

/**
 * The one counter the store owns. The status predicate is repeated here rather
 * than trusted from the caller's read: an unpublish between the read and this
 * write must not count, and the answer says whether it did.
 */
export async function bumpDownloads(
  db: D1Database,
  itemId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE item SET downloads = downloads + 1 WHERE id = ? AND status = 'published'",
    )
    .bind(itemId)
    .run();
  return result.meta.changes > 0;
}

/** Counted live per item; Task 3.3 replaces this with one batched read. */
export async function favoritesOf(
  db: D1Database,
  itemId: string,
): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM favorite WHERE item_id = ?")
    .bind(itemId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

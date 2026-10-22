/**
 * Favourites: the one write path and the live counts the public reads use.
 *
 * A favourite outlives an item's status — unpublish and takedown keep the rows,
 * the public listing simply stops showing the item — so nothing here deletes on
 * a status change and no cleanup runs on a schedule.
 */

/**
 * Adds or removes one account's favourite. The answer is only about the write:
 * the route reads the item's total afterwards.
 *
 * A PUT is refused with `"not-found"` unless the item is published, so a
 * hidden or future id cannot be probed; a DELETE is allowed in any state,
 * because an author who withdrew an item must still be able to drop it.
 * `INSERT OR IGNORE` makes the PUT idempotent on the `(user_id, item_id)` key.
 */
export async function toggleFavorite(
  db: D1Database,
  userId: string,
  itemId: string,
  on: boolean,
): Promise<"ok" | "not-found"> {
  const item =
    (await db
      .prepare("SELECT status FROM item WHERE id = ?")
      .bind(itemId)
      .first<{ status: string }>()) ?? undefined;
  if (item === undefined) return "not-found";
  if (on && item.status !== "published") return "not-found";

  if (on) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO favorite (user_id, item_id, created_at) VALUES (?, ?, ?)",
      )
      .bind(userId, itemId, new Date().toISOString())
      .run();
  } else {
    await db
      .prepare("DELETE FROM favorite WHERE user_id = ? AND item_id = ?")
      .bind(userId, itemId)
      .run();
  }
  return "ok";
}

/** One item's total. The single-item read is worth its own query. */
export async function favoriteCount(
  db: D1Database,
  itemId: string,
): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM favorite WHERE item_id = ?")
    .bind(itemId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Every named item's total in one query, for the index: a per-entry read would
 * be one round-trip per listed theme. Missing ids are absent, so the caller
 * treats `map.get(id) ?? 0` as zero.
 *
 * An id always comes from a stored row here, never from a client, so an empty
 * string is a bug rather than a bad request.
 */
export async function countsByItem(
  db: D1Database,
  ids: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  if (ids.length === 0) return new Map();
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0)
      throw new Error("countsByItem needs non-empty item ids.");
  }
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await db
    .prepare(
      `SELECT item_id, COUNT(*) AS n FROM favorite
       WHERE item_id IN (${placeholders}) GROUP BY item_id`,
    )
    .bind(...ids)
    .all<{ item_id: string; n: number }>();
  return new Map(rows.results.map((row) => [row.item_id, row.n]));
}

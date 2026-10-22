import { env, SELF } from "cloudflare:test";
import type {
  CatalogueIndex,
  CatalogueStatus,
  FacetRecord,
} from "@yunari/renderer-core";
import { packageKey, thumbnailKey } from "../src/storage/keys";

/** Fixed ids and bytes so a spec can name what it seeded without a second read. */
export const ITEM_ID = "6041df49-9c61-4d51-a184-716890560bdb";
export const PACKAGE_BYTES = new TextEncoder().encode("yunari test package");

const CREATED_AT = "2026-10-01T00:00:00.000Z";
const FACETS: FacetRecord = {
  author: "Huy",
  colourMode: "dark",
  sensors: [{ key: "cpu.usage", label: "CPU", family: "cpu" }],
  tags: ["minimal"],
  orientation: "landscape",
  aspect: "16:9",
  width: 1280,
  height: 720,
};
const ENVELOPE_JSON = JSON.stringify({ schemaVersion: 2, metadata: {} });

export interface SeedOptions {
  readonly versions?: readonly string[];
  readonly downloads?: number;
  readonly favorites?: number;
  readonly owner?: string;
  readonly status?: CatalogueStatus;
}

/**
 * One item row, its versions, their package objects and its thumbnail.
 *
 * `status` is written as given, because every public read's test needs an item
 * that holds its rows and objects but must not answer — the unpublish shape.
 */
export async function seedPublished(options: SeedOptions = {}): Promise<void> {
  const versions = options.versions ?? ["1.0.0"];
  const status = options.status ?? "published";
  const favorites = options.favorites ?? 0;

  // The pool keeps D1 rows and R2 objects between tests in one file, so the
  // helper clears its own fixed id rather than relying on isolated storage.
  await env.DB.prepare("DELETE FROM item WHERE id = ?").bind(ITEM_ID).run();
  await env.DB.prepare("DELETE FROM item_version WHERE item_id = ?")
    .bind(ITEM_ID)
    .run();
  await env.DB.prepare("DELETE FROM favorite WHERE item_id = ?")
    .bind(ITEM_ID)
    .run();

  await env.DB.prepare(
    `INSERT INTO item (id, kind, author_user_id, name, status, status_reason,
       created_at, updated_at, published_at, unpublished_at, removed_at,
       downloads, remix_of_id)
     VALUES (?, 'dashboard-theme', ?, 'Yunari smoke theme', ?, NULL, ?, ?, ?, NULL, NULL, ?, NULL)`,
  )
    .bind(
      ITEM_ID,
      options.owner ?? "user-author",
      status,
      CREATED_AT,
      CREATED_AT,
      status === "published" ? CREATED_AT : null,
      options.downloads ?? 0,
    )
    .run();

  for (const [index, version] of versions.entries()) {
    await env.DB.prepare(
      `INSERT INTO item_version (item_id, version, envelope_json, facets_json,
         package_key, thumbnail_key, bytes, sha256, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        ITEM_ID,
        version,
        ENVELOPE_JSON,
        JSON.stringify(FACETS),
        packageKey(ITEM_ID, version),
        thumbnailKey(ITEM_ID),
        PACKAGE_BYTES.byteLength,
        "0".repeat(64),
        versionInstant(index),
      )
      .run();
    await putPackage(packageKey(ITEM_ID, version), PACKAGE_BYTES);
  }

  await env.BUCKET.put(thumbnailKey(ITEM_ID), PNG_BYTES);

  for (let index = 0; index < favorites; index += 1) {
    await env.DB.prepare(
      "INSERT INTO favorite (user_id, item_id, created_at) VALUES (?, ?, ?)",
    )
      .bind(`favorite-${index}`, ITEM_ID, CREATED_AT)
      .run();
  }
}

export async function putPackage(
  key: string,
  bytes: Uint8Array,
): Promise<void> {
  await env.BUCKET.put(key, bytes);
}

export async function downloads(
  db: D1Database,
  itemId: string,
): Promise<number> {
  const row = await db
    .prepare("SELECT downloads FROM item WHERE id = ?")
    .bind(itemId)
    .first<{ downloads: number }>();
  return row?.downloads ?? 0;
}

export async function versionsOf(
  db: D1Database,
  itemId: string,
): Promise<readonly string[]> {
  const rows = await db
    .prepare(
      "SELECT version FROM item_version WHERE item_id = ? ORDER BY created_at",
    )
    .bind(itemId)
    .all<{ version: string }>();
  return rows.results.map((row) => row.version);
}

export async function statusOf(
  db: D1Database,
  itemId: string,
): Promise<CatalogueStatus | undefined> {
  const row = await db
    .prepare("SELECT status FROM item WHERE id = ?")
    .bind(itemId)
    .first<{ status: CatalogueStatus }>();
  return row?.status;
}

/** The listing's ids as the editor receives them, not as D1 stores them. */
export async function indexIds(): Promise<readonly string[]> {
  const response = await SELF.fetch("https://store.test/index.json");
  const index = (await response.json()) as CatalogueIndex;
  return index.entries.map((entry) => entry.id);
}

/** Later versions are inserted later, so `created_at` orders the ladder. */
function versionInstant(index: number): string {
  return new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString();
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

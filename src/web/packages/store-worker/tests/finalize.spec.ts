import { env, SELF } from "cloudflare:test";
import { type FabricThemeEnvelope, facetRecordOf } from "@yunari/renderer-core";
import { MAX_ARCHIVE_BYTES } from "@yunari/theme-package";
import { beforeAll, describe, expect, it } from "vitest";
import { packageKey, thumbnailKey } from "../src/storage/keys";
import {
  BASE,
  candidate,
  createVersion,
  sessionHeaders,
  USER_ID,
} from "./helpers";
import {
  ITEM_ID,
  indexIds,
  PACKAGE_BYTES,
  putPackage,
  seedItem,
  statusOf,
  versionsOf,
} from "./seed";

const FOREIGN_ID = "00000000-0000-4000-8000-000000000000";
const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const THUMBNAIL_PNG = base64Of(PNG_SIGNATURE);
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

describe("finalize", () => {
  beforeAll(async () => {
    // Better Auth owns `user` and `session`; only `/migrate` creates them.
    const migrated = await SELF.fetch(`${BASE}/migrate`, {
      method: "POST",
      headers: { "x-migrate-token": "test-migrate" },
    });
    expect(migrated.status).toBe(200);
  });

  it("queues an unverified author's upload and 404s a missing object", async () => {
    const headers = await sessionHeaders();
    await reset();
    const { version } = await requestVersion(headers);
    await putPackage(packageKey(ITEM_ID, version), PACKAGE_BYTES);

    const response = await finalize(headers, version);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "pending",
      version,
    });
    expect(await statusOf(env.DB, ITEM_ID)).toBe("pending");
    expect(await indexIds()).not.toContain(ITEM_ID);

    const row = await env.DB.prepare(
      "SELECT * FROM item_version WHERE item_id = ? AND version = ?",
    )
      .bind(ITEM_ID, version)
      .first<{
        envelope_json: string;
        facets_json: string;
        package_key: string;
        thumbnail_key: string;
        bytes: number;
        sha256: string;
      }>();
    expect(row?.package_key).toBe(packageKey(ITEM_ID, version));
    expect(row?.thumbnail_key).toBe(thumbnailKey(ITEM_ID));
    expect(row?.bytes).toBe(PACKAGE_BYTES.byteLength);
    expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.facets_json).toBe(
      JSON.stringify(
        facetRecordOf(candidate(ITEM_ID) as unknown as FabricThemeEnvelope),
      ),
    );

    const thumbnail = await env.BUCKET.get(thumbnailKey(ITEM_ID));
    expect(thumbnail?.httpMetadata?.contentType).toBe("image/png");

    // The version row now exists, but a missing object is still a 404.
    await env.BUCKET.delete(packageKey(ITEM_ID, version));
    expect((await finalize(headers, version)).status).toBe(404);
  });

  it("refuses an object past MAX_ARCHIVE_BYTES without storing a version", async () => {
    const headers = await sessionHeaders();
    await reset();
    const { version } = await requestVersion(headers);
    await putPackage(
      packageKey(ITEM_ID, version),
      new Uint8Array(MAX_ARCHIVE_BYTES + 1),
    );

    const response = await finalize(headers, version);
    expect(response.status).toBe(422);
    expect(await versionsOf(env.DB, ITEM_ID)).toEqual([]);
    expect(await env.BUCKET.get(thumbnailKey(ITEM_ID))).toBeNull();
  });

  it("returns a rejected item to the queue on a new version, verified or not", async () => {
    const headers = await sessionHeaders();
    await reset();
    await seedItem(ITEM_ID, USER_ID, {
      status: "rejected",
      statusReason: "Not yet.",
    });
    await env.DB.prepare(
      `INSERT INTO author_profile (user_id, verified) VALUES (?, 1)
       ON CONFLICT(user_id) DO UPDATE SET verified = 1`,
    )
      .bind(USER_ID)
      .run();
    const { version } = await requestVersion(headers);
    await putPackage(packageKey(ITEM_ID, version), PACKAGE_BYTES);

    const response = await finalize(headers, version);
    expect(response.status).toBe(200);
    // `rejected -> pending` outranks the verified author's publish rule.
    expect(await response.json()).toEqual({
      ok: true,
      status: "pending",
      version,
    });
    expect(await statusOf(env.DB, ITEM_ID)).toBe("pending");
  });

  it("publishes a verified author's upload and is idempotent per version", async () => {
    const headers = await sessionHeaders();
    await reset();
    await env.DB.prepare(
      `INSERT INTO author_profile (user_id, verified) VALUES (?, 1)
       ON CONFLICT(user_id) DO UPDATE SET verified = 1`,
    )
      .bind(USER_ID)
      .run();
    const { version } = await requestVersion(headers);
    await putPackage(packageKey(ITEM_ID, version), PACKAGE_BYTES);

    const first = await finalize(headers, version);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      ok: true,
      status: "published",
      version,
    });
    expect(await indexIds()).toContain(ITEM_ID);
    const published = await env.DB.prepare(
      "SELECT published_at FROM item WHERE id = ?",
    )
      .bind(ITEM_ID)
      .first<{ published_at: string | null }>();
    expect(published?.published_at).not.toBeNull();

    const again = await finalize(headers, version);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({
      ok: true,
      status: "published",
      version,
    });
    expect(await versionsOf(env.DB, ITEM_ID)).toEqual([version]);

    await putPackage(
      packageKey(ITEM_ID, version),
      new TextEncoder().encode("different bytes"),
    );
    expect((await finalize(headers, version)).status).toBe(409);
  });

  it("refuses a foreign or removed item and a version nobody requested", async () => {
    const headers = await sessionHeaders();
    await reset();

    await seedItem(FOREIGN_ID, "somebody-else");
    expect(
      (await finalize(headers, "1.0.0", THUMBNAIL_PNG, FOREIGN_ID)).status,
    ).toBe(404);

    await seedItem(ITEM_ID, USER_ID, {
      status: "removed",
      statusReason: "Owner took it down.",
    });
    const removed = await finalize(headers, "1.0.0");
    expect(removed.status).toBe(409);
    expect(await removed.text()).toBe("Owner took it down.");

    await seedItem(ITEM_ID, USER_ID, { status: "draft" });
    expect((await finalize(headers, "1.0.0")).status).toBe(409);
  });

  it("refuses a thumbnail that is not a PNG or is over 2 MiB", async () => {
    const headers = await sessionHeaders();
    await reset();
    const { version } = await requestVersion(headers);
    await putPackage(packageKey(ITEM_ID, version), PACKAGE_BYTES);

    const notPng = await finalize(headers, version, base64Of(utf8("GIF89a")));
    expect(notPng.status).toBe(422);

    const big = new Uint8Array(MAX_THUMBNAIL_BYTES + 1);
    big.set(PNG_SIGNATURE);
    expect((await finalize(headers, version, base64Of(big))).status).toBe(422);

    expect(await versionsOf(env.DB, ITEM_ID)).toEqual([]);
    expect(await env.BUCKET.get(thumbnailKey(ITEM_ID))).toBeNull();
  });
});

/** A fresh item, presign records and objects for each test in this file. */
async function reset(): Promise<void> {
  await env.DB.prepare("DELETE FROM item_version WHERE item_id = ?")
    .bind(ITEM_ID)
    .run();
  await env.DB.prepare("DELETE FROM item WHERE id = ?").bind(ITEM_ID).run();
  await env.DB.prepare("DELETE FROM favorite WHERE item_id = ?")
    .bind(ITEM_ID)
    .run();
  await env.DB.prepare("DELETE FROM presign_event WHERE user_id = ?")
    .bind(USER_ID)
    .run();
  await env.DB.prepare("DELETE FROM author_profile WHERE user_id = ?")
    .bind(USER_ID)
    .run();
  const packages = await env.BUCKET.list({ prefix: `packages/${ITEM_ID}/` });
  const keys = packages.objects.map((object) => object.key);
  if (keys.length > 0) await env.BUCKET.delete(keys);
  await env.BUCKET.delete(thumbnailKey(ITEM_ID));
}

/** Requests a version as the session's author and returns its computed version. */
async function requestVersion(
  headers: Record<string, string>,
): Promise<{ version: string; status: string }> {
  const response = await createVersion(headers, ITEM_ID);
  expect(response.status).toBe(200);
  return (await response.json()) as { version: string; status: string };
}

async function finalize(
  headers: Record<string, string>,
  version: string,
  thumbnail: string = THUMBNAIL_PNG,
  itemId: string = ITEM_ID,
): Promise<Response> {
  return SELF.fetch(
    `${BASE}/api/me/items/${itemId}/versions/${version}/finalize`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ thumbnail }),
    },
  );
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function base64Of(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x2000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x2000));
  return btoa(binary);
}

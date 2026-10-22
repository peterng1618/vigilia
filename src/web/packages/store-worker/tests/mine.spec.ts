import { env, SELF } from "cloudflare:test";
import type { MineEntry } from "@yunari/renderer-core";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BASE, sessionHeaders, USER_ID } from "./helpers";
import { ITEM_ID, seedItem, seedPublished, seedStatus } from "./seed";

const OTHER_ID = "11111111-1111-4111-8111-111111111111";
const THIRD_ID = "22222222-2222-4222-8222-222222222222";
const STRANGER = "user-stranger";

describe("GET /api/me/items", () => {
  beforeAll(async () => {
    // Better Auth owns `user`; only `/migrate` creates it.
    const migrated = await SELF.fetch(`${BASE}/migrate`, {
      method: "POST",
      headers: { "x-migrate-token": "test-migrate" },
    });
    expect(migrated.status).toBe(200);
  });

  beforeEach(async () => {
    // The pool keeps D1 rows between a file's tests; every case seeds its own.
    for (const owner of [USER_ID, STRANGER]) {
      await env.DB.prepare(
        "DELETE FROM item_version WHERE item_id IN (SELECT id FROM item WHERE author_user_id = ?)",
      )
        .bind(owner)
        .run();
      await env.DB.prepare("DELETE FROM item WHERE author_user_id = ?")
        .bind(owner)
        .run();
    }
  });

  it("returns the author's unpublished and pending items and nobody else's", async () => {
    const headers = await sessionHeaders();
    await seedPublished({ owner: USER_ID });
    await seedStatus({ id: OTHER_ID, owner: USER_ID, status: "unpublished" });
    await seedStatus({ id: THIRD_ID, owner: STRANGER, status: "published" });

    const body = await mine(headers);

    expect(body.entries.map((entry) => entry.id).sort()).toEqual(
      [ITEM_ID, OTHER_ID].sort(),
    );
    expect(body.entries.find((entry) => entry.id === OTHER_ID)?.status).toBe(
      "unpublished",
    );
    expect(body.entries.some((entry) => entry.id === THIRD_ID)).toBe(false);
  });

  it("draws a row from the latest version, its live favourites and the request origin", async () => {
    const headers = await sessionHeaders();
    await seedPublished({
      owner: USER_ID,
      versions: ["1.0.0", "1.0.1"],
      downloads: 2,
      favorites: 3,
    });

    const [entry, ...rest] = (await mine(headers)).entries;

    expect(rest).toEqual([]);
    expect(entry).toMatchObject({
      id: ITEM_ID,
      version: "1.0.1",
      downloads: 2,
      favorites: 3,
      packageUrl: `${BASE}/catalogue/${ITEM_ID}/1.0.1.zip`,
      thumbnail: `catalogue/${ITEM_ID}/thumbnail.png`,
      status: "published",
    });
    // Absent, not present-and-undefined: `exactOptionalPropertyTypes`.
    expect(entry !== undefined && "statusReason" in entry).toBe(false);
  });

  it("carries the owner's sentence for a rejected item", async () => {
    const headers = await sessionHeaders();
    await seedStatus({
      id: OTHER_ID,
      owner: USER_ID,
      status: "rejected",
      statusReason: "Broken preview",
    });

    const [entry] = (await mine(headers)).entries;

    expect(entry).toMatchObject({
      id: OTHER_ID,
      status: "rejected",
      statusReason: "Broken preview",
    });
  });

  it("keeps a versioned draft and drops the versionless presign leftover", async () => {
    const headers = await sessionHeaders();
    await seedItem(ITEM_ID, USER_ID, { status: "draft" });
    await seedStatus({ id: OTHER_ID, owner: USER_ID, status: "draft" });

    expect((await mine(headers)).entries.map((entry) => entry.id)).toEqual([
      OTHER_ID,
    ]);
  });

  it("orders newest first and breaks a tie by id", async () => {
    const headers = await sessionHeaders();
    await seedStatus({
      id: OTHER_ID,
      owner: USER_ID,
      status: "pending",
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
    await seedStatus({
      id: THIRD_ID,
      owner: USER_ID,
      status: "unpublished",
      updatedAt: "2026-10-03T00:00:00.000Z",
    });

    expect((await mine(headers)).entries.map((entry) => entry.id)).toEqual([
      THIRD_ID,
      OTHER_ID,
    ]);

    await env.DB.prepare("UPDATE item SET updated_at = ?")
      .bind("2026-10-04T00:00:00.000Z")
      .run();
    expect((await mine(headers)).entries.map((entry) => entry.id)).toEqual([
      OTHER_ID,
      THIRD_ID,
    ]);
  });

  it("401s without a session", async () => {
    const response = await SELF.fetch(`${BASE}/api/me/items`);
    expect(response.status).toBe(401);
  });
});

async function mine(headers: Record<string, string>): Promise<{
  readonly entries: readonly MineEntry[];
}> {
  const response = await SELF.fetch(`${BASE}/api/me/items`, { headers });
  expect(response.status).toBe(200);
  return (await response.json()) as { readonly entries: readonly MineEntry[] };
}

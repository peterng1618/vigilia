# R2 Store Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the GitHub catalogue with a Cloudflare Worker, D1 and a private R2 bucket that serves the store's public reads, accepts authenticated submissions, counts downloads and favourites, and lets an author unpublish and republish an item.

**Architecture:** One Worker routes public catalogue reads, Better Auth sessions, author operations and owner-only admin operations. Metadata and counters live in D1; packages and thumbnails live in a private R2 bucket and are only reachable through the Worker. Packages upload through presigned R2 PUTs. The host keeps building and validating packages; the Worker recomputes the version ladder from the submitted envelope and stores the result.

**Tech Stack:** TypeScript, Cloudflare Workers, D1, R2, Better Auth 1.7.12, `aws4fetch` 1.0.20, `@cloudflare/vitest-pool-workers` 0.23.0 with a nested Vitest 4.1.12, Wrangler 4.152.0. Existing packages: `renderer-core`, `theme-package`, `host`, `editor`.

**Spec:** `docs/superpowers/specs/2026-10-22-r2-store-backend-design.md`

## Global Constraints

- Private R2; no public bucket, no `r2.dev`, no direct R2 URL in any client.
- Every public read filters `status = 'published'`; anything else is **404**, never 403.
- Unpublish keeps versions, counters, favourite rows and R2 bytes; republish restores them.
- Download and favourite counts are server-side facts. No client beacon writes a count.
- A presigned upload key is derived from the session and the computed version; the client never names a path.
- The Worker recomputes the version with `classifyThemeChange`, `versionFor`, `facetRecordOf` and `validateFabricThemeEnvelope`; a claimed version that disagrees is refused.
- `MAX_ARCHIVE_BYTES` is 95 MiB; the Worker request body cap is 100 MB. Packages never pass through a Worker request body.
- Quotas per account: 20 items, 1 GiB of package bytes.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled; refuse invalid numeric input rather than coercing it.
- Normal source files: 500 lines is a signal, 800 is a stop.
- New dependencies are verified from metadata and recorded in `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md`.
- No secret reaches the editor bundle or a JSON response; the host owns the session token.
- The free-tier claim is not made until index and auth CPU are measured.

## Review Focus

- **A package URL shared before unpublish still serving bytes.** Every version, not just the latest, must 404 after unpublish; the test seeds two versions. (Tasks 1.3, 3.2)
- **The download counter drifting from the bytes served.** A cached response, a missing object or a double increment must not be counted; the test asserts `no-store`, exactly one increment per request, and no increment on a 404. (Task 1.3)
- **The version ladder disagreeing with what the client wrote.** A race or a tampered client must be refused against the stored envelope, including for an `unpublished` baseline. (Tasks 1.2, 2.2, 2.4)
- **The session token leaking to the page or the logs.** The host file is `0600`, no route returns the token, and the editor only learns `signedIn`. (Tasks 2.5, 2.6)
- **A presigned upload escaping its item.** A foreign item id, a crafted key or a path traversal must be refused before signing. (Task 2.3)

---

## Phase 1 — The Worker serves a public catalogue

### Task 1.1: Worker package, bindings, D1 schema and test harness

**Files:**
- Create: `src/web/packages/store-worker/package.json`
- Create: `src/web/packages/store-worker/tsconfig.json`
- Create: `src/web/packages/store-worker/wrangler.toml`
- Create: `src/web/packages/store-worker/vitest.config.ts`
- Create: `src/web/packages/store-worker/src/env.ts`
- Create: `src/web/packages/store-worker/src/index.ts`
- Create: `src/web/packages/store-worker/migrations/0001_catalogue.sql`
- Create: `src/web/packages/store-worker/tests/apply-migrations.ts`
- Create: `src/web/packages/store-worker/tests/harness.spec.ts`
- Modify: `src/web/package.json` — add the workspace, `test:worker`, and the gate step
- Modify: `THIRD-PARTY-NOTICES.md`, `docs/engineering/dependencies.md`

**Interfaces:**
- Produces: `Env` with `DB: D1Database`, `BUCKET: R2Bucket`, `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `OWNER_EMAILS`, `MIGRATE_TOKEN`, `TEST_MODE?`, `TEST_MIGRATIONS?`.
- Produces: `export default { fetch(request, env, ctx) }` in `src/index.ts`, answering `GET /api/health` with `{ ok: true }`.

- [ ] **Step 1: Write the failing harness test**

```ts
import { SELF, env } from "cloudflare:test";
import { expect, it } from "vitest";

it("answers health and reaches the D1 binding", async () => {
  const response = await SELF.fetch("https://store.test/api/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM item").first();
  expect(row).toEqual({ n: 0 });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @vigilia/store-worker`
Expected: FAIL — the package or the route does not exist.

- [ ] **Step 3: Create the package and configuration**

`package.json`: name `@vigilia/store-worker`, private, type module, `main`/`exports` `./src/index.ts`, scripts `deploy: wrangler deploy`, `dev: wrangler dev`, `test: vitest run --config vitest.config.ts`, `typecheck: tsc --noEmit -p tsconfig.json`. Dependencies `better-auth@1.7.12`, `aws4fetch@1.0.20`. Dev dependencies `@cloudflare/vitest-pool-workers@0.23.0`, `@cloudflare/workers-types@5.20261022.1`, `vitest@4.1.12`, `wrangler@4.152.0`. The nested Vitest 4 is required because the Workers pool's peer range is `^4.1.0` while the workspace runs Vitest 5; say so in a `//` key in the manifest.

`wrangler.toml`: worker name `vigilia-store`, `main = "src/index.ts"`, `compatibility_date = "2026-10-22"`, `compatibility_flags = ["nodejs_compat"]`, D1 binding `DB` named `vigilia-store` with `database_id = "00000000-0000-0000-0000-000000000000"`, R2 binding `BUCKET` named `vigilia-store-packages`. Task 5.2 replaces the id after `wrangler d1 create`. Add `[vars]` with no secrets.

`vitest.config.ts`: `defineWorkersConfig` with `wrangler.configPath`, `miniflare.bindings` carrying `TEST_MIGRATIONS = await readD1Migrations("./migrations")`, `TEST_MODE: "1"`, `MIGRATE_TOKEN: "test-migrate"`, `BETTER_AUTH_SECRET: "test-secret"`, `OWNER_EMAILS: "owner@example.com"`, and the R2 signing values the presign tests read, and `setupFiles: ["./tests/apply-migrations.ts"]`.

`tests/apply-migrations.ts`: `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`.

`migrations/0001_catalogue.sql`: `item`, `item_version`, `favorite`, `author_profile` and `presign_event` exactly as the spec's data model, with `CHECK` on `status` and the indexes `item(status)`, `item(author_user_id)`, `favorite(item_id)`, `presign_event(user_id, at)`. `item_version.package_key` and `thumbnail_key` are `NOT NULL`; `facet` columns are `TEXT NOT NULL`.

Root `package.json`: add `"packages/store-worker"` to `workspaces`, `"test:worker": "npm run test -w @vigilia/store-worker"`, and insert `&& npm run test:worker` into `gate` immediately after `npm run test`.

Record both new runtime dependencies and the dev-only Workers tooling in the notices and dependency map before installing.

- [ ] **Step 4: Implement the minimal health route and run the test**

`src/index.ts` answers `/api/health`; `src/env.ts` exports `Env`. Run `npm install` from `src/web`, then `npm run test -w @vigilia/store-worker`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/package.json src/web/packages/store-worker THIRD-PARTY-NOTICES.md docs/engineering/dependencies.md package-lock.json
git commit -m "feat(store-worker): add the Worker, D1 schema and Workers test harness"
```

### Task 1.2: Catalogue projections and the index document

**Files:**
- Create: `src/web/packages/store-worker/src/db/types.ts`
- Create: `src/web/packages/store-worker/src/catalogue/entry.ts`
- Create: `src/web/packages/store-worker/src/catalogue/entry.test.ts`
- Create: `src/web/packages/store-worker/src/version/plan.ts`
- Create: `src/web/packages/store-worker/src/version/plan.test.ts`

**Interfaces:**
- Consumes: `CatalogueEntry`, `CatalogueItemFile`, `CatalogueIndex`, `FacetRecord` from `@vigilia/renderer-core`; `classifyThemeChange`, `versionFor`, `type VersionLevel` from `@vigilia/theme-package`.
- Produces: in `renderer-core/src/theme/catalogue-index.ts`, `export type CatalogueStatus = "draft" | "pending" | "published" | "unpublished" | "rejected" | "removed"` and `export interface MineEntry extends CatalogueEntry { readonly status: CatalogueStatus; readonly statusReason?: string }`.
- Produces: `interface ItemRow`, `interface VersionRow` in `db/types.ts`.
- Produces: `entryOf(item: ItemRow, version: VersionRow, favorites: number, packageUrl: string, thumbnailUrl: string): CatalogueEntry`.
- Produces: `itemFileOf(entry: CatalogueEntry): CatalogueItemFile`.
- Produces: `indexDocument(entries: readonly CatalogueEntry[], generatedAt: string): CatalogueIndex`.
- Produces: `planVersion(input: { previous: { version: string; envelope: FabricThemeEnvelope } | undefined; candidate: FabricThemeEnvelope; now: string }): { ok: true; version: string; level: VersionLevel; facets: FacetRecord } | { ok: false; message: string }`.

- [ ] **Step 1: Write the failing projection tests**

```ts
it("maps a published row to the wire entry the parser accepts", () => {
  const entry = entryOf(itemRow(), versionRow(), 7, "https://s/x.zip", "https://s/t.png");
  expect(entry).toMatchObject({ id: ITEM_ID, kind: "dashboard-theme", downloads: 3, favorites: 7 });
  expect(indexDocument([entry], "2026-10-23T00:00:00.000Z").entries).toHaveLength(1);
  expect(itemFileOf(entry)).not.toHaveProperty("facets");
});
```

- [ ] **Step 2: Write the failing version-plan tests**

```ts
it("bumps from the stored envelope and refuses a claimed version that disagrees", () => {
  const previous = { version: "1.0.0", envelope: baseEnvelope() };
  const changed = { ...baseEnvelope(), artboard: { width: 800, height: 600 } };
  const planned = planVersion({ previous, candidate: { ...changed, metadata: { ...changed.metadata, version: "2.0.0" } }, now: NOW });
  expect(planned).toMatchObject({ ok: true, version: "2.0.0", level: "major" });
  expect(planVersion({ previous, candidate: { ...changed, metadata: { ...changed.metadata, version: "1.0.1" } }, now: NOW }))
    .toMatchObject({ ok: false });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npm run test -w @vigilia/store-worker -- src/catalogue/entry.test.ts src/version/plan.test.ts`
Expected: FAIL — the modules do not exist.

- [ ] **Step 4: Implement the projections and `planVersion`**

`entryOf` reads `facets_json` as `FacetRecord` and `createdAt`/`updatedAt` from the item row. `planVersion` validates the candidate's declared version is present and equals `versionFor(previous?.version, classifyThemeChange(previous?.envelope, candidate))`, refuses `level === "none"`, and returns `facetRecordOf(candidate)`. An `undefined` previous answers `1.0.0`.

- [ ] **Step 5: Run the tests and commit**

Run the same command. Expected: PASS.

```bash
git add src/web/packages/store-worker/src/db/types.ts src/web/packages/store-worker/src/catalogue src/web/packages/store-worker/src/version
git commit -m "feat(store-worker): project catalogue entries and plan versions"
```

### Task 1.3: Public reads, streamed packages and the download counter

**Files:**
- Create: `src/web/packages/store-worker/src/db/items.ts`
- Create: `src/web/packages/store-worker/src/storage/keys.ts`
- Create: `src/web/packages/store-worker/src/storage/objects.ts`
- Create: `src/web/packages/store-worker/src/routes/public.ts`
- Modify: `src/web/packages/store-worker/src/index.ts`
- Create: `src/web/packages/store-worker/tests/seed.ts`
- Create: `src/web/packages/store-worker/tests/public.spec.ts`

**Interfaces:**
- Produces: `packageKey(itemId: string, version: string): string` → `packages/<uuid>/<semver>.zip`; `thumbnailKey(itemId: string): string` → `thumbnails/<uuid>.png`.
- Produces: `publishedListings(db: D1Database): Promise<readonly { item: ItemRow; version: VersionRow }[]>`; `versionOf(db, itemId, version): Promise<VersionRow | undefined>`; `latestVersion(db, itemId): Promise<VersionRow | undefined>`; `bumpDownloads(db, itemId): Promise<boolean>`.
- Produces: `handlePublic(request: Request, env: Env, url: URL): Promise<Response | undefined>`.

- [ ] **Step 1: Write the failing public-route test**

```ts
it("serves the index, then 404s every unpublished read", async () => {
  await seedPublished({ versions: ["1.0.0", "1.0.1"] });
  const index = await SELF.fetch("https://store.test/index.json");
  expect(index.headers.get("cache-control")).toContain("max-age=60");
  expect(await index.json()).toMatchObject({ entries: [{ id: ITEM_ID }] });
  const item = await (await SELF.fetch(`https://store.test/catalogue/${ITEM_ID}/item.json`)).json();
  expect(item).toMatchObject({ id: ITEM_ID, downloads: 0, favorites: 0 });
  expect((await SELF.fetch(`https://store.test/catalogue/${ITEM_ID}/thumbnail.png`)).headers.get("cache-control"))
    .toContain("max-age=300");
  const first = await SELF.fetch(`https://store.test/catalogue/${ITEM_ID}/1.0.0.zip`);
  expect(first.headers.get("cache-control")).toBe("no-store");
  expect((await first.arrayBuffer()).byteLength).toBe(PACKAGE_BYTES.byteLength);
  await env.DB.prepare("UPDATE item SET status = 'unpublished' WHERE id = ?").bind(ITEM_ID).run();
  for (const path of [`item.json`, `thumbnail.png`, `1.0.0.zip`, `1.0.1.zip`]) {
    expect((await SELF.fetch(`https://store.test/catalogue/${ITEM_ID}/${path}`)).status).toBe(404);
  }
  expect(await downloads(env.DB, ITEM_ID)).toBe(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @vigilia/store-worker -- tests/public.spec.ts`
Expected: FAIL — routes are missing.

- [ ] **Step 3: Implement the routes**

`GET /index.json` reads published items with their latest version and favourite counts, builds entries with absolute `packageUrl` and `thumbnail`, and answers `Cache-Control: max-age=60` plus an `ETag` of the body. `GET /catalogue/:id/item.json` and `thumbnail.png` answer only for `published`. `GET /catalogue/:id/:version.zip` opens `env.BUCKET.get(key)`, then calls `bumpDownloads` whose SQL is `UPDATE item SET downloads = downloads + 1 WHERE id = ? AND status = 'published'`; zero rows cancels the body and answers 404. Respond with `Cache-Control: no-store` and `Content-Type: application/zip`.

- [ ] **Step 4: Run the test and the package suite**

Run: `npm run test -w @vigilia/store-worker`
Expected: PASS, including two downloads incrementing twice.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/store-worker/src/db/items.ts src/web/packages/store-worker/src/storage src/web/packages/store-worker/src/routes/public.ts src/web/packages/store-worker/src/index.ts src/web/packages/store-worker/tests
git commit -m "feat(store-worker): serve the catalogue and count downloads"
```

---

## Phase 2 — Identity, submission and the version authority

### Task 2.1: Better Auth on D1, bearer sessions and the migration endpoint

**Files:**
- Create: `src/web/packages/store-worker/src/auth.ts`
- Create: `src/web/packages/store-worker/src/auth/session.ts`
- Create: `src/web/packages/store-worker/src/auth/return-page.ts`
- Modify: `src/web/packages/store-worker/src/index.ts`
- Create: `src/web/packages/store-worker/tests/auth.spec.ts`

**Interfaces:**
- Produces: `createAuth(env: Env)` returning a Better Auth instance with D1, GitHub and Google providers, `bearer()`, `oneTimeToken()`, and `testUtils()` only when `env.TEST_MODE === "1"`.
- Produces: `interface Session { readonly userId: string; readonly email: string }`.
- Produces: `sessionOf(request: Request, env: Env): Promise<Session | undefined>`.
- Produces: `GET /auth/start?provider=github|google&host=<loopback origin>&state=<opaque>` — calls `auth.api.signInSocial` with `callbackURL = <worker>/auth/return?host=…&state=…` and answers a 302 to the provider URL.
- Produces: `returnPage(): Response` — the HTML at `GET /auth/return`.

- [ ] **Step 1: Write the failing auth test**

```ts
beforeAll(async () => {
  const migrated = await SELF.fetch("https://store.test/migrate", {
    method: "POST",
    headers: { "x-migrate-token": "test-migrate" },
  });
  expect(migrated.status).toBe(200);
});

it("refuses a missing or forged bearer session", async () => {
  expect((await SELF.fetch("https://store.test/api/me")).status).toBe(401);
  expect((await SELF.fetch("https://store.test/api/me", {
    headers: { authorization: "Bearer forged.token" },
  })).status).toBe(401);
});

it("accepts a real test session", async () => {
  const auth = createAuth(env);
  const test = (await auth.$context).test;
  const user = await test.saveUser(test.createUser({ email: "a@example.com" }));
  const { headers } = await test.login({ userId: user.id });
  const answered = await SELF.fetch("https://store.test/api/me", { headers });
  expect(answered.status).toBe(200);
  expect(await answered.json()).toMatchObject({ email: "a@example.com" });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @vigilia/store-worker -- tests/auth.spec.ts`
Expected: FAIL — `/migrate` and `/api/me` do not exist.

- [ ] **Step 3: Implement `createAuth`, the session helper, `/migrate` and `/auth/return`**

`/migrate` requires `x-migrate-token` equal to `env.MIGRATE_TOKEN`; a missing token is 404, a wrong one 403. It runs `getMigrations(auth.options)` and `runMigrations()`. `/api/auth/*` delegates to `auth.handler`. `/api/me` uses `sessionOf` and returns `{ userId, email }`. `sessionOf` calls `auth.api.getSession({ headers: request.headers })`.

`/auth/start` validates `host` as `http://127.0.0.1:<port>` or `http://localhost:<port>`, calls `auth.api.signInSocial({ body: { provider, callbackURL } })`, and redirects to the returned URL. `/auth/return` is a static HTML page. Its inline script calls `POST /api/auth/one-time-token/generate` with `credentials: "include"`, then redirects to the `host` query parameter with `token` and the unchanged `state`. Reject a `host` that is not a loopback origin.

- [ ] **Step 4: Run the auth test and the package suite**

Run: `npm run test -w @vigilia/store-worker`
Expected: PASS; a forged bearer is 401 and a real test session reaches `/api/me`.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/store-worker/src/auth.ts src/web/packages/store-worker/src/auth src/web/packages/store-worker/src/index.ts src/web/packages/store-worker/tests/auth.spec.ts
git commit -m "feat(store-worker): add Better Auth sessions and the D1 migration route"
```

### Task 2.2: R2 keys, presigned uploads and the version request

**Files:**
- Create: `src/web/packages/store-worker/src/storage/presign.ts`
- Create: `src/web/packages/store-worker/src/storage/presign.test.ts`
- Create: `src/web/packages/store-worker/src/db/quota.ts`
- Create: `src/web/packages/store-worker/src/routes/me.ts`
- Modify: `src/web/packages/store-worker/src/index.ts`
- Create: `src/web/packages/store-worker/tests/versions.spec.ts`

**Interfaces:**
- Consumes: `packageKey`, `thumbnailKey`, `planVersion`, `latestVersion`.
- Produces: `presignPut(input: { accountId; accessKeyId; secretAccessKey; bucket; key; expiresSeconds: number }): Promise<string>`.
- Produces: `authorQuotaExceeded(db, userId, extraBytes): Promise<"items" | "bytes" | undefined>`.
- Produces: `presignAllowed(db, userId, now): Promise<boolean>` — at most 60 presigns in the trailing hour, recorded in `presign_event`.
- Produces: `POST /api/me/items/:id/versions` → `{ version, status, uploadUrl }`.
- Produces: `GET /api/me/items/:id/baseline` → `{ version, createdAt, envelope, status }` or 404.

- [ ] **Step 1: Write the failing presign and ownership test**

```ts
it("signs only the key derived from the session and the computed version", async () => {
  const headers = await sessionHeaders();
  const response = await SELF.fetch(`https://store.test/api/me/items/${ITEM_ID}/versions`, {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ envelope: candidate(), name: "Mine" }),
  });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.version).toBe("1.0.0");
  expect(new URL(body.uploadUrl).pathname).toBe(`/${BUCKET}/packages/${ITEM_ID}/1.0.0.zip`);

  const foreign = await SELF.fetch("https://store.test/api/me/items/00000000-0000-4000-8000-000000000000/versions", {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ envelope: candidate(), name: "Mine" }),
  });
  expect(foreign.status).toBe(404);
});

it("refuses the 21st item and the 61st presign in an hour", async () => {
  const headers = await sessionHeaders();
  await seedItems({ userId: USER_ID, count: 20 });
  expect((await createVersion(headers, NEW_ID)).status).toBe(429);
  await seedPresigns({ userId: USER_ID, count: 60, withinHour: true });
  expect((await createVersion(headers, ITEM_ID)).status).toBe(429);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @vigilia/store-worker -- tests/versions.spec.ts`
Expected: FAIL — the route is missing.

- [ ] **Step 3: Implement `presignPut` and the version route**

`presignPut` builds `https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>?X-Amz-Expires=<seconds>` and signs it with `AwsClient({ service: "s3", region: "auto", ... }).sign(url, { method: "PUT", aws: { signQuery: true } })`. It refuses an empty key or a key containing `..`.

The route resolves the session, refuses an item id owned by another user, loads the baseline, parses `envelope` as unknown with `validateFabricThemeEnvelope`, calls `planVersion`, enforces the quota and the hourly presign limit, creates the `item` row as `draft` when absent, writes a `presign_event` row, and returns the presigned URL. The quota check passes `MAX_ARCHIVE_BYTES` as `extraBytes`, because the object's real size is not known until finalize; the check is therefore conservative. `status` is `"published"` when `author_profile.verified = 1`, otherwise `"pending"`.

- [ ] **Step 4: Run the tests and commit**

Run: `npm run test -w @vigilia/store-worker`
Expected: PASS; the URL's path is the derived key and a foreign id is 404.

```bash
git add src/web/packages/store-worker/src/storage/presign.ts src/web/packages/store-worker/src/storage/presign.test.ts src/web/packages/store-worker/src/db/quota.ts src/web/packages/store-worker/src/routes/me.ts src/web/packages/store-worker/src/index.ts src/web/packages/store-worker/tests/versions.spec.ts
git commit -m "feat(store-worker): presign uploads and compute versions server-side"
```

### Task 2.3: Finalize, R2 verification and the status transition

**Files:**
- Modify: `src/web/packages/store-worker/src/storage/objects.ts`
- Modify: `src/web/packages/store-worker/src/db/items.ts`
- Modify: `src/web/packages/store-worker/src/routes/me.ts`
- Create: `src/web/packages/store-worker/tests/finalize.spec.ts`

**Interfaces:**
- Produces: `inspectObject(bucket: R2Bucket, key: string): Promise<{ bytes: number; sha256: string } | undefined>` — `undefined` for a missing key, reading the stream once.
- Produces: `POST /api/me/items/:id/versions/:version/finalize` body `{ thumbnail: string }` (base64 PNG) → `{ ok: true, status, version }`.

- [ ] **Step 1: Write the failing finalize test**

```ts
it("refuses a missing or oversized object and publishes an unverified author to pending", async () => {
  const headers = await sessionHeaders();
  await putPackage(`packages/${ITEM_ID}/1.0.0.zip`, PACKAGE_BYTES);
  const ok = await finalize(headers, ITEM_ID, "1.0.0", THUMBNAIL_PNG);
  expect(ok.status).toBe(200);
  expect(await statusOf(ITEM_ID)).toBe("pending");
  expect(await indexIds()).not.toContain(ITEM_ID);

  await env.BUCKET.delete(`packages/${ITEM_ID}/1.0.0.zip`);
  expect((await finalize(headers, ITEM_ID, "1.0.0", THUMBNAIL_PNG)).status).toBe(404);
});

it("refuses an object past MAX_ARCHIVE_BYTES without storing a version", async () => {
  const headers = await sessionHeaders();
  await putPackage(`packages/${ITEM_ID}/1.0.0.zip`, new Uint8Array(MAX_ARCHIVE_BYTES + 1));
  expect((await finalize(headers, ITEM_ID, "1.0.0", THUMBNAIL_PNG)).status).toBe(422);
  expect(await versionsOf(ITEM_ID)).toEqual([]);
});

it("returns a rejected item to the queue on a new version", async () => {
  const headers = await sessionHeaders();
  await env.DB.prepare("UPDATE item SET status = 'rejected' WHERE id = ?").bind(ITEM_ID).run();
  await putPackage(`packages/${ITEM_ID}/1.0.1.zip`, PACKAGE_BYTES);
  expect((await finalize(headers, ITEM_ID, "1.0.1", THUMBNAIL_PNG)).status).toBe(200);
  expect(await statusOf(ITEM_ID)).toBe("pending");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @vigilia/store-worker -- tests/finalize.spec.ts`
Expected: FAIL — the route is missing.

- [ ] **Step 3: Implement finalize**

The route checks the item belongs to the session and is not `removed`, HEADs the object, refuses `bytes > MAX_ARCHIVE_BYTES` with 422, writes the thumbnail (refusing a body over 2 MiB or a non-PNG), computes the SHA-256 while reading, inserts the `item_version` row, and applies the transition from `draft`, `pending`, `unpublished` or `rejected`: `pending` for an unverified author, `published` for a verified one. Finalizing the same version twice is idempotent when the bytes and hash match; a different hash is 409.

- [ ] **Step 4: Run the tests and commit**

Run: `npm run test -w @vigilia/store-worker`
Expected: PASS; pending items are absent from the index.

```bash
git add src/web/packages/store-worker/src/storage/objects.ts src/web/packages/store-worker/src/db/items.ts src/web/packages/store-worker/src/routes/me.ts src/web/packages/store-worker/tests/finalize.spec.ts
git commit -m "feat(store-worker): finalize uploads and apply the review gate"
```

### Task 2.4: Host session storage and the OAuth start/return routes

**Files:**
- Create: `src/web/packages/host/src/settings/store-session.ts`
- Create: `src/web/packages/host/src/settings/store-session.test.ts`
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/host/src/server.test.ts`
- Modify: `src/web/packages/host/src/index.ts`

**Interfaces:**
- Produces: `interface StoreSession { readonly token: string; readonly userId: string; readonly email: string; readonly obtainedAt: string }`.
- Produces: `createStoreSessionStore(directory): { read(): Promise<StoreSession | undefined>; write(s: StoreSession): Promise<void>; clear(): Promise<void> }` — file `store-session.json`, mode `0600`.
- Produces host routes `POST /api/store/auth/start` → `{ url }`, `GET /api/store/auth/return?token=&state=` → an HTML page that closes the popup, `POST /api/store/auth/sign-out`, `GET /api/store/session` → `{ signedIn, email }`.
- Consumes: Worker `/auth/start`, `/auth/return`, `/api/auth/one-time-token/verify`.

- [ ] **Step 1: Write the failing session-store test**

```ts
it("round-trips a session and clears both the file and its temporary sibling", async () => {
  const store = createStoreSessionStore(dir);
  await store.write({ token: "t", userId: "u", email: "a@example.com", obtainedAt: NOW });
  expect(await store.read()).toMatchObject({ token: "t" });
  expect((await stat(path.join(dir, "store-session.json"))).mode & 0o777).toBe(0o600);
  await store.clear();
  expect(await store.read()).toBeUndefined();
});
```

Add to `server.test.ts`:

```ts
it("reports only whether a store session exists, never the token", async () => {
  const answer = await request("/api/store/session");
  expect(await answer.json()).toEqual({ signedIn: false });
  expect(JSON.stringify(await answer.clone().json())).not.toContain("token");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/host/src/settings/store-session.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the store and the host auth routes**

Copy `github-token.ts`'s exclusive read/write/rename pattern; validate four non-empty strings and an instant. The start route builds the Worker `/auth/start` URL with the host's loopback return and a random state kept in memory for 10 minutes. The return route checks loopback, origin and state, calls `/api/auth/one-time-token/verify`, reads `set-cookie`, extracts `better-auth.session_token` (URL-decoded) as the bearer token, calls `/api/me` to learn `userId`/`email`, writes the session, and answers `200`. A failed verify clears the pending state and answers 401. No route returns the token.

- [ ] **Step 4: Run the test, typecheck and commit**

Run: `npx vitest run packages/host/src/settings/store-session.test.ts` and `npm run typecheck -w @vigilia/host`. Expected: PASS.

```bash
git add src/web/packages/host/src/settings/store-session.ts src/web/packages/host/src/settings/store-session.test.ts src/web/packages/host/src/server.ts src/web/packages/host/src/index.ts
git commit -m "feat(host): hold a store session and complete OAuth through the Worker"
```

### Task 2.5: Host store client and the submission rework

**Files:**
- Create: `src/web/packages/host/src/themes/store-client.ts`
- Create: `src/web/packages/host/src/themes/store-client.test.ts`
- Create: `src/web/packages/host/src/themes/submission.ts` (renamed from `github-item.ts`)
- Modify: `src/web/packages/host/src/themes/submission.ts` — baseline replaces `readPublishedItem`
- Modify: `src/web/packages/host/src/server.ts` — `/api/themes/submit`
- Delete: `src/web/packages/host/src/themes/github-submit.ts`, `github-oauth.ts`, `published-item.ts`, `github-item.ts`, their tests, and `validate-item.ts` and its test

**Interfaces:**
- Produces: `createStoreClient(options: { origin: string; token: string; fetch?: typeof fetch }): StoreClient` with `baseline(id)`, `createVersion(id, input)`, `upload(url, bytes)`, `finalize(id, version, thumbnail)`, `unpublish(id)`, `publish(id)`, `mine()`, `favorite(id, on)`.
- Produces: `submissionFiles(id, store, options: { thumbnails?; now?; client: StoreClient })`, returning `{ packageBytes, thumbnailBytes, version, from, level, status }`; the item JSON and catalogue path are the Worker's to build now.
- Produces: `POST /api/themes/submit` → `{ ok: true, status, version: { from, to, level } }`; 401 when no session.

- [ ] **Step 1: Write the failing store-client test**

```ts
it("reads the authenticated baseline and submits envelope, package and thumbnail", async () => {
  const seen: string[] = [];
  const client = createStoreClient({ origin: "https://store.test", token: "t", fetch: fakeFetch(seen) });
  expect(await client.baseline(ITEM_ID)).toMatchObject({ version: "1.0.0" });
  const plan = await client.createVersion(ITEM_ID, { envelope, name: "Mine" });
  await client.upload(plan.uploadUrl, PACKAGE_BYTES);
  expect(await client.finalize(ITEM_ID, "1.0.1", PNG)).toMatchObject({ status: "pending" });
  expect(seen).toContain(`https://store.test/api/me/items/${ITEM_ID}/baseline`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/host/src/themes/store-client.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the client and rework submission**

The client sends `Authorization: Bearer <token>`, parses every answer as JSON, and turns a non-2xx into `{ ok: false, message }` with the Worker's sentence. `upload` PUTs the raw bytes to the presigned URL and refuses a non-2xx. `submission.ts` uses `client.baseline` instead of `readPublishedItem`; the version ladder code stays. The server route resolves the session store, builds `submissionFiles`, calls `createVersion`, uploads, finalizes, and answers the status. Delete the fork/PR, device-flow and CI-validator modules and their tests in the same commit; update every import.

- [ ] **Step 4: Run the host suite, typecheck and commit**

Run: `npx vitest run packages/host/src/themes` and `npm run typecheck -w @vigilia/host`. Expected: PASS.

```bash
git add src/web/packages/host/src/themes src/web/packages/host/src/server.ts src/web/packages/host/src/index.ts src/web/packages/host/src/settings
git commit -m "feat(host): submit themes to the Worker and drop the GitHub path"
```

---

## Phase 3 — Management: moderation, unpublish, favourites and Mine

### Task 3.1: Owner routes, the pending queue and author verification

**Files:**
- Create: `src/web/packages/store-worker/src/routes/admin.ts`
- Create: `src/web/packages/store-worker/src/auth/owner.ts`
- Create: `src/web/packages/store-worker/tests/admin.spec.ts`
- Modify: `src/web/packages/store-worker/src/index.ts`

**Interfaces:**
- Produces: `isOwner(session: Session, ownerEmails: string): boolean` — case-insensitive, comma-separated.
- Produces: `GET /api/admin/queue`, `POST /api/admin/items/:id/approve`, `POST /api/admin/items/:id/reject { reason }`, `POST /api/admin/items/:id/remove { reason }`, `POST /api/admin/items/:id/restore`, `POST /api/admin/authors/:userId/verify`, `POST /api/admin/authors/:userId/unverify`.

- [ ] **Step 1: Write the failing admin test**

```ts
it("lets only an owner approve a pending item", async () => {
  const author = await loginAs("author@example.com");
  const owner = await loginAs("owner@example.com");
  await submitPending(author, ITEM_ID);
  expect((await SELF.fetch(`https://store.test/api/admin/items/${ITEM_ID}/approve`, {
    method: "POST", headers: author,
  })).status).toBe(404);
  expect((await SELF.fetch(`https://store.test/api/admin/items/${ITEM_ID}/approve`, {
    method: "POST", headers: owner,
  })).status).toBe(200);
  expect(await statusOf(ITEM_ID)).toBe("published");
});

it("removes with a reason and only the owner can restore", async () => {
  const author = await loginAs("author@example.com");
  const owner = await loginAs("owner@example.com");
  expect((await admin(owner, "remove", ITEM_ID, { reason: "Broken preview" })).status).toBe(200);
  expect((await republish(author, ITEM_ID)).status).toBe(403);
  expect((await admin(owner, "restore", ITEM_ID, {})).status).toBe(200);
  expect(await statusOf(ITEM_ID)).toBe("published");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @vigilia/store-worker -- tests/admin.spec.ts`
Expected: FAIL — the routes are missing.

- [ ] **Step 3: Implement the admin routes**

Every handler resolves the session first, then `isOwner`; a non-owner gets 404 so the routes are not enumerable. Approve moves `pending → published`, reject and remove require a non-empty reason, restore moves `removed → published`, and verify/unverify upsert `author_profile`.

- [ ] **Step 4: Run the tests and commit**

Run: `npm run test -w @vigilia/store-worker`. Expected: PASS.

```bash
git add src/web/packages/store-worker/src/routes/admin.ts src/web/packages/store-worker/src/auth/owner.ts src/web/packages/store-worker/src/index.ts src/web/packages/store-worker/tests/admin.spec.ts
git commit -m "feat(store-worker): add the owner queue, takedown and verification"
```

### Task 3.2: Unpublish and republish

**Files:**
- Modify: `src/web/packages/store-worker/src/routes/me.ts`
- Modify: `src/web/packages/store-worker/src/db/items.ts`
- Create: `src/web/packages/store-worker/tests/unpublish.spec.ts`

**Interfaces:**
- Produces: `POST /api/me/items/:id/unpublish` and `POST /api/me/items/:id/publish`, both 404 for a foreign id.
- Produces: `setStatus(db, itemId, from: readonly string[], to: string, at: string): Promise<boolean>` — a guarded update returning whether a row changed.

- [ ] **Step 1: Write the failing unpublish test**

```ts
it("hides every read, keeps the record, and restores counters on republish", async () => {
  const headers = await loginAs("author@example.com");
  await seedPublished({ owner: "author@example.com", versions: ["1.0.0", "1.0.1"], downloads: 4, favorites: 2 });
  expect((await unpublish(headers, ITEM_ID)).status).toBe(200);
  expect(await indexIds()).not.toContain(ITEM_ID);
  for (const version of ["1.0.0", "1.0.1"]) {
    expect((await SELF.fetch(`https://store.test/catalogue/${ITEM_ID}/${version}.zip`)).status).toBe(404);
  }
  expect(await downloads(ITEM_ID)).toBe(4);
  expect(await versionsOf(ITEM_ID)).toEqual(["1.0.0", "1.0.1"]);
  await publish(headers, ITEM_ID);
  expect(await indexIds()).toContain(ITEM_ID);
  expect(await downloads(ITEM_ID)).toBe(4);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @vigilia/store-worker -- tests/unpublish.spec.ts`
Expected: FAIL — the routes are missing.

- [ ] **Step 3: Implement both transitions**

Unpublish uses `setStatus(db, id, ["published"], "unpublished", now)`; republish uses `setStatus(db, id, ["unpublished"], "published", now)` and refuses `removed` with the stored reason. Do not touch `downloads`, `favorite`, `item_version` or R2. The item's `author_user_id` must match the session; a mismatch is 404.

- [ ] **Step 4: Run the tests and commit**

Run: `npm run test -w @vigilia/store-worker`. Expected: PASS.

```bash
git add src/web/packages/store-worker/src/routes/me.ts src/web/packages/store-worker/src/db/items.ts src/web/packages/store-worker/tests/unpublish.spec.ts
git commit -m "feat(store-worker): unpublish and republish an author's item"
```

### Task 3.3: Favourites and live counts

**Files:**
- Create: `src/web/packages/store-worker/src/db/favorites.ts`
- Modify: `src/web/packages/store-worker/src/routes/me.ts`
- Modify: `src/web/packages/store-worker/src/db/items.ts`
- Modify: `src/web/packages/store-worker/src/routes/public.ts`
- Create: `src/web/packages/store-worker/tests/favorites.spec.ts`

**Interfaces:**
- Produces: `toggleFavorite(db, userId, itemId, on): Promise<"ok" | "not-found">`.
- Produces: `favoriteCount(db, itemId): Promise<number>`; `countsByItem(db, ids): Promise<ReadonlyMap<string, number>>`.
- Produces: `PUT|DELETE /api/me/items/:id/favorite` → `{ ok: true, favorites }`.

- [ ] **Step 1: Write the failing favourite test**

```ts
it("counts one favourite per account and follows the index", async () => {
  const headers = await loginAs("fan@example.com");
  expect((await favorite(headers, ITEM_ID, "PUT")).status).toBe(200);
  expect((await favorite(headers, ITEM_ID, "PUT")).status).toBe(200);
  expect((await indexEntry(ITEM_ID)).favorites).toBe(1);
  expect((await favorite(headers, ITEM_ID, "DELETE")).status).toBe(200);
  expect((await indexEntry(ITEM_ID)).favorites).toBe(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @vigilia/store-worker -- tests/favorites.spec.ts`
Expected: FAIL — the route is missing.

- [ ] **Step 3: Implement favourites and wire the counts**

`INSERT OR IGNORE` for PUT, `DELETE` for DELETE; PUT is refused with 404 unless the item is published, DELETE is allowed in any state. The index and `item.json` read `countsByItem` once rather than issuing a query per entry.

- [ ] **Step 4: Run the tests and commit**

Run: `npm run test -w @vigilia/store-worker`. Expected: PASS.

```bash
git add src/web/packages/store-worker/src/db/favorites.ts src/web/packages/store-worker/src/routes/me.ts src/web/packages/store-worker/src/db/items.ts src/web/packages/store-worker/src/routes/public.ts src/web/packages/store-worker/tests/favorites.spec.ts
git commit -m "feat(store-worker): favourite items and read live counts"
```

### Task 3.4: The Mine listing and the host proxy

**Files:**
- Modify: `src/web/packages/store-worker/src/routes/me.ts`
- Create: `src/web/packages/store-worker/tests/mine.spec.ts`
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/host/src/themes/store-client.ts`
- Modify: `src/web/packages/host/src/themes/store-client.test.ts`

**Interfaces:**
- Produces: `GET /api/me/items` → `{ entries: MineEntry[] }`, where `MineEntry = CatalogueEntry & { status: CatalogueStatus; statusReason?: string }`, newest first, every state except a versionless `draft`.
- Produces: host `GET /api/store/mine` proxying the call with the stored token.

- [ ] **Step 1: Write the failing Mine test**

```ts
it("returns the author's unpublished and pending items and nobody else's", async () => {
  const mine = await loginAs("author@example.com");
  await seedPublished({ owner: "author@example.com" });
  await seedStatus({ owner: "author@example.com", id: OTHER_ID, status: "unpublished" });
  await seedStatus({ owner: "stranger@example.com", id: THIRD_ID, status: "published" });
  const body = await (await SELF.fetch("https://store.test/api/me/items", { headers: mine })).json();
  expect(body.entries.map((e: { id: string }) => e.id).sort()).toEqual([ITEM_ID, OTHER_ID].sort());
  expect(body.entries.find((e: { id: string }) => e.id === OTHER_ID).status).toBe("unpublished");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @vigilia/store-worker -- tests/mine.spec.ts`
Expected: FAIL — the route is missing.

- [ ] **Step 3: Implement the endpoint and the proxy**

Join `item` to its latest version and favourite count, filter `author_user_id = session.userId`, and include `status` and `statusReason`. The host route is loopback-only, requires a stored session, and returns 401 when there is none.

- [ ] **Step 4: Run the tests and commit**

Run: `npm run test -w @vigilia/store-worker && npx vitest run packages/host/src/themes/store-client.test.ts`. Expected: PASS.

```bash
git add src/web/packages/store-worker/src/routes/me.ts src/web/packages/store-worker/tests/mine.spec.ts src/web/packages/host/src/server.ts src/web/packages/host/src/themes/store-client.ts src/web/packages/host/src/themes/store-client.test.ts
git commit -m "feat(store): list an author's own items through the host"
```

---

## Phase 4 — The client surface

### Task 4.1: One catalogue origin and one download allow-list

**Files:**
- Create: `src/web/packages/renderer-core/src/theme/catalogue-location.ts`
- Create: `src/web/packages/renderer-core/src/theme/catalogue-location.test.ts`
- Modify: `src/web/packages/renderer-core/src/index.ts` — export the module
- Delete: `src/web/packages/host/src/themes/catalogue-source.ts`
- Delete: `src/web/packages/editor/src/store-mode/catalogue-location.ts`
- Modify: `src/web/packages/host/src/themes/submission.ts`, `download.ts`
- Modify: `src/web/packages/editor/src/store-mode/online-source.ts`
- Modify: `src/web/packages/host/src/server.test.ts`, `download.test.ts`, `online-source.test.ts`

**Interfaces:**
- Produces: `CATALOGUE_ORIGIN` (initial value `https://vigilia-store.workers.dev`; Task 5.2 replaces it with the deployed URL).
- Produces: `catalogueIndexUrl()`, `catalogueItemUrl(id)`, `cataloguePackageUrl(id, version)`, `catalogueThumbnailUrl(path)`; the last joins `CATALOGUE_ORIGIN` and the path without a `/catalogue` suffix.

- [ ] **Step 1: Write the failing location test**

```ts
it("builds the Worker's public addresses from one origin", () => {
  expect(catalogueIndexUrl()).toBe(`${CATALOGUE_ORIGIN}/index.json`);
  expect(catalogueItemUrl(ID)).toBe(`${CATALOGUE_ORIGIN}/catalogue/${ID}/item.json`);
  expect(cataloguePackageUrl(ID, "1.0.0")).toBe(`${CATALOGUE_ORIGIN}/catalogue/${ID}/1.0.0.zip`);
  expect(catalogueThumbnailUrl(`catalogue/${ID}/thumbnail.png`)).toBe(`${CATALOGUE_ORIGIN}/catalogue/${ID}/thumbnail.png`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/renderer-core/src/theme/catalogue-location.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the module and move the callers**

Replace both hand-kept constants with imports from `renderer-core`. `download.ts` allows exactly `new URL(CATALOGUE_ORIGIN).hostname` over https and sets `MAX_REDIRECTS = 0`. `online-source.ts` imports `catalogueIndexUrl` and `catalogueThumbnailUrl` from the shared module. Update every test that asserted the GitHub URLs.

- [ ] **Step 4: Run the affected suites and commit**

Run: `npx vitest run packages/renderer-core packages/editor/src/store-mode/online-source.test.ts packages/host/src/themes/download.test.ts`. Expected: PASS.

```bash
git add src/web/packages/renderer-core/src/theme/catalogue-location.ts src/web/packages/renderer-core/src/theme/catalogue-location.test.ts src/web/packages/renderer-core/src/index.ts src/web/packages/host/src/themes src/web/packages/editor/src/store-mode
git commit -m "refactor(store): own the catalogue origin in renderer-core"
```

### Task 4.2: The Mine source and its toggle

**Files:**
- Create: `src/web/packages/editor/src/store-mode/mine-source.ts`
- Create: `src/web/packages/editor/src/store-mode/mine-source.test.ts`
- Modify: `src/web/packages/editor/src/store-mode/region.tsx`
- Modify: `src/web/packages/editor/src/store-mode/region.dom.test.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`

**Interfaces:**
- Consumes: host `GET /api/store/mine` → `{ entries: MineEntry[] }`.
- Produces: `mineThemeSource(options?: { fetch?: typeof fetch }): ItemSource` — `list()` maps entries to `StoreItem & { status; statusReason }`.
- Produces: a `Mine` toggle (`data-vigilia-store-mine`) drawn in the online half when a session is present; with it on, `listed` comes from `mineThemeSource`, status is carried on each item, and the public filters still apply.

- [ ] **Step 1: Write the failing mine-source test**

```ts
it("maps status and reason from the host answer", async () => {
  const source = mineThemeSource({ fetch: fakeFetch({ entries: [{ ...entry, status: "unpublished", statusReason: "Withdrawn by the author" }] }) });
  expect(await source.list()).toMatchObject([{ id: ITEM_ID, status: "unpublished", statusReason: "Withdrawn by the author" }]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/store-mode/mine-source.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the source and the toggle**

The source fetches `/api/store/mine`, parses `entries` with the same shape rules as `online-source`, and throws on a non-2xx so the region leaves the listing unset. The region asks `/api/store/session` once; the toggle is absent when signed out. Turning Mine on while on the local half switches to online. Copy keys: `uiCopy.store.mine.label`, `.empty`, `.status.pending`, `.status.unpublished`, `.status.rejected`, `.status.removed`.

- [ ] **Step 4: Run the tests and commit**

Run: `npx vitest run packages/editor/src/store-mode/mine-source.test.ts packages/editor/src/store-mode/region.dom.test.tsx`. Expected: PASS.

```bash
git add src/web/packages/editor/src/store-mode/mine-source.ts src/web/packages/editor/src/store-mode/mine-source.test.ts src/web/packages/editor/src/store-mode/region.tsx src/web/packages/editor/src/store-mode/region.dom.test.tsx src/web/packages/editor/src/ui-copy.ts
git commit -m "feat(editor): list the author's own items behind a Mine toggle"
```

### Task 4.3: Status badges and the modal's unpublish action

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/gallery.tsx`
- Modify: `src/web/packages/editor/src/store-mode/gallery.dom.test.tsx`
- Modify: `src/web/packages/editor/src/store-mode/item-modal.tsx`
- Modify: `src/web/packages/editor/src/store-mode/item-modal.dom.test.tsx`
- Modify: `src/web/packages/editor/src/store-mode/region.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`

**Interfaces:**
- Consumes: `StoreItem & { status?: CatalogueStatus; statusReason?: string }`.
- Produces: `ItemModal` props `onUnpublish?: (id: string) => void`, `onRepublish?: (id: string) => void`, `status?: CatalogueStatus`, `statusReason?: string`.
- Produces: regions call `POST /api/store/items/:id/unpublish|publish`, then re-read the Mine listing.

- [ ] **Step 1: Write the failing DOM tests**

```tsx
it("draws Unpublished and offers Republish on the author's item", async () => {
  render(<ItemModal item={{ ...item, status: "unpublished" }} onRepublish={onRepublish} onUnpublish={onUnpublish} {...noop} />);
  expect(screen.getByText("Unpublished")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Republish" }));
  expect(onRepublish).toHaveBeenCalledWith(item.id);
  expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull();
});

it("badges a pending cell without changing its public actions", () => {
  render(<Gallery items={[{ ...item, status: "pending" }]} {...noop} />);
  expect(screen.getByText("Pending")).toBeTruthy();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/editor/src/store-mode/item-modal.dom.test.tsx packages/editor/src/store-mode/gallery.dom.test.tsx`
Expected: FAIL — the status is not drawn.

- [ ] **Step 3: Implement the badge and the actions**

A small badge element after the item's name, with `data-vigilia-store-status`. The modal shows Unpublish only for `published`, Republish only for `unpublished`, and the owner's sentence for `rejected`/`removed`. The region posts to the host and replaces the item in the Mine listing with the answer; a refusal is announced in the existing live region.

- [ ] **Step 4: Run the tests and commit**

Run: the same command. Expected: PASS.

```bash
git add src/web/packages/editor/src/store-mode/gallery.tsx src/web/packages/editor/src/store-mode/gallery.dom.test.tsx src/web/packages/editor/src/store-mode/item-modal.tsx src/web/packages/editor/src/store-mode/item-modal.dom.test.tsx src/web/packages/editor/src/store-mode/region.tsx src/web/packages/editor/src/ui-copy.ts
git commit -m "feat(editor): show item status and let an author withdraw or restore it"
```

### Task 4.4: The OAuth submit flow

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/use-submit.ts`
- Create: `src/web/packages/editor/src/store-mode/use-submit.test.ts`
- Modify: `src/web/packages/editor/src/store-mode/item-modal.tsx`
- Modify: `src/web/packages/editor/src/store-mode/region.dom.test.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Modify: `src/web/packages/host/src/server.ts` — `GET /api/store/session`

**Interfaces:**
- Produces: `SubmitState = "idle" | "authorising" | "submitting" | "submitted" | "refused"`, `SubmittedVersion { from: string | null; to: string; level: VersionLevel }`, and `SubmitControl.status: "pending" | "published" | undefined`.
- Consumes: host `POST /api/store/auth/start` → `{ url }`, `POST /api/themes/submit` → `{ ok, status, version }`.

- [ ] **Step 1: Write the failing submit test**

```ts
it("opens the auth popup once, retries the submission, and reports pending", async () => {
  const popup = { closed: false, close: vi.fn(), location: { href: "" } };
  const fetch = sequenceFetch([
    json({ url: "https://store.test/auth/start?provider=github" }),
    json({ ok: false }, 401),
    json({ ok: true, status: "pending", version: { from: null, to: "1.0.0", level: "initial" } }),
  ]);
  const { result } = renderHook(() => useSubmit({ fetch, openWindow: () => popup as never }));
  act(() => result.current.control.onSubmit(item));
  await waitFor(() => expect(result.current.control.state).toBe("authorising"));
  await waitFor(() => expect(result.current.control.status).toBe("pending"));
  expect(fetch).toHaveBeenCalledWith("/api/store/auth/start", expect.anything());
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/store-mode/use-submit.test.ts`
Expected: FAIL — the module does not exist or the flow is the device flow.

- [ ] **Step 3: Implement the flow and the copy**

`attempt` posts `/api/themes/submit`. On 401 it posts `/api/store/auth/start`, opens `url` in a popup, and polls `/api/store/session` every 1 s for at most 5 minutes; when `signedIn` is true it retries once. On success it reports `status` and the version. Copy replaces "pull request" with "submission" and names pending review.

- [ ] **Step 4: Run the tests and commit**

Run: `npx vitest run packages/editor/src/store-mode`. Expected: PASS.

```bash
git add src/web/packages/editor/src/store-mode src/web/packages/editor/src/ui-copy.ts src/web/packages/host/src/server.ts
git commit -m "feat(editor): submit through the store session instead of the GitHub device flow"
```

### Task 4.5: Repoint the docs and prove no GitHub path survives

**Files:**
- Modify: `src/web/packages/host/src/index.ts`, `server.ts` — remove any remaining `githubClientId` option
- Modify: `docs/architecture/ownership.md`, `docs/engineering/dependencies.md`, `THIRD-PARTY-NOTICES.md`
- Modify: `docs/superpowers/specs/2026-10-12-theme-store-design.md` — status line points at this backend
- Modify: any roadmap or backlog text that still names the PR flow as current

- [ ] **Step 1: Find every survivor**

Run: `rg -n "github-submit|github-oauth|github-item|published-item|validate-item|github-token|githubClientId|CATALOGUE_RAW_BASE|CATALOGUE_CDN_BASE" src/web docs`
Expected: no product or test hit. Documentation hits are repointed in this task; a source hit is a missed deletion from Task 2.5 and is fixed here.

- [ ] **Step 2: Repoint the docs**

`docs/architecture/ownership.md` gains one row: the catalogue's wire shape and URL builders belong to `renderer-core/src/theme/catalogue-location.ts`; the store's backend belongs to `packages/store-worker`. The 2026-10-12 store spec's status line names this backend as superseding its hosting sections. Dependencies and notices already carry Better Auth and `aws4fetch` from Task 1.1; verify no GitHub-only dependency remains.

- [ ] **Step 3: Run the full unit suite and typecheck**

Run: `npm test` (from `src/web`) and `npm run typecheck`. Expected: PASS, no reference to a deleted module.

- [ ] **Step 4: Commit**

```bash
git add src/web/packages/host/src/index.ts src/web/packages/host/src/server.ts docs THIRD-PARTY-NOTICES.md
git commit -m "docs(store): repoint ownership and dependencies after the GitHub removal"
```

---

## Phase 5 — Cutover and proof

### Task 5.1: Import the existing item

**Files:**
- Create: `src/web/scripts/import-catalogue-item.mjs`
- Create: `src/web/tests/scripts/import-catalogue-item.test.ts`

**Interfaces:**
- Produces: `envelopeOfPackage(bytes: Uint8Array): unknown` — reads `theme.json` from the package with `fflate`'s `unzipSync` and parses it; refuses a package with no `theme.json` or a non-object.
- Produces: `importPlan({ itemJson, packageBytes, thumbnailBytes, session }): { origin: string; envelope: object; name: string; packageBytes; thumbnail: string }` — pure.
- Consumes: the owner's `settings/store-session.json`, the Worker's author flow (`POST /api/me/items/:id/versions`, presigned PUT, finalize).

- [ ] **Step 1: Write the failing import test**

```ts
it("reads the envelope out of the old package and plans one version upload", async () => {
  const plan = importPlan({ itemJson: JSON.stringify(OLD_ITEM), packageBytes: OLD_PACKAGE, thumbnailBytes: PNG, session: { token: "t", origin: "https://store.test" } });
  expect(plan.envelope).toMatchObject({ id: OLD_ITEM_ID });
  expect(plan.name).toBe(OLD_ITEM.name);
  expect(plan.thumbnail).toBe(PNG.toString("base64"));
  expect(() => envelopeOfPackage(zipSync({ "manifest.json": strToU8("{}") }))).toThrow();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/scripts/import-catalogue-item.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the reader and the CLI**

The script takes `--source <catalogue item dir>` and `--origin <worker origin>`, reads `settings/store-session.json` from the host settings directory (or a `--token` file), then drives the normal author flow as the owner: version request, presigned PUT, finalize, then `POST /api/admin/items/:id/approve` if the owner account is not marked verified. The Worker computes facets and the version; the script never writes D1 or R2 directly. It refuses when the package envelope's id differs from `item.json`'s id, and when the old item's version is not `1.0.0` (a first submission computes `1.0.0`, so any other old version would be a silent rewrite). It never prints the token.

- [ ] **Step 4: Run the test and commit**

Run: `npx vitest run tests/scripts/import-catalogue-item.test.ts`. Expected: PASS.

```bash
git add src/web/scripts/import-catalogue-item.mjs src/web/tests/scripts/import-catalogue-item.test.ts
git commit -m "feat(store): import the GitHub catalogue item through the author flow"
```

### Task 5.2: Deploy the Worker and set the origin

**External action — the owner runs the deploy.** The agent prepares everything and reports the command.

**Files:**
- Modify: `src/web/packages/store-worker/wrangler.toml` — the real `database_id`
- Modify: `src/web/packages/renderer-core/src/theme/catalogue-location.ts` — `CATALOGUE_ORIGIN`
- Modify: `src/web/packages/store-worker/README.md` (create) — the secret list and OAuth callback URLs

- [ ] **Step 1: Create the Cloudflare resources**

Run: `npx wrangler d1 create vigilia-store`, then `npx wrangler r2 bucket create vigilia-store-packages`. Put the printed D1 id into `wrangler.toml`.

- [ ] **Step 2: Set the secrets**

Run `npx wrangler secret put` for each of `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `OWNER_EMAILS`, `MIGRATE_TOKEN`. Record the OAuth callback URL `https://<worker>/api/auth/callback/<provider>` in the README.

- [ ] **Step 3: Deploy, migrate and record the URL**

Run `npx wrangler deploy`, then `curl -X POST https://<worker>/migrate -H "x-migrate-token: …"`, then `curl https://<worker>/api/health`. Replace `CATALOGUE_ORIGIN` with the printed `https://…workers.dev` URL and rebuild.

- [ ] **Step 4: Measure CPU**

Record Workers CPU for `GET /index.json` and one auth callback in the plan's evidence file. If either exceeds 10 ms, say so and adopt Workers Paid before the cutover is called done.

### Task 5.3: Browser evidence for the new surface

**Files:**
- Create: `src/web/tests/e2e/store-mine.spec.ts`
- Modify: `docs/evidence/screenshots/README.md`

- [ ] **Step 1: Register the captures first**

Add a **Theme store** table with three rows: `Mine lists an unpublished item`, `Unpublish action in the item modal`, `Republish action restores the item`, each with its capture/title regex.

- [ ] **Step 2: Write the browser test with routed host answers**

Route `/api/store/session` and `/api/store/mine` with `page.route`, open the store, switch to online, turn Mine on, assert the badge, open the item, assert the action, and assert the refusal path. The test must assert visible text, not only object counts.

- [ ] **Step 3: Capture and look at the images**

Run `VIGILIA_CAPTURE=1 npx playwright test tests/e2e/store-mine.spec.ts --workers=1`, then inspect each registered image and write one sentence per image into the plan's evidence.

- [ ] **Step 4: Commit**

```bash
git add src/web/tests/e2e/store-mine.spec.ts docs/evidence/screenshots
git commit -m "test(store): prove Mine, unpublish and republish in a browser"
```

### Task 5.4: Final gate, close-out and STATUS

**Files:**
- Modify: `STATUS.md`
- Modify: `docs/superpowers/plans/2026-10-23-r2-store-backend.md` — tick and annotate acceptance

- [ ] **Step 1: Run the broad gate**

From `src/web`: `npm run gate` and `npm run test:worker`, each with output to a file and the exit code read directly. Expected: exit 0. Record both codes.

- [ ] **Step 2: Re-run the red-proofs against the final tree**

Disable the `status = 'published'` predicate, the download increment and the version check in turn; run their tests; restore each from a copy outside the repo and verify with `cmp`. Record the failure text and the `cmp` result.

- [ ] **Step 3: Close the plan and update STATUS**

Replace STATUS's last-completed bullets with the plan's outcome and list what is unverified (real OAuth round trip, live CPU, any behaviour only the deployed origin can show). Leave the plan in `docs/superpowers/plans/`; archiving is the owner's call after acceptance.

- [ ] **Step 4: Commit**

```bash
git add STATUS.md docs/superpowers/plans
git commit -m "docs(status): record the R2 store backend cutover"
```

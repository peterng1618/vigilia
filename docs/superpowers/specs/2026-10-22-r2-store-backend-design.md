# The store on Cloudflare — R2, Worker, D1

- **Status:** design agreed 2026-10-22; awaiting the owner's review of this file.
  It is **not accepted work** until `STATUS.md` names it and a plan is active.
  It supersedes the hosting halves of
  [`2026-10-12-theme-store-design.md`](2026-10-12-theme-store-design.md) — the
  catalogue repo, the app-opened PR, the `index.json` Action, jsDelivr and the
  GitHub release/raw routes — and leaves that document's storefront, facets,
  package format, install path and provenance model intact.
- **Date:** 2026-10-22
- **Scope:** one backend for the theme catalogue: Cloudflare Worker, D1 and a
  private R2 bucket, with Better Auth and server-authoritative counters. It
  also settles what an author's **unpublish** does. It does not redesign the
  store surface, the package format or the version ladder; it changes where
  their inputs come from and adds the Mine surface those actions need.

## What this replaces, and why

The GitHub backend was chosen for a store with no server and no recurring
cost. It works, and one real item has been published and installed through it
([`2026-10-12-theme-store-design.md`](2026-10-12-theme-store-design.md),
"Measured 2026-10-21"). Three properties it cannot provide are now
requirements:

- **Authoritative counters.** GitHub exposes no download count for repository
  files, and a release asset's count restarts whenever the bytes are re-homed
  (measured: a re-upload answers `download_count: 0`). Downloads and
  favourites are must-haves, not best-effort reads.
- **Author control.** A listed item has no author-facing way to leave the
  store. Closing a PR is not an act an author can perform after a merge.
- **One review instrument that survives the upload.** The PR diff was free
  review; a direct upload loses it, so the trust ladder moves into the
  service and the owner gets a queue instead of a diff.

The costs this accepts: a Cloudflare account, a D1 schema, a Worker to
maintain, and a hard cutover from the GitHub catalogue.

## Rulings taken 2026-10-22

All eight are the owner's, taken across this design's questions.

1. **Private R2, with the Worker proxying every read.** No public bucket and no
   direct R2 URL reaches a client. This is what makes an unpublish revoke
   access immediately and makes the download counter authoritative. The
   alternatives are recorded in "Delivery: why the Worker proxies packages".
2. **Packages upload directly to R2 through a presigned URL.** Workers Free
   caps a request body at 100 MB, and the archive cap is 95 MiB (≈99.6 MB):
   there is no headroom for multipart overhead. The Worker signs, never
   buffers, and HEADs the object at finalize.
3. **Unpublish hides and keeps the record.** Status flips, every public read
   answers 404, and versions, counters, favourites and R2 bytes stay. The
   author can republish the same item; installed copies keep working because
   they are local files.
4. **The trust ladder survives.** An unverified author's submission waits in
   `pending`; a verified author's publishes at finalize. The owner is an
   allow-listed account and may take an item down.
5. **The author manages their own items from a `Mine` filter in the online
   tab**, and the item modal carries the same action. Unpublished items are
   absent from the public index, so without this surface republish would be
   unreachable.
6. **Hard cutover, no dual run.** The existing item is imported once, the
   client constants move to the Worker, and the GitHub catalogue repo and its
   workflows are archived. Pre-release architecture may break cleanly.
7. **Downloads and favourites are server-side facts.** A download increments
   D1 when the package is served; a favourite is a row keyed by account and
   item. Neither is a client beacon.
8. **Owner takedown is distinct from author unpublish.** An author sets
   `unpublished` and can undo it. The owner sets `removed` with a reason, and
   the author cannot undo it.

## Architecture

| Concern | Owner |
|---|---|
| Public listing, item header, thumbnail, package | one Worker |
| Identity and sessions | Better Auth on the same Worker, D1 |
| Metadata, counters, favourites, status | D1 |
| Packages and thumbnails | private R2 bucket, keys written by the Worker |
| Uploads | presigned R2 PUT, key chosen by the Worker |
| Version computation and facets | the Worker, from the submitted envelope |
| Storefront, facets, install, provenance | unchanged, in the editor and host |

One Worker serves four route families:

- **Public reads** — `GET /index.json`, `/catalogue/:id/item.json`,
  `/catalogue/:id/thumbnail.png`, `/catalogue/:id/:version.zip`.
- **Auth** — `/api/auth/*`, Better Auth's own router, plus one return page and
  the one-time-token exchange described below.
- **Author** — `/api/me/*`, bearer session.
- **Admin** — `/api/admin/*`, bearer session and the owner allow-list.

The editor keeps reading the same `CatalogueIndex` and `CatalogueEntry` shapes
it reads today. `packageUrl` becomes an absolute Worker URL;
`thumbnail` stays a repo-style path (`catalogue/<id>/thumbnail.png`) and is
joined with the **Worker origin** by the existing `catalogueThumbnailUrl`
helper, whose base no longer carries a `/catalogue` suffix. No parser changes
are required.

### Delivery: why the Worker proxies packages

- **A — private R2, Worker proxies (chosen).** Every package byte passes a
  Worker invocation. The route checks `status = 'published'`, increments
  `downloads`, and streams `env.BUCKET.get(key).body`. No egress fee, no CPU
  spent copying the body, and no URL outlives its listing. Free tier:
  100,000 requests/day.
- **B — public R2 custom domain, Worker for JSON only.** Packages are cheap
  and cacheable, but a download bypasses the Worker, so counts need a beacon
  and an unpublish cannot revoke a shared URL without deleting the object.
  Rejected against rulings 3 and 7.
- **C — Worker checks status, redirects to a short-lived signed R2 URL.**
  Unpublish is enforced at issue time, but aborted downloads overcount and a
  signed URL leaks for its lifetime. More machinery than A for no gain at
  this scale. Rejected.

Package responses are `Cache-Control: no-store`: an edge cache hit would skip
the counter. Index, item and thumbnail responses are cacheable for a short
window (`max-age=60`, thumbnails `max-age=300`), so a counter can lag a page
by a minute, which the storefront already accepts.

### Free-tier limits, stated as risks

| Limit | Value | Consequence |
|---|---|---|
| Worker requests | 100,000/day | ~100k package downloads or page reads; beyond it is $5/month |
| Worker CPU | 10 ms/invocation | **the first limit likely to bite**: auth plus an index build can exceed it |
| Worker memory | 128 MB | packages are streamed, never buffered |
| Request body | 100 MB | why uploads are presigned (ruling 2) |
| D1 storage / reads / writes | 5 GB / 5M/day / 100k/day | one write per download and per favourite; same ceiling as the request count |
| R2 storage | 10 GB | ~100 maximal packages, many more typical ones |

The plan must **measure** the index and auth CPU before claiming the free tier
is sufficient. If either exceeds 10 ms, the upgrade is Workers Paid at
$5/month, recorded as a cost rather than discovered in production.

## Data model

Better Auth owns `user`, `session`, `account` and `verification`; its schema is
created by its migration, not hand-written here.

### `item`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | catalogue UUID, from the envelope |
| `kind` | TEXT | `dashboard-theme` in v1; never a display word |
| `author_user_id` | TEXT | FK to Better Auth `user`; ownership check |
| `name` | TEXT | as submitted |
| `status` | TEXT | `draft`, `pending`, `published`, `unpublished`, `rejected`, `removed` |
| `status_reason` | TEXT NULL | owner's rejection or removal sentence |
| `created_at` | TEXT | first publication instant, carried forward |
| `updated_at` | TEXT | last version's instant |
| `published_at` | TEXT NULL | last transition into `published` |
| `unpublished_at` | TEXT NULL | last author withdrawal |
| `removed_at` | TEXT NULL | owner takedown |
| `downloads` | INTEGER | item-level, never reset by unpublish or a version |
| `remix_of_id` | TEXT NULL | catalogue UUID this item credits |

Indexes: `(status)`, `(author_user_id)`.

### `item_version`

| Column | Type | Notes |
|---|---|---|
| `item_id` | TEXT | part of PK |
| `version` | TEXT | semver, part of PK |
| `envelope_json` | TEXT | the validated `theme.json`, the version ladder's baseline |
| `facets_json` | TEXT | `facetRecordOf(envelope)`, derived once by the server |
| `package_key` | TEXT | `packages/<item_id>/<version>.zip` |
| `thumbnail_key` | TEXT | `thumbnails/<item_id>.png` |
| `bytes` | INTEGER | from R2 HEAD, checked against `MAX_ARCHIVE_BYTES` |
| `sha256` | TEXT | computed by the Worker from the streamed object |
| `created_at` | TEXT | finalize instant |

Primary key `(item_id, version)`. A version row is written only at finalize,
so a presigned upload that is never finalized leaves no listing.

### `favorite`

`user_id`, `item_id`, `created_at`; primary key `(user_id, item_id)`, index on
`item_id`. A favourite survives unpublish and takedown as a row; the count a
listing shows is `COUNT(*)` over published items, so a hidden item's
favourites are retained but not displayed.

### `author_profile`

`user_id` PK, `verified` INTEGER, `display_name` TEXT NULL. The owner is not a
row: `OWNER_EMAILS` is a Worker secret, checked on each admin request so a
lost account cannot be recovered by editing D1.

## Status machine

| From | To | Actor | Effect |
|---|---|---|---|
| `draft` | `pending` | unverified author, finalize | invisible; queued |
| `draft` | `published` | verified author, finalize | listed |
| `pending` | `published` | owner approves | listed; `published_at` set |
| `pending` | `rejected` | owner rejects | invisible; reason shown in Mine |
| `published` | `unpublished` | author | 404 on every public read; record kept |
| `unpublished` | `published` | author republishes | listed again; same version and counters |
| `published`/`unpublished`/`pending` | `removed` | owner | 404; reason shown; author cannot republish |
| `removed` | `published` | owner restores | listed again |
| `rejected` | `pending` | author submits a new version | back in the queue |

A first `POST /api/me/items/:id/versions` creates the item row as `draft`; a
version request for an existing item leaves its status alone until finalize.
`draft` is therefore visible only in Mine, and only between the presign and
the finalize that is supposed to follow it.

### What unpublish does, exactly

- `POST /api/me/items/:id/unpublish` requires a bearer session whose
  `user.id` equals `item.author_user_id`. Anything else is 404, not 403, so an
  id cannot be probed for existence.
- `status = 'unpublished'`, `unpublished_at = now`. **Nothing else changes**:
  no version rows deleted, no counters reset, no favourite rows removed, no R2
  object removed, no version bumped.
- Every public route filters on `published`, so the item, its thumbnail and
  every one of its packages answer 404. A link shared before the withdrawal
  stops working.
- The item remains in `GET /api/me/items`, which is how Mine finds it again.
- **Installed copies are untouched.** A copy is a local theme with a
  `ThemeOrigin`; the host does not re-check the store on launch. The local tab
  keeps showing it, and no update is offered while the catalogue has no
  published version.
- **Republish** sets `status = 'published'` and `published_at = now`; the
  current version and `downloads` are unchanged. If the item was `removed`,
  republish is refused with the owner's reason.
- **A new version from an `unpublished` item** submits normally: a verified
  author publishes it, an unverified author queues it. Its version ladder
  bumps from the **latest stored version**, published or not, so the author's
  withdrawn work is still the baseline.
- **Remix credit is unaffected.** A child item's `remixOf` still names this id;
  the child is not hidden because its parent was. A child pointing at a
  removed item remains readable as a credit, because provenance is a fact
  about authorship, not a link the store can revoke.

### Counter rules

- A package response is only produced after the status predicate and the R2
  object are both in hand: the Worker opens the object, then runs
  `UPDATE item SET downloads = downloads + 1 WHERE id = ? AND status = 'published'`.
  If the update affects no row, the body is cancelled and the answer is 404.
  The increment happens **before** the body streams, so an aborted transfer
  still counts as a download; the alternative — counting on completion —
  cannot be observed after the response is handed to the client.
- A favourite is `PUT`/`DELETE` on `(session.user.id, item_id)` and is allowed
  only while the item is published. `DELETE` while unpublished still removes
  the row, so a person can clear a favourite they can still see in Mine.
- Neither counter is ever written from client-reported numbers, and the index
  reads both from D1 at request time.

## Version authority

The host keeps its existing sequence — `submissionFiles` reads the baseline,
classifies the change, bumps the version and writes it into the local library
and the package — but the Worker no longer trusts the result.

The baseline is read through `GET /api/me/items/:id/baseline`, not through the
public item and package. A submission always has a session, and an item's own
author is the only account that may resubmit it, so the authenticated route
can return `{ version, createdAt, envelope, status }` for any state — including
`unpublished` and `pending`, whose public reads answer 404. This replaces
`readPublishedItem`'s download-and-unzip: the stored `envelope_json` is the
same document the package carries, and `classifyThemeChange` ignores the
fields (`metadata.version`, dates) that differ between them.

1. The host sends the candidate `envelope` (the one it just versioned) plus
   `name` and `remixOf`.
2. The Worker loads the item's latest `item_version.envelope_json` and
   `version` (for a first publication there is none), then runs the **same**
   helpers the host and CI use: `validateFabricThemeEnvelope`,
   `classifyThemeChange`, `versionFor`, `facetRecordOf`.
3. It refuses when `envelope.metadata.version` is absent, is not the version
   `versionFor` computes, or the change level is `none`. The author sees the
   same sentences they see today.
4. It returns `{ version, uploadUrl, key, status }`, where `status` is the
   state the item will hold after finalize (`pending` or `published`).
5. The host uploads the package it already built to `uploadUrl`, then calls
   finalize with the thumbnail. The Worker HEADs the object, refuses a size
   over `MAX_ARCHIVE_BYTES`, computes its `sha256` while reading it, and
   writes the version row.

**What the server cannot check, and does not pretend to:** that the uploaded
ZIP's `theme.json` is the submitted envelope, because Workers Free cannot
unzip a 95 MiB archive inside 10 ms of CPU. The client validates packages on
install with `readThemePackage`, as it does today, and the versioning
invariant is enforced against the submitted envelope. A malicious client can
publish a package whose internal metadata disagrees with its listing; it
cannot make a client install it, because that reader refuses it. This is
recorded as a residual risk, not solved with a second unzip service.

## API

### Public

| Route | Answer |
|---|---|
| `GET /index.json` | `{ generatedAt, entries }`; published items only; `Cache-Control: max-age=60`, `ETag` |
| `GET /catalogue/:id/item.json` | the `CatalogueItemFile` plus live `downloads`/`favorites`; 404 unless published |
| `GET /catalogue/:id/thumbnail.png` | the stored PNG; 404 unless published |
| `GET /catalogue/:id/:version.zip` | streams the package, increments downloads; 404 unless published; `no-store` |

Public routes answer `Access-Control-Allow-Origin: *`, because the editor
fetches the index and draws thumbnails from the loopback origin.

### Author (bearer session)

| Route | Purpose |
|---|---|
| `GET /api/me` | account id, display name, `verified` |
| `GET /api/me/items` | every own item in every state, newest first, with `status` and `statusReason` |
| `GET /api/me/items/:id/baseline` | the latest stored version, its envelope and status, for any state |
| `POST /api/me/items/:id/versions` | validate the envelope, compute the version, return a presigned PUT |
| `POST /api/me/items/:id/versions/:version/finalize` | HEAD and hash the object, accept the thumbnail, write the version, apply the status |
| `POST /api/me/items/:id/unpublish` | ruling 3 |
| `POST /api/me/items/:id/publish` | republish; refused for `removed` |
| `PUT` / `DELETE /api/me/items/:id/favorite` | toggle; published only for `PUT` |

A presigned key is always derived from the session and the validated version:
`packages/<item_id>/<version>.zip`. A client that names its own path is
refused. The URL expires in 15 minutes and is single-use in practice because
the key is already known.

### Admin (owner allow-list)

`GET /api/admin/queue`, `POST /api/admin/items/:id/approve`,
`POST /api/admin/items/:id/reject { reason }`,
`POST /api/admin/items/:id/remove { reason }`,
`POST /api/admin/items/:id/restore`, and
`POST /api/admin/authors/:userId/verify|unverify`.

The queue is an endpoint before it is a surface: the owner can review through
`curl` or a small script, and a drawn admin screen is a later addition, not a
gate on launching the backend.

## Identity

- **Better Auth** on the same Worker with the D1 adapter, `socialProviders`
  for GitHub and Google, `bearer()` and `oneTimeToken()`.
- The editor is served from `http://127.0.0.1:<port>`, where a third-party
  cookie is unreliable. So the host does not depend on one:
  1. The host opens the Worker's social sign-in URL in the system browser.
  2. After the provider returns, the Worker's return page calls
     `generateOneTimeToken` against the session it just set, then redirects to
     the host's loopback callback with the token.
  3. The host calls `one-time-token/verify`, captures the session token from
     the `set-auth-token` header, and stores it.
  4. Every authenticated Worker call carries `Authorization: Bearer <token>`.
- The token lives in `settings/store-session.json` (the file that replaces
  `settings/github-token.json`), written with owner-only permissions, never
  logged and never sent to the editor page. A 401 clears it and the surface
  asks the author to sign in again.
- Browsing, downloading, the index and thumbnails require no session at all.
  Only publishing, favouriting and managing own items do.
- The existing GitHub device-flow token has no migration: an author signs in
  once through the new flow. `github-token.json` is deleted on first run of
  the new host, after the user signs in successfully.

## Client changes

- **One catalogue address.** Move `CATALOGUE_RAW_BASE` and the editor's
  `CATALOGUE_INDEX_URL`/`CATALOGUE_CDN_BASE` into one Fabric-free module in
  `renderer-core`, exporting the origin and the URL builders. Both packages
  import it; the two hand-kept constants disappear. The origin is a build-time
  constant, changed in one place, because the Worker address is stable per
  deployment and pre-release work may break cleanly.
- **`download.ts`** allows exactly the Worker origin over https and permits no
  redirect. The GitHub hosts leave the allow-list with the backend.
- **Submission.** `github-submit.ts`, `github-item.ts`'s file assembly and
  `validate-item.ts`'s CI contract are replaced by `store-client.ts`, which
  performs the version request, the presigned PUT and finalize.
  `readPublishedItem` is deleted; `submissionFiles` reads the authenticated
  baseline instead, and keeps its job — validate locally, bump, write the
  library, build the package — returning the envelope and thumbnail the client
  sends. `github-item.test.ts`, `published-item.test.ts`, the fork-poll tests
  and the submit route's GitHub branches move with their owners.
- **Store routes.** The host gains `/api/store/auth/*` (start, callback,
  sign-out), `/api/store/submit`, `/api/store/items/:id/unpublish|publish`,
  and proxies `GET /api/store/mine`. The host owns the token; the editor never
  sees it.
- **Surface.** The online tab's facet row gains a `Mine` toggle, drawn only for
  a signed-in author. With it on, the grid lists own items in all states with a
  status badge (`Pending`, `Unpublished`, `Removed`, `Rejected`), and the item
  modal shows Unpublish, Republish, and the owner's reason where one exists.
  The public listing is unchanged.
- **Install, origins, version display** are untouched. `ThemeOrigin` still
  records `catalogueId` and `version`, and "Installed"/"Update" still derive
  from it.

## Security and abuse

- **Ownership is checked on every mutating route** against
  `item.author_user_id`; a mismatch is 404. Admin routes check the owner email
  from the session, not a stored flag.
- **A client cannot name an R2 key.** The presign route derives it from the id
  and the version the Worker itself computed.
- **Quotas**, enforced at presign time from D1: at most 20 items per account,
  and a per-author package total of 1 GiB, counted over `item_version.bytes`.
  This bounds what one compromised or careless account can put into the 10 GB
  bucket. The numbers are defaults, stored as constants in the Worker.
- **Uploads are unvalidated bytes until finalize.** Size is checked by HEAD;
  the hash is computed on read. A presigned upload that is never finalized
  leaves an unreferenced object; see "Open questions".
- **Rate limiting** comes from Better Auth for auth routes; the Worker adds a
  per-session limit on presign requests so an authenticated account cannot
  mint unlimited upload URLs.
- Secrets: `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`/`SECRET`,
  `GOOGLE_CLIENT_ID`/`SECRET`, `R2_ACCESS_KEY_ID`/`SECRET_ACCESS_KEY`,
  `OWNER_EMAILS`. No secret is baked into the editor bundle or the host's
  served files.

## Migration

1. Deploy the Worker, D1 schema and private bucket; run Better Auth's
   migrations through a protected `/migrate` endpoint or the CLI with a D1
   token.
2. Run a one-off owner script outside the repo: read the existing
   `catalogue/6041df49-9c61-4d51-a184-716890560bdb/{item.json,*.zip,thumbnail.png}`,
   validate the package with `readThemePackage`, derive facets, insert the
   item and version rows, and upload both objects to R2.
3. Sign in as the owner, import the item as published (the migration script
   does not go through the author flow; it seeds the store's own record).
4. Flip the catalogue origin in the client, rebuild, and smoke-test: index,
   thumbnail, install, download counter, favourite, Mine, unpublish and
   republish.
5. Archive `peterng1618/yunari-store` and disable its workflows. No redirect
   from the old URLs is built and no dual read is attempted.

The imported item's `downloads` and `favorites` start at zero. The GitHub
backend's counters were never item-level and cannot be carried across; the
store records this rather than inventing a number.

## Verification

- **Worker integration tests** with `@cloudflare/vitest-pool-workers` against
  real D1 and R2 bindings, not mocks. Required cases:
  - an unverified author's finalize lands `pending` and is absent from the
    index; approval lists it;
  - a verified author's finalize is listed immediately;
  - downloading increments exactly once per request and a second download
    makes it two;
  - unpublish removes the item from the index and makes item, thumbnail and
    package answer 404, while the version row, counters, favourite rows and R2
    objects still exist;
  - republish restores the entry with the same downloads and version;
  - `removed` refuses republish and names the reason;
  - the version endpoint refuses a claimed version that disagrees with
    `versionFor`, a `none` change, and a `removed` item;
  - a favourite toggles once and the count in the index follows;
  - a presign request cannot choose another author's item or path.
- **Red-proofs**: disable the `status = 'published'` predicate in the package
  route and watch the unpublish test fail; disable the download increment and
  watch the counter test fail; disable the version recomputation and watch the
  disagreement test fail. Restore from a copy outside the repo and verify with
  `cmp`.
- **Browser proof**: the Mine toggle, the status badge and the modal's
  Unpublish action require rendered inspection, plus registered captures in
  `docs/evidence/screenshots/README.md`. The existing e2e store cases route
  the index through `page.route`, which continues to work unchanged.
- **CPU measurement**: hold a production-like index (the migrated item plus
  generated fixtures) and record Workers CPU for `GET /index.json` and one
  auth callback. The free-tier claim rests on that number, not on the
  documentation's 10 ms.
- **Not verified by a unit test**: a real GitHub/Google OAuth round trip. It
  is exercised once by hand against the deployed Worker and recorded in the
  plan's evidence.

## Open questions

1. **Orphan uploads and drafts.** A presigned PUT that is never finalized
   leaves an R2 object with no `item_version` row, and its item row stays
   `draft`. The quota bounds both per author; a daily cron deleting
   unreferenced keys and empty drafts older than 24 hours is the obvious fix
   and is deliberately not in v1. Revisit when the bucket's usage report shows
   unreferenced bytes.
2. **Admin surface.** The queue and verify actions are endpoints first. A drawn
   admin screen is not specified here.
3. **Hard delete.** Neither an author nor the owner can delete bytes in v1.
   `removed` keeps them. A retention period and a delete action are a later
   decision, and the counters' survival question goes with it.
4. **Anonymous favourites.** v1 requires an account to favourite. The
   `anonymous()` plugin could merge guest favourites on sign-in and is
   deliberately not used yet.
5. **Quota numbers.** 20 items and 1 GiB per author are chosen to fit the free
   tier, not measured against real usage.
6. **Custom domain.** Not required by architecture A: the Worker origin serves
   everything. A domain is a cosmetic and caching decision, deferred.

## Acceptance

The backend is done when, on the deployed Worker:

- the migrated item lists, installs and downloads through the Worker;
- a second authenticated author can submit, see `Pending`, have it approved,
  download it, favourite it, unpublish it, see it disappear from browse and
  return on republish with its counters intact;
- the owner can remove an item and the author cannot republish it;
- the full gate is green, the workers integration suite is green, the new
  surface has registered browser evidence, and the CPU measurement is
  recorded against the free-tier limit or the paid tier is adopted and said
  out loud.

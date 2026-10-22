# 0093 — the store backend is one Worker, one D1 database and one private R2 bucket

- **Date:** 2026-10-23
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/catalogue-index.ts`,
  `src/web/packages/renderer-core/src/theme/catalogue-location.ts`,
  `src/web/packages/host/src/server.ts`,
  `src/web/scripts/import-catalogue-item.mjs`

## The problem

The GitHub catalogue answered public reads and review for free, but it cannot
count downloads, cannot let an author withdraw an item, and has no review
instrument after a direct upload. The replacement has to serve bytes privately,
count server-side, authenticate authors from a loopback host, and decide the
version rather than trust the client. The shape is a small backend with four
route families, a relational schema, object storage, and one identity provider
integration — none of which Yunari has built before.

## Rung 1 — Yunari
Searched: `src/web/packages/host/src/themes/` (catalogue-source, download,
published-item, github-*), `renderer-core/src/theme/catalogue-index.ts`,
`editor/src/store-mode/`.
Found: a complete client for a GitHub-hosted catalogue — URL constants, a
download allow-list, a package reader, the wire shapes `CatalogueIndex` /
`CatalogueEntry` — and no server, database, session or upload code anywhere.

## Rung 2 — dependencies
Searched: every `package.json` in `src/web` for `better-auth`, `aws4fetch`,
`hono`, `jose`, `jsonwebtoken`, `@cloudflare/*`.
Found: none. The workspace has no HTTP server framework and no auth library;
the host uses Node's own `http` server. `fflate` is already present for ZIP
reading, which the import script reuses.

## Rung 3 — platform
Searched: the Cloudflare R2 Workers API reference, the R2 presigned-URL page
and the aws4fetch example (links below), plus the spec's free-tier table.
Found: a Worker request body is capped at 100 MB on Free/Pro while the archive
cap is 95 MiB, so a package cannot pass through a Worker request body; the R2
binding gives `get`/`head`/`put` with streamed bodies and no egress fee; the S3
API supports presigned `PUT` with a 1 s–7 day expiry; D1 has no interactive
transactions.

## Rung 4 — ecosystem
Searched (Exa, 2026-10-23):
- `Cloudflare Workers Better Auth D1 adapter one-time-token bearer session self-hosted example`
- `presigned PUT URL R2 aws4fetch Worker signQuery private bucket stream package downloads`

Found: Better Auth runs on D1 with the `bearer()` plugin and `trustedOrigins`;
Alchemy's Cloudflare D1 page records the load-bearing caveat — **D1 has no
interactive transactions**, so any plugin needing them (SCIM in 1.7) needs
another database, and migrations must be additive. Cloudflare's own aws4fetch
example signs a `PUT` with `aws: { signQuery: true }` and `X-Amz-Expires`, and
notes that a signed `Content-Type` must match exactly or the upload fails
`SignatureDoesNotMatch`. The files-sdk R2 guide compares binding-only,
binding+credentials and S3-API modes, confirms the 100 MB binding limit, and
notes keys containing `.`/`..` must be rejected or URL normalisation signs a
different object.

No project found solves Yunari's exact shape (private packages proxied for
authoritative counts plus a Worker-computed version ladder); the pieces are
documented primitives, and the composition is the spec's.

## Rung 5 — comparison
| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| A. Private R2, Worker proxies reads | Counts and unpublish enforced at one place | One invocation per download | Worker CPU, 100k req/day | Chosen |
| B. Public R2 + Worker for JSON | Cheap, cacheable bytes | Download bypasses the Worker | Beacon counts, unpublish cannot revoke a shared URL | Rejected |
| C. Worker checks then redirects to a signed URL | Enforced at issue time | Signed URL outlives the check | Aborted downloads overcount, link leaks | Rejected |

## Rung 6 — probe
Not yet measured. The Workers integration harness runs against real miniflare
D1/R2 bindings (plan Task 1.1), which proves correctness, not CPU. Workers CPU
for `GET /index.json` and one auth callback is measured after deploy (plan Task
5.2); the free-tier claim stays unproven until then.

## Decision

One Worker owns public reads, auth, author and admin routes. D1 holds metadata
and counters; private R2 holds packages and thumbnails; uploads are presigned
`PUT`s whose key the Worker derives; Better Auth supplies sessions with the
bearer plugin; the Worker recomputes the version from the submitted envelope.
Reason: it is the only option where a withdrawal and the download count are
enforced at the byte-serving boundary, which are the two properties the GitHub
backend could not provide.

The catalogue's wire shape and URL builders move into one Fabric-free
`renderer-core` module so the host, the editor and the import script read one
origin. Writes to `host/src/server.ts` and the import script are part of the
same boundary: the host is the only holder of the session token, and the script
drives the same author flow as the product rather than writing D1 or R2
directly.

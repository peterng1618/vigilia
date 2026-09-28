# 0009 — A theme asset URL is the base plus the declared path, whole

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`,
  `src/web/packages/renderer-core/src/theme/assets.ts`,
  `src/web/packages/player/src/main.ts`,
  `src/web/packages/player/src/theme-loader.ts`

## The problem

A theme package declares each asset as a **package-relative path**,
`assets/badge.svg`, and `ASSET_PATH_PATTERN` requires that `assets/` prefix —
it is a path inside the package, not a route suffix. Two halves of one
mechanism then have to agree on how that path becomes a URL:

- `createAssetResolver` takes a `baseUrl` documented as the *"URL prefix for
  package-relative asset paths"* and appends the declared path verbatim.
- the host route `^\/api\/themes\/([^/]+)\/assets\/(.+)$` bakes a literal
  `assets/` into the pattern and looks its second group up **as the whole
  declared path**.

The route's literal is a *second* copy of a prefix the declared path already
carries, so it consumes the first segment of the path it is supposed to be
looking for. The route can only ever match a URL that spells the prefix
twice. It is not a data bug — it is a **prefix applied at two points**, and
the two spellings each look defensible in isolation:

| client | URL it asks for | route result |
|---|---|---|
| `player/src/main.ts` (the resolver) | `/api/themes/<id>/assets/badge.svg` | 404 |
| `player/src/theme-loader.ts` (fonts) | `/api/themes/<id>/assets/assets%2Fbadge.svg` | 200 |

Measured against a running host (port 4175, seeded `e2e-hosted`):

| URL | result |
|---|---|
| `/api/themes/e2e-hosted/assets/badge.svg` | **404** |
| `/api/themes/e2e-hosted/assets/assets/badge.svg` | 200 |
| `/api/themes/e2e-hosted/assets/assets%2Fbadge.svg` | 200 |

A second defect hides behind the first, LAN-only: `main.ts` bakes
`session.withToken(base)` into the base, and `withToken` appends `?session=`
to the end of what it is given. The path is then appended *after* the query,
so a paired display requests `…/api/themes/<id>/?session=Tassets/badge.svg`.
Loopback never saw it, because `withToken` is a no-op with no token.

## Rung 1 — Vigilia

Searched: `renderer-core/src/theme/assets.ts` (`createAssetResolver`,
`AssetResolverOptions`, `isSafeAssetPath`), `theme/document.ts`
(`ASSET_PATH_PATTERN`), `host/src/server.ts` (the route and its siblings),
`player/src/main.ts` (both mounts), `player/src/theme-loader.ts`,
`player/src/session.ts` (`withToken`), `editor/src/asset-manager/index.ts`,
`editor/src/editor-session.ts`, `theme-library-client.ts`,
`docs/architecture/ownership.md`, and every reader of the route.

Found:

- **The resolver's contract has two other live callers that depend on the
  prefix surviving.** `player/src/main.ts:144` and
  `fake-source/src/themes/themes.test.ts:85` both pass `baseUrl: "/"`, and
  `tests/e2e/display-fabric.spec.ts:585` loads `/assets/thermometer.svg`
  from the page root. Strip the prefix inside the resolver and those three
  request `/thermometer.svg` — a file that does not exist.
- **The editor does not consume this route at all.** `AssetManager` holds the
  bytes in memory and hands out `URL.createObjectURL(blob:…)`; it never
  fetches `/api/themes/<id>/assets/…`. So the route has exactly two
  consumers, both in the player, and they spell it differently.
- `docs/architecture/ownership.md:109` — *"Declared package-asset HTTP reads"*
  is `host/src/server.ts`. The route is the owner of this half.
- `createAssetResolver` is the existing owner of *"how a declared path
  becomes a URL"*. `theme-loader.ts` open-codes a second spelling of it with
  `encodeURIComponent(asset.path)`. That second spelling is the drift.

## Rung 2 — dependencies

Searched: the two places in this workspace that consume the resolver's output
— `scene-fabric/src/background-media.ts` (`mounted.src = source.url` on an
`HTMLImageElement`/`HTMLVideoElement`) and `player/src/theme-loader.ts`
(`fetcher(url)`) — and the workspace manifests for anything that owns path
composition.

Found: **nothing to borrow, and no dependency participates.** The seam is
string composition plus a `Record<string, Uint8Array>` lookup, both of them
ours. A dependency cannot be wrong about the host's own route. The consuming
sides pass the URL straight to the platform, so a wrong URL fails at fetch
time and is reported as `onMediaError` / a console warning rather than a throw
— which is why this was silent rather than loud. No new dependency.

## Rung 3 — platform

Searched: `URL` / `URLSearchParams` composition, and `decodeURIComponent`
on a path segment.

Found: two facts, both load-bearing.

- `URLSearchParams` has no "append to a path" operation. A query string
  belongs at the **end** of a URL, so anything that appends a query must
  run *after* the path is complete. That is the ordering `main.ts` gets
  wrong, and it is a platform fact, not a style choice.
- `decodeURIComponent` on the captured remainder is a no-op when the
  resolver encoded per segment (`assets` + `/` + `badge.svg`) and the whole
  thing when the font loader encoded wholesale (`assets%2Fbadge.svg`). The
  route therefore does not need to know which client spelled it — but
  *after* the fix only one client remains, and the round-trip is asserted
  rather than tolerated.

## Rung 4 — ecosystem

Searched, for the question this note actually turns on — *how does a
package/theme server map a declared package-relative path onto a route:
strip the prefix, keep it, or normalise?*

- `vinext` `assetServingUrlFromBaseAnchored` (jsdelivr, `dist/utils/manifest-paths.d.ts`):
  *"Resolve the URL a client asset is actually SERVED from, starting from a
  base-anchored manifest value (no leading slash), e.g.
  `docs/cdn/_next/static/x.js`"*, and *"When no `assetPrefix` is set, the
  base-anchored value is already the served URL and is returned
  unchanged."* **The declared path is kept whole; the base is prepended by
  the consumer.** That is this resolver's contract, arrived at
  independently.
- The same file's `collapseDuplicateBase`: *"Strip a `base` prefix that Vite
  applied twice … yielding `docs/docs/_next/static/…` which 404s."* The
  failure mode of the host route has a name and a shipped helper in a
  different ecosystem: a base applied at two points.
- static-asset-fingerprinting.com, *Asset Manifest Generation*:
  *"The hardest recurring bug in manifest consumption is deciding whether the
  manifest stores `main.3f8a2c1d.js`, `/static/main.3f8a2c1d.js`, or
  `https://cdn.example.com/…`. All three are defensible; mixing them is
  not."* The rule that survives: **store the declared path verbatim, prepend
  the base at consumption.**
- Go `http.StripPrefix` (lets-go.alexedwards.net, and SO 15508250 /
  44341203 / 27945310) — the "strip the prefix" family. StripPrefix exists to
  remove a **route mount point** so a `FileServer` rooted at a directory can
  resolve a relative path; the two only coincide because the URL prefix and
  the directory name are usually the same string. SO 44341203 names the
  coupling as the fragility: *"they could change their URL path to be
  something like `/assets/` without needing to rename the static dir (or
  vise-versa)"*. **This is exactly the host's defect** — `assets/` is both
  the package directory and the route mount, and the coupling broke the
  moment a client spelled the path in full.
- jupyter/nbconvert `ExtractAttachmentsPreprocessor` — the one ecosystem
  that genuinely *flattens*: `![x](attachment:foo.png)` is rewritten to
  `![x](foo.png)` and stored under `path_name/basename`. It flattens because
  the writer targets a **directory**, and the 2026 traversal hardening
  commit shows what that costs (basename-only, `..` rejected, absolute paths
  rejected). Our path is a *package-relative key* into a validated record,
  not a directory to walk — and `isSafeAssetPath` already does the job
  nbconvert had to add.

**Nobody in the ecosystem normalises the declared path on the way to a
route.** The two families are "keep it whole and prepend a base" (bundler
manifests) and "strip a *mount point* before a filesystem walk" — and a
declared package path is neither a mount point nor a directory. The route's
literal `assets/` is the thing that is wrong: it is a mount point wearing a
package directory's name.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **(a) route** — capture `assets/…` as the whole declared path and look it up directly | the URL becomes base + declared path, which is what the resolver already emits and what both other `baseUrl: "/"` callers need | one pattern | sibling routes (`/document`, `/answers`, `/thumbnail`) must not collide; the `assets/` anchor makes that free, unlike a bare `(.+)` | **accepted** |
| (b) resolver — stop prefixing, give the player `…/assets/` as its base | fixes the player | one expression | breaks the two `baseUrl: "/"` callers (`/thermometer.svg`), and re-words a `renderer-core` contract other packages share | rejected — breaks the fixture mount |
| (c) route normalises — re-add `assets/` to the captured remainder | fixes the player | one expression | same break as (b), and the *route* now carries the package's directory name, which is the coupling Rung 4 rejects | rejected — keeps the coupling |
| (d) accept both spellings in the route | no client changes | a second `find` | compatibility glue preserving a superseded design; the two spellings stay available, so the next client picks the wrong one | rejected — `AGENTS.md` |

## Rung 6 — probe

The three-row table in *The problem*, measured with `curl` against a real
host process (`node packages/host/bin/vigilia.js --no-browser --port 4175
--themes-dir .e2e-host-themes`) after `npm run build`, against the seeded
`e2e-hosted` package which declares `assets/badge.svg`:

```
404  /api/themes/e2e-hosted/assets/badge.svg
200  /api/themes/e2e-hosted/assets/assets/badge.svg
200  /api/themes/e2e-hosted/assets/assets%2Fbadge.svg
404  /api/themes/e2e-hosted/assets/assets%2Fnope.svg
200  /api/themes/e2e-hosted/document
```

The resolver's output is row 1 by construction: `baseUrl` ends in `/`, so
`base = "/api/themes/e2e-hosted/"`, and `asset.path.split("/").map(encodeURIComponent).join("/")`
yields `assets/badge.svg`. Row 4 shows the declaration check is already
sound — the lookup, not the safety rule, is what fails.

## Decision

**The route stops owning an `assets/` segment; the URL is the base plus the
declared path, whole.** The pattern becomes
`^\/api\/themes\/([^/]+)\/(assets\/.+)$` — the capture is the whole declared
path, looked up unchanged, so the declared path round-trips verbatim and
`isSafeAssetPath` is not weakened (it is not consulted by the route at all;
the route only ever serves a path the package already declared and validated,
and the `assets/` anchor means a request that is not a package path never
matches).

Three consequences, all of them the point:

1. **The `assets/` anchor is what keeps the siblings safe.** `/document`,
   `/answers` and `/thumbnail` cannot be captured, so the match needs no
   reordering and no negative lookahead. A bare `(.+)` would have swallowed
   all three.
2. **`theme-loader.ts` stops spelling the URL itself** and calls
   `createAssetResolver`, so the player has exactly one way to ask for a
   theme asset. Two spellings is what let the seam drift; one owner is what
   stops it.
3. **The token moves off the base and onto the finished URL.** The resolver
   owns base + path; the session owns the query. `?session=` after a path
   is not a preference, it is the only order a URL can be in.

**What this does not do.** It does not make the URL pretty: a packaged file
under `assets/` is served from `/api/themes/<id>/assets/assets/<file>`, and
the doubled reading is the honest composition of base + declared path. It
would only read better by dropping a prefix from the declared path, which
is option (b) and breaks the fixture mount.

## Revisit when

The package format stops requiring an `assets/` prefix on declared paths
(`ASSET_PATH_PATTERN`), or a theme gains a second asset root. Either makes
`assets/` a package *layout* fact that the route no longer needs to
hard-code, and the anchor can become a plain `(.+)` over whatever the
package declares. Until then the anchor is the cheapest thing that both
expresses "this is a package path" and keeps the sibling routes out.

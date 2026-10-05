# 0010 — A declared asset is served as its own type, or nothing decodes it

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`,
  `src/web/packages/host/src/serve/static-path.ts`

## The problem

The host answered `/api/themes/<id>/assets/<path>` with
`content-type: application/octet-stream` for every declared asset. `fetch` and
`FontFace` do not care — the font path worked, which is why nothing had
objected. **`<img>` and `<video>` care very much**: a browser will not decode
image bytes whose response type is not an image type, so a packaged image
never became an image. This is the same route as
[0009](0009-a-theme-asset-url-is-base-plus-declared-path.md) and the same
acceptance, but a different mechanism: fixing the URL makes the request
*arrive*; it does nothing for whether the bytes *become an image*.

The declaration carries `kind` (`image | svg | gif | video | font`) and
`path`. `kind` alone is not a media type — `image` spans PNG, JPEG, WebP and
AVIF — so something has to turn the declaration into a `content-type`.

## Rung 1 — Vigilia

Searched: `renderer-core/src/theme/document.ts` (`AssetReference`, `AssetKind`
and the comment that *"Asset type is declared explicitly; renderers should not
infer it from the path"*), `renderer-core/src/theme/validate.ts`
(`validateAssets`, `validateAssetPath`), `theme-package/`, and
`editor/src/asset-manager/index.ts` (`TYPES`).

Found:

- **The owner already exists, in the host.** `host/src/serve/static-path.ts`
  has `contentTypeFor(filePath)` over a `CONTENT_TYPES` allowlist — 19
  extensions, a superset of anything a theme can declare (`svg`, `png`, `jpg`,
  `jpeg`, `gif`, `webp`, `avif`, `mp4`, `webm`, `woff`, `woff2`, `ttf`,
  `otf`), with `application/octet-stream` for anything else. It is exported
  from the package barrel, unit-tested in `static-path.test.ts`, and
  `server.ts` already calls it for bundle files. The first draft of this note
  added a second table in `renderer-core`; it was deleted on finding this, and
  the reuse is the whole fix.
- **A second, unrelated table** — `TYPES` in the editor's `AssetManager`, 11
  extensions, keyed by the file the *user picked*. It is module-private and
  the host may not import from the editor (`AGENTS.md`), so it is a
  constraint worth honouring, not an owner. Note the asymmetry the two tables
  have today: the editor's import set is a subset of the host's serve set, so
  the host table can answer for anything the editor can produce.
- **The validator does not constrain the extension.** `validateAssetPath`
  checks only the `assets/` prefix and safe characters, so a hand-authored
  package can declare any extension. `contentTypeFor` already answers that
  case — octet-stream — so the mapping stays total without a new decision.
- Nothing in `theme-package` records a type beside the bytes.

## Rung 2 — dependencies

Searched: the two consumers of a declared asset's URL in this workspace —
`scene-fabric/src/background-media.ts` and `scene-fabric/src/scene.ts` — and
the workspace manifests for anything that derives or overrides a media type.

Found: **nothing to borrow and nothing in the way.** The media element is given
`mounted.src = source.url` and the browser resolves that URL itself; nothing
between the response and the decoder reads the bytes or overrides the type.
That is not an argument from reading a dependency's source — it is the Rung 6
probe, where the same bytes failed as a response and succeeded as a typed blob.
No dependency is worth adding for a lookup the platform already performs, and
none is installed that would do it better.

## Rung 3 — platform

Searched: how a browser decides whether response bytes are an image.

Found: the `Content-Type` response header is authoritative for `img.src`.
Without `X-Content-Type-Options: nosniff` a browser will sniff *raster* images
by magic bytes, but **SVG is not sniffed** — an SVG served as
`application/octet-stream` is refused, and SVG is a first-class `AssetKind`
here (`object-asset.ts` types it beside `image`, and `document.ts` gives it
its own kind). So a generic `image/*` would be a half-measure that happens to
pass on PNG and fail on the format the player is most likely to be handed.

## Rung 4 — ecosystem

Searched, for *what a file server sends when it has a declared asset table
rather than a bare directory*:

- Express `res.type()` / `res.sendFile()` (expressjs.com 4x and 3x API docs,
  expressjs/express DeepWiki file-operations page): `res.type()` *"sets the
  `Content-Type` HTTP header to the MIME type as determined by the specified
  `type`. If type contains the `/` character, then it sets the `Content-Type`
  to the exact value of `type`, otherwise it is assumed to be a file extension
  and the MIME type is looked up in a mapping"*; `res.sendFile()` and
  `res.download()` *"automatically set the `Content-Type` response header based
  on file extension"*, via the `send` module and `mime-types`. **The extension
  is the input, not a stored attribute.**
- The same library's answer for an extension it does not know:
  expressjs/express#7035 — *"`mime.contentType()` returns `false` for
  unrecognized types … This is consistent with how `res.type()` already handles
  the same case (it falls back to `application/octet-stream`)."* The fallback
  is a documented part of the rule, not an oversight.
- Go `http.ServeContent` / `FileServer`, via lets-go.alexedwards.net: the
  handler *"will remove the leading slash from the request URL path and then
  search the `./assets/static` directory"* — the name in the URL is the input
  to the lookup, and the type follows it.

**Everyone answers from the name, and falls back to octet-stream.** Nobody
stores the type beside the bytes at write time, and nobody sniffs. That is the
shape the fixture's `TYPES` already follows, so this is not a new idea — it is
the same rule applied at the point where the bytes leave the process, and it
is the rule `contentTypeFor` was already implementing for every bundle file
this host serves.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **(a) serve the asset through the host's existing `contentTypeFor`** | the owner is already there, already tested, already used by this file for bundle files | one argument | none: the allowlist is a superset of what a theme can declare, and unknown extensions keep today's answer | **accepted** |
| (b) store a `contentType` in the package declaration | most explicit | schema change, every writer and the validator | a new required field on every existing package; the value would be a claim, not a fact | rejected — a claim, not a derivation |
| (c) sniff magic bytes server-side | needs a real sniffer for video and font containers | a new dependency and a parsing path | accepts a type the author never declared, which is the opposite of the declared-kind rule | rejected |
| (d) keep octet-stream and have the client wrap the fetch in a typed blob | the editor already does this for its own bytes | every player media path rewrites its URL handling | Fabric fetches these itself, so the client does not get to choose | rejected — the fetch is not ours |
| (e) a second table in `renderer-core` beside `isSafeAssetPath` | plausible — the declaration lives there | ~20 lines | two extension tables that can drift, and the host's already covers the editor's | rejected — the owner was in the same file already |

## Rung 6 — probe

Chromium, same origin as the host, against the seeded `e2e-media` package.
The two loads differ only in how the bytes reach the image element:

```
contentType: "application/octet-stream"
direct:  { ok: false }                              // <img src="/api/themes/e2e-media/assets/badge.svg">
viaBlob: { ok: true, w: 24 }                        // same bytes, new Blob([bytes], { type: "image/svg+xml" })
```

The response type is the only variable, so the route answering
`application/octet-stream` is what stopped a packaged image from decoding —
not the URL, not the bytes, and not the SVG.

## Decision

**The asset route serves the declared path through the host's own
`contentTypeFor`, the same function that already types every bundle file this
process hands out.** One extension table, one owner, one answer for an
extension nobody knows: `application/octet-stream`, which is what ships today.

The declared `kind` is not consulted. `document.ts` says the type is declared
explicitly and renderers must not infer it from the path, and a kind does not
name a media type anyway — `image` spans four of them. The route answers from
the *name* of the bytes, exactly as a static file server does, and the
declaration still decides **whether** the bytes are served at all.

## Revisit when

The package format carries a media type beside the bytes. Then the answer stops
being derivable from the name and `validateAssets` becomes the place that
rejects an extension the host could not describe.

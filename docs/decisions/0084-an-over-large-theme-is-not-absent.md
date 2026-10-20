# 0084 — A stored theme that is too large to read is not absent

- **Date:** 2026-10-21
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`, `src/web/packages/host/src/themes/store.ts`,
  `src/web/packages/editor/src/theme-library-client.ts`, `src/web/packages/editor/src/boot-theme.ts`

## The problem

A `theme.json` on disk larger than `MAX_THEME_FILE_BYTES` (32 MiB) is, to every reader, a theme that is
not there. `readStored` returns `undefined` from its size branch before validation runs, `readStoredOrAbsent`
folds that into the same absence the listing and the write path use, the open route answers `404 Theme not
found.`, and `boot-theme.ts`'s `openTheme` catches that as `none` — so the editor mounts the template and
writes "Editor ready" over a document the author has on disk, at a path the editor itself named (`vg-409`).

This is the shape [`decisions/0043`](0043-an-invalid-theme-is-not-a-404.md) already solved for the
*validation* trigger, one trigger over: **a stored document that is present and unreadable, where the
reason is known one layer below the answer and thrown away there.** 0043's own comment in the store says
the size choice was deliberate — "an over-large document is not a validation failure, and naming it one
here would be a different decision" — and that comment is the constraint, not the bug. The task is to make
a size refusal *distinguishable* from absence without reclassifying it as a validation failure.

## Rung 1 — Vigilia

Searched: `readStored`, `readStoredOrAbsent`, `readEnvelope`, `MAX_THEME_FILE_BYTES`, every `themeStore.read`
call site in `server.ts`, every typed refusal in `themes/store.ts`, and `theme-package`'s own bounds.

Found: the store **already has the convention this needs.** `ThemeConflictError` (`409`),
`ThemeIdTakenError`, `ThemeAssetLimitError` (`413`) and `ThemeValidationError` (`422`) are the family, each
with a comment saying why it is not dressed as a `400`. `readStored` is the single owner of the size branch,
so one edit covers every reader. `themeStore.read` has exactly **two** callers in `server.ts` —
`readThemeOrAbsent` and the open route's own read — and the open route is the only one the two
facts are different answers for, which is the same asymmetry `decisions/0043` found and relied on.
`theme-package` enforces its own bounds (`MAX_ARCHIVE_BYTES`, `MAX_ENTRY_BYTES`) but reports them as a
`fail("…")` string rather than a typed error, so it has nothing to reuse.

## Rung 2 — dependencies

Searched: `src/web/packages/host/package.json`'s dependencies and `server.ts`'s imports.

Found: `@vigilia/renderer-core`, `@vigilia/scene-fabric`, `@vigilia/theme-package`, `node-forge` and
`systeminformation`; HTTP is `node:http` with no framework, no router and no error-mapping middleware.
Nothing installed maps a storage error to a status, and nothing needs to be added — the store and the route
are both ours.

## Rung 3 — platform

Searched: `node:fs`'s read as the store uses it, `node:http`'s response writing (`sendText`/`sendJson`),
and RFC 9110 §15.5.14 (`413 Content Too Large`).

Found: the byte length is already in hand at the point of refusal — `bytes.byteLength` is the comparison
the branch makes — and writing any status and body is one call. What the platform does **not** give is the
mapping. `413` is defined for *request* content: "the request entity was larger than limits defined by the
server" (MDN, RFC 9110 §15.5.14). Here the over-large thing is a *stored* document served on a `GET`, which
is outside that definition, and nothing chooses a status for you either way.

## Rung 4 — ecosystem

Searched: the repo for every `413` (host and editor, all `.ts`); npm and framework docs for libraries that
map typed errors to statuses — `http-custom-errors`, `@jdpnielsen/http-error` (Boom-inspired),
`aiohttp.web_exceptions`, `node-http-server`.

Found: all four existing `413`s in this repo answer an over-large **request body** — the thumbnail route's
own byte cap, the package-import body cap, the save route's body cap, and the `ThemeAssetLimitError` branch
of that same save route. In
the ecosystem every `413` is likewise named for request content: Boom's factory is `entityTooLarge` =
"Request Entity Too Large"; `aiohttp`'s `HTTPRequestEntityTooLarge(max_size)` defaults its text to
"Maximum request body size {max_size} exceeded"; `node-http-server`'s `413` is its body cap. **No library
models a stored resource that is too large to serve** — the shape is ours, and nothing in the dependency
set has an opinion. The nearest in-repo precedent is the typed-refusal family above, whose rule is that a
refusal which is not a malformed request does not get dressed as one.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep the size refusal folded into absence | States a cause that is false — the file is there | none | The defect itself: the editor reports success over a document it never opened (`vg-409`) | rejected |
| Reclassify as `ThemeValidationError` (`422`) | Distinguishes it, in a channel the client already branches on | none | A false diagnosis: nothing about the document is invalid; the bound is the store's, not the schema's, and 0043's own comment forbids this | rejected |
| `500` | Names *something* | none | Blames the host for a document that is simply past a bound, and sends the author nowhere | rejected |
| `ThemeTooLargeError` → `413`, beside the `409`/`422` family | Distinguishes present-but-too-large from absent in the channel the client branches on; reuses the codebase's own "too large" status | one error class per layer, one status | RFC 9110 frames `413` around request content, so a stored document on a `GET` is a stretch | **chosen** |
| A new status (`507`, `503`, anything else) | No stretch | one status no other route in this repo speaks | Inventing vocabulary for a case the codebase already has a word for | rejected |

## Rung 6 — probe

Measured 2026-10-21 against the built host at BASE `a42273b3` (`packages/host/dist`), started with a
private app folder (`--app-dir C:/tmp/vigilia-23-11/probe-app --no-browser --port 4239`) holding **one**
theme whose `theme.json` is 34,603,008 bytes (33 MiB — a valid envelope padded with trailing whitespace)
and nothing else:

| Request | Response |
|---|---|
| `GET /api/themes/big-theme` | `404` "Theme not found." |
| `GET /api/themes/big-theme/document` | `404` |
| `GET /api/themes` | `200` `{"themes":[],"templates":[…]}` |

The document is on disk at the path the editor names, and no answer says it is there. Re-run after the fix,
the first row answers `413` and the other two are unchanged. The probe is recorded rather than argued: the
defect is a silent one, and nothing in the repo asserted this behaviour before the fix.

## Rung 7 — build

What is built, layer by layer:

- `themes/store.ts` — `readStored`'s size branch throws `ThemeTooLargeError` instead of answering
  `undefined`; `readStoredOrAbsent` folds **both** typed refusals into absence, so the listing, the write
  base and `readEnvelope` are unchanged. `ThemeStore.read` needs no change: it already propagates, which is
  why the open path is the one that distinguishes.
- `server.ts` — the open route's catch answers `413` for the new error and keeps `404` for an id that is
  not there; `readThemeOrAbsent` folds it too, so the display view, the asset lookup, the active-theme
  resolution and every existence check are unchanged.
- `theme-library-client.ts` — `open()` throws its own `ThemeTooLargeError` on `413`.
- `boot-theme.ts` — `openTheme` maps it to `{ kind: "too-large" }`, a fourth member of the discriminated
  union.
- `editor-main.ts` — the switch handles the kind: mount the template, and write a status naming the reason
  rather than "Editor ready". The `never` exhaustiveness guard makes the new union member a compile error
  until it is handled, which is the design working.

## Decision

**The read path stops flattening a size refusal into absence, and the two facts are distinguishable to the
caller that can act on them.** The size refusal becomes its own member of the store's typed-refusal family —
`ThemeTooLargeError`, mapped to `413` — and every reader that can serve neither answer still sees the same
absence it saw before.

**The specific reason:** the store already knew which of the two facts was true and discarded it one layer
below the only caller that cares; `413` is this codebase's one existing word for "too large", so the choice
was which channel carries the distinction, and a status the client branches on without parsing prose is the
channel that survives the next caller. **The stretch is deliberate and recorded:** RFC 9110 §15.5.14 frames
`413` around *request* content and this is a *stored* document on a `GET`; inventing a second size-ish
status would be worse vocabulary than reusing the codebase's own.

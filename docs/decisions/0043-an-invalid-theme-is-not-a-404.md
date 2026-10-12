# 0043 — A theme that exists but does not validate is not a 404

- **Date:** 2026-10-13
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`, `src/web/packages/host/src/themes/store.ts`

## The problem

A `theme.json` on disk that fails `validateFabricThemeEnvelope` — a stale locale key, a stray
`backgroundMedia.scale` — is indistinguishable, to every reader, from a theme that is not there. The store's
`readStored` returns `undefined` for both, the route answers `404 Theme not found.`, the library listing omits
it, and `boot-theme.ts`'s `openQuietly` catches everything and returns `undefined`, so the editor says
"Fabric editor ready" over a document it never opened (`vg-110`).

The shape worth solving: **a stored document that is present and unreadable, whose diagnosis is already
computed and thrown away one layer below the answer.**

## Rung 1 — Vigilia

Searched: `readStored`, `readEnvelope`, `checked`, `themeStore.read` call sites in `server.ts`,
`boot-theme.ts`'s `openQuietly`, and every existing typed refusal in the store.

Found: the store **already has the convention this needs**. `ThemeConflictError` and `ThemeAssetLimitError`
are thrown for refusals the server maps to `409` and `413`, each with a comment saying why it is not dressed
as a `400`. `checked()` also consumes the validation issues — but that is the *write* path. The read path is
the one that flattens them, and `server.ts` has **six** `themeStore.read` call sites, of which the open route
is the only one that should distinguish the two answers.

## Rung 2 — dependencies

Searched: `src/web/packages/host/package.json`'s direct dependencies and `server.ts`'s imports.

Found: `@vigilia/renderer-core`, `@vigilia/theme-package` and `systeminformation`; HTTP is `node:http` with
no framework, no router and no error-mapping middleware. There is nothing installed whose opinion this could
defer to, and nothing to add: the store and the route are both ours.

## Rung 3 — platform

Searched: `node:http`'s status handling as `server.ts` uses it (`sendText`/`sendJson`), and what the
validator already returns.

Found: writing any status and body is one call, and `validateFabricThemeEnvelope` already returns
`{ ok: false, issues }` — the diagnosis exists at the point of failure. What the platform does **not** give is
the mapping: `422 Unprocessable Content` (RFC 9110 §15.5.21) is defined for exactly "the content is
understood and its semantics are invalid", which is this case, but nothing chooses it for you.

## Rung 4 — ecosystem

Searched: the repo for any existing `422` (host and editor, all `.ts`), and the dependency set for anything
that maps storage errors to statuses.

Found: **no `422` anywhere in the host or the editor** — this would be the first, so the precedent had to come
from the file itself rather than from outside. Nothing in the dependency set has an opinion. The nearest
in-repo precedent is the pair of typed refusals above (`409`, `413`), and the note under them states the rule
this decision follows: a refusal that is not a malformed request does not get dressed as one.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep `404` for both | The cause it states is false half the time — the exact defect `0018` was written against | none | The author is told a theme they can see on disk does not exist, and the editor reports success over it | rejected |
| Same `404`, different body text | Correct words, wrong channel: `boot-theme.ts` decides from the failure, not from a string, and a client that keys on status cannot see it | none | The report is dropped again by the next caller | rejected |
| `500` | Names the server as the broken party | none | The host is fine; the document is not, and a `500` sends the author to the wrong place | rejected |
| `422` with the validator's issues | Distinguishes present-but-invalid from absent, in the channel the client already branches on; reuses the store's typed-error convention | one status, one error class | An author sees a new status for a case that previously looked like absence | **chosen** |

## Rung 6 — probe

Measured 2026-10-13 against the built host in `packages/host/dist`, started with a private app folder
(`--app-dir C:/tmp/vigilia-drain/probe-app --no-browser`) holding one theme whose `theme.json` carries a
locale key the validator refuses:

| Request | Response |
|---|---|
| `GET /api/themes/broken` | `404` "Theme not found." |
| `GET /api/themes/broken/document` | `404` "Theme not found." |
| `GET /api/themes` | `200` `{"themes":[],"templates":[…]}` |

The theme is present on disk, named in neither answer as present, and the third line is the listing half
`vg-110` also names. The probe is recorded rather than argued: nothing in the repo asserts this behaviour
today, which is why the fix needs a case per layer.

## Decision

**The read path stops flattening the validation result and tells the caller which of the two facts is true.**

- `themes/store.ts` throws `ThemeValidationError` (carrying the validator's own `issues`) when a theme file
  exists and does not validate. Its siblings are the `409`/`413` errors above; this is the read-side member of
  that family. `list()` keeps skipping an invalid theme — the listing half is a different decision and D7's
  `vg-041`/`vg-188` ruling owns what a derived property is in general.
- `server.ts` answers `422` with the issues where a theme is present and invalid, and keeps `404` for an id
  that is not there. The call sites that treat absence as ordinary — the active-theme resolution and the
  existence checks — catch it as absent, so a corrupt theme cannot turn a listing into a `500`.
- The client and `boot-theme.ts` carry the distinction to the editor, whose boot outcome becomes
  discriminated rather than nullable: with an optional callback or a `Content | undefined` return, the next
  caller can drop the report again, which is how this survived. `editor-main.ts` writes the issues into the
  status element instead of "Fabric editor ready".

**The specific reason:** the diagnosis already exists one layer down and is discarded; the only question was
which channel carries it, and `422` is the one the client can branch on without parsing prose — which is the
same reason `0018` refuses to assert a cause it cannot prove.

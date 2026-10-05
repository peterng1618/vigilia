# 0018 — A 404 names the cause it can prove

- **Date:** 2026-09-30
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`

## The problem

`serveStatic` takes a `missingBundleHint` and sends it for every file it fails
to read. One string therefore has to cover two unrelated facts:

1. the bundle root has no entry HTML — the developer has not built it yet;
2. the bundle is built and this particular path is not in it.

Only the first makes that text true. The second is what a browser asks for
every time it wants a favicon, a stale chunk, or a file that was renamed — and
the text tells the reader to run a build they have already run. The message is
also the one this repo's own `AGENTS.md` sends people chasing ("Build the host
before running `bin/vigilia.js`"), so following it produces the identical
response and no progress.

The shape worth solving: **a not-found response that must distinguish an
unbuilt artefact from a missing file inside a built one, without asserting a
cause it cannot verify.**

## Rung 1 — Vigilia

Searched: `serveStatic`, `resolveStaticPath`, `missingBundleHint`, `server.test.ts`,
`document-favicon.test.ts`.

Found: `serveStatic` is the single owner and already knows which bundle it was
given; `resolveStaticPath` owns traversal and returns `undefined` for escapes,
which is a different failure (`403 Forbidden`, already correct). No other code
in the host composes a 404 body.

## Rung 2 — dependencies

Searched: the host package's direct and transitive dependencies.

Found: nothing. The host runs on `node:http` and `node:fs` with no web
framework — there is no middleware to consult and nothing installed that
already answers this.

## Rung 3 — platform

Searched: `node:http`, `node:fs`.

Gives: writing a status and a body (`sendText`), and reading candidates in
order. `fs.stat` on the root's `index.html` answers "is this bundle built" in
one call. Nothing in the platform distinguishes the two cases for you, but it
does not need to — the fact is one `stat` away and the function already knows
which path to ask about.

## Rung 4 — ecosystem

Searched: how a static server words its 404, and whether any distinguishes an
unbuilt bundle from a missing file.

Found: nobody ships this, and the reason is instructive. Express's
`serve-static`, `connect` and `http-server` all send a bare 404 with no body.
Vite's preview server prints a "does this path exist" hint, but only in its dev
console. Caddy and nginx serve a configurable `error_page` and nothing more.

**They do not solve this shape because in a deployed server the bundle is
always built, so the question never arises.** It arises here and only here: the
host serves bundles out of a source checkout, where "not built" is a real and
common first-run state and is worth a sentence. That is the whole of the
non-obvious part, and it is why this is a note and not a `stat` call.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Bare 404, no body (what Express does) | Loses the first-run hint that `AGENTS.md` itself sends people chasing | none | A developer with no build gets no way forward | rejected |
| One message for both facts (today) | Simple, and the message is right exactly half the time | none | Asserts a cause it cannot verify; the rebuild loop is the observed cost | rejected |
| `stat` the entry file, branch on it | Right in both cases; the fact is already reachable from inside `serveStatic` | one `stat` per miss | A miss now costs a second filesystem call | **chosen** |

## Rung 6 — probe

Measured against a host running with both bundles built
(`packages/player/dist/index.html` and `packages/editor/dist/index.html` both
present, written minutes earlier):

| Request | Response |
|---|---|
| `/theme.json` | `404` "The player bundle is not built. Run: `npx vite build packages/player`" |
| `/assets/theme.zip` | `404` "The player bundle is not built." |
| `/assets/nope.js` | `404` "The player bundle is not built." |
| `/editor/assets/nope.js` | `404` "The editor bundle is not built." |
| `/editor/nope.html` | `404` "The editor bundle is not built." |

Five misses, two bundles built, one false cause each. The rebuild these
messages ask for was run, and the next request returned the same message.

## Decision

`serveStatic` keeps its `missingBundleHint` for the case it is true of, and
answers `Not found.` in the case it is not. The entry file is asked about once,
on the miss path only, so the common case — a file that reads — costs nothing
extra. The traversal case is untouched: that already answers `403` before any
of this runs.

**It does not echo the requested path**, which was the first version and was
wrong within a minute of being measured: `/editor/assets/nope.js` came back
naming `/assets/nope.js`, because the editor mount resolves against the
slice after `/editor`. A path this function cannot state correctly is worse
than no path — the reader is already looking at the URL they typed, so the one
thing they did not need is the one thing worth getting wrong. "Not found." is
the whole of what is true.
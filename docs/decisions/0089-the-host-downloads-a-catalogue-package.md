# 0089 — The host downloads a catalogue package, because the browser is not allowed to

- **Date:** 2026-10-21
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/themes/download.ts`
  `src/web/packages/host/src/server.ts` (the install route, Task 3)

## The problem

Phase D of `2026-10-12-theme-store-design.md` gives each catalogue item an
Install action. The item's `packageUrl` points at a `.zip` — a release asset
(option A) or a file in the catalogue repo (option B) — and something has to
fetch it before `@yunari/theme-package`'s reader and `ThemeStore` can write it.

The shape worth solving is **acquiring a remote binary whose address comes from
a remote document**. The URL is data, not code: it arrives inside `index.json`,
so the fetch is a trust boundary in a way the product's other requests are not.
Three things are true at once — the runtime that can do it (Node) has never
made an outbound third-party request, the runtime the product prefers (the
browser, per 0088) is measured to be unable to, and the reader that will consume
the bytes enforces a 64 MiB cap only *after* they are in memory.

## Rung 1 — Yunari

Searched: every `fetch(` under `packages/host/src`, `packages/theme-package/src`
and `packages/renderer-core/src`; `MAX_ARCHIVE_BYTES`; any redirect handling;
every package's dependency block; and `docs/decisions/0088` for the index route.

Found: **the host has exactly two production `fetch` sites**,
`providers/lhm.ts:105` and `providers/lhm-launcher.ts:148`, and both are
`http://127.0.0.1:8085`. Every other hit is a test fetching its own server. **A
catalogue download is the host's first outbound third-party request.**

**Nothing in the host follows or inspects a redirect.** No allowlist, no size
counter, no timeout on an outbound request exists anywhere in `packages/`.

**The cap the reader enforces is private and late.** `MAX_ARCHIVE_BYTES`
(`theme-package/src/index.ts:21`) is 64 MiB, applied by `readThemePackage` to a
`Uint8Array` it has already been handed. A downloader that buffers first would
hold an unbounded body before the reader ever sees it, so the cap has to be
enforced during the read, and it must be the reader's number rather than a
second one.

**The write already has owners.** `themes/import.ts` decides the library id
(`importIdCandidates`) and writes through `ThemeStore`; `settings/theme-origins.ts`
owns `theme-origins.json`. This fetch adds bytes and nothing else — no storage,
no id rule, no origin record.

`docs/decisions/0088` decided the browser fetches `index.json`. **That stays
true.** This note is about the package, which takes a different route for a
measured reason rather than a changed preference.

## Rung 2 — dependencies

Searched: every `package.json` in the workspace, direct and transitive.

Found: **no HTTP client** (no axios/ky/got/undici/node-fetch) and **no retry
library**. The host runs Node 22, whose global `fetch` is stdlib. `fflate` is
already the reader's unzip dependency, not a downloader. Adding a client would
be a runtime dependency with a licence read, a `THIRD-PARTY-NOTICES.md` entry
and a `docs/engineering/dependencies.md` update — for a request this small.

## Rung 3 — platform

Searched: Node's `globals` documentation and undici's `Fetch` documentation for
redirect policy, response-size limits and timeouts; and the phase-D probe for
the actual GitHub headers.

Found: **Node 22's `fetch` gives four things and leaves four to the caller.**

- It gives: TLS, HTTP/1.1 and HTTP/2, a WHATWG `ReadableStream` body, and
  `redirect: "manual"`, which undici documents as returning the **actual
  response** rather than an opaque one — so script sees the `3xx` and its
  `Location`.
- It leaves: **any host policy** (`redirect: "follow"` follows undici's own
  limit, not this catalogue's); **any body-size cap** (the docs state none;
  `Content-Length` is a hint the origin sets); **any timeout** (`fetch` has no
  timeout parameter — `AbortController` is the only mechanism); and the choice
  to follow a redirect at all.

**The measured fact that decides the runtime:** a release asset's
`browser_download_url` answers **`302` to `release-assets.githubusercontent.com`**,
then the asset, and **neither hop sends `access-control-allow-origin`**.
Measured 2026-10-21 with an `Origin` header. A browser `fetch` of that URL is
therefore blocked by CORS, and the editor cannot download a package directly.
Node has no CORS: the same URL is an ordinary request. (0088's rung 3 measured
the other direction, that the *raw path* is CORS-open; the index and the package
are different resources on different routes.)

`URL` is the other platform piece: it parses the address, normalises the
hostname, and resolves a relative `Location` against the current URL, so the
allowlist compares a parsed host rather than a string prefix.

## Rung 4 — ecosystem

Searched: the workspace's dependency tree; Node's and undici's docs (above).

Found: **each ecosystem client that has a knob for this still leaves the two
policy decisions to its caller.** `node-fetch`'s `size`, `got`'s
`maxRedirects`/stream hooks, axios's `maxContentLength`/`maxRedirects`, and
undici's dispatcher options are all about *a* request; none knows that this
catalogue may be reached only at four GitHub hosts, and none knows the reader's
64 MiB. A library would replace four lines of loop with an API and still need
the allowlist and the cap written here.

**NOT ESTABLISHED:** whether a client exists that combines a redirect-host
allowlist with a streaming byte cap and a wall-clock timeout. The web-search
tool was unavailable during this task; undici's docs name no such option and no
installed dependency offers one. What is established is that the policy half
stays ours regardless.

## Rung 5 — comparison

| | **A. Editor's browser downloads the package** | **B. Host downloads it with native `fetch`** | **C. Host downloads through a new HTTP client** |
|---|---|---|---|
| Works against a release asset | **no** — no `access-control-allow-origin` on either hop (measured) | yes | yes |
| First outbound third-party request from the host | not incurred | **incurred** | incurred |
| Redirect policy | the browser's, not ours | `redirect: "manual"`, one hop, host re-checked | client's option, host still re-checked by us |
| Size cap the reader enforces | reader's, after buffering | **streamed counter at the reader's own cap** | client option + our counter |
| Timeout | none | `AbortController`, 60 s | client option |
| New dependency | none | none | licence read, notices, docs |
| Unit proof | jsdom + injected `fetch`, but not the CORS block | injected `fetch`, no network | same, plus the client's own behaviour |

Option A is not a preference that lost; it is measured not to work. Between B
and C, every load-bearing rule (allowlist, one hop, catalogue cap) is caller
code either way, so C buys convenience and a dependency and nothing else.

## Rung 6 — probe

Measured 2026-10-21 (phase-D probe, not re-measured here):

- `browser_download_url` with an `Origin` header → **`302`** to
  `release-assets.githubusercontent.com`, then the asset. **Neither hop sends
  `access-control-allow-origin`.**
- The host's production `fetch` sites: exactly the two `127.0.0.1:8085` ones
  above.
- undici's Fetch docs: `redirect: "manual"` returns the actual response; no
  response-size option is documented.
- Node's globals docs: `fetch` has no timeout option; `AbortController` is the
  mechanism.

The module is proved without a network by taking the same injectable-`fetch`
shape `font-specimen-cache.ts:25` uses, so the probe that matters in CI is the
unit test: https-only, allowlist, one redirect, streamed cap, and a stalled
body ending in a refusal.

## Rung 7 — build

One new file (`themes/download.ts`) and its test; Task 3 adds the route
`POST /api/themes/install` to `server.ts` and calls this function. The
allowlist is `github.com`, `objects.githubusercontent.com`,
`release-assets.githubusercontent.com` and `raw.githubusercontent.com` — the
hosts options A and B can legitimately produce. `MAX_ARCHIVE_BYTES` is exported
from `@yunari/theme-package` so the downloader and the reader hold **one
number**. `timeoutMs` defaults to 60 000.

**What is not built:** retry, resume (`Range`), checksum verification, caching
and progress. A retry is the person pressing Install again; a partial read
leaves nothing on disk because bytes are returned only after the whole body is
in memory and under the cap; a checksum has no published value to compare
against until the catalogue grows one.

## Decision

**The host downloads a catalogue package with Node's native `fetch`; the editor
never does.**

The reason is measured, not architectural: **the release-asset route is
CORS-blocked for a browser and ordinary for Node**, and 0088's browser fetches
`index.json` on a different, CORS-open route. The request is constrained at the
trust boundary this URL crosses — https only, four hosts, one redirect that may
not leave them, and the reader's own 64 MiB enforced while the body streams —
and the bytes then go to the owners that already exist (`importThemePackage`,
`ThemeStore`, `ThemeOriginsStore`) rather than to a second writer.

**Consequences to carry:** this is the host's first outbound third-party
request, so the allowlist is the whole of its SSRF surface and belongs in this
module rather than in the route; a redirect is followed at most once, and a
second hop is refused even when its host is allowed; the self-signed local
origin does not enter this path (`ThemeLibraryClient` is loopback JSON, this is
outbound TLS); and the install route must still be loopback-only — the module
constrains *where the host fetches*, the route constrains *who may ask it to*.

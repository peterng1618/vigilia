# 0071 — The player installs as an app, and its worker lives at the host's root

- **Date:** 2026-10-18
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/serve/static-path.ts`,
  `src/web/packages/host/src/server.ts`

## The problem

`vg-577`: the player is to be an installable app. Two of the four things that
makes are browser-side and free — a manifest link and a worker script. The
other two are the host's, and they are the whole difficulty:

1. **A worker's scope cannot exceed its script's path.** The player is served
   at the host's root, so the worker has to be reachable at `/sw.js` for the
   scope to be `/`; a worker under `/assets/` controls `/assets/` and nothing
   else, which cannot serve the shell offline.
2. **The browser fetches that script itself.** A session token rides in the
   query string here (`server.ts`'s `tokenFor`) and in a header a `fetch` sets
   — and neither is available to `navigator.serviceWorker.register()`. So the
   request arrives unpaired, and `server.ts` refuses an unpaired reader every
   path that is not `/assets/**` or `/favicon.svg` with 403. Task 25.8
   measured exactly this: its probe worker met the pairing guard and the
   registration failed with `A bad HTTP response code (403) was received when
   fetching the script`, which is why that proof registers from `/assets/`.

So the question is not "how do we write a service worker". It is **where the
script lives, and what the host already allows** — and both answers land on two
watchlisted files.

## Rung 1 — Yunari

Searched: `grep -rniE "serviceworker|service-worker|webmanifest|manifest\.json|workbox|vite-plugin-pwa|beforeinstallprompt|appmanifest"`
over `src/web/packages`, `src/web/tests`, `docs` and `scripts`, plus
`host/src/server.ts` (every `403`, the pairing guard, `serveStatic`),
`host/src/serve/static-path.ts` (`CONTENT_TYPES`, `contentTypeFor`),
`packages/player/public/`, `packages/player/index.html` and
`packages/player/vite.config.ts`.

Found: **nothing that is a PWA, and nothing in the way.** No manifest, no
worker, no install prompt, no icon set anywhere in the tree. The only
`manifest.json` hits are the *theme package* format (`theme-package/src/index.ts`),
which is a different object with the same word. What does exist and matters:

- `CONTENT_TYPES` is a 19-extension allowlist and has **no `.webmanifest`**, so
  that extension arrives as `application/octet-stream`.
- `packages/player/public/` is Vite's copy-verbatim root — the only place a
  file with a stable, unhashed name can be added to the player bundle.
- `packages/player/index.html` already carries `viewport-fit=cover`, a
  `color-scheme` meta and a `/favicon.svg` link, so the document is already
  shaped for a phone.
- `docs/decisions/0019` is the rule the pairing guard implements: the allowlist
  holds **bundle bytes, not dashboard content** — "the same JavaScript any
  loopback visitor already has; it contains no reading, no theme and no device".
- `host-secure-origin.spec.ts` carries the 403 measurement above in prose, and
  hands it to this task by name.

## Rung 2 — dependencies

Searched: `src/web/package-lock.json` for
`vite-plugin-pwa|workbox[a-z-]*|@vite-pwa/[a-z-]*`, and the registry's own
metadata for the two shapes a build-time answer would come in.

Found: **nothing installed, and nothing small enough to want.** `npm view`:

| Package | Registry says |
|---|---|
| `vite-plugin-pwa` 2.0.0 | MIT; depends on `workbox-build`, `workbox-window`, `tinyglobby`, `pretty-bytes`, `debug` |
| `workbox-build` 7.4.1 | MIT; **30+ direct dependencies**, including `rollup`, `@babel/core`, `@babel/preset-env`, `ajv`, `terser`, `tempy` |
| `@vite-pwa/assets-generator` | a separate package whose subject is generating the icon set from one source image |

`packages/player/package.json` carries a deliberate "an editor dependency here
is a Gate 0 failure" note and a size budget; the player's dependency list is a
statement, the same way the host's is. Rung 2 is empty, which is why rung 5 is
real work rather than a formality.

## Rung 3 — platform

Searched: the APIs the feature is actually made of — `navigator.serviceWorker.register`,
`ServiceWorkerRegistration.scope`, `CacheStorage`, `<link rel="manifest">` —
and what the host does with a request that is neither `/assets/**` nor
`/favicon.svg` from a non-loopback peer.

Found: **the platform gives the whole feature and no server-side hook.**

- A worker's default scope is its script's directory. The only way past that is
  a `Service-Worker-Allowed: /` response header on the script itself.
- **The browser fetches the worker script, and there is no way to give that
  fetch a credential.** No header, no query parameter, no cookie — the design
  has none and the link the host prints is the pairing mechanism. So the
  decision reduces to *which paths an unpaired reader may fetch*.
- The host's answer to that question today is one line of `server.ts`:
  `url.pathname.startsWith("/assets/") || url.pathname === "/favicon.svg"`.
- `.webmanifest` is absent from `CONTENT_TYPES`, so a manifest under that
  extension is served as `application/octet-stream`.

## Rung 4 — ecosystem

**Live web search was unavailable in this session** — the tool answered that it
could not run a query — so this rung is MDN, the W3C/WHATWG pages that fetched,
`web.dev`, the npm registry read from this box, and Chromium measured directly
(rung 6). Recorded as that rather than presented as a survey.

Searched: MDN's `Service-Worker-Allowed` header page and its Web app manifest
page; `web.dev/articles/install-criteria`; `npm view` for the packages in rung 2.

Found:

- **`Service-Worker-Allowed` is the documented way to widen a scope past the
  script's directory**, and "put the script at the root" is the other one
  everyone gives. Without the header a registration asking for a wider scope
  fails; the header is the only mechanism.
- MDN: a manifest is `application/manifest+json`; `application/json` "also
  generally works"; a manifest fetched without credentials is a plain same-origin
  GET.
- `web.dev`'s Chrome criteria: `name`/`short_name`, `start_url`, `display` one of
  `fullscreen`/`standalone`/`minimal-ui`, HTTPS, and **icons that "must include a
  192px and a 512px icon"**. It gives no icon *format* and no error strings — which
  is why rung 6 measures instead of trusting it.
- The ecosystem's answer to the whole problem is `vite-plugin-pwa`: it owns the
  Vite config, generates the manifest and the icon set, and emits a precache
  list of *this build's* files. That last part is the part this repo already
  has — Vite's content-hashed filenames in `/assets/` — and the rest is a
  build-time dependency for one manifest and one worker.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Worker at `/assets/sw.js` + `Service-Worker-Allowed: /` | works; the path is already allowlisted, so `server.ts` is untouched | a per-response header in `serveStatic`, plus a source file copied into Vite's own output directory | medium: the header is a promise the browser verifies and a redirect silently drops it; the file sits among build artefacts | rejected — more mechanism, less visible |
| Worker at `/sw.js`, added to the bundle-asset allowlist | scope `/` with no header; the file sits at the root of the player's public root, where it is served from | one condition in `server.ts`'s `isBundleAsset` | low: the same rule 0019 already states, applied to two more bundle files | **chosen** |
| Manifest as `/manifest.json` (`.json` is already mapped) | no `CONTENT_TYPES` change at all | the file's extension names the wrong thing, and the served type is the generic one | medium: `.json` also types a theme document and a sourcemap, so the allowlist stops saying what a manifest is | rejected |
| Manifest as `/manifest.webmanifest` + `application/manifest+json` in `CONTENT_TYPES` | the registered media type for the extension; one line | the allowlist gains an entry | low | **chosen** |
| `vite-plugin-pwa` (+ workbox, + an icon generator) | generates the manifest, the worker and a precache list | 30+ packages in a package that declares two, plus a Vite-config owner | medium: it owns the build for a feature this small, and its precache list duplicates hashing Vite already does | rejected |
| A hand-rolled precache manifest (a build step listing hashed assets) | offline from the first load | a build script, a generated file, and a way to keep it in step | low but real: the generated list is a second source of truth about the bundle | rejected — the runtime cache covers it (below) |

## Rung 6 — probe

**Chromium 153 via Playwright 1.63, on Windows 11, against a scratch static
server outside the repo.** A *persistent* profile is required: Playwright's
default context reports `in-incognito`, and Chrome's installability check
short-circuits there, so every case returned an empty error list and the
instrument read nothing. With a real profile, `Page.getInstallabilityErrors`
and `Page.getAppManifest` discriminate. Measured, one variable at a time:

| Case | `getInstallabilityErrors` | `beforeinstallprompt` |
|---|---|---|
| `display: standalone`, `start_url: "/"`, one SVG icon `sizes: "any"` | `[]` | fired |
| the same, icons removed | `manifest-missing-suitable-icon`, `no-acceptable-icon` (`minimum-icon-size-in-pixels: 144`) | not fired |
| the same, `display: "browser"` | `manifest-display-not-supported` | not fired |
| the same, **`start_url` omitted** | `start-url-not-valid` | not fired |
| the same, served as `application/octet-stream` | `[]` | fired |
| the same, served as `text/plain` | `[]` | fired |

Two of these changed the design:

- **`start_url` omitted is not installable.** The default is the document URL
  and it is not enough for Chrome 153, so `start_url` is written out. That is
  the measurement behind `"start_url": "/"` rather than leaving the launch URL
  implicit.
- **A wrong content type is not refused by this client.** The task brief
  expected `application/octet-stream` to make "every browser refuse it"; Chrome
  153 parsed the manifest anyway — `manifest-display-not-supported` still fired
  on the octet-stream case, and `beforeinstallprompt` fired on `text/plain`.
  The registered type is still what gets served (the extension has one, other
  engines are stricter, and this is the reading rather than the expectation),
  but the reading says what was measured.

Also measured: a worker registered at `/sw.js` reports scope `<origin>/`, and
`clients.claim()` in `activate` makes it control the document it was registered
from — the reading the acceptance asks for, taken at the LAN address in
`tests/e2e/host-pwa.spec.ts`.

## Rung 7 — build

What "write it ourselves" is: a manifest of a few hundred bytes, a worker that
routes navigations and `/assets/**`, and a registration module of a few lines.
The worker's hard part is not the Cache API — it is the three rules that are
this project's rather than the platform's:

- **`/api/**` is never cached.** The theme document, its packaged assets and
  the sample stream are the live data, and a cache of them is the fabrication.
- **The document is the host's `no-store` page**, so the network answers first
  and the cache is only the offline fallback.
- **The document is keyed by what it is, not by the URL that asked for it.**
  That URL carries the display's session token, and keying the entry by the
  request writes the credential to a store that outlives clearing history and
  that the host cannot reach when the display is revoked. The document is the
  same bytes whatever the query asked for, so it is stored once under `/`.

A build-time alternative (workbox, `vite-plugin-pwa`, or a hand-rolled precache
list) would move those into the build, and it is worth saying exactly what the
runtime cache cannot do, because "Vite hashes it" is only half true. **Only
Vite's own bundle output under `/assets/` is content-hashed.**
`packages/player/public/` is copied verbatim, so `public/assets/ring.png` and
`public/assets/thermometer.svg` are tracked, stable-named files under that same
prefix, and a cache-first read of `/assets/**` cannot tell a changed one from an
unchanged one — it has no revision to compare. **Nothing fetches either today**:
a grep of `packages/`, `tests/` and the built bundle finds no reference to
them, so the risk is real and unexercised rather than absent. The day something
does fetch one, that is the day a revision-bearing precache list earns its
cost, hand-rolled or bought with rung 5's 30 packages.

## Decision

**The worker is `/sw.js` and the manifest is `/manifest.webmanifest`, both at
the player bundle's root, and both added to `server.ts`'s bundle-asset
allowlist.** The rule is 0019's, unchanged: these are bytes of the bundle, with
no reading, no theme and no device in them, and the alternative — a
`Service-Worker-Allowed` header plus a script under `/assets/` — buys the same
scope with more mechanism and a file that lives among build artefacts.

`CONTENT_TYPES` gains `.webmanifest → application/manifest+json`. The
extension has a registered type; serving the file as `.json` would name a
manifest as a sourcemap.

The manifest says:

- `"display": "standalone"` — **the point of the row, not a detail.** It is
  what draws without browser chrome on a client that never implemented
  `Element.requestFullscreen()` (iPhone Safari, `vg-568`), which is the whole
  reason this is the honest path for that client rather than a dead control.
- `"start_url": "/"` and `"scope": "/"`. **`start_url` cannot carry a session**:
  the manifest is fetched without one, so the host cannot know which display is
  asking. An installed app therefore launches at the host's root, which is the
  host's own "what should this display show" resolution — and from a phone that
  request needs a session, which is the gap `vg-587` records and the
  per-display-themes spec owns. Recorded here rather than papered over.
- one icon, `/favicon.svg`, `"sizes": "any"`, `"type": "image/svg+xml"`. It is
  the mark the player already ships and the path the guard already allows, and
  rung 6 measures Chrome accepting it. **Not done:** a raster `apple-touch-icon`
  for iOS, which needs PNG and is a design decision about the mark; no phone is
  available to check the result on.

**The worker caches the shell and never the telemetry.** `/api/**` — the theme
document, its packaged assets, the sample stream — is passed straight through
and never stored, because an offline display showing yesterday's numbers as
though they were live is the fabrication this project forbids. What an offline
display shows is the shell it already had and the player's own load-failure
page: it says it could not load the theme, and it shows no reading at all.

**And the cached document is keyed by `/`, never by the display's own URL**,
which carries the session. A cache entry is the one copy of the credential this
display would keep where the host cannot reach it to revoke.

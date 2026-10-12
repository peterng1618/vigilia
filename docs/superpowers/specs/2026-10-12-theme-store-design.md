# A theme store for Vigilia

- **Status:** draft — a starting point, not accepted requirements, with no plan
- **Date:** 2026-10-12
- **Scope:** the **theme** half only. Widget packages do not exist yet (§139
  defers them until they have an authoring workflow), so the widget store is a
  later spec that this one must not pre-empt.

## What this is, and is not

This spec records a design agreed in conversation on 2026-10-12. It exists so a
future session starts from the decisions rather than re-deriving them. It is
**not** accepted work: `STATUS.md` alone decides acceptance, and nothing here is
the active plan. The sections that say *unverified* are load-bearing unknowns,
not omissions — a free-tier limit that turns out false changes the architecture.

## The intent

A store inside the app where authors share themes and users browse and download
them. Open browse and download for anyone, including people with no account.
Submission is gated: an author submits, the owner reviews, and the owner may mark
an author **verified**, after which that author's submissions are automated.

## What already exists, and must not be rebuilt

The exchange unit is settled, which is why this design is small:

- `ADR-0004` — `@vigilia/theme-package` owns the ZIP layout and validation. A
  validated package is the immutable portable artifact; a local folder may be an
  authoring workspace but never a competing published format.
- `0017` — a theme is a **folder**; a ZIP is **only** what an author exports.
  Folder and package state do not silently synchronize.
- `§139` — the package embeds its declared `assets/` bytes and may carry a
  thumbnail at the package root, so a recipient sees the look without
  installing. It names "a future store" directly.
- `§141` — validation: reject traversal, symlinks, decompression bombs,
  executable content, external SVG resources; fail cleanly without mutating the
  open document.
- `0009`, `0010`, `0023` — asset URLs are base + declared path, served as their
  own type; the code decides what a theme may carry.
- **Bounds already exist and are enforced in both directions** in
  `host/src/themes/store.ts`: `MAX_ASSET_BYTES` 32 MiB (`:139`),
  `MAX_ASSET_COUNT` 128 (`:140`), `MAX_TOTAL_ASSET_BYTES` 128 MiB (`:141`),
  `MAX_THEME_FILE_BYTES` 32 MiB (`:138`). `assetBounds` (`:206`) runs on save and
  the same refusals run on load (`:555-571`).

The store therefore does not define a format, a validator or a size policy. It
uses the ones that are already contracts.

## Architecture: GitHub is the whole backend

No server the owner runs, and no recurring cost.

| Concern | Mechanism |
|---|---|
| Catalogue | `catalogue/<id>/item.json` plus thumbnail, in one public repo |
| Identity | the author's GitHub account, reused for everything |
| Submission | a pull request against the store repo |
| Review | **the PR diff** — a theme is JSON, so the change is readable |
| Listing | merging the PR |
| Verified author | a login in a list file, which makes their PRs auto-merge |
| Media | release assets, which carry a native `download_count` |
| Delivery to the app | a generated `index.json` over a free CDN |
| Counters | `created`/`updated` from git; `downloads` native; `favorites` via reactions, folded into `index.json` on a schedule |

Why the diff matters: the review instrument is the thing that costs the most to
build, and a PR gives it for free. A theme is JSON, so a reviewer reads what
changed. An upload form plus a review UI is strictly more app for a worse
instrument.

### The trust ladder

1. **Unverified author** — submits a PR. Any GitHub account can fork a public
   repo, so this needs no invite and no setup from the owner. The owner reviews
   and merges, or closes.
2. **Verified author** — a GitHub Action auto-merges their own PR once
   validation passes, with no invitation for them to accept.

**The auto-merge rule is a security boundary, not a convenience.** A fork PR that
auto-merges on the strength of a username will happily carry a diff that edits
`.github/` or another author's item. Auto-merge must require all three of:
the PR author is in the verified list; validation is green; **and the diff touches
only that author's own `catalogue/<id>/` path**. One compromised account must not
be able to rewrite the store's CI or someone else's theme.

### Identity, and skipping it

Browsing and downloading need **no identity at all** — `index.json` is a static
file and downloads are plain URLs, so neither a token nor an API call is involved
and no rate limit applies. Favorite **counts** are baked into `index.json` by the
Action, so an anonymous viewer still sees them; only *casting* a favorite needs a
token. Sign-in is therefore a just-in-time prompt on the heart control and
nothing more. Anonymous downloads still increment the asset counter, so the
download metric survives anonymity.

With no sign-in there is no way to favorite, and nothing else is lost.

### Views are dropped

GitHub exposes no per-item view count, and its traffic API is owner-only and
14 days deep. Rather than build a write endpoint for the one counter with no free
native source, **"most viewed" is not a sort this store offers.** Sorting is
created, updated, downloads and favorites.

## Media: two of three caps exist, and the third is what makes them reachable

Video is expected to be common, and `§139` puts assets *inside* the package, so
an unbounded video makes package size unbounded — which is the one thing that
breaks a zero-cost host. The normalizing rules below are what turn hosting from a
gamble into a budget.

**Size cap — already exists (32 MiB per asset, 128 MiB total).** A cap alone
refuses without letting an author predict the outcome, because
**bitrate × duration** is what fills it.

**Duration cap — proposed at 30 seconds.** At the existing per-asset cap against
a 1080p background loop (realistically 3–8 Mbit/s at CRF 22), 30 seconds lands at
roughly 22–30 MiB and fits with headroom. The total cap then gives the number
that decides hosting: **worst-case package is 128 MiB, so worst-case egress per
download is known before a host is chosen.**

**Resolution ceiling — proposed at 1920 on the long edge.** Without it, a 4K
source halves the permitted duration for no visible gain at dashboard size.

### The publish-time normalizer

An author-facing helper resizes and re-encodes a source video into the envelope,
so the store receives a predictable artifact rather than whatever was recorded.
Reuse `§171`'s shape — images are already downscaled on import past a bound — and
apply the same rule to video.

The envelope, each item earning its place:

- **MP4 with `+faststart`**, so playback and seeking start before the whole file
  arrives.
- **H.264 High, `yuv420p`** — 4:2:4 silently fails to decode in some browsers.
- **Even width and height** — H.264 requires it; odd dimensions fail silently.
- **Constant frame rate, ≤ 30fps** — and this one is Vigilia-specific:
  `scene-fabric/src/background-media.ts` repaints the scene once per decoded
  frame via `requestVideoFrameCallback`, so a variable cadence becomes a variable
  repaint rate.
- **No audio track.**
- **Single-pass CRF ~20–23**; 2-pass buys little on a background loop.

Four rules that keep the normalizer honest:

1. **Normalize to a bound declared in the theme, not to the live artboard
   resolution.** Artboard resolution moves — `§53` fit modes and the device-lens
   work were about a theme rendering at different shapes. A crop baked to today's
   artboard is silently wrong after an artboard edit, and re-normalizing costs a
   generation. Offer `cover` and `contain`, default to preserving the source
   aspect, and let the scene do the framing.
2. **Verify by probe; never re-encode to validate.** CI cannot re-encode
   deterministically across ffmpeg versions. The author normalizes locally and
   the store **probes** the result against the envelope, rejecting out-of-bounds
   input before anything is revived — a property check, not a byte derivation.
3. **Idempotent pass-through.** A file already inside the envelope is copied
   byte-for-byte. Otherwise every resubmission degrades the loop.
4. **The author previews the normalized asset, not the master.** Write it as an
   explicit derived asset in the theme folder — not a silent folder↔package sync,
   which `0017` forbids.

**How the normalizer gets ffmpeg is an open decision**, and it is a licence
question rather than a footnote: a system `ffmpeg` probed at runtime adds no
shipped dependency but requires the author to install it; a bundled static build
is convenient but carries GPL parts such as x264, which pulls in
`THIRD-PARTY-NOTICES.md` and packaging obligations. Leaning: probe and refuse.

## Naming: the incumbent `publish` is renamed, and the store takes the word

`publish` currently means *editor → host, so the paired phone or display shows it*
(`POST /api/publish`, `/api/published`, `publish.surface`, `publishableDocument`,
`publish-loop.spec.ts`). Two different acts sharing one word is the problem, and
**the owner's ruling of 2026-10-12 is that the existing route is renamed** rather
than the store finding a second word:

- **publish** — an author sends an item to the store.
- **submission** — a publish from an unverified author, awaiting review.
- **listed** — passed review and in the catalogue.

The replacement word for the existing route is **not yet decided**. `activate` was
the owner's suggestion and has one real collision: `activate` already means
*keyboard-activating a focused control* in
`editor/src/viewport-manager/navigation.ts` (`activatesOnSpace`,
`SPACE_ACTIVATED_ROLES`), so the phone route would sit beside a second, unrelated
meaning. Clearer candidates, neither colliding: **`cast`** (cast / cast / cast —
present and past participle coincide) and **`go live`** (`/api/live`, `liveTheme`).

**This rename is a prerequisite, and it is bigger than one string.** It is a
family: the route, the `published` store in `server.ts`, its revision accessor,
the `publish.surface` chord, and `publish-loop.spec.ts`. It touches
`host/src/server.ts`, which is a watched path.

## Open questions

Each needs a decision before implementation, and each is recorded with the shape
of the decision rather than a placeholder:

1. **Hosting the bytes** — release assets (no extra account, native download
   counts, but no CDN guarantee and a ToS grey area if an item becomes popular)
   versus an object store such as Cloudflare R2 (a second account and a service
   to maintain, but $0 egress). Starting position: release assets, and move if
   video volume becomes real.
2. **The ffmpeg source** — probe a system binary, or bundle a static build and
   take on the licence obligation.
3. **`index.json` freshness** — how often the scheduled Action regenerates it,
   which sets how stale a favorite count can be.
4. **Moderation beyond the review gate** — the owner reading a diff catches a
   broken theme; it does not catch objectionable imagery in a thumbnail or a
   background video. Who looks at the pixels, and when.
5. **Removal** — what happens to a listed item later withdrawn, and whether
   download counters survive it.

## Not verified, and must be before this is planned

Free-tier limits decide feasibility, so each is a probe rather than an assumption:

- Per-file size caps on the CDN used to serve `index.json` and thumbnails, which
  determine whether it proxies metadata only or can also serve packages.
- Release-asset size ceilings, and Actions minutes on a public versus private
  repo.
- Whether the CDN in front of release assets is viable at all for multi-megabyte
  packages, given its per-file limits.
- Whether `requestVideoFrameCallback` cadence actually suffers under a variable
  frame rate in this renderer, or whether the envelope rule above is defensive
  without a measured reason.

## The repo's own gates still apply

- `AGENTS.md`'s reuse gate: all seven rungs (owner, dependencies, platform,
  ecosystem, comparison, probe, build) recorded before the first write, at
  `docs/decisions/NNNN-<slug>.md`. Rungs 4–5 — the ecosystem and comparison
  searches for "theme/widget exchange over a git host" — are where this design is
  either earned or corrected, and neither has been run.
- `host/src/server.ts` is a watched path in `scripts/reuse-gate.mjs`, so a
  decision note must claim it before the first edit there.
- **The rename can land alone.** It is a refactor of existing behaviour with no
  store dependency, so it is the one piece of this that could be done first
  without committing to any of the rest.
- One implementation plan is active at a time. When this is picked up it becomes
  a plan that queues behind whatever `STATUS.md` names that day.

## Acceptance

Not written. Acceptance is for accepted work, and this spec is not accepted yet —
writing it now would be inventing evidence for a decision nobody has made.

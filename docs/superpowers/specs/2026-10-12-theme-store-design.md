# A theme store for Vigilia

- **Status:** draft — a starting point, not accepted requirements, with no plan
- **Date:** 2026-10-12, **revised 2026-10-16** after the `hydralauncher/hydra-themes`
  study and the rulings below
- **Scope:** the **storefront**, specified kind-agnostically. Three kinds are in
  view — dashboard themes, widget presets and editor themes — and **v1 ships the
  dashboard theme only**, because it is the only kind with an exchange unit. The
  other two get an addendum each, and the reason they can wait is that this
  document's leverage claim depends on an exchange unit existing.

## What this is, and is not

A design agreed in conversation, revised. It exists so a future session starts
from the decisions rather than re-deriving them. It is **not** accepted work:
`STATUS.md` alone decides acceptance, and nothing here is the active plan. The
sections that say *unverified* are load-bearing unknowns, not omissions — a
free-tier limit that turns out false changes the architecture.

**Superseded by this revision, and named so the old reading is not resurrected:**
the previous scope line said "the **theme** half only … the widget store is a
later spec that this one must not pre-empt", and `vg-388` said in as many words
that widgets are out of scope. The user ruled on 2026-10-15 that **the store
carries three kinds and the spec is scoped storefront-now, kinds-follow**. The
widget store is still a later piece of work; it is no longer a later *storefront*.

## The intent

A store inside the app where authors share items and anyone browses and downloads
them. Open browse and download for anyone, including people with no account.
Submission is gated: an author submits, the owner reviews, and the owner may mark
an author **verified**, after which that author's submissions are automated.

## The three kinds, and which has an exchange unit

| Kind | What it is | Exchange unit today |
|---|---|---|
| Dashboard theme | the persisted envelope: `artboard`, `globals`, `assets`, `bindings`, `scene` | **yes** — ADR-0004/0017, §139/§141, `host/src/themes/store.ts` bounds |
| Widget preset | **the same envelope minus the artboard**: a scene **subtree** plus its `bindings`, `globals` and `assets` | no — §139 defers widget packages until an authoring workflow exists |
| Editor theme | a token set for the editor chrome | no, **and that is a decision rather than a gap** |

**A widget preset is a theme envelope minus the artboard** (user, 2026-10-15).
That is deliberately larger than the cheapest reading — a subtree plus bindings
alone — and it is the *cheaper* one overall: it reuses the envelope's own
sections, and therefore its validator and its bounds, rather than inventing a
second format for a second kind. `card-library.ts`'s insertable cards are the
authoring-side precedent: one Fabric `Group` over its parts, readings in the
envelope's `bindings`, and a `provenance` key.

**An editor theme is a token set, not a scene**, because §35 states that
editor-shell theming is separate from authored dashboard theme globals. Nothing
about the dashboard theme's package answers what this artifact is, so its
addendum has to settle that first. `DESIGN.md` is the design language's contract
and the ratchet in `scripts/design-tokens.mjs` guards the chrome, so an editor
theme is a *token* artifact that those instruments can read — not a stylesheet.

**Why v1 is one kind.** This document's central leverage claim is that the store
defines no format, no validator and no size policy, because it reuses the ones
that are already contracts. That claim is true only while one exchange unit
exists. Two of the three kinds have none, so building all three now means
designing two formats in the same breath as the storefront.

## What the hydra-themes study contributes, and what it does not

`hydralauncher/hydra-themes` was studied on 2026-10-16 as the reference for this
design. What it actually does, read from its files rather than its README:

- **Unit:** `themes/<ThemeName>-<authorCode>/` holding exactly one `.css` and one
  `screenshot.<ext>`. There is no per-theme manifest: the name is the folder name
  minus its last dash segment, and that segment is the author's account id.
- **Validation** (`src/lib/validate-themes.ts`, run by CI on every PR): a
  stylesheet exists; a file whose lowercased name starts with `screenshot` has an
  allowed extension; the folder yields a non-empty author code **that resolves as
  a real account through their API**; theme names are unique across the repo.
- **Index** (`src/lib/generate-themes.ts`, run at build): derives
  `{name, authorId, hasAchievementsSupport, hasAchievementSoundSupport}`, makes
  webp thumbnails at 340 and 1920 wide, then **POSTs the array to their API**
  rather than committing a manifest. Git is the submission medium; their server
  is the runtime source.
- **Capabilities are inferred from the artifact**: achievements support means the
  CSS contains a class starting `achievement-notification`; sound support means an
  `achievement.{wav,mp3,ogg,m4a}` file exists. That is a workaround for having no
  schema.
- **No versioning, update or deletion semantics anywhere in it.**

**What transfers.** The minimal unit; validation as one script CI runs; author
identity reused from the host account rather than invented; capability flags on
the index so the client renders badges without fetching every item. All four
already match `vg-388`'s agreed shape.

**What does not transfer, and why it matters more than what does.** Hydra's
theming mechanism is **CSS overriding their app's markup**, which is the one thing
this product forbids: a dashboard theme here is a validated Fabric-JSON envelope,
and the editor chrome is tokens under `DESIGN.md` watched by the ratchet. A
stylesheet-shaped editor theme would bypass the design system and the token
instrument entirely. Inferring capability from selectors is likewise unnecessary
when a schema exists — our items **declare** their kind and their features. And
their server as the runtime source is the opposite of this design's premise, which
is that browsing and downloading touch no API at all.

## What already exists, and must not be rebuilt

- `ADR-0004` — `@vigilia/theme-package` owns the ZIP layout and validation. A
  validated package is the immutable portable artifact; a local folder may be an
  authoring workspace but never a competing published format.
- `0017` — a theme is a **folder**; a ZIP is **only** what an author exports.
  Folder and package state do not silently synchronize.
- `§139` — the package embeds its declared `assets/` bytes and may carry a
  thumbnail at the package root, so a recipient sees the look without installing.
  It names "a future store" directly.
- `§141` — validation: reject traversal, symlinks, decompression bombs,
  executable content, external SVG resources; fail cleanly without mutating the
  open document.
- `0009`, `0010`, `0023` — asset URLs are base + declared path, served as their
  own type; the code decides what a theme may carry.
- **Bounds already exist and are enforced in both directions** in
  `host/src/themes/store.ts`: `MAX_ASSET_BYTES` 32 MiB, `MAX_ASSET_COUNT` 128,
  `MAX_TOTAL_ASSET_BYTES` 128 MiB, `MAX_THEME_FILE_BYTES` 32 MiB. `assetBounds`
  runs on save and the same refusals run on load.

The store therefore does not define a format, a validator or a size policy. It
uses the ones that are already contracts.

## Architecture: GitHub is the whole backend

No server the owner runs, and no recurring cost.

| Concern | Mechanism |
|---|---|
| Catalogue | `catalogue/<id>/item.json` plus thumbnail, in one public repo |
| Identity | the author's GitHub account, reused for everything |
| Submission | **a pull request the app opens on the author's behalf** |
| Review | **the PR diff** — an item is JSON, so the change is readable |
| Listing | merging the PR |
| Verified author | a login in a list file, which makes their PRs auto-merge |
| Media | release assets, which carry a native `download_count` — **but whose repository they live in is open question 1, and the app-opened PR made it sharper** |
| Delivery to the app | a generated `index.json` over a free CDN |
| Counters | `created`/`updated` from git; `downloads` native; `favorites` via reactions, folded into `index.json` on a schedule |

Why the diff matters: the review instrument is the thing that costs the most to
build, and a PR gives it for free. An item is JSON, so a reviewer reads what
changed. An upload form plus a review UI is strictly more app for a worse
instrument.

### The item, and why `kind` is the seam

`item.json` carries a **`kind`** field, and it is the only field the storefront
reads to decide how to present and install an item. Everything else stays as the
draft has it.

**An unknown `kind` must degrade rather than break.** The client renders what the
item declares and refuses what it does not recognise, because the two addenda
will add kinds to a catalogue that already has items in it. This is the one place
v1 pays for kinds it does not ship, and it is cheaper than a migration later: a
client that cannot parse an item must skip it and say so, not fail the listing.

### The trust ladder

1. **Unverified author** — submits. Any GitHub account can fork a public repo, so
   this needs no invite and no setup from the owner. The owner reviews and merges,
   or closes.
2. **Verified author** — a GitHub Action auto-merges their own PR once validation
   passes, with no invitation for them to accept.

**The auto-merge rule is a security boundary, not a convenience.** A PR that
auto-merges on the strength of a username will happily carry a diff that edits
`.github/` or another author's item. Auto-merge must require all three of: the PR
author is in the verified list; validation is green; **and the diff touches only
that author's own `catalogue/<id>/` path**.

**The app-opened PR adds a fourth requirement.** Because the *client*, not the
person, composes the branch and the PR, the client must not be able to name the
target path: the app commits only to the author's own fork and the path is
derived from the author's identity and the item's id, never taken from input. A
client that can name a path is a store-wide write primitive in a compromised build.

### Identity: the device flow, and the first credential this product stores

Browsing and downloading need **no identity at all** — `index.json` is a static
file and downloads are plain URLs, so neither a token nor an API call is involved
and no rate limit applies. Favorite **counts** are baked into `index.json` by the
Action, so an anonymous viewer still sees them; only *casting* a favorite needs a
token. Anonymous downloads still increment the asset counter, so the download
metric survives anonymity.

**Publishing does need a token, and the previous draft was wrong to imply
otherwise.** "Sign-in is a just-in-time prompt on the heart control and nothing
more" is false once the app opens the pull request: the larger act is now the one
that requires identity. What survives is the property that mattered — a viewer who
never publishes never signs in.

- **The flow is GitHub's device authorization flow.** A locally-run host **cannot
  keep a client secret**, so the web redirect flow is unavailable to it. The app
  shows a code, the author approves it on github.com, and the app receives a
  token with the narrowest scope that can fork and open a PR on a public repo.
- **The token is consumer state**, stored beside the active-theme choice and the
  display settings. It is the **first credential this product stores**, so its
  file, its permissions, whether it is encrypted at rest, and what it does on
  failure or revocation are this design's business rather than an implementation
  detail.
- **Nothing secret ever reaches a fork's workflow.** Fork PRs do not receive the
  repository's secrets, which is why the re-homing job below runs after merge
  rather than during review.

### Views are dropped

GitHub exposes no per-item view count, and its traffic API is owner-only and 14
days deep. Rather than build a write endpoint for the one counter with no free
native source, **"most viewed" is not a sort this store offers.** Sorting is
created, updated, downloads and favorites.

## Submission: the app opens the pull request

The user ruled on 2026-10-15 that the app performs the submission. The sequence,
and the one rule each step exists to keep:

1. The app validates the package locally against the contracts above — the same
   validator, before anything leaves the machine.
2. The app forks the catalogue repo into the author's account, if it has not
   already, and commits `catalogue/<id>/item.json` plus the thumbnail to that fork.
3. The app opens the PR against the catalogue repo.
4. CI validates; the owner reviews the diff, or auto-merge fires under the
   four-part rule above.
5. Merging lists the item.

**The alternative, recorded because it is the one an author may prefer:** the app
exports the package and hands over a prefilled GitHub link the author completes
in a browser. No token reaches the app at all. It is not the ruling; it remains
the fallback if the OAuth app becomes a burden, and the client should be written
so the submission step is one seam rather than a path threaded through the UI.

## The client surface, and the three-mode top bar

The user ruled on 2026-10-15/16 that the storefront is a **mode of the editor
shell**, and that **the three-mode top bar lands first**: one shell whose top bar
switches between **theme store**, **theme editor** and **host settings**. The
store is therefore a sibling of the editor rather than something inside it, and it
is never built inside a shell it will leave.

**This makes the top bar a prerequisite, and it is not a small one.** Two
consequences the spec records rather than leaves to the implementer:

- **Two settings surfaces must be reconciled.** The host serves its own
  admin/settings page today (`BundleRoots.admin`), and the editor shell has its
  own settings pane — the one the user named `Editor Settings` on 2026-10-15 while
  ruling on `vg-330`. A mode called *host settings* cannot ship beside a pane
  called *Editor Settings* without saying which one owns what.
- It restructures `editor-shell/`'s header and rail, which `vg-269` and `vg-330`
  are already touching. The three-mode work and `vg-330`'s spec must not be
  written as if the other does not exist.

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

## Two prerequisites that land alone

Both are refactors of existing behaviour with no store dependency, so either can
land before any of the rest without committing to it.

1. **The rename.** `publish` currently means *editor → host, so the paired phone
   or display shows it* (`POST /api/publish`, `/api/published`, `publish.surface`,
   `publishableDocument`, `publish-loop.spec.ts`). Two different acts sharing one
   word is the problem, and the owner's ruling of 2026-10-12 is that the existing
   route is renamed rather than the store finding a second word:
   **publish** — an author sends an item to the store; **submission** — a publish
   from an unverified author, awaiting review; **listed** — passed review and in
   the catalogue. The replacement word for the existing route is **not yet
   decided**; `activate` collides with keyboard-activating a focused control in
   `viewport-manager/navigation.ts`, and `cast` and `go live` are the clear
   candidates. The rename is a family — the route, the `published` store in
   `server.ts`, its revision accessor, the `publish.surface` chord and
   `publish-loop.spec.ts` — and it touches `host/src/server.ts`, a watched path.
2. **The three-mode top bar**, per the section above — and it needs **its own spec**, not a section of this one. It is a shell restructure that reconciles two settings surfaces and rebases `vg-269` and `vg-330`; this document states the requirement and the constraint it puts on the store (the storefront is a mode, so the bar exists first), and nothing more.

## Open questions

Each needs a decision before implementation, and each is recorded with the shape
of the decision rather than a placeholder:

1. **Hosting the bytes — and the app-opened PR has made this sharper.**
   *Deferred by the user on 2026-10-15; the candidates and the new constraint are
   recorded here so the deferral is not a silence.* Release assets belong to one
   repository, and an author's app can only upload to **the author's own fork's**
   releases. Left there, every listed item would point into a stranger's fork:
   the author can delete it and break every item, removal cannot be enforced, and
   the store's own asset counter ceases to exist.
   - **A (leaning) — the fork carries the bytes during review; merging re-homes
     them.** The app uploads to the author's fork release, `item.json` references
     it, reviewers download from there, and a post-merge Action in the upstream
     repo downloads it, uploads it as an upstream release asset and rewrites the
     URL in a follow-up commit. Keeps native `download_count` and store-owned
     bytes, and no secret ever reaches a fork PR. Costs one exception to "the PR
     diff is the review instrument" — the merged `item.json` is not byte-identical
     to the submitted one — and a video is downloaded twice (once at merge, once
     per user).
   - **B — the package rides in the catalogue repo beside `item.json`.** No
     releases and no re-homing, and the diff shows everything including the
     bytes. Costs up to 128 MiB per item in git history permanently, and GitHub
     exposes **no download count for repository files**, so "downloads" stops
     being a sort.
   - **C — an object store with signed uploads.** It is a server, which is the
     one premise this design rests on. Recorded only to be dismissed.
2. **The ffmpeg source** — probe a system binary, or bundle a static build and
   take on the licence obligation.
3. **`index.json` freshness** — how often the scheduled Action regenerates it,
   which sets how stale a favorite count can be.
4. **Moderation beyond the review gate** — the owner reading a diff catches a
   broken item; it does not catch objectionable imagery in a thumbnail or a
   background video. Who looks at the pixels, and when.
5. **Removal** — what happens to a listed item later withdrawn, and whether
   download counters survive it. The re-homing choice above changes this: if the
   bytes live on the store's own release, removal is enforceable; if they live on
   a fork, it is not.
6. **The two addenda** — a widget-preset package and an editor-theme artifact,
   each settled before its kind reaches the store. The editor theme's is a design
   question (what a token artifact is), and the widget preset's is a sequencing
   question (§139 waits on an authoring workflow).

## Not verified, and must be before this is planned

Free-tier limits decide feasibility, so each is a probe rather than an assumption:

- **The device flow against a public client**: that the scope needed to fork and
  open a PR on a public repo is grantable, and what the token's lifetime and
  revocation behaviour are.
- **Release assets on a fork, and a post-merge re-home**: that an Action can read
  a fork's release asset and publish it upstream, and that `download_count`
  survives the move.
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
  `docs/decisions/NNNN-<slug>.md`. **The hydra-themes study is rung 5's evidence
  for the theme half and only for that** — it is one ecosystem comparison of a
  store over a git host, and it covers a single kind with a CSS mechanism this
  product cannot use. Rungs 4–5 still have to be run for the submission mechanics
  the app-opened PR introduces (OAuth device flow, fork-and-PR from a desktop
  client), which the reference does not exercise at all.
- `host/src/server.ts` is a watched path in `scripts/reuse-gate.mjs`, so a
  decision note must claim it before the first edit there.
- **The rename and the three-mode top bar can each land alone**, and the top bar
  is a prerequisite rather than an optional first step.
- One implementation plan is active at a time. When this is picked up it becomes
  a plan that queues behind whatever `STATUS.md` names that day.

## Acceptance

Not written. Acceptance is for accepted work, and this spec is not accepted yet —
writing it now would be inventing evidence for a decision nobody has made.

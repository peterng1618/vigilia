# 0073 — A theme's cost is read from the envelope alone

- **Date:** 2026-10-19
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/performance-cost.ts`

## The problem

The host's assignment surface has to say what a theme will cost the display it is
being given to, before the press: glass over a video background repaints on every
decoded frame, and a video background alone keeps a host monitor out of its
low-power states. The shape that is not obvious is *where the answer comes from*.
The tempting answer is to look at the theme — revive it, walk the Fabric objects,
or sniff the background's file extension — and every one of those is either
unavailable where the listing runs (the host has no scene, `renderer-core` is
Fabric-free) or wrong (an asset's type is declared, never inferred).

So the question this note answers is narrower than "how do we warn": it is
whether a **third reader of two facts that already have two readers** is a new
owner in disguise, or a new *question* asked of owners that stay where they are.

## Rung 1 — Vigilia

Searched: `src/web/packages/renderer-core/src/theme/` (`glass.ts`,
`envelope-semantics.ts`, `fabric-envelope.ts`, `document.ts`'s `AssetKind`),
`src/web/packages/scene-fabric/src/glass.ts` and `background-media.ts`, the
editor's `selection-inspector/glass.ts`, `docs/decisions/0001`, `0002`, `0005`,
and `grep -i "repaint|idle|performance|expensive"` across `src/web/packages`.

Found: **both facts already have an owner, and neither owner answers a cost.**

- Glass is `VIGILIA_GLASS_PROPERTY` + `isGlassTreatment` / `glassTreatment`
  (`renderer-core/src/theme/glass.ts:8,69,78`). `glassTreatment` takes a
  `get(name)` accessor, so it is for *revived* objects; `isGlassTreatment` is the
  raw-JSON test and is what a reader of the document can use.
- The background is `artboard.backgroundMedia.assetId` resolved against the
  envelope's own top-level `assets` — `validateBackgroundMedia`
  (`envelope-semantics.ts:326`) does exactly that resolution, and accepts only
  `image | svg | video`. `scene-fabric/src/background-media.ts:300` is the
  runtime half of the same rule.
- The **costs themselves are already measured and recorded** — 0001 (glass adds
  0 idle repaints; a full-artboard draw per repaint instead), 0002 (flat across
  the 0–48 px radius band), 0005 (post-process blur rejected for an extra pass
  per repaint). What does not exist anywhere in the tree is a function that
  derives a cost *from a document*. The nearest thing is
  `MAX_GLASS_BLUR_RADIUS`'s bound, which is a policy about authoring rather than
  a reading of a theme.
- The one existing document→JSON walk over a scene is `scene-fabric/src/glass.ts`'s
  `function* walk(objects: readonly FabricObject[])` (`:746`). It is private, it
  yields `FabricObject`, and `renderer-core`'s package note forbids Fabric there
  ("this package must never depend on editor UI ... It must also stay
  FABRIC-FREE"). **Two files are named `glass.ts`** and only the scene-fabric one
  has a walker: `renderer-core/src/theme/glass.ts` is 90 lines of vocabulary.

So this is a **third reader, not a second owner**: it owns no vocabulary (it
asks `isGlassTreatment` and reads the same `assets`/`backgroundMedia` shape the
validator already defines), and it owns no measurement (the numbers are 0001,
0002 and 0005). What it owns is one question — "which of these two costs does
this document carry" — asked of a document rather than of a render.

## Rung 2 — dependencies

Searched: `packages/renderer-core/package.json` (including its `//` policy note),
`packages/host/package.json`, and `package.json` at the workspace root.

Found: **nothing.** `renderer-core` has exactly one runtime dependency, `echarts`
6.1.0, and its note forbids editor-only and Fabric dependencies outright.
`@vigilia/host` carries `renderer-core`, `scene-fabric`, `theme-package`,
`node-forge` and `systeminformation`, and its note says a new runtime dependency
needs a `THIRD-PARTY-NOTICES.md` entry first. No cost-estimation, complexity or
scene-analysis package is installed, and none is transitive.

## Rung 3 — platform

Searched: what JavaScript itself gives for reading a JSON document and for
estimating render cost — `typeof`/`Array.isArray` traversal, `structuredClone`,
and the platform's own cost instruments (DevTools *Paint flashing*, the
Performance panel's paint breakdown, `PerformanceObserver` long-task and
`element` timing).

Found: the traversal half is trivial and native (this is a two-key read plus a
recursive walk of `objects`). **The estimation half has no native answer at
all**: every platform instrument measures a render that has already happened, on
a machine that is already running it. There is no API that answers "what will
this document cost" — which is exactly the answer the surface needs, because the
warning has to be on screen before the press. A native capability existing is
not this decision discharged; here it does not even exist.

## Rung 4 — ecosystem

Searched (queries issued 2026-10-19, recorded as issued):
`"static analysis warn user before assigning theme with video background and blur performance cost dashboard tool"`,
`"estimate rendering cost from scene JSON before render library \"cost model\" canvas objects"`,
`"Chrome DevTools paint flashing blur backdrop-filter cost warning UI"`, plus the
candidate names that came up (`paint complexity score raster`, `overdraw
estimation canvas GPU budget`, `render cost heuristic display list Skia`).

Found: **the search channel returned no results in this session** — all three
queries came back as "no web search tool available here", so the queries above
are what was *asked* and not what was *read*. Recorded honestly rather than
padded: this rung's evidence is the shape of the prior art known from the
instrument documentation itself, and it is marked as such rather than presented
as a search result.

What that prior art is, and why none of it fits: **every cost model in this
space estimates a *built* display list, not a document.** Skia/Chromium's paint
cost heuristics score ops as the display list is rastered; WebRender builds a
scene and estimates the build; Mapbox GL and deck.gl budget by overdraw from
built layers; three.js has no model at all beyond draw calls. All of them run
*after* the thing they measure exists, which is the wrong side of the press this
warning has to be on. Nothing ships a document→cost reader, and nothing here is
worth a dependency: the whole reader is two declared facts and a recursive walk.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| A cost-estimation dependency | None exists for a document→cost read (rung 4); the general-purpose ones estimate a built scene | A shipped dependency, a licence review, a `THIRD-PARTY-NOTICES.md` entry — for a reader this size | The package would estimate from a *render*, so the host would have to build one per listing; the answer would arrive after the moment it is for | Rejected |
| Reuse `scene-fabric/src/glass.ts`'s `walk` | It already walks a scene for the same property | Importing `scene-fabric` into `renderer-core`, which its package note forbids, or moving a Fabric-typed generator into a Fabric-free package | The walk yields `FabricObject`, so it needs a revived scene — the host would revive every theme to list them | Rejected |
| Reuse `validateBackgroundMedia`'s resolution | It resolves the same `assetId` against the same `assets` | Nothing — it is already the owner | It reports **issues** into a validator's issue list, not costs; a caller asking it for a cost would be asking a validator to answer a question it does not have, and the listing would have to interpret its issue codes | Rejected |
| `performanceCostsOf(envelope)` in `renderer-core`, reading the declaration and asking `isGlassTreatment` | Exact: no new I/O (the envelope is already read by `ThemeStore.list()`), no renderer, no DOM, no Fabric, and it answers a **list** so the surface can say which cost | ~70 lines and one unit test file | It is a third reader of two facts — bounded by owning neither vocabulary nor measurement (rung 1) | **Chosen** |

## Rung 6 — probe

Measured, not asserted:

1. **The seeded e2e library, through the real route.** A host was started over
   `src/web/.e2e-host-app` and `/api/themes/active` was read: every fixture
   answered `[]` except the new `e2e-video`, which answered
   `["video-background"]`. `seedHostTheme` writes one folder per theme in its own
   array — the clock, disk, temperature, two-language and missing-sensor
   fixtures, the grouped-glass and packaged-media compositions, the chart, the
   overhang composition, and the video fixture this task added — so the probe
   covers the listing carrying costs for a whole real library, and an `svg`
   background (`e2e-media`) not being read as a video one.
   **It does not cover the glass walk**, and the first draft of this note claimed
   it did: `performanceCostsOf` returns before `hasGlass` unless the background
   is a video, and no seeded fixture has both. `e2e-grouped-glass` never reaches
   the walk at all. The recursion is covered by the unit case that nests a panel
   inside a `Group` under a video background ("finds glass inside a group, where
   the editor puts a card"), which is the only place a nested treatment is
   exercised.
2. **The listing pays no new I/O.** `ThemeStore.list()` already reads each
   theme's `theme.json` through `readEnvelope` and hands the parsed envelope to
   `entryFor`; the costs are computed from that same object, so no file is opened
   that was not opened before. The observable half of this is the browser proof
   in step 4 of the task: the host's `/api/themes/active` answers `costs` for
   every theme with no route change at all.
3. **The declaration, not the path, decides — measured by breaking it.** The unit
   case built by `withAssetKind(videoWithGlass, "image")` changes one field — the
   asset's declared `kind` — while its `path` still names the video file, and the
   answer is `[]`. Replacing the kind read with a `.webm` path sniff was run: it
   reddened two cases, "does not call an image background a video one" and "finds
   neither for a plain theme, and neither for glass over an image", and the file
   was restored byte-identically afterwards.

## Rung 7 — build

`performance-cost.ts` in `renderer-core/src/theme/`, exported from the package
barrel as `performanceCostsOf` and the `PerformanceCost` type. It takes `unknown`
and answers `[]` for anything malformed rather than throwing: it runs on a theme
the host has on disk, and a listing is the wrong place to raise. Glass is found
by walking the envelope's **own JSON tree** (`envelope.scene`, whose objects are
under `objects`, groups included) and asking `isGlassTreatment` about each node's
`VIGILIA_GLASS_PROPERTY` value — the vocabulary stays `glass.ts`'s, and the
walker is nine lines because it does not need to be anything else.

The host side is two lines in `entryFor` (`ThemeStoreEntry.costs`), which
`list()`, `read()` and `write()` all inherit from the one place the envelope is
already in hand. The surface half — the sentence, the policy and the row's note —
is `host/public/theme-list.js`, which is a *presentation* of these costs and
owns no detection of its own.

## Decision

**Read the costs from the envelope alone, in `renderer-core`, beside the theme
model it reads.** The comparison's three rejected options each cost a second
owner for something that already has one, and the third would have made the
validator answer a question it was not built for. Rung 1 is what makes this a
reader rather than an owner: the vocabulary stays in `glass.ts`, the resolution
rule stays in `envelope-semantics.ts`, the measured costs stay in 0001/0002/0005,
and what is new is one question asked of a document — which is the only place it
can be asked, since the platform answers it nowhere and only after the fact.

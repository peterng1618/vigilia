# 0011 — The starter's backdrop is a packaged asset, not a URL

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/editor-main.ts`,
  `src/web/packages/editor/src/new-fabric-theme.ts`,
  `src/web/packages/editor/src/new-fabric-theme-globals.ts`,
  `src/web/packages/editor/src/new-fabric-theme-cards.ts`,
  `src/web/packages/editor/src/starter-backdrop.ts`

## The problem

The starter's frosted panels rendered, and every one of them looked **flat**. The
cause is not the glass: it is what is behind it. The artboard carried a
three-stop vertical gradient (`twilightGradient`), which has no horizontal
variation at all, so there was nothing for a backdrop blur to reveal. Widening
the blur could not have fixed it.

The fix is a photograph — something with structure at the scale a 24 px blur
acts on. That makes the question *this* one, not "how do I blur better": **where
do the bytes live**, and **what licence covers shipping them inside a product
that must work with no internet**.

The tempting answer is to put the CDN URL in the starter. It is one line, it
works on screen, and it is a defect:

- `drawImage` *tolerates* a tainted canvas, so the composite would look right.
- `toDataURL` and `getImageData` **throw** on one. That is the thumbnail path
  (`thumbnail-capture.ts`) and every measurement path — the glass budget, the
  e2e probes. A remote image silently breaks thumbnails and makes the glass
  unmeasurable, and every one of those guards reads pixels.
- Vigilia is local-first. A starter that needs a CDN to look right is a
  demonstration of the product failing offline.

## Rung 1 — Vigilia

Searched: `renderer-core/src/theme/document.ts` (`Artboard.backgroundMedia`,
`AssetReference`, `AssetLicense`, `ASSET_PATH_PATTERN`),
`renderer-core/src/theme/assets.ts` (`createAssetResolver`, `isSafeAssetPath`),
`scene-fabric/src/background-media.ts`, `scene-fabric/src/glass.ts`,
`editor/src/asset-manager/index.ts` (`AssetManager.load`, `backgroundSource`),
`editor/src/editor-main.ts` (`mount`, `onNew`),
`editor/src/thumbnail-capture.ts`, `player/src/main.ts`
(`createAssetResolver`, `mountFabricScene`), `host/src/server.ts`,
`host/src/serve/static-path.ts`.

Found: **the whole mechanism already exists and nothing here needs building.**

- `artboard.backgroundMedia` is a declared `assetId` + `fit`, validated by
  `validate.ts` (which *requires* the id to name a declared image, SVG or video
  asset), and mounted by `mountBackgroundMedia` as a DOM sibling **below** the
  canvas.
- `AssetReference` already carries `sourceUrl` and `license: { name, url,
  attribution }` — the attribution seam this needs, unused by any shipped
  theme until now.
- `AssetManager.load(envelope, assets)` takes declared bytes by
  `path -> Uint8Array`; `editor-main.ts` already threads that map into `mount`
  for a package opened from disk. The starter simply never supplied one.
- The host serves a declared package asset at
  `/api/themes/<id>/assets/<declared path>` and types it through its own
  `contentTypeFor` — [0009](0009-a-theme-asset-url-is-base-plus-declared-path.md)
  and [0010](0010-a-declared-asset-is-served-as-its-own-type.md), both landed
  2026-09-28.
- `thumbnail-capture.ts` already composites the DOM media layer *underneath* the
  re-rendered scene, precisely because a DOM sibling is invisible to Fabric.

Two facts about the current starter decide the rest:

1. The gradient is a **scene object** (`backgroundPlate()`), so it paints over
   the media layer whatever the artboard background says. It has to go.
2. `artboard.background` is `{ ref: "palette.background" }` = `#0c0e13`,
   **opaque**, and the player paints it into `canvas.backgroundColor`
   (`adapter.ts` `createApplyArtboard`) — which is exactly what a DOM sibling
   below the canvas needs to be hidden by. It has to become `palette.none`,
   which is what the existing `e2e-media` fixture already does for the same
   reason.

**Nothing on the watchlist needed editing.** `glass.ts`, `background-media.ts`,
`scene-fabric/src/adapter.ts`, `host/src/server.ts` and
`renderer-core/src/theme/` are all unchanged, and the paths this note claims are
the editor's starter module — the only owner of "what a new theme starts from".

## Rung 2 — dependencies

Searched: the workspace manifests for anything that ships a default/sample
image (`echarts`, `fabric`, `lucide-react`, `fflate`, `react`, `systeminformation`,
`canvas`, and the `@types/*` set), and the editor's own `AssetManager.TYPES`,
which is the only place a media type is derived from an extension.

Found: **nothing, and nothing in the way.** No installed package ships a
licence-clean photograph; `canvas` carries a test harness, not art. The
declaration-to-media-type question is already answered once in the editor
(`TYPES`, 11 extensions) and once in the host (`contentTypeFor`, 19), and
0010's rung 5 already rejected a third table — so a new `.webp` would have had
to be added to two existing tables for no gain. Nothing needs adding to
`package.json`, and no lockfile change follows this commit.

## Rung 3 — platform

Searched: how a browser decides a canvas is tainted, and what the two supported
ways of shipping a same-origin image are.

Found: a canvas taints only when `drawImage` is handed a resource the document
cannot read back — a cross-origin image without CORS, or a same-origin one
served in a way the origin cannot reach. **Same-origin always, whether it is a
file or a route**, which is why the packaged answer is a taint answer and not
only an offline answer. `toDataURL` and `getImageData` throw on a tainted
canvas; `drawImage` does not, so the composite looking correct proves nothing
about the capture.

For shipping the bytes, the platform already has both mechanisms and this repo
already uses one: Vite's `?url` emits the file beside the bundle and hands back
a URL relative to the module, which is what the editor's `base: "./"` requires
(it is served from `vite preview` at `/` *and* by the host under `/editor/`).
That is the same arrangement React Native documents for `require('./x.png')` —
"the bundler copies each required image … into the app as a loose file next to
the JavaScript bundle", not a CDN fetch and not a base64 blob.

## Rung 4 — ecosystem

Searched, for *how a product ships a default/background image and what licence
and attribution it carries*:

- **Nextcloud** `apps/theming/lib/Service/BackgroundService.php` (read from
  the repository at commit `f2ea807b`): `DEFAULT_BACKGROUND_IMAGE` is a file
  shipped **inside the app**, and every entry carries
  `attribution`, `attribution_url`, `description`, `background_color` and
  `primary_color` beside the bytes. The licences are mixed and named per
  image — `'Soft floral (Hannah MacLean, CC0)'`,
  `'Clouds (Kamil Porembiński, CC BY-SA)'`,
  `'Globe (Jenna Kim - Nextcloud GmbH, CC-BY-SA-4.0)'`,
  `'Waxing crescent moon (NASA, Public Domain)'`. **Attribution is a
  first-class field on the shipped default, not a courtesy note elsewhere.**
- **Grafana** (grafana/grafana#112709, a container filesystem listing in the
  thread): `/usr/share/grafana/public/img/bg` holds `p0.png` … `p6.png` —
  101 KB to 670 KB each, 97 MB total — served same-origin from `public/`, in
  the *same directory a user drops their own backgrounds into*. Bytes in the
  app, path stable, no CDN.
- **IMG.LY `cesdk`** (`@cesdk/node-native`, img.ly/docs/cesdk/node-native/serve-assets):
  "the default `baseURL` resolves to the package's own `assets/` directory, so
  the engine boots without reaching the IMG.LY CDN". Runtime resources ship
  offline-first — and their *demo* assets are explicitly **not** bundled, and
  are the ones a user must fetch.
- **React Native** (reactnative.dev/docs/images): a bundled image is a loose
  file next to the JS bundle; a remote image is a separate capability with
  different sizing semantics.

Nobody in this set fetches a default background from a CDN at runtime, and
every one that ships a *photograph* records a per-image attribution string.
The dead end worth naming: IMG.LY's demo images are the counterexample — a
product that ships an offline-first runtime and still points its showcase at a
CDN is precisely the failure this change exists to avoid.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **(a) packaged JPEG declared by path, served same-origin** | the mechanism is already built and proven on the host; offline; untainted | 428 KB in the package | the theme package grows once per user | **accepted** |
| (b) runtime CDN URL in the starter | one line, no bytes in the repo | trivial | taints the canvas, so `toDataURL`/`getImageData` throw: thumbnails break and the glass becomes unmeasurable; needs the internet to look right | rejected — it breaks the feature it demonstrates |
| (c) `crossOrigin="anonymous"` + the CDN | would stop the taint | trivial | still needs the internet; needs a third-party CORS header to be right; a starter that renders differently per network is not a starter | rejected — the taint is the least of it |
| (d) procedurally generated noise/gradient as the backdrop | no licence at all, no bytes | a few lines | **a generated gradient has no structure at the scale a blur acts on, which is the defect being fixed** — it reproduces the flat panel exactly | rejected — it is the current bug in different code |
| (e) ship the 1708 px original the CDN served | largest licence-simple option | 234 KB | soft at DPR 2, which the reference acceptance exercises | rejected — measured, see rung 6 |
| (f) a new WebP re-encode | ~30 % fewer bytes | an encoder in the build | no WebP encoder is in the toolchain; the shipped bytes would no longer be a traceable derivative of the licensed original | rejected — cost without a measured win |

## Rung 6 — probe

Two measurements, both run before anything was written.

**1. The premise, on the actual starter background.** Mean |luma(x+dx) −
luma(x)|, the quantity a backdrop blur removes, at the two scales that matter —
dx = 1 (texture) and dx = 24 (roughly the widest blur the starter authors),
against the `twilightGradient` painted exactly as the starter writes it:

```
src-1708.jpg     1708x  894  dx=1:  2.40   dx=24: 12.42
crop-2330.jpg    2330x 1311  dx=1:  2.14   dx=24: 11.00
gradient(now)    1672x  941  dx=1:  0.00   dx=24:  0.00
```

The gradient is **exactly zero at both scales**. That is not "too smooth to
notice" — there is no horizontal structure whatsoever, which is why every
frosted panel in the default capture read as an even fill.

**2. Which width to ship.** Each candidate rendered `cover` at the artboard —
what the DOM media layer does — and compared against the largest, as mean
absolute channel error over 0–255:

```
artboard 1672x941 (DPR 1)   2330: 1.64    1708: 2.16
artboard @DPR 2 (3344x1882) 2330: 1.91    1708: 2.41
```

against a 3111×1751 crop (729 KB) that is the source at its native height. The
chosen 2330×1311 is 41 % of those bytes for under 1 % channel error at both
scales. 1708 is the artboard's own width, so it upscales ~1.96× at DPR 2, which
the plan's acceptance clause exercises; 2330 is 1.39× the artboard, above 1× at
DPR 1 and comfortably inside a 24 px blur's reach.

## Decision

**The starter declares a packaged JPEG as `artboard.backgroundMedia` and
carries the bytes in the theme package.** The artboard's own paint goes
transparent so the DOM media layer below the canvas is visible, the gradient
plate object is deleted, and the bytes are emitted beside the editor bundle by
Vite's `?url` and handed to `mount` in the `path -> Uint8Array` map every other
declared asset already travels in.

`2330×1311`, q75, centre-cropped to the artboard's own 1.7768 aspect so
`fit: "cover"` is a no-op. `sha256`
`6d4bbd987c0e6a6103eb310b2848e011e50a77be641e3e2cdd1b389d695bf59b`, recorded in
the declaration beside `sourceUrl` and `license`.

The photograph is **"city skyline during orange sunset" by Ashim D'Silva**
(`@randomlies`), retrieved 2026-09-28 from
`https://images.unsplash.com/photo-1587642314856-a00a0e4aee60`. The licence and
attribution are recorded in `THIRD-PARTY-NOTICES.md` and
`docs/engineering/dependencies.md`; the licence terms themselves are
`https://unsplash.com/license`.

**Two palette consequences, one of which was a defect I introduced and caught.**

- The gradient's own token, `scene`, is deleted: the plate was its only
  referent. The artboard's paint becomes `none` (it must, or it hides the media
  layer), and the letterbox bars outside the artboard keep `bars`.
- **`background` is kept**, and the first version of this change deleted it too.
  That was wrong: `new-object-defaults.ts` picks the first of
  `background | bars | scene | surface | track` the palette *has* as the
  surface a new object is painted with, so removing it silently repainted every
  inserted panel and chart track with `bars` — pure black. Four browser tests
  failed on it. The artboard's paint and the starter's surface token are two
  different jobs that happened to share a name.
- **The frosted card's fill had to change as well, and this was the half the
  photo could not fix.** `panel` is `#081523d9`, 85 % opaque; with a real
  photograph behind it the card's interior still read at **2.40/255** of
  contrast, because 16.02 x (1 - 0.851) = 2.39. A blur applied under an almost
  opaque panel is a blur of nothing. The frosted card therefore carries
  `palette.frost` at `#081523b8` (72 %), which reads **4.46** while the card
  stays dark. The other seven cards are untouched. The cost is real and named:
  the CPU card's caption drops from 9.6:1 to 5.8:1 contrast, still above AA.

**The three watchlisted owners need no change, and that is the finding.** The
decision is entirely in what a *new theme starts from*, which is the editor
starter module's own job.

## Revisit when

The starter gains a second shipped asset, or a **video** backdrop. Both change
the question: a second image multiplies the package, and a video is a
`backgroundMedia` kind whose frames the glass sampler has to follow
(`followFrames`) — which is the `host-media.spec.ts` shape, not this one.

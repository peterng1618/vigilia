# 0075 — A background media fills one of two boxes, and the artboard has one colour

- **Date:** 2026-10-19
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/`,
  `src/web/packages/scene-fabric/src/background-media.ts`,
  `src/web/packages/scene-fabric/src/scene.ts`,
  `src/web/packages/scene-fabric/src/glass.ts`

## The problem

Two decisions arrived together, both from the owner:

1. **The artboard has one colour, not two.** `background` (the board's own fill) and
   `barColor` (the letterbox bars behind it) were separately authorable. The owner's
   ruling: *"Background and bar color should be 1 single property called 'Background
   color'."*
2. **The media's fit is a choice of *box*, not of `object-fit`.** The old enum was
   `"contain" | "cover"` — both applied to the artboard's box, so neither could fill the
   display. The owner's ruling: *"Mode 1: the background media is zoom to fill the theme
   specified aspect ratio. Mode 2: … the display's aspect ratio."*

The second is the one with a mechanism in it. The media is a **DOM element** laid over
the artboard, so "fill" is `object-fit: cover` in both modes; what changes is **which box
the layer is sized to**. That is a geometry question the artboard transform already answers,
and it interacts with glass: the sampler is told the media's rect and must be told the right
one, or a frosted panel over a display-filled background samples the wrong pixels.

## Rung 1 — Vigilia

Searched: `Artboard`, `backgroundMedia`, `barColor`, `computeArtboardTransform`,
`ArtboardBars`, `artboardScreenRect`, `displayScreenRect`, `BackdropMedia`, `mediaDrawArgs`,
and every `background` reader under `packages/`.

Found: the pieces, and no owner for the thing being built.

- `computeArtboardTransform` (`renderer-core/src/artboard.ts`) already answers the box
  question for content: it returns the scale, the offsets and the letterbox `bars`. A
  display box is the same arithmetic with the viewport as the frame.
- `artboardScreenRect()` and `displayScreenRect()` (`viewport-manager/index.ts:158`, `:193`)
  already expose the two boxes **in the editor**, and `displayScreenRect()` returns
  `undefined` under Fit — a display lens is a choice the author makes, not a constant.
- `BackdropMedia` (`glass.ts:42`) states the media's rect **in artboard units** and says the
  layer "is laid over exactly the artboard rect". A display-filled layer breaks that
  sentence: it covers more than the artboard and may start outside it.
- Nothing implements a two-box media fit. The `fit` field is threaded straight into CSS
  `object-fit` (`background-media.ts:104`) against one box.

## Rung 2 — dependencies

Searched: Fabric 7.4.0's object model for anything that fits a bitmap to a rect; the
packages that already depend on the media layer.

Found: **nothing to reuse and nothing needed.** The media is not a Fabric object — it is a
DOM sibling precisely because a Fabric object would enter `canvas.getObjects()` and the
persisted scene (`scene.ts:405-412` records that ruling). Fabric's `Image` would be a
different owner with a different serialisation, so using it would not be a reuse of this
mechanism; it would be a replacement of it.

## Rung 3 — platform

Searched: CSS `object-fit` / `object-position`, absolutely positioned layers.

Found: the platform does the whole job. With the layer sized to a box and the element at
`width:100%;height:100%;object-fit:cover`, the media fills **that box's** aspect ratio,
cropping the overflow centred. Two boxes are therefore two modes, and no arithmetic is
added to the render path. `object-position` stays unauthored, so the crop is always centred
— the behaviour `mediaDrawArgs` already reproduces for the glass sampler.

## Rung 4 — ecosystem

**The live search could not be run in this session** — the web-search channel was
unavailable throughout (recorded in the plan ledger as an environment limitation, R-series
of 2026-10-18-per-display-themes). What is recorded here is the shape the ecosystem is
known to use, not a query result, and it is written as such rather than dressed up:

- Full-bleed video-background implementations (slide decks, kiosks, hero sections) size
  one absolutely positioned element to the container and give it `object-fit: cover`.
- The "fill the slide" variant used by presentation tools is the **same element sized to
  the content box** — which is exactly mode 1 here.
- Nobody packages this because there is nothing to package: two boxes and one CSS keyword.

**The gate's real question — has anyone solved this shape — is answered by rung 3 and the
probe, not by rung 4.** A library here would wrap `object-fit`.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| CSS `object-fit: cover` on a layer sized per mode | Exact; the platform owns the arithmetic | One `setBounds` signature change | None new — the layer already exists | **chosen** |
| Fabric `Image` fitted by matrix | Reuses the scene renderer | Enters `getObjects()` and the persisted scene; breaks the ruling at `scene.ts:405` | High: a background becomes authorable scene content | rejected |
| Canvas 2D draw of the media | Full control | Re-implements decode, video frames and the DOM layer it already has | Duplicates the mechanism | rejected |
| Two CSS classes with `object-fit: cover/contain` | Zero code | **Cannot fill the display** — both boxes are the artboard | Fails the owner's requirement | rejected — this is the state being replaced |

## Rung 6 — probe

Measured through the shipped `computeArtboardTransform`, artboard 1280×720, `contain`:

| viewport | artboard box | ratio | display box | ratio | modes differ |
|---|---|---|---|---|---|
| 1920×1080 (16:9) | 1920×1080 | 1.778 | 1920×1080 | 1.778 | **no** |
| 2340×1080 (19.5:9) | 1920×1080 | 1.778 | 2340×1080 | 2.167 | yes |
| 1280×960 (4:3) | 1280×720 | 1.778 | 1280×960 | 1.333 | yes |

That reproduces both of the owner's examples exactly, including the one where the two modes
are indistinguishable — which is the case a wrong implementation passes by accident.

## Rung 7 — decision

**The media's `fit` becomes `"theme" | "display"`, naming the box.** Both use
`object-fit: cover`; the layer is sized to the artboard's screen rect or to the display's,
and `setBounds` takes both boxes rather than one. `BackdropMedia` carries the covered rect
**in artboard units** instead of an artboard size, because a display-filled layer is not the
artboard and the glass sampler must map the rect it actually covered.

**The artboard keeps `background` and loses `barColor`.** The board's fill and the bars
behind it become one resolved paint, and the panel draws one control. It is `background`
that stays: it is the field the plate, the adapter and both scene builders already read,
so removing `barColor` deletes a second owner rather than moving one.

**`contain` has no successor.** The owner asked for two modes and both fill; a document
written with `contain` is refused by the schema rather than silently reinterpreted, which
is this repo's rule for a format change before release.

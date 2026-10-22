# 0080 — The artboard paint leaves the canvas, so the media layer sits above it

- **Date:** 2026-10-20
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/adapter.ts`, `src/web/packages/scene-fabric/src/scene.ts`, `src/web/packages/scene-fabric/src/artboard-paint.ts`, `src/web/packages/scene-fabric/src/artboard-backdrop.ts`, `src/web/packages/scene-fabric/src/persist.ts`, `src/web/packages/editor/src/editor-shell.ts`

## The problem

**The user's ruling, 2026-10-20:** *"The media background needs to be above the background
color. Meaning when theme fit is selected, the background color is the letterbox color."*

Today it is the other way round, and the media loses. The media layer is a DOM sibling
**below** the canvas — `mountBackgroundMedia` prepends it to the host
(`background-media.ts:60`) and the canvas is appended after — and the artboard colour is
painted **on the canvas** as `canvas.backgroundColor` (`adapter.ts:284`), a fill that
covers the whole canvas opaquely. So the colour is above the media and hides it
completely: measured, a canvas reading `[16,19,24,255]` at (4,4) with a video declared
behind it and no video pixel ever reaching the glass (`maxFrameDelta` 0 over 1208 frames).

With `fit: "theme"` the media fills the **artboard** box (`background-media.ts:66`) and the
display's leftover area is the letterbox, which is the colour the user wants to see there.
With `fit: "display"` the media fills the whole display, so there is no letterbox and the
colour is fully covered — which is why the requirement is phrased about theme fit.

This is `vg-667`, filed from the glass fix's own harness, whose "not established" half was
whether the paint winning was intended precedence. The user has now ruled that it is not.

## Rung 1 — Yunari

Searched: every `backgroundColor` writer, every `backgroundImage` writer, every `backdrop`
mount site, `artboardPlate`, `createApplyArtboard`, `cssArtboardPaint`,
`fabricArtboardPaint`, and `persist.ts`'s restore.

Found: **three owners of one paint**, which is the finding.

1. `adapter.ts:284` — `canvas.backgroundColor = fabricArtboardPaint(...)`, the player's,
   and the one that covers the media.
2. `editor-shell.ts:239` — `canvas.backgroundImage = artboardPlate(...)`, the editor's, a
   bounded `Rect`. It covers the media the same way; the editor has its own instance of
   this defect.
3. `scene.ts:167` and `editor-shell.ts:253` — `host.style.background = cssArtboardPaint(...)`,
   the same paint on the **host**, which is already behind the media layer.

And the editor has already solved the adjacent half: `editor-shell.ts:252` sets
`canvas.backgroundColor = ""` with the comment that a revived envelope's paint "would
cover the pasteboard again". So the editor keeps its paint on a bounded plate and clears
the whole-canvas fill, and the player's adapter does the opposite.

**The glass is the reason this is not a one-line change.** Three mount sites —
`scene.ts:123`, `editor-shell.ts:570`, `editor-shell.ts:623` — wire
`backdrop: () => media?.backdrop()`. The artboard colour never reaches the glass through
that handle; it reaches it *indirectly*, because the glass blits the canvas's own pixels
into its scratch (`glass.ts`'s `scratchContext.drawImage(target, …)`). Take the paint off
the canvas and a theme whose only backdrop is the colour has nothing left to sample.
**Measured, not reasoned:** with the canvas made transparent, a panel read alpha **130** —
the tint over transparency — before the media's first frame. That is the same defect the
glass fix just closed, in a different costume.

## Rung 2 — dependencies

Searched: Fabric 7.4.0's `StaticCanvas` surface for a bounded or partial background.

Found: `backgroundColor: TFiller | string` (`StaticCanvas.d.ts:79`) and
`backgroundVpt: boolean` (`:78`). The first is a whole-canvas fill; the second only says
whether the background *image* follows the viewport transform. **Nothing expresses "fill
everywhere except a rect"**, and there is no layering between the canvas and a DOM
sibling. Fabric cannot express the requirement.

## Rung 3 — platform

Searched: DOM painting order for a parent background, a prepended child and a later
sibling.

Found: a parent's own `background` is painted **behind** all its children, and among
siblings the later one wins. So `host.style.background` → media layer → canvas is already
the order the requirement needs, and it already holds. **The paint is in the wrong place,
not the media.** CSS offers no way to put a child between a parent's background and
another child, so the colour cannot be "above the media but below the objects" while it
lives on the canvas.

## Rung 4 — ecosystem

Searched: how others put a DOM video or image behind a canvas scene that also paints a
background.

Found: **nobody solves this shape, and the two independent answers agree on why.**
Adobe Animate's own support answers for putting video behind a canvas both prescribe the
same move — *"Canvas background = transparent"* and *"make the stage background color as
transparent"* — because the canvas fill is the thing in the way. YAGE's renderer treats the
letterbox bars as a canvas `backgroundColor` only because it owns the whole render loop
with no DOM sibling at all, and its `expand` mode draws into the bars as **scene geometry**
— the four-bar-objects option rejected below, which is what a framework does when it
cannot put anything between the fill and the scene.

The searches are the evidence: this is not an unsolved problem because it is hard, but
because there is exactly one answer, and it is "the canvas must not paint there".

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Move the media layer above the canvas | Media wins | One CSS change | It then covers the **scene objects**, which is worse than the defect | Rejected |
| Keep the canvas paint, clip it to the letterbox | Paint only in the bars | — | **Disqualified by Fabric** (rung 2): `backgroundColor` cannot be bounded, and `clipPath` bounds objects rather than the background fill | Rejected |
| Paint the letterbox as four bar objects | Paint only in the bars | Four objects per artboard, re-derived on every fit | They appear in `getObjects()`, in `applyObjectPalettePaints`, in `toJSON` and in the object census — a heavier mechanism than the one it replaces, and it would put derived chrome into the persisted scene | Rejected |
| **The paint leaves the canvas; the host carries it (already does); the glass's backdrop carries it too** | Media above the colour, bars from the host, objects on top | The backdrop contract gains the paint | The glass is the risk, and rung 1 measures it | **Chosen** |

## Rung 6 — probe

Measured with `C:\tmp\glass-proof` (outside the repo), the harness built for decision 0079.

- **The defect:** with `plan.artboard.background = "#101318"`, the canvas reads
  `[16,19,24,255]` at (4,4) — opaque — and the panel's colour does not move by a single
  channel across **1208 frames**. The video is declared, decodes (`readyState` 4, 3.533 s,
  2340×1080) and never reaches the glass.
- **The fix's premise:** with `"transparent"` the same page reads `[0,0,0,0]` outside the
  panel and the video reaches it — the five loop wraps then show in the panel's alpha.
- **The cost, which is the part that decides the design:** on the same run, before the
  media's first frame, the panel read alpha **130** — the 50 % white tint over
  transparency. A colour-only theme would read that permanently once the canvas stops
  painting the artboard, so the paint has to reach the glass by another route.

**Confirmed after the fact, same harness, same script, both arms.** With the board opaque at
`#101318` — the case the ruling is about — the fixed build reads the panel at alpha **255**
across 1211 frames with `maxFrameDelta` **123**, and the canvas outside the panel at
`[0,0,0,0]`; the pre-fix build reads `maxFrameDelta` **0** across 1209 frames with the canvas
at `[16,19,24,255]`, which is this section's defect reproduced to the channel. The instrument
was shown able to fail before the fix was trusted with it.

## Decision

**The artboard colour stops being painted on the canvas.** It stays where it already is —
`host.style.background`, behind the media layer — which makes the media visible and makes
the host's colour the letterbox, which is the user's requirement. The canvas keeps the
objects and its clip.

**Because the glass samples the canvas, the paint moves into the backdrop.** The scene's
`backdrop` handle becomes *the artboard colour, then the media over it*, so a panel's
backdrop is what is actually behind it — which is also more honest than the current
arrangement, where the colour reached the glass only because the canvas happened to be
painting it. A theme with no media keeps a colour backdrop rather than losing its body.

The editor's plate (`artboardPlate`) is the same defect in the other surface and is
treated the same way: the plate stops covering the media, and the host's background —
already set at `:253` — is what the reader sees around and behind it.

`persist.ts`'s save/restore of `canvas.backgroundColor` **stays**, and the reason is
the opposite of the one that looked obvious. With no surface painting the board on the
canvas, the only way a fill can arrive there is *from* a revived document — so the restore
is what clears it, and deleting it would leave a stale document's fill covering the media
layer this decision just uncovered. Only the comment above it is rewritten, from "the paint
the mount installed" to the document's own fill.

## What implements it

- `artboard-paint.ts` gains a third output form, `fillArtboardPaint`, beside Fabric's and
  CSS's: the same paint drawn into a 2D context, with the gradient's axis shared with
  `fabricArtboardPaint` through one `gradientLine`. Neither a Fabric `Gradient` nor a
  `linear-gradient(...)` string is a legal `fillStyle`, so the glass sampler needs this one.
- `artboard-backdrop.ts` is the composition: the board's rect, the media painted first, and
  the paint laid **under** it with `destination-over` — so a frame the media cannot paint is
  left where it was (0079), which clearing to the colour first would have thrown away.
- `scene.ts` wires that backdrop unconditionally — a theme with no media has no other
  backdrop — and sets `canvas.backgroundColor = ""` where the fill used to be.
- `editor-shell.ts` does the same for its own glass and capture, and drops the plate
  entirely when the board declares media.

# 0007 — An unresolvable chart paint is a reported gap; the capture composites the media itself

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/background-media.ts`,
  `src/web/packages/scene-fabric/src/scene.ts`

## The problem

Two shapes, both "a value the renderer cannot produce, in a place the author
expects one".

1. **The palette.** `buildChartPlan` takes a palette and every builder consumes
   it; `resolveChartPaint` turns a `palette.` reference into a colour and returns
   `{kind: "solid", color: "transparent"}` when it cannot. The player never
   passed one. The result is a bar that carries `value: 46.8` and no ink — a
   number on a display that says nothing about it. The question was what an
   unresolvable reference should become.
2. **The capture.** Background media is a DOM sibling below the canvas
   (`docs/decisions/0001`), and `toCanvasElement` re-renders the scene graph
   into a fresh canvas, so the media is not in the picture. The question was
   how to get it there without moving the media into the canvas — which 0001
   costed and rejected.

## Rung 1 — Vigilia

Searched: `renderer-core/src/charts/{chart-paint,gauge,bar,pie,line,fill}.ts`,
`renderer-core/src/scene/plan.ts` (`resolveStyleValue`, `resolveStyleMap`,
`buildChartPlan`, `planContent`), `scene-fabric/src/glass.ts`,
`scene-fabric/src/background-media.ts`, `editor/src/thumbnail-capture.ts`,
`editor/src/editor-shell.ts`, `docs/architecture/ownership.md`.

Found: **the project already answered question 1, twice, and chart paint was
the third owner answering it differently.**

- `resolveStyleValue` (`plan.ts:719`): *"Missing references report an issue and
  resolve to undefined; never substitute."* It pushes `unresolved-global` and
  returns `undefined`; `resolveStyleMap` then drops the property.
- §83, in the chart builders: *"Missing samples show only the track, never a
  false zero"*, and `toBarDataItem` returns `value: null`. Every family already
  has a native **no-value** state — gauge `progress.show`, bar `value: null`.
- `chart-paint.ts` was the only place that **invented**: `"transparent"` as a
  resolved colour, with no issue and no way to tell a broken reference from a
  transparent one.

For question 2: `BackgroundMedia.paint(ctx, region, device)` and
`mediaDrawArgs` already exist and already composite the media into a scratch
surface for the glass sampler. `BackgroundMediaHandle.backdrop()` is already
public. **The capability was there; only the capture did not call it.** No
change to `background-media.ts` is needed for this, and none is made.

## Rung 2 — dependencies

Searched: `scene-fabric`, `player`, `editor` `package.json`; the installed
`fabric@7.4.0` and `echarts@6.1.0` type declarations and `index.mjs`.

Found: `StaticCanvas.toCanvasElement(multiplier, {width, height, left, top,
filter})` — no background hook, and `renderAll()` takes no context. It *does*
render `canvas.backgroundImage` (it goes through `renderCanvas`), which is
Fabric's own answer to a scene-level backdrop and would mean turning the media
into a Fabric object per capture. ECharts ships no token resolver at all: the
`palette` argument is ours, not its.

## Rung 3 — platform

Searched: `CanvasRenderingContext2D.drawImage`, `HTMLCanvasElement.toDataURL`,
`fabric/es` `StaticCanvas` surface.

Found: `drawImage` composites anything into a fresh 2D context, so
media-then-scene is two calls on a canvas we own. The only question is the
device rect, and the capture scale rides in `toCanvasElement`'s multiplier: it
sets `enableRetinaScaling = false` for the duration and scales
`viewportTransform` by the multiplier, so `viewportTransform × multiplier` is
the scene plane in export pixels — the same plane `glass.ts` already reads.

## Rung 4 — ecosystem

Searched, for question 1: what ECharts does with no `option.color` and with an
unparseable colour; the CSS Custom Properties spec on `var()` with no fallback;
design-token fallback conventions.

Found — the ecosystem splits, and **the split is the decision**:

- **ECharts substitutes its own palette.** `src/model/globalDefault.ts` sets
  `color: tokens.color.theme` (a hard-coded `['#5070dd', '#b6d634', …]`), and
  `model/mixin/palette.ts`'s `getFromPalette` returns `undefined` only when the
  palette is *empty*. An unparseable colour is worse than defaulted: PR
  apache/echarts#16614 *"fallback to black if color were illegal"* substitutes
  `#000`.
- **CSS does the opposite.** css-variables-1 §3: an undefined custom property
  is the *guaranteed-invalid value*, and using it in `var()` with no fallback
  makes the property **invalid at computed value time** — "as if it had been
  specified with the `unset` keyword". The spec's own worked example notes
  "the elements will have transparent backgrounds (the initial value for
  background-color), rather than red backgrounds". A fallback is opt-in and
  deliberate; the platform's default is a gap.

So: a chart library's default is a colour nobody chose, and it is
**indistinguishable on screen from a colour the author did choose** — which for
this plan is the whole problem, because the target image is the spec. A
platform's default is `unset`. We follow the platform and the project's own
`resolveStyleValue`, and reject the library default on that ground.

Searched, for question 2: Fabric.js issues and Stack Overflow on exporting a
canvas whose background is a CSS or sibling `<img>`/`<video>`; html2canvas,
dom-to-image, modern-screenshot, satori.

Found — nobody exports a DOM sibling for free, and the accepted answers are two:

- **Put the media in the canvas.** SO 44661751: *"Since one of the images is
  not in the Canvas itself, this is an expected behaviour. Unfortunately I
  think the 'right way' is to add the top image as a object on fabric.js."*
  SO 73518673: *"I would load the T-shirt image and also draw it in the
  canvas… the simplest solution."* fabric.js #941 confirms `backgroundImage`
  itself *does* export, so the mechanism exists.
- **Composite it yourself.** SO 39726774's working answer draws the backdrop
  into a scratch canvas and `drawImage`s the exported data URL over it —
  exactly the manual two-step, and the one that leaves the live canvas alone.

0001 already chose the first option's cost and rejected it: keeping the media a
DOM sibling is what makes glass a panel-sized sample instead of a full-artboard
draw per repaint, and that is worth more than one code path for the capture.

## Rung 5 — comparison

Question 1 — what an unresolvable `palette.` reference becomes:

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Substitute ECharts' default palette | invisible to the author; the display would look *plausible* | none | fabricates a colour; a wrong-but-coloured chart is harder to notice than a gap | rejected |
| Substitute a neutral default (`#808080`) | visible as "not authored" only if you know to look | none | same fabrication, smaller | rejected |
| Refuse: throw, or refuse to build the plan | loud | one bad token takes the whole scene down, including the charts that resolve | a display with no dashboard is worse than one with a gap | rejected |
| **Gap: no ink for the value, plus an `unresolved-global` issue** | matches `resolveStyleValue` and §83 exactly | one branch per builder | none | **accepted** |

Question 2 — how the media reaches the capture:

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `backgroundImage` a `FabricImage` of the `<img>`/`<video>` for the capture | one pass, Fabric-native | a Fabric object built and torn down per capture, `object-fit` reimplemented | mutates the live canvas; 0001's rejected cost | rejected |
| `dom-to-image` / html2canvas / a new exporter | would capture the whole DOM | new dependency, ships to the player | the capture must not become a second renderer (§31) | rejected |
| **Draw the media into a scratch canvas, then the scene over it** | reuses `BackdropMedia.paint` and `mediaDrawArgs` unchanged; leaves the live canvas untouched | one extra full-artboard `drawImage` per capture (a capture is a user action, not a frame) | none | **accepted** |

## Rung 6 — probe

Measured in the real host after the change; numbers are in the task report.
The two that decided it:

- The player's `storage-bar` ECharts canvas carried **0** ink pixels at
  `value: 46.8`, and `ram-gauge` **0** at `value: 61.3` — with a palette and
  **0** without one being distinguishable only by the absence of a chart, which
  is why a green suite did not catch it.
- The editor's capture left **81%** of the artboard's pixels fully transparent
  where the media layer covers them, against 11% for the whole canvas.

## Decision

**A `palette.` reference with no entry resolves to no paint at all.** Every
builder expresses that in its own vocabulary, and the vocabulary is already
there: the gauge's `progress.show` is `false`, the bar's datum is `value: null`,
the line draws no stroke and the pie slice draws no ink. `buildChartPlan` pushes
`unresolved-global` — the code `resolveStyleValue` already uses — so "no data"
and "no paint" are two *reported* facts rather than one silent one.

**The pie is the recorded exception.** A slice's area *is* its number, so a
slice with no ink shows no number — but dropping the slice would renormalise the
composition around a paint failure, which §83 forbids in the other direction.
The share is kept and the ink is absent. A composition is never renumbered by a
colour that failed to resolve.

**The capture composites the media itself**, through the `BackdropMedia.paint`
contract the glass sampler already uses, with the scene drawn over it.
`background-media.ts` is unchanged: the sampler, the `object-fit` mapping and
the decoded-pixel guard were all already written and already correct.

**Known cost, recorded rather than assumed:** a capture now allocates one canvas
the size of the export. A capture is a user action on a save, not a frame, and
0001's rejected alternative costs that much on *every* repaint instead.

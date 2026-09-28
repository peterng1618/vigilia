# 0005 — Chart glow is skipped: `shadowBlur` is a backing-pixel unit, and `lineWidth` already is one

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/charts/`, `src/web/packages/scene-fabric/src/chart-object.ts`

## The problem

The reference target shows a coloured halo around chart lines and bars that
Vigilia does not draw. The question was whether the installed ECharts can deliver
it through the existing chart settings surface, cheaply, without touching what
the player bundle cares about.

The capability is real and free. What made it non-obvious is that the one
number an author would type is a backing-pixel unit, that the backing scale is
derived from each chart's own area, and that **`lineWidth` — the one length every
line chart already has, and itself an editable control — is a backing-pixel unit
with the identical behaviour.** So this note is a consistency decision, not a
correctness one, and the difference matters to anyone reading it later.

## Rung 1 — Vigilia

Searched: `grep -rn "shadowBlur|shadowColor|shadow" packages/*/src/`.

Found: a shadow owner exists, for **Fabric rectangles only** —
`editor/src/selection-inspector/panel.ts` writes a native `Fabric.Shadow` with
`DEFAULT_PANEL_SHADOW_BLUR = 8` and `DEFAULT_PANEL_SHADOW_OFFSET = 4`. Fabric's
`shadow` is in object units, and a Fabric rect has no backing-canvas
supersampling, so the panel path has no unit problem to solve.

Nothing exists for charts. `renderer-core/src/charts/{line,bar,pie,gauge}.ts`
emit engine options with no shadow concept at all.

## Rung 2 — dependencies

Searched: `package.json` for `renderer-core`, `scene-fabric`, `player`.

Found: `echarts@6.1.0` (renderer-core, scene-fabric) and `fabric@7.4.0`. No
effects, animation or post-processing package. `renderer-core` has **zero**
runtime dependencies other than ECharts, so any glow that is not expressible in
ECharts' own option vocabulary would be a new dependency.

## Rung 3 — platform

Searched: `echarts/types/dist/echarts.d.ts:1399-1406` (`CommonStyleProps`) and
`zrender/lib/canvas/graphic.js:265` (`SHADOW_NUMBER_PROPS`), which loops at
`graphic.js:290-297`.

Found: `shadowBlur`/`shadowColor`/`shadowOffsetX`/`shadowOffsetY` are native on
`CommonStyleProps`, which series `lineStyle`/`itemStyle` extend, and zrender
applies them as `ctx[propName] = ctx.dpr * (style[propName] || 0)`
(`graphic.js:297`). So the
capability exists with no new dependency, no duplicate series, no extra render
pass, no shader and no effects stack.

**The dpr multiply is a no-op here, and `renderScale` is what actually moves.**
zrender's `ctx.dpr` is ECharts' own device ratio, and
`scene-fabric/src/chart-object.ts:247` passes `devicePixelRatio: 1` — so
`ctx.dpr * x` is `x`, and the number reaches the canvas backing unmodified.
Vigilia's scaling happens one level out: the backing canvas is
`width × height × renderScale` (`chart-object.ts:_backingSize`) and Fabric
downscales it at draw. So the authored value is in **backing pixels** because of
the backing canvas's size, not because of any multiplier the engine applied.
`renderScale` is derived per chart from its own area — see Rung 6.

## Rung 4 — ecosystem

Searched: "how charting libraries express series glow or drop shadow" across
Chart.js, Highcharts, Recharts, ApexCharts, D3 and Plotly; the Highcharts
`series.item.shadow` / `chart.seriesGroupShadow` / `plotOptions.bar.shadow` API
pages; the ApexCharts `dropShadow` docs; `chartjs-plugin-style`; the Recharts
SVG `feDropShadow` guide.

Found: **every library expresses it as a per-series style property, and every
one of them states the same cost warning this task ran into.**

- **Highcharts** — `series.shadow` is `{color, offsetX, offsetY, opacity, width}`,
  and the docs add that in dense layouts "the series may cast shadows on each
  other", which is why `chart.seriesGroupShadow` exists as a second, group-level
  escape hatch. Two mechanisms for one effect, because the per-series one has a
  stacking problem.
- **ApexCharts** — `chart.dropShadow` is chart-level with `enabledOnSeries`, and
  the docs are explicit: "On charts with many data points (more than 100 per
  series), the filter computation adds measurable render cost."
- **Chart.js** — glow is not in core at all; it needs the third-party
  `chartjs-plugin-style` (bevel, inner/outer glow, overlay). Note it shares the
  unit problem rather than escaping it: Chart.js scales its context by DPR, and
  `shadowBlur` is not transformed by that CTM, so its glow is DPR-dependent too.
- **Recharts** — hand-written `<defs>`/`<filter>`/`feGaussianBlur`/`feComposite`
  chains pasted onto elements, plus a warning that the filter box must be
  oversized to 200% so the blur is not clipped.
- **Highcharts styled mode** — shadows are removed from the API entirely; the
  documented path is an SVG `filter` referenced from CSS.

The shape is consistent: the effect is cheap and universally native, and it
degrades in exactly one way — **cost and clipping both scale with the geometry,
and the libraries that ship it also ship a way to turn it off per series.** None
solved the unit question. In SVG (Recharts, Highcharts styled mode) the numbers
are user units by construction, so there is nothing to solve. In the canvas
libraries — Chart.js included — the effect inherits whatever pixel ratio the
context is scaled by, so the question arises and goes unanswered.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Native `lineStyle.shadowBlur` | exact capability, no new dep | ~0 ms measured | authored unit is not artboard, same as the existing `lineWidth` | **rejected — see Rung 6** |
| `clip: false` to stop halo slicing | un-slices the edge | 0 ms | lets series draw outside the plot; changes every theme's overflow behaviour | rejected with the above |
| Backing-pixel unit, documented | honest about the engine | 0 ms | consistent with `lineWidth`, but adds a second instance of the wart | rejected |
| Duplicate series as a glow layer | artboard units | doubles draw | the brief's named skip condition; also a second scene object per chart | rejected |
| Post-process blur over the backing canvas | artboard units | extra pass per repaint at 30 Hz | the brief's named skip condition | rejected |
| Skip | target halo absent | 0 | reference fidelity gap, measured below | **accepted** |

## Rung 6 — probe

All numbers from Chromium 153.0.8010.12, `echarts@6.1.0` from the repo's
`node_modules`, `devicePixelRatio: 1`, backing canvas blitted down with
`imageSmoothingQuality: "high"` exactly as `chart-object.ts:_render` does.

**Capability and cost — native, and free.** Interleaved A/B in one chart
instance at the real starter sizes, 100 samples per arm, reported with
dispersion rather than a bare median:

| chart | arm | min | p10 | p50 | p90 |
|---|---|---|---|---|---|
| trends 963×215 @1.532 | plain | 0.9 | 1.0 | 1.4 | 3.1 |
| trends 963×215 @1.532 | glow | 0.9 | 1.0 | 1.4 | 3.1 |
| cpu sparkline 230×56 @2.0 | plain | 0.9 | 0.9 | 1.1 | 1.4 |
| cpu sparkline 230×56 @2.0 | glow | 0.9 | 0.9 | 1.0 | 1.5 |

The arms share a minimum and a p50, so the glow costs nothing detectable rather
than merely costing little on average. A first probe in node-canvas said line
went 2.0 ms → 7.1 ms; that is `node-canvas`' software rasteriser, not the
player's, and the browser numbers supersede it.

**Clipping — the brief's named failure mode is real.** With the series pinned to
the axis maximum, `convertToPixel` puts the plot top at y=40 and the first lit
pixel is y=39: the halo is **sliced** at the grid edge. `clip: false` moves the
first lit pixel to y=28 and un-slices it. So a correct glow needs `clip: false`,
which is a behaviour change to every theme's series overflow — not a glow-only
change.

**The unit — the mechanism is real, and on the shipped starter it is invisible.**
`clampRenderScale` returns `min(requested, 3, sqrt(486000 / (w × h)))`, where the
first term is the caller's `requested` argument (`chart-object.ts:95` passes
`DEFAULT_RENDER_SCALE`, 2) and `MAX_BACKING_PIXELS` is `486_000`
(`render-scale.ts:8,35`). The effective scale therefore depends on the chart's own
pixel area. The **real** starter charts, from `editor/src/new-fabric-theme-cards.ts`:

| chart | size | scale | glow radius for one authored value |
|---|---|---|---|
| cpu sparkline | 230×56 | 2.000 | 1.000 |
| gpu sparkline | 240×56 | 2.000 | 1.000 |
| storage bar | 430×26 | 2.000 | 1.000 |
| network | 430×70 | 2.000 | 1.000 |
| gauge ×2 | 218×218 | 2.000 | 1.000 |
| **trends** | 963×215 | **1.532** | **1.305** |

**Real-starter spread 1.305×.** Worst case across author-chosen sizes spanning
the clamp is **2.00×** — and that is the ceiling of the mechanism, not a sample,
because `render-scale.ts:33` floors the area term with `Math.max(1, …)`, so no
chart can be scaled below 1 while `DEFAULT_RENDER_SCALE` is 2.

The last column is the ratio of scales and needs no assumption about what the
number means. An earlier draft also quoted an absolute distance ("0.61 artboard
px on a 2–3 px halo"); that is dropped, because `shadowBlur` is not a length —
the HTML canvas spec states it does not correspond to a number of pixels — so
converting it to a pixel distance would assume a radius the spec does not grant.
The ratio is the claim, and the ratio is exact.

What the rendered falloff shows is only that the profile's shape depends on
scale: every chart at 2.000 reads `[0,0,0,0,9,32,99,99,32,9,0,0,0]` and trends at
1.532 reads `[0,0,1,8,23,67,99,67,23,8,1,0,0]`, six rows either side of the peak.
Same 13-value support, same peak, differing only in tail amplitude. That is
evidence the falloff is scale-dependent and nothing more — it does not evidence
the 1.305× ratio, which comes from the table above.

So the objection does **not** bite the shipped theme. It bites the **editor
surface**: the settings panel would offer a field whose meaning moves with the
chart's size, and an author who sizes two charts differently and copies a value
between them gets a different glow.

The correction is not available where the number is produced: `renderScale` is a
`scene-fabric` runtime concept, and `renderer-core`'s builders are pure functions
of `ChartPlanContext = Pick<PlanContext, "source" | "nowMs" | "animate">` —
`grep -rn renderScale packages/renderer-core/src/` returns nothing. Making the
setting mean artboard units means either threading the scale into a pure builder
or moving the correction into `chart-object.ts`, a watchlisted mechanism boundary.

**The precedent this note has to live with.** A backing-pixel length is already
on this settings surface. `defaultLineSettings.lineWidth = 2` (`line.ts:50`) goes
straight to `lineStyle.width` (`line.ts:241`), and zrender sets `ctx.lineWidth`
with no dpr compensation (`graphic.js:339-348` — `ctx.lineWidth = newLineWidth`,
divided only by an opt-in `strokeNoScale` line scale). It is `LineSettings` only —
`bar.ts:29` has `barWidth`, `gauge.ts:84` `thickness`, `pie.ts:23-24` radius
percent — and it is the one length every **line** chart has. The starter's
sparklines (scale 2.000) and its trend chart (1.532) both author `2` today, and
get the same 1.305× scale-dependent treatment a glow would.

That weakens any claim that Vigilia has no backing-pixel lengths: it has one.
It also removes a distinction an earlier draft of this note leaned on — that a
tuned setting deserves a stable unit more than a constant nobody retypes. That
distinction does not survive contact with the source: `lineWidth` is itself a
tuned setting, declared at `settings-fields.ts:132` and rendered as
`<input type="number">` at `editor/src/chart-manager/panel.ts:139-143`, live
through `chart-manager/index.ts:77`. The brief's own proposed control is the same
surface with the same hazard.

What survives is the weaker and coherent claim: **a wart exists, and a second
instance of it is worse than one.** Not a correctness argument — the starter's
invisibility argues against that — but an argument about not compounding a
tolerated defect while touching the file anyway. That is what this skip rests on,
and it is a weak enough reason that the fix (`renderScale` in the plan context)
is worth doing for `lineWidth` first.

**The gap this leaves.** The target's halo, measured as luminance excess over
local background across the CPU sparkline, is a tight 1–2 px shoulder:
`x=470: [5,8,11,4,12,99,126,35,17,22,18,18,18]`, `x=530: [6,7,5,0,28,128,143,61,25,38,37,33,31]`
— peak 126–143, one pixel out 35–61, background by two pixels out. Current
Vigilia rendering produces a 2 px core with **no** shoulder at all. A native
`shadowBlur` between 2 and 4 does reproduce that shoulder.

Both sides of that comparison sit outside the composed player: the target
transect is measured from the reference PNG, and the current-rendering transect
from Chromium driving ECharts directly. Neither is a Vigilia player mount. Since
the skip changes no rendering, no composed measurement is owed — but the two
transects are comparable as *engine output*, not as composed frames.

## Decision

**Skip.** Not because any of the brief's five skip conditions applies — none of
them does, and that is the finding: the capability is native, free, and needs no
duplicate series, extra pass, dependency, shader or effects stack.

The reason is the unit, and it should be stated at its true strength. The
mechanism is real: `shadowBlur` is in backing pixels, the backing scale is derived
from each chart's own area, so one authored value renders different glows on
different charts. On the **shipped starter that is 1.305×**; the ceiling across
author-chosen sizes is 2.00×. So this is not a claim that the starter renders
wrongly.

It is skipped on **consistency, not correctness**, and the precedent is what makes
that the honest form. `lineWidth` — an editable control on the same surface —
already is a backing-pixel length, with the identical 1.305× spread on the
starter's own line charts. Adding a glow adds a second instance of a wart.

That is the whole argument, and it is a weak one. It is not a defect being
corrected, and the note does not claim otherwise; the distinction an earlier
draft drew between a tuned setting and a constant nobody retypes does not survive
the source, because `lineWidth` is itself tuned. What remains is: a wart exists,
a second instance is worse than one, and the fix is worth doing for `lineWidth`
first.

`shadowBlur` would also have to be persisted as a backing-pixel number — engine
vocabulary in a persisted document, which is what `charts/engine-option.ts` and
§87 exist to prevent.

**What would make this not a skip:** `chart-object` passing its effective
`renderScale` into the chart plan, so a builder can emit
`shadowBlur: authored × renderScale` and the authored number means artboard
units. That is a `scene-fabric` → `renderer-core` context change to a pure
builder, plus a `clip: false` decision for the plot edge, plus a flat-colour
answer for gradient and threshold paint (`toEngineColor` returns a plain string
for `kind: "solid"`, so the starter's solid strokes are fine; only gradient and
threshold paint need a colour that is not one band). None of the three is
"existing chart settings" and none is in this task's scope. Gauge glow remains out
of scope either way — the target does not require it.

## Revisit when

A theme needs a per-chart glow that must match across chart sizes, and
`renderScale` is plumbed into the plan context. Fixing `lineWidth` to the same
artboard unit would be the same work and would retire both instances of the wart.

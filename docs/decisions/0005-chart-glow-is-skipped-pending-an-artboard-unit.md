# 0005 — Chart glow is skipped: `shadowBlur` is a backing-pixel unit, and a theme author cannot mean artboard units with it

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/charts/`, `src/web/packages/scene-fabric/src/chart-object.ts`

## The problem

The reference target shows a coloured halo around chart lines and bars that
Vigilia does not draw. The question was whether the installed ECharts can deliver
it through the existing chart settings surface, cheaply, without touching what
the player bundle cares about.

The capability is real and free. What made it non-obvious is that the one
number an author would type does not mean what every other Vigilia length means,
and no setting on this surface can make it mean that.

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
`zrender/lib/canvas/graphic.js:265` (`SHADOW_NUMBER_PROPS`).

Found: `shadowBlur`/`shadowColor`/`shadowOffsetX`/`shadowOffsetY` are native on
`CommonStyleProps`, which series `lineStyle`/`itemStyle` extend, and zrender
applies them as `ctx[propName] = ctx.dpr * (style[propName] || 0)`. So the
capability exists with no new dependency, no duplicate series, no extra render
pass, no shader and no effects stack.

The platform also states the cost, and it is the problem: **the engine multiplies
by the device pixel ratio.** `scene-fabric/src/chart-object.ts` passes
`devicePixelRatio: 1` and instead supersamples by `renderScale`, so the
multiplier the author would have to reason about is not a constant — see Rung 6.

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
  `chartjs-plugin-style` (bevel, inner/outer glow, overlay).
- **Recharts** — hand-written `<defs>`/`<filter>`/`feGaussianBlur`/`feComposite`
  chains pasted onto elements, plus a warning that the filter box must be
  oversized to 200% so the blur is not clipped.
- **Highcharts styled mode** — shadows are removed from the API entirely; the
  documented path is an SVG `filter` referenced from CSS.

The shape is consistent: the effect is cheap and universally native, and it
degrades in exactly one way — **cost and clipping both scale with the geometry,
and the libraries that ship it also ship a way to turn it off per series.** None
solved the unit question, because in SVG and in Chart.js the numbers are in user
units by construction.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Native `lineStyle.shadowBlur` | exact capability, no new dep | ~0 ms measured | authored unit is not artboard | **rejected — see Rung 6** |
| `clip: false` to stop halo slicing | un-slices the edge | 0 ms | lets series draw outside the plot; changes every theme's overflow behaviour | rejected with the above |
| Backing-pixel unit, documented | honest about the engine | 0 ms | a theme's charts get visibly different glow for the same number | rejected |
| Duplicate series as a glow layer | artboard units | doubles draw | the brief's named skip condition; also a second scene object per chart | rejected |
| Post-process blur over the backing canvas | artboard units | extra pass per repaint at 30 Hz | the brief's named skip condition | rejected |
| Skip | target halo absent | 0 | reference fidelity gap, measured below | **accepted** |

## Rung 6 — probe

All numbers from Chromium 153.0.8010.12, `echarts@6.1.0` from the repo's
`node_modules`, `devicePixelRatio: 1`, backing canvas blitted down with
`imageSmoothingQuality: "high"` exactly as `chart-object.ts:_render` does.

**Capability and cost — native, and free.** Alpha-sum transects of a 700×200
line chart, 600 points, interleaved A/B in one chart instance, 80 samples each
so the comparison is not a warm-up artefact:

| | plain | glow |
|---|---|---|
| line (600 pts) | 1.4 ms median | 1.3 ms median |
| bar (12 bars) | 1.0 ms median | 1.0 ms median |

The glow is not measurably more expensive. A first probe in node-canvas said
line went 2.0 ms → 7.1 ms; that is `node-canvas`' software rasteriser, not the
player's, and the browser numbers supersede it.

**Clipping — the brief's named failure mode is real.** With the series pinned to
the axis maximum, `convertToPixel` puts the plot top at y=40 and the first lit
pixel is y=39: the halo is **sliced** at the grid edge. `clip: false` moves the
first lit pixel to y=28 and un-slices it. So a correct glow needs `clip: false`,
which is a behaviour change to every theme's series overflow — not a glow-only
change.

**The unit — why this is a skip.** `clampRenderScale` returns
`min(2, 3, sqrt(486000 / (w × h)))`, so the effective scale depends on the
chart's own pixel area. One authored `shadowBlur: 4`, each chart at the scale
Vigilia would actually pick:

| chart | size | scale | visible footprint |
|---|---|---|---|
| small sparkline | 260×60 | 2.000 | 7 artboard px |
| card sparkline | 320×90 | 2.000 | 7 artboard px |
| CPU card chart | 400×120 | 2.000 | 8 artboard px |
| wide trend chart | 700×200 | 1.863 | 8 artboard px |
| full-width trends | 960×260 | 1.395 | 11 artboard px |
| large panel | 1200×600 | 1.000 | 12 artboard px |

**1.71× spread for one authored value**, and it is not monotonic in anything the
author can see. The number would also have to be written in the theme's own
scale, and the correction is not available where the number is produced:
`renderScale` is a `scene-fabric` runtime concept, and `renderer-core`'s
builders are pure functions of `ChartPlanContext = Pick<PlanContext, "source" |
"nowMs" | "animate">` — `grep -rn renderScale packages/renderer-core/src/`
returns nothing. Making the setting mean artboard units means either threading
the scale into a pure builder or moving the correction into
`chart-object.ts`, which is a watchlisted mechanism boundary.

**The gap this leaves.** The target's halo, measured as luminance excess over
local background across the CPU sparkline, is a tight 1–2 px shoulder:
`x=470: [5,8,11,4,12,99,126,35,17,22,18,18,18]`, `x=530: [6,7,5,0,28,128,143,61,25,38,37,33,31]`
— peak 126–143, one pixel out 35–61, background by two pixels out. Current
Vigilia rendering produces a 2 px core with **no** shoulder at all. A native
`shadowBlur` between 2 and 4 does reproduce that shoulder, which is why this is
a skip on *unit honesty* and not on capability: the cheap path exists and looks
right, and it cannot be given a stable meaning on this settings surface.

## Decision

**Skip.** Not because any of the brief's five skip conditions applies — none of
them does, and that is the finding: the capability is native, free, and needs no
duplicate series, extra pass, dependency, shader or effects stack. It is skipped
because the one number the setting would hold is measured in backing pixels, its
backing scale is derived from each chart's own area, and the resulting authored
value varies 1.71× across the chart sizes one theme uses. A theme that authored
`glowBlur: 4` on its sparklines and its trend chart would not have authored the
same glow, and nothing on the surface could tell the author that.

`shadowBlur` would have to be persisted as a backing-pixel number — engine
vocabulary in a persisted document, which is what `charts/engine-option.ts` and
§87 exist to prevent.

**What would make this not a skip:** `chart-object` passing its effective
`renderScale` into the chart plan, so a builder can emit
`shadowBlur: authored × renderScale` and the authored number means artboard
units like every other Vigilia length. That is a `scene-fabric` → `renderer-core`
context change to a pure builder plus a `clip: false` decision for the plot edge.
Both are reasonable work; neither is "existing chart settings" and neither is in
this task's scope. Gauge glow remains out of scope either way — the target does
not require it.

## Revisit when

A theme needs a per-chart glow that must match across chart sizes, and
`renderScale` is plumbed into the plan context.

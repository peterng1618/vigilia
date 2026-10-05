# 0008 — A gauge carries no datum when it draws no arc

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/charts/gauge.ts`

## The problem

`GaugeView.prototype.render` in `echarts@6.1.0` sets `this._data` after
`_renderMain` (`GaugeView.js:93-94`). Inside `_renderPointer` the progress
elements are kept in a **separate** field, `this._progressEls`, which is
assigned at the *end* of the same method and only inside
`if (showProgress || showPointer)` (`GaugeView.js:357`, `:457`). So any render
that has never drawn a progress arc leaves `_progressEls` `undefined`.

The `diff().update()` callback reads it without a guard
(`GaugeView.js:397`, `var previousProgress = oldProgressData[oldIdx]`), and
`DataDiffer._executeOneToOne` calls `update` for a key present in **both** the
old and the new data (`DataDiffer.js:130`, `:133`) — never for a first-render
datum, which goes through `add`. The throw therefore needs exactly this
sequence:

> a render with `progress.show: false` and at least one datum, then a render
> with `progress.show: true` and that datum still present.

`oldProgressData` is `undefined`, `oldIdx` is `0`, and the error is
`TypeError: Cannot read properties of undefined (reading '0')` — which is the
string the bug file has carried since the first probe, and the stack
(`DataDiffer._update` → `_executeOneToOne` → `execute` → `_renderPointer`)
matches frame for frame.

**The brief's two candidates both point at the wrong line.** It proposed
either supplying `pointer.offsetCenter` or omitting the `pointer` option, on
the reading that `GaugeView.js:312-314` reads it unconditionally. It does not:
`createPointer` is called only under `if (showPointer)`
(`GaugeView.js:360`, `:385`, `:420`), and `showPointer` is
`seriesModel.get(['pointer','show'])`, which `buildGaugeOption` sets to
`false`. Both candidates were rejected against the source, not against taste —
(b) in particular would make ECharts draw a pointer, because
`pointer.show` defaults to `true` (`GaugeSeries.js:137`).

The real question is what a gauge's option should say when there is no reading
to draw.

## Rung 1 — Vigilia

Searched: `renderer-core/src/charts/gauge.ts` (`buildGaugeOption`, `progress`,
`data`), `gauge.test.ts`, `chart-paint.ts`, `scene/plan.ts` (`buildChartPlan`),
`player/src/main.ts` (`hydrateCharts`, the first `refresh()`),
`editor/src/chart-manager/`, `docs/architecture/ownership.md`.

Found: **§83's no-false-zero rule is already owned by `progress.show`, and the
same builder also emits `data: [{ value: settings.min }]` for that case** — a
fabricated zero in the option, currently hidden by the flag. `AGENTS.md` says
*"Missing/non-`ok` telemetry is never fabricated as zero/default data"*, and the
bar family's own expression of the same rule is `value: null` — no value at
all, not a zero behind a flag. So the thing that has to change is already
written down twice; only the gauge's expression of it is a placeholder.

Found, and this is why the player alone throws: `player/src/main.ts` calls
`refresh()` — and therefore `hydrateCharts` — **before**
`showConnectionState("connecting", …)`, so the very first render of every
starter gauge is the no-value one, and the first telemetry to arrive flips the
flag. The editor builds its plan from a source that already holds a sample, so
its first render is the has-a-value one and `_progressEls` exists before
anything can read it. The two mounts differ in **first-render order**, not in
the option — which is what the previous rounds could not isolate.

## Rung 2 — dependencies

Searched: `echarts@6.1.0` `lib/chart/gauge/GaugeView.js`,
`lib/chart/gauge/GaugeSeries.js` defaults, `lib/data/DataDiffer.js`,
`zrender/lib/core/PathProxy.js`, `echarts/lib/util/shape/sausage.js`, and
`npm view echarts version`.

Found: **6.1.0 is the newest published ECharts** (`npm view echarts version` →
`6.1.0`; the registry's version list ends at `6.1.0`), so there is no upgrade to
wait for and the defect has to be worked around in our own option. Relevant
defaults (`GaugeSeries.js:134-175`): `pointer.show: true`,
`pointer.offsetCenter: [0, 0]`, `progress.show: false`, `progress.overlap: true`.
`DataDiffer` has no `_remove` callback wired from `GaugeView`, so a shrinking
data set cannot throw.

## Rung 3 — platform

Searched: `SausagePath.buildPath` (the round-capped arc) and
`zrender.PathProxy.normalizeArcAngles` (the full-circle normalisation).

Found: this is what makes "always `show: true`, hold the value at `min`" not
free. A zero-length round-capped progress builds a stadium of zero length —
two half-discs of radius `width / 2` — so it fills as a **dot**, not as
nothing. And it is a dot rather than a full ring because `normalizeArcAngles`
leaves equal angles at a zero sweep (it only promotes to `2π` when the span is
already `≥ 2π`), so the fourth `arc()` in `buildPath` draws nothing. The
conclusion is measured, not argued: Rung 6, last row.

## Rung 4 — ecosystem

Searched:

- `apache/echarts gauge Cannot read properties of undefined reading '0' _renderPointer progress show false` (GitHub issues, apache/echarts and the incubator archive)
- `charting library series option read unconditionally by renderer but toggled by integration - how do others avoid setting show:false` (apache/echarts, apexcharts, amcharts, DevExpress, jQPlot, Kendo)

Found:

- **The shape has an upstream precedent.** apache/incubator-echarts#4944,
  *"Cannot read property 'eachItemGraphicEl' of undefined"*, filed by a user
  whose only unusual option was `pointer: { show: false }` on a gauge. Not the
  same line — the gauge view's per-datum bookkeeping again — but the same
  shape: the view's diff state for a sub-component the flags had skipped.
- **The maintainer's own answer to "how do I hide one of these" is to take it
  out of the option, not to flag it.** apache/echarts#15585: *"According to
  ECharts's mechanism, the suggested way to do this is to pass the series to
  display to `setOption(option, true)`, you may keep a variable of all series
  and filter each time which ones to display."* The workarounds the same thread
  converged on are all of that family — `legend.selected`, `lineStyle.opacity:
  0`, `type: 'custom'` with an empty `renderItem`. **None of them is "toggle the
  flag safely."**
- **The other candidate's cost is a known upstream bug class, twice.**
  apache/echarts#14162 (progress bar drawn when the value is 0) and
  apache/echarts#16653 fixing #16640, *"fix(gauge): fix progress bar may become
  unexpectedly circle when value is `0` and `progress.roundCap` is enabled"*.
  `show: true` + value at `min` + `roundCap: true` is precisely that.
- **No open issue names `_progressEls`**, and no version fixes it (Rung 2).

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **(a)** supply `pointer.offsetCenter` | none — the read is unreachable while `showPointer` is false | one line | leaves the real throw exactly where it is; the ring stays grey and the bug file's text stays wrong | rejected — wrong line |
| **(b)** omit the `pointer` option | none | one line | `pointer.show` defaults to `true`, so a pointer is drawn; the option stops being ours | rejected — wrong direction |
| (c) `progress.show: true` always, value held at `min` | one line | one line | paints a 284 px round-capped dot; upstream treats that as a bug (§4); §83 broken | rejected — measured |
| (d) `progress.show: true` always, `progress.width: 0` for no arc | works | two lines | expresses "no arc" as a width, and `createProgress` reads that width as real geometry under a different `overlap` | rejected — same idea, second invariant |
| **(e) emit no datum when there is no arc** | matches the bar family's `value: null` and AGENTS' no-fabricated-data rule | one expression | the differ emits `add` instead of `update`, which is the one path that never reads `_progressEls` | **accepted** |

## Rung 6 — probe

jsdom plus the repo's `canvas@3.2.3` and installed `echarts@6.1.0`, driving a
real `echarts.init` the way `VigiliaChart._mount` does (a bare canvas with
explicit init dimensions, `devicePixelRatio: 1`, 300×300). The option is the
starter's own: `startAngle: 225`, `endAngle: -45`, `min: 0`, `max: 100`,
`thickness: 20`, `roundCap: true`, track `#223047`, progress `#2ee6a8`, `pointer:
{ show: false }`, `animation: false`. Pixels are counted within ±12 per channel
of the progress colour, alpha > 32.

| renders, in order | outcome |
|---|---|
| `show:false, data:[{value:0}]` → `show:true, data:[{value:59.79}]` | **throws** `TypeError: Cannot read properties of undefined (reading '0')`; view `_progressEls: undefined`; track 13,994 px, arc **0** px |
| `show:true, data:[{value:59.79}]` → `show:true, data:[{value:12.5}]` | ok; `_progressEls: len 1`; arc 1,857 px |
| `show:false, data:[]` → `show:true, data:[{value:59.79}]` | ok; `_progressEls: len 1`; arc **7,829** px — the steady-state arc, unchanged |
| `show:false,data:[]` → `true` → `show:false,data:[]` → `true` | ok on every step; arc 1,857 px at the end |
| one render, `show:false, data:[{value:0}]` | track 13,994 px, arc 0 px |
| one render, `show:false, data:[]` | track 13,994 px, arc 0 px — **identical to the row above** |
| one render, `show:true, data:[{value:0}]` | arc **284 px** — option (c)'s false zero, measured |

The last two rows are the whole argument for (e): dropping the datum changes
nothing a viewer can see on the no-value render, and the row above it is the
dot that (c) would have shipped.

## Decision

**`series[0].data` is empty exactly when `progress.show` is false.** One
condition decides both, so "the arc is on" and "there is a datum" cannot
disagree, and the differ only ever sees `add` across the transition that used
to throw.

This is the bar family's rule rather than a new one. `toBarDataItem` already
returns `value: null` for a missing sample; the gauge was carrying a `min` in
the same slot and relying on a flag to hide it. With the datum gone,
`displayValue`'s `settings.min` fallback has no reader, and the option stops
carrying a reading nobody took.

`progress.show` keeps its meaning: no pointer is ever drawn, and no arc is
drawn without a plottable sample *and* a resolvable progress paint.

**What this does not do.** It does not patch ECharts. `_progressEls` is still
read unguarded, and the next integration that toggles any gauge sub-component's
visibility while keeping its data will hit it again. The workaround is on our
side of the boundary and is one expression; the defect is upstream and unfixed
because there is no version to fix it in.

## Revisit when

ECharts publishes a version that initialises `_progressEls` in the constructor
or guards the `diff().update()` read. Then the datum and the flag can be
independent again, and `data` can carry `min` for a no-value gauge — which
§83 and the no-fabricated-data rule would still argue against, so the
expression here would stand even then. What would change is that it would no
longer be load-bearing.

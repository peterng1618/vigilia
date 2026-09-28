**RESOLVED** — `docs/decisions/0008-a-gauge-carries-no-datum-when-it-draws-no-arc.md`,
2026-09-28. The cause was in the gauge's *data*, not its paint or its pointer,
and it is ECharts 6.1.0's. Fixed in `renderer-core/src/charts/gauge.ts`: a
gauge with no progress arc now carries no datum. The rings paint on the real
host. Kept in place rather than deleted because the two claims below were both
wrong for a long time, and the next reader should not have to re-derive why.

**What happens**

The starter theme's charts threw inside ECharts when the theme was loaded in the
player (`@vigilia/player`). No chart rendered a live value, so the default demo
theme showed no live data on a second screen. The starter's own clock and date
are bound text rather than charts and were unaffected.

Reproduced without the reference CPU card added by the reference-theme plan, so
it predated that work.

**Why**

Two things were wrong here and both are worth keeping.

**1. The charts were not always throwing.** Before the reference-theme plan's
Task 11a (`7631252`) the display's charts were rendering `transparent` with zero
ink, because `hydrateCharts` called `buildChartPlan` with no palette. A chart
that draws nothing cannot reach the pointer or progress code. The throw and the
invisible charts were the same symptom with two different causes at two
different times, and the bug file recorded the throw as the only fact.

**2. `GaugeView._renderPointer` reads its own `_progressEls` before it is
assigned.** In `echarts@6.1.0` (`lib/chart/gauge/GaugeView.js`):

- `render()` sets `this._data` after `_renderMain` (`:93-94`).
- `this._progressEls` is assigned at the *end* of `_renderPointer`, inside
  `if (showProgress || showPointer)` (`:457`).
- The `data.diff().update()` callback reads it unguarded: `var previousProgress
  = oldProgressData[oldIdx]` (`:397`).
- `DataDiffer._executeOneToOne` only calls `update` for a key present in **both**
  the old and the new data (`DataDiffer.js:130`, `:133`); a first-render datum
  goes through `add`, which never reads it.

So the throw needs one specific sequence: **a render with `progress.show: false`
and at least one datum, then a render with `progress.show: true` and that datum
still present.** The display produces exactly that, because
`player/src/main.ts` runs its first `refresh()` — and so its first chart render —
*before* `showConnectionState("connecting", …)`, when no telemetry has arrived
yet. The first sample to land then flips the flag under a datum that had been
there all along. The editor builds its plan from a source that already holds a
sample, so its first render is the has-a-value one and `_progressEls` exists
before anything can read it. The two mounts differ in first-render order, not in
the option — which is why every earlier round could not isolate it from the
option dump.

**What it was NOT.** It was not `pointer.offsetCenter`. `createPointer` is
called only under `if (showPointer)` (`GaugeView.js:360`, `:385`, `:420`) and
`showPointer` is false, so the read at `:312-314` is unreachable; and omitting
the `pointer` option would have made ECharts draw a pointer, since
`pointer.show` defaults to `true` (`GaugeSeries.js:137`). It was not the
round-cap shape, and not the option being wrong.

**Why it is not <adjacent subsystem>**

- Not `scene-fabric/src/glass.ts` or `chart-refresh.ts`. The glass lifecycle was
  detached and the throw persisted; the frame loop's own robustness was separately
  fixed in `1ca70ba` and the throw survived that fix.
- Not the envelope or persistence. The theme validates and revives; the failure
  happens when ECharts is asked to render the revived chart.
- Not telemetry. The symptom was a rendering throw, not a missing or non-`ok`
  sample — and the fix is in the option, not in the data path.
- Not a version to upgrade to: `npm view echarts version` returns `6.1.0`, the
  newest published, and no upstream issue names `_progressEls`.

**Evidence**

- The regression is a mounted test, not a string comparison:
  `src/web/packages/scene-fabric/src/chart-object.dom.test.ts`, "a gauge crossing
  from no value to a value". With the fix disabled it fails on
  `TypeError: Cannot read properties of undefined (reading '0')` — the exact
  production string.
- The option's own claim is unit-pinned in
  `src/web/packages/renderer-core/src/charts/gauge.test.ts`: "the gauge's datum
  follows its arc", asserting `data.length > 0` **is** `progress.show` across an
  ok sample, a missing sample, a non-`ok` sample and an unresolvable paint.
- Pixels, in the real host on the same build, saturation over the charts' own
  ECharts canvases: `ram-gauge` **219 → 12,601**, `vram-gauge` **307 → 4,021**
  saturated pixels, each re-measured from a build with this fix re-disabled.
  Ink is reported as unchanged (21,065 → 21,085 and 27,592 → 27,609) and is
  **not** the evidence: ink is the track, which the fix does not touch, and the
  editor/display ink agreement read 0.033%/0.370% before the fix against
  0.062%/0.308% after, so it does not discriminate between the two builds.
  Screenshot: `docs/evidence/screenshots/player-reference-desktop-host.png`.
- The report: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/task-11b-report.md`.

**How to reproduce** (before the fix)

1. Build and open the starter theme in the display against the real host.
2. Watch the console: `Vigilia: Chart "ram-gauge" failed to draw and was left as
   it was. Cannot read properties of undefined (reading '0')`. The ring stays a
   grey track.
3. In the editor, the same document's rings paint — the first render there
   already has a value.

**Where it bit**

- The default demo theme on the display player: the first thing a new user sees
  running was a theme whose two gauge rings carried no reading.
- Any theme that binds a gauge to a sensor that is not readable at the moment the
  display first mounts.

**Notes**

Two adjacent things were checked and are not this bug, recorded so the
investigation is not repeated:

- A refresh-loop scheduling defect froze the whole scene on any chart throw. Fixed
  in `1ca70ba`; the loop now survives a throwing refresh and reports once.
- Cross-origin media taints the canvas, which would fail `getImageData` in the
  glass sampler. That is a separate constraint, tracked with the packaged-assets
  route issue.

**Left open on purpose**

The upstream read is still unguarded, and 6.1.0 is the newest release, so the
workaround lives in our option. The next integration that toggles a gauge
sub-component's visibility while keeping its data will hit this again.

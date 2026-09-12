# Gate 0 — Feasibility

**Status:** not started · **Human approval required** to exit (§157)

Gate 0 exists to make the expensive decisions on evidence. Per §33, nothing here
is complete until there is *observable behaviour and a test*; a ticked box with no
artifact is not a pass.

## Already established (do not re-litigate)

These were verified on 2026-09-12 and are recorded with method in
[../research/verified-dependency-findings.md](../research/verified-dependency-findings.md):

- **WinRing0 is permanently unusable** — 29 unconditional hash denies in
  Microsoft's blocklist, which is default-on and always enforced under HVCI.
- **LibreHardwareMonitor already migrated to PawnIO**, in stable `v0.9.6`.
- **Licence inventory** for all current dependencies → ADR-0003,
  [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md).
- **.NET 10 is the only sensible target** — 8 and 9 both EOL 2026-11-10 → ADR-0002.
- **ECharts gauges support arbitrary sweep** but **cannot express a gradient along
  the ring** — see the styling matrix below.
- **Display-only bundle measures 184.1 KB gzipped JS** with all four chart
  families, `GridComponent` and the canvas renderer (measured via
  `npm run size -w @vigilia/player` on 2026-09-12; was 111.7 KB with the gauge
  alone). Still a floor — no transport, fonts or media yet, and it includes the
  synthetic sample source the player will drop.
- **The display path renders in a browser.** 21 Playwright tests pass against
  the built bundle on a 1280×720 desktop viewport and a Pixel 7 profile; see
  "What the display path has demonstrated" below for exactly what that covers
  and what it does not.

---

## Probes

### G0-P1 — Per-sensor tier and elevation breakdown

**Question:** exactly which sensors are readable (a) with no driver, (b) with
PawnIO installed but unelevated, (c) with PawnIO installed and elevated.

**Why it matters:** ADR-0004's tiered design assumes a meaningful Tier 1 exists.
If temperature turns out to be the only thing gated, the opt-in is cheap; if load
and memory also need elevation, the whole posture changes.

**Method:** run `DriverAvailabilityProbe.Probe()`
([src](../../src/Vigilia.Providers.Windows/DriverAvailabilityProbe.cs)) plus a
full `DiscoverAsync` in each of the three states, and diff the catalogs. Record
actual sensor names and instance IDs — not categories.

**Deliverable:** a table of sensor → tier → elevation, committed here. This
replaces the "UNVERIFIED" entry in the research doc.

- [ ] No driver installed
- [ ] Driver installed, process unelevated
- [ ] Driver installed, process elevated
- [ ] Catalog diffs committed

### G0-P2 — Anti-cheat coexistence

**Question:** does PawnIO being loaded cause problems with Vanguard, EAC or
BattlEye?

**Why it matters:** §111 names gamers as the target user. Being signed and
blocklist-clean is *necessary but not sufficient* — anti-cheat vendors maintain
independent policies, and a tool that trips Vanguard is unusable for this audience.

**Method:** real games on real hardware. Launch each anti-cheat with the driver
loaded and with the app sampling; check for launch blocks, warnings and bans.
Test with the app running *before* and *after* game launch.

**This cannot be established from documentation.** Do not mark it passed on the
basis of the driver's signing status.

- [ ] Vanguard (or documented as untested/out of scope)
- [ ] EasyAntiCheat
- [ ] BattlEye
- [ ] Outcome documented, including any limitation we must ship with

### G0-P3 — SignalR slow-client behaviour

**Question:** what actually happens when a phone cannot keep up.

**Status:** the scaffold implements the intended semantics —
[`LatestSnapshotQueue<T>`](../../src/Vigilia.Host/Realtime/LatestSnapshotQueue.cs),
a bounded channel with `DropOldest` giving keep-latest. **What is unverified is
the framework's own behaviour** once a slow client's transport buffer fills, and
whether our queue in front of it is sufficient.

**Method:** throttle a client, publish at 1 Hz for several minutes, and measure:
does the publisher stall? does the client receive a burst of stale snapshots on
recovery? what is the observed drop count?

- [ ] Slow-client test harness
- [ ] Publisher never stalls (asserted, not assumed)
- [ ] No stale burst on recovery
- [ ] §105 reconnect returns current snapshot + bounded history, never a backlog

---

## Editor foundation bake-off (ADR-0001)

Both candidates are scored against the same harness. §45's ranking order applies:
chart embedding → typography fidelity → lightweight playback → extensibility →
*then* drawing-tool breadth.

| | vue-fabric-editor | yft-design |
| --- | --- | --- |
| Commit SHA pinned | | |
| Live chart embeds as a native, editable node | | |
| Styled runs within one text element (§89) | | |
| Packaged font loads with correct metrics | | |
| Group transforms preserve world appearance | | |
| Undo is one transaction per gesture (§67) | | |
| JSON round-trip through **our** schema | | |
| Display-only bundle excludes inspectors (§47) | | |
| Cut succeeds at copying before deleting (§33) | | |

Known integration friction to measure, not assume:

- Candidates are on **Fabric 5.3.0** and **Fabric 6.4.1**; current is 7.4.0.
- Candidates use **Vite 4 / 5 (rollup)**; this scaffold uses **Vite 8, which
  bundles with rolldown**. Already bitten once — rolldown rejects the object form
  of `manualChunks` that rollup accepted.
- Candidates use **TypeScript 4.9 / 5.1**; this scaffold uses **TypeScript 7.0.2**.

**Third outcome stays open:** if both fail the chart/typography bar, build on
current Fabric plus Moveable/Selecto. Discovering this at Gate 0 is a success.

- [ ] Both candidates scored
- [ ] Human approves the editor and renderer strategy (§43)

---

## Chart and typography styling matrix

§85 requires every applicable family/style combination to have an inspector
control, a JSON representation, a preset and a visual fixture — and requires
engine gaps to be marked explicitly with human agreement on the alternative.

### Known engine gap: gradient along a gauge ring

`axisLine.lineStyle.color` accepts only `[[proportion, color], …]` — discrete
segments. Gradient objects are not documented for it.

Implemented approach for the **track**: approximate with N interpolated segments
([`approximateGradient`](../../src/web/packages/renderer-core/src/charts/gauge.ts),
default 64, capped at 256). Banding is visible at low counts and large radii.

**The gap has a second half, found on 2026-09-12 by looking at a rendered
frame.** The *progress* arc cannot use that path at all: `axisLine` is a single
property and the track already owns it. So a gradient progress fill now emits a
real ECharts gradient object, which resolves **across the ring's bounding box
rather than along the arc** — a true gradient, but not an angular one. This is
visible in the demo dashboard's GPU gauge.

The same bug also revealed that the progress arc previously fell through to
ECharts' default blue for any non-solid fill, silently discarding what the theme
asked for. Fixed; a threshold progress fill now resolves to the band containing
the current value, which is exact and native.

Alternatives if either approximation is rejected:

1. Shared **native overlay arc** — consistent with §91, which permits a native
   overlay but never a bitmap substitute.
2. **Two series**: a full ring carrying the gradient segments, with a
   track-coloured arc drawn over the remainder. Angular and exact, at the cost
   of two series per gauge and a second place for the geometry to disagree.
3. Restrict gradients to non-gauge families.

### Known engine gap: per-value thresholds on a line series

Found 2026-09-12 while building the line adapter. A line's colour is a property
of the **whole series**, so a `thresholds` fill — "above 80 °C the line turns
red" — is not expressible the way it is on a gauge ring, where `axisLine`
segments map onto value bands natively.

Current behaviour: `toEngineColor` reduces a thresholds fill to its **top band**
colour, so nothing is invented and the result is at least deterministic.

Alternatives:

1. `visualMap` with `pieces` — ECharts can recolour a line by value range this
   way. Needs verification that it composes with our typed-settings boundary and
   does not leak raw options into the theme format.
2. Split one authored series into several engine series, one per band.
3. Restrict thresholds to gauge and bar families, and use a solid stroke on lines.

Note the inverse relationship with the gauge gap: gradients work natively on a
line (cartesian) and not on a gauge (arc); thresholds work natively on a gauge
(axis bands) and not on a line (whole-series colour). Neither family is strictly
more capable — the matrix has to record both.

### Known engine gap: ECharts frames are not byte-reproducible

Measured 2026-09-12, and it decides whether pixel baselines are ever possible.

With the clock frozen, animation disabled and a fresh page per capture:

| What is captured | Byte-identical across runs? |
| --- | --- |
| Shapes, text, images — everything this renderer draws itself | **Yes**, every time |
| Any frame containing an ECharts chart | **No**, on *both* the canvas and SVG renderers |

The line chart differs on every page load. Not the data — the text content of the
frame is identical, the fake source is a pure function of its clock, and the
chart-free fixture reproduces perfectly. It is something inside the engine's
own rendering, and it is present with `animation: false` and with SVG output, so
it is not rasterisation mode and not a transition in flight.

Consequences, which are the reason this is recorded here rather than in a
comment:

1. **Pixel baselines can never cover charts.** A committed PNG of a dashboard
   would fail on every run. Baselines remain possible for typography and layout
   fixtures only.
2. Visual acceptance of charts has to be by human review of captured evidence,
   or by structural assertions on the emitted option objects — which is what the
   unit suite already does.
3. Two Playwright tests pin both halves: our own rendering must stay
   reproducible, and the chart case is asserted to *differ* so the limitation
   cannot be quietly forgotten and then rediscovered as a flaky baseline.

Also recorded while measuring this: **the first render after a cold browser
start differs from every render after it**, and reloading one page never
reproduces. A capture that matters uses a fresh page and discards a warm-up
frame.

### Family × style matrix — first pass, 2026-09-12

Authored from the implemented adapters. "Native" means the engine expresses it
directly; "approximated" means we produce something defensible and the gap is
recorded above; "n/a" means the combination has no meaning for that family.

| | gauge | line | bar | pie |
| --- | --- | --- | --- | --- |
| Solid fill | native | native | native | native |
| Linear gradient | approximated (box, not arc) | native | native | sampled per slice |
| Thresholds by value | native (progress band) | **gap** (top band only) | native (per item) | per-slice share |
| Arbitrary sweep / angles | native | n/a | n/a | native |
| Ring thickness / inner radius | native | n/a | n/a | native |
| Rounded caps | native | n/a | native (corner radius) | native (corner radius) |
| Track / remainder | native | n/a | native (`showBackground`) | native (fixed total only) |
| Independent area fill | n/a | native (first series) | n/a | n/a |
| Per-series colour | n/a | native (palette) | native (per item) | native (palette) |
| Width / spacing | thickness | line width | bar width + gap | pad angle |
| Interpolation / markers | n/a | native | n/a | n/a |
| Time window | n/a | native | n/a | n/a |
| Missing sample → gap | track only | explicit `null` break | no bar drawn | slice absent |
| Value clamped, raw preserved | native | native | native | n/a (shares) |
| Element outline + dash | native (border) | n/a | native | n/a |
| Text outline | native (`-webkit-text-stroke`) | — | — | — |
| Dashed text stroke | **gap** — not expressible in CSS; ignored | — | — | — |
| Element shadow | native (`box-shadow` / `text-shadow`) | native | native | native |
| Chart stroke dash | n/a | native (`lineStyle.type`) | n/a | n/a |
| Chart-internal shadow (series glow) | **not implemented** | **not implemented** | **not implemented** | **not implemented** |
| Engine-drawn labels / legends / axes | suppressed (§91) | axes native, labels ours | axes native, labels ours | suppressed (§91) |

Element-level rows (outlines, shadows) are properties of the node the chart sits
in, so they apply to every family — a chart element takes an outline and a
shadow exactly as a rectangle does. "Chart-internal" means inside the drawing:
a glow on a line series, for instance, which is not implemented.

Every cell above has a **JSON representation** (the schema's per-family settings)
and a **unit test**. What no cell has yet: an **inspector control** (no editor
exists) or a **preset**. Visual fixtures exist only for the combinations the demo
dashboard happens to use — see
[`screenshots/`](screenshots/) for what that currently covers.

Unverified engine behaviours, each marked at its use site in the code:

- Whether `backgroundStyle` accepts a gradient object as well as a colour string.
- Whether a bar's background is still painted for a `null` data item.
- How `padAngle` behaves on a very small pie slice — whether the gap can consume
  the slice entirely.

- [ ] Human decision recorded on the gauge-gradient alternative
- [ ] Human decision recorded on the line-thresholds alternative
- [x] Full family × style matrix authored — first pass above; needs review
- [ ] Every applicable cell has control + JSON + preset + fixture

### What the display path has demonstrated (2026-09-12)

Rendered in Chromium against the built player bundle, at a desktop and a Pixel 7
viewport. Screenshots are written to `src/web/test-results/screenshots/` and
uploaded by CI; they are **not** pixel baselines, because CI is Linux and
development is Windows and glyph rasterisation differs.

Demonstrated, with a browser test asserting it:

- All four chart families draw, each verified to have painted non-transparent
  pixels rather than merely existing as an element.
- A text element mixing a literal and a live value in separately styled runs.
- An unmapped semantic key rendering as a placeholder, never a zero.
- A simulated outage marking its span with a status attribute, so a theme can
  style a failed reading — and showing a gap rather than a number.
- The artboard transform: identity at an exactly matching viewport, letterboxed
  and aspect-preserving on a taller phone, still aspect-preserving after a
  resize.
- Charts updating in place — the same canvas element survives several ticks,
  which is the "update without recreating the scene" requirement.

**Found because it was rendered, and unfindable from an option object:** a chart
whose content is *entirely* animated draws nothing until its animation
progresses. With a frozen clock the line chart and the donut were blank while
the gauge and bars still showed, because their tracks are static. Anything that
screenshots a fresh mount must advance the clock first.

### Gate 0 demonstration set (§43)

- [x] Richly styled live donut/radial gauge — threshold gauge, gradient gauge and
      a fixed-total donut in the demo dashboard
- [x] Filled line chart — two series, palette per series, area under the first
- [ ] **Editable** sensor text with separately styled value and unit — the
      *rendering* is demonstrated; editing needs the editor, which does not exist
- [ ] Packaged font
- [ ] Transparent artwork
- [ ] GIF
- [ ] Video
- [ ] Rectangle, ellipse and line only — proving extensible node types. Rectangle
      is demonstrated; ellipse and line are implemented in the renderer but not
      yet in any fixture
- [x] Gradients, outlines, shadows — all three in the demo dashboard: gradient
      gauge and area fill, a dashed outline, panel and text shadows
- [ ] Font loading and metrics, with reserved boxes during load
- [ ] Layering, undo, JSON round-trip — on desktop **and** phone. Layering by
      child order and JSON **load** are demonstrated on both viewports; there is
      no save path and no undo, both of which need the editor

---

## Performance budgets

> **BLOCKED.** §126 requires budgets "on named reference PCs/phones". No hardware
> has been named. An agent cannot resolve this — it needs the actual machines.

- [ ] **Name the reference PC** (CPU, GPU, RAM)
- [ ] **Name the reference phone(s)**, including one deliberately low-end/older (§47)
- [ ] CPU budget, idle and active
- [ ] Memory budget, with a bounded-growth assertion
- [ ] Network budget per client at 1 Hz
- [ ] Frame time on the reference phone, including percentiles — not just average
- [ ] Startup time
- [ ] Game benchmark: repeated monitoring-off/on runs, frame-time percentiles and
      polling spikes (§126 — average CPU alone is explicitly insufficient)

Placeholder budgets currently enforced in CI, to be replaced with measurements:

| Budget | Placeholder | Enforced by |
| --- | --- | --- |
| Player JS, gzip | 400 KB | `scripts/check-size.mjs` (measuring 184.1 KB) |
| Player CSS, gzip | 40 KB | same |

Of that 184.1 KB, 176.7 KB is ECharts with four chart families, `GridComponent`
and the canvas renderer; the application itself is 13.4 KB gzipped **including**
the synthetic sample source and demo theme the player will eventually drop. If
this budget ever comes under pressure, the engine is where the weight is — not
our code.

---

## Compatibility floor

- [ ] Minimum browser/WebView versions, tested not assumed (§124). The bundle
      runs on Chromium 153 (the Playwright build) at both viewports; that is a
      *recent* browser and says nothing about the floor
- [ ] Feature detection and a clear compatibility screen
- [ ] Confirm the `es2022` build target against the real low-end phone
- [x] Confirm service workers and newer performance APIs are **not** required —
      the player registers no service worker and calls no performance API; it
      uses `setInterval`, `visibilitychange`, `resize` and `orientationchange`
      only. Re-check when the transport lands

## Exit criteria

- [ ] G0-P1, G0-P2, G0-P3 complete with committed evidence
- [ ] Editor strategy approved by a human
- [ ] Styling matrix authored; every gap has an agreed alternative
- [ ] Dependencies pinned (commit SHAs where no release exists) and licences inventoried
- [ ] Performance budgets measured on named hardware
- [ ] Compatibility floor established
- [ ] Display-only bundle proven to exclude editor controls

**Rejection triggers (§43):** flattened charts or text, or editor/display
rendering that does not match.

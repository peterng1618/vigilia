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
- **Display-only bundle measures 111.7 KB gzipped JS** with the ECharts gauge and
  canvas renderer (measured via `npm run size -w @vigilia/player`). This is a
  floor, not the final number — no transport, fonts, or media yet.

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

Implemented approach: approximate with N interpolated segments
([`approximateGradient`](../../src/web/packages/renderer-core/src/charts/gauge.ts),
default 64, capped at 256). Banding is visible at low counts and large radii.

Alternatives if the approximation is rejected:

1. Shared **native overlay arc** — consistent with §91, which permits a native
   overlay but never a bitmap substitute.
2. Restrict gradients to non-gauge families.

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

- [ ] Human decision recorded on the gauge-gradient alternative
- [ ] Human decision recorded on the line-thresholds alternative
- [ ] Full family × style matrix authored
- [ ] Every applicable cell has control + JSON + preset + fixture

### Gate 0 demonstration set (§43)

- [ ] Richly styled live donut/radial gauge
- [ ] Filled line chart
- [ ] Editable sensor text with separately styled value and unit
- [ ] Packaged font
- [ ] Transparent artwork
- [ ] GIF
- [ ] Video
- [ ] Rectangle, ellipse and line only — proving extensible node types
- [ ] Gradients, outlines, shadows
- [ ] Font loading and metrics, with reserved boxes during load
- [ ] Layering, undo, JSON round-trip — on desktop **and** phone

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
| Player JS, gzip | 400 KB | `scripts/check-size.mjs` (measuring 111.7 KB) |
| Player CSS, gzip | 40 KB | same |

---

## Compatibility floor

- [ ] Minimum browser/WebView versions, tested not assumed (§124)
- [ ] Feature detection and a clear compatibility screen
- [ ] Confirm the `es2022` build target against the real low-end phone
- [ ] Confirm service workers and newer performance APIs are **not** required

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

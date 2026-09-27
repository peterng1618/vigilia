# Vigilia status

Updated: 2026-09-27
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional.

## Active work

- **Completed, archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md) — `docs/bugs/` is gone; open [#2](https://github.com/peterng1618/vigilia/issues/2) delete inside a group, [#3](https://github.com/peterng1618/vigilia/issues/3) packaged assets.
- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — subagent-driven. Tasks 1–6 and 8 complete; 7, 9, 10, 11, 12 remain. Ledger: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md) — **approved 2026-09-27**; plan deferred until this plan closes, since it must be written against the delivered surface. Rebuilds the reference from blank through the UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md) — not activated. Replaces the one-entry hand-written trio with 380 generated pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued spec, no plan:** removing the v1 document format and the fixture node-tree render path — must account for `metadata.locale`: v1 documents carry no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- **The starter is the reference composition (Task 7).** 1672 × 941, every card on its measured box: clock, CPU, GPU, a 270° RAM arc, a full VRAM ring, a three-series performance chart and stacked Storage/Network panels. The starter is now four files — document, cards, scene primitives, Lucide geometry — none over 400 lines.
- Two false claims removed. The starter bound unowned `memory.used`, so its donut renormalised to a false 100%; it now binds `ram.used.percent` and a test asserts every starter key against the real vocabulary. Authored prose standing in for readings — weather, quotes, model names, `Games (D:)`, mockup times — is gone rather than reworded.
- The hand-drawn glyphs are replaced by Lucide node arrays read from the installed package, converted to Fabric path commands; the converter is tested, including the arc-flag and rounded-rect cases.
- **Found while rendering: `vigiliaText.align` is unsafe on an authored top-left object.** `refreshLayout` centres at `box.x + box.width/2` and the box it rebuilds is `left - width/2`; the two cancel only while box and run share a width. The storage figure and both ring readings walked right on every refresh in the player. The starter now places every text object by its left edge, and a test pins that.
- Icons are licensed, not new dependencies; the reuse gate needed no watchlisted write. Details in `task-7-report.md`.

## Next

1. Continue reference-theme fidelity: Task 9, 10, 11, 12.
2. Then the font catalogue plan, then the queued specs.

## Blockers / unverified

- **A gauge threw inside ECharts in the player and took every reading with it** ([#6](https://github.com/peterng1618/vigilia/issues/6)). Round 7 captured the error text — `Cannot read properties of undefined (reading '0')` at `GaugeView._renderPointer` — and the cause was **not established**, because the gate is `seriesModel.get(['pointer','show'])` and `buildGaugeOption` sets it false. Two commits landed mid-round from the controller: `29e9645` splits the player's guarded repaint so one chart no longer costs the display, and `4d379cc` retires the fixme. This bullet is stale the moment those are verified in a player run.
- **An aligned reading does not hold its authored box.** Measured in the player over three refresh rounds: `ram-value` keeps its authored `left` (1113) but its `width` becomes 566.9 — the measured run's width, not the 180 the author wrote, and `@ram.used.percent%` is the text it was measured from. `refreshLayout` then places the run against a box the author never wrote, so the reference's centred ring readings and right-aligned storage share land elsewhere. `fabric-text.ts` owns it and **Task 8 owns it**; the starter keeps the alignment, and an `it.fails` test names the case so a fix trips it.
- The `line` family applies `areaStyle` to the **first series only** (`charts/line.ts:254-255`), so the reference's three filled trend series are not expressible. A renderer limitation, not a starter decision; the two sparklines do keep their area. Separately: the glass composite bound moved 3 ms to 4 ms inside the Task 7 commit `109669e`, when the reference CPU card made the panel 1.68x larger; the review asked for that as its own commit and history was not rewritten, so it is named here instead and the supporting readings are post-change on one machine. The queued author-journey spec also still owes a browser round-trip of text wrap/overflow, in-place edit and undo.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left of where it started, while the same gesture on the un-frosted RAM card landed exactly on the neighbouring edge. Glass is on the watchlist; this is a Task 5-shaped defect and is recorded in `task-7-report.md`.
- Carried into this plan: the baseline GPU provider returns the **maximum** across controllers, so Task 9's caption must resolve the same device it describes. Task 7 ships no model caption rather than one that could misattribute. Separately pre-existing on the branch and outside Task 7: `format:check` fails on `snap-manager/scaling/scaling.dom.test.ts` and `typecheck` fails at `scene-fabric/src/chart-refresh.test.ts:112`.





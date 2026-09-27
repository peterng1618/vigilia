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

- **A gauge throws inside ECharts in the player, and one throw stops the whole display.** Error text captured: `Cannot read properties of undefined (reading '0')` at `GaugeView._renderPointer` → `pointerOffset[0]`, with `pointer: { show: false }` authored. Because the player's `tick` repaints charts and bound text in one `try`, every reading on the display stays an em dash. Tracked as [#6](https://github.com/peterng1618/vigilia/issues/6); the editor mounts the same scene with every chart drawn, so it is player-side. Not Task 7's to fix.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left of where it started, while the same gesture on the un-frosted RAM card landed exactly on the neighbouring edge. Glass is on the watchlist; this is a Task 5-shaped defect and is recorded in `task-7-report.md`.
- Carried into this plan: the baseline GPU provider returns the **maximum** across controllers, so Task 9's caption must resolve the same device it describes. Task 7 ships no model caption rather than one that could misattribute.
- Unverified: browser round-trip of text align/wrap/overflow, in-place edit + undo, run preset/override; phone surfaces exercised by suite, not by eye. Owned by the queued author journey proof spec.
- Pre-existing on the branch, not in Task 7's diff: `format:check` fails on `snap-manager/scaling/scaling.dom.test.ts` (`01aa7dc`) and `typecheck` fails at `scene-fabric/src/chart-refresh.test.ts:112` (`callbacks.get(frame!)(0)` — the call needs its own non-null assertion).

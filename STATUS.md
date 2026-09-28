# Vigilia status

Updated: 2026-09-28
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional.

## Active work

- **Completed, archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md) — `docs/bugs/` is gone; open [#2](https://github.com/peterng1618/vigilia/issues/2) delete inside a group, [#3](https://github.com/peterng1618/vigilia/issues/3) packaged assets.
- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — subagent-driven. Tasks 1–10 complete; 11, 12 remain. Ledger: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md) — **approved 2026-09-27**; plan deferred until this plan closes, since it must be written against the delivered surface. Rebuilds the reference from blank through the UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md) — not activated. Replaces the one-entry hand-written trio with 380 generated pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued spec, no plan:** removing the v1 document format and the fixture node-tree render path — must account for `metadata.locale`: v1 documents carry no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- **The RAM/VRAM rings draw their progress arc on the display** (Task 11b, [#6](https://github.com/peterng1618/vigilia/issues/6) closed). The cause is ECharts 6.1.0's and it was never the pointer: `GaugeView._renderPointer` reads its own `_progressEls` inside the data-diff `update` callback (`GaugeView.js:397`) and only assigns it after a render that drew an arc (`:457`), so a datum that outlives `progress.show: false` throws. The display renders every gauge once before telemetry arrives, and the first sample flipped the flag under a datum. **A gauge with no arc now carries no datum** (`docs/decisions/0008`), which is the bar family's own `value: null` rule. Real host, same build, saturation: **ram-gauge 219 → 12,601; vram-gauge 307 → 4,021**, track ink unchanged (21,065 → 21,085, 27,592 → 27,609) and the editor's rings read 21,072 and 27,694 on the same build — the two mounts agree to 0.1%. The `test.fail` is removed and the regression is a mounted test that fails with the fix disabled.
- **The display's charts now paint in the theme's palette (Task 11a).** `hydrateCharts` called `buildChartPlan` with `undefined` where the editor has always passed `theme.globals?.palette`, and `planContent` dropped it too, so every `palette.` reference resolved to nothing: the storage bar carried `value: 46.8` with `itemStyle.color: "transparent"`. Real host, real host-saved starter, pixels counted — **storage-bar 0 → 17,200; ram-gauge 0 → 21,065; vram-gauge 0 → 27,592; cpu sparkline 221 → 6,482**, each by re-breaking the fix and re-measuring, not inferred.
- **An unresolvable paint reference is now a reported gap, not transparent ink on a live value** (`docs/decisions/0007`). `chart-paint` returns `undefined`; the gauge hides its arc, the bar's datum is `value: null`, the line draws no stroke — each the no-value state that family already uses for a missing sample — and `buildChartPlan` pushes the `unresolved-global` issue `resolveStyleValue` already owns. The pie keeps its share and loses its ink: §83 forbids renumbering a composition around a colour that failed.
- **The capture composites the artboard's background media** (D2). It is a DOM sibling by 0001, so `toCanvasElement` never saw it: 81% of the artboard transparent. It now paints through the `BackdropMedia.paint` contract the glass sampler already uses. Artboard core transparency 0.468 → <0.02 with the break. One `test.fail` removed.

## Next

1. Continue reference-theme fidelity: Task 10, 11, 12.
2. Then the font catalogue plan, then the queued specs.

## Blockers / unverified

- The `line` family applies `areaStyle` to the **first series only** (`charts/line.ts:254-255`), so the reference's three filled trend series are not expressible. A renderer limitation, not a starter decision; the two sparklines do keep their area. Separately: the glass composite bound moved 3 ms to 4 ms inside the Task 7 commit `109669e`, when the reference CPU card made the panel 1.68x larger; the review asked for that as its own commit and history was not rewritten, so it is named here instead and the supporting readings are post-change on one machine. The queued author-journey spec also still owes a browser round-trip of text wrap/overflow, in-place edit and undo.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left of where it started, while the same gesture on the un-frosted RAM card landed exactly on the neighbouring edge. Glass is on the watchlist; this is a Task 5-shaped defect and is recorded in `task-7-report.md`.
- Task 9's two open edges, named rather than wished away. **Residual:** each provider is internally consistent — one selection answers a group's figures and its caption together — but `registry.sample` fans out with `Promise.allSettled`, so an assignment landing **between** LHM's read and the library's pairs one provider's figure with the other's name for one frame; closing it needs a host-owned epoch threaded through the registry, a provider-contract change, and `registry.test.ts` pins the split so it is visible rather than silent. **Unverified:** the drive model→volume join matches `blockDevices[].device` to `diskLayout[].device` by equality, proven only on Windows (`\\.\PHYSICALDRIVE0`); the POSIX form is unverified, no guess was added, and a miss yields a **gap**, never a wrong name.
- Owed to Task 8's own typography, now visible because the box is real: `storage-card-value`'s box runs 1460–1660 while its card ends at 1632 (the glyphs centre inside it and stay on the card, so nothing paints out of place, but box and card disagree by 28 units).


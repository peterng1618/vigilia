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

- **Chart glow is skipped, on consistency rather than a missing capability (Task 10).** ECharts' native `lineStyle.shadowBlur` exists, costs nothing detectable (interleaved A/B at the real starter sizes: both arms share a 0.9 ms min and a 1.4 ms p50) and needs none of the five prohibited mechanisms — so none of the brief's skip conditions fired. It is skipped because that number is a **backing**-pixel unit whose scale `clampRenderScale` derives from each chart's own area, and **`lineWidth` already is one, with the identical 1.305× spread on the starter's own charts**. On the shipped starter that spread is 0.61 artboard px on a 2–3 px halo — invisible; worst case across author-chosen sizes is 2.00×. Decision in `docs/decisions/0005`; evidence in `task-10-report.md`.
- **The target's halo is real and small**, so this is a fidelity gap, not a phantom: a 1–2 px shoulder (peak 126–143 luminance, one pixel out 35–61, background by two). Current rendering has no shoulder at all, and a native `shadowBlur` of 2–4 does reproduce it. Both transects sit outside a Vigilia player mount — comparable as engine output, not as composed frames.
- **The brief's named failure mode is confirmed**: with the series pinned to the axis maximum the halo is **sliced** at the grid edge (`convertToPixel` puts the plot top at y=40, first lit pixel y=39), so a correct glow also needs `clip: false` — a change to every theme's series overflow, not a glow-only change.
- **What would un-skip it:** `chart-object` passing its effective `renderScale` into the plan context, plus the `clip` decision, plus a flat colour for gradient/threshold paint. Fixing `lineWidth` to the same artboard unit is the same work and retires both instances of the wart.

## Next

1. Continue reference-theme fidelity: Task 10, 11, 12.
2. Then the font catalogue plan, then the queued specs.

## Blockers / unverified

- **A gauge threw inside ECharts in the player and took every reading with it** ([#6](https://github.com/peterng1618/vigilia/issues/6)). Round 7 captured the error text — `Cannot read properties of undefined (reading '0')` at `GaugeView._renderPointer` — and the cause was **not established**, because the gate is `seriesModel.get(['pointer','show'])` and `buildGaugeOption` sets it false. Two commits landed mid-round from the controller: `29e9645` splits the player's guarded repaint so one chart no longer costs the display, and `4d379cc` retires the fixme. This bullet is stale the moment those are verified in a player run.
- The `line` family applies `areaStyle` to the **first series only** (`charts/line.ts:254-255`), so the reference's three filled trend series are not expressible. A renderer limitation, not a starter decision; the two sparklines do keep their area. Separately: the glass composite bound moved 3 ms to 4 ms inside the Task 7 commit `109669e`, when the reference CPU card made the panel 1.68x larger; the review asked for that as its own commit and history was not rewritten, so it is named here instead and the supporting readings are post-change on one machine. The queued author-journey spec also still owes a browser round-trip of text wrap/overflow, in-place edit and undo.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left of where it started, while the same gesture on the un-frosted RAM card landed exactly on the neighbouring edge. Glass is on the watchlist; this is a Task 5-shaped defect and is recorded in `task-7-report.md`.
- Task 9's two open edges, named rather than wished away. **Residual:** each provider is internally consistent — one selection answers a group's figures and its caption together — but `registry.sample` fans out with `Promise.allSettled`, so an assignment landing **between** LHM's read and the library's pairs one provider's figure with the other's name for one frame; closing it needs a host-owned epoch threaded through the registry, a provider-contract change, and `registry.test.ts` pins the split so it is visible rather than silent. **Unverified:** the drive model→volume join matches `blockDevices[].device` to `diskLayout[].device` by equality, proven only on Windows (`\\.\PHYSICALDRIVE0`); the POSIX form is unverified, no guess was added, and a miss yields a **gap**, never a wrong name.
- Owed to Task 8's own typography, now visible because the box is real: `storage-card-value`'s box runs 1460–1660 while its card ends at 1632 (the glyphs centre inside it and stay on the card, so nothing paints out of place, but box and card disagree by 28 units).


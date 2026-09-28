# Vigilia status

Updated: 2026-09-28
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional. **All 12 tasks are
written and reviewed; the plan is not closed** because one acceptance clause is
unmet on the real player (below).

## Active work

- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — subagent-driven. Tasks 1–12 written and reviewed. Ledger: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`. **Not archived, spec not marked implemented:** the acceptance clause *"Inspect editor and real player at target size, another fitted viewport and different DPR, including grouped/rotated/overlapping panels and changing media"* was proved on the **editor** mount only — the suite has one DPR test and one rotation/overlap test, both in `reference-theme.spec.ts` on `openCaptureFixture` — while the real player is inspected at reference size alone. The media half is blocked by [#3](https://github.com/peterng1618/vigilia/issues/3). Everything else in the acceptance list is met.
- **Completed, archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md) — `docs/bugs/` is gone; open [#2](https://github.com/peterng1618/vigilia/issues/2) delete inside a group, [#3](https://github.com/peterng1618/vigilia/issues/3) packaged assets.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md) — **approved 2026-09-27**; plan deferred until this plan closes, since it must be written against the delivered surface. Rebuilds the reference from blank through the UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md) — not activated. Replaces the one-entry hand-written trio with 380 generated pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued spec, no plan:** removing the v1 document format and the fixture node-tree render path — must account for `metadata.locale`: v1 documents carry no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- **Task 12 reviewed the whole plan and corrected its durable records.** Four shipped comments were false or orphaned and are now true: `lhm-mapping.ts` claimed an unassigned group keeps "the highest reading… exactly as before" (0004 made it the first device the machine reports); a second doc comment there had been orphaned under a new interface since `0ee0f47` and described the same deleted rule; `library.ts`'s CPU cache said "see above" while `describeDevices` refreshes only `drives`; and `disk.name`'s gap message said "no drive is assigned" when the assigned drive can also be simply absent. A fifth was a **false evidence claim**: STATUS and the bug file both said the two mounts "agree to 0.1%" on ink — measured 0.033%/0.370% *before* the fix against 0.062%/0.308% after, so it does not discriminate. The chroma movement (219 → 12,601, 307 → 4,021) is the evidence, and that is what both now say.
- **The e2e gauge assertion is characterised instead of guessed.** `chroma > 2000` read "RAM above ~7%": measured on the starter's own option, chroma is `553 + 207 × value` (216 with no datum, 553 at 0, 2,620 at 10). The floor is now 500, the value the same file already uses for the other charts and 2.3× the arc-less baseline it must tell apart.
- **The two e2e evidence defects are fixed.** `host-player.spec.ts:1013` rewrote the tracked `host-theme-thumbnail-…png` on every desktop-host run with no gate, while its two siblings gate on `VIGILIA_CAPTURE`; and the locale test read the clock before the first sample arrived, which is how it went red under load.
- **§85 and the ownership map are current again.** §85 said "No chart engine gaps are open" and now names the three the work opened (first-series-only `areaStyle`, the backing-pixel `lineWidth` unit, the gauge-datum rule). `docs/architecture/ownership.md` named the glass *control* and never the glass *rendering* owner, which the spec requires: `scene-fabric/src/glass.ts` and `renderer-core/src/theme/glass.ts` are both recorded.

## Next

1. Decide the unmet acceptance clause: extend the real-player proof to a fitted viewport and a second DPR (media stays blocked on [#3](https://github.com/peterng1618/vigilia/issues/3)), or amend the clause. Then mark the spec implemented and archive the plan.
2. Then the font catalogue plan, then the queued specs.

## Blockers / unverified

- **The real player is inspected at one configuration.** `the fitted, reference-size and DPR views…` and `rotated and overlapping panels both keep compositing` both drive the editor mount. The real-player reference capture runs at 1672 × 941 and nothing else; a fitted viewport, a second DPR and changing media on that mount are unproved, and the last is blocked on [#3](https://github.com/peterng1618/vigilia/issues/3).
- **`library.ts` is 785 lines** (a documentation-only correction cost 4 of the 19 lines of headroom the earlier ruling left). The extraction into `library-devices.ts` is still required **before any future work on selection, not during it**; it is not a violation today.
- The `line` family applies `areaStyle` to the **first series only** (`charts/line.ts:254-255`), so the reference's three filled trend series are not expressible. A renderer limitation, not a starter decision; the two sparklines do keep their area. Separately: the glass composite bound moved 3 ms to 4 ms inside the Task 7 commit `109669e`, when the reference CPU card made the panel 1.68x larger; the review asked for that as its own commit and history was not rewritten, so it is named here instead and the supporting readings are post-change on one machine. The queued author-journey spec also still owes a browser round-trip of text wrap/overflow, in-place edit and undo.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left of where it started, while the same gesture on the un-frosted RAM card landed exactly on the neighbouring edge. Glass is on the watchlist; this is a Task 5-shaped defect and is recorded in `task-7-report.md`.
- Task 9's two open edges, named rather than wished away. **Residual:** each provider is internally consistent — one selection answers a group's figures and its caption together — but `registry.sample` fans out with `Promise.allSettled`, so an assignment landing **between** LHM's read and the library's pairs one provider's figure with the other's name for one frame; closing it needs a host-owned epoch threaded through the registry, a provider-contract change, and `registry.test.ts` pins the split so it is visible rather than silent. **Unverified:** the drive model→volume join matches `blockDevices[].device` to `diskLayout[].device` by equality, proven only on Windows (`\\.\PHYSICALDRIVE0`); the POSIX form is unverified, no guess was added, and a miss yields a **gap**, never a wrong name. Owed to Task 8's typography, now visible because the box is real: `storage-card-value`'s box runs 1460–1660 while its card ends at 1632 (the glyphs centre inside it and stay on the card, so nothing paints out of place, but box and card disagree by 28 units).


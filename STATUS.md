# Vigilia status

Updated: 2026-09-28
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional.

## Active work

- **Completed, archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md) — `docs/bugs/` is gone; open [#2](https://github.com/peterng1618/vigilia/issues/2) delete inside a group, [#3](https://github.com/peterng1618/vigilia/issues/3) packaged assets.
- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — subagent-driven. Tasks 1–6 and 8 (incl. 8a) complete; 7, 9, 10, 11, 12 remain. Ledger: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md) — **approved 2026-09-27**; plan deferred until this plan closes, since it must be written against the delivered surface. Rebuilds the reference from blank through the UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md) — not activated. Replaces the one-entry hand-written trio with 380 generated pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued spec, no plan:** removing the v1 document format and the fixture node-tree render path — must account for `metadata.locale`: v1 documents carry no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- **A text box is the author's, and it outlives the text (Task 8a).** `vigiliaText.box` `{width, height}` is the owner, validated in both validators, and Fabric's `width` is a cache the renderer re-asserts on every pass. `ram-value` measures **180** in the editor's save and **180** in the player, where it measured 566.9. Alignment, wrapping, clipping and the box all read that box. Details in `task-8a-authored-box-report.md`; decision in `docs/decisions/0003`.
- **A width the author drags sticks, through Fabric's own `changeWidth`.** Every width decision reaches `set`, which re-enters `initDimensions`; the object re-asserts the requested width on the way out, so `object:resizing` reports the author's number and the box records it. A real drag took `ram-value` from 180 to 97.67 and the save carries 97.67.
- **The editor paints readings; the token appears while a run is being edited.** Double-click selects the whole run, seeds its binding, and both refresh passes leave the object alone until editing ends — so typing replaces the reading and nothing repaints it away. The View ▸ Value runs override still reaches the token view, and the inspector now names each run's binding and marks one that is undeclared or has no reading.
- Two defects this surfaced and fixed, both found by measurement rather than review: `applyClip` placed the clip as though every object were centre-origin, so a corner-anchored text object was clipped half a box away from its own box; and the derived `clipPath` was being serialised, so an unbound label was clipped by whatever rect a save happened to carry. Derived geometry is no longer persisted and the player re-derives every text object at mount.

## Next

1. Continue reference-theme fidelity: Task 9, 10, 11, 12.
2. Then the font catalogue plan, then the queued specs.

## Blockers / unverified

- **A gauge threw inside ECharts in the player and took every reading with it** ([#6](https://github.com/peterng1618/vigilia/issues/6)). Round 7 captured the error text — `Cannot read properties of undefined (reading '0')` at `GaugeView._renderPointer` — and the cause was **not established**, because the gate is `seriesModel.get(['pointer','show'])` and `buildGaugeOption` sets it false. Two commits landed mid-round from the controller: `29e9645` splits the player's guarded repaint so one chart no longer costs the display, and `4d379cc` retires the fixme. This bullet is stale the moment those are verified in a player run.
- The `line` family applies `areaStyle` to the **first series only** (`charts/line.ts:254-255`), so the reference's three filled trend series are not expressible. A renderer limitation, not a starter decision; the two sparklines do keep their area. Separately: the glass composite bound moved 3 ms to 4 ms inside the Task 7 commit `109669e`, when the reference CPU card made the panel 1.68x larger; the review asked for that as its own commit and history was not rewritten, so it is named here instead and the supporting readings are post-change on one machine. The queued author-journey spec also still owes a browser round-trip of text wrap/overflow, in-place edit and undo.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left of where it started, while the same gesture on the un-frosted RAM card landed exactly on the neighbouring edge. Glass is on the watchlist; this is a Task 5-shaped defect and is recorded in `task-7-report.md`.
- Carried into this plan: the baseline GPU provider returns the **maximum** across controllers, so Task 9's caption must resolve the same device it describes. Task 7 ships no model caption rather than one that could misattribute.
- Owed to Task 8's own typography, now visible because the box is real: `storage-card-value`'s box runs 1460–1660 while its card ends at 1632 (the glyphs centre inside it and stay on the card, so nothing paints out of place, but box and card disagree by 28 units), and a run too long for its fixed box is **clipped rather than ellipsised** — `fits()` is line-count based for wrapped text and `maxLines` is undefined, the gap `textGaps` already declares unsupported. The token reads as `used.pe` mid-edit, so the author sees it did not fit, but with no marker that says so.


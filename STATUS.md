# Vigilia status

Updated: 2026-09-28
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional. **All 12 tasks are
written and reviewed; the plan is not closed** because one acceptance clause
still has an open third, blocked on an issue (below).

## Active work

- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — subagent-driven. Tasks 1–12 written and reviewed. Ledger: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`. **Not archived, spec not marked implemented:** the acceptance clause *"Inspect editor and real player at target size, another fitted viewport and different DPR, including grouped/rotated/overlapping panels and changing media"* is now proved on **both** mounts by pixels — the player at 1600 × 760 and at 1180 × 820 @ DPR 2, with grouped, rotated and intersecting glass panels compositing on its own `StaticCanvas`. **Changing media on the player is the one open third**, blocked by [#3](https://github.com/peterng1618/vigilia/issues/3). Everything else in the acceptance list is met.
- **Completed, archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md) — `docs/bugs/` is gone; open [#2](https://github.com/peterng1618/vigilia/issues/2) delete inside a group, [#3](https://github.com/peterng1618/vigilia/issues/3) packaged assets.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md) — **approved 2026-09-27**; plan deferred until this plan closes, since it must be written against the delivered surface. Rebuilds the reference from blank through the UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md) — not activated. Replaces the one-entry hand-written trio with 380 generated pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued spec, no plan:** removing the v1 document format and the fixture node-tree render path — must account for `metadata.locale`: v1 documents carry no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- **The acceptance clause is closed on the real player, and closing it found a real defect.** `scene-fabric/src/glass.ts`'s `deviceMatrix` composed its two matrices as `local · view` — the transpose of the correct `view · local`. The two agree while the viewport is an unscaled identity, which is what *every* prior proof rendered at, so the blur was being clipped and drawn **beside** the panel at any fitted viewport. On the player at a 2× contain fit a panel's centre belongs at device (281, 281) and was drawn at (141, 141). Fixed; `planeMatrix` next to it was already the correct composition, which is how the two disagreed.
- **The player's glass was never pixel-proved before, and now is.** Measured band step with the bug and with the fix: 156 → **3** (flat), 156 → **3** (inside a −20° group), 156 → **6.4** (under the intersecting panel), 156 → **3** (over it), against a blur-off control of 156 in every case, with backdrop contrast essentially unchanged (144–162 vs 155–163) so it is softened, not flattened.
- **Two regression tests, both shown to fail without the fix.** The Playwright test reports `156` where it requires under `78`; the new `glass.dom.test.ts` case reports `140.5` where it requires `281`. The unit one exists because `npm test` could not previously see this class of bug at all — the stage now records the transform at each `ctx.clip()`, which `node-canvas` honours even though it cannot show a blur.
- **The player is inspected at two more configurations.** A fitted 1600 × 760 and a 1180 × 820 at DPR 2, asserting the `contain` fit to the pixel and reading ring arcs, the storage bar's fill and the wordmark's glyphs as fractions of their own areas, so one floor holds at whatever render scale the mount resolved.
- **The backdrop is scene geometry, not media.** The new host fixture draws its bars as `Rect` objects, which a panel samples whether or not packaged assets load — so the grouped proof never waits on [#3](https://github.com/peterng1618/vigilia/issues/3).

## Next

1. Fix [#3](https://github.com/peterng1618/vigilia/issues/3) (the host's asset route and the player's asset resolver disagree about the `assets/` prefix), then prove changing media on the player and close the clause. Until then the plan stays active.
2. Then the font catalogue plan, then the queued specs.

## Blockers / unverified

- **Changing media on the real player is blocked on [#3](https://github.com/peterng1618/vigilia/issues/3).** The player builds `/api/themes/:id/assets/assets/<name>` where the host's route hands `assets/<name>` to the declaration lookup, so a declared `assets/…` path never matches and the media 404s. Fonts are unaffected because the player builds that URL itself. This is the only part of the acceptance clause left open, and it is another owner's.
- **`library.ts` is 785 lines** (a documentation-only correction cost 4 of the 19 lines of headroom the earlier ruling left). The extraction into `library-devices.ts` is still required **before any future work on selection, not during it**; it is not a violation today.
- The `line` family applies `areaStyle` to the **first series only** (`charts/line.ts:254-255`), so the reference's three filled trend series are not expressible. A renderer limitation, not a starter decision; the two sparklines do keep their area. Separately: the glass composite bound moved 3 ms to 4 ms inside the Task 7 commit `109669e`, when the reference CPU card made the panel 1.68x larger; the review asked for that as its own commit and history was not rewritten, so it is named here instead and the supporting readings are post-change on one machine. The queued author-journey spec also still owes a browser round-trip of text wrap/overflow, in-place edit and undo.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left of where it started, while the same gesture on the un-frosted RAM card landed exactly on the neighbouring edge. Glass is on the watchlist; this is a Task 5-shaped defect and is recorded in `task-7-report.md`.
- Task 9's two open edges, named rather than wished away. **Residual:** each provider is internally consistent — one selection answers a group's figures and its caption together — but `registry.sample` fans out with `Promise.allSettled`, so an assignment landing **between** LHM's read and the library's pairs one provider's figure with the other's name for one frame; closing it needs a host-owned epoch threaded through the registry, a provider-contract change, and `registry.test.ts` pins the split so it is visible rather than silent. **Unverified:** the drive model→volume join matches `blockDevices[].device` to `diskLayout[].device` by equality, proven only on Windows (`\\.\PHYSICALDRIVE0`); the POSIX form is unverified, no guess was added, and a miss yields a **gap**, never a wrong name. Owed to Task 8's typography, now visible because the box is real: `storage-card-value`'s box runs 1460–1660 while its card ends at 1632 (the glyphs centre inside it and stay on the card, so nothing paints out of place, but box and card disagree by 28 units).


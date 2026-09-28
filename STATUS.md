# Vigilia status

Updated: 2026-09-28
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional. **All 12 tasks are
written and reviewed; the plan is not closed** because the last acceptance
clause still owes its changing-media third on the player.

## Active work

- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — subagent-driven. Tasks 1–12 written and reviewed. Ledger: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`. **Not archived, spec not marked implemented:** the acceptance clause *"Inspect editor and real player at target size, another fitted viewport and different DPR, including grouped/rotated/overlapping panels and changing media"* is proved on **both** mounts by pixels — the player at 1600 × 760 and at 1180 × 820 @ DPR 2, with grouped, rotated and intersecting glass panels compositing on its own `StaticCanvas`. [#3](https://github.com/peterng1618/vigilia/issues/3) is fixed and packaged media now decodes on the player, so the last third is the *changing* of that media, which no test does yet.
- **Completed, archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md) — `docs/bugs/` is gone; open [#2](https://github.com/peterng1618/vigilia/issues/2) delete inside a group. [#3](https://github.com/peterng1618/vigilia/issues/3) packaged assets is fixed and closed.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md) — **approved 2026-09-27**; plan deferred until this plan closes, since it must be written against the delivered surface. Rebuilds the reference from blank through the UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md) — not activated. Replaces the one-entry hand-written trio with 380 generated pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued spec, no plan:** removing the v1 document format and the fixture node-tree render path — must account for `metadata.locale`: v1 documents carry no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- **[#3](https://github.com/peterng1618/vigilia/issues/3) fixed: a theme asset URL is the base plus the declared path, whole.** The host's route carried a literal `assets/` that ate the first segment of a path that already had one, so a player's asset never matched its own declaration.
- **The fix is on the route, and the resolver keeps its contract.** `createAssetResolver` has two other callers that need the `assets/` prefix to survive, so the route changed instead: the capture is now the whole package-relative path, anchored on `assets/` so `/document`, `/answers` and `/thumbnail` cannot collide. Decisions [0009](docs/decisions/0009-a-theme-asset-url-is-base-plus-declared-path.md), [0010](docs/decisions/0010-a-declared-asset-is-served-as-its-own-type.md).
- **Two more defects were behind the first one.** The route answered `application/octet-stream`, which no browser will decode as an image (proved: the same bytes load from a typed blob and not from the response), so it now serves the declared path through the host's own `contentTypeFor`. And the player baked `?session=` into the *base*, so on a paired display the asset path was appended after the query; the token now rides the finished URL.
- **One spelling, not two.** The player's font loader open-coded `encodeURIComponent(asset.path)` and asked for the doubled form; it now calls the same resolver, which is what let the seam drift in the first place.
- **Proved in the real host, and shown to fail without the fix.** A seeded `e2e-media` theme has nothing on its artboard but a packaged SVG background; a browser test reads the decoded `naturalWidth` (24) and counts the badge's own pixels. With the route and the header reverted, all four asset tests fail; with them, all four pass.

## Next

1. Prove changing media on the player and close the acceptance clause, then the plan.
2. Then the font catalogue plan, then the queued specs.

## Blockers / unverified

- **Changing media on the real player is the only part of the acceptance clause left open, and it is not blocked.** Packaged media decodes on the player against the real host; what no test does is *change* that media while the panel samples it.
- **`library.ts` is 785 lines** (a documentation-only correction cost 4 of the 19 lines of headroom the earlier ruling left). The extraction into `library-devices.ts` is still required **before any future work on selection, not during it**; it is not a violation today.
- The `line` family applies `areaStyle` to the **first series only** (`charts/line.ts:254-255`), so the reference's three filled trend series are not expressible. A renderer limitation, not a starter decision; the two sparklines do keep their area. Separately: the glass composite bound moved 3 ms to 4 ms inside the Task 7 commit `109669e`, when the reference CPU card made the panel 1.68x larger; the review asked for that as its own commit and history was not rewritten, so it is named here instead and the supporting readings are post-change on one machine. The queued author-journey spec also still owes a browser round-trip of text wrap/overflow, in-place edit and undo.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left of where it started, while the same gesture on the un-frosted RAM card landed exactly on the neighbouring edge. Glass is on the watchlist; this is a Task 5-shaped defect and is recorded in `task-7-report.md`.
- Task 9's two open edges, named rather than wished away. **Residual:** each provider is internally consistent — one selection answers a group's figures and its caption together — but `registry.sample` fans out with `Promise.allSettled`, so an assignment landing **between** LHM's read and the library's pairs one provider's figure with the other's name for one frame; closing it needs a host-owned epoch threaded through the registry, a provider-contract change, and `registry.test.ts` pins the split so it is visible rather than silent. **Unverified:** the drive model→volume join matches `blockDevices[].device` to `diskLayout[].device` by equality, proven only on Windows (`\\.\PHYSICALDRIVE0`); the POSIX form is unverified, no guess was added, and a miss yields a **gap**, never a wrong name. Owed to Task 8's typography, now visible because the box is real: `storage-card-value`'s box runs 1460–1660 while its card ends at 1632 (the glyphs centre inside it and stay on the card, so nothing paints out of place, but box and card disagree by 28 units).


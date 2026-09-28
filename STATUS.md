# Vigilia status

Updated: 2026-09-28
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional. **All 12 tasks are
written and reviewed, and the acceptance language is now met** — changing media
on the real player is proved, which was the last open clause.

## Active work

- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — **acceptance met, ready to archive.** The last clause, *"Inspect editor and real player at target size, another fitted viewport and different DPR, including grouped/rotated/overlapping panels and changing media"*, is proved on both mounts by pixels; `task-12d-report.md` closes the changing-media part that [#3](https://github.com/peterng1618/vigilia/issues/3) had blocked.
- **Completed, archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md) — `docs/bugs/` is gone; open [#2](https://github.com/peterng1618/vigilia/issues/2) delete inside a group. [#3](https://github.com/peterng1618/vigilia/issues/3) packaged assets is fixed and closed.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md) — **approved 2026-09-27**; plan now unblocked, since it must be written against the delivered surface. Rebuilds the reference from blank through the UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md) — not activated. Replaces the one-entry hand-written trio with 380 generated pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued spec, no plan:** removing the v1 document format and the fixture node-tree render path — must account for `metadata.locale`: v1 documents carry no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- **The starter's frosted panels had nothing behind them, and the fix was a packaged photograph, not a URL.** The artboard carried a three-stop vertical gradient whose mean luma step between adjacent columns measures **0.00** — a blur had literally nothing to reveal. The gradient plate object and the opaque artboard paint are gone, and the document now declares `assets/starter-backdrop.jpg` as `artboard.backgroundMedia`.
- **It ships the bytes, not a link, and the licence is verified.** A CDN URL would have *looked* right — `drawImage` tolerates a tainted canvas — while breaking every path that reads pixels back, `toDataURL` and `getImageData` both throw. Unsplash Licence, Ashim D'Silva, verified 2026-09-28 from the photo page itself and recorded in `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md`.
- **The frosted card's own fill had to change too, and that was the half nobody would have predicted.** At `panel`'s 85 % alpha the backdrop reached the eye at **2.40/255** of contrast; the new `palette.frost` at 72 % reads **4.46**. A blur applied under an almost-opaque panel is a blur of nothing. The price is named, not hidden: the caption's contrast drops from 9.6:1 to 5.8:1, still above AA.
- **Proved in both mounts by pixels, against blur-off controls,** and the canvas is confirmed untainted by `getImageData` and `toDataURL` succeeding on each mount's own surface. Registered `editor-starter-backdrop`, inspected before it was kept.
- **No watchlisted owner needed a change**, which is the finding of [0011](docs/decisions/0011-the-starter-ships-its-backdrop-as-a-packaged-asset.md): the whole mechanism — declared media asset, host asset route, thumbnail compositing — already existed. What changed is what a *new theme starts from*, which the editor's starter module owns.

## Next

1. Archive the plan now that acceptance is met, then the author-journey proof plan, then the font catalogue.
2. Then the queued specs.

## Blockers / unverified

- **The video frame callback is unproved on the player**, and provably not load-bearing there: `startHostedTheme` repaints at 30 fps, so a theme without charts would depend on `onFrame` alone and nothing tests that. It is load-bearing in the editor.
- **`library.ts` is 785 lines** (a documentation-only correction cost 4 of the 19 lines of headroom the earlier ruling left). The extraction into `library-devices.ts` is still required **before any future work on selection, not during it**; it is not a violation today.
- The `line` family applies `areaStyle` to the **first series only** (`charts/line.ts:254-255`), so the reference's three filled trend series are not expressible. A renderer limitation, not a starter decision; the two sparklines do keep their area. Separately: the glass composite bound moved 3 ms to 4 ms inside the Task 7 commit `109669e`, when the reference CPU card made the panel 1.68x larger; the review asked for that as its own commit and history was not rewritten, so it is named here instead and the supporting readings are post-change on one machine. The queued author-journey spec also still owes a browser round-trip of text wrap/overflow, in-place edit and undo.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left of where it started, while the same gesture on the un-frosted RAM card landed exactly on the neighbouring edge. Glass is on the watchlist; this is a Task 5-shaped defect and is recorded in `task-7-report.md`. **Two new edges on the same card, both measured and neither explained.** The editor and the player read the *same* artboard band of it at **4.46** and **1.38** of contrast, while the source photograph measures 7.61 there — so the two mounts do not agree with each other or with the source, and the glass sampler is where that lives. And the material weakens as the artboard is scaled down: 1.38 at 1672×941, 0.70 at a 0.765 fit, which is the edge of visibility. Neither is a claim about correctness, both are the numbers the tests assert against.
- Task 9's two open edges, named rather than wished away. **Residual:** each provider is internally consistent — one selection answers a group's figures and its caption together — but `registry.sample` fans out with `Promise.allSettled`, so an assignment landing **between** LHM's read and the library's pairs one provider's figure with the other's name for one frame; closing it needs a host-owned epoch threaded through the registry, a provider-contract change, and `registry.test.ts` pins the split so it is visible rather than silent. **Unverified:** the drive model→volume join matches `blockDevices[].device` to `diskLayout[].device` by equality, proven only on Windows (`\\.\PHYSICALDRIVE0`); the POSIX form is unverified, no guess was added, and a miss yields a **gap**, never a wrong name. Owed to Task 8's typography, now visible because the box is real: `storage-card-value`'s box runs 1460–1660 while its card ends at 1632 (the glyphs centre inside it and stay on the card, so nothing paints out of place, but box and card disagree by 28 units).


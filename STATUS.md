# Vigilia status

Updated: 2026-09-28
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

The plan's acceptance is met and the measurement it carried as open is closed.
The frosted card has been rebuilt against the four glassmorphism behaviours the
user named, and what is left is the one thing an agent cannot decide: whether it
now reads as glass.

## Active work

- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — acceptance met, **ready to archive**; no task is open.
- **The glass is changed and waiting on the user's eye.** They rejected the last attempt on sight, so the verdict is theirs; [0013](docs/decisions/0013-frost-is-diffusion-grain-and-an-edge-not-a-tint.md) carries the measurement behind every choice in it.
- **0012 landed earlier the same evening:** the sampler reproduces `object-fit` now, so a panel blurs the photograph the element beside it is showing — the editor's 16.54 and the player's 5.08 both fall to the photograph's own 7.45.
- **Archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, the GitHub-issues backlog. Open [#2](https://github.com/peterng1618/vigilia/issues/2) is delete inside a group.
- **Unfinished from the reference-theme session:** the video frame-callback proof in `host-media.spec.ts` is written but carries a debug block and has never been run.

## Last completed change

- **Frost had one of its four parts right.** Diffusion was 16 artboard units, small enough that the sunset's band stayed legible through the panel; there was no texture anywhere; the edge was already inside the ecosystem's band and was left alone.
- **The tint is held, and the reason is measured.** The backdrop under the card is luma 110.2 sharp and blurred alike, so `#ecf5ff` clears AA only while the tint is at 0.66 and the `dim` caption only at 0.80 — 72 % is the floor, not a preference.
- **The card's radius moved 16 → 40**, inside both the published bound of 48 and Task 1's measured-flat band, and the sunset's structure is dissolved rather than smeared.
- **A seeded 128 px grain tile** is composited `overlay` at 3 % inside the panel clip, anchored to the panel rather than the viewport and released with the handle. The ecosystem's 8 % was measured to swamp the blur's own step statistic here, so the level came from the panel-scale reading.
- **Two e2e thresholds were re-derived, not deleted**, both calibrated at radius 16: the blur is read on the range (7.55 → 3.26 on the display, 7.56 → 2.91 in the editor) and not on the adjacent-column step, which a 40 px kernel flattens for any backdrop. Verified by 1773 unit tests, the 4 ms frame budget at radii 0/16/48, and the card in both mounts.

## Next

1. Look at the frosted card in both mounts and say whether it reads as glass.
2. If it does not, the tint is the only lever left, and it is paid for in text contrast — the `dim` caption is what goes first.
3. Run the video frame-callback proof or drop it; `host-media.spec.ts` carries a finished fixture and an unfinished test.
4. Archive the plan, then the author-journey proof plan, then the font catalogue.
5. Then the queued specs.

## Blockers / unverified

- The glass verdict is unverified by definition: no agent can see whether a panel reads as glass, and the last human judgement of it was made against a sampler that was cropping the wrong part of the photograph.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left, where the same gesture on the un-frosted RAM card landed on the neighbouring edge. Task 5-shaped, open, in `task-7-report.md`.
- Task 9's three open edges, named: the `Promise.allSettled` split frame, the POSIX drive→volume join proven only on Windows, and `storage-card-value`'s box ending 28 units past its card.
- The video frame callback is unproved on the player and provably not load-bearing there — `startHostedTheme` repaints at 30 fps. It is load-bearing in the editor.
- `library.ts` is 785 lines and its extraction into `library-devices.ts` is required before any future selection work; the `line` family applies `areaStyle` to the first series only (`charts/line.ts:254`).

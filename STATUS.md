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
- **The glass is changed and waiting on the user's eye.** They rejected the last attempt on sight, so the verdict is theirs; [0013](docs/decisions/0013-frost-is-diffusion-grain-saturation-and-an-edge.md) carries the measurement behind every choice in it.
- **0012 landed earlier the same evening:** the sampler reproduces `object-fit` now, so a panel blurs the photograph the element beside it is showing — the editor's 16.54 and the player's 5.08 both fall to the photograph's own 7.45.
- **Archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, the GitHub-issues backlog. Open [#2](https://github.com/peterng1618/vigilia/issues/2) is delete inside a group.

## Last completed change

- **Frost is diffusion, grain, saturation and an edge, and the tint is 30 %.** Diffusion moved 16 → 40, a seeded 128 px grain tile composites `overlay` at 1.5 % inside the panel clip, and `saturate(1.6)` rides the blur's own filter list. Radius 0 gets no filter at all, so the blur-off control stays a control for the photograph.
- **The tint is floored by contrast, measured as WCAG luminance and not as luma distance.** 18 % put the CPU card's field at 0.1874 and its caption at 4.02:1, under AA; 24 % gives 4.49, too thin a margin to hold; 30 % gives 0.135 and 5.1:1. The panel still transmits — 1.08 of backdrop structure against a 0.6 floor an even fill cannot reach. That lands on the far side of the ecosystem's *"past 0.25 the glass effect dies"*, which is where contrast put it rather than where the glass research did.
- **An earlier note read a 0-255 luma distance as a contrast ratio** and called the same caption "5.4:1". The two do not agree, and the browser is the one that ships; ADR 0013 now carries both tables and says which question each answers.
- **One card primitive.** `frostedCard()` is the only card the theme writes, and `card()` had no other caller, so it is gone rather than left exported. All seven cards are frosted.
- **The video frame-callback proof ran, and it had never run.** It fails on a real bug the debug block was chasing: `this` inside a `requestVideoFrameCallback` callback is a `VideoFrameCallbackContext`, so re-arming through it threw and the withholding count stayed at zero. Confirmed red at `host-media.spec.ts:649` with `followFrames` disabled.

## Next

1. Look at the frosted card in both mounts and say whether it reads as glass.
2. If it does not, the tint is the only lever left, and it now costs more than it did — the caption's 5.1:1 has 0.6 of ratio in hand.
3. Archive the plan, then the author-journey proof plan, then the font catalogue.
4. Then the queued specs.

## Blockers / unverified

- The glass verdict is unverified by definition: no agent can see whether a panel reads as glass, and the last human judgement of it was made against a sampler that was cropping the wrong part of the photograph.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left, where the same gesture on the un-frosted RAM card landed on the neighbouring edge. Task 5-shaped, open, in `task-7-report.md`.
- Task 9's three open edges, named: the `Promise.allSettled` split frame, the POSIX drive→volume join proven only on Windows, and `storage-card-value`'s box ending 28 units past its card.
- The video frame callback is now measured on the player and provably not load-bearing there — 92 render requests already became 40 renders with it removed. It is load-bearing in the editor, which nothing browser-tests.
- `library.ts` is 785 lines and its extraction into `library-devices.ts` is required before any future selection work; the `line` family applies `areaStyle` to the first series only (`charts/line.ts:254`).

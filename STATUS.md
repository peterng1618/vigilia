# Vigilia status

Updated: 2026-09-29
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Prove the author journey from blank to a finished theme by hand, through the UI
alone. The composition exists because a generator emitted it; rebuilding it by
hand is what finds the authoring control that is missing.

## Active work

- **No plan is active.** The reference-theme plan is archived; the next scope is the [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md), whose own gate requires an implementation plan written against the delivered surface before anything is dispatched.
- **[The author-journey plan](docs/superpowers/plans/2026-09-24-author-journey.md) is not dispatchable.** Its Tasks 1–5 all landed; its Task 6 is marked stale in place and reassigned to the proof spec, which is where the executable scope now lives.
- **The glass is changed and waiting on the user's eye.** They rejected the last attempt on sight, so the verdict is theirs; [0013](docs/decisions/0013-frost-is-diffusion-grain-saturation-and-an-edge.md) carries the measurement behind every choice in it.
- **Archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, `2026-09-26-reference-theme-fidelity.md`, the GitHub-issues backlog. Open [#2](https://github.com/peterng1618/vigilia/issues/2) is delete inside a group.

## Last completed change

- **Reference-theme fidelity is archived.** All 37 boxes are ticked, the State line records what landed after the tasks closed, and three open edges are named as not closed by it. It ran twelve tasks across four phases and closed its last acceptance clause on pixels in both mounts.
- **The author-journey plan cannot be dispatched, and the check is why.** Tasks 1–5 shipped years ago in tree terms; Task 2 mis-owns alignment/wrap/overflow, which live in the run editor rather than on the object; and the entire surface reference-theme added — glass controls, panel material, the frost tokens, per-family chart settings, device captions, tracked type — is absent from it.
- **The executable scope is the proof spec, and it has no plan.** It gates on one: written against the delivered surface, not inherited from any earlier draft.
- **Frost is diffusion, grain, saturation and an edge, and the tint is 30 %.** Diffusion 16 → 40, a seeded 128 px grain tile at 1.5 % `overlay`, and `saturate(1.6)` in the blur's own filter list.
- **The tint is floored by contrast, measured as WCAG luminance and not as luma distance.** 18 % put the CPU card's caption at 4.02:1, under AA; 30 % gives 5.1:1 and the panel still carries 1.08 of backdrop structure. An earlier note read a 0-255 luma distance as a ratio and called the same pair 5.4:1; the browser is the one that ships.

## Next

1. Write the author-journey proof plan against the delivered surface, then activate it in `STATUS.md`.
2. Dispatch it in subagent mode; the rebuild is one owner's hands and cannot be split across them.
3. Look at the frosted card in both mounts and say whether it reads as glass — the proof rebuilds that card by hand and will show it again.
4. Then the font trio catalogue, then the queued specs.

## Blockers / unverified

- The glass verdict is unverified by definition: no agent can see whether a panel reads as glass, and the last human judgement of it was made against a sampler that was cropping the wrong part of the photograph.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left, where the same gesture on the un-frosted RAM card landed on the neighbouring edge. Task 5-shaped, open, in `task-7-report.md`.
- Task 9's three open edges, named: the `Promise.allSettled` split frame, the POSIX drive→volume join proven only on Windows, and `storage-card-value`'s box ending 28 units past its card.
- The video frame callback is now measured on the player and provably not load-bearing there — 92 render requests already became 40 renders with it removed. It is load-bearing in the editor, which nothing browser-tests.
- `library.ts` is 785 lines and its extraction into `library-devices.ts` is required before any future selection work; the `line` family applies `areaStyle` to the first series only (`charts/line.ts:254`).

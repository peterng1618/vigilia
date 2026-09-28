# Vigilia status

Updated: 2026-09-29
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Prove the author journey from blank to a finished theme by hand, through the UI
alone. The composition exists because a generator emitted it; rebuilding it by
hand is what finds the authoring control that is missing.

## Active work

- **Active plan:** [author journey proof](docs/superpowers/plans/2026-09-29-author-journey-proof.md) — reviewed and active; the spec was amended first so the plan is written against the delivered surface. Executing in subagent mode, one implementer and an independent reviewer per task.
- **Task 1 is a product change, not a test.** `New` emits the finished composition today, so the blank state the proof needs does not exist; the user ruled that the first task makes it real, with the starter becoming an explicit template action. Select-all-and-delete was rejected as a starting point — a proof that begins with a workaround measures the workaround.
- **[The 2026-09-24 author-journey plan](docs/superpowers/plans/2026-09-24-author-journey.md) is not dispatchable and is not the active plan.** Tasks 1–5 shipped, Task 2 mis-owns alignment/wrap/overflow, and the reference-theme surface is absent from it.
- **The glass is changed and waiting on the user's eye.** They rejected the last attempt on sight, so the verdict is theirs; [0013](docs/decisions/0013-frost-is-diffusion-grain-saturation-and-an-edge.md) carries the measurement behind every choice in it.
- **Archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, `2026-09-26-reference-theme-fidelity.md`, the GitHub-issues backlog. Open [#2](https://github.com/peterng1618/vigilia/issues/2) is delete inside a group.

## Last completed change

- **Reference-theme fidelity is archived** as `78a653b`, all 37 boxes ticked, with the post-completion work and the three edges it did not close named in its State line.
- **The proof spec was amended, not inherited.** It was written a day before the frosted material landed, so its refresh list gained `palette.frost` at 30 %, `frostInk`/`frostArea`, `saturate(1.6)` in the blur's filter list and `frostedCard()` — and the §73 point that the tint is a global token, so a rebuild edits a token and a missing tint control is a finding rather than a workaround.
- **The author-journey plan was checked and found not dispatchable**, which is why the proof spec is the active scope rather than it. All six of its status-debt claims were verified: every spec still reads `in progress` with its feature in the tree.
- **The proof plan is written against the delivered surface**, with the control inventory read from source on 2026-09-29 rather than carried over, and the rebuild's geometry deliberately left to be read off the target image.
- **Its first task makes the blank state real**, because there was none: `New` emitted the finished composition, and the only route to blank was the workaround this pass exists to catch. The spec now says so rather than assuming a blank scene.

## Next

1. Execute the proof plan in subagent mode; the rebuild is one author's hands and cannot be split across workers.
2. Look at the frosted card in both mounts and say whether it reads as glass — the proof rebuilds that card by hand and will show it again.
3. Then the font trio catalogue, then the queued specs.

## Blockers / unverified

- The glass verdict is unverified by definition: no agent can see whether a panel reads as glass, and the last human judgement of it was made against a sampler that was cropping the wrong part of the photograph.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left, where the same gesture on the un-frosted RAM card landed on the neighbouring edge. Task 5-shaped, open, in `task-7-report.md`.
- Task 9's three open edges, named: the `Promise.allSettled` split frame, the POSIX drive→volume join proven only on Windows, and `storage-card-value`'s box ending 28 units past its card.
- The video frame callback is now measured on the player and provably not load-bearing there — 92 render requests already became 40 renders with it removed. It is load-bearing in the editor, which nothing browser-tests.
- `library.ts` is 785 lines and its extraction into `library-devices.ts` is required before any future selection work; the `line` family applies `areaStyle` to the first series only (`charts/line.ts:254`).

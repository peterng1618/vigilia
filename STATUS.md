# Vigilia status

Updated: 2026-09-29
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Prove the author journey from blank to a finished theme by hand, through the UI
alone. The composition exists because a generator emitted it; rebuilding it by
hand is what finds the authoring control that is missing.

## Active work

- **Active plan:** [author journey proof](docs/superpowers/plans/2026-09-29-author-journey-proof.md), executing in subagent mode. Phase 0 is three product changes; **Task 1 (artboard presets) has landed** — the module and its unit test, then the inspector wiring.
- **The rule that governs the whole pass:** fix what you find using what the repo already decides — owner, idiom, copy, existing control pattern — and move past it. A property not exposed, a misaligned layout, something hard to read, a non-Lucide icon: each is fixed, not noted. Only a genuine product unknown with no precedent is recorded and passed over. **Nothing waits on a human.**
- **Product decisions, recorded in the plan:** minimal blank palette; starter stays a library template; artboard chooser over 16:9, 19.5:9 and 4:3, both orientations, at 1080p/2K/4K named on the **short edge**, driving the inspector's artboard controls too. The starter keeps its own 1672 × 941 — 16:9 is its *ratio*, and the presets are a separate list.
- **[The 2026-09-24 author-journey plan](docs/superpowers/plans/2026-09-24-author-journey.md) is not dispatchable and is not the active plan.** Tasks 1–5 shipped, Task 2 mis-owns alignment/wrap/overflow, and the reference-theme surface is absent from it.
- **The glass verdict is still the user's to give.** [0013](docs/decisions/0013-frost-is-diffusion-grain-saturation-and-an-edge.md) carries the measurement behind every choice in it; the proof will rebuild that card by hand.

## Last completed change

- **Every control in the theme-settings, palette and type-preset panels has the name a screen reader reads.** F1.19 and F1.4, one cause: a `<label>` with no `for`. 15 controls paired `label.htmlFor` with the control's `id`, the idiom `selection-inspector` already uses.
- **More than the seven the finding named.** The audit opened the gradient and delete branches too and found 15: the palette's Angle, both stop positions and both stop colours, the `Paint` and `Reassign to` selects and the language sample were unnamed as well. `vigiliaPaletteToken` was **not** fixed by `ce80354` as the plan recorded.
- **Release version is a named status.** `output` is labelable, so it takes the same pairing and Chromium computes `status "Release version"`; it also moved into the panel's own `.vigilia-field` row, where it lines up with the fields above it.
- **Verified:** 1969 unit tests, typecheck, lint, format green; 4 new Playwright tests and 11 existing editor specs pass. Red-without-fix: with the two pairings removed, 6 controls read unnamed in Chromium and 4 unit tests go red. **Browser proof measured, not asserted** — `ariaSnapshot` over all 35 controls of the Settings pane, 0 unnamed.
- **Not fixed, found while there:** F1.5 — the type panel's wrapped labels render as `Name` jammed against its own input; F1.3 — Description is still a single-line input. Separate backlog rows, not bundled here.

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

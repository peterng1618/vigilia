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

- **F1.29: the selection inspector exists on a phone.** It was `display: none` below 980px, so an author on a 412px Pixel 7 had no geometry, material, glass or runs at all — and its controls sat in the accessibility tree at 0×0, read out by a screen reader and unpressable by a finger.
- **Chosen: a rail-toggled collapse that becomes a sheet.** "Inspect" is a fifth rail entry beside the four panes, carrying `aria-expanded` and no `aria-pressed` because it names a region rather than a member of a set. Closed = `hidden`, the mechanism F1.1 already settled for the panel.
- **Below 980px both side regions leave the grid and overlay the stage, one at a time.** The old rule kept a 240px panel column and measured an **88px** canvas; the grid is now rail and stage, and the canvas is **336px at 412** whether a region is open or not. Two 280px sheets over a 336px canvas is the top one hiding the bottom one, so opening either closes the other.
- **The guard was on both sides, which is why nothing was ever red:** the product hid the inspector and `panel-labels.spec.ts` skipped on a phone *naming the defect as its cause*. That skip is gone, so the accessible-name audit now runs on a phone too — 4 tests that were skipped are now green there.
- **Found and fixed beside it, in the same rule:** the header did not wrap, so "Save package" sat at x=397 in a 412px viewport — 64 of its 79 pixels off-screen, on the one action that must never be out of reach. Desktop is byte-identical to before: 4 columns, inspector open, 280px.

## Next

1. Execute the proof plan in subagent mode; the rebuild is one author's hands and cannot be split across workers.
2. Look at the frosted card in both mounts and say whether it reads as glass — the proof rebuilds that card by hand and will show it again.
3. Then the font trio catalogue, then the queued specs.

## Blockers / unverified

- The frosted CPU card, twice: the glass verdict is unverified by definition (no agent can see whether a panel reads as glass, and the last human judgement came from a sampler cropping the wrong part of the photograph), and its own `mr` handle does not track the pointer — a resize aiming 10 units right landed 4.24 units left, where the same gesture on the un-frosted RAM card landed on the neighbouring edge. Task 5-shaped, open, in `task-7-report.md`.
- Task 9's three open edges, named: the `Promise.allSettled` split frame, the POSIX drive→volume join proven only on Windows, and `storage-card-value`'s box ending 28 units past its card.
- The video frame callback is now measured on the player and provably not load-bearing there — 92 render requests already became 40 renders with it removed. It is load-bearing in the editor, which nothing browser-tests.
- `library.ts` is 785 lines and its extraction into `library-devices.ts` is required before any future selection work; the `line` family applies `areaStyle` to the first series only (`charts/line.ts:254`).

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

- **F1.39: the canvas context menu is no longer a third copy of the chart list — it is now the Add pane's own list.** All 13 entries, in the pane's groups, so the two "Line" rows are told apart by their heading.
- **Folded in, deliberately.** It read `CHART_FAMILIES`, so it could not drift on charts and was never F1.7's defect — but it was a third place that knew what can be inserted, and it offered five of thirteen with no shape in it. A right-click on empty canvas was a poorer version of the Insert menu one gesture away.
- The list is one owner; the *dispatch* — which façade call a kind maps to — is still a six-line switch in each of the three surfaces, because the owner cannot know whether a surface holds a façade or the editor.
- Measured in Chromium on a blank document: Text, then **Shape** (8), then **Chart** (4), 470px tall in a 720px viewport, not clipped. Red without the fix: both creation cases fail. 2090 unit tests green; `typecheck`, `lint`, `format:check` exit 0.

## Next

1. Execute the proof plan in subagent mode; the rebuild is one author's hands and cannot be split across workers.
2. Look at the frosted card in both mounts and say whether it reads as glass — the proof rebuilds that card by hand and will show it again.
3. Then the font trio catalogue, then the queued specs.

## Blockers / unverified

- [#7](https://github.com/peterng1618/vigilia/issues/7) is open against the active pass: the `Ctrl+N` discard prompt on a saved document, cause not established and pre-existing.
- The frosted CPU card, twice: the glass verdict is unverified by definition (no agent can see whether a panel reads as glass, and the last human judgement came from a sampler cropping the wrong part of the photograph), and its own `mr` handle does not track the pointer — a resize aiming 10 units right landed 4.24 units left, where the same gesture on the un-frosted RAM card landed on the neighbouring edge. Task 5-shaped, open, in `task-7-report.md`.
- Task 9's three open edges, named: the `Promise.allSettled` split frame, the POSIX drive→volume join proven only on Windows, and `storage-card-value`'s box ending 28 units past its card.
- The video frame callback is now measured on the player and provably not load-bearing there — 92 render requests already became 40 renders with it removed. It is load-bearing in the editor, which nothing browser-tests.
- The crop strip is measured once at mount, not per frame: Fabric does not move objects on a data refresh, and re-measuring every 30 s would only cost. A theme whose *authored* geometry changed under a running display would not re-notice — no such path exists today.

# Vigilia status

Updated: 2026-09-27
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional.

## Active work

- **Completed plans, both archived:** `2026-09-25-snapping-fidelity.md` (eleven
  tasks; gate, close-out and whole-plan review closed 2026-09-27) and
  `2026-09-26-clock-and-theme-locale.md` (all tasks, review and
  runtime-text-layout repair closed).
- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md)
  — activated 2026-09-27, subagent-driven. Task 1 (the glass probe) is complete
  and unblocks Tasks 2–12; Task 2 (the authored `vigiliaGlass` contract) is in
  flight. Ledger: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md)
  — awaiting written-spec review; not activated, and queued between reference-
  theme fidelity and the font catalogue. Proves the shipped authoring surface by
  rebuilding the reference composition from blank through the UI alone.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md)
  — not activated. Replaces the one-entry hand-written trio with 380 generated
  pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path. It must account for `metadata.locale`: v1 documents
  carry no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Planning pass: the author journey is consolidated to one spec,
  `2026-09-27-author-journey-proof-design.md`, queued between reference-theme
  fidelity and the font catalogue. Scope is **remaining work only** — the proof
  obligation, three unverified round trips, phone surfaces, status debt.
- The seven-day release spec is deleted. Its promise and the by-hand-rebuild
  requirement are absorbed; the sequence, recruitment and the ≥80% metric are not
  replaced by another schedule. One tester means no usability rate is claimed.
- Five shipped author/consumer spec pairs still read `in progress`, plus
  `settings-scope`, whose plan is already archived: shipped-and-unverified, not
  outstanding. **The status flips are held** until the new plan's Phase 1
  observes them. Inbound links repointed in the reference-fidelity spec and one
  stale-plan note.

## Next

1. Continue reference-theme fidelity, Task 2 onward.
2. Then the queued font catalogue plan, then the queued specs.

## Blockers / unverified

- `display-fabric.spec.ts` "is byte-stable at a fixed clock on one platform" is
  load-induced: failed under full-suite parallel load, passed on re-run. Not
  reproduced at base, so not proven pre-existing.
- Undocumented whether `PreCompact`/`SessionStart` fire for a *subagent's*
  compaction; the `agent_id` guard is defense-in-depth, not a demonstrated fix.
  No mechanism catches a dispatch the controller never recorded; a `SubagentStop`
  ledger audit for unknown agent ids is the only candidate.
- Unverified: browser round-trip of text align/wrap/overflow, in-place edit +
  undo, run preset/override; phone surfaces exercised by suite, not by eye.
  Owned by the queued author journey proof spec, not outstanding work here.
- Pre-existing, not from this plan: `format:check` fails on
  `snap-manager/scaling/scaling.dom.test.ts` (`01aa7dc`); the starter binds the
  unowned `memory.used`, so its donut renormalises to a false 100%; the baseline
  GPU provider returns the **maximum** across controllers, so a caption naming
  one GPU could sit over another's readings.

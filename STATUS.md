# Vigilia status

Updated: 2026-09-26
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make authoring a theme a *good* experience, not merely a possible one. The
author journey is reachable; the remaining active work closes the editor camera
and interaction layer before snapping fidelity resumes.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` —
  Tasks 1, 3, 4, 5 and 6 are landed; Tasks 2, 7, 8, 9 and 10 remain and carry
  the unticked boxes.
- **Archived:** `docs/superpowers/plans/archive/2026-09-25-editor-viewport-and-mechanics.md`
  closed on its full Task 11 gate.
- **Queued verification:** `docs/superpowers/plans/2026-09-24-author-journey.md`
  Task 6, after the active plan's browser evidence.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md)
  decides it.

## Last completed change

- Applied the editor-ui-polish final review's four fixes. The arrange toolbar now
  gates each button through `arrangeEligible(count, locked, id)`, which reads the
  per-action threshold from `arrangeMinimum` — the same owner `canArrange` uses —
  so the two distribute buttons are disabled at a two-object selection instead of
  advertising a click that silently does nothing.
- The selection inspector's geometry is now paired rows (X/Y, W/H, rotation
  alone) through the existing `linkedPair` primitive, meeting the spec's
  acceptance line; a committed pair edit still records one history entry.
- Deleted the two dead class names (`vigilia-selection-grid`,
  `vigilia-selection-appearance`) that had no CSS rule.
- Spec amended by ruling: the `LinkedPair` chain toggle and the layer-row context
  menu are dropped; the group disclosure stays a hand-rolled `aria-expanded`
  button. Focused suite green (23 files / 111 tests), full unit suite 1455 passed.

## Next

1. Execute snapping fidelity Tasks 2, 7, 8, 9 and 10.
2. Close author-journey Task 6 when its pending browser evidence is available.

## Blockers / unverified

- Whether `PreCompact`/`SessionStart` fire for a *subagent's* compaction is
  undocumented. The `agent_id` guard is defense-in-depth, not a demonstrated fix.
- No mechanism catches a dispatch the controller never recorded; a `SubagentStop`
  ledger audit for unknown agent ids is the only candidate and is not implemented.
  Malformed records, root-vs-subagent input and recovery-after-compaction are
  also untested: the self-check exercises pure helpers, never the hook entry
  points, which is why the silent `snapshot` no-op got through.
- One `display-fabric.spec.ts` case still exceeds Playwright's 30s default under
  load (32–35s), covered by `test.slow()`: not a failure risk, and the gate's five
  consecutive 113/0 parallel runs are the evidence. The earlier "five cases, per-project
  `60_000` does not take effect" reading predates the entrance-animation speedup
  and is now wrong on both counts. Unverified: browser round-trip of text
  align/wrap/overflow, in-place edit + undo, run preset/override.
- The gate's visual checks were made against `vite preview` bundles on desktop
  widths only; the phone surfaces were exercised by the browser suite, not by eye.

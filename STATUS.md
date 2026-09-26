# Vigilia status

Updated: 2026-09-26
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make authoring a theme a *good* experience, not merely a possible one. The
author journey is reachable; the remaining active work is snapping fidelity —
resize-time snapping, the behaviour matrix that proves both paths, and the
requirement close-out.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` —
  Tasks 1–6 are landed and reviewed; Tasks 7, 8, 9 and 10 remain. Task 2's
  review closed clean (spec compliant, quality approved, 0 Critical/0 Important)
  and its commit is `4fcd162`.
- **In flight:** `2026-09-25-editor-ui-polish.md` fix round 2, which fixes the
  inspector's wrapping Size row and a pair-commit regression the previous round
  introduced. Task 7 is held until it commits: both edit `editor.spec.ts`.
- **Archived:** `docs/superpowers/plans/archive/2026-09-25-editor-viewport-and-mechanics.md`
  closed on its full Task 11 gate.
- **Queued verification:** `docs/superpowers/plans/2026-09-24-author-journey.md`
  Task 6, after the active plan's browser evidence.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md)
  decides it.

## Last completed change

- Landed snapping-fidelity Task 2: `isSupportedActiveSelection` decides whether a
  composed selection may snap as a unit, ported from the fork with its per-child
  kind allow-list dropped — Vigilia's snap path is type-agnostic
  (`getObjectExactBounds` takes any `FabricObject`), unlike the fork's
  type-specific movement/scale path.
- `startGesture` now refuses a gesture for an unsupported `ActiveSelection`, so a
  scaled text selection cannot let movement be reinterpreted as unfinished
  scaling.
- Five jsdom unit cases and two browser cases cover it; both browser cases were
  shown to fail with the guard disabled before being trusted.
- Full unit suite 1455 passed; `format:check`, `lint` and `typecheck` clean.

## Next

1. Close snapping-fidelity Task 2's review, then execute Tasks 7, 8, 9 and 10.
2. Close `2026-09-25-editor-ui-polish.md`: its fix round 2 is in flight (the
   inspector's Size row wraps, and the paired commit rewrites the sibling), and
   it still owes the local browser suite.
3. Close author-journey Task 6 when its pending browser evidence is available.

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

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

- The viewport-and-mechanics plan closed on its full gate. Broad gate clean
  (format, lint, typecheck, 1447 unit tests, build, size); the browser suite ran
  113 passed / 0 failed in ~88 s across five consecutive parallel runs, and the
  player bundle is unchanged at 283.9 KB with no `viewport-manager` or
  `editor-shell` import under `packages/player`.
- The gate's red suite was one root cause, not a flake: the canvas probe's ink
  guard waited a fixed *simulated*-time budget (`page.clock.runFor`) for a paint
  that depends on *real*-time asset fetch and decode, so a slow asset under
  parallel load lost the race. It now waits a real-time deadline, with a
  `page.route` regression test that fails against the old guard.
- Each acceptance item was inspected rendered, not counted: artboard centred with
  pasteboard visible, zoom readout tracking the camera, marquee selecting without
  moving (0 → 26 selected, zero world-space rects changed), the context menu
  matching the dock's entries, and a group entered with the layers tree showing
  the child's context and `Ungroup` returning on Escape.
- The layer panel's bottom action row — previously unverified by eye — was checked
  live: empty with no selection, nine actions for one object, ten for two, with
  `Group` only for the multi-selection.

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

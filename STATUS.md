# Vigilia status

Updated: 2026-09-26
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make authoring a theme a *good* experience, not merely a possible one. The
author journey is reachable; the remaining active work closes the editor camera
and interaction layer before snapping fidelity resumes.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md`.
  Camera/viewport, navigation, marquee, keyboard, group context and non-1x
  snapping/indicator work are landed. Phase 1 (canvas context menu, Task 1) is
  complete; Phase 2 is the plan gate.
- **Queued:** `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` — five of
  its ten tasks landed before the workflow rewrite folded the plan, so Tasks 2, 7,
  8, 9 and 10 remain. Do not execute until the active plan closes and `STATUS.md`
  promotes it.
- **Queued verification:** `docs/superpowers/plans/2026-09-24-author-journey.md`
  Task 6, after the active plan's browser evidence is complete.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md)
  decides it.

## Last completed change

- The browser suite runs in parallel: 111 passed / 54 skipped in **1.3 min**, from
  7.5 min serially. Root cause was `clock.runFor` at ~4.5 ms wall per simulated ms
  across ~90% of suite wall time, not test-count growth; the canvas probe now
  requests the player's existing `?static=1` and waits for real ink instead of
  assuming one short advance paints. `fastForward` was measured and rejected — it
  skips frames 10 cases need to mount.
- Host specs moved to their own serial projects (`desktop-host`, `phone-host`),
  because they drive one real host whose stores race across workers; the fixture
  moved to `globalSetup` because the config itself is re-loaded in every worker,
  which had it re-seeding a shared directory under four of them.

## Next

1. Run Phase 1's Phase 2 broad/browser/visual gate and close the plan.
2. Promote snapping fidelity only after the viewport plan is closed.
3. Close author-journey Task 6 when its pending browser evidence is available.

## Blockers / unverified

- Whether `PreCompact`/`SessionStart` fire for a *subagent's* compaction is
  undocumented. The `agent_id` guard is defense-in-depth, not a demonstrated fix.
- No mechanism catches a dispatch the controller never recorded; a `SubagentStop`
  ledger audit for unknown agent ids is the only candidate and is not implemented.
  Malformed records, root-vs-subagent input and recovery-after-compaction are
  also untested: the self-check exercises pure helpers, never the hook entry
  points, which is why the silent `snapshot` no-op got through.
- The layer panel's bottom action row is still unverified by eye because the
  current capture has no selection.
- One `display-fabric.spec.ts` case still exceeds Playwright's 30s default under
  load (32–35s), covered by `test.slow()`: not a failure risk. The earlier "five
  cases, per-project `60_000` does not take effect" reading predates the
  entrance-animation speedup and is now wrong on both counts. Unverified: browser
  round-trip of text align/wrap/overflow, in-place edit + undo, run preset/override.

# Vigilia status

Updated: 2026-09-25
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make authoring a theme a *good* experience, not merely a possible one. The
author journey is reachable; the remaining active work closes the editor camera
and interaction layer before snapping fidelity resumes.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md`.
  Camera/viewport, navigation, marquee, keyboard, group context and non-1x
  snapping/indicator work are landed. Remaining: canvas context menu, then the
  plan gate.
- **Queued:** `docs/superpowers/plans/2026-09-25-snapping-fidelity.md`. Do not
  execute until the active plan closes and `STATUS.md` promotes it.
- **Queued verification:** `docs/superpowers/plans/2026-09-24-author-journey.md`
  Task 6, after the active plan's browser evidence is complete.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md)
  decides it; the review it answers is
  `docs/superpowers/2026-09-25-compaction-recovery-review.md`.

## Last completed change

- Adjudicated the compaction-recovery review: kept its findings on multi-worker
  dispatch records, active-plan inference and missing tests; rejected its
  Git-visibility finding (`.superpowers/sdd/.gitignore` is already `*`).
- ADR-0010 fixes the definition: a plan is active exactly when it holds a live
  dispatch record, never by ledger recency — the old 24h window marked four
  plans active at once, three of them finished or queued.
- The hook script now resolves plans that way, writes one
  `dispatch-<agent id>.md` per worker, and no-ops inside a subagent (`agent_id`
  guard) so a worker cannot receive controller recovery instructions.
- `--self-check` covers `activePlans` as well as `statusLines`; its teeth were
  verified by breaking the filter. Wired into CI as `npm run hooks:check`.

## Next

1. Finish the active viewport plan's canvas context-menu phase.
2. Run its broad/browser/visual gate and close the plan.
3. Promote snapping fidelity only after the viewport plan is closed.
4. Close author-journey Task 6 when its pending browser evidence is available.

## Blockers / unverified

- Whether `PreCompact`/`SessionStart` fire for a *subagent's* compaction is
  undocumented. The `agent_id` guard is defense-in-depth, not a demonstrated fix.
- No mechanism catches a dispatch the controller never recorded; a `SubagentStop`
  audit for unknown agent ids is the only candidate and is not implemented.
- The layer panel's bottom action row is still unverified by eye because the
  current capture has no selection.
- Two `display-fabric.spec.ts` player tests exceed Playwright's 30s default on
  this machine but pass with a longer explicit timeout; config behavior remains
  unconfirmed.
- Browser round-trip of text align/wrap/overflow, in-place edit + undo, and run
  preset/override persistence remain unverified.

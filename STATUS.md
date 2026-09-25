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
  decides it.

## Last completed change

- `STATUS.md` keeps sole ownership of the active plan. A dispatch record under a
  plan it does not name is now reported as unreconciled rather than promoting
  that workspace — the previous rule let a stray dispatch against a queued plan
  become that plan's authority.
- Expired records past the 7-day TTL are surfaced as expired recovery artifacts
  instead of dropped, so an abandoned dispatch no longer looks like one that
  never happened.
- `--self-check` covers `recoveryState` and expired records as well as
  `statusLines`, each failing independently when its own rule is broken.
- The end-to-end snapshot run caught a leftover `activePlans` reference that the
  script's blanket `catch {}` had turned into a silent no-op; `snapshot` mode had
  been writing nothing. The self-check missed it because it never calls
  `snapshot()`.

## Next

1. Finish the active viewport plan's canvas context-menu phase.
2. Run its broad/browser/visual gate and close the plan.
3. Promote snapping fidelity only after the viewport plan is closed.
4. Close author-journey Task 6 when its pending browser evidence is available.

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
- Two `display-fabric.spec.ts` player tests exceed Playwright's 30s default on
  this machine but pass with a longer explicit timeout; config behavior remains
  unconfirmed.
- Browser round-trip of text align/wrap/overflow, in-place edit + undo, and run
  preset/override persistence remain unverified.

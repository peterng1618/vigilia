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
- **Queued:** `docs/superpowers/plans/2026-09-25-snapping-fidelity.md`. Do not
  execute until the active plan closes and `STATUS.md` promotes it.
- **Queued verification:** `docs/superpowers/plans/2026-09-24-author-journey.md`
  Task 6, after the active plan's browser evidence is complete.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md)
  decides it.

## Last completed change

- Phase 1 Task 1: the canvas context menu. Right-clicking the canvas opens a menu
  whose object entries are literally the dock's own registry filter, so the two
  surfaces cannot disagree; empty canvas offers Text and the four chart families
  through the session facade, never through `OBJECT_ACTIONS`.
- The menu listens on the Fabric canvas's own `upperCanvasEl` with a controlled
  `Root` — no `ContextMenu.Trigger`, which Fabric's own stopping listener would
  starve. Native-menu suppression lives in that one listener only.
- Measured in Chromium: Base UI already stops ArrowDown and Escape while the menu
  is open, so the object does not nudge and `ShortcutManager` is unchanged. The
  test carries a control proving the nudge still works once the menu closes.
- jsdom cannot answer `:modal`/`:popover-open`, which floating-ui asks for while
  positioning; each unanswerable call cost ~0.5s and made one menu open take 35s.
  The DOM test stubs those two selectors, taking the suite from 157s of timeouts
  to 3.6s green.
- `--self-check` covers `recoveryState` and expired records as well as
  `statusLines`, each failing independently when its own rule is broken, and the
  end-to-end snapshot run now catches what its blanket `catch {}` had hidden.

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
- Five `display-fabric.spec.ts` player tests exceed Playwright's 30s default on
  this machine (30.2–47.7s) and pass with a longer explicit timeout; the
  per-project `60_000` apparently does not take effect and that is unconfirmed.
  Browser round-trip of text align/wrap/overflow, in-place edit + undo, and run
  preset/override persistence are also unverified.

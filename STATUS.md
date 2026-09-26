# Vigilia status

Updated: 2026-09-27
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make movement and resize snapping behave predictably: exact geometry, guides that
match the snapped result, and Ctrl/Shift controls consistent across gestures.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` —
  Tasks 1–9 and 11 landed; Task 10 remains.
- **Completed plan:** `2026-09-26-clock-and-theme-locale.md` — all tasks,
  whole-branch review, and runtime-text-layout repair closed.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path. It must account for `metadata.locale`: v1 documents carry
  no metadata, and absent means `en` there.
- **Queued spec, no plan:** [author-first seven-day release](docs/superpowers/specs/2026-09-26-author-first-release-design.md) — written-spec review pending; blank-to-running theme, ≥80% unassisted completion; not activated by the reference-theme priority change.
- **Next queued plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — immediately after snapping; review pending. Progressive default starter, mandatory glass, RAM/VRAM gauges; existing charts accepted, glow optional; weather/daily totals excluded.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Closed [BR-002](docs/bugs/closed/BR-002-text-side-handle-no-edge-snapping.md): a
  text box's `ml`/`mr` handle now snaps. Fabric gives a text box `changeWidth`
  side controls, so that gesture fires `object:resizing` on a canonical `width`
  and never reached the scale path's `object:scaling` binding.
- Added the text width path under `snap-manager/scaling/`. It runs on the shared
  `ScaleSnappingRuntime`, so hold, release and the Ctrl escape hatch are the same
  code the scale path uses. The fork's fork-specific coupling is stripped; the
  algorithm and thresholds are not.
- The port is the fork's own: `text-width-resize-projection.ts` and
  `text-width-resize-interaction-controller.ts` already modelled exactly `ml`/`mr`.
  Ruling the handle out would have been a documented regression against §175.
- Six dom cases assert the resolved width; removing the `object:resizing` binding
  turns three of them red. Two browser cases drive `mr` (geometry, Ctrl) and the
  matrix's 36 cases pass; with the binding removed and the editor rebuilt, the
  geometry case fails.
- Removed the ten leftover `.claude/worktrees/agent-*` directories from earlier
  subagents — six registered worktrees and four that were never registered. Each
  one's uncommitted state was saved to
  `%TEMP%/vigilia-worktree-salvage/` first; all of it was a deliberate mutation
  break, a superseded helper-extraction variant, or a completed investigation
  note, and every branch survived.

## Next

1. Run Task 10's quality gate; the nested-worktree blocker is gone.
2. Record the layer-action acceptance result in
   `2026-09-25-editor-ui-polish.md` during Task 10 close-out.
3. Tick the landed Tasks 6–8 plan steps during Task 10 close-out.
4. Activate reference-theme only after snapping closes.

## Blockers / unverified

- Whether `PreCompact`/`SessionStart` fire for a *subagent's* compaction is
  undocumented. The `agent_id` guard is defense-in-depth, not a demonstrated fix.
- No mechanism catches a dispatch the controller never recorded; a `SubagentStop`
  ledger audit for unknown agent ids is the only candidate and is not implemented.
- One `display-fabric.spec.ts` case still exceeds Playwright's 30s default under
  load (32–35s), covered by `test.slow()`: not a failure risk. Unverified: browser
  round-trip of text align/wrap/overflow, in-place edit + undo, run preset/override.
- The gate's visual checks were made against `vite preview` bundles on desktop
  widths only; the phone surfaces were exercised by the browser suite, not by eye.

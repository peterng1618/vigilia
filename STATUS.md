# Vigilia status

Updated: 2026-09-27
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make movement and resize snapping behave predictably: exact geometry, guides that
match the snapped result, and Ctrl/Shift controls consistent across gestures.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` —
  Tasks 1–9 landed; Task 10 remains.
- **Completed plan:** `2026-09-26-clock-and-theme-locale.md` — all tasks,
  whole-branch review, and runtime-text-layout repair closed.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path. It must account for `metadata.locale`: v1 documents carry
  no metadata, and absent means `en` there.
- **Queued spec, no plan:** [author-first seven-day release](docs/superpowers/specs/2026-09-26-author-first-release-design.md) — written-spec review pending; blank-to-running theme, ≥80% unassisted completion; not activated by the reference-theme priority change.
- **Next queued plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — immediately after snapping; review pending. Progressive default starter, mandatory glass, RAM/VRAM gauges; existing charts accepted, glow optional; weather/daily totals excluded.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Moved the shared editor helpers to `tests/e2e/editor-canvas.ts`; a filtered
  snapping run now collects 34 cases from one file instead of stopping discovery.
- Ran the active-target matrix: moving and resizing geometry, multi-step re-plan,
  release, no-guide and Ctrl against a shape, a text object and a group, plus
  moving equal-spacing. The resize gesture is a Shift-held `br` corner drag,
  because the editor leaves Fabric's `uniformScaling` on and a Textbox's side
  handle is not a scale action.
- Strengthened the layer-action case: active bridge object, dock visibility,
  footer below the tree and inside the panel, footer entry set equal to the dock's.
- Reintroduced the `83248dc` per-gesture marker: 20 of 21 cases fail, so the
  matrix catches the regression that shipped once. Restored and green.
- Recorded the text side-handle gap as [BR-002](docs/bugs/open/BR-002-text-side-handle-no-edge-snapping.md).

## Next

1. Run Task 10's quality gate from a workspace without nested agent worktrees;
   current lint fails on their nested Biome roots.
2. Record the layer-action acceptance result in
   `2026-09-25-editor-ui-polish.md` during Task 10 close-out.
3. Tick the landed Tasks 6–8 plan steps during Task 10 close-out.
4. Activate reference-theme only after snapping closes.

## Blockers / unverified

- Task 10 gate blocked: nested `.claude/worktrees/agent-*` Biome configs make lint fail; preserve or discard each worktree before removal.
- Whether `PreCompact`/`SessionStart` fire for a *subagent's* compaction is
  undocumented. The `agent_id` guard is defense-in-depth, not a demonstrated fix.
- No mechanism catches a dispatch the controller never recorded; a `SubagentStop`
  ledger audit for unknown agent ids is the only candidate and is not implemented.
- One `display-fabric.spec.ts` case still exceeds Playwright's 30s default under
  load (32–35s), covered by `test.slow()`: not a failure risk. Unverified: browser
  round-trip of text align/wrap/overflow, in-place edit + undo, run preset/override.
- The gate's visual checks were made against `vite preview` bundles on desktop
  widths only; the phone surfaces were exercised by the browser suite, not by eye.

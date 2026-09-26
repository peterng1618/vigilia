# Vigilia status

Updated: 2026-09-26
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make movement and resize snapping behave predictably: exact geometry, guides that
match the snapped result, and Ctrl/Shift controls consistent across gestures.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` —
  Tasks 1–8 landed and closed; Task 9 is parked with known verification gaps; Task 10 remains.
- **Completed plan:** `2026-09-26-clock-and-theme-locale.md` — all tasks,
  whole-branch review, and runtime-text-layout repair closed.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path. It must account for `metadata.locale`: v1 documents carry
  no metadata, and absent means `en` there.
- **Queued spec, no plan:** [author-first seven-day release](docs/superpowers/specs/2026-09-26-author-first-release-design.md) — written-spec review pending; blank-to-running theme, ≥80% unassisted completion; not activated by the reference-theme priority change.
- **Next queued plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — immediately after snapping; review pending. Progressive default starter, mandatory glass, RAM/VRAM gauges; existing charts accepted, glow optional; weather/daily totals excluded.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Parked Task 9's incomplete browser matrix as known limitations: target-kind coverage,
  focused-test isolation and layer-footer placement proof remain unverified.
- Kept resize equal-spacing out of scope because fork and Vigilia scaling lack that behavior.
- Stopped uncommitted Task 9 repair work; no production or test changes integrated.

## Next

1. Complete snapping Task 10 without claiming Task 9's parked browser evidence.
2. Review reference-theme plan and select execution method; activate only after
   snapping closes. Approve glass probe, then review findings before product work.
3. Then resume author-journey Task 6; authoring-and-consumer-polish Task 4;
   settings-scope; consumer-journey Tasks 5+6; theme-thumbnails;
   authoring-time-run-placeholders.

## Blockers / unverified

- Whether `PreCompact`/`SessionStart` fire for a *subagent's* compaction is
  undocumented. The `agent_id` guard is defense-in-depth, not a demonstrated fix.
- No mechanism catches a dispatch the controller never recorded; a `SubagentStop`
  ledger audit for unknown agent ids is the only candidate and is not implemented.
  Malformed records, root-vs-subagent input and recovery-after-compaction are also
  untested: the self-check exercises pure helpers, never the hook entry points,
  which is why the silent `snapshot` no-op got through.
- One `display-fabric.spec.ts` case still exceeds Playwright's 30s default under
  load (32–35s), covered by `test.slow()`: not a failure risk. Unverified: browser
  round-trip of text align/wrap/overflow, in-place edit + undo, run
  preset/override.
- The gate's visual checks were made against `vite preview` bundles on desktop
  widths only; the phone surfaces were exercised by the browser suite, not by eye.
- **Known limitations — Task 9 matrix:** active text/group targets lack complete move/resize browser coverage; `snapping.spec.ts` imports executable `editor.spec.ts`, so focused discovery includes unrelated editor cases; layer-action proof checks entry parity, not selected-object linkage or visible footer placement. Do not claim Task 9 matrix closure until repaired. Resize equal-spacing is not a bug: fork and Vigilia scale candidates do not support it, so it is out of scope unless product scope expands.

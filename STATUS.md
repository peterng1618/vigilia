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
- **In flight:** snapping-fidelity Task 7 (resize-time snapping), dispatched.
- **Archived:** `docs/superpowers/plans/archive/2026-09-25-editor-viewport-and-mechanics.md`
  closed on its full Task 11 gate, and
  `docs/superpowers/plans/archive/2026-09-25-editor-ui-polish.md` closed on its
  fix round 2 re-review, with one acceptance item carried (browser coverage for
  the layer panel's bottom action row — it rides in snapping Task 9).
- **Queued verification:** `docs/superpowers/plans/2026-09-24-author-journey.md`
  Task 6, after the active plan's browser evidence.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md)
  decides it.

## Last completed change

- Gave every spec a `- **Status:**` line (one of active / in progress / queued /
  implemented / backlog / design), so `docs/superpowers/specs/` reads without
  opening twelve files — the convention two specs already used, now uniform.
- Corrected `docs/superpowers/specs/README.md`: it said to delete a spec that is no
  longer a current contract, but `docs/product/requirements.md` and
  `docs/architecture/ownership.md` link into that directory on their `Design:`
  lines, so deleting one orphans the requirement it produced. Archiving now means
  promote the requirement, archive the plan, update the inbound links together.
- Nothing currently qualifies: §172–§174 still cite their specs as design, and
  §175's design link lands with the snapping plan's Task 10.
- Before that: closed `2026-09-25-editor-ui-polish.md` — archived, workspace
  deleted, acceptance annotated per item. Its carried item (browser coverage for
  the layer panel's bottom action row) rides in snapping-fidelity Task 9.

## Next

1. Land snapping-fidelity Tasks 7, 8, 9 (which also carries the carried item above)
   and 10, then its final whole-branch review and close-out.
2. Close author-journey Task 6 when its pending browser evidence is available.
3. Work the queue behind it: authoring-and-consumer-polish Task 4 (the tab reset is
   real, unimplemented work), settings-scope (gate and spec acceptance only),
   consumer-journey Tasks 5+6, theme-thumbnails, authoring-time-run-placeholders.

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

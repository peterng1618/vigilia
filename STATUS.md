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
  Tasks 1–7 landed, reviewed and closed; Tasks 8, 9, 10 remain. Task 7's review
  passed with 0 Critical, 3 Important, 4 Minor, and all six actionable findings
  re-reviewed as addressed.
- **Next up:** Task 8 (Ctrl and Shift during a resize). Nothing is in flight.
- **Archived:** `archive/2026-09-25-editor-viewport-and-mechanics.md` on its full
  Task 11 gate; `archive/2026-09-25-editor-ui-polish.md` on its fix round 2
  re-review, with one item carried (browser coverage for the layer panel's bottom
  action row — it rides in snapping Task 9).
- **Queued verification:** `2026-09-24-author-journey.md` Task 6, after the active
  plan's browser evidence.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Closed snapping-fidelity Task 7 (resize-time snapping with verification-gated
  guides). Its fix round added the `ponytail:` note naming the skipped refinement,
  and replaced the guide's uncommitted one-off capture with an assertion that
  samples the rendered `GUIDE_COLOR` pixels — the re-review confirmed the control
  is a live 0, not a vacuous one.
- Corrected the plan's comment-count arithmetic: the port's `/**` count is the
  same 25 as the fork's (20 unchanged + 5 converted to `//**`), not 20.
- Recorded a commit-hygiene defect: the fix's three source paths share `6c603c9`
  with unrelated `STATUS.md` work, because a `git add` raced a `git commit` on one
  index. Content verified exact; message wrong; not amended since the round's
  evidence is bound to that sha.
- Before that: gave every spec a `- **Status:**` line holding the state and nothing
  else, and corrected the specs README's delete rule.

## Next

1. Close snapping Task 7's fix round, then land Tasks 8, 9 (which also carries the
   item in Active work) and 10, then its final review and close-out.
2. Close author-journey Task 6 when its pending browser evidence is available.
3. Then the queue: authoring-and-consumer-polish Task 4 (the tab reset is real,
   unimplemented work), settings-scope (gate and spec acceptance only),
   consumer-journey Tasks 5+6, theme-thumbnails, authoring-time-run-placeholders.

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

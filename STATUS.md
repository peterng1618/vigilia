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
  Tasks 1–7 landed and reviewed; Tasks 8, 9, 10 remain. Task 7's review passed
  with 0 Critical, 3 Important, 4 Minor.
- **In flight:** Task 7's fix round — a missing `ponytail:` note, a guide
  assertion with a red-before proof, and two unit cases. Task 8 is held until it
  commits: both edit `snap-manager/`.
- **Archived:** `archive/2026-09-25-editor-viewport-and-mechanics.md` on its full
  Task 11 gate; `archive/2026-09-25-editor-ui-polish.md` on its fix round 2
  re-review, with one item carried (browser coverage for the layer panel's bottom
  action row — it rides in snapping Task 9).
- **Queued verification:** `2026-09-24-author-journey.md` Task 6, after the active
  plan's browser evidence.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Gave every spec a `- **Status:**` line (active / in progress / queued /
  implemented / backlog / design), so the specs directory reads without opening
  twelve files.
- Corrected `docs/superpowers/specs/README.md`: it said to delete a spec no longer
  a current contract, but `requirements.md` and `ownership.md` link into that
  directory on their `Design:` lines, so deleting one orphans the requirement it
  produced. Archiving now means promote the requirement, archive the plan and
  update the inbound links together — and nothing qualifies yet.
- Before that: closed editor-ui-polish — archived, acceptance annotated per item.

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

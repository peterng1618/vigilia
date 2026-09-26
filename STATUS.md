# Vigilia status

Updated: 2026-09-26
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make authoring a theme a *good* experience, not merely a possible one. The author
journey is reachable; the active work is the theme's own language, so a clock
reads its month, weekday and day-period names in the language its author wrote it
in rather than in two English tables.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-09-26-clock-and-theme-locale.md` —
  implemented across all 9 tasks; whole-branch review remains.
- **Next up:** whole-branch review, then the v1-removal spec recorded below.
- **Queued plan:** `2026-09-25-snapping-fidelity.md` — Tasks 1–7 landed and closed;
  Tasks 8, 9, 10 remain.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path. It must account for `metadata.locale`: v1 documents carry
  no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Recorded `metadata.locale` as render-affecting theme language in architecture,
  product requirements and ownership docs.
- Split datetime ownership into instant/zone, format tokens and localized names;
  recorded editor language-list ownership.
- Marked clock-and-theme-locale spec implemented and kept status within 70 lines.

## Next

1. Review the completed clock-and-theme-locale branch.
2. Draft the v1-removal spec recorded in Active work.
3. Then the queue: snapping Tasks 8, 9 and 10; author-journey Task 6;
   authoring-and-consumer-polish Task 4; settings-scope; consumer-journey Tasks 5+6;
   theme-thumbnails; authoring-time-run-placeholders.

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

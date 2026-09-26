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
  9 tasks. A theme declares its language once in `metadata.locale`, required on v2,
  and the clock spells its names from `Intl` in it.
- **Next up:** Task 3 (declare `metadata.locale` on the theme). Nothing is in
  flight.
- **Queued plan:** `2026-09-25-snapping-fidelity.md` — Tasks 1–7 landed and closed
  (Task 7's review: 0 Critical, 3 Important, 4 Minor, all actionable findings
  re-reviewed as addressed); Tasks 8, 9, 10 remain.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path. It must account for `metadata.locale`: v1 documents carry
  no metadata, and absent means `en` there.
- **Archived:** `archive/2026-09-25-editor-viewport-and-mechanics.md` on its full
  Task 11 gate; `archive/2026-09-25-editor-ui-polish.md` on its fix round 2
  re-review, with one item carried (browser coverage for the layer panel's bottom
  action row — it rides in snapping Task 9).
- **Queued verification:** `2026-09-24-author-journey.md` Task 6, after the active
  plan's browser evidence.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Month, weekday and day-period names now come from `Intl.DateTimeFormat` in a
  declared language, replacing the `WEEKDAYS`, `MONTHS` and `WEEKDAY_INDEX`
  English tables.
- `scene/datetime/names.ts` exports `isLocaleName`, `DEFAULT_LOCALE`,
  `monthName`, `weekdayName` and `dayPeriod`, caching one formatter per language
  and kind; `formatInstant` takes a trailing `locale` defaulting to `en`.
- Only `MMMM`, `MMM`, `dddd`, `ddd`, `A` and `a` consult the language; every
  numeric token stays ASCII.
- `partsInZone` derives the weekday from the calendar date instead of requesting
  it from `Intl`.

## Next

1. Execute the active plan's 9 tasks, then its whole-branch review.
2. Draft the v1-removal spec recorded in Active work.
3. Then the queue: snapping Tasks 8, 9 and 10 with its close-out; author-journey
   Task 6; authoring-and-consumer-polish Task 4; settings-scope; consumer-journey
   Tasks 5+6; theme-thumbnails; authoring-time-run-placeholders.

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

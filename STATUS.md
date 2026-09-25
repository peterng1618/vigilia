# Vigilia status

Updated: 2026-09-25
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make authoring a theme a *good* experience, not merely a possible one. The
2026-09-24 author journey made every step reachable; the control surface is still
unpolished, and the canvas has no camera.

## Active work

- Three plans, all under subagent-driven execution:
  - `docs/superpowers/plans/2026-09-25-editor-ui-polish.md` (Spec B) — Figma-baseline
    layer tree, action registry behind dock and layer-panel row, dense inspector,
    Lucide icons, restrained reduced-motion-guarded transitions.
  - `docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md` (Spec A)
    — zoom/pan camera, group entry, reachable marquee, keyboard, context menu.
  - `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` — port the fork's
    scale/resize snapping, relax the candidate filter, then replace the
    byte-length screenshot check with a move-and-resize behaviour matrix.
- SDD ledger: `docs/superpowers/plans/2026-09-24-author-journey.md` Task 6 is the
  only outstanding item in that plan.

## Last completed change

- Extracted the nudge/burst machinery into `canvas-nudge.ts` as
  `createCanvasNudge({ canvas, history })`, which took `editor-session.ts` from
  815 to 765 lines (the repo's 800 stop) and gave the burst a unit-testable seam.
  `EditorSession.destroy()` calls `nudge.dispose()`, which clears the pending
  timer and lifts an open suspension.
- `canvas-nudge.dom.test.ts` (fake timers) is now the burst's test: one `suspend`
  and zero `saveState` while a three-press burst is open, exactly one `saveState`
  after the 300 ms idle window, and two bursts more than 300 ms apart produce two
  entries. Measured with teeth: deleting `endBurst`'s `saveState()` fails on
  `0` against `1`; deleting its `release()` fails to `1` against `0` on the
  suspension depth. This supersedes the round-1 claim that
  `history-manager/index.test.ts` pinned the wiring — it only pinned the
  primitive, and disabling `endBurst` left the whole suite green.
- Keyboard authoring unchanged: arrow keys nudge (Shift = 10, plain = 1),
  `mod+]`/`mod+[` move to front/back through `layerManager`, `mod+a` selects every
  `selectable` object, and Ctrl+A inside a rename field stays the field's own
  select-all via `MODIFIED_KEY_DEFERRED_ACTION_IDS`.
- The two `editor.spec.ts` drag tests (`persists an ordinary drag…`,
  `rehydrates a chart runtime…`) fail identically with and without these changes;
  they are pre-existing and belong to Spec A Task 10.

## Next

1. Continue Spec B with Task 7 (arrange moves to the canvas toolbar).
2. Continue Spec A from Task 7, then 8, 9.
3. Close author-journey Task 6 once the e2e evidence lands.

## Blockers / unverified

- No verified full `npm run test:e2e` count yet: the earlier run never produced
  `test-results/summary.json`. Three spec acceptance items stay unverified —
  browser round-trip of text align/wrap/overflow, in-place edit + undo, and run
  preset/override persistence.
- The two `display-fabric.spec.ts` phone-chromium tests previously recorded here
  as pre-existing failures were re-measured and **both pass** on this branch
  (1 passed, 32.4s and 32.9s, `--workers=1`). They are not known failures; a red
  suite at the gate is a failure to investigate, not to absorb.
- The layer panel's row key changed to `id#index` and rows became `draggable`
  (Spec B Task 6); only `--grep "reorders a layer"` was run in a browser, so
  other `editor.spec.ts` cases are unverified against that change until the
  Spec B gate runs the full suite.

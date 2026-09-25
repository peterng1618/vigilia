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

- Fabric's marquee is reachable again: a drag that starts on the pasteboard
  below the artboard selects instead of moving `header-wash`. The size cause was
  already gone (Task 2 made the canvas host-sized); no object needed disarming,
  and the press-inside-an-object guard still moves `time-card` for +40/+30.
- `ViewportManager.artboardScreenRect()` is now the one owner of "where the
  artboard draws, in canvas-element coordinates" — the module-local copy in
  `editor-shell.ts` is deleted and the background-media layer calls the camera.
- The marquee e2e asserts against `getBoundingRect`, not object `left`: a marquee
  puts its hits in an `ActiveSelection`, whose `enterGroup` rebases every child's
  `left`, so the brief's raw-`left` comparison reported a move for objects that
  never moved and could not tell a marquee from a drag. It also asserts a
  selection was created, which is what catches a drag that never reached the
  canvas — and is the defect the brief's own off-canvas ambiguity would have
  hidden.
- The two `editor.spec.ts` drag tests (`persists an ordinary drag…`,
  `rehydrates a chart runtime…`) fail identically with and without recent
  changes; they are pre-existing and belong to Spec A Task 10.

## Next

1. Continue Spec B with Task 7 (arrange moves to the canvas toolbar).
2. Continue Spec A from Task 6, then 7, 8, 9.
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

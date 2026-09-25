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

- `serialiseScene` now persists `selectable`, `evented` and `locked`. Fabric's
  `toObject` omits all three, so any undo revived a scene where every object was
  selectable again — the starter background became draggable and locked objects
  unlatched. First open looked correct only because the authored JSON still
  carried the flags literally.
- Pinned by a `persist.dom.test.ts` round trip (with teeth: it fails as
  `selectable: true` with the fix reverted) and by `editor.spec.ts`, which
  reproduces the reported journey in a browser and asserts the object's flags
  rather than a hit test — `findTarget` skips `evented: false`, so it cannot
  witness this bug.
- The two `editor.spec.ts` drag tests (`persists an ordinary drag…`,
  `rehydrates a chart runtime…`) fail identically with and without this change;
  they are pre-existing and belong to Spec A Task 10.

## Next

1. Continue Spec B with Task 7 (arrange moves to the canvas toolbar).
2. Continue Spec A from Task 4 (zoom readout), then Task 6, 7, 8, 9.
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

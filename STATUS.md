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

- Added `editor-shell/controls/` — framework-free `numberField`/`linkedPair` DOM factories
  (with a shared `numberInput` core) that parse on `change`, refuse out-of-range values
  instead of clamping, own the `[role=alert]` message and the rejected-edit rollback, and
  keep `setValue`/`setValues` free of commits.
- Regrouped the artboard panel's eleven flat siblings into `.vigilia-field` rows; width and
  height are now one `linkedPair` ("Size — W 1000 H 720"). `isDimension` stays private there
  and the control is told `min`/`max`, so the two ranges cannot both fire.
- Added `docs/evidence/screenshots/editor-artboard-desktop-chromium.png` (re-captured) and
  `uiCopy.panels.widthMark`/`heightMark`/`invalidNumber`.

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

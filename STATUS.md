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

- Snapping Task 1 fixed: the snap-manager's ignored-id list named `"scene"`, a string no
  product object carries — in `new-fabric-theme.ts` the plate's id is `"background"` and
  `"scene"` is the ninth argument (`paletteId`). The list is now `["background"]`, so the
  artboard plate is genuinely excluded rather than admitted as a whole-artboard snap
  candidate whose 1px-stroke edges (±0.5) beat the artboard's own exact boundary source and
  whose span emitted spurious equal-spacing guides.
- The plate test derives its fixture id from `createNewFabricTheme()` instead of hardcoding
  the constant's string, so the fixture and the ignored-id list cannot drift apart again.
- `editor-session.ts`'s `selectableObjects` comment no longer claims parity with
  `snap-manager`: snapping deliberately aligns to locked objects, selection deliberately does not.
- Teeth, measured: emptying `IGNORED_IDS` reddens only the plate test
  (`expected 160.5 to be 158`); restoring `selectable === true` in `isSnapTarget` reddens only
  the locked-neighbour test (`expected 98 to be 100`); pointing the derived fixture at a wrong
  real id reddens the plate test again. Browser capture: guides against real content, neither
  against the plate nor a spurious spacing guide.

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

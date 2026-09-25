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

- `serialiseScene` now strips `subTargetCheck` and `interactive` from every object in the
  serialised tree. Fabric forces both into `Group.toObject`, and group entry arms them — so
  saving while inside a group leaked transient selection state into the portable document
  and left the reopened group permanently pointer-transparent (§67).
- `includeDefaultValues = false` could not do this: an armed `true` differs from Fabric's
  `false` default, and `SCENE_PERSISTED_PROPERTIES` is an allow-list of extra keys, not a
  filter. `persist.ts`'s docblock now names these two as the contrast case against the
  authored `selectable`/`evented`/`locked`.
- The serialization tripwire in `persist.dom.test.ts` was inverted rather than deleted: it
  now asserts both keys are absent even when armed, and reddens with
  `expected [ 'height', 'id', 'interactive', …(7) ] to deeply equal [ … ]` when the strip is
  disabled.

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

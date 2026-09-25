# Vigilia status

Updated: 2026-09-25
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make authoring a theme a *good* experience, not merely a possible one. The
2026-09-24 author journey made every step reachable; the control surface is still
unpolished, and the canvas has no camera.

## Active work

- Three plans written, all awaiting review before execution:
  - `docs/superpowers/plans/2026-09-25-editor-ui-polish.md` (Spec B) — Figma-baseline
    layer tree, action registry behind dock and layer-panel row, dense inspector,
    Lucide icons, restrained reduced-motion-guarded transitions.
  - `docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md` (Spec A)
    — zoom/pan camera, group entry, reachable marquee, keyboard, context menu.
  - `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` — port the fork's
    scale/resize snapping, relax the candidate filter, then replace the
    byte-length screenshot check with a move-and-resize behaviour matrix.
- Specs A and B are both under execution, task by task; snapping has no
  execution method chosen yet.
- SDD ledger: `docs/superpowers/plans/2026-09-24-author-journey.md` Task 6 is the
  only outstanding item in that plan.

## Last completed change

- `viewport-manager/navigation.ts` binds the camera's gestures: wheel pans,
  ctrl/meta-wheel zooms about the pointer, space-drag and middle-drag pan, and
  `+`/`=`/`-`/`shift+1` zoom. It is wired into `createNativeEditor` and unbound
  on destroy.
- A pan claims the canvas through Fabric's own `skipTargetFind`/`selection`, so
  a drag pans the camera and never moves authored content; `blur` clears the
  hold so a lost keyup cannot wedge the editor in pan mode.
- The camera keys defer to a focused text field through the newly exported
  `isTextEntryTarget`, and Space is left to a focused button, which activates on
  it. Both guards fail a test when removed.
- `isTextEntryTarget` is now exported from `shortcut-manager` instead of copied;
  one concept, one owner.

## Next

1. Continue Spec B with Task 6 (bottom action row and drag reorder).
2. Close author-journey Task 6 once the e2e evidence lands.

## Blockers / unverified

- No verified full `npm run test:e2e` count yet: the earlier run never produced
  `test-results/summary.json`. Three spec acceptance items stay unverified —
  browser round-trip of text align/wrap/overflow, in-place edit + undo, and run
  preset/override persistence.
- Two pre-existing `display-fabric.spec.ts` phone-chromium failures hang at
  `document.fonts.ready` after `page.clock.runFor()`; not absorbed.

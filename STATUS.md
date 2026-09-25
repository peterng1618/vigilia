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

- The layer panel moves objects: rows are HTML5 drag sources, and a drop
  restacks the layer through the bridge's new `reorderLayer` when both rows
  share a parent. A cross-group drop is refused and left unmarked.
- One native drop indicator, positioned by the browser's own dragover target,
  so the marker cannot outlive the gesture or promise a drop that would refuse.
- The panel's six-per-row action buttons are gone; a bottom row renders
  `OBJECT_ACTIONS` through the same `actionEnabled` predicate the dock uses.
- `layer-panel.dom.test.tsx` and `bridge.dom.test.ts` cover the row filter,
  the drop slot and `reorderLayer`'s two refusals; `editor.spec.ts` drags a row
  in a real browser and re-saves the envelope.

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

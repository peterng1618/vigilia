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

- The imperative `layer-panel.ts` is deleted; `editor-shell/layer-panel.tsx`
  renders a Figma-style tree from `bridge.layers()` — one dense row per layer
  with a depth indent, a kind icon, the name and exactly two state icons.
- `EditorShellBridge` gained `selectLayer`, `setLayerVisible`, `setLayerLocked`
  and `setCollapsed`; the first two and lock resolve a group child through
  `ownerOf`, revealed from the tree because Fabric repoints `object.group` at an
  active selection.
- `layer-tree.ts` owns `findById`/`ownerOf`/`pathTo`, and `LayerRow` carries
  `collapsed`, so a shut group drops its children from the projection. Collapse
  is bridge-local view state, never authored history (§67).
- `ShellHosts` and `EditorPanelHosts` lost their `layers` node; the pane renders
  React-side, and the rail entry survives.

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

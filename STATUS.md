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

- The canvas is a viewport onto the workspace, not a surface clamped to the
  artboard: it takes the host's measured size and `createViewportManager` owns
  its transform as the single writer. `EditorShell`/`EditorInteraction` expose
  `viewport`.
- `fitCanvasViewport` is gone and `fitArtboardViewport`'s resizing role with it;
  `createNativeEditor` dropped its now-unused `artboard` parameter, and the
  `ResizeObserver` only calls `viewport.resize()`.
- The artboard paint moved from `canvas.backgroundColor` to a bounded,
  non-exported `Rect` in `canvas.backgroundImage`, so the pasteboard stays
  visible around the board; the plate is rebuilt after undo/redo through
  `editor:history-state-loaded`.
- Background media — a DOM sibling of the canvas — is repositioned to the
  artboard's screen rect on every camera change.

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

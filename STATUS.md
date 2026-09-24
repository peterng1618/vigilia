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
- Execution method not yet chosen for any of the three.
- SDD ledger: `docs/superpowers/plans/2026-09-24-author-journey.md` Task 6 is the
  only outstanding item in that plan.

## Last completed change

- Fixed the snapping regression the review found: the port re-planned once per
  drag instead of per pointer step, and hardcoded the Ctrl/axis intent fields.
  The regression test fails against the pre-fix source.
- Wrote and committed the snapping-fidelity spec, recording the current state of
  each ported area against the fork.
- Wrote all three implementation plans and reviewed each against its spec.

## Next

1. Choose an execution method per plan and start Spec B.
2. Close author-journey Task 6 once the e2e evidence lands.

## Blockers / unverified

- No verified full `npm run test:e2e` count yet: the earlier run never produced
  `test-results/summary.json`. Three spec acceptance items stay unverified —
  browser round-trip of text align/wrap/overflow, in-place edit + undo, and run
  preset/override persistence.
- `npm run format:check` still reports unrelated formatting in
  `tests/e2e/host-settings.spec.ts`; no broad formatting churn was applied.
- Two pre-existing `display-fabric.spec.ts` phone-chromium failures hang at
  `document.fonts.ready` after `page.clock.runFor()`; not absorbed.

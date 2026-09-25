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

- Ported the fork's scale-snapping geometry into `snap-manager/scaling/` as five vendored
  modules — `scale-projection`, `scale-snap-candidates`, `scale-snapping-resolver`,
  `scaling-snap-guard`, `scaling-step-snap-guards` — plus two new unit specs. Algorithms,
  thresholds and tolerances are byte-comparable with fork `9efdd78a`; divergences are
  import paths, English comments, `exactOptionalPropertyTypes` omissions and
  `noUncheckedIndexedAccess` guards. Vendored source is the deliberate exception to the
  800-line stop.
- `scale-snap-candidates` imports the candidate types from `scale-snapping-resolver`, as
  the fork does, so the candidates module does not typecheck until the resolver lands.
  Nothing imports the new modules yet; a gesture wires them in later tasks.

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

# Vigilia status

Updated: 2026-09-25
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Make authoring a theme a *good* experience, not merely a possible one. The
2026-09-24 author journey made every step reachable; the control surface is still
unpolished, and the canvas has no camera.

## Active work

- Spec B (plan this first): `docs/superpowers/specs/2026-09-25-editor-ui-polish.md`
  — Figma-baseline layer tree, action registry behind dock and layer-panel row,
  dense inspector, Lucide icons, restrained reduced-motion-guarded transitions.
- Spec A (plan second): `docs/superpowers/specs/2026-09-25-editor-viewport-and-mechanics.md`
  — zoom/pan camera, group entry, reachable marquee, keyboard, context menu.
- Both spectra committed in `d951fff`, awaiting review before `writing-plans`.
- SDD ledger: `docs/superpowers/plans/2026-09-24-author-journey.md` Task 6 is the
  only outstanding item in that plan.

## Last completed change

- Committed the Style-tab leftovers: Style-tab ownership row, plus a test proving
  a shape is offered none of a text object's fields, verified to fail when
  `runs.ts`'s text-content guard is disabled.
- Ignored Playwright MCP scratch output so interactive sessions leave a clean tree.
- Wrote and committed both editor-polish specs, with rejected audit findings
  recorded so they are not re-raised.

## Next

1. User review of both specs, then `writing-plans` for Spec B.
2. Plan Spec A second: its camera change is a prerequisite for the reachable
   marquee.
3. Close author-journey Task 6 once the e2e evidence lands.

## Blockers / unverified

- Snapping/smart-guide fidelity is under review against the fork's source; the
  port reportedly behaves worse than the original. Gap list not yet in hand.
- No verified full `npm run test:e2e` count yet: the earlier run never produced
  `test-results/summary.json`. Three spec acceptance items stay unverified —
  browser round-trip of text align/wrap/overflow, in-place edit + undo, and run
  preset/override persistence.
- `npm run format:check` still reports unrelated formatting in
  `tests/e2e/host-settings.spec.ts`; no broad formatting churn was applied.

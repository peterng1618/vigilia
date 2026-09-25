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
    Lucide icons, restrained reduced-motion-guarded transitions. **Tasks 1–10 done.**
  - `docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md` (Spec A)
    — zoom/pan camera, group entry, reachable marquee, keyboard, context menu.
    **Tasks 1–8 and 10 done**; Task 9 (context menu, a 7-file feature) and Task 11
    (full gate) remain.
  - `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` — port the fork's
    scale/resize snapping, relax the candidate filter, then replace the
    byte-length screenshot check with a move-and-resize behaviour matrix.
- SDD ledger: `docs/superpowers/plans/2026-09-24-author-journey.md` Task 6 is the
  only outstanding item in that plan.

## Last completed change

- Spec B Task 10 (full gate) landed: Task 7's held cast fix became a checked
  `satisfies Pick<ViewportManager, "zoom" | "onChange">` inside the unchanged
  double cast, and the layer panel's row `onClick` → `selectLayer` wire is pinned
  with the clicked row's own id rather than its parent's.
- Both fixes have verified teeth: the `satisfies` fails `TS2322` when `zoom` is
  mistyped, and the wire test fails when the wire passes `parentId`.
- Broad gate green at this commit: format, lint, typecheck clean; 1443 unit tests
  pass; build clean; player size PASS (283.9 KB gzip, budget 400 KB).
- Rendered inspection of the re-captured screenshot confirms the layer tree,
  indentation, two state icons per row, toolbar arrange icons, dense paired
  geometry fields and the two tooltip/positioner reduced-motion guards.

## Next

1. Spec A Task 9 — the canvas context menu, then Task 11's full gate.
2. Spec B is complete; Spec A's remaining tasks close the camera work.
3. Close author-journey Task 6 once the e2e evidence lands.

## Blockers / unverified

- **The layer panel's bottom action row is unverified by eye.** The capture frame
  shows no selection, and those actions render only for one. Open the host and
  select an object to check it.
- **Two player tests are slow, not broken.** `display-fabric.spec.ts:322` and
  `:359` exceed Playwright's 30s default (30216ms/30220ms, both projects) and
  **pass at `--timeout=120000`** (44738ms/34968ms). The per-project
  `timeout: 60_000` in `playwright.config.ts` is apparently not taking effect;
  that mechanism is unconfirmed, so no timeout was changed. A default-timeout run
  reads these two as red — that is machine speed, not a regression.
- The three spec acceptance items from the earlier note — browser round-trip of
  text align/wrap/overflow, in-place edit + undo, and run preset/override
  persistence — remain unverified.

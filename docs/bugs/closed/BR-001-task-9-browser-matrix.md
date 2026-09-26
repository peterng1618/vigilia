# BR-001 — Task 9 browser matrix

- **Status:** resolved.
- **Impact:** snapping browser matrix could not support Task 10 close-out.
- **Evidence:** `snapping.spec.ts` imported executable `editor.spec.ts`, so
  Playwright stopped discovery (a filtered run collected 64 tests across two
  files); active text/group move and resize coverage was incomplete; the
  layer-action test lacked selected-object and footer-placement proof.
- **Resolution:** the shared helpers moved to
  `src/web/tests/e2e/editor-canvas.ts`, a non-`.spec.ts` module both specs
  import, so a filtered run now collects only its own file. The matrix runs
  moving and resizing geometry, multi-step re-plan, release, no-guide and Ctrl
  against a shape, a text object and a group as the active target, plus moving
  equal-spacing against all three. The layer-action case asserts the bridge's
  active object, the dock, and that the footer sits below the tree and inside
  the panel with the same entry set as the dock.
- **Verification:** 34 cases pass
  (`npx playwright test --project=desktop-chromium tests/e2e/snapping.spec.ts
  --workers=1`). Reintroducing the `83248dc` per-gesture marker and rebuilding
  turned 20 of the 21 into failures — every gesture case, for both moving and
  resizing — so the matrix catches the regression that shipped once. The only
  survivor is the layer-action case, which runs no gesture.

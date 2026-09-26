# BR-001 — Task 9 browser matrix

- **Status:** deferred by user after three Task 9 repair/investigation cycles.
- **Impact:** snapping browser matrix cannot support Task 10 close-out.
- **Evidence:** `snapping.spec.ts` imports executable `editor.spec.ts`, so
  Playwright stops discovery; active text/group move and resize coverage is
  incomplete; layer-action test lacks selected-object and footer-placement
  proof.
- **Pickup:** move shared editor helpers to a non-`.spec.ts` module; run the
  active-target shape/text/group matrix; strengthen layer-panel browser
  assertions; then run `npx playwright test --project=desktop-chromium
  tests/e2e/snapping.spec.ts --workers=1` from `src/web/`.

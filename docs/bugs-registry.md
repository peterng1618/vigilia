# Bug registry

Non-critical bugs unresolved after three repair attempts belong here. Each entry
records current evidence and next pickup action. Resume only when a user asks.
Do not duplicate entries in status, specs, reports or other docs; a plan may
link an entry when it constrains planned work.

## Open

### BR-001 — Task 9 browser matrix

- **Status:** deferred by user after three Task 9 repair/investigation cycles.
- **Impact:** snapping browser matrix cannot support Task 10 close-out.
- **Evidence:** `snapping.spec.ts` imports executable `editor.spec.ts`, so
  Playwright stops discovery; active text/group move and resize coverage is
  incomplete; layer-action test lacks selected-object and footer-placement
  proof.
- **Pickup:** move shared editor helpers to a non-`.spec.ts` module; run the
  active-target shape/text/group matrix; strengthen the layer-panel browser
  assertions; then run `npx playwright test --project=desktop-chromium
  tests/e2e/snapping.spec.ts --workers=1` from `src/web/`.

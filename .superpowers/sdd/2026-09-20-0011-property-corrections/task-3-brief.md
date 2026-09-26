### Task 3: Prove the editor integration

**Files:**
- Test: `src/web/tests/e2e/editor-fork.spec.ts`
- Update: `.agents/specs/0011-editor-property-model.md`
- Update: `.agents/status.md`

- [ ] Add or extend the focused editor browser case to apply a curated face, edit the same preset, save, reopen, and assert its `face`, `trioRole` and edited `letterSpacing` survive.
- [ ] Build the editor with `npm run build -w @vigilia/editor` from `src/web/`.
- [ ] Run the focused browser test with `npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --grep 'global type preset'` from `src/web/`.
- [ ] Capture and inspect the affected font-trio visual action with `VIGILIA_CAPTURE=1` and `--workers=1` if the focused test changes visible controls.
- [ ] Update spec/status evidence using only observed test/build/browser results.

## Completion

The slice is complete when ordinary type-preset edits preserve packaged-font identity and trio assignment, Release is the sole version mutator, focused unit/typecheck/build/browser proof passes, and current evidence replaces this plan's unchecked tasks.

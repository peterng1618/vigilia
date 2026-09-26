### Task 2: Restrict release-version mutation

**Files:**
- Modify: `src/web/packages/editor/src/artboard-panel.ts`
- Test: `src/web/packages/editor/src/artboard-panel.dom.test.ts`
- Test: `src/web/packages/editor/src/fork-extensions/index.dom.test.ts`

- [ ] Add a failing artboard-panel DOM test that renders metadata with `version: '1.2.3'`, edits `name`, and asserts the callback preserves `version: '1.2.3'` while the displayed version remains `1.2.3`.
- [ ] Replace the editable release-version input with a read-only output carrying `data-vigilia-theme-version`; keep the current version in `submitMetadata` so ordinary metadata edits preserve it, and remove its change listener.
- [ ] Add a focused `ForkExtensions` DOM test that stubs the Release prompt and save path, then asserts Release is the only path that emits a bumped `metadata.version`.
- [ ] Keep `#release()` validation-before-bump and `bumpSemanticVersion()`; do not introduce a second version calculator.
- [ ] Run `npm test -- --run packages/editor/src/artboard-panel.dom.test.ts packages/editor/src/fork-extensions/index.dom.test.ts` from `src/web/`.
- [ ] Run `npm run typecheck -w @vigilia/editor` from `src/web/`.


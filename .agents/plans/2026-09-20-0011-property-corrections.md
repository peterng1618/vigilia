# Spec 0011 Property Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent ordinary type-preset edits from invalidating packaged fonts and restrict theme release versions to the Release action.

**Architecture:** Keep type-preset field ownership in `type-preset-panel.ts`; it emits a complete patched `TypePreset` to the existing `ForkExtensions` persistence path. Keep release-version mutation in `ForkExtensions`; the Theme settings panel displays the current value but cannot change it.

**Spec:** `.agents/specs/0011-editor-property-model.md`

## Constraints

- Reuse the adopted fork for generic editor mechanics.
- Type presets retain their declared packaged font face and trio role.
- Ordinary Save never changes the release version.
- No raw Fabric/ECharts JSON editing surface or new dependency.

## Review Focus

- Editing size, line height or letter spacing after applying a face retains `face` and `trioRole`.
- Clearing optional typography fields removes only the selected field, not the declared face or role.
- A normal metadata save cannot alter `metadata.version`.
- Release from an absent version starts at `0.1.0`; major/minor/patch retain existing bump semantics.
- The existing font-trio and release controls remain keyboard-accessible and keep their current data selectors.

### Task 1: Make type-preset edits lossless

**Files:**
- Modify: `src/web/packages/editor/src/type-preset-panel.ts`
- Test: `src/web/packages/editor/src/type-preset-panel.dom.test.ts`

- [ ] Add a failing DOM test with a preset containing `face`, `trioRole`, `weight`, `letterSpacing` and `lineHeight`; change its size and assert all untouched fields remain.
- [ ] Add a failing DOM test that changes `letterSpacing` and asserts the emitted preset contains its numeric value.
- [ ] Replace the reduced `TypePreset` reconstruction with a patch of `entry.value`: preserve `face` and `trioRole`, replace edited fields, and omit only an optional field whose input was explicitly cleared.
- [ ] Render a numeric `Letter spacing` input with `data-vigilia-type-letter-spacing`; validate it as finite before committing.
- [ ] Run `npm test -- --run packages/editor/src/type-preset-panel.dom.test.ts` from `src/web/`.
- [ ] Run `npm run typecheck -w @vigilia/editor` from `src/web/`.

### Task 2: Restrict release-version mutation

**Files:**
- Modify: `src/web/packages/editor/src/artboard-panel.ts`
- Test: `src/web/packages/editor/src/artboard-panel.dom.test.ts`
- Test: `src/web/packages/editor/src/fork-extensions/index.dom.test.ts`

- [ ] Add a failing artboard-panel DOM test that renders metadata with `version: '1.2.3'`, edits `name`, and asserts the callback omits `version` while the displayed version remains `1.2.3`.
- [ ] Replace the editable release-version input with a read-only output carrying `data-vigilia-theme-version`; remove it from `submitMetadata` and its change listener.
- [ ] Add a focused `ForkExtensions` DOM test that stubs the Release prompt and save path, then asserts Release is the only path that emits a bumped `metadata.version`.
- [ ] Keep `#release()` validation-before-bump and `bumpSemanticVersion()`; do not introduce a second version calculator.
- [ ] Run `npm test -- --run packages/editor/src/artboard-panel.dom.test.ts packages/editor/src/fork-extensions/index.dom.test.ts` from `src/web/`.
- [ ] Run `npm run typecheck -w @vigilia/editor` from `src/web/`.

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

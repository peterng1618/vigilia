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


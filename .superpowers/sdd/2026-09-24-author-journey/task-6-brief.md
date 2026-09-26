### Task 6 — Integration proof

- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test &&
      npm run build && npm run size`.
- [ ] Full local `npm run test:e2e`.
- [ ] Capture and inspect each state: shape, text, run, chart, none.
- [ ] Inspect the **persisted envelope** after save/reopen for each change, not
      only the live DOM.
- [ ] Update `docs/architecture/README.md` / `docs/architecture/ownership.md` and the spec.
- [ ] Commit.

## Self-Review

- Spec coverage: Tasks 1–2 are object appearance, 3 is in-place editing, 4 is
  run-level style, 5 is the Style tab, 6 is the proof.
- Ownership: the inspector writes through `EditorInteraction`; palette and type
  resolution stay with their owners; `arrange.ts` keeps object alignment.
- Risk: run-level editing is the largest surface, and the model already supports
  it. Task 4 asserts a round-trip through the persisted envelope, which is where
  a mistake there would show.

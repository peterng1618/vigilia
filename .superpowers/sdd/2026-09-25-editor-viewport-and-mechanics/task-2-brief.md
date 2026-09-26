#### Task 2: Close the plan

**Outcome.** The plan's gates run and the handoff is written.

**Acceptance.** Focused tests for the affected paths, then `format:check`,
`lint`, `typecheck`, `test`, `build`, `size`; the local browser suite with true
counts reported; rendered inspection of the visible acceptance set (centred
artboard/pasteboard, zoom/readout, marquee, group context, non-1x
guides/indicators, the context menu); `STATUS.md`'s last-change summary replaced;
anything unverified recorded rather than inferred.

**Known-red premise.** Five `display-fabric.spec.ts` cases are slow
(30.2–47.7s against a 30s cap) and pass at a raised timeout — measured in two
ledgers this session. Report true counts, change no timeout, and do not label a
red test pre-existing without base-commit evidence.

## Phase 2 — Close the plan

- [ ] **Focused and broad gates.** Run the tests affected by Phase 1, then
  format, lint, typecheck, unit tests, build and player-size checks.
- [ ] **System proof.** Run the full browser suite and inspect the visible
  acceptance set: centred artboard/pasteboard, zoom/readout, marquee, group
  context, non-1x guides/indicators, and the context menu. Do not label a red
  test pre-existing without base-commit evidence.
- [ ] **Handoff.** Update current specs/ownership only if implementation changed
  those truths, replace `STATUS.md`'s last-change summary, record anything
  genuinely unverified, then archive this plan when no queued work depends on
  it.

## Acceptance

The editor has a recoverable camera, reachable selection mechanics and one
consistent command model across dock and context menu. No camera/runtime state
enters persistence, no duplicate action owner is introduced, and the player
remains independent of editor UI/camera code.

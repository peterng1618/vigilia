# Task 9 review

**Review target:** `c5e9d48..8b317c3`

## Verdicts

- **Requirements compliance: FAIL.** Required resize equal-spacing case is not proved. Required shape/text/group coverage is distributed across behaviours instead of exercising each behaviour against each required object kind.
- **Task quality: FAIL.** Multi-step mutation fixture is improved and coordinate/capture helper ownership is correct. However, matrix command includes unrelated editor tests and browser layer-row proof does not assert placement/visibility.

## Findings

### Critical

1. **Resize equal-spacing case accepts unsnapped geometry and no guide.**

   `expectedRight` resolves to `120`; test resizes to raw `122` and accepts any result within 3px. A raw, unsnapped result therefore passes. It also expects zero guide pixels, accepting absence of the claimed equal-spacing guide. Current scale candidate construction creates only edge/centre/domain candidates; no equal-spacing candidate/path is present.

   - `src/web/tests/e2e/snapping.spec.ts:539-551`
   - `src/web/packages/editor/src/snap-manager/scaling/scale-snap-candidates.ts:10-18`
   - `src/web/packages/editor/src/snap-manager/scaling/scale-snap-candidates.ts:40-69`
   - Requirement: `.superpowers/sdd/2026-09-25-snapping-fidelity/task-9-brief.md:31-39`

### Important

1. **Matrix lacks required kind-by-behaviour coverage.**

   Brief requires moving and resizing coverage against shape, text and group. Current suite assigns one kind to each behaviour: geometry uses shape, re-plan/Ctrl uses text, release/spacing uses group. It does not exercise each listed behaviour against each required kind.

   - `src/web/tests/e2e/snapping.spec.ts:394-551`
   - `.superpowers/sdd/2026-09-25-snapping-fidelity/task-9-brief.md:20-39`

2. **Claimed focused Task 9 matrix command also runs `editor.spec.ts`.**

   `snapping.spec.ts` imports helpers from executable `editor.spec.ts`. Playwright evaluates imports and registers tests, so command's 64-pass report includes unrelated editor cases; local file declares only 13 tests. Matrix count is not isolated Task 9 evidence.

   - `src/web/tests/e2e/snapping.spec.ts:1-4`
   - `src/web/tests/e2e/snapping.spec.ts:371-551`
   - `.superpowers/sdd/2026-09-25-snapping-fidelity/task-9-report.md:53-56`

3. **Layer-panel browser case does not prove bottom-row rendered placement.**

   Test reads labels under footer selector but never checks footer visibility, relation to visible layer panel/rows, or rendered bottom position. Hidden or misplaced footer could pass. It also never asserts clicked Fabric object became selection before comparing entry sets.

   - `src/web/tests/e2e/snapping.spec.ts:371-392`
   - `.superpowers/sdd/2026-09-25-snapping-fidelity/task-9-brief.md:42-50`

### Minor

1. **Mutation proof is report-only rather than retained executable evidence.**

   Report correctly documents invalid fresh-marker mutation, then valid per-gesture mutations and RED/GREEN results. Corrected movement fixture now distinguishes raw first step from snapped second step. No preserved command output/result artifact independently supports stated failure values.

   - `.superpowers/sdd/2026-09-25-snapping-fidelity/task-9-mutation-investigation.md:30-51`
   - `.superpowers/sdd/2026-09-25-snapping-fidelity/task-9-report.md:17-55`
   - `src/web/tests/e2e/snapping.spec.ts:403-413`
   - `src/web/tests/e2e/snapping.spec.ts:480-491`

## Confirmed good

- `sceneToClient` and `clientOfScene` are exported from existing test owner and retain artboard-fit mapping. No duplicate coordinate conversion in matrix.
  - `src/web/tests/e2e/editor.spec.ts:47-98`
- `captureVisualReview` remains exported from same owner and preserves `VIGILIA_CAPTURE` gate. No unregistered screenshot write added.
  - `src/web/tests/e2e/editor.spec.ts:3490-3511`
- Matrix has no new capture title/call, so screenshot registry does not need change for this task's assertion-only cases.
  - `docs/evidence/screenshots/README.md:38`
- Movement re-plan fixture now performs raw first step then near-guide second step. Per-gesture marker mutation distinguishes stale first plan from correct second plan.
  - `src/web/tests/e2e/snapping.spec.ts:403-413`
  - `.superpowers/sdd/2026-09-25-snapping-fidelity/task-9-mutation-investigation.md:36-51`

# Task 9 mutation investigation

## Observed evidence

Task 9 brief lines 57–59 requires reintroducing the `83248dc` per-gesture marker and seeing both multi-step browser cases fail. Task 9 report records the actual result: resize failed under mutation, movement survived.

Movement browser case in `src/web/tests/e2e/snapping.spec.ts` currently does this:

- mover starts at `left = 100`;
- `first-source.left = 360`;
- first step targets `first-source.left` (`360`), so first plan already snaps to the guide;
- second step targets `first-source.left - 6` (`354`), which should snap to that same guide;
- assertions expect both first and second results at `360` and final guide pixels present.

With a per-gesture marker, second step reuses first step's cached plan. That cached plan's `nextPosition.left` is already `360`, exactly matching expected second-step geometry. Mutation therefore leaves movement test green. Guide pixels also remain present because both correct and stale plan draw same guide.

Resize case uses different effective targets: first raw right edge is `source.left - 160` (`200`, no snap), second is `source.left - 2` (`358`, snap to `360`). Replaying first plan leaves second result near `200`, so resize assertion fails. This explains asymmetric mutation result without implicating resize runtime.

## Call/data flow

1. `mouse:down` calls `startGesture` in `src/web/packages/editor/src/snap-manager/index.ts`.
2. `startGesture` captures target start bounds and immutable snap sources, then starts `MovementSnappingRuntime` with a baseline.
3. Each Fabric `object:moving` event calls `runStep(event)`.
4. `readMovementMarker({ event })` uses `event.e` (native browser event) as marker. A native pointer event should produce one marker; repeated Fabric deliveries for same event should deduplicate.
5. `getObjectExactBounds` reads Fabric's raw geometry already applied by Fabric. `runStep` builds raw intent by translating gesture-start bounds to current offset, then calls `runtime.resolveMovementPlan({ marker, intent })`.
6. `MovementSnappingRuntime` stores one `MovementRuntimeStepRecord` per marker in `markerRecords: WeakMap<object, ...>`. New marker resolves a new plan; repeated marker returns duplicate cached plan.
7. A planned result is applied to Fabric, verified through `verifyMovementPlan`, and verification updates transient hold state. Duplicate results return without applying or re-verifying.
8. Original defect in `83248dc` used one `{ gesture: "moving" }` marker for whole gesture, so every later pointer step took duplicate path. `83248dc` removed that marker and switched to browser event marker. Its DOM regression explicitly moves to an unsnapped position first, then into a guide.

## Exact root cause

Movement multi-step E2E assertion is weak. Its first and second targets both resolve to same guide, so cached first plan is observationally equivalent to correct second plan. Test does not encode distinguishing invariant from `83248dc`: later raw pointer position must be re-planned when its first position did not snap to that guide.

Runtime behavior is not root cause. Under correct production code, `event.e` gives distinct marker objects for distinct browser pointer events. Under deliberate per-gesture mutation, runtime correctly deduplicates repeated marker; test fixture/expectation simply cannot expose resulting stale plan.

## Smallest viable correction

Change only movement multi-step case targets and expectations to mirror DOM regression shape:

- read `line = first-source.left`;
- first target `line - 160` (raw, away from guide);
- second target `line - 6` (near guide);
- assert first result remains near `line - 160`;
- assert second result reaches `line`;
- retain final guide-pixel assertion.

No production change needed. Do not weaken marker identity or remove duplicate protection. Restore any mutation before verification.

## Test expectation

Re-run focused movement and resize multi-step cases with deliberate per-gesture marker mutation. Both must fail. With production marker handling restored, both must pass. Movement now fails specifically because stale first plan leaves second step near `line - 160`, while correct per-event planning moves it to `line`.

Existing `src/web/packages/editor/src/snap-manager/index.dom.test.ts` regression remains required; it already proves movement defect at nearest owner boundary and should remain unchanged.

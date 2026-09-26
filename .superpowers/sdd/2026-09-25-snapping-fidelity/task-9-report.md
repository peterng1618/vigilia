# Task 9 fix round 1 report

## Status

DONE

## Scope

Correct weak movement and resize multi-step fixtures only. No production behavior change.

## Root cause

Original movement case passed near-guide target as first helper step and raw target as second helper step. Cached first snapped plan could therefore look like correct second geometry under marker mutation. Movement fixture now uses raw first step and near-guide second step.

Resize mutation diagnosis found first attempted mutation was wrong: `Object.freeze({ gesture: "scaling" })` created fresh object per callback, so scale still re-planned.

## RED mutation evidence

Movement mutation in `src/web/packages/editor/src/snap-manager/index.ts`:

```ts
const MUTATION_MOVEMENT_MARKER = Object.freeze({ gesture: "moving" });
return MUTATION_MOVEMENT_MARKER;
```

Resize mutation in `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts` first used fresh marker per callback and incorrectly passed. Corrected temporary per-gesture mutation cached one marker through scale gesture:

```ts
let mutationMarker: object | undefined;
const marker = mutationMarker ?? (mutationMarker = readMovementMarker({ event }));
```

Both used:

```text
npx playwright test --project=desktop-chromium tests/e2e/snapping.spec.ts --workers=1 --grep 'moving hold re-plans|resizing hold re-plans'
```

Movement result: failed with `Expected: < 3`, `Received: 153` at first-step assertion.

Resize result under true per-gesture mutation: failed at second-step assertion with `Expected: < 3`, `Received: 6.006389776357821`.

First resize mutation result (`Object.freeze({ gesture: "scaling" })` allocated inside `runStep`): `2 passed`; root cause was fresh marker allocation, not a fixture weakness. Smallest correction was caching marker for whole scale gesture and clearing it in `finishGesture`.

## Green proof

Restored production event marker handling in movement and scale paths. Built editor and reran same focused command.

Result: `2 passed (7.5s)`.

## Verification

- `npx vite build packages/editor` — passed; existing chunk-size warning only.
- Focused browser matrix with restored production marker handling — `2 passed (7.5s)`.
- Full Task 9 desktop matrix — `64 passed (1.4m)` after editor build.
- `git diff --check` — passed.
- Full matrix and broad workspace gates not run.

## Commits

Existing movement fixture commit: `e8c136d` — `test(editor): strengthen movement snapping mutation fixture`.

`e8c136d` — `test(editor): strengthen movement snapping mutation fixture`.

`be9ab21` — `docs(editor): record snapping mutation evidence`.

`af3c29f` — `test(editor): complete snapping mutation proof` (resize fixture correction, final report, full matrix evidence).

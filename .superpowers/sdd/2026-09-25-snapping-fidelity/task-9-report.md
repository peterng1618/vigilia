# Task 9 fix round 1 report

## Status

DONE

## Scope

Correct weak movement multi-step fixture only. No production behavior change.

## Root cause

Original movement case first moved to `first-source.left - 160`, then passed `first-source.left - 6` as second target, but helper call reversed arguments: first step used near-guide target and second step used raw target. Under per-gesture marker mutation, cached first snapped plan remained observationally equivalent to expected second geometry, so movement survived deliberate regression.

## Fix

`src/web/tests/e2e/snapping.spec.ts` movement case now reads `line`, moves first to `line - 160`, then second to `line - 6`, asserts first remains near `line - 160`, second reaches `line`, and retains rendered guide-pixel assertion. Resize case unchanged.

## RED mutation evidence

Temporary mutation in `src/web/packages/editor/src/snap-manager/index.ts` replaced event marker with one frozen per-gesture marker:

```ts
const MUTATION_MOVEMENT_MARKER = Object.freeze({ gesture: "moving" });
return MUTATION_MOVEMENT_MARKER;
```

Command:

```text
npx playwright test --project=desktop-chromium tests/e2e/snapping.spec.ts --workers=1 --grep 'moving hold re-plans|resizing hold re-plans'
```

Result: movement failed with `Expected: < 3`, `Received: 153` at first-step assertion. Resize passed in same run. This proves corrected movement fixture fails under movement-marker mutation. Separate resize marker mutation run also unexpectedly passed: resize path reads its own `event.e` marker through `readMovementMarker`, but its effective two-step fixture currently remains observationally equivalent under deliberate mutation. Existing Task 9 investigation records resize failure under the original mutation run; this fix round changed movement fixture only per instruction.

## Resize mutation evidence`r`n`rnA second mutation replaced scale controller marker with frozen `{ gesture: "scaling" }`. Same focused command result: `2 passed (6.2s)`. Production scale marker handling was restored immediately after. This run does not replace prior recorded resize RED evidence from Task 9 investigation.`r`n`r`n## Green proof

Restored production event marker handling. Built editor and reran same command.

Result: `2 passed (5.5s)`.

## Verification

- `npx vite build packages/editor` — passed; existing chunk-size warning only.
- Focused browser matrix — `2 passed (5.5s)` restored.
- `git diff --check` — passed.
- Full matrix and broad workspace gates not run.

## Commit

Pending.
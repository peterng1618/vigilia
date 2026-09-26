# Task 8 report

## Status

DONE_WITH_CONCERNS

## Changes

- Added Ctrl resize regression pair in `src/web/packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`:
  - Ctrl keeps raw fractional width.
  - Same resize without Ctrl still snaps.
- Added Shift corner-resize coverage using Fabric's `shiftKey` uniform-scale toggle.
- Confirmed controller already forwards both modifiers through shared `readMovementModifiers`.
- Confirmed `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-resolver.ts` already short-circuits Ctrl to raw geometry.
- No `index.ts` change: Task 7 had already widened `readMovementModifiers` to `{ ctrlKey, shiftKey }`.
- No new exports.

## RED/GREEN and mutation evidence

- Initial focused command from repo root failed before test collection because dependencies were absent: `Cannot find package 'jsdom'`.
- After workspace dependency install, focused test with existing implementation passed: 6 tests passed.
- Mutation: replaced controller modifier forwarding with `{ ctrlKey: false, shiftKey: false }`.
- Mutation command: `cd src/web && npx vitest run packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`
- Mutation result: expected RED; 1 failed, 5 passed. Failure: `leaves the raw size alone while Ctrl is held`, expected `306`, received `310`.
- Restored shared reader; focused suite became green: 7 passed.

## Exact verification commands/results

- `cd src/web && npx vitest run packages/editor/src/snap-manager/scaling/scaling.dom.test.ts` — 1 file, 7 tests passed.
- `cd src/web && npx vitest run packages/editor/src/snap-manager` — 10 files, 156 tests passed.
- `cd src/web && npx biome check packages/editor/src/snap-manager/scaling/scaling.dom.test.ts` — passed.
- `cd src/web && npm run typecheck` — all workspace packages passed.
- `npm --prefix src/web run build` — player, editor and host builds passed; existing chunk-size warnings only.
- `cd src/web && npx playwright test --project=desktop-chromium tests/e2e/editor.spec.ts --grep 'snaps a resized object' --workers=1` — 1 browser test passed.
- Final task-done command: `npx --prefix src/web vitest run packages/editor/src/snap-manager` — 10 files, 156 tests passed.

## Commit

`eeaae3b2fa9116926eab8f9da44dce0a78351b3d` in isolated worktree; cherry-picked to active branch as `33b24a9`.

Message: `feat(editor): Ctrl escapes snapping during a resize`

## Browser evidence

Existing real desktop resize case passed after rebuild: `snaps a resized object to a neighbour and shows a guide`. It verifies live resize geometry and rendered guide pixels. No dedicated browser Ctrl-resize gesture was added because Task 8 file scope excludes e2e files.

## Concerns

- Dedicated browser Ctrl-resize/no-guide capture remains unverified. Unit regression and resolver mutation proof cover behavior; existing browser case covers real resize wiring and visible guides.
- Task 9 owns browser behavior-matrix coverage and must add the dedicated Ctrl-resize/no-guide case.

# Final fix report — runtime text layout refresh

## Change

`refreshBoundText` now reapplies authored text alignment, ellipsis, edge placement, and clip-path geometry after runtime text measurement changes. `buildText` and `updateText` retain non-persisted runtime `PlanBox`, `PlanTextLayout`, and style state on each Fabric text object. Revived objects derive fallback box/layout from authored Fabric geometry and text metadata, including visible text with no clip path. Runtime layout state is not added to `SCENE_PERSISTED_PROPERTIES`, so locale/runtime text remains transient. Fallback style derives Fabric font properties instead of using an empty style.

Regression coverage in `src/web/packages/scene-fabric/src/persist.dom.test.ts` proves a bound value that grows from a short placeholder is ellipsised and clip width remains authored, plus a serialized/revived visible right/bottom-aligned value preserves its authored edge after refresh.

## TDD RED/GREEN

- RED: focused test failed before fix: runtime text stayed `123456789` instead of containing `…`.
- GREEN: same focused test passed after layout refresh implementation.

## Mutation proof

Temporarily removed `refreshLayout(object, segments, authored)` call. Focused test failed with runtime text `123456789`; restored call. This proves test detects missing fix.

## Verification

- `npm test -- packages/scene-fabric/src/persist.dom.test.ts` — 33 passed.
- `npm run typecheck` — all seven workspaces passed.
- `npm run format:check` — 347 files checked, no fixes.
- `npm run lint` — 347 files checked, no findings.
- Focused RED/GREEN test command passed after fix.
- Font fallback warnings appear from existing DOM test fixtures (`Old`, `Inter Bold`); no test failures.

## Commit

`13eab90` follow-up repair; supersedes initial `16abd83` runtime layout fix with revived visible alignment, fallback style, and regression coverage.

## Concerns

Runtime layout state is intentionally non-persisted. Existing revived text without runtime state and without a Rect clip cannot reconstruct authored box geometry; refresh safely skips layout in that case. Newly built/updated text always records state.

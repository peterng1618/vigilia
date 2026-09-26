# SDD ledger — plan: .agents/plans/2026-09-19-image-svg-asset-authoring.md

Pre-flight: Task 1 produces `VIGILIA_ASSET_PROPERTY` and validated asset references; Task 2 consumes both. Ruling: retain only `{ assetId, kind }` in Fabric JSON, as required by spec 0011; cost if wrong: asset hydration cannot locate package bytes.
Pre-flight: Task 2 produces `AssetManager` and its exact byte map; Task 3 consumes both at package and UI boundaries. Ruling: preserve raw declared bytes in the manager; cost if wrong: Save changes source bytes or package round-trips drift.
Pre-flight: Task 3 produces package controls and persistence; Task 4 consumes the visible import/replace workflow. Ruling: expose the plan's data attributes; cost if wrong: the browser evidence cannot drive the supported controls.

Task 1: complete (commits 646f37c..66c2f95, tests: npm test -- --run packages/scene-fabric/src/object-asset.test.ts packages/scene-fabric/src/persist.dom.test.ts && npm run typecheck -w @vigilia/scene-fabric -> 29 passed; typecheck passed)
Task 2: complete (commits 66c2f95..bb9e384, tests: npm test -- --run packages/editor/src/asset-manager/index.dom.test.ts && npm run typecheck -w @vigilia/editor -> 4 passed; typecheck passed)
Task 3: complete (commits bb9e384..85dd7de, tests: npm test -- --run packages/editor/src/persist.test.ts packages/editor/src/persistence-manager/index.test.ts packages/editor/src/asset-manager/index.dom.test.ts packages/editor/src/asset-manager/panel.dom.test.ts packages/editor/src/fork-extensions/index.dom.test.ts && npm run typecheck -w @vigilia/editor -> 17 passed; typecheck passed)

# SDD ledger — plan: .agents/plans/2026-09-20-hosted-font-assets.md

Pre-flight: Task 1 produces the declared asset route consumed by Task 2; Task 2 produces the font byte map consumed by Task 3. Route URL and encoded asset path agree with the spec.
Task 1: complete (commits f848319..346d774, tests: npm test -- --run packages/host/src/server.test.ts; npm run typecheck -w @vigilia/host; npm test -> 10/10, typecheck clean, 934/934)

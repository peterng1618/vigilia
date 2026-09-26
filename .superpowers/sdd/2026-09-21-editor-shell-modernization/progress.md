# SDD ledger — plan: docs/superpowers/plans/2026-09-21-editor-shell-modernization.md

Pre-flight: Task 1 establishes React/Tailwind; Tasks 2-5 consume its JSX/CSS boundary. Task 2 produces palette helpers consumed by Task 4. Task 3 produces EditorShellBridge consumed by Task 4. Task 5 consumes the mounted stage host from Task 4.

Ruling: Execute in the current `develop` checkout — user authorized autonomous in-place execution and explicitly asked to commit its root package files; cost if wrong: local branch changes require normal git rollback.

Ruling: Retain the root shadcn/Base UI manifest as developer tooling requested by the user; product runtime dependencies stay editor-local in Task 1; cost if wrong: duplicate package metadata can confuse a future contributor.

Task 0: complete (commit f69c867, tests: npm metadata licence lookup and git diff --check -> pass)

Task 1: Ruling: defer the static `index.html` shell conversion until Task 4 mounts the React root — changing markup before its consumer exists adds an unused transition surface; cost if wrong: Task 4 owns one additional markup edit.
Task 1: complete (commits f69c867..9d8c817, tests: npm run typecheck -w @vigilia/editor && npm run build -w @vigilia/editor -> pass)

Task 2: complete (commits 9d8c817..92ff4aa, tests: cmd.exe /d /s /c npm test -- palette.test.ts && npm run typecheck -w @vigilia/editor -> pass)


# SDD ledger — plan: docs/superpowers/plans/2026-09-24-author-journey.md

Resumed 2026-09-25 on branch `claude/superpowers-workflow-cleanup` (user: skip the
branch merge, keep working here). The plan arrived with every checkbox unticked,
so state was verified against the code rather than the checkboxes.

Verified already landed (commits in git, tests present):
- Task 1 — opacity, resolution line: `ce671c7`
- Task 3 — in-place text editing on double-click: `ab9a6c7` (`text-manager`)
- Task 4 — run list, preset + overrides: `1c25ca0`
- Task 2's alignment/wrap/overflow: `50a17fe` (`runs.ts`)

Genuinely remaining:
- Task 2 — the object's type-preset reference and a control that reveals the
  existing type-preset panel.
- Task 5 — the Style tab still renders the placeholder sentence.
- Task 6 — integration proof.

Pre-flight: Task 2 produces the appearance fields (preset reference + reveal
control) that Task 5 renders in the Style tab. Consumed shape must match. Task 5
also renders Task 1's landed opacity field and resolution line. Task 6 verifies
both. No other tasks share interfaces.

Task 2: Ruling: the object's type preset is its *first run's* reference, because
`applyObjectTypePresets` already paints the object from that run — deriving a
node-level preset would be a second rule for one fact. Cost if wrong: a text
object whose runs disagree shows the first run's preset, which is what it paints.
Task 2: complete (commits 9306fbd..49a9d77, tests: npm test -- --run packages/editor/src/selection-inspector/ → 22 passed; npm run typecheck -w @vigilia/editor → clean)

Task 5: Ruling: the Style tab is read-only and pulls globals on demand, rather
than holding a `setGlobals` copy like the Design inspector. It is mounted for the
whole session while `#setTypes`/`#deleteType` already skip the selection
inspector's own setGlobals, so a held copy would go stale on a type edit. Cost if
wrong: the panel re-reads one object per render, which is cheaper than the bug.
Task 5: complete (commits 49a9d77..045d08e, tests: npm test -- --run packages/editor/src/ → 257 passed; npm run typecheck -w @vigilia/editor → clean; shell placeholder test watched failing against the restored sentence)

---
name: vigilia:conventions
description: Points at Vigilia's operating manual for commands, traps, code style and git rules. Use when you need a reminder of how to build, test or run the project, which files must not be hand-edited, or which tooling behaves unexpectedly.
---

# Vigilia conventions

**Read [`AGENTS.md`](../../../AGENTS.md).** It is the operating manual: project
facts, setup, commands, traps, testing expectations, code style, where to record
what, commit and git rules.

This skill holds no rules of its own on purpose. It was previously a 123-line
second copy of that file, and the copies had already drifted in two places that
mattered — it told you to prefer `npm run typecheck` while AGENTS.md still
listed five hand-typed `tsc` invocations, and it carried a boundary rule that a
later decision had reversed. A quick reference that can disagree with the thing
it references is worse than no quick reference, and AGENTS.md is in context
already.

For anything AGENTS.md deliberately does not hold:

| Looking for | Read |
|---|---|
| How the pieces fit, and which file owns which concept | [`../../architecture.md`](../../architecture.md) |
| Why something was decided | [`../../decisions.md`](../../decisions.md) |
| What cost time here before | [`../../lessons.md`](../../lessons.md) |
| Current figures and what is unverified | [`../../status.md`](../../status.md) |
| The pre-commit gauntlet, scoped to what changed | `vigilia:verify` |

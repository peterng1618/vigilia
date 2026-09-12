---
name: vigilia:verify
description: Runs Vigilia's pre-commit gauntlet — typechecks, unit tests, bundle build, the size gate and the browser suite — in the order that avoids the traps, and reports what was not verified. Use before committing, before claiming something works, after changing renderer-core, or when asked to check, verify, validate or test the project.
---

The canonical content for this skill is [`.agents/skills/verify/SKILL.md`](../../../../../.agents/skills/verify/SKILL.md).

Read that file and follow it. Do not edit this pointer — it carries no substance.

> Why a pointer and not a symlink: symlinks do not work in this repository
> (`core.symlinks=false`, and `ln -s` silently copies). See
> [`.agents/skills/AGENTS.md`](../../../../../.agents/skills/AGENTS.md).

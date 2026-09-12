---
name: vigilia:create-skill
description: Guides authoring a new agent skill for the Vigilia repo, including the two-file canonical-plus-pointer layout required because symlinks do not work here. Use when creating, writing or authoring a new skill, or when asked about SKILL.md structure or where skills live in this repo.
---

The canonical content for this skill is [`.agents/skills/create-skill/SKILL.md`](../../../../../.agents/skills/create-skill/SKILL.md).

Read that file and follow it. Do not edit this pointer — it carries no substance.

> Why a pointer and not a symlink: symlinks do not work in this repository
> (`core.symlinks=false`, and `ln -s` silently copies). See
> [`.agents/skills/AGENTS.md`](../../../../../.agents/skills/AGENTS.md).

# Skill layout

`.agents/skills/<name>/SKILL.md` is canonical.
`.claude/plugins/vigilia/skills/<name>/SKILL.md` is a pointer that supplies the
`vigilia:` namespace. Edit canonical files, not pointers.

## Why pointers

Tracked symlinks are unreliable here: `core.symlinks=false` on Windows and Git
Bash `ln -s` has silently copied files. npm workspace symlinks under
`node_modules` are unrelated and may be recreated with `npm install`.

Do not add tracked symlinks.

## Adding/editing skills

- Create both canonical and pointer files; `vigilia:create-skill` documents the flow.
- Keep the sets synchronized:

```bash
diff <(ls .agents/skills | grep -v AGENTS.md) <(ls .claude/plugins/vigilia/skills)
```

Frontmatter:

```yaml
---
name: vigilia:<dir-name>
description: <third person; what the skill does and when to use it>
---
```

Discovery depends on `description`; use likely trigger words. Keep skills well
under ~200 lines and move optional detail to a sibling reference file. Cut
anything a capable model can infer.

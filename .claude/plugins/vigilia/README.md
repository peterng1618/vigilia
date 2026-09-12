# Vigilia plugin

This plugin exists for **one reason**: to give the project's skills a `vigilia:`
namespace. Standalone `.claude/skills/` entries cannot be namespaced and would
collide with personal or third-party skills of the same name.

## It contains no substance

Every `skills/<name>/SKILL.md` here is a **pointer file**. The real content is in
[`.agents/skills/<name>/SKILL.md`](../../../.agents/skills/), which is canonical
so that harnesses other than Claude Code read the same material.

**Edit the canonical file.** A change made here is lost the next time the
pointers are regenerated.

## Why pointers instead of symlinks

Symlinks were tested in this repository and fail — silently, in two independent
ways:

```
git config core.symlinks → false          (Windows default)
ln -s target link        → regular file   (Git Bash copies, no error)
```

A symlinked skill checks out as a text stub and never loads, with nothing
reporting an error. See [`.agents/skills/AGENTS.md`](../../../.agents/skills/AGENTS.md).

## Regenerating the pointers

The descriptions must stay byte-identical to the canonical files. Regenerate
rather than hand-editing:

```bash
for d in .agents/skills/*/; do
  name=$(basename "$d")
  desc=$(sed -n 's/^description: //p' "$d/SKILL.md" | head -1)
  out=".claude/plugins/vigilia/skills/$name"
  mkdir -p "$out"
  # ...write frontmatter + pointer line (see git history for the full script)
done

# verify the sets match
diff <(ls .agents/skills | grep -v AGENTS.md) <(ls .claude/plugins/vigilia/skills)
```

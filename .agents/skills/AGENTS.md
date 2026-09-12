# Skill layout and editing rules

## Where content lives

`.agents/skills/<name>/SKILL.md` is **canonical**. Any harness can read it.

`.claude/plugins/vigilia/skills/<name>/SKILL.md` is a **pointer file** that exists
only to give Claude Code the `vigilia:` namespace. Standalone `.claude/skills/`
entries cannot be namespaced and would collide with personal or third-party
skills of the same name.

## Why pointer files and not symlinks

Symlinks were tested in this repository and **do not work**:

```
git config core.symlinks → false          (Windows default)
ln -s target link        → regular file   (Git Bash copied it, no error)
```

Both failures are silent. A symlinked skill checks out as a text stub and simply
never loads, with nothing reporting an error. The pointer file costs one extra
file read and is immune to this.

**Do not introduce a symlink into tracked content.**

One nuance, so the symlinks you *will* see do not cause confusion: npm creates
real symlinks under `src/web/node_modules/@vigilia/` for the workspace packages,
because it uses the Windows API directly rather than Git Bash's `ln`. Those are
expected, are gitignored, and are not a counter-example — the constraint is that
**git cannot check a symlink out**, which is what breaks tracked ones.

Those links also point at **absolute** paths, so moving or renaming the
repository directory breaks them. Re-run `npm install` in `src/web/` afterwards.

## Editing rules

- **Edit the canonical file.** The pointer file contains frontmatter plus a line
  telling the reader to open the canonical path — it holds no substance.
- Adding a skill means creating **both** files. `vigilia:create-skill` walks
  through it.
- The two sets must match exactly:

  ```bash
  diff <(ls .agents/skills | grep -v AGENTS.md) <(ls .claude/plugins/vigilia/skills)
  ```

## Frontmatter

```yaml
---
name: vigilia:<dir-name>        # must equal the directory name
description: <third person, says WHAT and WHEN, in the words a user would type>
---
```

Discovery depends entirely on `description`. Write the trigger words someone
would actually type, not a summary of the contents.

## Size

Keep each skill well under ~200 lines. Split detail into a sibling
`reference.md` loaded only when relevant. If a capable model already knows it,
cut it — these files are for what it cannot infer.

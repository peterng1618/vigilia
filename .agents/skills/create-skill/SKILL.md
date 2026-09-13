---
name: vigilia:create-skill
description: Guides authoring a new agent skill for the Vigilia repo, including the two-file canonical-plus-pointer layout required because symlinks do not work here. Use when creating, writing or authoring a new skill, or when asked about SKILL.md structure or where skills live in this repo.
---

# Creating a Vigilia skill

Layout and the reasoning behind it: [`.agents/skills/AGENTS.md`](../AGENTS.md).

## Two files, always

Symlinks do not work in this repository (`core.symlinks=false`, and `ln -s`
silently copies). So each skill is:

1. `.agents/skills/<name>/SKILL.md` — **canonical.** All the substance.
2. `.claude/plugins/vigilia/skills/<name>/SKILL.md` — **pointer.** Frontmatter
   plus one line directing the reader to the canonical file.

Forgetting the second file means the skill never loads under the `vigilia:`
namespace, with no error.

### Pointer file template

```markdown
---
name: vigilia:<name>
description: <identical to the canonical file's description>
---

The canonical content for this skill is [`.agents/skills/<name>/SKILL.md`](../../../../../.agents/skills/<name>/SKILL.md).

Read that file and follow it. Do not edit this pointer — it carries no substance.
```

Keep the `description` **byte-identical** between the two files. A divergence
means discovery and content disagree about what the skill is for.

## Frontmatter

```yaml
---
name: vigilia:<dir-name>        # must equal the directory name exactly
description: <third person, states WHAT and WHEN>
---
```

**`description` is the whole discovery mechanism.** Write the words a user would
actually type. Compare:

- Weak: "Guidance for working with providers."
- Strong: "Adds a new sensor provider to Vigilia, including the required
  conformance-test subclass. Use when implementing a provider, adding hardware
  or API sensor support, or asked why a provider's sensors do not appear."

State the trigger conditions, not a summary of the contents.

## Content rules

- **Well under ~200 lines.** Split detail into a sibling `reference.md` loaded
  only when needed.
- **Name the trap.** The single most valuable line in most skills is "this file
  is generated, edit that one instead" or "nothing warns you if you forget
  this." If a skill contains no such line, ask whether it is worth having.
- **Exact commands**, with the directory they run from. `src/web/` and the
  repository root are different working directories here and the distinction
  matters.
- **Cut what a capable model already knows.** No explanations of what SignalR is
  or how `async` works. These files exist for what cannot be inferred from the
  code.
- **One job per skill.** If triggers diverge, that is two skills.
- Prefer a CLI over an integration, and say in the description if an integration
  is required.

## Don't

- Restate what CI or the compiler already enforces — `exactOptionalPropertyTypes`
  covers style; write what static analysis cannot see.
- Duplicate substance between the canonical and pointer files.
- Introduce a symlink.

## After authoring

```bash
# the two sets must match exactly
diff <(ls .agents/skills | grep -v AGENTS.md) <(ls .claude/plugins/vigilia/skills)

# frontmatter name equals directory name, for every skill
for d in .agents/skills/*/; do
  n=$(basename "$d")
  grep -q "^name: vigilia:$n$" "$d/SKILL.md" || echo "MISMATCH: $n"
done
```

Then add the skill to the table in [`AGENTS.md`](../../../AGENTS.md) §3.

**A new session is required to confirm the skill actually loads.** It cannot be
verified from inside the session that wrote it — report it as unverified until a
fresh session lists it.

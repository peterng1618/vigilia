# Agent Environment Setup

A reference methodology for building an agent environment — `AGENTS.md`,
skills, agents, commands — in a repository that has none.

**The principle that governs everything here:** an agent environment earns its
keep by recording *what a capable model cannot infer from the code in front of
it*. It can read the architecture. It cannot know the exact commands, which
files are generated, or where the tooling lies about itself. Spend your budget
there.

---

## 1. Deliverable

```
AGENTS.md                       # the guidance document
CLAUDE.md                       # one line: @AGENTS.md
.agents/skills/<name>/SKILL.md  # canonical, harness-neutral
.agents/skills/AGENTS.md        # skill layout + editing rules
.agents/specs/README.md         # spec convention (only if specs are adopted)
.claude/settings.json           # permissions + plugin registration
.claude/README.md
.claude/plugins/<project>/
  .claude-plugin/plugin.json
  .claude-plugin/marketplace.json
  agents/<name>.md              # → <project>:<name>
  commands/<name>.md            # → /<project>:<name>
  skills/<name>/SKILL.md        # namespaced entry per shared skill
  README.md
```

`.gitignore` additions: the plans directory, `settings.local.json`, and any
build-log filename the docs instruct agents to write.

### Why two locations

`.agents/skills/` is the canonical source, so harnesses other than Claude Code
read the same content. The plugin exists for exactly one reason: to obtain a
`<project>:` namespace. Standalone `.claude/skills/` entries cannot be
namespaced and will collide with personal or third-party skills of the same
name.

Keep exactly one copy of each skill's content. Two mechanisms work:

| Mechanism | When |
|---|---|
| Symlink: plugin entry → canonical file | Symlinks are available and reliable for every contributor |
| Pointer file: frontmatter + "read the canonical file" | Otherwise — notably any repo with Windows contributors |

**Test symlink support before choosing. Do not assume it.** Three independent
things can defeat it, and two fail silently:

```bash
git config --get core.symlinks        # false on Windows by default
ln -s target link && ls -la link     # Git Bash/MSYS may COPY instead of link
```
```powershell
New-Item -ItemType SymbolicLink -Path link -Target target   # needs Developer Mode or admin
```

If git checks a symlink out as a text stub, the skill fails to load and nothing
reports an error. The pointer-file fallback costs one extra file read and is
immune to all of this.

---

## 2. Phase 1 — Reconnaissance

Do this before writing a line. Delegate the sweep if the repo is large, but
**verify every claim you intend to write against the actual file.** A survey is
a lead, not a fact. Commands and hook behaviour are precisely the claims that
turn out subtly wrong, and a confidently wrong command is worse than no
documentation at all.

### Must establish

| Question | Where to look |
|---|---|
| Package manager **and its pinned version** | manifest `packageManager` / `engines`, `preinstall` guards, lockfile |
| Language runtime pins | `.nvmrc`, `.sdkmanrc`, `.tool-versions`, Dockerfiles |
| **Default branch** | `git symbolic-ref refs/remotes/origin/HEAD` — never assume `main` |
| Exact install / build / run / test / lint / typecheck commands | manifest scripts, `Makefile`, CI workflow files |
| Which commands require infrastructure | compose files, CI service containers |
| Commit convention, and whether it is **enforced** | commitlint config, hook scripts, CI title checks |
| PR body template | the repo's PR template file |
| Issue tracker | CONTRIBUTING, workflow files, recent merged PR bodies |
| Lint rules deliberately **off** or at `warn` | linter config |
| Test layers and the location of each | test configs, where existing tests actually live |
| Schema migration tool and layout | migration directories, build files |
| Localization pipeline and its generated outputs | locale directories, generation scripts |
| Source-file header convention | sample files — measure the real ratio, don't eyeball one file |
| Existing agent config | `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, copilot instructions |

### Hunt for traps specifically

This is the highest-value output of the phase. Each of these is invisible in
the code and expensive to learn by collision:

- **Hooks that do not do what their name implies.** Read every hook line by
  line. A commented-out `lint-staged`, or a guard function defined and never
  called, means nothing is checked before commit — while the contributor docs
  still claim it is.
- **Whether hooks are installed at all** in a fresh checkout. If dependencies
  are absent there is no hook path, and a non-conforming commit sails through.
- **Lint invoked with a quiet flag.** Every rule set to `warn` is then absent
  from CI output, which silently converts "downgrade to warn" into deleting the
  rule while appearing to keep it.
- **Generated files that are also lint-ignored or VCS-ignored.** Hand-editing
  them fails silently and the edit disappears at the next regeneration.
  Enumerate every one and pair it with the source to edit instead.
- **Destructive behaviour behind an innocuous name** — a `clean` target that
  recursively force-deletes untracked files, for instance.
- **Commands that publish, upload, or record** — a hardcoded cloud key in an
  E2E script, a telemetry beacon in a hook. These must be surfaced loudly.
- **Scripts that contradict the repo's own rules** — a call to a forbidden
  package manager inside a project that enforces a different one.
- **Interactive targets** that block a non-interactive session.
- **Setup steps with hidden preconditions** — an install hook that assumes the
  checkout directory's name, for example.

### Establish blast radius

Ask: *which changes here are disproportionately dangerous, and why?* Recurring
answers:

- A package consumed by both client and server, so one edit ships to both
- A wire protocol or persisted format that must stay compatible with
  already-deployed clients
- Migrations that run once, unattended, on installations nobody can inspect
- A published API contract with third-party consumers
- Generated artifacts, where a hand-edit is silently reverted

This becomes a section in `AGENTS.md` and supplies the risk ordering used by
the review and triage tooling.

---

## 3. Phase 2 — Decisions to put to the user

Ask before authoring. These change the output and are not yours to choose.

1. **Skill layout** — canonical source plus namespaced plugin, or plain
   harness-local skills. Present the Phase 1 symlink finding as part of this
   question, since it may rule out the preferred option.
2. **Issue tracker** — determines whether skills reference a tracker
   integration, a CLI, or stay tracker-agnostic.
3. **Review infrastructure** — is there an AI reviewer with its own config
   format, or should review guidance live in a skill?
4. **Specs** — adopt a tracked spec directory, or throwaway plans only?

Pick the obvious default for everything else, and say what you chose.

If the environment later makes a chosen option unworkable, do not silently
substitute. Say so, propose the closest alternative, and record the reason in
the repo so the next person does not "fix" it back.

---

## 4. Phase 3 — Authoring

### The guidance document

One document. Reduce `CLAUDE.md` to `@AGENTS.md` so every harness reads the
same file. Suggested order:

1. **Project overview** — two or three sentences; name the languages and say if
   it is a monorepo or polyglot.
2. **General guidelines** — package manager, toolchain pins, header
   convention, default branch, tracker, destructive-command warnings.
3. **Agent skills** — where they live, how to invoke, links to the detail.
4. **Specs** — if adopted, and how they differ from throwaway plans.
5. **Essential commands** — install, build, run, test, quality, schema. Give
   the exact invocation, the directory it runs from, and any prerequisite. Mark
   which need infrastructure and which are interactive.
6. **Architecture** — a table of packages/directories, one line of purpose
   each, and explicitly which directories sit *outside* the workspace.
7. **Technology stack** — versions, and any place where several solutions
   coexist.
8. **Key architectural patterns** — numbered, each pointing at concrete
   directories.
9. **Key development patterns** — the generated-files table **first**; then
   language rules, localization, frontend, testing; then a worked
   "implementing a feature" sequence in dependency order.
10. **Design principles** — public-repo security-fix hygiene, confidentiality,
    licensing.
11. **VCS guidelines** — commit convention, PR template sections, target
    branch, what CI runs.

Keep it dense. Every line should be something an agent would otherwise get
wrong.

### Skill set

Universally worth having:

| Skill | Substance |
|---|---|
| `conventions` | Quick reference: the critical rules and gotchas, linking back to the main document |
| `create-pr` | Title convention, the repo's own body template, security-fix hygiene |
| `code-review` | What to look for that static analysis cannot see, split by area |
| `reproduce-bug` | Routing table: area → test layer → location → command |
| `create-skill` | Authoring rules, so the set can grow correctly |

Adopt where the repo has the surface:

| Skill | Adopt when |
|---|---|
| localization | Text flows through a pipeline with generated outputs |
| migrations | A schema-migration tool exists |
| design system | A component library or token system exists |
| spec-driven development | Specs are adopted |
| public API | A versioned external contract exists |
| telemetry | A typed event registry exists to hang it on |

Agents and commands: a **developer** agent that encodes the conventions, plus a
**read-only issue triager** and a slash command to drive it, are high-value and
near-universal. Keep the triager read-only — it produces an analysis, and the
human decides what gets posted.

### Skill authoring rules

- `name: <project>:<dir-name>` in frontmatter, matching the directory name.
- Description in the third person, stating **what** and **when**, using the
  words a user would actually type. Discovery depends entirely on this.
- Well under ~200 lines. Split detail into a sibling `reference.md` or a
  `rules/` directory loaded only when relevant.
- Give exact commands, with the directory they run from and any redirect.
- **Name the trap.** The single most valuable line in most skills is "this file
  is generated, edit that one instead" or "nothing warns you if you forget
  this."
- One job per skill. Diverging triggers mean two skills plus a thin parent.
- Prefer a CLI over an integration. If an integration is required, say so in
  the description and give a fallback for when it is absent.

### Porting from an existing setup

The discipline that matters is **separating substance from mechanism.** A rule
set written for one specific AI reviewer — with that tool's config format,
character budgets, and CI validator — is mostly mechanism. The policy
underneath is frequently the most valuable material available, and it dies with
the source. Extract the policy; discard the plumbing.

Classify each candidate:

- **PORT** — works nearly as-is. Framework-agnostic interaction and interface
  guidelines, generic testing policy, container hygiene, ratchet/baseline
  policy.
- **ADAPT** — the concern is real, the specifics are foreign. Rewrite it
  against this repo's actual seams, not the source's.
- **SKIP** — inseparable from the source's product, organisation, or vendor
  tooling. Anything that phones home to the source project is dropped outright,
  not sanitised.

Two rules that prevent most bad ports:

- Do not port infrastructure whose consumer does not exist here.
- Do not keep a rule that only restates what this repo's CI already fails on.

When a source rule set is about to be deleted, capture the substance **before**
deletion even if you are unsure you want it. Distilling is cheap; recovering a
deleted rule set is not.

---

## 5. Phase 4 — Verification

Mechanical:

```bash
# every JSON file parses
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"

# canonical and namespaced skill sets match exactly
diff <(ls .agents/skills | grep -v AGENTS.md) <(ls .claude/plugins/<project>/skills)

# every relative markdown link resolves
# every frontmatter name is <project>:<directory-name>
# every skill is under its size budget
```

Substantive:

- **Re-verify the load-bearing claims** — each command, each hook behaviour,
  each generated-file path — against the file, not against your notes.
- **Confirm the plugin actually loads and the names resolve.** Start a fresh
  session and check that the skills, agents, and commands are listed. This
  cannot be verified from inside the session that wrote them, so report it as
  unverified until a new session confirms it.

---

## 6. Anti-patterns

- **Trusting a survey over the file.** Verify before writing.
- **Documenting the happy path only.** The traps are the value.
- **Restating what CI already enforces.** Write what static analysis cannot
  see.
- **Duplicating skill content** across harness directories.
- **Porting a rule because it existed upstream**, with no consumer here.
- **Assuming symlinks** instead of testing them.
- **Encyclopedic skills.** If a capable model already knows it, cut it.
- **Silently deviating from a user's decision** when the environment blocks it.
- **Claiming verification you did not perform** — especially "the plugin
  loads," which requires a new session.

---

## 7. Per-project checklist

- [ ] Phase 1 reconnaissance complete, every claim verified against the file
- [ ] Trap list assembled — hooks, generated files, destructive and publishing
      commands, quiet lint, interactive targets, hidden preconditions
- [ ] Blast-radius areas identified
- [ ] Phase 2 decisions put to the user
- [ ] Symlink support tested; content-sharing mechanism chosen
- [ ] Guidance document + `CLAUDE.md` pointer written
- [ ] Universal skills written; conditional ones assessed against the repo
- [ ] Developer agent, read-only triager agent, and commands
- [ ] `settings.json`, plugin manifests, READMEs
- [ ] `.gitignore` updated for scratch paths
- [ ] Mechanical verification passes
- [ ] Fresh session confirms the plugin loads and names resolve

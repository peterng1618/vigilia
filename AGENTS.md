# AGENTS.md — Vigilia

This file defines how coding agents should operate in this repository.

It is the operating manual only. **What the project is, how it fits together and
why it is that way are recorded elsewhere** — see [Where to record
what](#where-to-record-what). Keep it that way: an instruction belongs here, a
fact about the design does not.

## Project

- Repository: `peterng1618/vigilia`, default branch `main`, remote `origin`
- Language: **TypeScript throughout** (7.0.2) — shared renderer, player, editor
  *and* host. No component framework
- Package manager: **npm** (11.x). No `packageManager` field is pinned
- Runtime: Node **22.12+, 24, or 26+** per vitest 5's `engines`
- Workspace: **one**, at `src/web/`, six packages. **There is no second
  toolchain — do not install a .NET SDK or Python to unblock anything**
- Test stacks: `vitest` (unit) and `playwright` (browser)
- Issue tracker: none. Keep skills tracker-agnostic

## Repository priorities

- Keep changes focused and minimal. Avoid broad refactors unless asked.
- **Nothing is declared twice.** Every concept has exactly one home and every
  consumer imports it from there. Before adding a type, constant, enum, label,
  shortcut, route, key name, style property, default or helper: grep for it — by
  name, by value, and by the concept's other likely spellings. If it exists,
  import it; if it is in the wrong place, move it and repoint the existing caller
  **in the same commit**. If it is genuinely new, record its owner in
  [`.agents/architecture.md`](.agents/architecture.md)'s ownership registry.
  Two declarations agree when written and drift later with nothing to warn
  anyone, which is why this outranks the rest; what it has cost here before is
  in [`.agents/lessons.md`](.agents/lessons.md).
- **Prefer a mechanism to a reminder.** A comment saying "keep these in sync"
  *is* the defect. Derive one from the other, key a `Record` by a union so the
  compiler forces exhaustiveness, or add an assertion.
- **An owner nothing imports is not an owner.** Point every consumer at a new
  owner in the same commit and add a test binding them.
- Prefer fixing root causes over adding workarounds.
- **Report untested behaviour plainly.** A ticked checkbox without observable
  behaviour and a test is not a pass. Say what you did not verify.
- Preserve existing architecture and naming style.

## Making a change, in order

1. **If a shape changes, change it once**, in the package that owns it — see
   `architecture.md`'s ownership registry. Never add a second declaration.
2. **If it is persisted**, update the schema and decide whether the schema
   version must bump. A theme already saved must keep loading.
3. **Implement behind the boundary it belongs to**, pure half and I/O half kept
   apart.
4. **Add tests at the layer above.** For a provider, extend the conformance
   suite rather than writing a bespoke test.
5. **Run `vigilia:verify`.**
6. **Record** measurements and decisions where [Where to record
   what](#where-to-record-what) says, and update `status.md` before committing.

## Setup

```bash
cd src/web
npm install          # also regenerates package-lock.json
```

## Common commands

Run from **`src/web/`**. Prefer these npm scripts over hand-written `tsc` or
`vite` invocations — they derive the project list from the workspace, so adding
a package cannot leave a stale copy behind.

| | |
|---|---|
| Unit tests | `npm test` |
| Typecheck (every project) | `npm run typecheck` |
| Build everything | `npm run build` |
| Build one bundle | `npx vite build packages/player` (or `editor`, `host`) |
| Size gate | `npm run size` — needs a player build first |
| Browser tests | `npm run test:e2e` — needs the player **and** editor builds first |
| Run the host | `node packages/host/bin/vigilia.js --no-browser` — needs all three builds |
| Watch a bundle | `npx vite dev packages/player` (or `editor`) |

The full pre-commit order, and why it is that order, is `vigilia:verify`.

No command here requires infrastructure, and none is interactive.

### The host

Part of the same workspace, so there is no separate build root. Binds
`127.0.0.1:5227` by default.

```bash
node packages/host/bin/vigilia.js --help
node packages/host/bin/vigilia.js --no-browser      # loopback only
node packages/host/bin/vigilia.js --host 0.0.0.0    # let phones connect
```

The published binary is **`vigilia-dashboard`**, never plain `vigilia` — that
name belongs to an unrelated package on the registry and fetches a stranger's
CLI.

## Traps

Tooling that misleads. Everything here cost real time at least once.

- **The host is built, and refuses to start unbuilt.** `bin/vigilia.js` is a
  shim over `dist/main.js`. Node 23.6+ can strip TypeScript, but stripping is
  not resolution, and `renderer-core` is consumed as source with `.js`
  specifiers Node cannot resolve from `.ts` files.
  `packages/host/vite.config.ts` explains this at length; do not "simplify" it
  away.
- **Playwright previews *built* bundles**, so a source change is invisible until
  you rebuild — and **every bundle a suite exercises must be built**, not just
  the player. A missing build surfaces as a preview server that never comes up,
  which reads like a Playwright fault and is not one. Read
  `playwright.config.ts` for the current `webServer` list rather than assuming
  there is one.
- **Rebuild after reverting an experiment.** Breaking a guard to prove a test
  catches it leaves `dist/` holding the broken build; the next Playwright run
  previews the sabotaged bundle and fails somewhere unrelated.
- **Missing or outdated browser:** `npx playwright install chromium` (~115 MB).
  The error names a version directory such as `chromium_headless_shell-1243`;
  an older one on disk will not be used.
- **Screenshot capture needs `VIGILIA_CAPTURE=1` *and* `--workers=1`.** Without
  the second, the desktop and phone projects write the same directory
  concurrently and Windows fails the open with `UNKNOWN`. See
  `vigilia:gate-evidence`.
- **Node 25 warns and works.** vitest 5 declares `^22.12 || ^24 || >=26`; you
  get `EBADENGINE` and a passing suite. Do not chase it, and do not downgrade.
- **Vite 8 bundles with rolldown, not rollup.** `manualChunks` must be a
  **function**; the object form fails with `manualChunks is not a function`.
- **`URL.pathname` on Windows** yields `/D:/…` and silently breaks `fs`. Use
  `fileURLToPath`.
- **Symlinks do not work here** — `core.symlinks=false`, and `ln -s` silently
  copies. Never introduce one.
- **Bare ignore rules match at any depth**, and this repo has been bitten twice:
  `data/` untracked `renderer-core/src/data/`, and `bin/` untracked the one file
  the host cannot start without.

## Testing expectations

| Layer | Location | Command |
|---|---|---|
| Unit | `src/web/packages/*/src/**/*.test.ts` | `npm test` |
| Browser / visual | `src/web/tests/e2e/*.spec.ts` | `npm run test:e2e`, after the builds |

- Add or update tests for behaviour changes. Unit-test the pure half; a decision
  that needs a browser to test is a sign it is in the wrong layer.
- **Disable the fix and re-run before believing a test.** A test that passes
  with its own fix removed is asserting the bug.
- **When in doubt, render it and look.** Most defects worth fixing here were
  found by driving a browser, several of them under a fully green suite.
- Adding a provider means **extending the host's provider tests**, not writing
  bespoke ones.
- **Test counts are deliberately not recorded in this file.** They moved by
  hundreds within single milestones and every stale number invited a wrong
  conclusion. Current figures live in
  [`.agents/status.md`](.agents/status.md), and each must have been printed by a
  command that actually ran.

## Code style

- Follow existing project style and patterns. Match the surrounding comment
  density and naming.
- Avoid unrelated formatting-only diffs in touched files; keep imports stable.
- No licence headers in source files.
- Do not leave re-export wrapper files behind after a move, and do not add a
  barrel to shorten an import. The one sanctioned barrel is a package's public
  surface.
- `helpers/`, `common/`, `utils/`, `internal/` and `shared/` are not used as
  folder names. If a generic word is the only name that fits, the file's role
  has not been decided yet.
- **500 lines is a signal, 800 is a stop.** A test enforces the ceiling with an
  explicit allowlist; prefer splitting to allowlisting.
- **`tsconfig.base.json` enables `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess`.** Two consequences bite immediately: passing an
  explicit `undefined` to an optional property is a *different type* from
  omitting the key, so construct the object without the key; and every indexed
  access is `T | undefined`, so use `arr[0]!` when the index is known good.
- **Refuse rather than coerce.** A number input reports `''` for anything it
  cannot parse and `Number('') === 0`, so coercion commits zeros.

### Files you must not hand-edit

| Do not edit | Do instead |
|---|---|
| `src/web/package-lock.json` | Change `package.json`, then `npm install` |
| `src/web/packages/*/dist/**` | Build output, gitignored |
| `.claude/plugins/vigilia/skills/*/SKILL.md` | Pointer files. Edit `.agents/skills/<name>/SKILL.md` |
| `.agents/design/environment-setup.md` | User-authored. Propose changes; do not rewrite |

### Dependencies

Before proposing one, add it to `THIRD-PARTY-NOTICES.md` with its licence
**verified from the package's own metadata or LICENSE file**, not from a search
summary. CI derives the dependency list from the workspace manifests and fails
if an entry is missing. Do not modify vendored MPL/LGPL files.

## Where to record what

All prose lives in [`.agents/`](.agents). There is no `docs/` directory and no
user-facing documentation.

| Write this | There |
|---|---|
| Current state, next work, what is **not** verified | `.agents/status.md` — goes stale on purpose; every figure from a command that ran |
| How the pieces fit, and **which file owns which concept** | `.agents/architecture.md` |
| What a feature should do, and its edge cases | `.agents/specs/` (`archive/` once closed and frozen) |
| A decision, its context, its consequences | `.agents/decisions.md` — **current position only**; a reversed decision is rewritten in place, not kept alongside |
| A measurement or observation | `.agents/decisions.md`, append-only (`vigilia:gate-evidence`) |
| What cost time here, as a rule rather than an anecdote | `.agents/lessons.md` |
| Product goals and requirements | `.agents/design/plan.md` — **agent-owned**; keep it current |

**`§N` markers** in code and prose — `§93`, `§122` — are stable labels in
`plan.md`, **not line numbers**. Add a new requirement with the next free
number; **never renumber**.

## Commit and PR workflow

- **Update [`.agents/status.md`](.agents/status.md) before every commit and
  push** — figures, what is next, what is not verified. One file, updated by
  whoever is about to push, with numbers from a run they actually did.
- **Conventional Commits** for titles: `feat`, `fix`, `docs`, `refactor`,
  `test`, `ci`, `chore`. Not enforced by any hook or CI check — there are no git
  hooks in this repo.
- Target `main`. There is no PR template. Use `vigilia:create-pr`.
- **CI must build every bundle Playwright previews.** It starts every
  `webServer` in the config regardless of which project runs, and `dist/` is
  gitignored — so a new preview target needs its build step added to the
  frontend job *in the same commit*, or CI fails on a server that never comes up.
- **Propagate a consequence in the same commit.** A change that contradicts this
  file, a skill, a package comment, a source comment or a **test** leaves the
  contradiction live until those are fixed too.

## Git safety

- **Assume you are not the only agent in this working tree.** `git status`
  before staging, every time. Stage explicit paths; **never `git add -A` or
  `git commit -a`**. Someone else's half-finished work committed under your
  message is the one mistake here that is genuinely expensive to unpick.
- Never discard user changes unless explicitly asked, and do not use destructive
  git commands without explicit instruction.
- Pushing and opening a PR are real actions with external effect.

## Review boundary

Seek human review for **scope expansion, anything with external effect**
(publishing, LAN exposure, the licence) **and product taste**. Architecture,
schema design and sequencing do not need it — those are yours.

## In-repo skills

Canonical content lives in [`.agents/skills/`](.agents/skills) so any harness
reads the same files; Claude Code also loads them through a plugin at
`.claude/plugins/vigilia/` purely to obtain the `vigilia:` namespace. **Each
skill has two files** — canonical plus a plugin pointer — because symlinks do
not work here. **Edit the canonical one.** Layout rules:
[`.agents/skills/AGENTS.md`](.agents/skills/AGENTS.md).

Invoke as `vigilia:<name>`.

| Skill | Use when |
|---|---|
| `vigilia:verify` | Checking work before committing — the full gauntlet, in the order that works |
| `vigilia:code-review` | Reviewing a diff for what static analysis cannot see |
| `vigilia:create-pr` | Opening a PR |
| `vigilia:write-adr` | Recording a decision, or choosing between a decision, a spec and a gate entry |
| `vigilia:gate-evidence` | Re-capturing screenshots, or recording a measurement |
| `vigilia:spec-driven-development` | Implementing a feature that has a spec |
| `vigilia:create-skill` | Adding a skill |

## Skill trigger guidance

- About to commit or push → `vigilia:verify` first.
- Asked to review a diff, a branch or your own change → `vigilia:code-review`.
- Asked to open or prepare a PR → `vigilia:create-pr`.
- Choosing between options with lasting consequences, or reversing an earlier
  choice → `vigilia:write-adr`.
- Recording a number you measured, or refreshing screenshots →
  `vigilia:gate-evidence`.
- Implementing something with a file in `.agents/specs/` →
  `vigilia:spec-driven-development`.

## Communication

- Be concise and factual.
- Surface assumptions and blockers early.
- When something cannot be verified locally, state that clearly rather than
  implying it passed.

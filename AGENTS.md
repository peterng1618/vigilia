# AGENTS.md — Vigilia

Guidance for coding agents. Read this before changing anything.

This file records **what you cannot infer from the code in front of you**: exact
commands, which files lie about themselves, and where the tooling misleads. It
deliberately does not explain the architecture you can read.

---

## 1. Project overview

Vigilia is a PC-hosted website for live hardware monitoring over local Wi-Fi. A
desktop browser runs a full design editor; phones each display one assigned
dashboard. Windows-first, MIT, **personal-use-first** — optimise for development
speed over release polish.

**TypeScript throughout** — shared renderer, display-only player, editor *and*
the host. One npm workspace at `src/web/`. The host was C# (.NET 10), then
briefly a Python draft; [ADR-0007](.agents/decisions.md)
settled it as Node/TypeScript shipped as the `vigilia-dashboard` CLI, and the `src/Vigilia.*`
C# tree is slated for deletion. **Do not install a .NET SDK or Python to unblock
anything** — neither is required any more.

**The design document is the spec:** [`.agents/design/plan.md`](.agents/design/plan.md)
(revision 9). Section markers throughout the code — `§93`, `§122` — point into
it. It is **user-authored: do not rewrite its prose.** It still uses the old
project name; that is intentional and not a bug to fix.

## 2. General guidelines

| | |
|---|---|
| Package manager | **npm** (11.x). No `packageManager` field is pinned |
| Node | **22.12+, 24, or 26+** per vitest 5's `engines`. Node 25 is outside that range but **works** — verified 2026-09-12, full suite on v25.9.0. npm warns; nothing fails unless `engine-strict` is set. Do not waste time downgrading |
| .NET SDK | **10.0.100**, pinned in `global.json` (ADR-0002) |
| Default branch | `main`, pushed to `origin` (`github.com/peterng1618/vigilia`). History exists; `git log` is authoritative |
| Issue tracker | None. Keep skills tracker-agnostic |
| Source headers | None. Do not add licence headers to files |
| Symlinks | **Unavailable** — `core.symlinks=false` and `ln -s` silently copies. Never introduce one |

**Before proposing a dependency**, add it to `THIRD-PARTY-NOTICES.md` with its
licence verified from the package's own metadata or LICENSE file — not from a
search summary. CI fails if a known dependency is missing there.

### The one rule above the others: nothing is declared twice

**Every concept has exactly one home. Search before you add.**

A name, shape, rule, constant, default or list must exist in one place, and
every consumer must import it from there. This is not a style preference — it
is the defect class that has cost this project more than all others combined,
and it always presents the same way: two declarations agree at the moment they
are written, drift later, and nothing warns anyone. The compiler cannot see it,
tests keep passing on both sides, and the symptom surfaces somewhere unrelated.

Before adding a type, constant, enum, label, shortcut, route, key name, style
property, default value or helper:

1. **Grep for it.** By name, by value, and by the concept's other likely
   spellings. A duplicate almost always already exists under a different name.
2. **If it exists, import it.** If it exists but is unexported or in the wrong
   package, move it and point the existing caller at it — in the same commit.
3. **If it is genuinely new, decide its owner before writing it**, and record
   that owner in [`.agents/architecture.md`](.agents/architecture.md)'s ownership
   registry.

Two corollaries, both learned the hard way:

- **An owner nothing imports is not an owner.** Creating a module that declares
  the canonical vocabulary, while a consumer keeps its own hand-typed copy,
  achieves nothing — the two had already drifted on a label within the hour.
  Point every consumer at a new owner in the same commit, and add a test that
  binds them. Until that test exists, the work is not done.
- **Prefer a mechanism to a reminder.** A comment saying "keep these in sync" is
  the defect, not the guard. Derive one from the other, key a `Record` by the
  union so the compiler forces exhaustiveness, or add an assertion — the
  patterns already here are `theme/schema-sync.test.ts` and
  `npm run typecheck`'s workspace-derived project list.

The severity axis is **whether anything catches it**. Duplicated but
compiler-checked is usually fine; duplicated, stringly-typed and unguarded is
the real thing. [`.agents/architecture.md`](.agents/architecture.md) records which
concepts have owners today and which known gaps remain.

## 3. Agent skills

Canonical content lives in [`.agents/skills/`](.agents/skills) so any harness
reads the same files. Claude Code additionally loads them through a plugin at
`.claude/plugins/vigilia/` purely to obtain the `vigilia:` namespace.

Invoke as `vigilia:<name>`:

| Skill | Use when |
|---|---|
| `vigilia:conventions` | Quick reference for the rules and traps below |
| `vigilia:verify` | Checking work before committing — the full gauntlet, in the order that works |
| `vigilia:code-review` | Reviewing a diff for what static analysis cannot see |
| `vigilia:gate-evidence` | Re-capturing screenshots, or recording a gate measurement |
| `vigilia:write-adr` | Recording a decision, or choosing between an ADR, a spec and a gate entry |
| `vigilia:create-pr` | Opening a PR |
| `vigilia:spec-driven-development` | Implementing a feature that has a spec |
| `vigilia:create-skill` | Adding a skill |

Layout and editing rules: [`.agents/skills/AGENTS.md`](.agents/skills/AGENTS.md).
**Each skill has two files** (canonical + plugin pointer) because symlinks do not
work here. Edit the canonical one.

## 4. Where the writing lives

**All of it is in [`.agents/`](.agents).** There is no `docs/` directory and no
user-facing documentation — Vigilia is personal-use-first and far too immature
for either. Five files and three directories, each with one job:

| Location | Holds | Goes stale? |
|---|---|---|
| `.agents/status.md` | Current state, next work, what is **not** verified | **Yes, on purpose.** Every figure must come from a command that ran |
| `.agents/architecture.md` | How the pieces fit, and **which file owns which concept** | No |
| `.agents/specs/` | Per-feature intended behaviour, kept in sync with the code | No |
| `.agents/specs/archive/` | Specs whose feature is done and closed | Frozen |
| `.agents/decisions.md` | ADRs — a decision, its context, its consequences | Immutable once accepted |
| `.agents/decisions.md` | Gate evidence — measurements and observations, append-only | No |
| `.agents/lessons.md` | What cost time here, as rules rather than anecdotes | No |
| `.agents/design/` | The product spec and environment notes, **user-authored** | Not ours to edit |
| `.agents/skills/` | Agent skills, invoked as `vigilia:<name>` | No |

A spec is durable and committed; a plan is throwaway. A **superseded** decision
keeps its file as a stub naming what replaced it, with the dead reasoning
removed rather than left to read as current guidance — and where a decision
changed several times, only the final position and its reasoning are recorded.

## 5. Essential commands

### Frontend — run from `src/web/`

```bash
npm install                                      # also regenerates package-lock.json
npx vitest run                                   # unit tests
npx tsc --noEmit -p packages/renderer-core/tsconfig.json
npx tsc --noEmit -p packages/player/tsconfig.json
npx tsc --noEmit -p packages/fake-source/tsconfig.json
npx tsc --noEmit -p packages/editor/tsconfig.json
npx tsc --noEmit -p packages/host/tsconfig.json
npx vite build packages/player                   # display-only bundle
npx vite build packages/editor                   # desktop authoring bundle
npx vite build packages/host                     # Node bundle for the CLI
node packages/host/bin/vigilia.js --no-browser   # run the host; needs all three builds
node packages/player/scripts/check-size.mjs      # §47 budget gate; needs a build first
npx playwright test                              # browser tests; needs BOTH builds first
npx vite dev packages/player                     # watch the demo dashboard live
npx vite dev packages/editor                     # watch the editor live
```

**Test counts are deliberately not recorded here.** They moved by hundreds
within single milestones and every stale number invited a wrong conclusion. The
current figures live in [`.agents/status.md`](.agents/status.md), and every one
of them must have been printed by a command that ran. `vigilia:verify` is the
routine to run before committing.

**There are five typecheck projects.** `packages/editor` and `packages/host`
are both easy to forget; CI checks all five, so omitting one locally means CI
finds the error instead of you.

**The host is built, and it refuses to start unbuilt.** `bin/vigilia.js` is a
shim over `dist/main.js`. Node 23.6+ can strip TypeScript, but stripping is not
resolution — `renderer-core` is consumed as source and imports with `.js`
specifiers, which Node cannot resolve from `.ts` files. `packages/host/vite.config.ts`
says so at length; do not "simplify" it away.

**`npx playwright test` previews *built* bundles**, so a source change is
invisible until the bundle is rebuilt — and **every bundle a suite exercises
must be built first**, not just the player. Playwright starts the preview
servers itself, each bound to `127.0.0.1` explicitly, because Vite otherwise
binds `localhost`, which resolves to `::1` first on Windows and then never
answers. Read `playwright.config.ts` for the current server list and ports
rather than assuming one server: a missing build surfaces as a preview server
that will not come up, which reads like a Playwright fault and is not one.

If the browser is missing or its build is too old for the installed Playwright,
`npx playwright install chromium` fixes it (~115 MB). The error message names a
version directory such as `chromium_headless_shell-1243`; an older one present
on disk will not be used.

### Host — also from `src/web/`

The host is part of the npm workspace, so there is no second toolchain and no
separate build root. It binds `127.0.0.1:5227` by default.

```bash
node packages/host/bin/vigilia.js --help
node packages/host/bin/vigilia.js --no-browser           # loopback only
node packages/host/bin/vigilia.js --host 0.0.0.0         # let phones connect
```

**The `dotnet` commands that used to be here are gone**, along with the reason
they never worked. `Vigilia.slnx` and `src/Vigilia.*` are still on disk and
still have never compiled; they are slated for deletion per ADR-0007. Do not
install an SDK to revive them.

No command here requires infrastructure, and none is interactive.

## 6. Architecture and stack

**Structure, boundaries and the ownership registry are in
[`.agents/architecture.md`](.agents/architecture.md).** Read it before adding
any type, constant or rule — that is where §2's "does this already have a home"
gets answered.

The short version: one npm workspace at `src/web/` with five packages.
`renderer-core` is shared and owns every shape both ends read; `player` is
display-only; `editor` adds interaction over the renderer; `host` is the Node
CLI; `fake-source` is dev-and-test only and must never become a runtime
dependency of anything shipped.

**`src/Vigilia.*` is dead** — never compiled, slated for deletion, needs no SDK.

Node 22+ · TypeScript 7.0.2, no component framework · ECharts 6.1.0 · Vite 8 ·
vitest 5 · Playwright 1.63. **The host has no runtime dependencies**: `node:http`
to serve, SSE for the stream, `node:os` for telemetry. LibreHardwareMonitor is an
external prebuilt executable read over HTTP, not a linked library.

Four rules that outrank convenience:

1. **Providers acquire; the host schedules.** No timers, no cached history, no
   pushing from inside a provider — that is what makes "a second phone must not
   double upstream polling" (§111) a property of one scheduler.
2. **Themes bind to semantic keys, never to provider instances** (§93).
3. **Typed chart settings only.** Raw ECharts options never enter the theme
   format. There is exactly one engine-boundary cast, in `player/src/main.ts`;
   if it appears in feature code the boundary has been breached.
4. **Status before value.** A non-`Ok` sample carries no value, and a missing
   one renders as a **gap, never a zero** (§83).


## 7. Key development patterns


### Files you must not hand-edit, and what to edit instead

| Do not edit | Edit / do instead |
|---|---|
| `src/web/package-lock.json` | Change `package.json`, then run `npm install` |
| `src/web/packages/player/dist/**` | Build output. Gitignored |
| `.claude/plugins/vigilia/skills/*/SKILL.md` | Pointer files. Edit `.agents/skills/<name>/SKILL.md` |
| `.agents/design/plan.md` | User-authored spec. Propose changes; do not rewrite |
| `.agents/design/environment-setup.md` | User-authored methodology. Same |

### The mirror is gone — do not recreate it

`src/Vigilia.Contracts/*.cs` was hand-mirrored in
`renderer-core/src/types.ts`, and this file used to call it the highest-risk
edit in the repository. **ADR-0007 removed the mirror rather than guarding it
better**: the host is TypeScript and imports `types.ts` directly, so the class
of bug — a change that compiles cleanly on both sides and produces wrong values
at runtime — no longer has anywhere to live.

Two consequences worth knowing:

- **The wire contract lives in the shared library**, at
  `renderer-core/src/data/protocol.ts`, because the host *and* every display
  import it. Do not define a message shape in `packages/host` and a reader for
  it in a display — that is the mirror again, rebuilt.
- `renderer-core/src/contracts-mirror.test.ts` still parses the `.cs` files and
  passes. **Its subject is dead code**; delete it with the C# tree.
  `theme/schema-sync.test.ts` is unaffected and still earns its place — it
  guards `schema/theme-document.schema.json` against the validator, and that
  schema is a persisted format with real old files behind it.

### Blast radius, in order

1. `renderer-core/src/types.ts` and `data/protocol.ts` — the sample and wire
   contracts, now single-sourced and imported by the host, both displays and
   the editor. Compiler-checked, so a break is loud; but it is still the
   widest-reaching file here.
2. `schema/theme-document.schema.json` — the persisted format. Themes already
   saved must keep loading; bump `schemaVersion` and fail unsupported versions
   without touching the library (§141).
3. `renderer-core` — shared by editor *and* player; a stray dependency breaks the
   player's budget.
4. `ISensorProvider` — every provider plus the conformance suite.

### TypeScript

`tsconfig.base.json` enables `exactOptionalPropertyTypes` and
`noUncheckedIndexedAccess`. Two consequences that bite immediately:

- Passing an explicit `undefined` to an optional property is a **different type**
  from omitting the key. Construct the object without the key.
- Every indexed access is `T | undefined`. Use `arr[0]!` when the index is known
  good.

### Testing

| Layer | Location | Command |
|---|---|---|
| Renderer unit | `src/web/packages/*/src/**/*.test.ts` | `npx vitest run` from `src/web/` |
| E2E / visual | `src/web/tests/e2e/*.spec.ts` | `npx playwright test` from `src/web/`, **after the player *and* editor builds** |

**Adding a provider means extending the host's provider tests**, not writing
bespoke ones — and asserting a non-`ok` sample carries no `value` key at all.

### Implementing a feature, in dependency order

1. If a shape changes, change it **once**, in the shared library. The wire
   contract is `renderer-core/src/data/protocol.ts` and the semantic key
   vocabulary is `renderer-core/src/data/semantic-keys.ts`; the host and every
   display import both. Do not add a second declaration — see §9's "The mirror
   is gone", which this step used to contradict by telling you to edit
   `src/Vigilia.Contracts` and `types.ts` together.
2. If persisted, update `schema/theme-document.schema.json` and decide whether
   `schemaVersion` must bump.
3. Implement behind the provider or renderer boundary it belongs to.
4. Add tests at the layer above; for providers, extend the conformance suite.
5. Run the frontend commands in §5; run the .NET ones if an SDK exists.
6. Record measurements in `.agents/decisions.md`, decisions in `.agents/decisions.md`.

## 8. Design principles

- **Report untested behaviour.** A ticked checkbox without observable behaviour
  and a test is not a pass (§33). Say plainly what you did not verify.
- **Never fabricate a reading.** Report the capability you have; an unavailable
  sensor is `Unavailable` with a reason, not a zero (§97).
- **Secrets** go through `ISecretStore`, are redacted in errors, and never appear
  in browser responses or exported packages (§101, §143).
- **Plain LAN HTTP has no confidentiality.** Trusted networks only; never
  suggest internet exposure.
- Licences: MIT project, but MPL-2.0 / LGPL-2.1 / Apache-2.0 dependencies require
  notices to survive into distributed packages. Do not modify vendored
  MPL/LGPL files.

## 9. VCS guidelines

- **Update [`.agents/status.md`](.agents/status.md) before every commit and
  push.** Figures, what is next, what is not verified. This replaced a tool that
  generated a status page: two places recording the same thing drifted, and the
  generated one was a frozen snapshot that read as current. One file, updated by
  whoever is about to push, with numbers from a run they actually did.
- **Commit convention: Conventional Commits**, not currently enforced by any
  hook or CI check — there are no git hooks installed in this repo.
- Target branch `main`, and `origin` now exists — pushing and opening a PR are
  both real actions with external effect. There is no PR template.
- CI (`.github/workflows/ci.yml`) runs on pushes to `main`, on pull requests and
  on demand. Three jobs: **frontend** (five typechecks, vitest, player build,
  the §47 size gate, Chromium browser tests, screenshots uploaded as an
  artifact), **backend** (.NET restore/build/test on Windows — **paused via
  `if: false`** until an SDK exists, so its steps are reviewable but never run),
  and **licences** (a grep asserting each named dependency appears in
  `THIRD-PARTY-NOTICES.md`).
- **CI must build every bundle Playwright previews.** It starts every
  `webServer` in the config regardless of which project runs, and `dist/` is
  gitignored — so a new preview target needs its build step added to the
  frontend job *in the same commit*, or CI fails on a server that never comes
  up. The player and the editor are both built today for this reason.
- **Assume you are not the only agent in this working tree.** Stage explicit
  paths; never `git add -A` or `git commit -a`. Someone else's half-finished
  work committed under your message is the one mistake here that is genuinely
  expensive to unpick. `git status` before staging, every time.
- Seek human review for schema breaks, major dependency changes, or scope
  expansion (§164).

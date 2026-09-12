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

Polyglot: **C# (.NET 10)** for the host, providers and platform adapters;
**TypeScript** for the shared renderer, display-only player and editor. The
frontend is an npm workspace at `src/web/`.

**The design document is the spec:** [`docs/pc-stats-display-agent-plan.md`](docs/pc-stats-display-agent-plan.md)
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

## 3. Agent skills

Canonical content lives in [`.agents/skills/`](.agents/skills/) so any harness
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

## 4. Specs

Tracked specs live in [`.agents/specs/`](.agents/specs/). A spec is durable and
committed; a plan is throwaway. See that directory's README for the convention
and how specs relate to the gate checklists.

Three planning locations exist and they do **not** overlap:

| Location | Holds |
|---|---|
| `.agents/specs/` | Per-feature intended behaviour, kept in sync with the code |
| `docs/gates/` | Gate acceptance evidence — measurements and observations |
| `docs/decisions/` | ADRs — a decision, its context, its consequences |

## 5. Essential commands

### Frontend — run from `src/web/`

```bash
npm install                                      # also regenerates package-lock.json
npx vitest run                                   # unit tests
npx tsc --noEmit -p packages/renderer-core/tsconfig.json
npx tsc --noEmit -p packages/player/tsconfig.json
npx tsc --noEmit -p packages/fake-source/tsconfig.json
npx tsc --noEmit -p packages/editor/tsconfig.json
npx vite build packages/player                   # display-only bundle
npx vite build packages/editor                   # desktop authoring bundle
node packages/player/scripts/check-size.mjs      # §47 budget gate; needs a build first
npx playwright test                              # browser tests; needs BOTH builds first
npx vite dev packages/player                     # watch the demo dashboard live
npx vite dev packages/editor                     # watch the editor live
```

**Test counts are deliberately not recorded here.** They moved by hundreds
within single milestones and every stale number invited a wrong conclusion. Run
`node tools/dev-status.mjs` from the repository root for current, *executed*
figures — it runs the unit suite, measures the bundle on disk, and prints "not
measured" for anything it cannot establish rather than carrying a number
forward. `vigilia:verify` is the routine to run before committing.

**There are four typecheck projects, not three.** `packages/editor` is one of
them; CI checks all four, so omitting it locally means CI finds the error
instead of you.

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

### Backend — run from the repository root

```bash
dotnet restore Vigilia.slnx
dotnet build Vigilia.slnx --configuration Release
dotnet test Vigilia.slnx
dotnet run --project src/Vigilia.Host            # binds 127.0.0.1:5227
```

**No .NET SDK is currently installed** — only the EOL 6.0.35 runtime. Every
`dotnet` command above is **unverified and has never been run**. See the trap
below for the misleading error you will get.

No command here requires infrastructure, and none is interactive.

## 6. Architecture

| Path | Purpose |
|---|---|
| `src/Vigilia.Contracts` | Provider interface, `Sample`, `SensorDescriptor`. **No Windows types** |
| `src/Vigilia.Core` | Registry, scheduling, normalization, bounded history, sensor mapping |
| `src/Vigilia.Host` | ASP.NET Core + SignalR. Loopback-only by default |
| `src/Vigilia.Platform.Abstractions` | `ISecretStore` and other platform-neutral interfaces |
| `src/Vigilia.Platform.Windows` | Tray, secrets, startup, firewall |
| `src/Vigilia.Providers.Fake` | Deterministic provider for contract and visual tests |
| `src/Vigilia.Providers.Http` | Custom API sensors (§99) |
| `src/Vigilia.Providers.Windows` | LibreHardwareMonitor + PawnIO driver probe |
| `tests/Vigilia.Contracts.Tests` | Provider conformance suite |
| `schema/` | The owned theme format |
| `src/web/packages/renderer-core` | Shared renderer. **No editor dependencies, ever** |
| `src/web/packages/player` | Display-only bundle for phones |
| `src/web/packages/editor` | Desktop authoring: interaction and inspector layer over `renderer-core` (ADR-0005). **Do not add Fabric** |
| `src/web/packages/fake-source` | **Fabricated** samples + the demo theme. Dev and test only |
| `src/web/tests/e2e` | Playwright browser tests, one spec per surface |

**Outside the npm workspace:** everything except the four `src/web/packages/*`
entries. The workspace root is `src/web/`, not the repository root.

Inside `renderer-core`, the split that matters is `scene/plan.ts` (pure —
decides everything, unit-tested) versus `scene/mount.ts` (DOM — decides
nothing). **The editor repeats that split deliberately:** `geometry.ts`,
`hit-test.ts`, `selection.ts`, `snapping.ts`, `transform-gesture.ts`,
`commands.ts` and `history.ts` are pure and unit-tested — what a click selects,
what a drag does to a transform, what undo restores — and the DOM overlay wires
events to them without deciding anything. Gesture maths in the overlay is the
same mistake as a decision in `mount.ts`, and it fails the same way: untestable
without a browser.

Specs: [`0003`](.agents/specs/0003-scene-rendering.md) covers the renderer half;
[`0004`](.agents/specs/0004-editor-selection-and-gestures.md),
[`0005`](.agents/specs/0005-editor-editing-and-history.md),
[`0006`](.agents/specs/0006-editor-inspector.md) and
[`0007`](.agents/specs/0007-editor-globals.md) cover selection and gestures,
document editing and history, the inspector, and the globals surface. Each one's **"Not verified"**
note is the honest edge of what has actually been observed — read it before
trusting a criterion.

`@vigilia/fake-source` fabricates readings, which §97 forbids presenting as
real. It is currently imported by the player because no transport exists, and
the page says so on screen. **Do not let it become a runtime dependency of
anything shipped**, and do not reach for it to "fill in" a sensor the host
cannot supply — that case renders as a gap, by design.

## 7. Technology stack

.NET 10 · ASP.NET Core + SignalR (MessagePack) · LibreHardwareMonitorLib
**exactly `[0.9.6]`** · PawnIO (external, optional) · Vue-less TypeScript for
`renderer-core` · ECharts 6.1.0 · Vite 8 · TypeScript 7.0.2 · vitest 5 ·
Playwright 1.63 (browser tests in `src/web/tests/e2e`).

The editor foundation is **decided**: ADR-0005 rejects both Fabric candidates and
builds the editor as an interaction and inspector layer over `renderer-core`.
They are canvas editors; this renderer is DOM plus ECharts, so adopting one meant
rendering the scene twice — which §31 forbids and Gate 0 rejects outright. **Do
not add a Fabric dependency.**

Work order is frontend-first (ADR-0006): the .NET host is sequenced after
Gates 1, 2 and 4, because no C# here has ever compiled and a mid-sequence Gate 3
stalled three milestones that do not depend on it. Gate *content* is unchanged.

## 8. Key architectural patterns

1. **Two hard boundaries, both mechanically enforced.** Platform: `Contracts`,
   `Core` and the renderer must not reference Windows types; projects that
   legitimately do set `IsWindowsPlatformProject=true` (see
   `Directory.Build.props`), and `CA1416` is an error everywhere else. Player vs
   editor: `renderer-core` and `player` must not depend on editor UI or a
   component framework, and `check-size.mjs` fails the build if one leaks.
2. **Providers acquire; the host schedules.** A provider must never start a
   timer, cache history, or push samples. It answers `SampleAsync` when asked
   (`src/Vigilia.Contracts/ISensorProvider.cs`).
3. **Themes bind to semantic keys, never to provider instances**, so changing
   providers requires no theme edit (§93). A mapping layer resolves them.
4. **Typed chart settings only.** Raw ECharts options never cross into the theme
   format. There is exactly one engine-boundary cast, in
   `packages/player/src/main.ts` — if that cast appears in feature code, the
   boundary has been breached.
5. **Two sensor tiers.** Baseline works with no driver and no elevation; extended
   needs PawnIO and may legitimately be unavailable (ADR-0004). Tiers are
   *discovered and reported*, never hardcoded.
6. **Status before value, always.** A non-`Ok` sample carries no value, and a
   missing sample renders as a **gap, never a zero** (§83).

## 9. Key development patterns

### Files you must not hand-edit, and what to edit instead

| Do not edit | Edit / do instead |
|---|---|
| `src/web/package-lock.json` | Change `package.json`, then run `npm install` |
| `src/web/packages/player/dist/**` | Build output. Gitignored |
| `.claude/plugins/vigilia/skills/*/SKILL.md` | Pointer files. Edit `.agents/skills/<name>/SKILL.md` |
| `docs/pc-stats-display-agent-plan.md` | User-authored spec. Propose changes; do not rewrite |
| `docs/agent-environment-setup.md` | User-authored methodology. Same |

### Not generated, but must be changed in pairs — nothing warns you

`src/Vigilia.Contracts/*.cs` is **hand-mirrored** in
`src/web/packages/renderer-core/src/types.ts`. A change to `Sample`,
`SensorStatus` or `SensorDescriptor` on one side compiles cleanly on the other
and produces wrong values at runtime. **This is the highest-risk edit in the
repository.** Change both, in the same commit.

Two guards now fail on drift instead of leaving it to discipline:

- `renderer-core/src/contracts-mirror.test.ts` parses the `.cs` files and
  `types.ts` as text and compares member names. Narrow on purpose — names only,
  not types — because that is the drift that actually happens. It cannot see
  `DateTimeOffset` versus an ISO string, which is intentional and asserted.
- `renderer-core/src/theme/schema-sync.test.ts` does the same for
  `schema/theme-document.schema.json` against the validator.

Neither replaces generating one side from the other, which needs a .NET SDK to
exist first. A guard that runs today beats a better one that does not.

### Blast radius, in order

1. `Vigilia.Contracts` ↔ `renderer-core/src/types.ts` — the unenforced mirror above.
2. `schema/theme-document.schema.json` — the persisted format. Themes already
   saved must keep loading; bump `schemaVersion` and fail unsupported versions
   without touching the library (§141).
3. `renderer-core` — shared by editor *and* player; a stray dependency breaks the
   player's budget.
4. `ISensorProvider` — every provider plus the conformance suite.

### C#

- `Nullable` and `ImplicitUsings` are on; **`TreatWarningsAsErrors=true`**. Any
  warning fails the build.
- `ISensorProvider` is `IAsyncDisposable` only. `using` (synchronous) on it does
  not compile — use `await using`.
- Never use `string.GetHashCode()` where determinism matters: .NET randomizes
  string hashing **per process**. `FakeSensorProvider.StableHash` exists for this
  reason; using `GetHashCode` there would silently break screenshot tests across
  runs.

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
| Provider conformance | `tests/Vigilia.Contracts.Tests` | `dotnet test` (unverified — no SDK) |
| E2E / visual | `src/web/tests/e2e/*.spec.ts` | `npx playwright test` from `src/web/`, **after a player build** |

**Adding a provider means subclassing `SensorProviderContractTests`**, not writing
bespoke tests. That suite is the definition of correct provider behaviour.

### Implementing a feature, in dependency order

1. If the shape changes, update `src/Vigilia.Contracts` **and** the
   `renderer-core/src/types.ts` mirror together.
2. If persisted, update `schema/theme-document.schema.json` and decide whether
   `schemaVersion` must bump.
3. Implement behind the provider or renderer boundary it belongs to.
4. Add tests at the layer above; for providers, extend the conformance suite.
5. Run the frontend commands in §5; run the .NET ones if an SDK exists.
6. Record measurements in `docs/gates/`, decisions in `docs/decisions/`.

## 10. Design principles

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

## 11. VCS guidelines

- **Commit convention: Conventional Commits**, not currently enforced by any
  hook or CI check — there are no git hooks installed in this repo.
- Target branch `main`, and `origin` now exists — pushing and opening a PR are
  both real actions with external effect. There is no PR template.
- CI (`.github/workflows/ci.yml`) runs on pushes to `main`, on pull requests and
  on demand. Three jobs: **frontend** (four typechecks, vitest, player build,
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

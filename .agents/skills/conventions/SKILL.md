---
name: vigilia:conventions
description: Quick reference for Vigilia's commands, boundaries and known traps. Use when you need a fast reminder of how to build, test, or run the project, which files must not be hand-edited, or which tooling behaves unexpectedly. Full detail is in AGENTS.md.
---

# Vigilia conventions

Fast reference. Full detail: [`AGENTS.md`](../../../AGENTS.md).

## Commands

Frontend — **from `src/web/`**:

```bash
npx vitest run
npx tsc --noEmit -p packages/renderer-core/tsconfig.json
npx tsc --noEmit -p packages/player/tsconfig.json
npx tsc --noEmit -p packages/fake-source/tsconfig.json
npx tsc --noEmit -p packages/editor/tsconfig.json
npx vite build packages/player
node packages/player/scripts/check-size.mjs      # needs a build first
npx playwright test                              # needs a build first, too
```

Four typecheck projects, not two — CI checks all four. The full pre-commit
order, and why it is that order, is `vigilia:verify`. For current *executed*
figures run `node tools/dev-status.mjs` from the repository root; test counts
are deliberately not written down anywhere, because they went stale by hundreds
within single milestones.

Backend — **from the repository root**, and **never yet run** (no .NET SDK
installed; the CI backend job is paused with `if: false` for the same reason):

```bash
dotnet build Vigilia.slnx
dotnet test Vigilia.slnx
dotnet run --project src/Vigilia.Host            # 127.0.0.1:5227
```

## The traps

**`dotnet` exists but has no SDK.** The error is
`"The command could not be loaded... The application '--version' does not exist"`,
which reads like a broken command rather than a missing SDK. Only the EOL 6.0.35
*runtime* is present. Install the .NET 10 SDK.

**Node 25 is installed and vitest 5 rejects it** (`^22.12 || ^24 || >=26`). Tests
still run; you get only an `EBADENGINE` warning. Do not chase it as a failure.

**Vite 8 bundles with rolldown, not rollup.** `manualChunks` must be a
**function**; the object form fails with `manualChunks is not a function`.

**Playwright previews *built* bundles, and starts the preview servers itself.**
Every bundle a suite exercises must be built first; an unbuilt one surfaces as a
server that never comes up, which reads like a Playwright fault. Read
`playwright.config.ts` for the current `webServer` list — do not assume there is
only one.

**Screenshot capture needs `VIGILIA_CAPTURE=1` *and* `--workers=1`.** Without
the second, the desktop and phone projects write the same directory
concurrently and Windows fails the open with `UNKNOWN`. See
`vigilia:gate-evidence`.

**You may not be the only agent in this working tree.** `git status --short`
before you build, test or stage — a build writes `dist/` and the browser suite
binds fixed ports, so a concurrent run's failures can look like yours. Stage
explicit paths; never `git add -A` or `git commit -a`.

**TypeScript 7 with `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`:**
an explicit `undefined` is a different type from an omitted key, and every
indexed access needs `!` when the index is known good.

**`URL.pathname` on Windows** yields `/D:/...` and silently breaks `fs`. Use
`fileURLToPath`.

**`string.GetHashCode()` is randomized per process.** Never use it where
determinism matters — `FakeSensorProvider.StableHash` exists for exactly this.

**`TreatWarningsAsErrors=true` repo-wide**, and `CA1416` is escalated to an
error. Windows types compile only in projects setting
`IsWindowsPlatformProject=true`.

**`ISensorProvider` is `IAsyncDisposable` only** — synchronous `using` does not
compile. Use `await using`.

**LibreHardwareMonitorLib is exact-pinned `[0.9.6]`.** Floating it selects one of
735 prereleases.

**No symlinks work here** (`core.symlinks=false`; `ln -s` silently copies). Never
introduce one.

## Never hand-edit

| File | Instead |
|---|---|
| `src/web/package-lock.json` | Edit `package.json`, run `npm install` |
| `.claude/plugins/vigilia/skills/*/SKILL.md` | Edit `.agents/skills/<name>/SKILL.md` |
| `docs/pc-stats-display-agent-plan.md` | User-authored spec — propose, don't rewrite |
| `docs/agent-environment-setup.md` | User-authored — same |

## Change these in pairs — nothing warns you

`src/Vigilia.Contracts/*.cs` is **hand-mirrored** in
`src/web/packages/renderer-core/src/types.ts`. Drift compiles cleanly on both
sides and produces wrong values at runtime. Same commit, both files.

## Boundaries

- **Platform:** `Contracts`, `Core` and the renderer must not touch Windows types.
- **Player:** `renderer-core` and `player` must not depend on editor UI or a
  component framework. If `check-size.mjs` fails, find the leaked dependency —
  do not raise the budget.
- **Editor:** an interaction and inspector layer *over* `renderer-core`
  (ADR-0005). The scene is rendered once, by the renderer. **Do not add a Fabric
  dependency** — both candidates were rejected as canvas editors, and adopting
  one meant rendering the scene twice (§31 forbids it).
- **Pure decides, DOM renders** — on both sides. `scene/plan.ts` versus
  `scene/mount.ts` in the renderer; the editor's geometry, hit-test, selection,
  snapping, gesture, command and history modules versus its overlay. Gesture
  maths in the overlay is untestable without a browser.
- **Providers acquire; the host schedules.** No timers, no history, no pushing
  from inside a provider.

## Non-negotiables

- A non-`Ok` sample carries **no value**. Missing renders as a **gap, never zero**.
- Never fabricate a reading; report `Unavailable` with an actionable reason.
- Secrets go through `ISecretStore`, redacted in errors, absent from responses
  and packages.
- Adding a provider means subclassing `SensorProviderContractTests`.

---
name: vigilia:conventions
description: Quick reference for Vigilia's commands, boundaries and known traps. Use when you need a fast reminder of how to build, test, or run the project, which files must not be hand-edited, or which tooling behaves unexpectedly. Full detail is in AGENTS.md.
---

# Vigilia conventions

Fast reference. Full detail: [`AGENTS.md`](../../../AGENTS.md).

## Commands

Frontend — **from `src/web/`**:

```bash
npx vitest run                                   # 19 tests
npx tsc --noEmit -p packages/renderer-core/tsconfig.json
npx tsc --noEmit -p packages/player/tsconfig.json
npx vite build packages/player
node packages/player/scripts/check-size.mjs      # needs a build first
```

Backend — **from the repository root**, and **never yet run** (no .NET SDK
installed):

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
- **Providers acquire; the host schedules.** No timers, no history, no pushing
  from inside a provider.

## Non-negotiables

- A non-`Ok` sample carries **no value**. Missing renders as a **gap, never zero**.
- Never fabricate a reading; report `Unavailable` with an actionable reason.
- Secrets go through `ISecretStore`, redacted in errors, absent from responses
  and packages.
- Adding a provider means subclassing `SensorProviderContractTests`.

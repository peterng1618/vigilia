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
npm run typecheck                                # all five projects
npx vite build packages/player
npx vite build packages/editor
npx vite build packages/host
node packages/player/scripts/check-size.mjs      # needs a build first
npx playwright test                              # needs BOTH display builds
node packages/host/bin/vigilia.js --no-browser   # needs all three builds
```

**Five typecheck projects, not four** — `packages/editor` and `packages/host`
are the two that get forgotten, and CI checks all five. Prefer
`npm run typecheck`, which derives the list from the workspace, over a
hand-written set of `tsc` invocations: the hand-written list has now been wrong
in four separate files at once, because adding a package updates whichever copy
the author happened to be looking at.

The full pre-commit order, and why it is that order, is `vigilia:verify`. For
current *executed* figures run `node tools/dev-status.mjs` from the repository
root; test counts are deliberately not written down anywhere, because they went
stale by hundreds within single milestones.

**There is no backend toolchain.** ADR-0007 moved the host into TypeScript in
this same workspace, and `src/Vigilia.*` is slated for deletion. Run the host
with `node packages/host/bin/vigilia.js`. The published binary is
**`vigilia-dashboard`**, never plain `vigilia` — that name belongs to an
unrelated package on the registry and fetches a stranger's CLI.

## The traps

**`dotnet` exists but has no SDK, and that no longer matters.** The error reads
like a broken command rather than a missing SDK
(`"The application '--version' does not exist"`). **Do not install a .NET SDK
to unblock anything** — nothing in the product needs one any more, and the CI
backend job is paused with `if: false` for the same reason.

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

## The mirror is gone — do not recreate it

This section used to say `src/Vigilia.Contracts/*.cs` was hand-mirrored in
`renderer-core/src/types.ts` and told you to edit both in one commit.
**ADR-0007 deleted the mirror instead of guarding it better**: the host is
TypeScript and imports `types.ts` directly, so a change that compiles cleanly
on both sides and produces wrong values at runtime has nowhere left to live.

What replaced it is the rule worth carrying:

- **A shape both ends read belongs in the shared library**, not in one end with
  a reader in the other. The wire contract lives in
  `renderer-core/src/data/protocol.ts`; the semantic key vocabulary lives in
  `renderer-core/src/data/semantic-keys.ts`; editor actions live in
  `packages/editor/src/actions.ts`. Each exists because the concept previously
  had two homes.
- **An owner nothing imports is not an owner.** `semantic-keys.ts` was created
  and the host kept its own hand-typed copy of the same four keys, which had
  already drifted on a label. If you introduce an owner, point every consumer
  at it in the same commit and add a test that binds them.

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

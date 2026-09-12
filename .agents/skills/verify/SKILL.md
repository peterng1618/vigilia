---
name: vigilia:verify
description: Runs Vigilia's pre-commit gauntlet — typechecks, unit tests, bundle build, the size gate and the browser suite — in the order that avoids the traps, and reports what was not verified. Use before committing, before claiming something works, after changing renderer-core, or when asked to check, verify, validate or test the project.
---

# Verifying Vigilia

Run this before committing, and before any claim that something works. §33: a
ticked checkbox without observable behaviour and a test is not a pass.

## Order matters

Each step is cheap relative to the one after it and fails for clearer reasons,
so run them in this order and stop at the first failure.

From `src/web/`:

```bash
# 1. Typechecks — four projects, not three.
npx tsc --noEmit -p packages/renderer-core/tsconfig.json
npx tsc --noEmit -p packages/player/tsconfig.json
npx tsc --noEmit -p packages/fake-source/tsconfig.json
npx tsc --noEmit -p packages/editor/tsconfig.json

# 2. Unit tests — seconds, and where a logic break shows up first.
npx vitest run

# 3. Build. Required before 4 and 5; they measure and preview the BUILT output.
npx vite build packages/player
npx vite build packages/editor

# 4. The §47 display-only budget gate.
node packages/player/scripts/check-size.mjs

# 5. Browser tests. Slowest, ~1.5 min.
npx playwright test
```

Then, from the repository root, for figures worth quoting:

```bash
node tools/dev-status.mjs
```

## The traps, in the order you will hit them

**Every bundle a browser suite exercises must be built first.** Playwright
previews built output, so a source change is invisible until its bundle is
rebuilt, and an unbuilt bundle surfaces as a preview server that never comes
up — which reads like a Playwright fault and is not one. Check
`playwright.config.ts` for the current `webServer` list rather than assuming
only the player is served.

**`check-size.mjs` measures `dist/` on disk.** Without step 3 it either fails on
a missing directory or, worse, passes against a stale build.

**If the size gate fails, find the leaked dependency — do not raise the
budget.** That gate is the mechanical half of the player/editor boundary; an
editor dependency reaching `renderer-core` or `player` is exactly what it is
there to catch.

**Do not run `dotnet` anything and report a result.** There is no .NET SDK on
this machine, only the EOL 6.0.35 runtime, and the failure message
(`The application '--version' does not exist`) reads like a broken command
rather than a missing SDK. Everything under `src/Vigilia.*` is
authored-but-unbuilt; say so rather than implying otherwise.

**Node 25 warns and works.** vitest 5 declares `^22.12 || ^24 || >=26`; you get
`EBADENGINE` and a passing suite. Not a failure — do not downgrade.

## You are probably not alone in this tree

Another agent session may be editing the same working tree. Before running
anything that writes:

```bash
git status --short
```

A build writes into `dist/`, and the browser suite starts preview servers on
fixed ports — both interfere with a concurrent run, and a suite that fails
mid-edit tells you nothing about your own change. If files you did not touch are
modified, **the failures may not be yours**: establish that before reporting a
regression, and never "fix" a file another session is holding.

When staging, stage explicit paths. Never `git add -A`, never `git commit -a`.

## Reporting

State what you ran and what you did not. Specifically:

- Numbers only from a run you actually executed in this session. Do not carry a
  count forward from a document — those go stale by hundreds within a
  milestone, which is why `AGENTS.md` no longer records them.
- Name the layers you skipped, especially .NET and anything needing real
  hardware or a real phone. A Pixel 7 *viewport* is not a Pixel 7.
- If tests fail, quote the failures. A summary that says "passing" over six
  failures is the worst possible output.

---
name: vigilia:verify
description: Run the appropriate Vigilia pre-commit checks and report exactly what was verified.
---

# Verifying Vigilia

CI runs typecheck, unit tests, builds, size gate and desktop Chromium. Scope local
verification by changed paths; unknown paths are FULL.

```bash
git status --porcelain | cut -c4- | awk '
  /^\.agents\//             { next }
  /\.md$/                   { next }
  /\.test\.ts$/             { t=1; next }
  /^src\/web\/tests\/e2e\// { e=1; next }
                            { f=1 }
  END { print f ? "FULL" : e ? "E2E" : t ? "UNIT" : "PROSE" }'
```

| Tier | Run |
|---|---|
| PROSE | no tests |
| UNIT | typecheck + full unit suite |
| E2E | typecheck + units + builds + browser suite |
| FULL | typecheck + units + builds + size gate + browser suite |

Do not select unit tests by changed path; cross-package boundary tests make that
unsafe.

## Commands

From `src/web/`, in order:

```bash
npm run typecheck
npm test
npm run build
npm run size
npm run test:e2e
```

Stop at the first failure. Build before size/E2E because both consume built
output. Rebuild after reverting deliberate sabotage.

## Extra checks when relevant

- Renderer/player viewport changes: run the `phone-chromium` project locally as
  well as normal CI coverage.
- Host serving/base/output changes: build, start
  `node packages/host/bin/vigilia.js --port 5231 --no-browser`, and load both
  player/editor through the host. Playwright preview servers do not test this.
- Visible rendering changes: inspect the result, not only structural assertions.

No physical-phone validation is required unless a future product requirement
explicitly adds it.

## Traps

- `check-size.mjs` measures `dist/`; stale builds give stale answers.
- If the size gate fails, find the dependency leak rather than raising the gate
  to make it pass.
- Another agent may be writing the tree/build output. Check `git status --short`
  before running/staging and never discard unknown changes.
- Stage explicit paths; never `git add -A` or `git commit -a`.

## Reporting

State the tier, commands run, failures, and material checks skipped. Numbers must
come from this session's output, not copied from `status.md`.
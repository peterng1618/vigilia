---
name: vigilia:verify
description: Run the smallest local proof for a Vigilia change; CI owns the full gate.
---

# Verifying Vigilia

CI is the complete gate: full workspace typecheck, unit suite, player/editor/host
builds, player size and desktop Chromium browser suite on pull requests and
pushes to `main` or `develop`. Do not repeat that suite locally for an ordinary,
well-bounded change. Inspect the CI run for the pushed commit before reporting
the full gate as passed.

## Local proof

Choose the narrowest applicable row. Unknown impact is `CROSS-CUTTING`.

| Change | Run locally |
|---|---|
| Prose only | no tests |
| One workspace's pure/DOM code | owning workspace typecheck and nearest focused Vitest files |
| Entry/bundle or static asset path | above plus affected package build |
| Browser wiring | above plus the named focused Playwright test on built bundles |
| Visible result | above plus its selected capture and inspection |
| Schema/persistence, shared renderer/viewport, dependency/toolchain, or unknown impact | full local gate only when CI is unavailable or diagnosis needs it |

Use workspace scripts and explicit test files. Do not select a subset merely
because the full suite is slow; select the nearest tests that prove the changed
decision. A visible action's capture name and title are in
`.agents/screenshots/README.md`.

```powershell
# From src/web/
npm run typecheck -w @vigilia/editor
npm test -- --run packages/editor/src/artboard-panel.dom.test.ts
npm run build -w @vigilia/editor
npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --grep 'changed artboard controls'
$env:VIGILIA_CAPTURE='1'; npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --grep 'captures changed artboard controls' --workers=1
```

Build player and editor before Playwright: its configured preview servers start
both bundles. `VIGILIA_CAPTURE=1` writes evidence only for selected capture
tests; without it, those tests still run their behavioural assertions. Inspect
only the generated image(s). Stop at the first failure.

## CI evidence

After push, inspect the CI run for that commit:

```powershell
gh run list --workflow ci.yml --commit (git rev-parse HEAD) --limit 1
gh run watch <run-id> --exit-status
```

For visible work, dispatch **Visual evidence** on the pushed branch with the
specific Playwright title regex and desktop/phone project from the screenshot
registry. Download its `visual-evidence` artifact, inspect only the selected
PNGs, then record the run URL/commit and observation in `status.md`:

```powershell
gh workflow run visual-evidence.yml --ref (git branch --show-current) -f grep='captures changed artboard controls' -f project=desktop-chromium
gh run download <run-id> -n visual-evidence
```

It builds the two browser bundles and runs only the requested capture; it is not
a replacement for CI's full gate.

## Extra checks

- Renderer/player viewport changes: capture the affected desktop and phone
  visual actions.
- Host serving/base/output changes: locally build and start the host, then load
  player and editor through it. Playwright previews do not cover this.
- CI unavailable: run the prior full local sequence as a fallback:
  `npm run typecheck`, `npm test`, `npm run build`, `npm run size`, and
  `npm run test:e2e`; run only selected visual capture(s) separately.

## Reporting

State local commands, selected screenshots and observations, CI run result, and
any checks not run. Never call the full gate green from local partial evidence.
Record a measurement only when it changes a decision: result, date, reproducible
method, and material limitation. Put current evidence in `status.md`; lasting
choices belong in `decisions.md`.

---
name: vigilia:verify
description: Run the required local proof for a Vigilia change; local E2E owns browser coverage.
---

# Verifying Vigilia

Run the smallest relevant local proof. When a change requires browser E2E, run
the full suite locally; focused Playwright tests do not replace it. CI runs on
`main` pushes and pull requests targeting `main`; do not wait for it after a
`develop` push.

## Local proof

Choose the narrowest applicable row. Unknown impact is `CROSS-CUTTING`.

| Change | Run locally |
|---|---|
| Prose only | no tests |
| One workspace's pure/DOM code | owning workspace typecheck and nearest focused Vitest files |
| Entry/bundle or static asset path | above plus affected package build |
| Browser wiring | above plus `npm run test:e2e` |
| Visible result | above plus `npm run test:e2e`, its selected capture and inspection |
| Schema/persistence, shared renderer/viewport, dependency/toolchain, or unknown impact | full local gate including `npm run test:e2e` |

Use focused tests for diagnosis and the nearest unit proof. They do not replace
the required full E2E run. A visible action's capture name and title are in
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

CI is an additional gate for `main` pushes and pull requests targeting `main`:

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

It builds the two browser bundles and runs only the requested capture; it does
not replace the local full E2E run.

## Extra checks

- Renderer/player viewport changes: capture the affected desktop and phone
  visual actions.
- Host serving/base/output changes: locally build and start the host, then load
  player and editor through it. Playwright previews do not cover this.
- Full local gate: `npm run typecheck`, `npm test`, `npm run build`, `npm run
  size`, and `npm run test:e2e`; run selected visual capture(s) separately.

## Reporting

State local commands, selected screenshots and observations, CI result when it
ran, and any checks not run. Never call a browser change green from partial E2E
evidence.
Record a measurement only when it changes a decision: result, date, reproducible
method, and material limitation. Put current evidence in `status.md`; lasting
choices belong in `decisions.md`.

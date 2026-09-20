---
name: vigilia:gate-evidence
description: Capture only the visual evidence affected by a Vigilia change.
---

# Gate evidence

Record only observations actually produced by a run/probe. Requirements belong
in specs/plan; current run counts belong in `status.md`; lasting decisions belong
in `decisions.md`.

## Screenshots

Select the visual action(s) affected by the change from
`.agents/screenshots/README.md`; do not regenerate unrelated captures. Build
both browser bundles, run only the matching title, and inspect only its PNGs.

```powershell
cd src/web
npm run build -w @vigilia/player
npm run build -w @vigilia/editor
$env:VIGILIA_CAPTURE='1'
npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --grep 'captures changed artboard controls' --workers=1
```

For pushed visible work, prefer the manual **Visual evidence** GitHub Actions
workflow. It uploads the selected result as `visual-evidence`; download and
inspect it without running the full browser suite locally. Use a local capture
only to diagnose before push or when CI is unavailable.

Screenshots are evidence, not cross-platform pixel baselines. One capture shows
one affected user action. Control time/animation when determinism matters.

## Measurements

Record:

1. the number/result;
2. date;
3. enough method to reproduce it;
4. only limitations that materially affect interpretation.

Do not carry a number forward as if re-measured. Do not require physical-device
validation unless a product requirement explicitly asks for it; reproducible
browser/automated profiles are acceptable for current performance work.

Keep entries concise. Debugging chronology and failed probe attempts belong in
git history, not the evidence record.

## Human decisions

Engine-gap alternatives under §85 and other product-taste choices still require
human approval. Record measurements, then leave the product choice open.

---
name: vigilia:gate-evidence
description: Capture screenshots or record measured evidence for Vigilia.
---

# Gate evidence

Record only observations actually produced by a run/probe. Requirements belong
in specs/plan; current run counts belong in `status.md`; lasting decisions belong
in `decisions.md`.

## Screenshots

From `src/web/`:

```bash
npx vite build packages/player
VIGILIA_CAPTURE=1 npx playwright test -g "captures a screenshot" --workers=1
```

- Build first; Playwright previews built output.
- `--workers=1` avoids concurrent writes to the same capture directory.
- Screenshots are visual evidence, not cross-platform golden baselines.
- Control time/animation when determinism matters; the previous claim that all
  chart frames were inherently non-reproducible was disproved after fixing the
  test clock.

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
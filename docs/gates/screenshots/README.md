# Dashboard screenshots

Rendered evidence for the Gate 0 styling matrix and the demonstration set in
[`../gate-0.md`](../gate-0.md). Produced from the built player bundle by
`src/web/tests/e2e/display.spec.ts`.

Refresh them deliberately:

```bash
cd src/web
npx vite build packages/player
VIGILIA_CAPTURE=1 npx playwright test -g "captures a screenshot"
```

## These are not baselines

Nothing compares against them, and nothing should:

- **They are not byte-reproducible.** The data behind them is deterministic —
  the fake source is a pure function of its clock — but a capture lands
  mid-animation, and the number of frames the engine gets varies slightly per
  run. Two runs of the same commit produce visibly identical, bitwise different
  images.
- **They are platform-specific.** CI renders on Linux and development happens on
  Windows; glyph rasterisation differs, so a committed PNG could never pass as a
  cross-platform assertion.

What they are for: seeing what the renderer currently produces without running
it, and noticing when a change alters the design in a way no assertion covers.
The behavioural checks live in the spec file alongside them.

§126 requires visual acceptance on **named reference hardware**, which nobody has
named yet. Real pixel baselines belong with that decision.

# Dashboard screenshots

Rendered evidence for the Gate 0 styling matrix and the demonstration set in
[`../gate-0.md`](../gate-0.md). Produced from the built player bundle by
`src/web/tests/e2e/display.spec.ts`.

Refresh them deliberately:

```bash
cd src/web
npx vite build packages/player
VIGILIA_CAPTURE=1 npx playwright test -g "captures a screenshot" --workers=1
```

`--workers=1` is required, not tidiness: the desktop and phone projects
otherwise write into this directory concurrently and Windows intermittently
fails the open with `UNKNOWN`. Ordinary test runs are unaffected — they write to
per-project directories under `test-results/`.

The build step is not optional either. The harness previews the **built** bundle,
so without it you capture the previous build.

## These are not baselines

Nothing compares against them, and nothing should:

- **Any frame with a chart in it is not byte-reproducible.** Measured, not
  assumed: with the clock frozen, animation disabled and a fresh page per
  capture, the chart-free fixture reproduces exactly while every frame
  containing an ECharts chart differs — on both the canvas and SVG renderers.
  See the engine-gap section in [`../gate-0.md`](../gate-0.md).
- **They are platform-specific.** CI renders on Linux and development happens on
  Windows; glyph rasterisation differs, so a committed PNG could never pass as a
  cross-platform assertion.

Captures use `?static=1`, which disables animation — a real setting the player
also applies when the viewer prefers reduced motion — and discard a warm-up
frame, because the first render after a cold browser start differs from every
render after it.

What they are for: seeing what the renderer currently produces without running
it, and noticing when a change alters the design in a way no assertion covers.
The behavioural checks live in the spec file alongside them.

§126 requires visual acceptance on **named reference hardware**, which nobody has
named yet. Real pixel baselines belong with that decision.

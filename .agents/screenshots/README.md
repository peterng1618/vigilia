# Dashboard screenshots

Rendered evidence for the styling matrix and the demonstration set. Produced
from the built player bundle by `src/web/tests/e2e/display.spec.ts`; the
measurements that go with them are in [`../decisions.md`](../decisions.md),
which is where gate evidence lives (AGENTS.md, "Where to record what").

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

- **They are platform-specific.** CI renders on Linux and development happens on
  Windows; glyph rasterisation differs, so a committed PNG could never pass as a
  cross-platform assertion. This is the reason, and it is the only one left.
- ~~**Any frame with a chart in it is not byte-reproducible.**~~ **False,
  corrected 2026-09-15.** It was measured, on both ECharts renderers, and it was
  measuring the harness rather than the engine: `page.clock.install()` does not
  stop time, so each capture happened at a different instant and the engine
  correctly drew a different frame. With the clock actually paused, three
  captures of a chart are byte-identical — asserted by `display.spec.ts`'s
  "a chart frame IS byte-reproducible", which is now the regression guard for
  the clock. See [`../decisions.md`](../decisions.md).

Captures use `?static=1`, which disables animation — a real setting the player
also applies when the viewer prefers reduced motion — and discard a warm-up
frame, because the first render after a cold browser start differs from every
render after it.

What they are for: seeing what the renderer currently produces without running
it, and noticing when a change alters the design in a way no assertion covers.
The behavioural checks live in the spec file alongside them.

§126 requires visual acceptance on **named reference hardware**, which nobody has
named yet. Real pixel baselines belong with that decision.

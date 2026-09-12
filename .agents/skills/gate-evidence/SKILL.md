---
name: vigilia:gate-evidence
description: Re-captures Vigilia's dashboard screenshots and records gate acceptance evidence in docs/gates. Use when refreshing or capturing screenshots, recording a measurement or probe result, updating the styling matrix, claiming a gate criterion is met, or when asked where a measurement belongs.
---

# Gate evidence

`docs/gates/` is an **append-only record of what was measured**, not a plan and
not a design. One rule governs everything here: an entry describes an
observation someone actually made. §33 — a ticked checkbox without observable
behaviour and a test is not a pass.

## Where a thing belongs

| Content | Location |
|---|---|
| What we measured or observed | `docs/gates/` |
| What a feature should do | `.agents/specs/` |
| Why we chose this | `docs/decisions/` (see `vigilia:write-adr`) |

Duplicating between them is the failure mode: content belongs in exactly one,
and the others link to it.

## Re-capturing screenshots

From `src/web/`:

```bash
npx vite build packages/player
VIGILIA_CAPTURE=1 npx playwright test -g "captures a screenshot" --workers=1
```

Both flags are load-bearing:

- **`--workers=1` is required, not tidiness.** The desktop and phone projects
  otherwise write into the same directory concurrently and Windows
  intermittently fails the open with `UNKNOWN`. Ordinary runs are unaffected —
  they write per-project directories under `test-results/`.
- **`VIGILIA_CAPTURE=1` is what writes into `docs/gates/screenshots/`.** Without
  it captures go to ignored test output. Writing on every run would dirty the
  tree with meaningless diffs, which is the point of the opt-in.
- **The build is not optional.** The harness previews the built bundle, so
  skipping it captures the *previous* build and you will draw conclusions from
  a stale image.

## These are evidence, never baselines

Nothing compares against them and nothing should. Do not wire them into an
assertion, and do not treat a diff in one as a failure.

- **Any frame containing an ECharts chart is not byte-reproducible** — measured,
  not assumed, on both the canvas and SVG renderers, with the clock frozen and
  animation off. Only the chart-free fixture reproduces exactly.
- **They are platform-specific.** CI renders on Linux, development is Windows;
  glyph rasterisation differs.
- Real pixel baselines belong with §126's named reference hardware, which nobody
  has named yet.

Captures use `?static=1` (a real setting the player also applies under reduced
motion) and discard a warm-up frame, because the first render after a cold
browser start differs from every render after it.

## Recording a measurement

Write the number, the date, and how it was obtained. A measurement whose method
is unrecorded cannot be re-checked and will be re-litigated.

- **Never carry a figure forward from another document.** Re-measure, or write
  "not measured". `node tools/dev-status.mjs` prints executed figures and
  refuses to guess — mirror that discipline in prose.
- Record what the measurement does **not** establish. A Pixel 7 viewport is not
  a Pixel 7; a structural browser assertion is not a visual pass.
- When a measurement contradicts an existing entry, add the new one with its
  date and leave the old one in place. The record is append-only: the history of
  a number is often the useful part.
- Performance budgets in `check-size.mjs` are **placeholders** until §157's
  reference-hardware numbers exist. Do not present them as established, and do
  not raise one to make a gate pass.

## Human-only criteria

Some criteria cannot be self-certified: naming reference hardware (§126), the
elevation and anti-cheat probes on real hardware, and the §85 engine-gap
alternatives. Record findings and leave the criterion open — marking one met
without the hardware is the exact failure §33 describes.

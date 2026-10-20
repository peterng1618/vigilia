# 0077 — A theme's facets are derived in `renderer-core`, from the envelope alone

- **Date:** 2026-10-20
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/`

## The problem

The store's region draws five facets — author, colour mode, sensors, shape and
style — and every one of them has to be *read off a theme* before a query can
filter on it. Three of the five are derived rather than authored: colour mode
from the artboard's ground, sensors from the keys the theme binds, and shape from
two numbers. The shape of the problem is not "compute a colour" — it is **which
layer owns the derivation**, because two different producers need the same answer
for the same theme: the host, for a theme in the library, and a catalogue Action,
for a theme merged from several documents. Anything that derives it must be
importable by both, which rules out the editor (the host cannot reach it) and the
player (`chrome.ts` is a surface, not an owner).

The second half of the problem is that each of the three readings has a place
where the honest answer is *no answer*: a ground with media behind it, a palette
reference nothing declares, a colour the parser rejects, a ratio no bucket
describes. A facet that guesses there is a facet that lies about the thing it
exists to filter, and the lie is invisible — the theme simply appears under a
filter it does not belong to.

## Rung 1 — Vigilia

Searched: `luminance`, `relativeLuminance`, `0.2126`, `contrastRatio`,
`colourMode`, `colorMode`, `aspectBucket`, `orientationOf`, `resolveStyleValue`,
`resolveChartPaint`, `isSolidPalettePaint`, `describeSemanticKey`, and every
existing helper over `artboard.background`.

Found: **nothing derives a facet**, and the two things this needs already exist
and are the right owners.

- `scene/plan.ts`'s `resolveStyleValue` is the document's own resolver for a
  `StyleValue` — the palette reference against `globals.palette`, else the
  literal. It is exported from the package barrel. A second resolver here would
  be a second answer to "what colour is this reference", which is the defect
  `docs/decisions/0007` already rules on.
- `data/semantic-keys.ts`'s `describeSemanticKey(key)` returns the descriptor —
  `label` and `family` — and falls back for an unknown key in `labelForSemanticKey`
  only, so the facet reads the descriptor and keeps the raw key itself.
- `charts/fill.ts`'s `parseHex` reads `#rgb` and `#rrggbb` and rejects the rest.
- WCAG luminance exists in the tree exactly once, and it is **a test's local
  helper**: `editor/src/editor-shell/editor-shell.tokens.test.ts:583` computes
  the relative luminance of two token colours to assert a contrast ratio. That is
  a test measuring the design language, not an owner — it is inside a `.test.ts`
  and inside the editor, so `renderer-core` could not reach it even if it were
  the right shape. The editor's `components/ui/colour-maths.ts` converts HSV and
  HSL for the picker; it parses 4- and 8-digit hex (which this must reject) and
  has no luminance at all.

## Rung 2 — dependencies

Searched: `@vigilia/renderer-core`'s own `package.json` (`echarts` is its only
dependency), the installed tree for `chroma-js`, `colord`, `culori`, `color2k`,
`color-convert`, `wcag-contrast`, and the workspace's direct dependencies for
anything colour- or ratio-shaped (`node -e` over `dependencies` +
`devDependencies` filtered on `/color|colour|chroma|contrast|wcag|aspect|ratio/i`).

Found: **no colour library is installed, direct or transitive**, and the package's
`//` note is explicit that it may not gain one casually. Adding a dependency to
compute `L*` would mean a licence check, `THIRD-PARTY-NOTICES.md` and
`docs/engineering/dependencies.md` for a formula that is eight lines and standard.

## Rung 3 — platform

Searched: the CSS Color 4 / WCAG 2.2 definitions the browser implements — relative
luminance, `color()` / `oklch()` / `lab()`, `CSS.supports`, `getComputedStyle`
colour parsing, and `aspect-ratio` media queries.

Found: the platform computes these, and none of it is reachable from where this
runs. `getComputedStyle` and `CSS.supports` need a DOM, and `renderer-core` is
Fabric/DOM-free by the package contract — the host imports its barrel and runs in
Node. `oklch()` would be a *different* lightness scale (perceptual-uniform rather
than CIE), so it is not a substitute for the number this band is stated in. A CSS
`aspect-ratio` media query is a boolean over one declared ratio, not a
classification of an arbitrary one into a published set. So the platform gives
the primitives the formulas are defined against and leaves the classification to
the caller — which is this task.

## Rung 4 — ecosystem

Searched, in this session, with the queries and the results:

- `npm view {chroma-js,colord,culori,color2k,color-convert,wcag-contrast,contrast-color,aspect-ratio} version`
  — all eight exist and are current (`chroma-js` 3.2.0, `colord` 2.10.0,
  `culori` 4.0.2, `color2k` 2.0.4, `color-convert` 3.1.3, `wcag-contrast` 3.0.0,
  `contrast-color` 1.0.1, `aspect-ratio` 2.1.12).
- `npm search --searchlimit=8 "wcag relative luminance perceptual lightness"` —
  the whole result set is the luminance/contrast primitive:
  `wcag-contrast` ("evaluate the wcag color contrast score for two colors"),
  its `@types`, and `relative-luminance` ("calculate relative luminance",
  2.0.1, last published 2018).
- `npm search --searchlimit=8 "aspect ratio bucket classify"` — every hit is a
  *rendering* helper: `@radix-ui/react-aspect-ratio`,
  `@tailwindcss/aspect-ratio`, and a PostCSS plugin for `aspect-ratio` media
  queries. Nothing classifies a ratio into a named bucket.

What that says: **nobody has solved this shape.** The ecosystem solves "given two
colours, what is the contrast ratio" and "given a ratio, size a box". Neither is
"given a document's ground, which of light/dark/unknown is the theme", and neither
is "given two dimensions, which published bucket is this, or none". The band, the
bucket set and the tolerance are this product's design numbers; a library would
supply the primitive underneath them and none of the decision.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `chroma-js` / `colord` / `culori` | Gives Lab/L\* conversion and WCAG luminance | A new dependency in a package contractually kept bare; licence + notices + dependency doc | Pulls a general colour model into a module that needs one formula; `culori` is ~30 kB for eight lines of arithmetic | No |
| `wcag-contrast` / `relative-luminance` | Exactly the luminance primitive | Same dependency cost | Unmaintained (`relative-luminance` last published 2018); still no band, no bucket | No |
| Platform (`getComputedStyle`, `oklch()`) | Authoritative | Needs a DOM; `oklch` is a different scale | `renderer-core` is DOM-free and runs in the host | No |
| `resolveChartPaint` for the palette reference | Already resolves `palette.<id>` | Chart-flavoured: it also handles threshold bands, and its return type drops the gradient's `angle` | An artboard background is a `StyleValue`, not a `ChartPaint` | No — `resolveStyleValue` is the document's owner and takes the `StyleValue` directly |
| The formula in `renderer-core/src/theme/` | 8 lines, standard, testable against the spec's own numbers | None | Nobody re-derives it; a wrong exponent would be caught by the black/white/mid-grey cases | **Yes** |

## Rung 6 — probe

Measured, by running the formula against the numbers the spec and the plan name
(`node -e` over the implementation's own arithmetic, before the test existed):

- WCAG relative luminance → CIE `L*`: `#000000` → 0.0, `#ffffff` → 100.0,
  `#808080` → 53.6, `#333333` → 21.3. The band the spec's reasoning needs is real:
  mid-grey lands at 53.6, which is inside 40–60, and black and white are 40 and 40
  points clear of it.
- A black-to-white gradient averaged **in `L*`** gives 50.0 → `unclassified`;
  averaged in *luminance* it would give 0.5, which is `light` under any threshold
  near the middle. The two averages disagree about this gradient, so the choice is
  load-bearing rather than a nicety.
- The tolerance 0.005 against the bucket set: 1920×1080 and 2560×1440 are exactly
  16:9 (0.0 from it), 1920×1200 is exactly 16:10, 1366×768 is 0.00049 from 16:9
  (0.05%), 1000×999 is 0.001 from 1:1 (0.1%) — all far inside. A 2.35:1 artboard
  is 0.00714 from 21:9 (2.3333), which is **past** 0.005 and falls to `other`.
  0.005 is therefore the largest tolerance that keeps the spec's lying-facet case
  out while every real display stays in.

## Rung 7 — build

What writing it is: the WCAG relative-luminance formula (three channel
linearisations and three coefficients), the CIE `L*` transfer function, a
`switch` over a paint that reads a solid's colour or averages a gradient's stops,
a table of seven ratios compared with `Math.abs(Math.log(ratio / bucket)) <= 0.005`,
three comparisons for orientation, a dedupe walk over `bindings`, and a call to
`describeSemanticKey` per key. **Nothing here is a mechanism** — no sampling, no
ordering, no invalidation, no disposal, no ownership question — which is why the
decision is "in `renderer-core`, reusing its resolver and its parser", and not a
library.

## Decision

**Derive the record in `renderer-core/src/theme/facet-record.ts`, from the envelope
alone, reusing the owners that already exist.**

- **The layer is `renderer-core`** because it is the only one both producers can
  import, and it stays Fabric- and DOM-free.
- **The ground is resolved by `resolveStyleValue`**, the document's own resolver,
  so a palette reference has one owner rather than two.
- **The colour is parsed by `charts/fill.ts`'s `parseHex`** — `#rgb` and
  `#rrggbb` only. Its ceiling is that an 8-digit ground such as `#0815234d` and a
  CSS colour name are `unclassified`; that is the honest answer, and a second
  parser that accepted them would be a second owner of "what is a colour".
- **The band is `L*` 40–60, `unclassified` inside it.** `L*` 50 is perceptual
  mid-grey, and a ground within ten points of it is one where neither light nor
  dark text is clearly the readable choice — so the honest facet value is the
  third one, not a coin flip. Gradient stops are averaged in `L*`, which is what
  makes a black-to-white ground `unclassified` rather than `light`.
- **The bucket set is the plan's seven ratios**, and the tolerance is **0.005 in
  log space** (`|ln(ratio / bucket)| <= 0.005`, ratio taken as `max/min` so a
  portrait artboard reads the same label as its landscape inversion). It is the
  largest tolerance that keeps a 2.35:1 artboard out of 21:9 while every real
  display size stays inside.
- **Unclassified is never a guess**: media behind the ground, an absent ground, a
  reference nothing declares, an unparseable colour, an empty gradient.

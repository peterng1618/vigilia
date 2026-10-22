# 0053 — A non-uniformly scaled panel blurs by the equal-area scale

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/glass.ts`
- **Task:** Phase 17.2 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (row `vg-515`)

## The problem

The backdrop blur's radius is one number, and a panel's device transform is two
scale factors. `glass.ts`'s `composite()` read the object's device matrix and
took the length of its transformed unit-**x** axis:

```ts
const blurRadius = treatment.blurRadius * Math.hypot(own[0], own[1]);
```

At angle 0 that is `|scaleX × viewportScale × retina|` and `scaleY` does not
appear in it at all, so two panels covering the same area — one stretched
horizontally, one vertically — blurred **4× apart at the same authored value**
once `scaleX` reached 4 (`vg-515`). The row left the choice open on purpose:
*whether a non-uniformly scaled panel should blur isotropically is a design
decision, not a defect with a specified correct behaviour*. A single scalar must
be chosen from two non-uniform scales, and the choice is not obvious, which is
what this note is for.

The reason it is a watchlisted boundary rather than a one-line bug: the blur is
sized in **device pixels**, the number rides a matrix the viewport, the retina
ratio and the panel's own scale all feed, and nothing fails when it is wrong —
every frosted panel in every theme simply looks slightly different.

## Rung 1 — Yunari

**Searched:** all three tracked files named `glass.ts` (the one holding the
composite is `packages/scene-fabric/src/glass.ts`; `packages/renderer-core/src/theme/glass.ts`
holds the treatment type and `packages/editor/src/selection-inspector/glass.ts`
the control that writes it); `deviceMatrix` (`glass.ts:543`) and
`planeMatrix` (`:559`); `sampleRegion` (`:581`); the inspector's Size arms
(`selection-inspector/index.ts:312-341`, which write `scaleX`/`scaleY` as
`dimension / object.width`); every other place in the repo that reduces a linear
map to one number — `render-scale.ts:41`, `scale-projection.ts:603-616`,
`rectangular-scale-gesture-projection.ts:550`; and `glass.dom.test.ts`'s radius
case, whose only scaled leg is `scaleX: 2, scaleY: 2` (`:401`) — **a uniform
scale, which is why the asymmetry was invisible to every test in the repo**.

**Found:**

- **The composite already draws in device space with an identity transform.**
  `composite()` maps the clip through `own`, then `ctx.setTransform(1, 0, 0, 1, 0, 0)`
  before setting `ctx.filter` and drawing the sampled region 1:1 (`:450-461`).
  So the radius is a device-pixel number and the transform cannot be asked to
  apply the panel's scale to it — the compensation above is the only place the
  scale can enter.
- **Two of the repo's own reductions are per-axis norms; one is an area.**
  `scale-projection.ts` norms each basis vector (`hypot(firstA, firstB)`) and then
  takes the **determinant of the normalised pair** for the scale that acts on the
  plane; `render-scale.ts` sizes a backing store by `sqrt(MAX_BACKING_PIXELS / (width * height))`
  — an area, reduced to a linear scale by a square root. So "the equal-area scale"
  is already this codebase's idiom for one number standing in for a two-axis size.
- **`hypot(own[0], own[1])` is not even a per-axis norm here.** It is the x row
  of the matrix alone; the y row (`own[2]`, `own[3]`) is never read.
- No note claimed `src/web/packages/scene-fabric/src/glass.ts` before this one
  (checked against `docs/decisions/*.md`).
- **`vg-037` ruled that the authored value must not be equalised *between
  shapes*.** That ruling is about two different outlines at one value and is not
  disturbed here: this note chooses the factor one panel's own scale multiplies
  the value by, which every panel has and which no ruling had yet fixed.

## Rung 2 — dependencies

**Searched:** Fabric 7.4.0's shipped source for a scalar under a non-uniform
scale — `shapes/Object/Object.mjs`'s `_renderStroke` (`strokeUniform`),
`getTotalObjectScaling`, `_getTransformedDimensions`, `_constrainScale`; the
installed `echarts`/`zrender` for a blur-like filter.

**Found:** **Fabric's answer is to exclude the scale, not to reduce it.**
`strokeUniform` renders the stroke under `ctx.scale(1 / scaling.x, 1 / scaling.y)`
— an inverse scale applied **per axis**, so the width stays exact on both and no
scalar is ever chosen. `getTotalObjectScaling` returns a `Point` for the same
reason. Our composite cannot copy either: its blur is a scalar in a filter string,
and its draw is at identity, so there is no axis for a counter-scale to act on.
**ECharts offers nothing to copy and one false friend**: `blur` in ECharts is a
highlight *state style*, not a filter, so searching the chart dependency for "how
a blur follows a scale" returns a name collision and no mechanism.

## Rung 3 — platform

**Searched:** the Canvas2D filter surface this code uses — `ctx.filter`'s
`blur(<length>)` and its interaction with the current transformation matrix, and
what the platform offers for a blur with two different per-axis standard
deviations; `glass.ts`'s own filter capability probe (`probeFilter`,
`filterUsable`) and `GLASS_SATURATION`'s note that `ctx.filter` is a filter list.

**Found:** **the platform cannot express the anisotropy here, and it cannot
apply the transform to the radius either.**

- `blur(<length>?)` takes **one** length for both axes. There is no two-argument
  form, so a single scalar is forced in the chosen mechanism.
- The filter is set while the transform is **identity** (`:450`, deliberately, so
  the sampled region's own coordinates are the device coordinates), so nothing in
  the platform scales the radius with the panel. The multiplication by the matrix
  is ours to get right, which is the whole of this decision.
- Canvas filters *can* name an SVG filter (`url(#f)`), and SVG's
  `feGaussianBlur` **does** take two standard deviations — that is the one
  platform route to a genuinely anisotropic blur, and it is priced in rung 5.

## Rung 4 — ecosystem

**Searched** (web, 2026-10-16 — a live search index was unavailable in this seat,
so these ran as direct fetches of named sources; the URLs are the evidence):
MDN's `feGaussianBlur` reference (`developer.mozilla.org/en-US/docs/Web/SVG/Element/feGaussianBlur`);
MDN's `stdDeviation` attribute reference (`developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stdDeviation`);
MDN's `filter-function/blur` reference (`developer.mozilla.org/en-US/docs/Web/CSS/filter-function/blur`);
MDN's `CanvasRenderingContext2D.filter` reference
(`developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter`);
Flutter's `ImageFilter.blur` (`api.flutter.dev/flutter/dart-ui/ImageFilter-class.html`
and `.../ImageFilter/ImageFilter.blur.html`); and the WHATWG canvas spec's filter
section (`html.spec.whatwg.org/multipage/canvas.html`), which the fetch truncated
before that section — recorded as a dead end rather than as a source.

**Found — the field splits in two, and the split is the decision:**

- **SVG and Flutter give the blur two axes.** `stdDeviation` "if two numbers are
  provided, the first number represents a standard deviation value along the
  x-axis. The second value represents a standard deviation along the y-axis", and
  "if `stdDeviation` is 0 in only one of X or Y, then the effect is that the blur
  is only applied in the direction that has a non-zero value". Flutter:
  `ImageFilter.blur({double sigmaX, double sigmaY})`, "the standard deviation of
  the Gaussian kernel in the X direction and the Y direction, respectively".
  **Both answer the row's question by refusing it: where a platform can carry a
  blur per axis, it is not asked to reduce two scales to one.** CSS `filter:
  blur()` is the other half of the same sentence — one `<length>`, "the value of
  the standard deviation", with MDN naming two-value SVG filters as what to reach
  for when one axis is not enough.
- **Nothing found for a scalar under a non-uniform scale.** Neither the CSS blur
  page nor the canvas `filter` page says anything about the transform or the scale
  at all — MDN's canvas `filter` page documents values and examples only. There is
  no ecosystem convention to copy for "which of the two scales does a one-argument
  blur follow", because the platforms that thought about it added a second
  parameter instead. That absence is the finding: the choice is ours.
- **The counter-example worth naming:** Flutter's two sigmas exist because Skia
  carries an anisotropic blur; the same code path under a `Transform.scale` is
  documented nowhere either, so even there the scaled case is unspecified.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `hypot(own[0], own[1])` — the transformed unit-x length | Status quo; rotation-independent; exactly today's rendering | None | `scaleY` is absent, so a 4×1 panel blurs 4× a 1×4 one at one authored value — `vg-515` itself | rejected |
| The smaller of the two axis lengths | Never over-blurs the squashed axis | One `Math.min` over two norms | A banner stretched 4× wide blurs as if it were its short side, so more panel reads as *less* glass; and a 0-scale axis collapses the blur to zero | rejected |
| The larger of the two axis lengths | Never under-blurs | One `Math.max` over two norms | The blur exceeds the panel's own short axis on a thin strip, and it is the same magnification the row reported as the defect | rejected |
| The authored value, un-scaled | One number for every panel | Deletes the device-scale compensation | The radius stops following zoom and retina, and `glass.dom.test.ts`'s viewport and retina legs are deliberate — a 0.5 zoom would blur twice as far in device pixels | rejected |
| **`sqrt(\|det\|)` — the equal-area scale of the two** | Rotation-independent, symmetric in the two axes, and **identical to today's number whenever the scale is uniform** | One `Math.sqrt` and one determinant in place of `hypot` | Chosen on the strength of that equivalence: only the asymmetric case changes | **chosen** |
| An SVG `feGaussianBlur` with `stdDeviation="x y"` via `filter: url(#…)` | The genuinely anisotropic answer, and the one SVG and Flutter take | An `<svg>` element in the document, a filter chain per panel per frame, and a `url()` filter where `blur()` is a rasteriser fast path — cost **unmeasured**, because the chosen rule is one multiplication | A slower frame for every frosted panel, in exchange for a better answer to a case that is rare | rejected |

## Rung 6 — probe

Measured with the repo's own instrument, `glass.dom.test.ts`'s radius case (which
captures `ctx.filter` through a stubbed context; `node-canvas` accepts `filter`
and ignores it, so no unit test here can show that a blur happened). Authored
radius 24, DPR 1, identity viewport, taken at `7ea353c7` **before** the change:

| panel | `ctx.filter` before | `ctx.filter` after |
|---|---|---|
| `scaleX: 4, scaleY: 1` (6 400 units² drawn) | `blur(96px)` | `blur(48px)` |
| `scaleX: 1, scaleY: 4` (6 400 units² drawn) | `blur(24px)` | `blur(48px)` |
| `scaleX: 2, scaleY: 2`, the pre-existing leg | `blur(48px)` | `blur(48px)` |

**4× apart before, equal after, and the uniform leg unchanged** — which is the
whole claim of the chosen rule: it changes nothing except the case the row named.
`blur(48px)` is `24 × sqrt(4 × 1)`, and the same value the uniform leg at scale 2
already had.

The rendered reading is `tests/e2e/glass-stretch-parity.spec.ts`: the same two
equal-area panels over the starter photograph, and the **frost's own pixel extent**
differenced against an untreated capture of the same scene. A Gaussian's extent
at one threshold is `(W + 2kσ)(H + 2kσ)`, so two panels of equal area stretched on
opposite axes are **equal by symmetry when σ is equal and unequal when it is not** —
the statistic is exact rather than suggestive, and it is the reading a person's eye
takes from the two panels side by side.

## Decision

**A panel's authored `blurRadius` is multiplied by the equal-area scale of its
device transform:**

```ts
const blurRadius =
  treatment.blurRadius *
  Math.sqrt(Math.abs(own[0] * own[3] - own[1] * own[2]));
```

- **Why this and not one of the two axes.** The radius is one number in a
  one-argument filter, and the panel's transform is two numbers; the only
  rotation-independent scalar that is *the same number* for a 4×1 panel and a 1×4
  one **and** agrees with the rule this code already had for every uniform scale is
  the square root of the transform's determinant. `Math.min` and `Math.max` fix the
  asymmetry too, but each makes a panel's glass a statement about its shorter or
  longer side; `sqrt(|det|)` makes it a statement about how much panel there is,
  which is what the radius multiplies: the sampled region's own area.
- **A rotated panel is unchanged**, because a rotation's determinant is 1 and its
  `hypot(a, b)` was the scale anyway — both rules are rotation-independent, and the
  existing rotation leg is not disturbed by this.
- **The device scale stays**: `own` already carries the viewport transform and the
  retina ratio, so the zoom and high-DPI legs of `glass.dom.test.ts` keep their
  values, and the determinant is taken over the same matrix they were measured
  through.
- **A degenerate axis is a zero radius**, not a division: `scaleX: 0` has a
  zero determinant, so the blur is off exactly as `hypot` made it off, and no
  negative determinant can produce a negative radius — `Math.abs` is taken
  before the root.

# 0015 — Glass clips any closed path; the shape decides, not the treatment

- **Date:** 2026-09-30
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/glass.ts`,
  `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`,
  `src/web/packages/scene-fabric/src/glass.ts`

## The problem

An author picks a Circle, enables Frosted glass, and nothing happens — because
`GLASS_OBJECT_TYPES` is `Rect | Group`. The tempting fix is a per-shape
allowlist, which is a list that must be edited every time Fabric grows a
primitive, and which cannot say *why* a shape is excluded.

The real question is narrower: **what does the frosted treatment actually need
from a shape?** It needs a closed path to sample the backdrop through. It does
not need to be a rectangle, and it does not need a corner radius. So the
predicate is a property of the geometry, not a roster of class names.

**This supersedes the "investigate before deciding" note in the author-journey
plan, and the user's ruling is the decision: Circle, Ellipse, Triangle and
Polygon join. Polyline, Path and Line are skipped** — an open path has no
interior to frost, and a Path is arbitrary author data whose closedness the
product cannot know.

## Rung 1 — Vigilia

Searched: `localPath` in `scene-fabric/src/glass.ts`, `GLASS_OBJECT_TYPES`,
`supportsGlass(type)`, `GLASS_TYPES`, the `scene-fabric` glass tests, the
`controls-manager` handle overrides.
Found: **`ctx.ellipse` is already in `localPath`.** It builds the rounded
rectangle's four corners through a `corner()` helper, so the file is *already*
hand-assembling a path from canvas primitives, and the primitive needed for an
ellipse is the one doing the corners today. `ctx.clip()` is path-agnostic.
**The mechanism already generalises; only the path construction is per-shape.**

## Rung 2 — dependencies

Searched: the installed `fabric@7.4.0` — `Rect`, `Circle`, `Ellipse`, `Triangle`,
`Polygon`, `Polyline`, `Line`, `Path`; `controlsUtils`; `Path#toObject`.
Found: every primitive is present, and **`Polygon` has neither `numPoints` nor
`cornerRadius`** in this version (already recorded in the plan). No new
dependency is needed and none is warranted: this is path arithmetic.

## Rung 3 — platform

Searched: `CanvasRenderingContext2D.clip()`, `ellipse()`, `Path2D`.
Found: **`clip()` takes any path** — a circle, a rounded rect and a triangle are
the same call. `Path2D` is the platform's own answer to "build a path once,
reuse it", and it is the right primitive if path construction ever gets
expensive. Not needed today: four shapes is four small `if` branches.

## Rung 4 — ecosystem

Searched: how canvas editors decide what a glass/frost material applies to —
CSS `backdrop-filter` (no path concept at all, so it cannot answer this),
`clip-path` in CSS (the same answer as `clip()`), Konva's `clipFunc`, and the
canvas-frosted-card recipes that circulate.
Found: **they do not ask.** `backdrop-filter` applies to a box; `clip-path`
takes a path; Konva takes a `clipFunc` and leaves the path to the caller. **The
ecosystem's answer is "give it a path", and the path is the caller's** — which
is exactly `localPath`'s existing job. Nobody solved a *shape policy* problem,
because there isn't one to solve: there is a path or there is not.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Per-shape allowlist of class names | works, must be edited per new primitive | grows with Fabric | silently wrong when it drifts | **rejected** — a roster where a predicate belongs |
| Teach `localPath` each closed path, keep an explicit closed-path set | the shape is closed iff the product says so | ~4 small branches | a `Path` slips in if the set is wrong | **chosen** — the set is the *geometry* claim, not a class list |
| `Path2D` + `clip()` for everything | tidy, one construction path | more machinery than four shapes need | none | held in reserve; revisit if the set grows |
| Frost open shapes too | — | — | **there is no interior** | **ruled out** by the user, and by geometry |

## Rung 6 — probe

Task 1's radius sweep held **2.5–3.7 ms/frame across 0–64 px** on rectangles,
with the cost first clearly rising at 128 px (6.44 ms), which is why 48 sits
inside the flat band. That measurement is **rectangles only**, so widening is a
**re-measure, not a free extension** — a triangle's area-to-perimeter ratio
differs from a rect's, and the sample region grows with the blur by twice the
radius on each side. The number to watch is `MAX_BACKDROP_PIXELS` (4,194,304
per panel), not the radius cap, which lives in `renderer-core` and is unchanged.

## Decision

**Glass applies to any shape the product can prove is closed — `Rect`, `Circle`,
`Ellipse`, `Triangle`, `Polygon`, `Group` — and `localPath` builds the matching
path.** The published schema widens with `GLASS_TYPES`, and
**the schema-drift guard that compares them must move with both**: it failing
when only one moves is the guard working, and it is not to be relaxed. Open
shapes keep no treatment at all, and the editor discloses that at the point of
use rather than by absence.

The cost of being wrong: a frosted triangle costing more per frame than a frosted
rect. The evidence says that is a re-measure, not a regression, and the re-measure
is part of the work.

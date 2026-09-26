# Task 7 report — port `ScaleSnappingRuntime`, bind the resize controller to `object:scaling`

Plan: `docs/superpowers/plans/2026-09-25-snapping-fidelity.md`
Brief: `.superpowers/sdd/2026-09-25-snapping-fidelity/task-7-brief.md`
BASE: `9800496371ceea19801ec637318ce2a792fcc404`

## What landed

| File | State | Note |
|---|---|---|
| `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-runtime.ts` | new (port) | fork `9efdd78a` verbatim modulo the deviations below |
| `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts` | new (fresh) | Vigilia controller, movement-controller shape |
| `src/web/packages/editor/src/snap-manager/scaling/scaling.dom.test.ts` | new | two jsdom tests + exported `SNAPPING_MULTIPLIER` for Task 8 |
| `src/web/packages/editor/src/snap-manager/index.ts` | modified | scale controller wiring, `collectSnapSources`, two exported marker/modifier readers |
| `src/web/tests/e2e/editor.spec.ts` | modified | `snaps a resized object to a neighbour and shows a guide` + three helpers |
| `docs/evidence/screenshots/editor-snap-resize-desktop-chromium.png` | new capture | resize snap with guide |
| `docs/evidence/screenshots/README.md` | modified | `Editor mechanics` row |

## Step 6 teeth check (red-before / green-after)

Break: `const marker = readMovementMarker({ event })` replaced with a per-gesture constant `gestureMarker` (the `83248dc` bug, reintroduced deliberately).

Red before:

```
passed | snaps a resize onto a neighbour's edge
failed | re-plans on every scaling step, not once per gesture
TOTAL 2 PASS 1 FAIL 1
AssertionError: expected 306 to be 310
  at scaling.dom.test.ts:122:38
```

The failing assertion is the second test's second step: with a per-gesture constant the second
step is read as a duplicate of the first and never re-planned, so the width stays at the raw 306
instead of snapping to 310. Restored → green after (see gate table).

## Gates

| Command (from `src/web/`) | Result |
|---|---|
| `npx vitest run packages/editor/src/snap-manager` | **10 test files, 153 tests, 153 passed, 0 failed** |
| `npm run typecheck` | clean, 7 workspace packages |
| `npm run lint` | clean, 342 files |
| `npm run format:check` | clean, 342 files |
| `npm run build` | clean, host bundle 155.53 kB |
| `VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "snaps a resized object" --workers=1` | 1 passed |
| `--grep "snaps a resized object\|snaps a dragged object"` | 2 passed |
| `--grep "snaps a resized object"` (no capture, after the guide assertions) | 1 passed |

The snap-manager file count is **10** (`find packages/editor/src/snap-manager -name '*.test.ts' |
wc -l`); an earlier revision of this row said 20, which is the reported *test-suite* count for the
same run (`numTotalTestSuites` counts each `describe` block, not each file). The test count was
right. The `packages/editor` package as a whole is 64 files / 474 tests.

## Step 7 — capture inspection

`docs/evidence/screenshots/editor-snap-resize-desktop-chromium.png`:

- A dashed vertical guide (`#3D8BF4`) is drawn during the resize at screen px 854, spanning the
  artboard height (scene x 1018 = the status card's left edge, the target line). Confirmed by
  pixel scan and by a 4x zoom crop. In fix round 1 this became a **CI assertion** rather than a
  one-off observation — see "Fix round 1" below.
- The no-snap control drag (same helper, target = the scene x furthest from every candidate line)
  draws **no** guide. Confirmed by the same pixel scan and crop on a temporary second capture
  (`editor-snap-resize-clear-*`, not committed) and now asserted as `guidePixels === 0`. Review
  Focus item 1 holds.

## Decisions the brief required

**1. `scaling/standard-scale-control.ts` — consume `didSideScaleSwitchToSkew`; do not consume
`isStandardRectangularScaleControl`.**

- Consumed: `didSideScaleSwitchToSkew` in `runStep`. The projection cannot see the Alt modifier,
  and the fork uses this to abandon a side handle that Fabric has turned into a skew. Without it
  a skew gesture would be planned as a resize. Because it is consumed the file is **not** dead
  code, and Task 10 does not need to dispose of it on that account.
- Not consumed: `isStandardRectangularScaleControl`. The projection's own corner-key / action /
  origin checks already reject every case the gate would; and `controls-manager`'s `OVERRIDES`
  changes only `render`, `sizeX`, `sizeY`, `offsetX`, `offsetY`, `cursorStyle` and
  `rotate.mouseDownHandler` — none of the handler / anchor fields the gate compares — so the gate
  would add a second, redundant refusal path.

**2. Group-child target — GUARDED, not documented.**

`isSupportedScaleTarget` refuses when `target.group !== undefined || target.parent !== undefined`.
The comment on it states the wrong-answer mechanism *and* that it is "guarded, not merely
documented", so it cannot be read as an endorsement of the caveat. `beginGesture` therefore
returns `null` for a group child and no session starts.

## Deviations from fork `9efdd78a` (enumerated from a diff, not memory)

Method: a token-stream diff of `scale-snapping-runtime.ts` against
`/d/git-repos/fabricjs-image-editor/src/editor/snapping-manager/scaling/scale-snapping-runtime.ts`
at `9efdd78`, normalising comments, quote style, import-specifier order, semicolons, trailing
commas and whitespace. It reports 19 divergent token ops, all in these classes:

1. Provenance line `// Ported: fork 9efdd78a <path>` added at the top.
2. Comment language: the fork's comments are Russian; the port's are English.
3. Comment **form**: five fork `/**` block comments became `//**` line comments, matching the
   existing Vigilia convention in `movement-snapping-runtime.ts`,
   `movement-spacing-correction.ts`, `spacing-chains.ts` and `spacing-patterns.ts`. Measured on
   both files: fork `grep -cF '/**'` = 25, `grep -c '//**'` = **0**; port = 25 and **5**, so the
   port carries 20 true block comments plus 5 rewritten ones. This class was **missing** from
   commit `70b5b36`'s message, whose class 2 said the fork's `//**` markers were "kept as-is" —
   a phrase false about the fork, which has none. Corrected here and in the plan's Task 7 landed
   note; `70b5b36` is pushed, so it is not amended.
4. Import specifiers: fork `'./x'` → Vigilia `"./x.js"`; specifiers sorted by Biome.
5. Formatting only: Biome's double quotes, semicolons, trailing commas, line wrapping, and the
   `ScaleRuntimeStep` union split with a leading `|`.
6. `exactOptionalPropertyTypes` widening — one site, in `resolveScalePlan`'s call to
   `resolveScaleSnapPlan`: `...(stepProjection ? { stepProjection } : {})` (the fork passes
   `stepProjection` directly).

`noUncheckedIndexedAccess` has **zero** sites in this port: the fork's
`first.length === second.length && first.every((value, index) => value === second[index])` is
byte-identical in the port; no hoisting was needed.

`scale-snapping-controller.ts` is a fresh Vigilia file, not a port, so the fork-deviation list
does not apply to it. The two files Tasks 4–6 landed are not touched by this commit.

## Unverified

- Not run: the broad full gate (`npm run test:e2e` across all projects, `npm run size`). This task
  is not a plan/milestone boundary.
- The group-child guard is exercised by a jsdom case (a `Rect` with `group`/`parent` set, no session
  starts) plus the comment; no browser test drives a resize of a child inside a *rotated or scaled*
  group. The guard refuses that case, so the gap is coverage of the refusal's motivation, not a
  wrong answer.
- The skew branch is covered on `runStep` with `shiftKey: true`; the browser path that flips
  Fabric's own action to a skew mid-drag is not driven end to end.
- An `ActiveSelection` resize is admitted by the guard but untested. Parked to Task 10.
- The guide assertions read rendered pixels along the snapped edge; they do not read the guide
  list, which is not exposed through the bridge. A guide drawn at the wrong *column* while the
  object still snapped correctly would pass — the geometry assertion covers the column indirectly,
  and this is the residual gap in the pixel check.

## Correction made during Step 7 (not a source deviation)

The first e2e draft targeted the thermal card's right edge toward the resource card's left edge
(748). It failed: the edge landed at 735. Root cause was the **test's** geometry, not the engine —
the drag starts with the thermal card's right edge at 729, only 6 scene px from
`weather-location`/`weather-details`'s right edge (735), which is inside the acquire threshold
(`SNAP_THRESHOLD 5 / zoom 0.489 ≈ 10.2`). The resolver correctly acquired the nearest line (735)
at the first step and held it, and the requested 748 was never the nearest candidate. Retargeted
to the resource card's right edge (999) toward the status card's left edge (1018), a 19 px gap
with no intervening candidate. Engine unchanged.

## Fix round 1 (review: spec PASS WITH DEFECTS, quality PASS; 0 Critical, 3 Important, 4 Minor)

Base for the re-review: `70b5b36`. Fix commit on top; `70b5b36` is pushed and not amended.

### I1 — the brief-required `ponytail:` comment (now present)

`scale-snapping-controller.ts`, in `runStep` immediately before `applyRectangularScalePlan` — the
site where refinement would go. It names the real ceiling: Fabric's own scale constraints
(`minScaleLimit`, uniform scaling, flipping) can block a constraint the resolver picked,
`verifyScalePlan` then reports it through `blockedAxes`, and the guide is silently not published.
Fails closed, which is the right first behaviour; the upgrade path is to re-solve from the geometry
Fabric actually applied, which is what the fork's selection-scale controller does at its
`runtime.refineScalePlan({ token, refinement })` call site.

### I2 — the false deviation claim (corrected in doc, not history)

The enumeration above is rewritten. Class 2 no longer claims the fork's `//**` markers were kept:
the fork has **zero** `//**` and 25 `/**`, the port has 5 `//**` and 25 `/**`, so five fork block
comments changed form. That is now its own listed class. Measured with
`grep -cF '/**'` / `grep -c '//**'` on `git show 9efdd78a:<fork path>` and on the ported file, not
from memory. The coordinator already landed the corrected list in the plan's Task 7 landed note
(`6efef10`); this report now matches it.

### I3 — the guide now has re-runnable evidence

An **assertion, not a second capture**. No new capture was added and
`docs/evidence/screenshots/README.md` is unchanged.

`editor.spec.ts` gains `guidePixelsAtSceneX(page, sceneX)`: it samples the upper canvas' own
backing store along the artboard column the guide should occupy, over the artboard's full height
plus a ±4px band (the line is ~1 device px and dashed), counting pixels within tolerance of
`GUIDE_COLOR` (`#3D8BF4`, rendered ≈ `rgb(61,139,244)`). `resizeRightHandleTo` now returns
`guidePixels`, sampled while the pointer is still down. Two assertions, both re-runnable in CI with
no `VIGILIA_CAPTURE`:

- the no-snap control: `expect(raw.guidePixels).toBe(0)` — a guide must not be drawn for a resize
  that was never snapped. Measured 0.
- the snap: `expect(snapped.guidePixels).toBeGreaterThan(100)` — measured 508 (a dashed line over
  the artboard's 720px fitted height, times the device ratio).

The existing geometry assertions are kept unchanged.

**Red before (guide publication disabled).** The break is the one the finding names — the path that
feeds guides from `verification.guides` returns `[]` instead:

```
> 2569 |     expect(snapped.guidePixels).toBeGreaterThan(100);
    Error: expect(received).toBeGreaterThan(expected)
    Expected: > 100
    Received:   0
1 failed
```

**Red before (optimistic guide — Review Focus item 1 itself).** Publishing a guide at the object's
own right edge regardless of verification, with every plan still applied and verified:

```
> 2546 |     expect(raw.guidePixels).toBe(0);
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 0
    Received: 508
1 failed
```

**Green after (restored, rebuilt):** `1 passed` for the resize case, `2 passed` with the drag case.

### M1 — gate row corrected

Above: 10 test files / 153 tests (the "20" was the suite count, not the file count).

### M2 — the group-child guard has a test

`scaling.dom.test.ts`: `refuses a group child, whose bounds plane is the group's`. `setup` gains a
`grouped` option that puts the resized `Rect` inside a `Group([resized], { subTargetCheck: true,
interactive: true })`; Fabric's own `_enterGroup` sets both `group` and `parent` on the child,
which is what `isSupportedScaleTarget` reads. The step that snaps in the first test must leave the
raw 306 here.

Red before (guard's clause removed):

```
failed - refuses a group child, whose bounds plane is the group's
AssertionError: expected 310 to be 306 // Object.is equality
```

### M3 — the skew branch has a test on `runStep`, and the comment says Shift

`scaling.dom.test.ts`: `abandons the plan when the side handle becomes a skew`. A step whose pointer
event carries `shiftKey: true` must leave the raw 306 — Fabric's `altActionKey` defaults to
`"shiftKey"`, which is the key the guard reads.

Red before (`didSideScaleSwitchToSkew`'s refusal neutered to a no-op):

```
failed - abandons the plan when the side handle becomes a skew
AssertionError: expected 310 to be 306 // Object.is equality
```

The comment in `runStep` now reads "Fabric's alt-action key is Shift (its value, not its name)" so
a reader cannot expect Alt.

### Restored and re-gated

All three breaks were reverted; the full snap-manager suite is 10 files / 153 tests / 153 passed /
0 failed, and the gates table above is post-restore. `editor.spec.ts` was rebuilt (`npm run build`)
before every browser claim and again after the last restore.

### Parked (not this round)

An `ActiveSelection` resize is admitted by `isSupportedScaleTarget` via
`isSupportedActiveSelection` and untested; if Fabric fires `object:scaling` with a per-child
`target` for a multi-selection, `runStep` ends the session and the resize silently stops snapping.
Needs a real multi-selection resize driven in a browser. Parked to Task 10 by the coordinator.

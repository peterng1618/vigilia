# Pre-flight conflict scan — `docs/superpowers/plans/2026-09-25-snapping-fidelity.md`

**Scan revision:** `sha256 f04b7d5efad2dccd0b0684dc741978e3073d920e5b2e15d9b4c16ef4422e6f1e`,
1312 lines. The plan was **edited on disk during this scan** (`git diff HEAD` = +65/−24,
mtime 03:28). Every earlier finding it already fixed is listed in §"Employed vs outstanding"
so the controller does not re-dispatch work that has landed. **Line numbers below are for
that revision only** — re-hash the file before acting on any of them.

Scan type: read-only. No repo file was modified. Probe files were created under
`src/web/packages/editor/src/snap-manager/__scan-probe*.dom.test.ts`, run, and deleted;
`git status --porcelain src/web/packages/editor/src/snap-manager/` is empty and a
repo-wide `find -name '__scan-probe*'` returns nothing.

Fork facts verified at `9efdd78a342a29f169a8dbf1da78c95bbf1ffe77` via
`git -C D:/git-repos/fabricjs-image-editor show` / `ls-tree` only. No branch change, no
write, no fetch, no `checkout`/`switch`/`restore`/`clean`/`reset`.

---

## Probe ledger (question asked → result observed)

Vitest runs node-environment by default (`src/web/vitest.config.ts:9`). `*.dom.test.ts`
files are still matched by the `packages/*/src/**/*.test.ts` glob; the `.dom.` infix is a
naming convention, and jsdom comes only from the `// @vitest-environment jsdom` docblock
(no such glob exists). Probes that omit it fail `ReferenceError: document is not defined`.
Observations were written to `process.env.SCAN_OUT` with `writeFileSync` because the
Vitest JSON reporter truncates nested diffs.

| Probe | Question | Observed result |
|---|---|---|
| P0 | Do the plan's Task 1 / Task 3 fixtures run as written? | All need the jsdom docblock; without it they fail on `document is not defined`. Purely a harness detail. |
| P1 | Does the current `isSnapTarget` gate explain Task 1's first test failing? | **Yes.** Variant matrix on the original geometry: neighbour with no flags → `100` (snaps); neighbour `locked: true` only → `98` (no snap); neighbour `selectable: false` only → `98` (no snap). Either clause excludes it, so the plan's stated mechanism is real. |
| P2 | Did the **original** plate fixture (`plate 0,0,400,300`, dragged `left 178`) fail *because of the plate*? | **No.** `179.5` with the plate, `179.5` with the plate deleted, `179.5` with the plate at four other geometries. The plate was redundant with the artboard `bounds()`, and the artboard's centreX 200 pulled the object. The assertion `178` was unreachable before and after the task. |
| P3 | Did the original hidden-neighbour test pass before any change? | **Passed** (`98`, unmodified code) — a valid regression guard, not a new behaviour. |
| P4 | Does the original first test pass once the filter is relaxed? | Not directly measurable read-only; confirmed indirectly by P1 (the gate is the only thing excluding the neighbour). |
| P5 | Original Task 3: does a step to `203` leave the object at `200`, and is that the hold? | `203 → 200` — but the result was **not** a clean T3 measurement (see P13). |
| P6 | Is there a Task 3 step that *is* discriminating? | `208`: `208 → 208` empirically on the neighbours fixture, i.e. the hold had released. |
| P7 | Was the original `expect(active.left).toBe(250)` reachable? | **No** — `249.5`. The object followed the pointer but landed half a unit short. |
| P8 | Are Task 2's ActiveSelection fixtures reachable? | Yes: `twoCount 2`, `oneCount 1`; `group.getObjects()[0].parent` truthy; `new ActiveSelection([groupChild, rect])` length 2 with `[true, false]` parents; `new ActiveSelection([Textbox, Rect]).set({scaleX:1.5})` retains 1.5. `Group.getObjects()[0]` is a plain `FabricObject`, so the parented fixture needs `import { Group }`. |
| P9 | Re-check: is the original first test unreachable because the locked neighbour aligns with *itself*? | **No — that earlier reasoning was wrong.** Measured `locked: true, selectable: false` → `98`; the neighbour is excluded by the gate, not by a self-alignment tie-break. Corrected. |
| P10 | Plate-geometry sweep on the original fixture: does any plate bound change the answer? | `0,0,360,280`, `0,0,240,300`, `12,9,376,282`, `0,0,200,300`, and no plate at all all give `179.5`. No plate geometry could satisfy the original assertion. |
| P11 | Do the **revised** Task 1 fixtures behave as the revised plan claims? | **Yes.** New locked fixture (dragged width 12): as written `98` (Step 2 correctly expects FAIL), simulated-relaxed `100` (Step 4 correctly expects PASS). New plate fixture (plate `40,30,240,180`, centreX 160; dragged `left 158`): as written `158`; with the plate admitted → `160.5`, so Step 5's "empty `IGNORED_IDS` → the plate test fails" is a real, observable failure. |
| P12 | Hold-boundary sweep on the revised Task 3 fixture (`200` then an offset). | Boundary at **206**: `200, 201, 203, 204, 205 → 200`; `206 → 206`, `207 → 207`, `208 → 208`, `215 → 215`. |
| P13 | Is the `200` in Task 3's fixture the *spacing` hold, or the artboard guide? | **It is the artboard guide.** Re-running the fixture with `bounds()` centreX moved to 500 (far from 200) gives `203 → 203`, `205 → 205` — no hold at all. With centreX 200 the identical result appears **with the two spacing neighbours deleted**. The plan's revised fixture measures the artboard's centreX guide, not equal spacing. |

---

## Fork-symbol audit

Every symbol the plan tells an implementer to port, checked at `9efdd78a`. Result: **all
exist with the claimed signature; no invented name.** This is the highest-value check and
it is clean.

### Task 4 — `scaling/scale-snap-candidates.ts` (130 lines — matches)

| Symbol | Fork | Verdict |
|---|---|---|
| `ScaleSnapCandidateSource` | `:13-17` | Exact |
| `ScaleSnapEnvironment` | `:20-23` | Exact |
| `createScaleSnapCandidates` | `:36-42` | Exact |

### Task 4 — `scaling/scale-projection.ts` (526 lines — matches)

`ScaleSceneAxis` `:5`, `ScaleSceneEdge` `:8`, `ScaleProjectionVariable` `:11`,
`createScaleProjection` `:82-88`, `getScaleProjectionEdge` `:116-122`,
`projectScaleEdgePositions` `:129-135`, `resolveScaleProjection` `:149-159`,
`getScaleProjectionCorrectionMagnitude` `:176-184`, `resolveScaleSceneEdgeAxis` `:201` —
**all exact.**

### Task 5 — `scaling/scale-snapping-resolver.ts` (1269 lines — matches)

`ScaleSnapThresholds` `:85-90`, `ScaleSnapModifiers` `:111-114`, `ScaleRawIntent`
`:117-121`, `ScaleSnapCandidateCategory` `:25`, `ScaleSnapCandidate` `:55-62`,
`ScaleHoldState` `:79-82`, `PlannedScaleConstraint` `:163-168`, `ScaleSnapConstraints`
`:130-133`, `ScaleSnapPlan` `:171-184` (all thirteen properties), `FinalScaleGeometry`
`:197-202`, `VerifiedScaleGuide` `:205-212`, `ScaleSnapVerification` `:215-219`,
`FREE_SCALE_HOLD_STATE` `:256-259`, `SCALE_SNAP_VERIFICATION_EPSILON` `:236` (= `0.1`),
`createScaleGestureBaseline` `:264-270`, `resolveScaleSnapPlan` `:288-297`,
`refineScaleSnapPlan` `:342-348`, `verifyScaleSnapPlan` `:427-434`,
`ScaleSnapPlanRefinement` `:153-157` — **all exact.** The Ctrl short-circuit the plan
cites is real: `scale-snapping-resolver.ts:305-311` returns the disabled plan when
`intent.modifiers.ctrlKey`.

### Task 5 — `scaling/scaling-snap-guard.ts` (65 lines — matches)

`SNAP_GUARD_POSITION_EPSILON` `:2` (`0.1`), `SOURCE_SCALED_GUIDE_HOLD_EPSILON` `:5` (`1`),
`getBoundsSnapGuardDistance` `:23-37` — exact and genuinely absent from Vigilia.

### Task 5 — `scaling/scaling-step-snap-guards.ts` (1281 lines — matches)

### Task 6 — `scaling/rectangular-scale-gesture-projection.ts` (849 lines — matches)

`RectangularScaleControlKey` `:14`, `RectangularScaleGestureMode` `:17`,
`RectangularScaleGestureTransform` `:41-51`, `RectangularScaleGestureProjection` `:70-80`,
`createRectangularScaleGestureProjection` `:412-420`, `resolveRectangularScaleMultipliers`
`:177-182`, `resolveRectangularScalePointerMultipliers` `:543`, `projectRectangularScaleBounds`
`:609-617`, `resolveRectangularScaleModeProjection` `:732-739`,
`createRectangularScaleProjectionModes` `:809-815`, `resolveRectangularScaleMovingEdges`
`:834-839` — **all exact.** Also present and relied on by Task 7: `RectangularScaleMultipliers`
`:35`, `RectangularScalePoint` `:29`, `RectangularScaleModeProjection` `:62`,
`createRectangularScaleValues` `:162`.

### Task 6 — `scaling/rectangular-scale-interaction.ts` (294 lines — matches)

`resolveRectangularScaleStepInput` `:45`, `applyRectangularScalePlan` `:74-105`,
`readAppliedRectangularScaleMultipliers` `:108`, `readFinalRectangularScaleGeometry` `:124`,
`resolveRectangularScaleGestureMode` `:165`, `createRectangularScaleIntent` `:236` — all exact.

### Task 6 — `scaling/standard-scale-control.ts` (83 lines — matches)

`isStandardRectangularScaleControl` `:33-39`, `didSideScaleSwitchToSkew` `:64-72` exist;
`STANDARD_RECTANGULAR_SCALE_CONTROLS` `:10-12` is **module-private** (see O8).

### Task 7 — `scaling/scale-snapping-runtime.ts` (372 lines — matches)

`ScalePlanToken` `:19-22`, `PlannedScaleRuntimeStep` `:25-29`, `DuplicateScaleRuntimeStep`
`:32-38`, `ScaleRuntimeStep` `:41`, `ScaleRuntimeCleanup` `:44-47`, `class ScaleSnappingRuntime`
`:81` with all six methods and signatures — exact. The throw text the plan quotes is
verbatim at `:140`. `EMPTY_SCALE_RUNTIME_CLEANUP` `:72-75` backs the plan's
"`finishSession` returns `didCleanup: false` when there is no session" claim.

**Non-port claims spot-checked:** fork `_isSupportedActiveSelection` body at
`movement-snapping-controller.ts:180-197` (exact); `resolveMovementMarker({ event })` at
`:127` (exact); `object-filter.ts` `shouldIgnoreObject` at `:29-47` and
`IGNORED_IDS = ['montage-area','background','interaction-blocker']` at `:3` (exact); all
quoted line counts for `scale-projection.ts` (526), `scale-snapping-resolver.ts` (1269),
`rectangular-scale-gesture-projection.ts` (849), `scaling-step-snap-guards.ts` (1281),
`scale-snapping-runtime.ts` (372), `standard-scale-control.ts` (83),
`rectangular-scale-interaction.ts` (294), `scale-snap-candidates.ts` (130) exact.

---

## Table 1 — pair scan

| Tasks | Shared interface | Producer → consumer | Finding |
|---|---|---|---|
| 1 ↔ 3 | `index.dom.test.ts` / new `spacing-hold.dom.test.ts`, both via `createSnapManager` | Task 1 changes which objects are candidates for every gesture; Task 3's fixture depends on the candidate set | No textual conflict. Semantically coupled: Task 3's `200` value comes from the **artboard** boundary source (`index.ts:132-143`), which Task 1 does not touch — so Task 3's result is unchanged by Task 1, and the fixture's independence from Task 3's stated mechanism is the defect (O4). |
| 1 ↔ 7 | `IGNORED_IDS` / `shouldIgnoreObject` | Task 1 sets `IGNORED_IDS = ["scene"]`; Task 7 builds `sources` the way `startGesture` does | Consistent. Task 7's citation of `index.ts:126-143` is accurate (`:126-131` source loop, `:132-143` artboard push). |
| 1 ↔ 2 | `index.ts` `startGesture` body | Task 1 relaxes `isSnapTarget`; Task 2 adds an early return before the bounds read | No overlap: Task 2's guard returns before the sources loop, so a refused selection never reaches Task 1's predicate. Order-independent. |
| 2 ↔ 7 | `isSupportedActiveSelection` import into `index.ts` | Task 2 creates the module and calls it from `index.ts`; Task 7 also builds sources in `startGesture` | **Outstanding (O2).** Task 2 Step 4 states only the `ActiveSelection` *value* import; the import of `isSupportedActiveSelection` into `index.ts` is never specified. Caught by the compiler. |
| 2 ↔ 7 | `readMovementModifiers` | Task 2 uses it implicitly; Task 7 "widens" it to return `shiftKey`; Task 8 reuses it | Consistent in intent, and the ordering is stated in Task 8 ("Task 7 already widened"). Outstanding detail: the helper is **module-private** to `index.ts` and both Task 7 and Task 8 call it from `scaling/` — see O1. |
| 2 ↔ 8 | widened modifier type | Task 7 produces `{ctrlKey, shiftKey}`; Task 8 consumes | Consistent. |
| 3 ↔ 1 | `constants.ts` | Task 3 may delete `SPACING_CONTEXT_SWITCH_DISTANCE`; Task 1 does not touch the file | No conflict. |
| 3 ↔ 5 | guard constants | Task 3 edits `constants.ts`; Task 5 asks to add `SNAP_GUARD_POSITION_EPSILON`, `SOURCE_SCALED_GUIDE_HOLD_EPSILON`, `getBoundsSnapGuardDistance` to it | Same file, sequential tasks, no overlapping lines. Outstanding wording issue in Task 5's source of those constants (O5). |
| 4 ↔ 5 | `scale-snap-candidates.ts` imports candidate types from `scale-snapping-resolver.ts`; Task 5 "Produces" defines `refineScaleSnapPlan` | Task 4 file list names only the two pure modules | Consistent, and the real import direction is stated correctly at the plan's note. The `refineScaleSnapPlan` return type is now correct (`:690-692`). |
| 4/5/6 ↔ 7 | `ScaleRawIntent`, `ScaleSnapPlan`, `ScaleSnapVerification`, `ScaleHoldState`, `ScaleStepProjectionInput`, `ScalePlanToken`, `ScaleSnapPlanRefinement`, `FinalScaleGeometry`, `VerifiedScaleGuide`, `ScaleProjectionModeInput`, `ScaleSnapCandidateInput` | Tasks 4–6 produce; Task 7's controller consumes | All verified present at `9efdd78a`. Task 7 now calls `applyRectangularScalePlan` / `createRectangularScaleValues` / `readFinalRectangularScaleGeometry` rather than hand-rolling — the earlier defect there is fixed. |
| 6 ↔ 7 | `createRectangularScaleProjectionModes`, `resolveRectangularScaleMovingEdges`, `createRectangularScaleGestureProjection`, `projectRectangularScaleBounds` | Task 6 produces; Task 7 consumes | Consistent with the fork. Task 6 Step 3 now builds `projectionModes` from `createRectangularScaleProjectionModes({ projection })` explicitly. |
| 7 ↔ 8 | `scaling.dom.test.ts` and `SNAPPING_MULTIPLIER` | Task 7 defines and exports it; Task 8 imports it | **Consistent** — `export const SNAPPING_MULTIPLIER = 1.19;` now exists at `:1021` with a comment that Task 8 imports it, and Task 7's harness returns the raw width so the Ctrl assertion is no longer satisfied by setup (earlier defect fixed). |
| 7 ↔ 9 | marker rule and capture registration | Task 7 Step 4 binds; Task 9 asserts the matrix | Consistent. Task 7's end-of-resize binding defect is fixed (`:1054` now says explicitly **do not** add one and cites the real `object:*` event keys by line). |
| 7 ↔ 10 | `scale-snapping-runtime.ts` provenance line | Task 7 creates it; Task 10 accepts the port | Consistent. Outstanding wording in Task 7's file list (O7). |
| 9 ↔ 10 | capture registration table | Both edit `docs/evidence/screenshots/README.md:34` | Same row, sequential tasks. Do not dispatch in parallel. |

---

## Table 2 — self-consistency scan

| Task | Self-consistent? | Finding |
|---|---|---|
| 1 | **Yes**, after the live edit. | Step 2's failure reasons are now correct and measurable (P11: `98` vs an expected `100`; `158` vs `160`). Step 5's teeth check names the exact actual values (`expected 98 to be 100`, `expected 160 to be 158`) and is now genuinely observable (P11 simulated-relaxed `100`; plate admitted `160.5`). Step 6's citation is corrected to `new-fabric-theme.ts:320-330` with `:15-19` named as the style constant. The only residue is the standalone sentence at `:500` (O9). |
| 2 | **No — one omission.** | Step 4 specifies the `ActiveSelection` **value** import correctly and explains the swallowed-`TypeError` consequence well, but never instructs the import of `isSupportedActiveSelection` into `index.ts` (O2). Catches itself as a "Cannot find name" compile error. |
| 3 | **No — the fixture does not measure what it claims (O4).** | Step 1's offsets (`200`, `208`, `215`) are now well chosen *in isolation* (P12: boundary at 206), and Step 2's "do not wire `SPACING_CONTEXT_SWITCH_DISTANCE` in" branch is now correct and cites `movement-snapping-resolver.ts:886` accurately. But P13 shows the `200` values are produced by the artboard centreX guide, not by equal spacing: with `bounds()` centreX moved off 200 the same fixture yields `203 → 203`, `205 → 205`; with centreX 200 and the two spacing neighbours deleted it yields `200, 200`. The fixture therefore cannot distinguish the mechanism it is named for. Two smaller residues: the header comment still says "Three equal-width shapes" where widths are 60/60/40 (`:351`, O3), and Step 1's y-geometry (neighbours `top 40 h 100`, active `top 180`) means the three objects do not y-overlap, which the spacing neighbour path requires. |
| 4 | **Yes.** | File list, permitted-diff rule and the candidate/resolver split are all coherent; Step 3's example is sound; the plate-free type-import tension is stated and correctly resolved. One unresolved "or" in the prose (port the shared types here, or move `createScaleSnapCandidates` into Task 5) remains, but it forbids the bad option explicitly. |
| 5 | **Mostly yes**, two wording defects. | Every ported symbol is exact, `refineScaleSnapPlan`'s return type is now correct (`:690-692`), and the three genuinely-absent constants are correctly identified. O5: the constants are said to come "from the fork's `snapping-manager/constants.ts`" — they do not; they are defined in `scaling/scaling-snap-guard.ts`, and the fork's `constants.ts` holds only the same seven Vigilia already has. O6: `scaling-step-snap-guards.ts` is said to import "only Fabric, geometry helpers and constants"; it also imports six symbols from `./scaling-snap-guard`. |
| 6 | **Yes**, with O8. | Every symbol exact; the `["bottom","right"]` edge expectation is genuinely discriminating (the mode filter drops near-zero coefficients for `left`/`top` on a `br` control); Step 2's warning about `isStandardRectangularScaleControl` returning false if Vigilia replaces the default controls is a real risk the step correctly asks to check first. O8: the "extend `STANDARD_RECTANGULAR_SCALE_CONTROLS`" option is not actionable — the fork's constant is module-private; the plan now notes this and the marker requirement, which is the right resolution. |
| 7 | **No — two omissions, both compile-caught.** | The runtime port, the marker rule, the guide-gating rule, the apply/verify section and the bindings section are all now correct and cite the fork accurately. O1: the controller is told to call `readMovementMarker({ event })` and to widen/reuse `readMovementModifiers({ event })`, but both are module-private to `index.ts` (`:66-79` and `:82-93`; only `SnapManager`, `SnapManagerOptions`, `createSnapManager` are exported). O7: the file list says the runtime ports "minus its `ImageEditor` coupling"; `scale-snapping-runtime.ts` has no `ImageEditor` import at all. |
| 8 | **Yes**, with O1. | The Ctrl test now compares the raw width the helper produced against the width the controller leaves, and the step text explicitly requires the two to differ and the test to be shown failing with snapping disabled. The Ctrl short-circuit claim is verified true. Outstanding: it consumes a module-private helper (O1). |
| 9 | **Yes.** | Its instructions (assert pixels, not `byteLength`; register the capture; no `toBeGreaterThan`) are correct, and it explicitly bans the weak assertion the fidelity gap shipped behind. |
| 10 | **Yes**, with O10. | Script list, requirement markers and the behaviour-review restructuring all check out. O10: Step 4 says "flip the spec's status line from `design; not yet planned`"; the spec's line 3 already reads "planned; see [the snapping fidelity plan]". |

---

## Outstanding defects

Ordered by severity. Each verified against real source or a recorded probe.

### O1 — Tasks 7 and 8 call two helpers that are module-private to `index.ts`

**Plan:** `:1029` (uses `readMovementModifiers({ event })` from the controller, citing
`index.ts:81-93`), `:1037` (uses `readMovementMarker({ event })`), `:1115` (Task 8
reuses the same helper).

**Evidence:** `src/web/packages/editor/src/snap-manager/index.ts:66-79` defines
`readMovementMarker` and `:82-93` defines `readMovementModifiers`, both as bare
`function` declarations with no `export`. The module's only exports are `SnapManager`,
`SnapManagerOptions` and `createSnapManager`. The new controller lives at
`snap-manager/scaling/scale-snapping-controller.ts`, a different module, so both calls
are unresolved.

**Correction (smallest):** add one step instruction to Task 7 Step 3: "export
`readMovementMarker` and `readMovementModifiers` from `index.ts` (they are currently
module-private) and import both in the controller." Task 8's Consumes line then needs no
change, since it already points at `snap-manager/index.ts:81-93`.

**Would an implementer catch it?** Yes — as a compile error (`Cannot find name` /
`has no exported member`). Low risk, but both tasks would stall on the same missing line,
so it is worth one sentence.

### O2 — Task 2 Step 4 never imports `isSupportedActiveSelection` into `index.ts`

**Plan:** `:294` (the guard calls `isSupportedActiveSelection({ selection: active })`),
`:298-303` (the only import instruction names `ActiveSelection`).

**Evidence:** `selection-eligibility.ts` is created by Task 2 Step 3 and never mentioned
again in the plan except in the test file and the commit list. `index.ts` has no import of
it, and `index.ts:1` currently imports only `Canvas` and `FabricObject`.

**Correction (smallest):** extend the Step 4 import snippet at `:300-303` with
`import { isSupportedActiveSelection } from "./selection-eligibility.js";`.

**Would an implementer catch it?** Yes, as a compile error.

### O3 — Task 3 Step 1 comment misdescribes the fixture's widths

**Plan:** `:351` — `/** Three equal-width shapes with the active one between them… */`

**Evidence:** `:352-354` creates two 60-wide anchors and a 40-wide active object. (The
plan's own next comment, "a 120 gap that a 40-wide object splits evenly at 200", is
correct and describes the real geometry.)

**Correction (smallest):** "Two 60-wide anchors with a 40-wide active object between
them."

**Would an implementer catch it?** No; comments are not compiled. Cosmetic.

### O4 — Task 3 Step 1's fixture measures the artboard guide, not the spacing hold

**Plan:** `:341-405` (fixture), `:418-422` (Step 2's decision tree), `:386-393` (the
"must land PAST the acquire threshold and INSIDE the release threshold" comment).

**Evidence:** P13. Running the plan's fixture unchanged but with `bounds()` centreX moved
from 200 to 500:

| `bounds()` centreX | step `203` | step `205` | step `206` | step `208` |
|---|---|---|---|---|
| **200** (the fixture) | `200` | `200` | `206` | `208` |
| **500** | `203` | `205` | `206` | `208` |

With centreX 200 the same `203 → 200` / `205 → 200` / `206 → 206` pattern also appears
when the two spacing neighbours are **deleted entirely**, so the neighbours are not what
produces the hold. The plan's revised comment claims the mechanism is `SNAP_THRESHOLD = 5`
against `spacingRelease = 10` — a 10-unit window ending at 210 — but the measured boundary
is 206 (a 6-unit window), which is the artboard centreX guide's own threshold, not the
spacing release. The fixture cannot tell the two mechanisms apart.

**Correction (smallest):** put the equal-spacing optimum somewhere the artboard guide is
not. Either move `bounds()` off centre (e.g. `right: 1000, centerX: 500`) so the artboard
contributes no candidate near 200, or shift the anchors so their equal-spacing position is
not the artboard centre — e.g. anchors at `left 120 w 60` (ends 180) and `left 300 w 60`
(starts 300) give an equal-spacing position of 220 for a 40-wide object, which the centreX
200 guide does not pin. Then re-measure the release boundary; do not assume it is 206.

**Would an implementer catch it?** No. Both steps pass, Step 2 reads "Both pass → hold
state provides the stickiness" — the intended conclusion — on evidence that does not
support it, and Step 3 then deletes two exports on that basis.

### O5 — Task 5 puts the guard constants in the wrong source file

**Plan:** `:719` — "port them from the fork's `snapping-manager/constants.ts` into
`snap-manager/constants.ts`".

**Evidence:** fork `scaling/scaling-snap-guard.ts:2` and `:5` define
`SNAP_GUARD_POSITION_EPSILON` and `SOURCE_SCALED_GUIDE_HOLD_EPSILON` in that module, and
`:23-37` defines `getBoundsSnapGuardDistance`. The fork's
`snapping-manager/constants.ts` contains only the same seven constants Vigilia already
has (`SNAP_THRESHOLD`, `GUIDE_COLOR`, `GUIDE_WIDTH`, `MOVE_SNAP_STEP`, `CENTERING_STEP`,
`SPACING_CONTEXT_SWITCH_DISTANCE`, `SPACING_SNAP_HOLD_MARGIN`). The values the plan quotes
are correct; only the file is wrong.

**Correction (smallest):** replace "from the fork's `snapping-manager/constants.ts`" with
"from the fork's `scaling/scaling-snap-guard.ts`".

**Would an implementer catch it?** They would not find the constants in the cited file and
would have to search. Self-correcting, but it costs a dispatch interruption.

### O6 — Task 5's "imports only Fabric, geometry helpers and constants" omits a module

**Plan:** `:704` — "`scaling-step-snap-guards.ts` imports only Fabric, geometry helpers and
constants on the fork side, so it ports with import rewrites alone."

**Evidence:** fork `scaling-step-snap-guards.ts:1-22` imports `FabricObject, Transform`
from `fabric/es`; `getObjectBounds, getObjectExactBounds, ObjectBounds` from
`../../utils/geometry`; and a six-symbol block from `./scaling-snap-guard`, plus a
re-export of `ScalingStepSnapGuard`. It also defines four module-level epsilons of its own.

**Correction (smallest):** add `./scaling-snap-guard` to that sentence, and name it as a
same-task dependency so the port order (guard module first) is explicit.

**Would an implementer catch it?** Yes, as an unresolved import — provided the guard module
is ported first.

### O7 — Task 7 says the runtime ports "minus its `ImageEditor` coupling", but it has none

**Plan:** `:873` — "`scale-snapping-runtime.ts` (fork: 372 lines, minus its `ImageEditor`
coupling)".

**Evidence:** the fork's `scaling/scale-snapping-runtime.ts` imports only from
`./scale-snapping-resolver`; there is no `ImageEditor` reference in the file. The
`ImageEditor` coupling the plan is thinking of lives in
`image-scale-snapping-controller.ts`, which the plan correctly excludes two paragraphs
later.

**Correction (smallest):** delete the parenthetical. The line count (372) is correct as
written, so nothing else changes.

**Would an implementer catch it?** No. It reads as a licence to remove something that
is not there; worst case they strip a `protectedStatePreserved` concern that Task 7 Step 3
item 6 separately (and correctly) tells them to supply. Cosmetic-to-confusing.

### O8 — Task 6 Step 2's "extend `STANDARD_RECTANGULAR_SCALE_CONTROLS`" is not actionable

**Plan:** `:820` region (the option list).

**Evidence:** fork `standard-scale-control.ts:10-12` declares it without `export`. The
plan's added note now names this correctly and requires a `// ported:` marker for the edit,
which is the right resolution — recorded here so the controller knows it is answered.

**Would an implementer catch it?** Yes, as a compile error on import.

### O9 — a paragraph from Task 4 is duplicated inside Task 4's own listing

**Plan:** `:500` — "The scaling subsystem is the headline gap…" appears immediately after
Task 4's note about import direction, and again as Task 4's opening paragraph at `:493`.

**Evidence:** the two paragraphs are identical and both sit inside the Task 4 section
(`:490`–`:502`).

**Correction (smallest):** delete the second occurrence at `:500`.

**Would an implementer catch it?** No; harmless duplication, but it makes the task read as
if it restarts halfway through.

### O10 — Task 10 Step 4 quotes a spec status line that no longer exists

**Plan:** `:1263` — "flip the spec's status line from `design; not yet planned` to name this
plan."

**Evidence:** `docs/superpowers/specs/2026-09-25-snapping-fidelity.md:3` already reads
`- **Status:** planned; see [the snapping fidelity plan](../plans/2026-09-25-snapping-fidelity.md)`.
No line contains "design; not yet planned".

**Correction (smallest):** change the instruction to "confirm the spec's status line names
this plan and flip it to *implemented* when the last task lands", or delete the sentence.

**Would an implementer catch it?** Yes — the text is not found. Cheap, but it is a step
whose stated precondition cannot be met, and the step's authors may then guess.

---

## Unverified suspicions

Not counted as defects; each is something I could not confirm with `file:line` evidence.

1. **Task 7's `pointer` is claimed to be the scene point.** Plan `:1035` says Fabric's
   `BasicTransformEvent.pointer` "is the scene point, which is the `pointerStart`
   argument". Fabric's `TPointerEventInfo` types `pointer` from the pointer event and the
   fork derives its pointer-projection source from `event.scenePoint`. The fork's
   `createRectangularScaleGestureProjection({ transform, pointerStart })` expects a scene
   point. I did not confirm whether Fabric 7.4.0 populates `pointer` in scene coordinates
   for `object:scaling`, and probing it needs a real pointer pipeline jsdom does not have.
   **This is the one remaining claim I could not settle**, and it affects whether the
   ported projection receives the right origin — worth a browser assertion early in
   Task 7 rather than at Step 7.
2. **Task 9 registers captures through `captureVisualReview`, whose only assertion is
   `expect(screenshot.byteLength).toBeGreaterThan(1000)`** (`tests/e2e/editor.spec.ts:1723`).
   Task 9 exists to replace that, so this may be intended; I did not confirm whether the
   helper applies a stronger check elsewhere.
3. **Task 1 Step 6's browser check may be inconclusive.** It asks the implementer to
   confirm no guide appears against the artboard plate "except at the true artboard edges".
   The artboard itself is pushed as a `domain-boundary` source unconditionally
   (`index.ts:132-143`), and I did not verify that the starter theme's plate
   (`1280x720` at `(0,0)`) coincides with the artboard `bounds()`, which would make the two
   indistinguishable on screen.
4. **Task 10 Step 3's fallback decision** is correctly left open by the plan; I confirmed
   only that the four helper modules exist under `src/editor/snapping-manager/`. Not a
   defect.
5. **Task 10 Step 1's script list** matches `package.json`
   (`format:check`, `lint`, `typecheck`, `test`, `build`, `size`, `test:e2e` all present),
   and Step 2's two known-failing titles are real strings in
   `tests/e2e/display-fabric.spec.ts` — I did not re-run the suite to confirm they still
   fail at this revision.

---

## Verdict per task

| Task | Verdict |
|---|---|
| 1 | **Clean.** The live edit fixed the geometry, the assertions and Step 5's teeth check; P11 confirms both fixtures now fail for the stated reason before the change and pass after it. |
| 2 | **One omission (O2).** The guard, its dropped clause and its consequence are all correct and the fixtures are reachable (P8); only the `index.ts` import line is missing. Compile-caught. |
| 3 | **Not clean (O3, O4).** The offsets and the `switchDistance` warning are now right, but the fixture's `200` values come from the artboard centreX guide rather than equal spacing (P13), so Step 2's tree reaches its intended conclusion on evidence that does not support it and Step 3 deletes two exports on that basis. |
| 4 | **Clean**, with one duplicated paragraph (O9) and one deliberately unresolved "or" that explicitly forbids the bad option. |
| 5 | **Nearly clean (O5, O6).** Every ported symbol exact, `refineScaleSnapPlan` corrected; the two defects are wrong citations for real facts, both self-correcting. |
| 6 | **Clean.** All eleven symbols exact, the `["bottom","right"]` expectation genuinely discriminating, and the module-private constant now correctly noted (O8). |
| 7 | **Nearly clean (O1, O7).** The heaviest task's fresh code is now right — it calls the ported applier instead of hand-rolling it, and it adds no nonexistent binding. Both defects are a missing export line and a stale parenthetical. |
| 8 | **Clean**, gated on O1's export. The Ctrl test no longer passes by construction. |
| 9 | **Clean.** Correct instructions, correct citations, and it is the task that closes the `byteLength` hole. |
| 10 | **Clean**, with one stale quotation (O10). |

---

## Employed vs outstanding — do not re-dispatch these

The live edit already fixed, with evidence in this scan: the Task 1 locked-neighbour
geometry (verified fixed, P11), the Task 1 plate fixture and its `IGNORED_IDS` teeth check
(verified fixed, P11), the Task 1 hidden-neighbour labelling and the `new-fabric-theme.ts`
citation, the Task 2 `import type` → value import, the Task 3 offsets and the
`Number.POSITIVE_INFINITY` warning, `refineScaleSnapPlan`'s return type,
Task 7's apply/verify section, `SNAPPING_MULTIPLIER`'s definition and export, Task 7's
`object:scaled` binding (replaced by an explicit "do not add one" with the real event keys
cited), the `STANDARD_RECTANGULAR_SCALE_CONTROLS` note, and the fence imbalance at the old
line 953.

Still outstanding: **O1, O2, O3, O4, O5, O6, O7, O9, O10** — O4 is the only one that will
silently cost an implementer a wrong conclusion; O1 and O2 stall two dispatches each and
are compile-caught.

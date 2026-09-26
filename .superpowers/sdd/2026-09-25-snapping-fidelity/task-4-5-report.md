# Task 4 + Task 5 report — scale snap candidates, projection and resolver

Pair dispatched as one unit (neither compiles alone); landed as two commits.

| | |
|---|---|
| Task 4 commit | `cf5ec0e` feat(editor): port scale snap candidates and projection |
| Task 5 commit | see below (second commit of the pair) |
| Combined test run | `npx vitest run packages/editor/src/snap-manager/scaling` → 2 files, 27 tests, PASS |

## Fork sources and observed line counts

All verified with `git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:<path>`.
`9efdd78a` named explicitly in every read; no `HEAD`, no checkout, no write, no fetch.

| File | Brief says | Observed | |
|---|---|---|---|
| `src/editor/snapping-manager/scaling/scale-snap-candidates.ts` | 130 | **130** | match |
| `.../scale-projection.ts` | 526 | **526** | match |
| `.../scale-snapping-resolver.ts` | 1,269 | **1,269** | match |
| `.../scaling-snap-guard.ts` | 65 | **65** | match |
| `.../scaling-step-snap-guards.ts` | 1,281 | **1,281** | match |
| `specs/test-utils/snapping/scale-snapping-core.ts` | 167 | **167** | match |
| `specs/.../scaling/scale-snapping-resolver.spec.ts` | 1,109 | **1,109** | match |
| `specs/.../scaling/scale-snap-candidates.spec.ts` | not stated | **75** | read |

Brief counts are exact. Nothing was off.

## Ported files

Under `src/web/packages/editor/src/snap-manager/scaling/`:

Counts are as committed, i.e. after `biome format --write` (Biome wraps long argument
objects, so these run above the raw token-diff estimates):

| File | Fork lines | Written lines |
|---|---|---|
| `scale-snap-candidates.ts` | 130 | 159 |
| `scale-projection.ts` | 526 | 726 |
| `scale-snapping-resolver.ts` | 1,269 | 1,508 |
| `scaling-snap-guard.ts` | 65 | 72 |
| `scaling-step-snap-guards.ts` | 1,281 | 1,322 |
| `scale-projection.test.ts` | — (new) | 220 |
| `scale-snapping-resolver.test.ts` | — (new) | 723 |

Every ported file carries the provenance line as its first line.
The two test files are new, not ports, so they carry none.

### Deviations from the fork sources, and every one's reason

A token-level comparison (comments stripped, import-path rewrites normalised) was run
per file. Result: the deviations are confined to the four permitted classes. Verbatim
finding per file:

- `scaling-snap-guard.ts` — **token stream identical** after path/quote normalisation.
  Zero deviations.
- `scale-snap-candidates.ts` — 1 deviation: the `ObjectBounds` import was relocated
  above the two sibling imports (reason below). No other change.
- `scale-projection.ts` — deviations are the relocated `ObjectBounds` import plus
  `noUncheckedIndexedAccess` guards (listed below). No algorithm, name or structure change.
- `scale-snapping-resolver.ts` — 2 deviations: the relocated `ObjectBounds` import, and
  the `stepProjection` omission idiom. No other change.
- `scaling-step-snap-guards.ts` — deviations are the `getObjectDisplaySize` access route,
  the exactOptional omissions, and the local `displayTarget` alias. No other change.

Numeric audit: every numeric literal in all four ported modules is byte-identical to the
fork. The only added number is `78`, inside the provenance SHA. No threshold, tolerance or
epsilon was changed.

**(1) Import-path rewrites** — permitted verbatim by both briefs.

| Fork | Vigilia |
|---|---|
| `'../../utils/geometry'` | `"../bounds.js"` |
| `'../constants'` | `"../constants.js"` |
| `'./scale-projection'` | `"./scale-projection.js"` |
| `'./scale-snapping-resolver'` | `"./scale-snapping-resolver.js"` |
| `'./scaling-snap-guard'` | `"./scaling-snap-guard.js"` |

The three files that import `ObjectBounds` (`scale-snap-candidates`,
`scale-projection`, `scale-snapping-resolver`) had that import placed **first** rather
than last, because the fork's local `./scale-projection` / `./scale-snapping-resolver`
imports precede it and Biome's `organizeImports` is not enabled but the surrounding
Vigilia files all put the `../bounds.js` import first. This is ordering only; the import
set is identical to the fork's.

Note the resolver file imports `SNAP_THRESHOLD` and `SPACING_SNAP_HOLD_MARGIN` from
`../constants.js` unchanged in value: `5` and `5`, exactly as the fork's own
`constants.ts`. Nothing was added to `snap-manager/constants.ts`, per the brief's
struck instruction — `SNAP_GUARD_POSITION_EPSILON`, `SOURCE_SCALED_GUIDE_HOLD_EPSILON`
and `getBoundsSnapGuardDistance` arrive with the ported `scaling-snap-guard.ts` and have
one home.

**(2) Russian comments translated to English.** Every `/** … */` docblock and the two
`/* eslint-disable no-use-before-define -- … */` headers. The eslint-disable directives
themselves are **kept** (the sibling Vigilia ports kept theirs) with the explanation
translated. Comment text was made English; no comment was dropped except the fork's
inline English `-- …` tails, which are preserved.

**(3) `exactOptionalPropertyTypes` omissions.** Vigilia omits rather than passes
`undefined`:

- `resolveScaleSnapPlan` — `resolveStepProjectionMode({ baselineMode, ...(stepProjection ? { stepProjection } : {}) })`.
  The fork passes `stepProjection` straight through. Type-wise `stepProjection?: ScaleStepProjectionInput`
  under `exactOptionalPropertyTypes` rejects an explicit `undefined`.
- `refineScaleSnapPlan` — unchanged: it reads `refinement.stepProjection`, which is a
  required field of `ScaleSnapPlanRefinement`, so it passes through directly. The
  optionality is only on the `resolveScaleSnapPlan` parameter and the private helpers.
- `scaling-step-snap-guards.ts` — `transform` and `preservePlacement` are optional and
  are passed down through five internal helpers. Every one of those call sites now uses
  the `...(x !== undefined ? { x } : {})` / `...(x ? { x } : {})` idiom rather than
  passing `undefined`. This is the single largest source of added tokens in that file
  (the `transform` / `preservePlacement` / `displayTarget` additions visible in the diff).
- `isSceneDisplayScale({ scale })` — two call sites pass `cropSourceScaleX` /
  `cropSourceScaleY`, which are `number | undefined` off `SourceDisplaySizeTarget`.
  Each is now spread conditionally: `{ ...(x !== undefined ? { scale: x } : {}) }`.
  The fork passes them directly; under `exactOptionalPropertyTypes` that is a TS2379.

**(4) `noUncheckedIndexedAccess` guards.** Vigilia enables the flag; the fork does not,
so every indexed read the fork relies on is guarded. Each guard either throws (refusing
invalid input, per the global constraint) or returns null (declining a solve), matching
the fork's own null-return contract where one exists:

`scale-projection.ts`:
- `projectEdgePosition` — reads `coefficients[index]`, `values[index]`,
  `baselineValues[index]`; throws `"Scale projection value is missing"` if any is
  undefined. Cannot fire: lengths are validated equal by `assertProjectionValues` and
  `createProjectionEdge` before this runs.
- `assertProjectionVariablesAffectGeometry` — reads `coefficients[index]`; an undefined
  slot counts as no effect (it is out of range, so the variable genuinely does not move
  that edge). Behaviourally identical to the fork: the fork's `Math.abs(undefined)` is
  `NaN`, and `NaN > EPSILON` is `false`, so the fork already treated it as "no effect".
- `resolveSingleConstraint` — reads `projection.variableSceneWeights[index]` (throws if
  missing) and `inverseMetricCoefficients[index]` twice. The two inverse-metric reads
  cannot fail: `inverseMetricCoefficients` is produced by mapping over
  `projectionEdge.coefficients`, and `constraintMetricNorm` / `values` iterate
  `coefficients` / `rawValues`, which are validated to the same length.
- `resolveTwoVariableConstraintPair` — destructures `constraints[0]`, `constraints[1]`
  and each edge's two coefficients; returns `null` when any is undefined. The pair path
  is only reached with two constraints and `variables.length === 2`, so the coefficient
  slots are always present; null is the safe decline.
- `resolveConstraintPair`'s `resolveSingleConstraint` call and `resolveScaleProjection`'s
  single-constraint branch — the former already iterates concrete constraints; the latter
  reads `constraints[0]` and throws `"Scale projection constraint is missing"` (unreachable,
  guarded by the `length === 1` branch).
- NB: the fork's `resolveTwoVariableConstraintPair` reads `rawValues[0]` / `rawValues[1]`
  with no guard; those now return `null` when undefined.

`scale-snapping-resolver.ts`: **no new guards were needed.** The fork's own indexing is
already null-safe by construction — `rawPositions[edge]` is typed `number | null` by
`ProjectedScaleEdgePositions`, and `baseline.candidates[snapshotIndex]` is already
narrowed by an explicit `!baselineCandidate` check. The only resolver deviation is the
`stepProjection` omission above. That is why its deviation count is 2, not dozens.

**(5) Fork-coupling stripped — one genuine coupling removal, with a reason.**

`scaling-step-snap-guards.ts:900` reads `typeof target.getObjectDisplaySize !== "function"`.
The fork can write that directly because it has a global declaration-merged augmentation
of Fabric's `Object` (`src/editor/types/fabric-extensions.d.ts:418`, which also declares
`getObjectSnappingBounds`). Vigilia has no such global augmentation — only the local
`SnappingBoundsSource` interface in `bounds.ts`. Faithfully porting the check therefore
required declaring the method on the local `SourceDisplaySizeTarget` interface that
already carries `cropSource` / `cropSourceScaleX` / `cropSourceScaleY`:

```ts
/** The fork declares this on its global Fabric augmentation; here it is local. */
getObjectDisplaySize?(): { width: number; height: number };
```

The check then reads `displayTarget.getObjectDisplaySize`, where `displayTarget` is the
existing local alias. This is the import-surface substitution the brief anticipates
("`scaling-step-snap-guards.ts` imports only Fabric, geometry helpers and constants on
the fork side, so it ports with import rewrites alone" — true of the *imports*, but not
of this one member access, which the fork gets from a file Vigilia has no equivalent of).
The runtime behaviour is identical: the property is still only consulted if present, so
every object that does not carry it takes the same branch as on the fork.

**(6) Test files are new, not ports**, so no provenance line and no byte-comparability
obligation. They inlines the fork's fixture helpers rather than porting
`scale-snapping-core.ts`, per both briefs.

## Tests — source and numbers

Numbers come from the fork's unit fixtures, not from `e2e/**/scaling-*-controls.spec.ts`.

- `scale-snap-candidates.test` cases: the three cases in
  `specs/.../scaling/scale-snap-candidates.spec.ts`, whose source bounds
  `{ left: 10, top: 20, right: 110, bottom: 220 }` give x lines `10 / 60 / 110` and y
  lines `20 / 120 / 220`. Asserted positions `[10, 60, 110, 20, 120, 220]`, categories
  `[edge, center, edge, edge, center, edge]`, ids in source order. The rotated-source
  case's `toHaveLength(6)` / 4 `domain-boundary` / 2 `center` are the fork's own.
- `scale-projection.test` cases: the brief's supplied fixture verbatim (the `text-width`
  convention, `baselineWidth = 200`, `values: [225]` → right edge `325`, left `100`),
  plus `getScaleProjectionEdge` (the fork's `baselinePosition: 300`, `coefficients: [1]`
  for the `right` edge and `null` for `bottom`), `getScaleProjectionCorrectionMagnitude`
  (`15`, derived from the same fixture: solution moves the variable to `240`, weighted
  distance `|225 - 240| * 1`) and `resolveScaleSceneEdgeAxis` (all four edges).
- `scale-snapping-resolver.test`: six brief-required cases plus six more drawn from the
  fork's spec, all with the fork's defaults (`width: 100`, `height: 100`, `zoom: 1`,
  `fixedAnchor` at `(left, top)`):
  - line snap on each axis — fork's `при независимом scale одновременно прилипает по X и Y`
  - independent X/Y hold — ported from the fork's `при несовместимых направляющих выбирает
    ту, которая требует меньшей коррекции scale` plus its `хранит отдельно применимую
    направляющую …` case
  - fixed-point restoration — the fork's own baseline has `fixedAnchor` at `(left, top)`
    and its `free` projection moves only `right` / `bottom`, so `left` stays `null`.
    Asserted `fixedAnchor` equals `{ x: 0, y: 0 }`, `effectivePositions.left` is `null`,
    `effectivePositions.right` is `100`.
  - hold released past the release threshold — fork's `удерживает направляющую в зоне
    отпускания, а после выхода сразу выбирает следующую` (`0.98` acquire, `1.04` hold,
    `1.06` release on to `second`)
  - Ctrl raw geometry — fork's `Ctrl снимает удержание …` (`0.98` stays `0.98`,
    `effectivePositions.right` is `98`)
  - rotated control on its own axis — fork's `при скейлинге повёрнутой фигуры за угол
    одновременно прилипает по X и Y` (coefficients `[80, 60]` / `[-60, 80]`)
  - plus: `createScaleProjectionConstraints`, zoom-scaled acquire (`zoom: 2` →
    `thresholds.acquire === 2.5`), spacing release zone (`release 2.5`,
    `spacingRelease 5`), per-axis release (`blockedAxes === ["x"]`), refinement
    replacing one guide with two, foreign-constraint rejection, domain/protected blocking,
    and input rejection.

No expected number in either test file was computed by hand; each is the fork's own
asserted value from `scale-snapping-core.ts` or the resolver spec. The one derived
number, the correction magnitude `15`, is stated in a comment with its derivation
(`240 - 225` weighted by scene weight `1`).

## Commands and results

All run from `src/web/`.

### Task 4 Step 4 — expected to be unsatisfiable alone

```
$ npx vitest run packages/editor/src/snap-manager/scaling
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Runtime PASS, as expected: `scale-snap-candidates.ts` imports the two candidate types
with `import type`, which esbuild erases, so the missing module never loads. The
genuine failure is at the type level, and it is exactly the one the brief predicts:

```
$ npx tsc --noEmit -p packages/editor/tsconfig.json
packages/editor/src/snap-manager/scaling/scale-snap-candidates.ts:8:8 - error TS2307:
Cannot find module './scale-snapping-resolver.js' or its corresponding type declarations.
8 } from "./scale-snapping-resolver.js";
         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Found 1 error in packages/editor/src/snap-manager/scaling/scale-snap-candidates.ts:8
```

Reported as expected, not chased. No stub, mock or placeholder type was added to make
it green, and `createScaleSnapCandidates` was not moved.

### Task 4 Step 5 — teeth check (raw)

Break: `projectEdgePosition` returns `projectionEdge.baselinePosition` unchanged, and
`resolveScaleProjection` returns `createProjectionSolution({ projection, values: rawValues })`
before the constraint branches. Rerun:

```
 Test Files  1 failed (1)
      Tests  4 failed | 6 passed (10)
     × moves the right edge by the width delta
     × solves the value that puts an edge on a guide
     × returns null when a constraint cannot be projected
     × measures the correction in scene units, weighted by the scene weight
```

Raw first failure:

```
FAIL packages/editor/src/snap-manager/scaling/scale-projection.test.ts >
scale projection > moves the right edge by the width delta
```

Raw unreachable-constraint failure (shows the projection returning raw values where the
fork declines):

```
AssertionError: expected { Object (values, positions) } to be null
- Expected:
null
+ Received:
{
  "positions": { "bottom": null, "left": 100, "right": 300, "top": null },
  "values": [ 225 ],
}
 ❯ packages/editor/src/snap-manager/scaling/scale-projection.test.ts:79:7
```

Raw correction-magnitude failure:

```
AssertionError: expected +0 to be close to 15, received difference is 15, but expected 5e-10
 ❯ packages/editor/src/snap-manager/scaling/scale-projection.test.ts:105:7
```

Restored; `diff` against the pre-break backup reports no difference; rerun is 10/10 PASS.

### Task 5 Step 4 — the run that must pass, covering both tasks' files

```
$ npx vitest run packages/editor/src/snap-manager/scaling
 Test Files  2 passed (2)
      Tests  27 passed (27)
```

### Task 5 Step 5 — teeth check (raw)

Break: `acquire: SNAP_THRESHOLD / zoom` → `acquire: (SNAP_THRESHOLD + 1) / zoom`.
Rerun:

```
 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 25 passed (27)
     × scales the acquire threshold from screen pixels by zoom
     × uses a wider release zone for spacing guides than for regular ones
```

Raw output, verbatim:

```
FAIL packages/editor/src/snap-manager/scaling/scale-snapping-resolver.test.ts >
scale snapping resolution > scales the acquire threshold from screen pixels by zoom
AssertionError: expected 3 to be 2.5 // Object.is equality
- Expected
+ Received
- 2.5
+ 3
 ❯ packages/editor/src/snap-manager/scaling/scale-snapping-resolver.test.ts:415:41

FAIL packages/editor/src/snap-manager/scaling/scale-snapping-resolver.test.ts >
scale snapping resolution > uses a wider release zone for spacing guides than for regular ones
AssertionError: expected { Object (axis, candidate, ...) } to be null
- Expected:
null
+ Received:
{
  "axis": "x",
  "candidate": {
    "axis": "x",
    "category": "edge",
    "edge": "right",
    ...
```

The first failure is the pinned threshold itself (`2.5` at `zoom: 2`); the second shows
the widened acquire window letting a guide the fork rejects re-acquire. Both are pinned
to the fork's numbers, not to whatever the port happens to do.

Restored; `diff` against the pre-break backup reports no difference; rerun is 27/27 PASS.

### Gates

```
$ npm run typecheck
(4 workspaces) — no output, clean

$ npm run lint
Checked 327 files in 447ms. No fixes applied.

$ npm run format:check
Checked 327 files in 110ms. No fixes applied.
```

Focused behavioural proof beyond the new files:

```
$ npx vitest run packages/editor/src/snap-manager
 Test Files  6 passed (6)
      Tests  68 passed (68)
```

Adjacent snap-manager suites unaffected: nothing in the existing tree imports the new
modules yet (verified — the ported files' only Vigilia-side consumers are each other and
their tests). Nothing was added to `index.ts` this round; wiring is Tasks 6-8.

Not run, per the brief: full unit suite, `npm run build`, `npm run test:e2e`.

## File-size exception

Vendored source is the stated exception: `scale-snapping-resolver.ts` (1,508 written),
`scaling-step-snap-guards.ts` (1,322) and `scale-projection.ts` (726) exceed or approach
the 800-line stop on purpose, to stay byte-comparable with fork `9efdd78a`. The exception
is stated in both commit messages. Neither test file is covered by it; both stay under
(220 and 723 lines).

## Concerns and unverified items

1. **`npm run typecheck` covers the editor package's whole program** — including the
   existing snap-manager files — and is clean, so the new modules do not break the
   build's type surface. But `npm run build` was not run (excluded by the brief), so
   bundling the new modules is unverified. Nothing currently imports them from a bundle
   entry point, so no bundle should change.
2. **`scaling-step-snap-guards.ts` has no test in this pair.** Its 1,411 lines are
   ported and type-clean, but no test exercises `resolveGuardedScalingStep`. The fork's
   unit spec for it was not in the two spec paths the briefs named, and both briefs
   scope their test steps to the projection and the resolver. This module is therefore
   **unverified at runtime** — reported rather than implied. It also cannot be exercised
   without real Fabric objects, which is a browser-shaped test that Tasks 6-8 own.
3. **`ScalingStepPlacementProver` / `Transform` coupling is untested.** `Transform` is a
   type-only export in Fabric 7.4 (`dist/src/EventTypeDefs.d.ts:33`); the module reads
   `transform?.original`, whose `scaleX` / `scaleY` come from Fabric's
   `saveObjectTransform`. That path is type-clean but never executed here.
4. **The `getObjectDisplaySize` access route (deviation 5) is the one place I could not
   make byte-identical.** I believe it is behaviour-preserving and it is the minimum
   change that compiles, but it is a deliberate divergence and a reviewer should confirm
   the reasoning rather than take it on trust.
5. **`resolveTwoVariableConstraintPair` now returns `null` on `rawValues[0]/[1]`
   undefined** whereas the fork would compute with `undefined` and produce `NaN`. Both
   are unreachable on the validated paths, but the port declines where the fork would
   propagate `NaN` — a behaviour change in an unreachable branch. Flagged for the record.
6. **No rendered capture.** Nothing in Tasks 4-5 paints anything, so no screenshot was
   taken; guide rendering is Task 6+.
7. **`preflight-scan.md` / `progress.md` run counts** were left untouched; they are the
   SDD ledger's, not this task's.

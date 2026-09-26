# Task 6 report: Scale gesture projection and interaction

## What I implemented

Four new files under `src/web/packages/editor/src/snap-manager/scaling/`, all
ported from fork `9efdd78a` (branch `codex/fabric-es`):

- `rectangular-scale-gesture-projection.ts` (990 lines) — all eight controls,
  rotated and centred. Exports exactly the fork's surface: the four types the
  brief names (`RectangularScaleControlKey`, `RectangularScaleGestureMode`,
  `RectangularScaleGestureTransform`, `RectangularScaleGestureProjection`) plus
  `createRectangularScaleValues`, `resolveRectangularScaleMultipliers`,
  `createRectangularScaleGestureProjection`, `resolveRectangularScalePointerMultipliers`,
  `projectRectangularScaleBounds`, `resolveRectangularScaleModeProjection`,
  `createRectangularScaleProjectionModes`, `resolveRectangularScaleMovingEdges`.
- `rectangular-scale-interaction.ts` (325 lines) — `applyRectangularScalePlan`
  and `createRectangularScaleValues`' callers, with the signatures the brief
  fixes for Task 7: `applyRectangularScalePlan({ plan, projection, target, transform })`.
  Also `resolveRectangularScaleStepInput`, `readAppliedRectangularScaleMultipliers`,
  `readFinalRectangularScaleGeometry`, `resolveRectangularScaleGestureMode`,
  `createRectangularScaleIntent`.
- `standard-scale-control.ts` (88 lines) — `isStandardRectangularScaleControl`
  and `didSideScaleSwitchToSkew`.
- `gesture-projection.test.ts` (929 lines) — the fork's unit fixture ported in,
  minus `jest.Mock`/`ImageEditor`.

A declaration-level diff of each port against its fork source reports **zero**
symbols present in one and absent in the other, and the exported surface is
identical name-for-name.

### Permitted changes to the fork's text

1. Specifiers: the fork's `'../../utils/geometry'` → `"../bounds.js"`; every
   other relative import → its `snap-manager/` equivalent with a `.js` suffix.
2. Russian comments → English (or dropped where the code says it).
3. `// Ported: …` marker at line 1 of each source file.
4. Two `noUncheckedIndexedAccess` guards, both behaviour-preserving:
   - `readRectangularScaleCorners`: the fork checks `sourceCorners.length !== 4`
     then destructures; under `noUncheckedIndexedAccess` the four bindings are
     `Point | undefined`, so I added `if (!topLeft || !topRight || !bottomRight
     || !bottomLeft) return null;` after the existing length check (unreachable
     in practice — a 4-length array has all four).
   - `resolveRectangularScaleMultipliers`: `!Number.isFinite(first)` still
     rejects `undefined` (it is not a number), so the first guard became
     `first === undefined || !Number.isFinite(first)` — same outcome, now
     type-narrowing.
5. One `exactOptionalPropertyTypes` widening in `standard-scale-control.ts`:
   `areControlNumbersEqual`'s `first`/`second` went from `first?: number` to
   `first?: number | undefined`, because `Control`'s index-signature read
   produces `number | undefined` at the call site. Documented in a 3-line
   comment naming the flag. **The guard itself is unchanged**: same five
   handlers compared by reference, same `x`/`y`/`offsetX`/`offsetY` comparison,
   same epsilon.

I did **not** edit `controls-manager`, extend `STANDARD_RECTANGULAR_SCALE_CONTROLS`,
relax the check, or add a change marker — per the settled decision. The settled
analysis holds on the real code: `applyOverrides` (`controls-manager/index.ts:65-80`)
`Object.assign`s `render`, `sizeX`, `sizeY`, `offsetX`, `offsetY` (and
`cursorStyle`/`mouseDownHandler` on `mtr` only) onto a fresh
`createObjectDefaultControls()`, so for the eight scale handles the five
behaviour handlers keep their identity and `x`/`y`/`offsetX`/`offsetY` keep their
values. A grep of the port for `process.env` confirms no debug hooks survived.

## What I tested and the results

Tests port the fork's unit fixture rather than hand-built transforms, including
`projectFixtureBounds` — an independent re-derivation of the expected bounds —
so the bounds assertions are not circular.

`npx vitest run packages/editor/src/snap-manager/scaling` → **98 passed / 0
failed** (3 files; 71 of them in `gesture-projection.test.ts`).

Cases covered:
- `it.each(RECTANGULAR_SCALE_CONTROL_ROTATION_CASES)` — all 8 handles × 3 angles
  (0/30/90) for the raw pointer multipliers, with the mode taken from
  `resolveFixtureFreeMode` so an `ml`/`mr` case asserts `y === 1`.
- Corners × 3 angles for the uniform multiplier (1.35).
- The brief's four cases: `null` for an unsupported control key; a 45° drag
  projected on the object's own axes; the opposite corner fixed for `tl`/`tr`/
  `bl`/`br` at three angles; `br` reporting `["bottom", "right"]`.
- The anchor-side edges staying put for all four corner handles.
- Rotated `mr` side projection (edges `["right","bottom"]`, coefficients
  reproducing the exact bounds), centred `uniform` (all four edges), the
  mode/handle mismatch returning `null`, uniform crossing the fixed point
  returning `null`, the frozen start snapshot surviving target mutation, and
  non-finite pointer/multiplier rejection.
- The mode round-trip `createRectangularScaleValues` ↔
  `resolveRectangularScaleMultipliers` for all four modes, plus the three
  throw paths.

`npm run typecheck` from `src/web/` → **all seven workspaces pass**, exit 0.
This is the check that matters here: the two errors it caught were exactly the
kind a green vitest hides — TS2322 on the fixture's tuple type and TS2379 on
`areControlNumbersEqual` under `exactOptionalPropertyTypes`. Both fixed.

Also run: full `npm test` → **1433 passed / 0 failed, 400 files**;
`npm run format:check` → clean (334 files); `npm run lint` → clean.

## TDD evidence

**RED.** Interrupting the projection entry point (a temporary
`if (process.env.VIGILIA_BREAK) return null;` as the first statement of
`createRectangularScaleGestureProjection`), then:

```
cd src/web
VIGILIA_BREAK=1 npx vitest run packages/editor/src/snap-manager/scaling/gesture-projection.test.ts \
  --reporter=json --outputFile=…/red.json
```

Result: `numTotalTests 71, numPassedTests 10, numFailedTests 61`. Representative
failures:

```
rectangular scale gesture projection > reads raw pointer multipliers for control tl at 0°
  :: Error: Projection must exist for a supported rectangular handle
rectangular scale gesture projection > rejects degenerate geometry that Fabric could not scale
  :: AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
```

Expected: the projection is the single input every other export consumes, so
nulling it must fail every case that needs a gesture — and it does, all 61.
The 10 survivors are the mode round-trip/throw cases and the five pure
rejection cases, which correctly do not depend on a projection existing.

**Revert.** The break was removed with a scripted exact-string replace (not a
hand edit); `diff` against a pre-break copy taken before the edit reports the
file identical, and `grep -c VIGILIA_BREAK` reports 0.

**GREEN.** Same command with the break gone and no env var → `numTotalTests 98,
numPassedTests 98, numFailedTests 0`.

One caveat stated plainly: this RED was produced in the intended order (source
first, then the interrupt/revert evidence). The assertions themselves were not
written before the port, so the "fails for the right reason" claim rests on the
61-failure shape above, not on a first-run red.

## Files changed

```
A  src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-gesture-projection.ts  990
A  src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-interaction.ts         325
A  src/web/packages/editor/src/snap-manager/scaling/standard-scale-control.ts                 88
A  src/web/packages/editor/src/snap-manager/scaling/gesture-projection.test.ts               929
```

Commit `abd5713` — `feat(editor): port the rectangular scale gesture projection`,
with the trailer. Staged by explicit path; nothing else is in the commit.
`git status` also shows `docs/superpowers/plans/2026-09-25-snapping-fidelity.md`
modified — **not mine**, it was already modified when I started (a controller's
plan annotation about orphaned `CommonDisplayDistance`), left untouched and
unstaged.

## Self-review findings

- `null` from `createRectangularScaleGestureProjection` is handled everywhere it
  can occur: the file's own `readRectangularScaleCorners` path, and the test's
  `createProjectionFor` helper, which throws a named error instead of asserting
  non-null — no `!` and no `as` anywhere in the test file.
- Every indexed read added a guard or was already guarded:
  `fixture.sourceCorners[0]`, `edge.coefficients[0]` and the corner
  destructuring all narrow before use.
- Three test bugs found and fixed during the first run, all mine, none in the
  ported sources: `[...frozenArray].sort()` (the export is frozen, so `.sort()`
  throws `Cannot assign to read only property '0'`); a wrong fixed-edge map for
  `tl`/`br`; and the `FIXED_EDGES_BY_CONTROL` value type collapsing to
  `readonly string[]` without an explicit `FixedCornerEdges` alias.
- Test output is pristine: no warnings, no act() noise, no console output.
  The fixture constructs a real `Rect` and I only replace `getCoords`, so there
  is no `jest.Mock`/`ImageEditor` coupling.
- Comments are 1-3 lines and explain why. The single non-obvious deviation
  (`exactOptionalPropertyTypes` widening) carries the reason.
- No overbuilding: `rectangular-scale-interaction.ts` is in the commit because
  `createRectangularScaleValues` lives in the projection module and the brief
  requires it tested; the rest of that file is unreferenced until Task 7, which
  is expected and named in the brief as this task's scope.

## Issues and concerns

1. **Port fidelity beyond the seven decisions is a judgement call.** The
   line-ending and comment rewrites are unavoidable; the two
   `noUncheckedIndexedAccess` guards are mechanically forced; the
   `exactOptionalPropertyTypes` widening is the one place I chose a type change
   over a code change. If the reviewer would rather see that call site pass
   `{ ...(value !== undefined ? { first: value } : {}) }`, say so — it inverts
   the cost (more deviation in the body, no signature change).

2. **The port is unpinned against the fork by anything automated.** My
   declaration-level diff is an ad-hoc `grep`/`comm`, not a checked-in test. A
   future re-sync has no guard; the byte-comparability argument only pays off if
   someone re-runs that diff by hand.

3. **Nothing exercises the port through Fabric's real gesture path.** These
   tests drive the fixture's hand-rolled `getCoords`. `isStandardRectangularScaleControl`
   against an object carrying `controls-manager`'s real overrides is asserted
   nowhere — I reasoned it from source and the analysis holds, but it is a
   reading, not a measurement. Task 7's controller is where that becomes
   observable.

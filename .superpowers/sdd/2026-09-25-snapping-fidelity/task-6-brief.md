### Task 6: Scale gesture projection and interaction

**Files:**
- Create: `src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-gesture-projection.ts` (fork: 849 lines)
- Create: `src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-interaction.ts` (fork: 294 lines)
- Create: `src/web/packages/editor/src/snap-manager/scaling/standard-scale-control.ts` (fork: 83 lines)
- Create: `src/web/packages/editor/src/snap-manager/scaling/gesture-projection.test.ts`

**Interfaces:**
- Consumes: `scale-projection`, `scale-snapping-resolver`, `scale-snap-candidates` (Tasks 4–5).
- Produces, copied from the fork:
  ```ts
  export type RectangularScaleControlKey = "tl" | "tr" | "bl" | "br" | "ml" | "mr" | "mt" | "mb";
  export type RectangularScaleGestureMode = "horizontal" | "vertical" | "free" | "uniform";
  export type RectangularScaleGestureTransform = Readonly<{
    target: FabricObject; action: Transform["action"]; corner: string;
    originX: Transform["originX"]; originY: Transform["originY"];
    original: Readonly<{ scaleX: number; scaleY: number }>;
  }>;
  export type RectangularScaleGestureProjection = Readonly<{
    controlKey: RectangularScaleControlKey; control: RectangularScalePoint;
    origin: RectangularScalePoint; pointerStart: RectangularScalePoint;
    fixedAnchor: RectangularScalePoint; u: RectangularScalePoint; v: RectangularScalePoint;
    originalScales: RectangularScaleMultipliers;
    baselineBounds: Readonly<ObjectBounds>;
  }>;
  export function createRectangularScaleGestureProjection(input: {
    transform: RectangularScaleGestureTransform; pointerStart: RectangularScalePoint;
  }): RectangularScaleGestureProjection | null;
  export function resolveRectangularScaleMultipliers(input: {
    projectionMode: string; effectiveValues: readonly number[];
  }): RectangularScaleMultipliers;
  export function resolveRectangularScalePointerMultipliers(input: {
    projection: RectangularScaleGestureProjection;
    pointer: RectangularScalePoint;
    mode: RectangularScaleGestureMode;
  }): RectangularScaleMultipliers | null;
  export function projectRectangularScaleBounds(input: {
    projection: RectangularScaleGestureProjection;
    multipliers: RectangularScaleMultipliers;
  }): Readonly<ObjectBounds> | null;
  export function resolveRectangularScaleModeProjection(input: {
    projection: RectangularScaleGestureProjection; mode: RectangularScaleGestureMode;
  }): RectangularScaleModeProjection | null;
  export function createRectangularScaleProjectionModes(input: {
    projection: RectangularScaleGestureProjection;
  }): readonly ScaleProjectionModeInput[];
  export function resolveRectangularScaleMovingEdges(input: {
    projectionModes: readonly ScaleProjectionModeInput[];
  }): readonly ScaleSceneEdge[];
  ```

  The fork also exports `createRectangularScaleValues({ mode, multipliers })`, returning `readonly number[]` (one value for `horizontal`/`vertical`/`uniform`, two for `free`). Task 5's resolver consumes those value arrays, so it is required even though the list above is the rest of the module's surface — port it too, and give it a test.

The `u`/`v` unit vectors carried on the projection are what makes rotation work: `projectRectangularScaleBounds` projects all four corners through them, so a rotated object's handle moves on the object's own axes. `createRectangularScaleGestureProjection` returns `null` for a control it does not support, and every caller must handle that null rather than assuming a projection exists.

`rectangular-scale-gesture-projection.ts` is where all eight controls, rotated and centred, are handled. It imports `ObjectBounds`, `ScaleProjectionModeInput` and geometry helpers — no editor coupling.

- [ ] **Step 1: Retrieve and adapt the three sources** as in Task 4.

```bash
for f in rectangular-scale-gesture-projection rectangular-scale-interaction standard-scale-control; do
  git -C D:/git-repos/fabricjs-image-editor show \
    9efdd78a:src/editor/snapping-manager/scaling/$f.ts > "$TEMP/fork-$f.ts"
done
```

- [ ] **Step 2: Identify the control from the Fabric transform**

`standard-scale-control.ts` is the fork's own answer and ports **unchanged**: it compares `target.controls[transform.corner]` against `controlsUtils.createObjectDefaultControls()` field by field, and refuses a control whose handlers were replaced. That is what guarantees the snapping only engages over a genuinely standard Fabric resize handle — a custom control that changes resize semantics is declined.

Vigilia's `controls-manager/index.ts` may therefore be a problem: if it replaces or reconfigures the default controls, `isStandardRectangularScaleControl` will return false for every handle and snapping will silently never engage. **Check that before writing the adapter.** If Vigilia's controls differ, the choices in order of preference are: keep Fabric's defaults where they already satisfy the need; extend `STANDARD_RECTANGULAR_SCALE_CONTROLS` with the exact Vigilia control definitions so the comparison still tests something real; or, last, relax the check — which loses the guard, so say so in the commit message if it comes to that.

Note that the fork does **not** export `STANDARD_RECTANGULAR_SCALE_CONTROLS` — `standard-scale-control.ts:10-12` declares it module-private. Taking the middle option therefore means editing a ported file, which under the global constraint at `:20` requires a `// ported: fork 9efdd78a …` marker naming the change above it.

`didSideScaleSwitchToSkew` is also from this file and is needed: Alt on a side handle switches it from scaling to skewing, and a gesture in that state must not snap.

- [ ] **Step 3: Test every control, rotated and not**

```ts
describe("rectangular scale gesture projection", () => {
  it("returns null for a control key it does not support", () => {
    expect(createRectangularScaleGestureProjection({
      transform: { ...transform, corner: "not-a-control" },
      pointerStart: { x: 0, y: 0 },
    })).toBeNull();
  });

  it("projects a rotated drag on the object's own axes", () => {
    // Review Focus item 3. Build the projection from a transform whose target
    // has angle 45, then assert projectRectangularScaleBounds moves the corner
    // along the rotated axis rather than the screen axis. Take the expected
    // corner positions from the fork's scaling-controls specs.
  });

  it("keeps the opposite corner fixed for every corner control", () => {
    // tl, tr, bl, br: the anchor is the opposite corner and must not move.
  });

  it("reports every edge the handle can move", () => {
    // mr moves the right edge only; br moves right and bottom.
    expect(
      resolveRectangularScaleMovingEdges({ projectionModes }).sort(),
    ).toEqual(["bottom", "right"]);
  });
});
```

`projectionModes` is not a bare literal — build it from the `br` projection this file already constructs in the two tests above:

```ts
const projectionModes = createRectangularScaleProjectionModes({ projection });
```

`createRectangularScaleProjectionModes` is one of this task's own exports, so no extra import is needed.

Fill the rotated and corner cases from the fork's **unit fixture**, which exists for exactly this and is the reason the two bodies above are left open:

```
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:specs/test-utils/snapping/rectangular-scale-gesture-projection.ts
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:specs/src/editor/snapping-manager/scaling/rectangular-scale-gesture-projection.spec.ts
```

The fixture (546 lines) exports `createRectangularScaleProjectionFixture({ controlKey, angle, width, height, centered, originalScaleX/Y })` returning a whole gesture — `transform`, `pointerStart`, `control`, `origin`, `fixedAnchor`, `u`, `v`, `baselineBounds`, `sourceCorners` — plus `moveFixturePointer`, `projectFixtureBounds` (an **independent** re-derivation of the expected bounds, which is what makes the bounds assertions real rather than circular), `resolveFixtureFreeMode`, and the matrices `RECTANGULAR_SCALE_CONTROL_KEYS` (all eight) and `RECTANGULAR_SCALE_TEST_ANGLES` (`[0, 30, 90]`) with their product `RECTANGULAR_SCALE_CONTROL_ROTATION_CASES`.

**Port the fixture into this task's test file** rather than hand-building transforms — the fork's unit spec drives all 24 control×rotation cases through it with `it.each(RECTANGULAR_SCALE_CONTROL_ROTATION_CASES)`, and the rotated-axes case takes its expected values from `projectFixtureBounds`, not from a literal. Port the parts you use; do not port the `jest.Mock` or `ImageEditor` couplings. The e2e specs (`e2e/tests/snapping-manager/**/scaling-*-controls.spec.ts`) are the *browser* half and are not the source for a unit expectation.

Two traps worth knowing before writing them: `createRectangularScaleGestureProjection` takes the *pointer start* in scene coordinates alongside the transform, and `multipliers` are relative to gesture start (1 means "unchanged"), not absolute scales. A third, from the fork's own spec: `resolveFixtureFreeMode` maps `ml`/`mr` to `horizontal`, `mt`/`mb` to `vertical`, and the four corners to `free` — a mode/resolution mismatch shows up as a multiplier of `1` on the axis you expected to move, not as a thrown error.

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/editor/src/snap-manager/scaling`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/scaling
git commit -m "feat(editor): port the rectangular scale gesture projection"
```

---


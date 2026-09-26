### Task 7: Bind scaling, with verification-gated guides

**Files:**
- Create: `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-runtime.ts` (fork: 372 lines)
- Create: `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts`
- Create: `src/web/packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`
- Modify: `src/web/packages/editor/src/snap-manager/index.ts` (bindings)
- Modify: `src/web/packages/editor/src/snap-manager/guide-renderer.ts` — **verified unnecessary, listed for completeness.** The ported scale guide carries `axis` (`"x" | "y"`, the same union as the movement guide's) and `position`, which is exactly what `createMovementGuideLines` reads and exactly what `GuideLine` (`types.ts:26-29`) holds. Render scale guides through the existing `lastGuides` channel; do not add a second one and do not modify this file. Edit it only if a real gesture proves a shape the renderer cannot draw, and say so in the report.
- Modify: `src/web/tests/e2e/editor.spec.ts` (Step 7 — the resize capture test)
- Modify: `docs/evidence/screenshots/README.md` (Step 7 — its registry row)

**Interfaces:**
- Consumes: Tasks 4–6, `MovementSnappingRuntime`'s two-phase pattern (`resolveMovementPlan` → `verifyMovementPlan`, `movement-snapping-runtime.ts:115,159`).
- Produces: `ScaleSnappingRuntime` (ported) and `createScaleSnappingController` (new), bound to `object:scaling` (plus the existing `mouse:up` teardown — see Step 4).

The fork's runtime is the direct sibling of the movement runtime Vigilia already has, so it ports with no shape change:

```ts
export type ScalePlanToken = Readonly<{ sessionId: number; step: number }>;
export type PlannedScaleRuntimeStep = Readonly<{
  kind: "planned"; token: ScalePlanToken; plan: ScaleSnapPlan;
}>;
export type DuplicateScaleRuntimeStep = Readonly<{
  kind: "duplicate"; phase: "pending" | "verified"; token: ScalePlanToken;
  plan: ScaleSnapPlan; verification: ScaleSnapVerification | null;
}>;
export type ScaleRuntimeStep = PlannedScaleRuntimeStep | DuplicateScaleRuntimeStep;
export type ScaleRuntimeCleanup = Readonly<{
  didCleanup: boolean; hiddenGuides: readonly VerifiedScaleGuide[];
}>;
export class ScaleSnappingRuntime {
  startSession(input: { baseline: ScaleGestureBaseline }): void;
  getDuplicateStep(input: { marker: object }): DuplicateScaleRuntimeStep | null;
  resolveScalePlan(input: {
    marker: object; intent: ScaleRawIntent; stepProjection?: ScaleStepProjectionInput;
  }): ScaleRuntimeStep;
  refineScalePlan(input: {
    token: ScalePlanToken; refinement: ScaleSnapPlanRefinement;
  }): ScaleSnapPlan;
  verifyScalePlan(input: {
    token: ScalePlanToken; finalGeometry: FinalScaleGeometry;
  }): ScaleSnapVerification;
  finishSession(): ScaleRuntimeCleanup;
}
```

Three things differ from the movement runtime, and all three matter:

1. **`refineScalePlan` has no movement counterpart.** Fabric's own scale constraints (`minScaleLimit`, uniform scaling, flipping) can block a constraint the resolver picked. Refinement re-solves the plan against the exact geometry before it is applied.
2. **`measuredValues` on `FinalScaleGeometry`** are read back from the object *after* Fabric applied the plan — the same read-back the movement path does with `getObjectExactBounds`. They are not the plan's proposed values.
3. **`pendingStep` throws** if the next marker arrives before verification: `"Previous scale plan token must be verified before the next pointer marker"`. The controller must verify every planned step, including a zero-delta one — the same rule `83248dc` established on the movement path.

**Skip refinement in the first port.** Pass no `refinement`, so `refineScalePlan` goes unused. Fabric can then block a constraint, and `verifyScalePlan` reports it through `blockedAxes` — the guide is simply not published. That fails closed and is the correct first behaviour. Add refinement only if a real gesture shows a guide the author expects and does not get; mark the omission with a `ponytail:` comment naming that ceiling.

The fork's `image-scale-snapping-controller.ts` imports `ImageEditor` and is vigilia-specific; `legacy-scale-snapping.ts` imports the crop manager's `CropFrame` helpers. **Neither is ported.** What is ported is the runtime, and what is written fresh is a Vigilia controller that follows the movement controller's shape.

The fork's `movement-snapping-controller.ts:127` marker pattern applies here identically: **one marker per native pointer event**, taken from the browser event (`event.e`), never a per-gesture constant. `83248dc` fixed that exact bug on the movement path; do not reintroduce it here.

- [ ] **Step 1: Write the failing test**

jsdom has no pointer input, so drive the controller the way Fabric does: fire `object:scaling` with the real event payload (`{ e, transform, pointer }`) and pre-set the object's scales to what Fabric would have produced. Keep a running "what Fabric would do" transform so the gesture has a coherent `original`.

```ts
// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSnapManager } from "../index.js";

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const snapping = createSnapManager({
    canvas,
    bounds: () => ({ left: 0, top: 0, right: 800, bottom: 600, centerX: 400, centerY: 300 }),
    errors: { error: vi.fn(), warn: vi.fn() } as never,
  });
  // Anchor's left edge is at 300; the resized object's right edge starts at 260.
  const anchor = new Rect({ id: "a", left: 300, top: 40, width: 60, height: 60 });
  const resized = new Rect({ id: "b", left: 60, top: 300, width: 200, height: 80 });
  canvas.add(anchor, resized);
  canvas.setActiveObject(resized);

  const original = { scaleX: 1, scaleY: 1 };
  /** One mr-handle step. Returns the width Fabric itself would have produced, so
   * a test can compare "what the raw drag gives" against "what the controller
   * gives" — the controller may legitimately change the scale. */
  const resize = (e: object, widthScale: number): number => {
    // Mirror Fabric's pre-transform result so the controller sees the state it
    // would really see. This is setup, not the behaviour under test: asserting
    // that getScaledWidth() equals 200 * widthScale after this call proves
    // nothing, because this line produced it. Capture it as the baseline and
    // assert on what the controller leaves behind instead.
    resized.set({ scaleX: widthScale, scaleY: 1 });
    resized.setCoords();
    canvas.fire("object:scaling" as never, {
      e,
      target: resized,
      pointer: { x: 60 + 200 * widthScale, y: 340 },
      transform: {
        target: resized, corner: "mr", originX: "left", originY: "top",
        original: { ...original, originX: "left", originY: "top" },
      },
    } as never);
    return 200 * widthScale;
  };
  return { canvas, snapping, anchor, resized, resize };
}

describe("scale snapping", () => {
  it("snaps a resize onto a neighbour's edge", () => {
    const { canvas, resized, snapping, resize } = setup();
    canvas.fire("mouse:down" as never, { target: resized } as never);

    // Pick a raw multiplier whose moved edge lands inside SNAP_THRESHOLD of the
    // anchor's edge but NOT exactly on it, so the snapped value differs from the
    // raw one and the assertion can fail. With the anchor's left edge at 300 and
    // the resized object's left edge at 60, a raw width of 238 (multiplier 1.19)
    // puts the right edge at 298 — 2 short. Snapping must land it on 240.
    const raw = resize({}, 1.19);
    expect(raw).toBe(238);
    expect(resized.getScaledWidth()).toBe(240);
    snapping.destroy();
  });

  it("re-plans on every scaling step, not once per gesture", () => {
    const { canvas, resized, snapping, resize } = setup();
    canvas.fire("mouse:down" as never, { target: resized } as never);
    // Far from the neighbour, so the first step resolves to itself and the raw
    // value stands — this is the assertion that would catch a controller that
    // snapped unconditionally.
    expect(resize({}, 0.6)).toBe(120);
    expect(resized.getScaledWidth()).toBe(120);
    // The second step must be planned, not rejected as a duplicate.
    resize({}, 1.19);
    expect(resized.getScaledWidth()).toBe(240);
    snapping.destroy();
  });
});
```

**Re-derive the expected numbers against the real scene before trusting them.** The numbers above (`238` raw, `240` snapped) are a worked sketch of the geometry, not verified values: work out the anchor edge, the resized object's start width and the multiplier that lands the moving edge inside `SNAP_THRESHOLD` (5 scene units at zoom 1), then make the assertion that exact number. Assert `getScaledWidth()` (or `getScaledHeight()` for a `mb` step), not `width` — the port moves `scaleX`, so `width` never changes and an assertion on it would pass vacuously.

**The raw and snapped values must differ.** This is the whole reason the first test uses `1.19` (raw `238`) rather than `1.2` (raw `240`): a multiplier that already lands exactly on the anchor edge makes `expect(getScaledWidth()).toBe(240)` true with the controller doing nothing, so the test cannot fail when the fix is disabled — which the global constraint at `:25` forbids. Whatever numbers you settle on, the raw width the helper produces and the width the assertion demands must be different, and the test must be shown failing with the controller's snapping disabled.

The `mouse:down` call is what starts the movement gesture today. Confirm the scale controller starts its session from the first `object:scaling` instead, or from a shared gesture-start hook, so a resize that was never preceded by a `mouse:down` still engages. Whichever way the implementation goes, the test must cover it — that is the `editor.spec.ts` path, where the author grabs a handle directly.

Also settle `SNAPPING_MULTIPLIER` here, as a named constant in this test file:

```ts
/** The raw width multiplier whose moved edge lands inside SNAP_THRESHOLD of the
 * anchor's edge. Task 8 imports it, so it lives here and is defined once. */
export const SNAPPING_MULTIPLIER = 1.19;
```

Set it to whatever the re-derived geometry above actually requires, but keep the name and the export: Task 8 depends on both.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`
Expected: FAIL — nothing resizes the object.

- [ ] **Step 3: Implement the runtime and controller**

Port `ScaleSnappingRuntime` from the fork with its mechanics intact — the `WeakMap` keyed on marker identity, `pendingStep`, token issuance and consumption, and `finishSession` returning the guides to hide. It has no `ImageEditor` import to drop: the runtime is already coupling-free, and the explicit inputs it takes are exactly the movement runtime's shape. The coupling lives in `image-scale-snapping-controller.ts`, which is not ported.

**Name every deviation from the fork in the commit message, and make the list exhaustive — Task 6's review found one deviation that its commit message did not list.** On the ported files in that task the message said "The only edits to the fork's text are …" and then enumerated them; the actual file contained one more, four hoisted `RECTANGULAR_SCALE_CONTROL_COORDINATES` bindings in `projectRectangularScaleBounds`, which `noUncheckedIndexedAccess` did not require (a literal-key dot access on a `Readonly<Record<…>>` is not `| undefined`). It was a gratuitous edit that broke the byte-comparability the same message names as the reason for the file-size exception, and it took a token-stream diff against the pinned fork to find it. The lesson is not "avoid deviations" — the typing guards are real and expected — but that **a completeness claim in the commit message is checkable and will be checked**, so enumerate from a diff against the fork rather than from memory. The two deviation classes that *are* expected on every ported file are the `noUncheckedIndexedAccess` guards and the `exactOptionalPropertyTypes` widenings, plus Vigilia's import specifiers and English comments; a deviation outside those classes needs a sentence saying why.

Then write `scale-snapping-controller.ts`, a thin orchestrator over Tasks 4–6 mirroring `movement-snapping-controller.ts`. Per `object:scaling` step:

1. **Marker.** `readMovementMarker({ event })` — the browser event, one per native pointer event. Never a per-gesture constant; that is the `83248dc` bug. **Both `readMovementMarker` and `readMovementModifiers` are module-private to `index.ts` today** (`:63-76` and `:79-90`; `index.ts` exports only `SnapManager`, `SnapManagerOptions` and `createSnapManager`). Export them and import them in the controller — reuse the one reader rather than copying it.
2. **Gesture start**, on the first step of a session: Fabric's `object:scaling` event is `BasicTransformEvent`, which carries exactly `{ e, transform, pointer }` (`EventTypeDefs.d.ts:69-72`). `transform` has `target`, `corner`, `action`, `original`, `originX`, `originY` — the `RectangularScaleGestureTransform` shape — and `pointer` is the `pointerStart` argument. Pass them straight through; if `createRectangularScaleGestureProjection` returns `null` (unsupported control, or Alt-skew), end the session and do nothing.

   **Carried from Task 2's review — decide whether to guard the moving object, and state the decision.** The fork refuses a gesture whose target is a group child (`isSupportedTarget`, `movement-snapping-controller.ts:170-172`: `!target || target.group`); Vigilia has no equivalent, and `grouping-manager/index.ts:54-57` sets `subTargetCheck`/`interactive`, so a group's child **is** individually selectable and draggable. Measured: `runStep` applies the snap as a delta (`nextPosition.left - currentLeft`) and the resolver computes that delta in scene space from `getBoundingRect()`, which includes the group's transform — while the delta is applied in the child's group-local plane. For an **unrotated, unscaled** group those planes share axes and the result is correct; for a group carrying rotation or scale the child lands off the guide. Decide whether this path guards it or documents it, and say which. Do not write a source comment describing the wrong-answer case without also saying it is unfixed — a comment that states a caveat reads as an endorsement of it.

   **Decide what happens to `scaling/standard-scale-control.ts`, and state the decision in the report.** It is already ported (Tasks 4–6) and has **zero importers** today. In the fork its only three consumers are `image-scale-snapping-controller.ts` and the two `selection-manager/scaling/active-selection-*` files — all three controllers this plan does not port. So if your fresh controller does not call `isStandardRectangularScaleControl` or `didSideScaleSwitchToSkew`, that file is dead code in Vigilia under exactly the condition Task 10 Step 3 asks you to decide for `scaling-step-snap-guards.ts`. Either consume it (the fork uses the first to gate which controls may scale and the second to abandon a gesture whose side handle became a skew) or say why the projection's own `null` is sufficient and leave it for Task 10 to dispose of with the guard family. Do not leave it unstated — a ported file with no importer is the same defect this plan exists to remove.

   Be precise about which point `pointer` is, because it is *not* the canvas scene point. Fabric builds it in `commonEventInfo` (`fabric/dist/index.mjs:3193-3199`) as `new Point(x, y)` from the `x`/`y` handed to the action handler, and `_transformObject` (`:12633-12636`) passes `localPointer` — the scene point sent through `target.group.calcTransformMatrix()` when the target has a group, and the plain scene point otherwise. For an ungrouped target the two coincide; inside a group, `pointer` is already in the group's own plane, which is the plane the projection and the object's own bounds live in. That is the point the fork's own controller uses, so passing it through is correct — but do not "fix" it to the canvas scene point, which would be wrong for a grouped target.

   **Confirm this against the real pointer pipeline before Step 7's capture.** jsdom cannot exercise it, and the fork reads `event.scenePoint` rather than `event.pointer` (`image-scale-snapping-controller.ts`), so the two differ in name and possibly in plane. If Task 6's projection tests pass but the browser capture shows guides attached to the wrong edge, this is the cause.
3. **Baseline**, once: `createScaleGestureBaseline({ bounds: getObjectExactBounds(...), fixedAnchor: projection.fixedAnchor, projectionModes, candidates: createScaleSnapCandidates({ targetEdges: resolveRectangularScaleMovingEdges({ projectionModes }), sources }), zoom })`. Build `sources` the way `startGesture` does: `collectExcludedObjects`, then a `canvas.forEachObject` loop through `toSnapSource`, then the artboard pushed as a `domain-boundary` source (search `"artboard"` inside that function). Locate it by name — `snap-manager/index.ts` moved under this plan when Task 2 landed, and every line citation written for it is stale.
4. **Intent.** `projectionMode` from the modes `createRectangularScaleProjectionModes` returned for this control and mode; `values` from `resolveRectangularScaleMultipliers`; `modifiers` from `readMovementModifiers({ event })` — widen that helper to return `shiftKey` alongside `ctrlKey` (it currently returns `ctrlKey` only), since `ScaleSnapModifiers` needs both. One modifier reader, used by both paths.
5. **Apply.** Call the ported `applyRectangularScalePlan({ plan, projection, target, transform })` (in `rectangular-scale-interaction.ts`; locate by name) — do **not** hand-roll the two-line `target.set(...)`. The plan's `effectiveValues` are snap-resolver variables (`scale-x` / `scale-y` / `uniform-scale`, `scale-projection.ts:12-16`), not rectangular multipliers, so the fork's own applier decodes them through `resolveRectangularScaleMultipliers({ projectionMode, effectiveValues })` first, and then restores the gesture's fixed point with `target.setPositionByOrigin(new Point(projection.fixedAnchor.x, projection.fixedAnchor.y), transform.originX, transform.originY)` before `setCoords()`. Reading `effectiveValues[0]`/`[1]` straight into `scaleX`/`scaleY` is wrong in two ways: a `uniform` step carries a single value and `effectiveValues[1]` is `undefined`, giving `NaN` under `noUncheckedIndexedAccess`; and a `vertical` (`mt`/`mb`) step's one value is the **Y** multiplier, which the positional read would apply to `scaleX`. The missing `setPositionByOrigin` also drops the fixed-point restoration Task 5 Step 3 requires the resolver to prove.
6. **Verify.** Build the whole `FinalScaleGeometry` through `readFinalRectangularScaleGeometry` (in `rectangular-scale-interaction.ts`; locate by name). It already produces `measuredValues` by calling `createRectangularScaleValues` — which lives in `rectangular-scale-gesture-projection.ts`, **not** in the interaction file an earlier revision of this step named — so pass it the multipliers and do not call that function yourself. Do **not** derive `measuredValues` from a raw `target.scaleX / originalScaleX` ratio: the ratio is wrong for the same axis reason as item 5. Pass `protectedStatePreserved` too — the fork supplies it from `isProtectedImageScaleStatePreserved`, an image-editor concern; for Vigilia give the equivalent "did the gesture's protected state survive" answer, and if there is no such state, `true` with a comment naming why. Then `verifyScalePlan({ token, finalGeometry })`, and take guides from `verification.guides` only.

Guides must not be published from the plan. The fork publishes after exact-bound verification, and Review Focus item 1 is exactly this mistake.

Because `resolveScalePlan` throws when a previous token is unverified, step 6 must run on **every** planned step, including one whose plan changes nothing — same rule as the movement path's zero-delta case (`runStep`, where it returns early when `step.kind !== "planned"`).

- [ ] **Step 4: Bind it**

Add to the bindings array in `index.ts`:

```ts
    ["object:scaling", scaleRunStep],
```

**Do not add an end-of-resize binding.** Fabric 7.4.0 has no `object:scaled` event — the `object:*` keys in `node_modules/fabric/dist/src/EventTypeDefs.d.ts` are `object:moving` (:98), `object:scaling` (:101), `object:rotating` (:104), `object:skewing` (:107), `object:resizing` (:110), `object:modifyPoly` (:113), `object:modifyPath` (:116), `object:modified` (:119), `object:added` (:185) and `object:removed` (:188). Fabric fires `object:modified` after a transform completes. The bindings array casts through `as never` (the `canvas.on(event as never, handler as never)` call), so the compiler accepts the unknown name and it simply never fires — a silent no-op, not a compile error.

Nothing is lost: the existing `mouse:up` binding (the `stopGesture` entry in the bindings array) already ends the gesture and clears guides, which is the same teardown a resize needs.

Extend that existing `stopGesture` to also call `scaleRuntime.finishSession()` when a scale session is active, and render `verification.guides` through the same `lastGuides` path the movement side uses — do not add a second guide channel. Reuse the existing teardown rather than writing a second one; `stopGesture` already guards on `gestureActive` and `finishSession` returns `didCleanup: false` when there is no session, so a double call is already idempotent. The second test in Step 1 exercises the marker path that would expose a mistake here.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS.

- [ ] **Step 6: Verify the re-plan test has teeth**

Replace the event-derived marker with a per-gesture constant and rerun. Expected: the second test fails. This is the `83248dc` bug being guarded on the new path. Restore.

- [ ] **Step 7: Inspect the guides on screen**

Add a test to `src/web/tests/e2e/editor.spec.ts` beside `snaps a dragged object to a neighbour and shows a guide` — locate that case by title (`grep -n "snaps a dragged object to a neighbour"`), never by line number: the file has moved under this plan three times and every line citation written for it is stale. Same skip clause, same `sceneToClient(page, 1280, …)` mapping, same `page.mouse` gesture — that grabs a shape's right resize handle and drags it toward a neighbour's edge. Title it `snaps a resized object to a neighbour and shows a guide`, capture name `editor-snap-resize`, and add it to the `Editor mechanics` row of `docs/evidence/screenshots/README.md` (the row listing `editor-snap-guides`; locate it by that name).

Then rebuild and capture:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
  --grep "snaps a resized object" --workers=1
```

Open the capture and confirm guides appear during the resize, span the artboard, and line up with the neighbour's actual edge. Then confirm no guide is drawn when the resize is nowhere near a neighbour — a guide with no snap is Review Focus item 1.

- [ ] **Step 8: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/index.ts \
  src/web/packages/editor/src/snap-manager/scaling/scale-snapping-runtime.ts \
  src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts \
  src/web/packages/editor/src/snap-manager/scaling/scaling.dom.test.ts
git add src/web/tests/e2e/editor.spec.ts \
  docs/evidence/screenshots/editor-snap-resize-desktop-chromium.png \
  docs/evidence/screenshots/README.md
git commit -m "feat(editor): resize-time snapping with verified guides"
```

**Stage every path by name, including each file under `scaling/`.** Tasks 4–6 have already landed five files in that directory, so a directory-wide `git add` is no longer "this task's files only" — it would sweep any uncommitted edit of theirs into this commit. **Stage the capture by name too.** `docs/evidence/screenshots/` holds ~40 PNGs belonging to other tasks and another plan, so `git add docs/evidence/screenshots` would sweep an unrelated capture into this commit. Name the one capture this task writes and the `README.md` row it edits.

---


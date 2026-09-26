### Task 5: Scale snap resolver

**Files:**
- Create: `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-resolver.ts` (fork: 1,269 lines)
- Create: `src/web/packages/editor/src/snap-manager/scaling/scaling-snap-guard.ts` (fork: 65 lines)
- Create: `src/web/packages/editor/src/snap-manager/scaling/scaling-step-snap-guards.ts` (fork: 1,281 lines)
- Create: `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-resolver.test.ts`

**Interfaces:**
- Consumes: `scale-projection` (Task 4), `../constants.js`, `../bounds.js`.
- Produces, copied from the fork:
  ```ts
  export type ScaleSnapThresholds = Readonly<{
    acquire: number; release: number; spacingRelease: number; verification: number;
  }>;
  export type ScaleSnapModifiers = Readonly<{ ctrlKey: boolean; shiftKey: boolean }>;
  export type ScaleRawIntent = Readonly<{
    projectionMode: string; values: readonly number[]; modifiers: ScaleSnapModifiers;
  }>;
  export type ScaleSnapCandidateCategory = "domain-boundary" | "edge" | "center" | "spacing";
  export type ScaleSnapCandidate = Readonly<{
    id: string; axis: ScaleSceneAxis; edge: ScaleSceneEdge;
    position: number; category: ScaleSnapCandidateCategory; snapshotIndex: number;
  }>;
  export type FreeScaleAxisHold = Readonly<{ kind: "free" }>;
  export type HeldScaleAxisHold = Readonly<{
    kind: "held"; candidate: ScaleSnapCandidate;
  }>;
  export type ScaleAxisHold = FreeScaleAxisHold | HeldScaleAxisHold;
  export type ScaleHoldState = Readonly<{
    x: ScaleAxisHold; y: ScaleAxisHold;
  }>;
  export type PlannedScaleConstraint = Readonly<{
    axis: ScaleSceneAxis; candidate: ScaleSnapCandidate;
    transition: "acquired" | "held"; expectedPosition: number;
  }>;
  export type ScaleSnapConstraints = Readonly<{
    x: PlannedScaleConstraint | null; y: PlannedScaleConstraint | null;
  }>;
  export type ScaleSnapPlan = Readonly<{
    projectionMode: string; projection: ScaleProjection;
    variables: readonly ScaleProjectionVariable[];
    rawValues: readonly number[]; effectiveValues: readonly number[];
    rawPositions: ProjectedScaleEdgePositions;
    effectivePositions: ProjectedScaleEdgePositions;
    constraints: ScaleSnapConstraints; refinementCandidates: ScaleSnapConstraints;
    proposedHoldState: ScaleHoldState; fixedAnchor: ScaleScenePoint;
    verificationEpsilon: number;
  }>;
  export type FinalScaleGeometry = Readonly<{
    bounds: ObjectBounds; fixedAnchor: ScaleScenePoint;
    measuredValues: readonly number[];
    domainVerdict: Readonly<{
      x: "satisfied" | "blocked"; y: "satisfied" | "blocked";
      protectedState: "preserved" | "changed";
    }>;
  }>;
  export type VerifiedScaleGuide = Readonly<{
    axis: ScaleSceneAxis; edge: ScaleSceneEdge; position: number;
    candidateId: string; category: ScaleSnapCandidateCategory; snapshotIndex: number;
  }>;
  export type ScaleSnapVerification = Readonly<{
    guides: readonly VerifiedScaleGuide[];
    blockedAxes: readonly ScaleSceneAxis[];
    holdState: ScaleHoldState;
  }>;
  /** The validated snapshot taken once at gesture start. */
  export type ScaleGestureBaseline = Readonly<{
    bounds: ObjectBounds; fixedAnchor: ScaleScenePoint;
    projectionModes: readonly ScaleProjectionMode[];
    candidates: readonly ScaleSnapCandidate[];
    thresholds: ScaleSnapThresholds;
  }>;
  export type ScaleProjectionMode = Readonly<{
    id: string; projection: ScaleProjection;
  }>;
  /** Exact bounds and face dependencies at one pointer step. */
  export type ScaleStepProjectionInput = Readonly<{
    bounds: ObjectBounds; projection: ScaleProjectionInput;
  }>;
  /** The refined projection, canonical values and reached constraints. */
  export type ScaleSnapPlanRefinement = Readonly<{
    constraints: ScaleSnapConstraints;
    effectiveValues: readonly number[];
    stepProjection: ScaleStepProjectionInput;
  }>;
  export const FREE_SCALE_HOLD_STATE: ScaleHoldState;
  export const SCALE_SNAP_VERIFICATION_EPSILON = 0.1;
  export function createScaleGestureBaseline(input: {
    bounds: ObjectBounds; fixedAnchor: ScaleScenePoint;
    projectionModes: readonly ScaleProjectionModeInput[];
    candidates: readonly ScaleSnapCandidateInput[]; zoom: number;
  }): ScaleGestureBaseline;
  export function resolveScaleSnapPlan(input: {
    baseline: ScaleGestureBaseline; intent: ScaleRawIntent;
    holdState: ScaleHoldState; stepProjection?: ScaleStepProjectionInput;
  }): ScaleSnapPlan;
  export function refineScaleSnapPlan(input: {
    plan: ScaleSnapPlan; refinement: ScaleSnapPlanRefinement;
  }): ScaleSnapPlan;
  export function verifyScaleSnapPlan(input: {
    plan: ScaleSnapPlan; finalGeometry: FinalScaleGeometry;
  }): ScaleSnapVerification;
  ```

Also exported from the resolver and consumed by Task 7, so their bodies are written out here rather than left to inference. All are ported verbatim from the fork; the line numbers are the fork's own:

```ts
export type ScaleScenePoint = Readonly<{ x: number; y: number }>;              // :28
export type ScaleProjectionModeInput = Readonly<{                              // :34
  id: string; projection: ScaleProjectionInput;
}>;
export type ScaleSnapCandidateInput = Readonly<{                               // :46
  id: string; axis: ScaleSceneAxis; edge: ScaleSceneEdge;
  position: number; category: ScaleSnapCandidateCategory;
}>;
export type ScaleGestureBaselineInput = Readonly<{                             // :93
  bounds: ObjectBounds; fixedAnchor: ScaleScenePoint;
  projectionModes: readonly ScaleProjectionModeInput[];
  candidates: readonly ScaleSnapCandidateInput[]; zoom: number;
}>;
export type ScaleSnapTransition = "acquired" | "held";                         // :160
export type ScaleDomainAxisVerdict = "satisfied" | "blocked";                  // :187
export type FinalScaleDomainVerdict = Readonly<{                               // :190
  x: ScaleDomainAxisVerdict; y: ScaleDomainAxisVerdict;
  protectedState: "preserved" | "changed";
}>;
export function createScaleProjectionConstraints(input: {                      // :136
  constraints: ScaleSnapConstraints;
}): readonly ScaleProjectionConstraint[];
```

**The last one is a function and it has a caller.** `scale-snapping-resolver.spec.ts:4` imports it and `:28` calls it (`createScaleProjectionConstraints({ constraints: plan.constraints })`) — so it is part of the resolver's public surface, and the fork's own unit spec is written against it. Port it with the rest.

`ScaleSnapCandidateInput` and `ScaleScenePoint` are also shown in Task 4's second block, because Task 4's signatures consume them. **They still live here, in `scale-snapping-resolver.ts`, and nowhere else.** Task 4 imports them; see the import-direction note in Task 4. Write each type body exactly once — in the resolver.

**Every type this block references is now written out somewhere in the plan** — the resolver's own types are in the block above or the list just below it, and the projection types it consumes come from Task 4. Nothing here is left for you to infer; if a name you need is genuinely absent, say so in the report rather than inventing a shape a later task will disagree with.

`stepProjection` is optional on the fork and `exactOptionalPropertyTypes` is on in Vigilia: callers omit it rather than passing `undefined`.

The key contract: `resolveScaleSnapPlan` produces a plan, and `verifyScaleSnapPlan` decides which of its constraints the object **actually** reached, returning `guides` only for those. Guides come from `verification.guides`, never from `plan.constraints` — Review Focus item 1.

This task ports the resolver and its two guard modules. `scaling-step-snap-guards.ts` imports only Fabric, geometry helpers and constants on the fork side, so it ports with import rewrites alone.

- [ ] **Step 1: Retrieve the three fork sources**

```bash
for f in scale-snapping-resolver scaling-snap-guard scaling-step-snap-guards; do
  git -C D:/git-repos/fabricjs-image-editor show \
    9efdd78a:src/editor/snapping-manager/scaling/$f.ts > "$TEMP/fork-$f.ts"
done
```

- [ ] **Step 2: Adapt with the same permitted changes as Task 4**

Import paths to Vigilia's `bounds.js` and `constants.ts`, English comments, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` fixes, provenance line. Thresholds and tolerances are copied **verbatim** — a changed tolerance is precisely the "weaker tolerances" failure §175 names.

Cross-check each constant the resolver imports against `snap-manager/constants.ts`. `scaling-step-snap-guards.ts` needs `SNAP_GUARD_POSITION_EPSILON`, `SOURCE_SCALED_GUIDE_HOLD_EPSILON` and `getBoundsSnapGuardDistance`. **These are not in the fork's `constants.ts`** — all three are declared in `scaling-snap-guard.ts` (`:2`, `:5`, `:23`), which this task already creates as a ported file, so they arrive with it and **nothing needs adding to `snap-manager/constants.ts`**. Do not re-declare them there: two homes for one constant is exactly the drift this step exists to prevent. The instruction to port them into `constants.ts` is struck.

- [ ] **Step 3: Write the resolver test from the fork's cases**

**The direct source is the fork's own unit spec for this file** — `specs/src/editor/snapping-manager/scaling/scale-snapping-resolver.spec.ts` (1,109 lines, ~34 cases). It is written against exactly the API this task ports, and its fixture module travels with it:

```bash
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:specs/src/editor/snapping-manager/scaling/scale-snapping-resolver.spec.ts > "$TEMP/fork-resolver.spec.ts"
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:specs/test-utils/snapping/scale-snapping-core.ts > "$TEMP/fork-scale-core.ts"
```

Read both in full. `scale-snapping-core.ts` (167 lines) builds the baseline, candidates, raw intents and final geometry these cases consume; **do not port it into Vigilia** — it lives under the fork's `specs/`, and Vigilia's tests build their fixtures inline, as the neighbouring tests do. Reproduce the fixture helpers this task's cases need directly in `scale-snapping-resolver.test.ts`, keeping the fork's defaults (`width: 100`, `height: 100`, `zoom: 1`, `fixedAnchor` at `(left, top)`) so the ported numbers stay valid.

Select from that spec the cases matching the list below, and where the fork has a sharper case for the same behaviour, prefer it over the sketch. Port at minimum:

- a line snap on each axis during a resize;
- independent X/Y hold — one axis snaps while the other does not;
- fixed-point restoration, so the edge opposite the dragged handle does not move;
- a hold that releases past the release threshold (Review Focus item 5);
- Ctrl producing the raw, unrounded geometry (Review Focus item 2);
- a rotated object's control projecting onto its own axis.

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/editor/src/snap-manager/scaling`
Expected: PASS.

- [ ] **Step 5: Verify teeth**

Change one acquire tolerance by 1 and confirm the matching test fails. Restore. This is the check that the tests are pinned to the fork's numbers rather than to whatever the port happens to do.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/scaling
git commit -m "feat(editor): port the scale snap resolver and step guards"
```

---


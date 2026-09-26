### Task 4: Scale snap candidates and projection

**Files:**
- Create: `src/web/packages/editor/src/snap-manager/scaling/scale-snap-candidates.ts` (fork: 130 lines)
- Create: `src/web/packages/editor/src/snap-manager/scaling/scale-projection.ts` (fork: 526 lines)
- Create: `src/web/packages/editor/src/snap-manager/scaling/scale-projection.test.ts`

**Interfaces:**
- Consumes: `ObjectBounds`, `getObjectExactBounds` from `../bounds.js`.
- Produces, copied from the fork so later tasks and the plan agree with the source:
  ```ts
  // scale-snap-candidates.ts
  export type ScaleSnapCandidateSource = Readonly<{
    id: string;
    bounds: ObjectBounds;
    edgeCategory?: Extract<ScaleSnapCandidateCategory, "domain-boundary" | "edge">;
  }>;
  export type ScaleSnapEnvironment = Readonly<{
    candidates: readonly ScaleSnapCandidateInput[];
    zoom: number;
  }>;
  export function createScaleSnapCandidates(input: {
    targetEdges: readonly ScaleSceneEdge[];
    sources: readonly ScaleSnapCandidateSource[];
  }): readonly ScaleSnapCandidateInput[];
  ```
  ```ts
  // scale-projection.ts, all under a `bounds: ObjectBounds` linear model
  export type ScaleSceneAxis = "x" | "y";
  export type ScaleSceneEdge = "left" | "right" | "top" | "bottom";
  export type ScaleProjectionVariable = "scale-x" | "scale-y" | "uniform-scale" | "text-width";
  export type ScaleProjectionEdgeInput = Readonly<{
    edge: ScaleSceneEdge; coefficients: readonly number[];
  }>;
  /** Raw data for one resize mode's linear model, before it is validated. */
  export type ScaleProjectionInput = Readonly<{
    variables: readonly ScaleProjectionVariable[];
    baselineValues: readonly number[];
    variableSceneWeights: readonly number[];
    edges: readonly ScaleProjectionEdgeInput[];
  }>;
  export type ScaleProjectionEdge = Readonly<{
    axis: ScaleSceneAxis; edge: ScaleSceneEdge;
    baselinePosition: number; coefficients: readonly number[];
  }>;
  /** The faces and weights the displacement comparison runs over. */
  export type ScaleProjection = Readonly<{
    variables: readonly ScaleProjectionVariable[];
    baselineValues: readonly number[];
    variableSceneWeights: readonly number[];
    edges: readonly ScaleProjectionEdge[];
  }>;
  /** Edge positions for the chosen resize mode; `null` where the mode does not
   * move that edge. Task 5's plan carries one of these as a field. */
  export type ProjectedScaleEdgePositions = Readonly<{
    left: number | null; right: number | null; top: number | null; bottom: number | null;
  }>;
  /** Pairs a checked face with the guide it must meet. */
  export type ScaleProjectionConstraint = Readonly<{
    axis: ScaleSceneAxis; edge: ScaleSceneEdge; position: number;
  }>;
  export type ScaleProjectionSolution = Readonly<{
    values: readonly number[]; positions: ProjectedScaleEdgePositions;
  }>;
  export function createScaleProjection(input: {
    bounds: ObjectBounds; input: ScaleProjectionInput;
  }): ScaleProjection;
  export function getScaleProjectionEdge(input: {
    projection: ScaleProjection; edge: ScaleSceneEdge;
  }): ScaleProjectionEdge | null;
  export function projectScaleEdgePositions(input: {
    projection: ScaleProjection; values: readonly number[];
  }): ProjectedScaleEdgePositions;
  export function resolveScaleProjection(input: {
    projection: ScaleProjection; rawValues: readonly number[];
    constraints: readonly ScaleProjectionConstraint[]; epsilon: number;
  }): ScaleProjectionSolution | null;
  export function getScaleProjectionCorrectionMagnitude(input: {
    projection: ScaleProjection; rawValues: readonly number[];
    constraint: ScaleProjectionConstraint;
  }): number;
  export function resolveScaleSceneEdgeAxis(input: {
    edge: ScaleSceneEdge;
  }): ScaleSceneAxis;
  ```
  ```ts
  // scale-snapping-resolver.ts — these three live in Task 5's file, not here.
  // They are shown here because Task 4's signatures consume them, but Task 4
  // imports them; it does not define them. Defining them in Task 4 would make
  // the two files import each other's types.
  export type ScaleScenePoint = Readonly<{ x: number; y: number }>;
  export type ScaleProjectionModeInput = Readonly<{
    id: string; projection: ScaleProjectionInput;
  }>;
  export type ScaleSnapCandidateInput = Readonly<{
    id: string; axis: ScaleSceneAxis; edge: ScaleSceneEdge;
    position: number; category: ScaleSnapCandidateCategory;
  }>;
  ```

Note the import direction: the fork declares its candidate types (`ScaleSnapCandidateCategory`, `ScaleSnapCandidateInput`) in `scale-snapping-resolver.ts` while `scale-snap-candidates.ts` is what produces them, and **this plan keeps the fork's direction**. So `scale-snap-candidates.ts` imports those two types from the resolver and defines neither — the resolver is their one home, and the candidates module's `createScaleSnapCandidates` returns `ScaleSnapCandidateInput[]` by importing it. Do not "fix" the direction by moving the types into the candidates file: that inverts the fork, and since the resolver also consumes them the two files would then import each other's types.

**This task therefore does not compile on its own**, and it is dispatched together with Task 5 as one unit — write Task 4's two files first, then Task 5's, and run the suite once at the end of Task 5. Do not invent a new home for any of these types, and do not move `createScaleSnapCandidates` into Task 5: the file split above is deliberate.

**That does not mean collapsing the two into one commit.** Commit Task 4's files when Step 6 says to, *before* writing Task 5's — a fix round on Task 5 that has to reconstruct which of forty ported lines came from which task is a fix round spent on archaeology. The pair is dispatched as one unit because neither compiles alone; it lands as two commits because they are two files' worth of different work.

- [ ] **Step 1: Retrieve the fork sources**

```bash
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:src/editor/snapping-manager/scaling/scale-snap-candidates.ts \
  > "$TEMP/fork-scale-snap-candidates.ts"
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:src/editor/snapping-manager/scaling/scale-projection.ts \
  > "$TEMP/fork-scale-projection.ts"
```

Read both in full before adapting. They are the specification.

- [ ] **Step 2: Adapt them into the new files**

Changes permitted, and only these:

- `import type { ObjectBounds } from '../../utils/geometry'` → `from "../bounds.js"`.
- Every other relative import is rewritten to its Vigilia equivalent under `snap-manager/`; if a target does not exist yet, that is a signal the module belongs to a later task, so split rather than inventing it.
- Russian comments become English or are dropped.
- `exactOptionalPropertyTypes` fixes: omit optional properties instead of setting them to `undefined`.
- `noUncheckedIndexedAccess` guards where an indexed read is now possibly `undefined`.

Add the provenance line at the top of each file:

```ts
// Ported: fork 9efdd78a src/editor/snapping-manager/scaling/scale-snap-candidates.ts
```

Do **not** restructure, rename or "improve" the algorithms. A ported file that differs from its source except for these changes loses the byte-comparability that makes a future diff against the fork cheap.

- [ ] **Step 3: Write the test**

Port one behaviour per exported function, using the real linear-model API rather than a fabricated façade.

**The numbers come from the fork's own unit fixtures, not from the e2e specs.** Read both of these in full before writing anything — they are the convention authority, and a fixture re-derived by hand is how this task's own test came to assert `320` for a projection that yields `300.2`:

```bash
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:specs/test-utils/snapping/scale-snapping-core.ts > "$TEMP/fork-scale-core.ts"
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:specs/src/editor/snapping-manager/scaling/scale-snap-candidates.spec.ts > "$TEMP/fork-candidates.spec.ts"
```

`scale-snapping-core.ts` (167 lines) is this task's direct model: it exports `createScaleBounds`, which is `ObjectBounds` with `centerX`/`centerY` derived — the same shape this task's `bounds` argument takes. Do **not** port that file into Vigilia; it lives under the fork's `specs/`, and Vigilia's test files build their fixtures inline as the neighbouring tests do. Read it, copy the convention, and inline what you need.

For the hand-written case below, note the coefficients the fork's `createScaleBaseline` uses: `edges: [{ edge: "right", coefficients: [width, 0] }, { edge: "bottom", coefficients: [0, height] }]` — the coefficient is the lever arm in scene units, one slot per variable, and a variable that does not move that edge gets `0`. That is what makes `left` immovable below. Read the fork's cases for the expected numbers rather than inventing your own:

```ts
// src/web/packages/editor/src/snap-manager/scaling/scale-projection.test.ts
import { describe, expect, it } from "vitest";
import {
  createScaleProjection,
  projectScaleEdgePositions,
  resolveScaleProjection,
} from "./scale-projection.js";

// A 200x100 object at (100, 100), modelled the way the fork's text-width path
// models it: the variable is the width itself, so `baselineValues` carries the
// baseline width and a coefficient of 1 means one scene unit of edge movement
// per scene unit of width. This is the convention the fork's own spec pins
// (`specs/.../text-width-resize-projection.spec.ts`: `values: [baselineWidth + 25]`
// against `coefficient: 1`); the rectangular path uses `scale-x` instead, with
// `baselineValues: [1]` and the lever arm as the coefficient. Do not write
// `multiplier-x` here — that is a `RectangularScaleProjectionVariable`, which the
// gesture projection *maps to* `scale-x` before this API ever sees it.
const bounds = { left: 100, top: 100, right: 300, bottom: 200, centerX: 200, centerY: 150 };
const baselineWidth = bounds.right - bounds.left;
const horizontal = createScaleProjection({
  bounds,
  input: {
    variables: ["text-width"],
    baselineValues: [baselineWidth],
    variableSceneWeights: [1],
    edges: [
      { edge: "left", coefficients: [0] },
      { edge: "right", coefficients: [1] },
    ],
  },
});

describe("scale projection", () => {
  it("moves the right edge by the width delta", () => {
    // 300 + 1 * (225 - 200). The point of the case is that the projection is
    // linear in the delta, not that any particular edge is special.
    expect(
      projectScaleEdgePositions({ projection: horizontal, values: [225] }).right,
    ).toBeCloseTo(325, 9);
  });

  it("leaves the opposite edge fixed", () => {
    expect(
      projectScaleEdgePositions({ projection: horizontal, values: [225] }).left,
    ).toBeCloseTo(100, 9);
  });

  it("solves the value that puts an edge on a guide", () => {
    const solution = resolveScaleProjection({
      projection: horizontal,
      rawValues: [225],
      constraints: [{ axis: "x", edge: "right", position: 340 }],
      epsilon: 0.1,
    });
    expect(solution?.positions.right).toBeCloseTo(340, 9);
  });

  it("returns null when a constraint cannot be projected", () => {
    // The left edge cannot move under a text-width-only model: its coefficient
    // is 0, so the constraint is unreachable and the solver declines rather
    // than returning the raw values as though it had satisfied the guide.
    expect(resolveScaleProjection({
      projection: horizontal,
      rawValues: [225],
      constraints: [{ axis: "x", edge: "left", position: 340 }],
      epsilon: 0.1,
    })).toBeNull();
  });
});
```

Add the rotated and all-eight-control cases in Task 6, where the gesture projection that produces these coefficients exists. A projection that ignores rotation is Review Focus item 3, so that case is not optional — but it belongs with the code that computes the coefficients.

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/editor/src/snap-manager/scaling`
Expected: PASS.

- [ ] **Step 5: Verify teeth**

In `projectScaleEdgePositions` and `resolveScaleProjection`, return the input values unchanged instead of projecting them, and rerun. Expected: failures on the projected-position and constraint-solve tests. Restore.

- [ ] **Step 6: Commit**

The ported files are a deliberate exception to the 800-line stop; say so in the message.

```bash
git add src/web/packages/editor/src/snap-manager/scaling
git commit -m "feat(editor): port scale snap candidates and projection

Vendored source is a deliberate exception to the file-size signal; it
stays byte-comparable with fork 9efdd78a apart from import paths."
```

---


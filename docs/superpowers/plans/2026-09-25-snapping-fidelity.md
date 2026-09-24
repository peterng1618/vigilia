# Snapping Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Vigilia's snapping and smart guides up to the retired fork's practical quality: port the resize/scale snapping subsystem the parity plan deferred, restore the candidate filter and selection guards that were narrowed, and replace the single capture that hid the gap with a behaviour matrix that can actually fail.

**Architecture:** The movement geometry core is already a byte-comparable port and stays as it is. What is added is the fork's **second** snapping engine — scale/resize — as a sibling subsystem under `snap-manager/scaling/`, sharing the existing candidate, guide and bounds helpers rather than duplicating them. Coupling is stripped at exactly two seams: the fork's `ImageEditor` accessor and its `CropFrame` dependency.

**Tech Stack:** TypeScript, Fabric 7.4.0 (`fabric/es`), Vitest + jsdom, Playwright, Biome. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-25-snapping-fidelity.md`

**Reference source:** fork `9efdd78a` at `D:\git-repos\fabricjs-image-editor`, branch `codex/fabric-es`. **Read-only.** Retrieve files only with `git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:<path>` and `git ls-tree`; never `checkout`, `switch` or `restore` there, and never mutate that repository.

## Global Constraints

- The fork's snapping tree is the specification for behaviour. Where this plan says "port", the requirement is **practical parity**, not transcription: strip fork coupling, keep the algorithms and thresholds.
- Russian comments become English or none.
- `renderer-core` stays Fabric/DOM-free; this work is entirely inside `@vigilia/editor`.
- Vendored geometry files stay byte-comparable with their source where no coupling forces a change — the existing rule in `docs/superpowers/specs/2026-09-24-editor-behaviour-review.md` (see "Vendored snapping geometry split"). A ported file that acquires an edit gets `// ported: fork 9efdd78a <path>` above the change.
- Snapping is runtime/derived state: guides, hold state and gesture context never enter authored history (§67) or the envelope.
- Refuse invalid numeric input rather than coercing it to zero.
- Visible copy lives in `ui-copy.ts` (§35); every control has an accessible name.
- Run commands from `src/web/`.
- A new regression test must fail when the fix is disabled before it is trusted.
- Guides are a **visible** behaviour: a unit test asserting a guide array is not sufficient evidence on its own. Each task that changes what an author sees needs a rendered capture.
- 500 lines is a signal, 800 is a stop for normal source files. The ported scaling modules are an explicit exception under the vendored-source rule; note the exception in the commit message.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on: optional properties are omitted, not set to `undefined`.

## Review Focus

The five failure modes most likely to bite an author, and where each is pinned:

1. **Guides drawn for a snap that was never applied**, or applied without a guide. The fork publishes a scale guide only *after* exact-bound verification; a port that publishes optimistically shows an author a line the object is not actually on. → Task 7.
2. **Ctrl no longer being the escape hatch during a resize**, so an author cannot place an edge just off a neighbour. Moving has the escape hatch again; scale must match. → Task 8.
3. **A rotated object's resize projecting the wrong handle**, so the snap pulls the wrong edge. This is why `rectangular-scale-gesture-projection.ts` is 849 lines and handles all eight controls. → Task 6.
4. **Snapping to an object the author cannot see or move** — a hidden layer, or the artboard plate. Relaxing the candidate filter must not align against the full-bleed background rect. → Task 1.
5. **A resize that never releases**, so the object stays welded to a neighbour it was dragged away from. Release thresholds must exceed acquire thresholds. → Task 4.

---

### Task 1: Candidate-filter parity

**Files:**
- Modify: `src/web/packages/editor/src/snap-manager/index.ts:32-42`
- Modify: `src/web/packages/editor/src/snap-manager/excluded-objects.ts`
- Modify: `src/web/packages/editor/src/snap-manager/index.dom.test.ts`
- Test: `src/web/packages/editor/src/snap-manager/index.dom.test.ts`

**Interfaces:**
- Consumes: `shouldIgnoreObject` from `./excluded-objects.js` (already present).
- Produces: no new exports. `isSnapTarget` changes behaviour; its signature is unchanged.

Today `isSnapTarget` requires `object.selectable === true && object.get("locked") !== true`. The fork's `utils/object-filter.ts:28-45` excludes only the active object and its selection children, `visible === false`, and `IGNORED_IDS`. Locking a layer in the fork prevents *moving* it, not *aligning to* it.

- [ ] **Step 1: Write the failing tests**

Append to `index.dom.test.ts`:

```ts
it("aligns to a locked neighbour, which lock must not prevent", () => {
  const { canvas, snapping } = setup();
  const locked = new Rect({
    id: "a", left: 100, top: 20, width: 40, height: 40, locked: true,
    selectable: false, evented: false,
  });
  const dragged = new Rect({ id: "b", left: 98, top: 150, width: 40, height: 40 });
  canvas.add(locked, dragged);
  canvas.setActiveObject(dragged);

  canvas.fire("mouse:down" as never, { target: dragged } as never);
  move(canvas, dragged);

  expect(dragged.left).toBe(100);
  snapping.destroy();
});

it("ignores the artboard plate even though it is large and centrally placed", () => {
  const { canvas, snapping } = setup();
  // The plate is not selectable, but it spans the artboard, so its centre would
  // otherwise snap every centred object to the artboard centre.
  const plate = new Rect({
    id: "scene", left: 0, top: 0, width: 400, height: 300,
    selectable: false, evented: false,
  });
  const dragged = new Rect({ id: "b", left: 178, top: 128, width: 40, height: 40 });
  canvas.add(plate, dragged);
  canvas.setActiveObject(dragged);

  canvas.fire("mouse:down" as never, { target: dragged } as never);
  move(canvas, dragged);

  // 178+20 = 198 is 2 from the plate's centreX (200), inside SNAP_THRESHOLD, but
  // ignored ids never contribute a candidate.
  expect(dragged.left).toBe(178);
  snapping.destroy();
});

it("still ignores a hidden neighbour", () => {
  const { canvas, snapping } = setup();
  const hidden = new Rect({ id: "a", left: 100, top: 20, width: 40, height: 40, visible: false });
  const dragged = new Rect({ id: "b", left: 98, top: 150, width: 40, height: 40 });
  canvas.add(hidden, dragged);
  canvas.setActiveObject(dragged);

  canvas.fire("mouse:down" as never, { target: dragged } as never);
  move(canvas, dragged);

  expect(dragged.left).toBe(98);
  snapping.destroy();
});
```

The existing test `"skips a locked neighbour as a snap target"` now asserts the opposite of the intended behaviour. **Delete it** and let the new first test replace it — do not keep both.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/editor/src/snap-manager/index.dom.test.ts`
Expected: FAIL on the first two. The first fails because `locked: true` excludes the candidate; the second fails because `selectable: false` excludes the plate but nothing yet excludes it by id.

- [ ] **Step 3: Relax the filter and name the ignored ids**

In `excluded-objects.ts`:

```ts
/** Scene objects that are decoration rather than alignable content. The
 * artboard plate spans the whole artboard, so its centre would otherwise snap
 * every centred object; see new-fabric-theme.ts's `backgroundOnly`. */
export const IGNORED_IDS: readonly string[] = ["scene"];
```

In `index.ts`, `isSnapTarget` becomes the fork's rule with no selectable or locked clause:

```ts
/** Alignable content, following the fork's object filter: visibility and
 * explicit exclusion decide, not lock. Locking prevents moving an object, not
 * aligning to it. */
function isSnapTarget(
  object: FabricObject,
  excluded: Set<FabricObject>,
): boolean {
  return !shouldIgnoreObject({ object, excluded });
}
```

`shouldIgnoreObject` already checks exclusion, `visible === false` and `ignoredIds`, so the whole predicate is now the owner's — do not restate its conditions here.

The redundant `if (excluded.has(object)) return undefined;` on the line after the `isSnapTarget` call in `toSnapSource` is now covered by the filter. Remove it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS, all tests including the untouched ones.

- [ ] **Step 5: Verify the tests have teeth**

Restore `object.selectable === true &&` to the predicate and rerun. Expected: the locked-neighbour test and the plate test both fail. Restore the relaxed version.

Then empty `IGNORED_IDS` and rerun. Expected: the plate test fails. Restore `["scene"]`.

- [ ] **Step 6: Inspect the starter theme for noise**

Removing the `selectable` gate makes decorative `selectable: false` objects alignable. The starter theme has exactly one such object (`new-fabric-theme.ts:15-19`, the artboard plate, id `scene`), which is now excluded by id — but confirm that in the browser rather than trusting the grep:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
  --grep "snaps a dragged object" --workers=1
```

Open the capture. Confirm guides appear against real content (the wordmark, a panel, a chart) and that no guide appears against the artboard plate except at the true artboard edges. If decoration is noisy, add its id to `IGNORED_IDS` with a comment naming why — do not reintroduce the `selectable` gate, which would also block locked objects.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/index.ts \
  src/web/packages/editor/src/snap-manager/excluded-objects.ts \
  src/web/packages/editor/src/snap-manager/index.dom.test.ts
git commit -m "fix(editor): align to locked objects, ignore the artboard plate"
```

---

### Task 2: ActiveSelection eligibility

**Files:**
- Create: `src/web/packages/editor/src/snap-manager/selection-eligibility.ts`
- Create: `src/web/packages/editor/src/snap-manager/selection-eligibility.test.ts`
- Modify: `src/web/packages/editor/src/snap-manager/index.ts:120-133` (the `startGesture` guard)

**Interfaces:**
- Consumes: Fabric `ActiveSelection`, `FabricObject`, `Group`, `Textbox`.
- Produces:
  ```ts
  /** Whether a composed selection may snap as a unit. Mirrors the fork's
   * `_isSupportedActiveSelection` (movement-snapping-controller.ts:180-197). */
  export function isSupportedActiveSelection(input: {
    readonly selection: ActiveSelection;
  }): boolean;
  ```

The fork refused a multi-selection when any child was parented, when the selection scale was not unit and a child was text, or when the children were of an unsupported kind. Vigilia's comment claims "Vigilia has no composite type to allow-list" — true for the *kind* clause, since every Vigilia object is text, shape, chart, group or image, but not for the other two clauses.

- [ ] **Step 1: Write the failing test**

```ts
// src/web/packages/editor/src/snap-manager/selection-eligibility.test.ts
import { ActiveSelection, Group, Rect, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { isSupportedActiveSelection } from "./selection-eligibility.js";

describe("active selection eligibility", () => {
  it("accepts two plain objects", () => {
    const selection = new ActiveSelection([
      new Rect({ width: 10, height: 10 }),
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(true);
  });

  it("refuses a single-object selection", () => {
    const selection = new ActiveSelection([new Rect({ width: 10, height: 10 })]);
    expect(isSupportedActiveSelection({ selection })).toBe(false);
  });

  it("refuses a selection containing a parented object", () => {
    const group = new Group([new Rect({ width: 10, height: 10 })]);
    const selection = new ActiveSelection([
      group.getObjects()[0]!,
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(false);
  });

  it("refuses a scaled selection containing text", () => {
    // The fork's comment: otherwise the text finalization path could
    // reinterpret movement as unfinished scaling.
    const selection = new ActiveSelection([
      new Textbox("hi", { width: 40, height: 20 }),
      new Rect({ width: 10, height: 10 }),
    ]);
    selection.set({ scaleX: 1.5, scaleY: 1.5 });
    expect(isSupportedActiveSelection({ selection })).toBe(false);
  });

  it("accepts a unit-scale selection containing text", () => {
    const selection = new ActiveSelection([
      new Textbox("hi", { width: 40, height: 20 }),
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/snap-manager/selection-eligibility.test.ts`
Expected: FAIL — module does not resolve.

- [ ] **Step 3: Port the guard**

Adapt the fork's `_isSupportedActiveSelection`. Keep the member-count, no-parented-child and unit-scale-with-text clauses; drop the kind allow-list clause (every Vigilia object is supported) and record that decision in the file's header comment, since §175 requires the dropped clause to be accounted for rather than silently missing:

```ts
// src/web/packages/editor/src/snap-manager/selection-eligibility.ts
// Ported: fork 9efdd78a src/editor/snapping-manager/movement/movement-snapping-controller.ts:180-197
// Dropped clause: the fork's per-child kind allow-list, because every Vigilia
// scene object is text, shape, chart, group or image, all of which support
// movement snapping.
```

- [ ] **Step 4: Apply it in `startGesture`**

After `const active = canvas.getActiveObject()` and before the bounds read:

```ts
    // A composed selection the fork declined must not join a gesture: a scaled
    // text selection would let the movement path be reinterpreted as an
    // unfinished scale.
    if (active instanceof ActiveSelection && !isSupportedActiveSelection({ selection: active }))
      return;
```

Add `ActiveSelection` to the `fabric/es` type import in `index.ts`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS.

- [ ] **Step 6: Verify in the browser**

Rebuild and check that dragging a two-object marquee selection still snaps to a neighbour, and that a deliberately scaled text selection does not join a snap gesture. Record both as browser tests in `tests/e2e/editor.spec.ts`; a jsdom test cannot show that Fabric never fires `object:moving` for the refused case.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/selection-eligibility.ts \
  src/web/packages/editor/src/snap-manager/selection-eligibility.test.ts \
  src/web/packages/editor/src/snap-manager/index.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): refuse a snap gesture for an unsupported selection"
```

---

### Task 3: Spacing hold state — prove it, then delete the dead ports

**Files:**
- Create: `src/web/packages/editor/src/snap-manager/spacing-hold.dom.test.ts`
- Modify: `src/web/packages/editor/src/snap-manager/constants.ts`
- Modify: `src/web/packages/editor/src/snap-manager/distance.ts`
- Modify: `src/web/packages/editor/src/snap-manager/spacing.ts`

**Interfaces:**
- Consumes: `SPACING_SNAP_HOLD_MARGIN` (`constants.ts:7`, live), `spacingRelease` (`movement-snapping-resolver.ts:1302`), `previousContext` (resolver `:765`, `:875`; `spacing.ts:237`).
- Produces: no new exports. This task removes two.

Two ported exports have no call sites: `SPACING_CONTEXT_SWITCH_DISTANCE` (`constants.ts:6`) and `resolveCommonDisplayDistance` (`distance.ts:32`). Under §175 they must not simply be deleted without first establishing whether the behaviour they provided exists. The evidence says it does: `SPACING_SNAP_HOLD_MARGIN` feeds `spacingRelease`, `SpacingSelectionContext` is a live type, and `previousContext` is threaded through the spacing calculator. This task proves that behaviourally and then deletes the genuinely dead code.

- [ ] **Step 1: Write the behavioural test**

```ts
// src/web/packages/editor/src/snap-manager/spacing-hold.dom.test.ts
// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSnapManager } from "./index.js";

/** Three equal-width shapes with the active one between them, so equal spacing
 * is reachable from a range of positions. */
function scene() {
  const canvas = new Canvas(document.createElement("canvas"));
  const snapping = createSnapManager({
    canvas,
    bounds: () => ({ left: 0, top: 0, right: 400, bottom: 300, centerX: 200, centerY: 150 }),
    errors: { error: vi.fn(), warn: vi.fn() } as never,
  });
  // Left ends at 160, right starts at 280: a 120 gap that a 40-wide object
  // splits evenly at 200.
  const left = new Rect({ id: "left", left: 100, top: 40, width: 60, height: 100 });
  const right = new Rect({ id: "right", left: 280, top: 40, width: 60, height: 100 });
  const active = new Rect({ id: "active", left: 200, top: 180, width: 40, height: 40 });
  canvas.add(left, right, active);
  canvas.setActiveObject(active);
  return { canvas, snapping, active };
}

/** Re-positions the object and fires one step, as Fabric does per pointermove. */
function move(canvas: Canvas, target: unknown, offset: number, e: object = {}): void {
  (target as Rect).set({ left: offset });
  canvas.fire("object:moving" as never, { target, e } as never);
}

describe("equal-spacing hold", () => {
  it("keeps the chosen spacing while the pointer stays near it", () => {
    const { canvas, snapping, active } = scene();
    canvas.fire("mouse:down" as never, { target: active } as never);

    // 200 is the exact equal-spacing position: 160 + (280 - 160 - 40) / 2.
    move(canvas, active, 200);
    expect(active.left).toBe(200);

    // A small step away is inside the release threshold, so the hold keeps the
    // object where it snapped rather than letting it follow the pointer.
    move(canvas, active, 203);
    expect(active.left).toBe(200);

    snapping.destroy();
  });

  it("releases once the pointer moves well past the margin", () => {
    const { canvas, snapping, active } = scene();
    canvas.fire("mouse:down" as never, { target: active } as never);

    move(canvas, active, 200);
    move(canvas, active, 250);
    // Beyond spacingRelease the hold lets go and the object follows the pointer
    // (pixel-rounded), rather than staying welded to the spacing guide.
    expect(active.left).toBe(250);

    snapping.destroy();
  });
});
```

- [ ] **Step 2: Run it and read the result before changing anything**

Run: `npx vitest run packages/editor/src/snap-manager/spacing-hold.dom.test.ts`

**Do not adjust the assertions to make this pass.** The outcome decides the rest of the task:

- **Both pass** → hold state provides the stickiness. Delete the two dead exports in Step 3 and say so in the commit.
- **The first fails** → stickiness is genuinely missing. `SPACING_CONTEXT_SWITCH_DISTANCE` is the fork's mechanism: wire it into the spacing selection in `spacing.ts` beside `previousContext`, using the exact value `5`, and re-run. If it then passes, the constant is live again and must **not** be deleted.
- **The second fails** → the hold never releases, which is Review Focus item 5. Fix the release threshold before continuing; a resize or drag that never releases is worse than no snap.

Record which branch happened in the commit message. If the numbers above turn out to be wrong for the fixture, fix the fixture's geometry to reach equal spacing — do not weaken the assertions to `toBeGreaterThan`/`not.toBe`.

- [ ] **Step 3: Delete only what is proven dead**

If Step 2 showed the hold works, remove `SPACING_CONTEXT_SWITCH_DISTANCE` from `constants.ts` and `resolveCommonDisplayDistance` from `distance.ts`, plus any now-unused imports. `calculateSpacingSnap` (`spacing.ts:1312`) is also unreferenced: check whether it is the entry point Step 2 exercised through `resolveSpacingNeighbors`; if it is genuinely unreachable, delete it in the same commit, and if it is reachable, leave it.

- [ ] **Step 4: Run the full snapping suite**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS. Deleting an export that something imported will show up here as a compile error, which is the point of running it.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/snap-manager
git commit -m "test(editor): pin equal-spacing hold, drop the dead spacing ports"
```

---

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

Note the import direction: `scale-snap-candidates.ts` imports its candidate *types* from `scale-snapping-resolver.ts`, so that module lands in Task 5. Port the shared types here as the fork has them if the union order gets awkward, or move `createScaleSnapCandidates` into Task 5 — but do not invent a new home for the types on either side.

The scaling subsystem is the headline gap: an author resizing to match a neighbour's edge today gets no guides and no snap at all. This task ports the two **pure** modules, which depend only on `../../utils/geometry` on the fork side. That helper is already ported in Vigilia as `getObjectExactBounds` / `ObjectBounds` in `bounds.js`, so these two files port with an import-path change and nothing else.

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

Port one behaviour per exported function, using the real linear-model API rather than a fabricated façade. The fork's own cases live under `e2e/tests/snapping-manager/**/scaling-*-controls.spec.ts` and `specs/src/editor/snapping-manager/` — read them for the expected numbers rather than inventing your own:

```ts
// src/web/packages/editor/src/snap-manager/scaling/scale-projection.test.ts
import { describe, expect, it } from "vitest";
import {
  createScaleProjection,
  projectScaleEdgePositions,
  resolveScaleProjection,
} from "./scale-projection.js";

// A 200x100 object at (100, 100). Scaling by "multiplier-x" moves the right
// edge one scene unit per unit of the variable, and leaves the left edge alone.
const bounds = { left: 100, top: 100, right: 300, bottom: 200, centerX: 200, centerY: 150 };
const horizontal = createScaleProjection({
  bounds,
  input: {
    variables: ["multiplier-x"],
    baselineValues: [1],
    variableSceneWeights: [1],
    edges: [
      { edge: "left", coefficients: [0] },
      { edge: "right", coefficients: [1] },
    ],
  },
});

describe("scale projection", () => {
  it("projects an unscaled drag on the right edge by the raw delta", () => {
    expect(projectScaleEdgePositions({ projection: horizontal, values: [1.2] }).right).toBe(320);
  });

  it("leaves the opposite edge fixed", () => {
    expect(projectScaleEdgePositions({ projection: horizontal, values: [1.2] }).left).toBe(100);
  });

  it("solves the value that puts an edge on a guide", () => {
    const solution = resolveScaleProjection({
      projection: horizontal,
      rawValues: [1.2],
      constraints: [{ axis: "x", edge: "right", position: 340 }],
      epsilon: 0.1,
    });
    expect(solution?.positions.right).toBe(340);
  });

  it("returns null when a constraint cannot be projected", () => {
    // The left edge cannot move under a multiplier-x-only model.
    expect(resolveScaleProjection({
      projection: horizontal,
      rawValues: [1.2],
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
  export type ScaleHoldState = Readonly<{
    /* the fork's FreeScaleAxisHold | HeldScaleAxisHold per axis */
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
  export function refineScaleSnapPlan(/* the fork's inputs */): ScaleSnapPlanRefinement;
  export function verifyScaleSnapPlan(input: {
    plan: ScaleSnapPlan; finalGeometry: FinalScaleGeometry;
  }): ScaleSnapVerification;
  ```

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

Cross-check each constant the resolver imports against `snap-manager/constants.ts`. `scaling-step-snap-guards.ts` needs `SNAP_GUARD_POSITION_EPSILON`, `SOURCE_SCALED_GUIDE_HOLD_EPSILON` and `getBoundsSnapGuardDistance`; if any are absent from Vigilia's constants or helpers, port them from the fork's `snapping-manager/constants.ts` into `snap-manager/constants.ts` in this task, with their exact values.

- [ ] **Step 3: Write the resolver test from the fork's cases**

The fork's `specs/src/editor/snapping-manager/` unit specs and the `e2e/tests/snapping-manager/**/scaling-*.spec.ts` files carry the expected numbers. Port at minimum:

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
  export function resolveRectangularScaleMultipliers(/* the fork's inputs */): RectangularScaleMultipliers;
  export function resolveRectangularScalePointerMultipliers(/* the fork's inputs */): RectangularScaleMultipliers;
  export function projectRectangularScaleBounds(input: {
    projection: RectangularScaleGestureProjection;
    multipliers: RectangularScaleMultipliers;
  }): Readonly<ObjectBounds> | null;
  export function resolveRectangularScaleModeProjection(input: {
    projection: RectangularScaleGestureProjection; mode: RectangularScaleGestureMode;
  }): RectangularScaleModeProjection | null;
  export function createRectangularScaleProjectionModes(/* the fork's inputs */): readonly ScaleProjectionModeInput[];
  export function resolveRectangularScaleMovingEdges(input: {
    projectionModes: readonly ScaleProjectionModeInput[];
  }): readonly ScaleSceneEdge[];
  ```

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
    expect(resolveRectangularScaleMovingEdges({ projectionModes }).sort()).toEqual(["bottom", "right"]);
  });
});
```

Fill the rotated and corner cases from the fork's `e2e/tests/snapping-manager/**/scaling-*-controls.spec.ts`. Two traps worth knowing before writing them: `createRectangularScaleGestureProjection` takes the *pointer start* in scene coordinates alongside the transform, and `multipliers` are relative to gesture start (1 means "unchanged"), not absolute scales.

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/editor/src/snap-manager/scaling`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/scaling
git commit -m "feat(editor): port the rectangular scale gesture projection"
```

---

### Task 7: Bind scaling, with verification-gated guides

**Files:**
- Create: `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-runtime.ts` (fork: 372 lines, minus its `ImageEditor` coupling)
- Create: `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts`
- Create: `src/web/packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`
- Modify: `src/web/packages/editor/src/snap-manager/index.ts` (bindings)
- Modify: `src/web/packages/editor/src/snap-manager/guide-renderer.ts` (only if the fork's scale-guide shape needs it)

**Interfaces:**
- Consumes: Tasks 4–6, `MovementSnappingRuntime`'s two-phase pattern (`resolveMovementPlan` → `verifyMovementPlan`, `movement-snapping-runtime.ts:115,159`).
- Produces: `ScaleSnappingRuntime` (ported) and `createScaleSnappingController` (new), bound to `object:scaling` / `object:scaled`.

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
// src/web/packages/editor/src/snap-manager/scaling/scaling.dom.test.ts
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
  /** One mr-handle step, with the object pre-scaled as Fabric would have left it. */
  const resize = (e: object, widthScale: number): void => {
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
  };
  return { canvas, snapping, anchor, resized, resize };
}

describe("scale snapping", () => {
  it("snaps a resize onto a neighbour's edge", () => {
    const { canvas, resized, snapping, resize } = setup();
    canvas.fire("mouse:down" as never, { target: resized } as never);
    // 200 * 1.19 = 238, two units short of the anchor's 300 edge... 
    resize({}, 1.2);
    expect(resized.getScaledWidth()).toBe(240);
    snapping.destroy();
  });

  it("re-plans on every scaling step, not once per gesture", () => {
    const { canvas, resized, snapping, resize } = setup();
    canvas.fire("mouse:down" as never, { target: resized } as never);
    // Far from the neighbour, so the first step resolves to itself.
    resize({}, 0.6);
    // The second step must be planned, not rejected as a duplicate.
    resize({}, 1.2);
    expect(resized.getScaledWidth()).toBe(240);
    snapping.destroy();
  });
});
```

**Fix the expected numbers against the real scene before trusting them.** The comments above are a sketch of the geometry, not verified values: work out the anchor edge, the resized object's start width and the multiplier that lands the moving edge inside `SNAP_THRESHOLD` (5 scene units at zoom 1), then make the assertion that exact number. Assert `getScaledWidth()` (or `getScaledHeight()` for a `mb` step), not `width` — the port moves `scaleX`, so `width` never changes and an assertion on it would pass vacuously.

The `mouse:down` call is what starts the movement gesture today. Confirm the scale controller starts its session from the first `object:scaling` instead, or from a shared gesture-start hook, so a resize that was never preceded by a `mouse:down` still engages. Whichever way the implementation goes, the test must cover it — that is the `editor.spec.ts` path, where the author grabs a handle directly.
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`
Expected: FAIL — nothing resizes the object.

- [ ] **Step 3: Implement the runtime and controller**

Port `ScaleSnappingRuntime` from the fork with its mechanics intact — the `WeakMap` keyed on marker identity, `pendingStep`, token issuance and consumption, and `finishSession` returning the guides to hide. Drop only the `ImageEditor` accessor in favour of the explicit inputs the movement runtime takes.

Then write `scale-snapping-controller.ts`, a thin orchestrator over Tasks 4–6 mirroring `movement-snapping-controller.ts`. Per `object:scaling` step:

1. **Marker.** `readMovementMarker({ event })` — the browser event, one per native pointer event. Never a per-gesture constant; that is the `83248dc` bug.
2. **Gesture start**, on the first step of a session: Fabric's `object:scaling` event is `BasicTransformEvent`, which carries exactly `{ e, transform, pointer }`. `transform` has `target`, `corner`, `action`, `original`, `originX`, `originY` — the `RectangularScaleGestureTransform` shape — and `pointer` is the scene point, which is the `pointerStart` argument. Pass them straight through; if `createRectangularScaleGestureProjection` returns `null` (unsupported control, or Alt-skew), end the session and do nothing.
3. **Baseline**, once: `createScaleGestureBaseline({ bounds: getObjectExactBounds(...), fixedAnchor: projection.fixedAnchor, projectionModes, candidates: createScaleSnapCandidates({ targetEdges: resolveRectangularScaleMovingEdges({ projectionModes }), sources }), zoom })`. Build `sources` the way `startGesture` does in `index.ts:126-143` — that is where the artboard is pushed as a `domain-boundary` source.
4. **Intent.** `projectionMode` from the modes `createRectangularScaleProjectionModes` returned for this control and mode; `values` from `resolveRectangularScaleMultipliers`; `modifiers` from `readMovementModifiers({ event })` — widen that helper to return `shiftKey` alongside `ctrlKey` (it currently returns `ctrlKey` only, `index.ts:81-93`), since `ScaleSnapModifiers` needs both. One modifier reader, used by both paths.
5. **Apply.** `target.set({ scaleX: originalScaleX * effectiveValues[0], scaleY: originalScaleY * effectiveValues[1] })`, then `setCoords()`. The canonical variables are multipliers relative to gesture start, so apply them against the *original* scales, never the current ones — applying against the current scale compounds on every step.
6. **Verify.** `measuredValues[i]` is the multiplier read back from the object after applying: `target.scaleX / originalScaleX`. Then `verifyScalePlan({ token, finalGeometry })`, and take guides from `verification.guides` only.

Guides must not be published from the plan. The fork publishes after exact-bound verification, and Review Focus item 1 is exactly this mistake.

Because `resolveScalePlan` throws when a previous token is unverified, step 6 must run on **every** planned step, including one whose plan changes nothing — same rule as the movement path's zero-delta case at `index.ts:219-226`.

- [ ] **Step 4: Bind it**

Add to the bindings array in `index.ts`:

```ts
    ["object:scaling", scaleRunStep],
    ["object:scaled", stopGesture],
```

Extend `stopGesture` to also call `scaleRuntime.finishSession()` when a scale session is active, and render `verification.guides` through the same `lastGuides` path the movement side uses — do not add a second guide channel. The existing `stopGesture` already clears guides and ends the session; reuse it rather than writing a second teardown. Check that `object:scaled` and `mouse:up` both firing is idempotent — `stopGesture` guards on `gestureActive`, and `finishSession` returns `didCleanup: false` when there is no session, so it should be — and the second test in Step 1 exercises the marker path that would expose a mistake here.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS.

- [ ] **Step 6: Verify the re-plan test has teeth**

Replace the event-derived marker with a per-gesture constant and rerun. Expected: the second test fails. This is the `83248dc` bug being guarded on the new path. Restore.

- [ ] **Step 7: Inspect the guides on screen**

Add a test to `src/web/tests/e2e/editor.spec.ts` beside `snaps a dragged object to a neighbour and shows a guide` (`editor.spec.ts:1526`) — same skip clause, same `toCanvas` mapping, same `page.mouse` gesture — that grabs a shape's right resize handle and drags it toward a neighbour's edge. Title it `snaps a resized object to a neighbour and shows a guide`, capture name `editor-snap-resize`, and add it to the `Editor mechanics` row of `docs/evidence/screenshots/README.md`.

Then rebuild and capture:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
  --grep "snaps a resized object" --workers=1
```

Open the capture and confirm guides appear during the resize, span the artboard, and line up with the neighbour's actual edge. Then confirm no guide is drawn when the resize is nowhere near a neighbour — a guide with no snap is Review Focus item 1.

- [ ] **Step 8: Commit**

```bash
git add src/web/packages/editor/src/snap-manager
git add src/web/tests/e2e/editor.spec.ts docs/evidence/screenshots
git commit -m "feat(editor): resize-time snapping with verified guides"
```

---

### Task 8: Ctrl and Shift during a resize

**Files:**
- Modify: `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts`
- Modify: `src/web/packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`

**Interfaces:**
- Consumes: the controller (Task 7); `readMovementModifiers` (`snap-manager/index.ts:81-93`) — reuse it rather than writing a second modifier reader.
- Produces: no new exports.

The fork documents Ctrl as the escape hatch returning the unrounded raw geometry, and Shift as constraining the resize. The movement path regained Ctrl in `83248dc`; scale must match, or an author can place an edge off-grid while moving but not while resizing.

- [ ] **Step 1: Write the failing test**

```ts
it("leaves the raw size alone while Ctrl is held", () => {
  const { canvas, resized, snapping, resize } = setup();
  canvas.fire("mouse:down" as never, { target: resized } as never);
  // Same step that snaps without Ctrl, so the only difference is the modifier.
  resize({ ctrlKey: true }, SNAPPING_MULTIPLIER);
  expect(resized.getScaledWidth()).toBe(200 * SNAPPING_MULTIPLIER);
  snapping.destroy();
});
```

`SNAPPING_MULTIPLIER` is the constant Step 1 of Task 7 established as the value that lands inside `SNAP_THRESHOLD`. Define it once in the test file and use it in both tasks, so the two stay in step.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`
Expected: FAIL — the width snaps to the neighbour's edge instead of holding the raw multiplier.

- [ ] **Step 3: Read the modifiers from the event**

`ScaleSnapModifiers` needs both `ctrlKey` and `shiftKey`; Task 7 already widened `readMovementModifiers` to return both, so reuse it here rather than adding a second reader. The resolver already honours Ctrl — `scale-snapping-resolver.ts` short-circuits to the disabled plan the same way `movement-snapping-resolver.ts:316` does. Confirm that in the ported source; if the scale resolver lacks the short-circuit, port it from the fork's `scale-snapping-resolver.ts` rather than adding a check in the controller.

Shift constrains the resize; check the fork's handling and port it in the same place, then add a Shift case here asserting the constrained result, rather than a separate task. Note that `resolveScaleSnapPlan` may treat a Shift-mismatch as a duplicate step and throw — if so, the controller must classify modifiers into its own step identity before calling the runtime, not pass a changing modifier set through unchanged.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS.

- [ ] **Step 5: Verify in the browser**

Ctrl-resize near a neighbour in a real session and confirm in the capture that no guide appears and the object keeps its fractional size. Ctrl-drag and Ctrl-resize must behave identically; if they do not, one of the two paths is reading the event differently.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/scaling
git commit -m "feat(editor): Ctrl escapes snapping during a resize"
```

---

### Task 9: The behaviour matrix

**Files:**
- Create: `src/web/tests/e2e/snapping.spec.ts`
- Modify: `docs/evidence/screenshots/README.md`

**Interfaces:**
- Consumes: everything above. Produces: nothing.

The gap shipped green because the only verification was one capture whose sole assertion is `screenshot.byteLength > 1000`. The fork carried ~65 snapping e2e specs across `shape/`, `text/`, `image/`, `group/` and `selection/`, each covering moving-geometry, moving-hold, moving-lifecycle, moving-spacing and the five scaling behaviours. Those fixtures are fork-specific (`editorModel`, `shapes`, `snapping`, `SNAPPING_TOLERANCE`) and cannot be reused, but the **cases** port directly.

- [ ] **Step 1: Read the fork's matrix**

```bash
git -C D:/git-repos/fabricjs-image-editor ls-tree -r --name-only 9efdd78a \
  | grep "e2e/tests/snapping-manager/"
```

Group them by behaviour class. The five classes per object kind are: geometry (does the position land where the guide says), hold (does it stick and then release), lifecycle (does it start and end cleanly), spacing (equal-spacing detection), and for scaling additionally minimum-size, round-trip and modes.

- [ ] **Step 2: Write the Vigilia matrix**

New file `src/web/tests/e2e/snapping.spec.ts`, skipping every test on non-desktop projects the way `editor.spec.ts:1529` does. Follow the existing conventions:

- Real gestures: `page.mouse.move/down/move({steps})/up` over `#vigilia-fabric-editor canvas.upper-canvas`, with artboard coordinates mapped through the canvas box, as `editor.spec.ts:1542` does.
- Read resulting geometry through the debug handle `window["vigilia-fabric-editor-…"]` (found by `key.startsWith("vigilia-fabric-editor-")`, as `editor.spec.ts:601`), which exposes `canvas.item(i)`.
- Assert **values**, not counts: after the gesture, read the object's `left`/`top` (move) or `width`/`height` (resize) and compare with the expected number.
- For guide presence, assert on the rendered pixels the guide occupies — sample the artboard row or column the guide should run along — not on `screenshot.byteLength`. A byte-length assertion is the defect this task exists to replace.

One test per case, named after the fork's case so the two can be compared. Cover, for **moving** and for **resizing**, against a shape, a text object and a group:

- the object lands exactly on the guide;
- a multi-step drag/resize re-plans at each step (the case that hid the P0);
- the snap releases past the release threshold;
- guides are absent when nothing is near;
- Ctrl returns the raw geometry;
- an equal-spacing case reaches equal spacing.

The resize half needs Task 7, so write it after that task lands.

- [ ] **Step 3: Run it**

Run: `npx playwright test --project=desktop-chromium tests/e2e/snapping.spec.ts --workers=1`
Expected: PASS. Report the count.

- [ ] **Step 4: Prove the matrix can fail**

Reintroduce the `83248dc` bug — a per-gesture marker — and rerun. Expected: the multi-step cases fail for both moving and resizing. Restore. If any case survives that break, its assertion is too weak and must be tightened, because those are the cases meant to prevent the regression that already shipped once.

- [ ] **Step 5: Register the evidence and commit**

The matrix's captures belong in the `Editor mechanics` row of `docs/evidence/screenshots/README.md` (`README.md:34`), which already lists `editor-snap-guides` / `snaps a dragged object`. Add the resize capture to the same row rather than inventing a domain: it is the same visible action class. Capture titles go through `captureVisualReview(page, testInfo, "<name>")` as the existing tests do.

```bash
git add src/web/tests/e2e/snapping.spec.ts docs/evidence/screenshots
git commit -m "test(editor): snapping behaviour matrix for move and resize"
```

---

### Task 10: Full gate and requirement close-out

**Files:**
- Modify: `docs/product/requirements.md`
- Modify: `docs/superpowers/specs/2026-09-24-editor-behaviour-review.md`
- Modify: `STATUS.md`

**Interfaces:**
- Consumes: everything above. Produces: nothing.

- [ ] **Step 1: Run the broad gate**

```bash
cd src/web
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run size
```

- [ ] **Step 2: Run the browser suite in full**

```bash
npm run test:e2e
```

`display-fabric.spec.ts` has two known pre-existing phone-chromium failures ("keeps repainting as samples arrive", "is byte-stable at a fixed clock on one platform"), both hanging at `document.fonts.ready` after `page.clock.runFor()`. Confirm unchanged and report; do not absorb them.

- [ ] **Step 3: Decide the legacy fallback path explicitly**

The spec requires a stated decision on the fork's second engine (`_resolveObjectMovementContext` → `_applyMovementObjectSnap` → `_applyMovementVisualGuides`, fork `index.ts:1098-1146`, over `line-snapping.ts`, `anchor-buckets.ts`, `pixel-grid.ts`, `snap-target-resolver.ts`). With the candidate filter relaxed in Task 1 and scaling ported in Tasks 4–8, evaluate whether any case still falls through. Record **port**, **replace** or **drop**, with the reason, in the spec's §5. Do not leave it unstated — that is how the defects this plan fixes survived.

If the decision is drop, note that `calculateSpacingSnap` and `getObjectBounds` were already left unreferenced by that choice, and that Task 3 removed the other dead ports.

- [ ] **Step 4: Close out §64 and §175**

§64 currently reads "Pixel rulers, configurable grid/guides, additional snapping modes and resize-time snapping are not present". Resize-time snapping now is, and the "under review / treat as unverified" sentence is discharged. Rewrite that paragraph to say movement and resize snapping are both present and verified by the behaviour matrix, and that pixel rulers, configurable grid/guides and additional snapping modes remain review candidates.

§175 needs no change — it is the requirement this work satisfies — but add `docs/superpowers/specs/2026-09-25-snapping-fidelity.md` to its design link.

In the behaviour review, move the **Resize-time snapping** candidate out of `## Candidates` and add it to the `## Promoted to requirements` bullet list, in the same shape as the existing two entries (name, one clause of history, the requirement it became). Its current text also carries the disproved claim that resize snapping was skipped because the scaling subsystem was "coupled to object types Vigilia does not have" — Tasks 4–6 showed only two modules carry real coupling, so state that instead. Leave `### Rulers, configurable grid/guides and pixel snapping` where it is; this plan does not touch it.

Also flip the spec's status line from "design; not yet planned" to name this plan.

- [ ] **Step 5: Inspect the visible outcome**

Capture and open: guides during a drag, guides during a resize, an equal-spacing guide with its distance label, Ctrl-drag and Ctrl-resize with no guides. Each is a visible behaviour; none is proven by a unit test asserting a guide array.

- [ ] **Step 6: Update STATUS.md**

Replace "Last completed change" with a 1–5 bullet summary, and update "Blockers / unverified" — the line reading "Snapping/smart-guide fidelity is under review; gap list not yet in hand" is now resolved. Run `npm run status:check`.

- [ ] **Step 7: Commit**

```bash
git add docs/product/requirements.md \
  docs/superpowers/specs/2026-09-24-editor-behaviour-review.md STATUS.md
git commit -m "docs(product): close the snapping fidelity review"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| 1. Resize-time snapping | 4, 5, 6, 7 |
| 2. Candidate-filter parity | 1 |
| 3. Spacing context stickiness | 3 |
| 4. ActiveSelection eligibility | 2 |
| 5. Fallback path decision | 10 Step 3 |
| Ctrl / axis locks during resize | 8 |
| Guides gated on verification | 7 |
| Verification: multi-step, values not counts, rendered capture | 4–9, 9 Step 4 |
| Non-goals (rulers, angle, size-indicator pass) | not tasked, deliberately |

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N". Tasks 4–6 give the fork path and the exact permitted diff instead of inlining 4,000 lines — the source is the specification there, and transcription by hand would be the riskier act. Every step that can carry code does.

Two places deliberately leave a number to be settled rather than asserting one:

- Task 3 Step 2 states three possible outcomes for the spacing-hold test and what to do for each, rather than presuming which is true. That is a real decision the evidence must settle, and the step says so.
- Task 7 Step 1 shows the harness and the shape of the assertion but tells the implementer to fix the exact multiplier and edge positions against the real scene. Guessing a plausible `1.2` there would be worse than saying "work it out", because the implementer has the running test in front of them and I do not. The step names the exact thing to compute (the multiplier that lands the moving edge inside `SNAP_THRESHOLD` of the anchor edge) and the exact thing to assert (`getScaledWidth()`, not `width`).

**A note on the ported tasks' expected values.** Tasks 4–6 tell the implementer to take numbers from the fork's specs rather than invent them. That is correct — the fork's numbers are the specification of parity — but it means the plan cannot pin them here without copying ~4,000 lines. If an implementer reports that a fork spec's numbers do not reproduce, that is a real finding about the port, not a test to loosen.

**Type consistency:** `ObjectBounds` and `getObjectExactBounds` come from `../bounds.js` throughout. `readMovementModifiers` is defined once in `index.ts`, widened in Task 7 to return `shiftKey` too, and reused by both controllers (Tasks 2, 7, 8). `stopGesture` is reused by the scaling path rather than duplicated. The marker rule — one per native pointer event from `event.e` — is stated identically in Tasks 7 and 9. Every scaling type and function name in Tasks 5–7 is copied verbatim from the fork, so the ported source and the plan cannot drift apart.

**Review Focus coverage:** item 1 → Task 7 Step 3 and Step 7; item 2 → Task 8 Step 1; item 3 → Task 6 Step 3; item 4 → Task 1 Step 1 and Step 6; item 5 → Task 3 Step 2 (second case) and Task 5 Step 3.

**Sequencing note:** Tasks 1–3 are independent of 4–8 and deliver user-visible improvements on their own. If the port proves larger than expected, 1–3 and 9 can land first — but Task 9's resize half needs Task 7, so the matrix lands whole.

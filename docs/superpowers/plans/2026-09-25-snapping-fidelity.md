# Snapping Fidelity Implementation Plan

> **Active plan.** `STATUS.md` names this plan as the one active plan; the
> viewport-and-mechanics plan that preceded it is archived. Tasks 1, 3, 4, 5 and
> 6 are **landed**, each marked below with its commits;
> Tasks 2, 7, 8, 9 and 10 remain. Landed tasks are kept whole as the record of
> what was built — do not re-dispatch one. The unticked boxes are the resume
> signal: only Tasks 2, 7, 8, 9 and 10 carry them.
> Resume with `superpowers:subagent-driven-development` or
> `superpowers:executing-plans`, one task at a time.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Vigilia's snapping and smart guides up to the retired fork's practical quality: port the resize/scale snapping subsystem the parity plan deferred, restore the candidate filter and selection guards that were narrowed, and replace the single capture that hid the gap with a behaviour matrix that can actually fail.

**Architecture:** The movement geometry core is already a byte-comparable port and stays as it is. What is added is the fork's **second** snapping engine — scale/resize — as a sibling subsystem under `snap-manager/scaling/`, sharing the existing candidate, guide and bounds helpers rather than duplicating them. Coupling is stripped at exactly two seams: the fork's `ImageEditor` accessor and its `CropFrame` dependency.

**Tech Stack:** TypeScript, Fabric 7.4.0 (`fabric/es`), Vitest + jsdom, Playwright, Biome. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-25-snapping-fidelity.md`

**Reference source:** fork `9efdd78a` at `D:\git-repos\fabricjs-image-editor`, branch `codex/fabric-es`. **Read-only.** Retrieve files only with `git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:<path>` and `git ls-tree`; never `checkout`, `switch` or `restore` there, and never mutate that repository.

## Plan audit — 2026-09-26

Each row is a false promise corrected in this file; nothing else was rewritten.
Tasks 1, 3, 4, 5 and 6 are landed and their bodies are the record of what was
built, so a row naming them corrects the record, not instructions to come.

| Task | Correction |
|---|---|
| — (banner) | Said nothing about task state. Now names this plan as queued behind the viewport plan, states that five tasks are landed and five remain, and marks the unticked boxes as the resume signal. |
| 1 | The `IGNORED_IDS = ["scene"]` block, the `selectable`-only failure values, and the `new-fabric-theme.ts:320-330 / :328 / :15-19` citation were the pre-landing draft. The landed code holds `["background"]`, derives the fixture's plate id from the theme, and the plate's real id is the eighth `rect()` argument at `new-fabric-theme.ts:323` (`:15-19` is `backgroundOnly`). Step 3's block now shows what landed. |
| 3 | `calculateSpacingSnap` is described as present-but-unreferenced when it has been deleted; `distance.ts:32` for `resolveCommonDisplayDistance` was already corrected to the pre-deletion `:32`, but the type paragraph also needed the landing recorded. Step 3 now says the deletion happened. |
| 4–6 | Marked landed with their feature and fix-round commits; step boxes ticked. No body prose changed. |
| 7 | `readMovementMarker`/`readMovementModifiers` cited at `index.ts:66-79`/`:82-93` (actual `:63-76`/`:79-90`); the artboard-source citations `:133-143`/`:126-131` (actual `:123-140`/`:129-140`); `mouse:up` at `:269` (actual `:266`); `as never` at `:304` (actual `:301`); `scale-projection.ts:11` (actual `:12-16`); `readMovementModifiers` again at `:81-93` (actual `:79-90`); `scale-snapping-resolver.ts:626` (the fork's line, not the port's — replaced by naming the throw). `applyRectangularScalePlan` (`:74`), `setPositionByOrigin` (`:99`) and `readFinalRectangularScaleGeometry` (`:124`) gained their fork line numbers. The e2e anchor `editor.spec.ts:1526` is now `:2089`, and `toCanvas` (which does not exist) is now `sceneToClient(page, 1280, …)`. **`git add …/scaling` was a directory stage of five already-committed files** and is now five explicit paths. Files block gained the two files Step 7 edits. |
| 8 | The "citation is off by two lines" complaint about `readMovementModifiers` was itself stale — the citation was right. The `scale-snapping-resolver.ts:626` throw now cites the ported `:332` Ctrl short-circuit instead. |
| 9 | The commit staged `docs/evidence/screenshots/*snap*.png`, which also names Task 1's movement capture; it now names the resize capture. `captureVisualReview` is file-scope and unexported in `editor.spec.ts`, so the step now says to export and import it, and the Files block gained `editor.spec.ts`. |
| 8 (again) | Step 6 still staged the `scaling/` directory — the same defect this audit fixed for Task 7 Step 8 and Task 9 Step 5, missed here because Task 8's brief was regenerated after the audit and the fix did not reach it. Now two explicit paths, plus `index.ts` conditionally. |
| 7, 9 (again) | Every `editor.spec.ts` line citation is stale and cannot be kept fresh: the file has moved three times (`a5f6ba8` → `2929f87` → Task 2's `4fcd162`, which added 262 lines). Both steps now locate their anchors **by test title**, and Task 9's export list grew from one helper to three — `sceneToClient` and `clientOfScene` are as unexported as `captureVisualReview`, and Task 9's own instruction to reuse them is impossible without exporting them. The file contains zero `export` statements today. |
| 10 Step 3 | Pre-answered: the fallback path is **drop**, and it is measured, not judged — all four fork fallback modules (`line-snapping`, `anchor-buckets`, `pixel-grid`, `snap-target-resolver`) are absent, and `scaling/scaling-step-snap-guards.ts` (1,322 lines) has **zero importers**. The step's drop-branch note claiming `getObjectBounds` "is live again" is therefore false: its only references are inside that unreachable module. The implementer verifies the measurement rather than re-deriving it, and must not write a test asserting the guard family works — a test for unreachable code is green-and-wrong. |
| 10 | The `display-fabric.spec.ts` title in the gate block is `is byte-stable at a fixed clock on one platform` (`:671`), not the truncated form. Step 3's note that `getObjectBounds` is unreferenced is false once Tasks 4–6 land. Step 4 gained the review doc's line ranges and the note that the vendored-geometry rule is cited by the port markers. Step 6 described a STATUS.md whose blockers list no longer exists. |
| Self-Review | "reused by both controllers (Tasks 2, 7, 8)" was wrong — Task 2 does not read modifiers. |

Checked and clean: every fork path and line number in Tasks 2, 4, 5, 6 and 9
(all 16 named files exist at `9efdd78a` with the stated line counts; every
`snap-manager/` line number in Tasks 1–6 verified against
`git show a5f6ba8:…`, the commit the citations were written against), the
Fabric `EventTypeDefs.d.ts` key list and line numbers, `index.mjs:3193-3199`
and `:12633-12636`, the fork's `index.ts` fallback chain, and the
`ScaleProjectionVariable` union. Full audit:
`.superpowers/sdd/2026-09-25-snapping-fidelity/plan-audit-2026-09-26.md`.

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
5. **A resize that never releases**, so the object stays welded to a neighbour it was dragged away from. Release thresholds must exceed acquire thresholds. → **Task 5**, not Task 4: release lives in `ScaleSnapThresholds` (`acquire`, `release`, `spacingRelease`, `verification`) and the resolver that reads them, and Task 4's projection-only file has no hold state to release. Task 4 is the *acquire* half, and item 3 is its focus. Task 5's Step 3 carries the release case.

---

### Task 1: Candidate-filter parity

> **Landed** - `8be1364 + 69e5121`.

**Files:**
- Modify: `src/web/packages/editor/src/snap-manager/index.ts:32-42`
- Modify: `src/web/packages/editor/src/snap-manager/excluded-objects.ts`
- Modify: `src/web/packages/editor/src/snap-manager/index.dom.test.ts`
- Test: `src/web/packages/editor/src/snap-manager/index.dom.test.ts`

**Interfaces:**
- Consumes: `shouldIgnoreObject` from `./excluded-objects.js` (already present).
- Produces: no new exports. `isSnapTarget` changes behaviour; its signature is unchanged.

Today `isSnapTarget` requires `object.selectable === true && object.get("locked") !== true`. The fork's `utils/object-filter.ts:28-45` excludes only the active object and its selection children, `visible === false`, and `IGNORED_IDS`. Locking a layer in the fork prevents *moving* it, not *aligning to* it.

- [x] **Step 1: Write the failing tests**

Append to `index.dom.test.ts`:

```ts
it("aligns to a locked neighbour, which lock must not prevent", () => {
  const { canvas, snapping } = setup();
  const locked = new Rect({
    id: "a", left: 100, top: 20, width: 40, height: 40, locked: true,
    selectable: false, evented: false,
  });
  // Deliberately narrow: the dragged rect's right edge (110) must stay far from
  // the neighbour's right edge (140), or that 30-wide gap competes with the
  // 2-wide left-edge gap and the drag resolves to the wrong anchor.
  const dragged = new Rect({ id: "b", left: 98, top: 150, width: 12, height: 40 });
  canvas.add(locked, dragged);
  canvas.setActiveObject(dragged);

  canvas.fire("mouse:down" as never, { target: dragged } as never);
  move(canvas, dragged);

  // Only the neighbour's left edge is in range: 100 - 98 = 2 <= SNAP_THRESHOLD.
  expect(dragged.left).toBe(100);
  snapping.destroy();
});

it("ignores the artboard plate even though it is large and centrally placed", () => {
  const { canvas, snapping } = setup();
  // The plate is not selectable, but it spans most of the artboard, so its
  // centre would otherwise be a candidate for anything placed near it. Its
  // geometry is deliberately off-centre from the artboard: a plate centred at
  // the artboard's own centre (200, 150) would be indistinguishable from the
  // artboard's domain-boundary guide.
  const plate = new Rect({
    id: "scene", left: 40, top: 30, width: 240, height: 180,
    selectable: false, evented: false,
  });
  const dragged = new Rect({ id: "b", left: 158, top: 40, width: 20, height: 20 });
  canvas.add(plate, dragged);
  canvas.setActiveObject(dragged);

  canvas.fire("mouse:down" as never, { target: dragged } as never);
  move(canvas, dragged);

  // The plate's centreX is 160, so the dragged rect's left edge (158) is 2 away
  // — inside SNAP_THRESHOLD. Without the id exclusion the drag would resolve to
  // left 160. Ignored ids never contribute a candidate, so it stays put.
  expect(dragged.left).toBe(158);
  snapping.destroy();
});

it("still ignores a hidden neighbour", () => {
  // A regression guard, not a new behaviour: `visible === false` is already
  // handled by `shouldIgnoreObject` and this step does not change it. It passes
  // before this task's change and after it, which is the point.
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

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/editor/src/snap-manager/index.dom.test.ts`
Expected: FAIL on the first two. The third (hidden neighbour) passes both before and after — it is the labelled regression guard. The first fails because the locked object is not a snap candidate at all under the current filter; the second fails because `selectable: false` excludes the plate and nothing yet excludes it by id.

**Both new failing tests must be shown red before Step 3, and red for the stated reason — not because the fixture is out of range.** If either passes at this step, the fixture is wrong (its candidate is not in reach), not the code: fix the fixture's geometry, do not proceed. This matters because a test that is green before the change proves nothing and will still be green after a bad implementation.

- [x] **Step 3: Relax the filter and name the ignored ids**

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

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS, all tests including the untouched ones.

- [x] **Step 5: Verify the tests have teeth**

Restore `object.selectable === true &&` to the predicate and rerun. Expected: the locked-neighbour test and the plate test both fail, and both fail on their own assertion line — `expected 98 to be 100` and `expected 160 to be 158`. The listed actual values are the check that the failure is alignment-driven; a failure reading `expected 98 to be 98` or any other value means the fixture, not the code, is being measured. Restore the relaxed version.

Then empty `IGNORED_IDS` and rerun. Expected: the plate test fails (`expected 160 to be 158`) and the locked-neighbour test still passes. Restore `["scene"]`.

- [x] **Step 6: Inspect the starter theme for noise**

Removing the `selectable` gate makes decorative `selectable: false` objects alignable. The starter theme has exactly one such object — the artboard plate, id `scene`, created at `new-fabric-theme.ts:320-330` (the single `backgroundOnly` use is at `:328`; `:15-19` is the *style constant*, not the object). It is now excluded by id — but confirm that in the browser rather than trusting the grep:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
  --grep "snaps a dragged object" --workers=1
```

Open the capture. Confirm guides appear against real content (the wordmark, a panel, a chart) and that no guide appears against the artboard plate except at the true artboard edges. If decoration is noisy, add its id to `IGNORED_IDS` with a comment naming why — do not reintroduce the `selectable` gate, which would also block locked objects.

- [x] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/index.ts \
  src/web/packages/editor/src/snap-manager/excluded-objects.ts \
  src/web/packages/editor/src/snap-manager/index.dom.test.ts
git commit -m "fix(editor): align to locked objects, ignore the artboard plate"
```

---

### Task 2: ActiveSelection eligibility

> **Landed** - `4fcd162`. Task review: spec compliant, quality approved, 0 Critical, 0 Important.
> Six Minor findings dispositioned in the ledger; one (a claimed unreachable clause) was **rejected**
> against Fabric's source. One out-of-scope observation — the fork's `isSupportedTarget` clause
> (`!target || target.group`) has no Vigilia equivalent — is carried to Task 7's ledger as a
> `ponytail:` note on the delta-application path, not as new work here.

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

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/snap-manager/selection-eligibility.test.ts`
Expected: FAIL — module does not resolve.

- [x] **Step 3: Port the guard**

Adapt the fork's `_isSupportedActiveSelection`. Keep the member-count, no-parented-child and unit-scale-with-text clauses; drop the kind allow-list clause (every Vigilia object is supported) and record that decision in the file's header comment, since §175 requires the dropped clause to be accounted for rather than silently missing:

```ts
// src/web/packages/editor/src/snap-manager/selection-eligibility.ts
// Ported: fork 9efdd78a src/editor/snapping-manager/movement/movement-snapping-controller.ts:180-197
// Dropped clause: the fork's per-child kind allow-list, because every Vigilia
// scene object is text, shape, chart, group or image, all of which support
// movement snapping.
```

- [x] **Step 4: Apply it in `startGesture`**

After `const active = canvas.getActiveObject()` and before the bounds read:

```ts
    // A composed selection the fork declined must not join a gesture: a scaled
    // text selection would let the movement path be reinterpreted as an
    // unfinished scale.
    if (active instanceof ActiveSelection && !isSupportedActiveSelection({ selection: active }))
      return;
```

`ActiveSelection` must be a **value** import, not a type import: `instanceof` needs the runtime class, and `import type` is erased. `index.ts:1` currently reads `import type { Canvas, FabricObject } from "fabric/es";` — split it:

```ts
import { ActiveSelection } from "fabric/es";
import type { Canvas, FabricObject } from "fabric/es";
```

Getting this wrong does not fail to compile and does not fail any test: the `TypeError: Right-hand side of 'instanceof' is not an object` lands inside `guard` (`index.ts:278-286`), which turns it into a swallowed `errors.error("snapping", …)`, so the gesture silently never starts. Step 6's browser check is what catches it.

**Also import `isSupportedActiveSelection`** into `index.ts` from `./selection-eligibility.js` in the same edit — the guard calls it, and no step otherwise says where it comes from. This one *is* caught by the compiler.

- [x] **Step 5: Run the tests**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS.

- [x] **Step 6: Verify in the browser**

Rebuild and check that dragging a two-object marquee selection still snaps to a neighbour, and that a deliberately scaled text selection does not join a snap gesture. Record both as browser tests in `tests/e2e/editor.spec.ts`; a jsdom test cannot show that Fabric never fires `object:moving` for the refused case.

- [x] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/selection-eligibility.ts \
  src/web/packages/editor/src/snap-manager/selection-eligibility.test.ts \
  src/web/packages/editor/src/snap-manager/index.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): refuse a snap gesture for an unsupported selection"
```

---

### Task 3: Spacing hold state — prove it, then delete the dead ports

> **Landed** - `a90bc43`.

**Files:**
- Create: `src/web/packages/editor/src/snap-manager/spacing-hold.dom.test.ts`
- Modify: `src/web/packages/editor/src/snap-manager/constants.ts`
- Modify: `src/web/packages/editor/src/snap-manager/distance.ts`
- Modify: `src/web/packages/editor/src/snap-manager/spacing.ts`

**Interfaces:**
- Consumes: `SPACING_SNAP_HOLD_MARGIN` (`constants.ts:7`, live), `spacingRelease` (`movement-snapping-resolver.ts:1302`), `previousContext` (resolver `:765`, `:875`; `spacing.ts:237`).
- Produces: no new exports. This task removes two.

Two ported exports have no call sites: `SPACING_CONTEXT_SWITCH_DISTANCE` (`constants.ts:6`) and `resolveCommonDisplayDistance` (`distance.ts:32`). Under §175 they must not simply be deleted without first establishing whether the behaviour they provided exists. The evidence says it does: `SPACING_SNAP_HOLD_MARGIN` feeds `spacingRelease` (`movement-snapping-resolver.ts:1302`, live), `SpacingSelectionContext` is a live type (`spacing.ts:237`), and `previousContext` is threaded through the spacing calculator. This task proves that behaviourally and then deletes the genuinely dead code.

**What these two exports *were* for matters to Step 3, and copying them back in is not an option.** The resolver replaces both by construction: the live release window is `(SNAP_THRESHOLD + SPACING_SNAP_HOLD_MARGIN) / zoom` (`:1302`) and the live switch distance is `previousContext ? Number.POSITIVE_INFINITY : 0` (`:886`) — a hard hold-or-nothing, strictly stronger than the constant's flat `5`. So if Step 2 shows stickiness is *missing*, wiring `SPACING_CONTEXT_SWITCH_DISTANCE` back in would **weaken** the live rule while claiming to restore it, and Step 2's second branch forbids exactly that.

- [x] **Step 1: Write the behavioural test**

```ts
// src/web/packages/editor/src/snap-manager/spacing-hold.dom.test.ts
// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSnapManager } from "./index.js";

/** Two flanking shapes with the active one between them, so equal spacing is
 * reachable. The two flankers are 60 wide and the active object is 40. */
function scene() {
  const canvas = new Canvas(document.createElement("canvas"));
  const snapping = createSnapManager({
    canvas,
    // The artboard's centre is deliberately far from the equal-spacing position.
    // At centreX 200 it coincides with it, and the artboard's own centre guide
    // then produces the same `200` the equal-spacing hold would — so the fixture
    // would pass without any spacing logic existing at all.
    bounds: () => ({ left: 0, top: 0, right: 1000, bottom: 300, centerX: 500, centerY: 150 }),
    errors: { error: vi.fn(), warn: vi.fn() } as never,
  });
  // Both flankers span the active object's band: an equal-spacing chain only
  // forms between objects overlapping on the perpendicular axis, so flankers
  // that do not reach `active`'s band are invisible to the spacing calculator
  // and nothing ever holds.
  // `originX`/`originY` are explicit: Fabric 7's default origin is CENTER
  // (`shapes/Object/defaultValues.mjs`, `originX: CENTER`), so a bare `left`
  // is the shape's centre, not its edge, and every computed edge shifts by
  // half the width.
  const rect = (options: Record<string, unknown>): Rect =>
    new Rect({ originX: "left", originY: "top", ...options });
  // Left ends at 161, right starts at 280 (each includes a 0.5px stroke per
  // side): a gap a 41-wide bounded object splits evenly at 200.
  const left = rect({ id: "left", left: 100, top: 0, width: 60, height: 300 });
  const right = rect({ id: "right", left: 280, top: 0, width: 60, height: 300 });
  const active = rect({ id: "active", left: 200, top: 180, width: 40, height: 40 });
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

    // 200 is the exact equal-spacing position: 161 + (280 - 161 - 41) / 2.
    move(canvas, active, 200);
    expect(active.left).toBe(200);

    // The step must land PAST the acquire threshold and INSIDE the release
    // threshold, or it proves nothing. The equal-spacing optimum for a 40-wide
    // object between these two flankers is the fixed position 200, but the
    // resolver only *reaches* it while the pointer is within `acquire` of it —
    // so at a small pointer offset, re-acquiring finds the same 200 on its own
    // and the object reads 200 with no hold at all. Inside the release window
    // it reads 200 because the previous context is held; outside acquire it
    // cannot. Sweep to find where that stops being true.
    move(canvas, active, HOLD_STEP);
    expect(active.left).toBe(200);

    snapping.destroy();
  });

  it("releases once the pointer moves well past the margin", () => {
    const { canvas, snapping, active } = scene();
    canvas.fire("mouse:down" as never, { target: active } as never);

    move(canvas, active, 200);
    move(canvas, active, RELEASE_STEP);
    // Outside the release window the hold lets go and the object follows the
    // pointer, rather than staying welded to the spacing guide.
    expect(active.left).toBe(RELEASE_STEP);

    snapping.destroy();
  });
});
```

**Measure `HOLD_STEP` and `RELEASE_STEP` before writing the assertions — do not derive them from the constants.** Measure the actual release boundary with a sweep, then set:

```ts
/** Measured on <date>: the last offset from the equal-spacing position at which
 * the object still reads 200. The window is not simply
 * SNAP_THRESHOLD + SPACING_SNAP_HOLD_MARGIN — measure it, as the comment's
 * derivation is what makes this test honest. */
const HOLD_STEP = /* the last holding offset */;
/** Comfortably past the release boundary, so this step cannot straddle it. */
const RELEASE_STEP = /* boundary + 10 */;
```

A sweep is a few lines in the test file: loop `offset` from 201 to 220, `move(canvas, active, offset)`, record `active.left`, and print the transition. Delete the sweep once the two constants are set, replacing it with the comment above.

**Two outcomes are legitimate and both must be reported, not papered over.** If the sweep shows no holding window at all — the object follows the pointer at every offset — then spacing stickiness does not exist on the movement path, and Step 2's first branch applies: **stop and report; do not wire `SPACING_CONTEXT_SWITCH_DISTANCE` in, and do not delete the two exports.** Weakening these assertions to `toBeGreaterThan`/`not.toBe`, or widening the fixture until something holds, is the one thing this step forbids — it would manufacture the evidence Step 3 uses to delete live code.

- [x] **Step 2: Run it and read the result before changing anything**

Run: `npx vitest run packages/editor/src/snap-manager/spacing-hold.dom.test.ts`

**Do not adjust the assertions to make this pass.** The outcome decides the rest of the task:

- **Both pass** → hold state provides the stickiness. Delete the two dead exports in Step 3 and say so in the commit.
- **The first fails** → stickiness is genuinely missing. **Stop and report it; do not wire `SPACING_CONTEXT_SWITCH_DISTANCE` in.** The live resolver already passes `switchDistance: previousContext ? Number.POSITIVE_INFINITY : 0` (`movement-snapping-resolver.ts:886`), which is strictly stronger than the constant's `5`, so wiring it in would *weaken* the hold while claiming to restore it. Report the observed `left` values for both steps in the commit message and leave the two exports in place.
- **The second fails** → the hold never releases, which is Review Focus item 5. Report it before continuing; a drag that never releases is worse than no snap.

Record which branch happened in the commit message, including the measured boundary. If the numbers above turn out to be wrong for the fixture, fix the fixture's geometry to reach equal spacing — do not weaken the assertions to `toBeGreaterThan`/`not.toBe`.

**One thing to confirm before trusting either step:** that the anchor being held is genuinely the *spacing* candidate and not the artboard's centre guide. The fixture's `bounds()` is deliberately off-centre for exactly this reason, but the cheap confirmation is to delete the two flanking rects and re-run: if the object still reads `200` with no neighbours, the fixture is measuring the artboard, not spacing, and the test must be rebuilt rather than adjusted.

- [x] **Step 3: Delete only what is proven dead**

If Step 2 showed the hold works, remove `SPACING_CONTEXT_SWITCH_DISTANCE` from `constants.ts` and `resolveCommonDisplayDistance` from `distance.ts`, plus any now-unused imports.

**Deleting `resolveCommonDisplayDistance` orphans the `CommonDisplayDistance` type in the same file**, and a same-file declaration is not an import, so "plus any now-unused imports" does not cover it. The type (`distance.ts:22-27`) is referenced only by the function you are removing — verified: the only other mentions of it anywhere are its declaration and that function's parameter and return annotations. Delete it too, or the task leaves freshly-orphaned dead code behind, which is the opposite of its purpose. **Do not delete `MAX_DISPLAY_DISTANCE_DIFF`** (`distance.ts:19`): it looks like part of the same cluster but is live, imported by `spacing.ts:2` and read at `spacing.ts:561`. `resolveDisplayDistance` (`distance.ts:4`) is live too — imported by `guide-renderer.ts:5`, `spacing-chains.ts:1` and `spacing.ts:3`.

`calculateSpacingSnap` (which sat at `spacing.ts:1312`) is gone: the implementer established it was unreachable and deleted it with the rest.

- [x] **Step 4: Run the full snapping suite**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS. Deleting an export that something imported will show up here as a compile error, which is the point of running it.

- [x] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/snap-manager
git commit -m "test(editor): pin equal-spacing hold, drop the dead spacing ports"
```

---

### Task 4: Scale snap candidates and projection

> **Landed** - `cf5ec0e`.

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

- [x] **Step 1: Retrieve the fork sources**

```bash
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:src/editor/snapping-manager/scaling/scale-snap-candidates.ts \
  > "$TEMP/fork-scale-snap-candidates.ts"
git -C D:/git-repos/fabricjs-image-editor show \
  9efdd78a:src/editor/snapping-manager/scaling/scale-projection.ts \
  > "$TEMP/fork-scale-projection.ts"
```

Read both in full before adapting. They are the specification.

- [x] **Step 2: Adapt them into the new files**

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

- [x] **Step 3: Write the test**

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

- [x] **Step 4: Run the test**

Run: `npx vitest run packages/editor/src/snap-manager/scaling`
Expected: PASS.

- [x] **Step 5: Verify teeth**

In `projectScaleEdgePositions` and `resolveScaleProjection`, return the input values unchanged instead of projecting them, and rerun. Expected: failures on the projected-position and constraint-solve tests. Restore.

- [x] **Step 6: Commit**

The ported files are a deliberate exception to the 800-line stop; say so in the message.

```bash
git add src/web/packages/editor/src/snap-manager/scaling
git commit -m "feat(editor): port scale snap candidates and projection

Vendored source is a deliberate exception to the file-size signal; it
stays byte-comparable with fork 9efdd78a apart from import paths."
```

---

### Task 5: Scale snap resolver

> **Landed** - `d86baac`.

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

- [x] **Step 1: Retrieve the three fork sources**

```bash
for f in scale-snapping-resolver scaling-snap-guard scaling-step-snap-guards; do
  git -C D:/git-repos/fabricjs-image-editor show \
    9efdd78a:src/editor/snapping-manager/scaling/$f.ts > "$TEMP/fork-$f.ts"
done
```

- [x] **Step 2: Adapt with the same permitted changes as Task 4**

Import paths to Vigilia's `bounds.js` and `constants.ts`, English comments, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` fixes, provenance line. Thresholds and tolerances are copied **verbatim** — a changed tolerance is precisely the "weaker tolerances" failure §175 names.

Cross-check each constant the resolver imports against `snap-manager/constants.ts`. `scaling-step-snap-guards.ts` needs `SNAP_GUARD_POSITION_EPSILON`, `SOURCE_SCALED_GUIDE_HOLD_EPSILON` and `getBoundsSnapGuardDistance`. **These are not in the fork's `constants.ts`** — all three are declared in `scaling-snap-guard.ts` (`:2`, `:5`, `:23`), which this task already creates as a ported file, so they arrive with it and **nothing needs adding to `snap-manager/constants.ts`**. Do not re-declare them there: two homes for one constant is exactly the drift this step exists to prevent. The instruction to port them into `constants.ts` is struck.

- [x] **Step 3: Write the resolver test from the fork's cases**

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

- [x] **Step 4: Run the test**

Run: `npx vitest run packages/editor/src/snap-manager/scaling`
Expected: PASS.

- [x] **Step 5: Verify teeth**

Change one acquire tolerance by 1 and confirm the matching test fails. Restore. This is the check that the tests are pinned to the fork's numbers rather than to whatever the port happens to do.

- [x] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/scaling
git commit -m "feat(editor): port the scale snap resolver and step guards"
```

---

### Task 6: Scale gesture projection and interaction

> **Landed** - `abd5713 + dd05235`.

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

- [x] **Step 1: Retrieve and adapt the three sources** as in Task 4.

```bash
for f in rectangular-scale-gesture-projection rectangular-scale-interaction standard-scale-control; do
  git -C D:/git-repos/fabricjs-image-editor show \
    9efdd78a:src/editor/snapping-manager/scaling/$f.ts > "$TEMP/fork-$f.ts"
done
```

- [x] **Step 2: Identify the control from the Fabric transform**

`standard-scale-control.ts` is the fork's own answer and ports **unchanged**: it compares `target.controls[transform.corner]` against `controlsUtils.createObjectDefaultControls()` field by field, and refuses a control whose handlers were replaced. That is what guarantees the snapping only engages over a genuinely standard Fabric resize handle — a custom control that changes resize semantics is declined.

Vigilia's `controls-manager/index.ts` may therefore be a problem: if it replaces or reconfigures the default controls, `isStandardRectangularScaleControl` will return false for every handle and snapping will silently never engage. **Check that before writing the adapter.** If Vigilia's controls differ, the choices in order of preference are: keep Fabric's defaults where they already satisfy the need; extend `STANDARD_RECTANGULAR_SCALE_CONTROLS` with the exact Vigilia control definitions so the comparison still tests something real; or, last, relax the check — which loses the guard, so say so in the commit message if it comes to that.

Note that the fork does **not** export `STANDARD_RECTANGULAR_SCALE_CONTROLS` — `standard-scale-control.ts:10-12` declares it module-private. Taking the middle option therefore means editing a ported file, which under the global constraint at `:20` requires a `// ported: fork 9efdd78a …` marker naming the change above it.

`didSideScaleSwitchToSkew` is also from this file and is needed: Alt on a side handle switches it from scaling to skewing, and a gesture in that state must not snap.

- [x] **Step 3: Test every control, rotated and not**

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

- [x] **Step 4: Run the test**

Run: `npx vitest run packages/editor/src/snap-manager/scaling`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/scaling
git commit -m "feat(editor): port the rectangular scale gesture projection"
```

---

### Task 7: Bind scaling, with verification-gated guides

> **Landed** - `70b5b36`, fix round 1 in `6c603c9` (see the note below on that commit's message).
> Review: spec PASS WITH DEFECTS / quality PASS, 0 Critical, 3 Important, 4 Minor. All six actionable
> findings were re-reviewed as ADDRESSED; the re-review found two new Minor items, both fixed.
>
> **The fix round's changes share a commit with unrelated `STATUS.md` work.** `6c603c9` is titled
> `docs(status): record the spec status pass` and contains the three fix paths beside that edit — the
> controller, `scaling.dom.test.ts` and `editor.spec.ts`. The cause was an index race: the controller's
> `git add STATUS.md` and the implementer's `git commit` overlapped, so the commit took whatever was
> staged. Its content is the fix and nothing else — `git diff 70b5b36..HEAD -- src/web` is exactly
> those three paths, and `-- docs/evidence` is empty — but the message does not describe them, and the
> fix's red-before evidence lives only in `task-7-report.md`. Recorded because the ledger's job is to
> say what happened; not amended, since the round's work is already reviewed against this sha.
>
> **Corrected deviation enumeration**, replacing the commit message's class 2, which was wrong. The
> fork has **zero** `//**` markers and 25 `/**`; this port has 5 `//**` and 25 `/**` — the same 25,
> of which five changed form from `/**` blocks to `//**` line comments (20 unchanged, 5 converted).
> That is a class the commit message omitted, described by a phrase false about the fork. It is not
> amended because `70b5b36` is pushed. The full list, from a diff against `9efdd78a`:
>
> 1. Import paths.
> 2. Comment language (Russian → English).
> 3. Comment **form**: five fork `/**` blocks became `//**` line comments, matching the existing
>    Vigilia convention in `movement-snapping-runtime.ts`, `movement-spacing-correction.ts`,
>    `spacing-chains.ts` and `spacing-patterns.ts`.
> 4. `exactOptionalPropertyTypes` widenings.
> 5. Biome formatting (five trailing commas; the `ScaleRuntimeStep` union split with a leading `|`).
>
> `noUncheckedIndexedAccess` has **zero** sites in this port: `first.length === second.length &&
> first.every((value, index) => value === second[index])` is byte-identical to the fork's.
>
> `scale-snapping-runtime.ts` is 380 lines (fork 372) — under the repo's 500-line signal, so no
> vendored-source size exception is needed.

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

### Task 8: Ctrl and Shift during a resize

**Files:**
- Modify: `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts`
- Modify: `src/web/packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`

**Interfaces:**
- Consumes: the controller (Task 7); `readMovementModifiers` (in `snap-manager/index.ts`, module-private — locate by name; Task 2's commit shifted every line citation in that file).

**`readMovementModifiers` is the wrong function to reuse as-is.** It returns `{ readonly ctrlKey: boolean }` and reads `event.e.ctrlKey` only — there is no `shiftKey` in it, and it takes `{ event }` where this path has a raw `pointerEvent`. The fork's scale path reads **both** keys (`rectangular-scale-interaction.ts:248-251`: `ctrlKey: 'ctrlKey' in pointerEvent && pointerEvent.ctrlKey === true`, and the same for `shiftKey`), and `ScaleSnapModifiers` requires both (the resolver throws unless both are boolean).

So: **widen the existing reader rather than adding a second one** — the movement path only needs `ctrlKey` today, so an extended reader returning `{ ctrlKey, shiftKey }` keeps one owner and cannot drift from the scale path. If you instead write a second reader, say so in the report; what must not happen is Shift being read from `readMovementModifiers`, because that returns `undefined` for it and a Shift-constrained resize would silently behave as though Shift were not held.
- Produces: no new exports.

The fork documents Ctrl as the escape hatch returning the unrounded raw geometry, and Shift as constraining the resize. The movement path regained Ctrl in `83248dc`; scale must match, or an author can place an edge off-grid while moving but not while resizing.

- [ ] **Step 1: Write the failing test**

```ts
it("leaves the raw size alone while Ctrl is held", () => {
  const { canvas, resized, snapping, resize } = setup();
  canvas.fire("mouse:down" as never, { target: resized } as never);
  // Same step that snaps without Ctrl, so the only difference is the modifier.
  const raw = resize({ ctrlKey: true }, SNAPPING_MULTIPLIER);
  expect(raw).toBe(200 * SNAPPING_MULTIPLIER);
  expect(resized.getScaledWidth()).toBe(raw);
  snapping.destroy();
});

it("snaps the same step when Ctrl is not held", () => {
  // The companion assertion. Without it the Ctrl test passes with snapping
  // disabled: `resize()` sets scaleX itself, so `getScaledWidth()` equals
  // `200 * SNAPPING_MULTIPLIER` before the controller runs at all.
  const { canvas, resized, snapping, resize } = setup();
  canvas.fire("mouse:down" as never, { target: resized } as never);
  const raw = resize({}, SNAPPING_MULTIPLIER);
  expect(raw).toBe(200 * SNAPPING_MULTIPLIER);
  expect(resized.getScaledWidth()).not.toBe(raw);
  snapping.destroy();
});
```

**Why both tests exist.** The Ctrl test alone is vacuous, and this is worth being explicit about: `resize()` pre-sets `scaleX = widthScale` to model what Fabric does before the event fires, so `getScaledWidth() === 200 * widthScale` is true by construction, whether or not the controller reads modifiers at all. Snapping *disabled* would make the Ctrl test pass. The pair is what has teeth: the second test drives the identical step with no modifier and requires the controller to change the value away from the raw one. Show both failing with Ctrl handling removed before trusting them — the first must fail, the second must pass.

`SNAPPING_MULTIPLIER` is exported from Task 7's `scaling.dom.test.ts` (defined once, there, as the value that lands inside `SNAP_THRESHOLD`). Import it; do not redefine it here.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/snap-manager/scaling/scaling.dom.test.ts`
Expected: FAIL — the width snaps to the neighbour's edge instead of holding the raw multiplier.

- [ ] **Step 3: Read the modifiers from the event**

`ScaleSnapModifiers` needs both `ctrlKey` and `shiftKey`; Task 7 already widened `readMovementModifiers` to return both, so reuse it here rather than adding a second reader. The resolver already honours Ctrl — the ported `scale-snapping-resolver.ts:332` short-circuits to the disabled plan the same way `movement-snapping-resolver.ts:316` does. Confirm that in the ported source; if the scale resolver lacks the short-circuit, port it from the fork's `scale-snapping-resolver.ts` rather than adding a check in the controller.

Shift constrains the resize; check the fork's handling and port it in the same place, then add a Shift case here asserting the constrained result, rather than a separate task. Note that `resolveScaleSnapPlan` may treat a Shift-mismatch as a duplicate step and throw — if so, the controller must classify modifiers into its own step identity before calling the runtime, not pass a changing modifier set through unchanged.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS.

- [ ] **Step 5: Verify in the browser**

Ctrl-resize near a neighbour in a real session and confirm in the capture that no guide appears and the object keeps its fractional size. Ctrl-drag and Ctrl-resize must behave identically; if they do not, one of the two paths is reading the event differently.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts \
  src/web/packages/editor/src/snap-manager/scaling/scaling.dom.test.ts
git commit -m "feat(editor): Ctrl escapes snapping during a resize"
```

Add `src/web/packages/editor/src/snap-manager/index.ts` to that list only if Step 3's widening of `readMovementModifiers` is what lands it. Never stage the `scaling/` directory: AGENTS.md stages explicit paths, and a directory add sweeps in every file Tasks 4–7 already committed.

---

### Task 9: The behaviour matrix

**Files:**
- Create: `src/web/tests/e2e/snapping.spec.ts`
- Modify: `src/web/tests/e2e/editor.spec.ts` (Step 5 — export `captureVisualReview`, `sceneToClient` and `clientOfScene`)
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

New file `src/web/tests/e2e/snapping.spec.ts`, skipping every test on non-desktop projects the way `editor.spec.ts` does: `import { isDesktopSurface } from "./surface.js"` and `test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface")`. **Do not write a project-name comparison.** `isDesktopSurface` is the shared owner of the desktop surface set (`tests/e2e/surface.ts:13`, exported) and every editor case calls it; a second skip expression would be a second place for that set to be defined, and the two would drift. Follow the existing conventions:

- Real gestures: `page.mouse.move/down/move({steps})/up` over `#vigilia-fabric-editor canvas.upper-canvas`. **Get the artboard coordinates through `artboardScreenRect()`, not through the canvas box.** Plan A's Task 10 repairs exactly this in `editor.spec.ts` — the canvas is host-sized and the artboard is contain-fitted inside it, so `box.x + (n / W) * box.width` is wrong by the `ty` it drops. Reuse `editor.spec.ts`'s `sceneToClient` / `clientOfScene` helpers rather than writing a second mapping; a raw `box.x + …` in this file is the defect this bullet exists to prevent. Both are file-scope and unexported, so Step 5 exports them alongside `captureVisualReview` — import them from there, and add that export in this task rather than deferring it.
- Read resulting geometry through the debug handle found by `key.startsWith("vigilia-fabric-editor-")` (the same lookup `editor.spec.ts` uses in several places), which exposes `canvas.item(i)` and `canvas.getObjects()`. Prefer `getObjects().find(o => o.get("id") === …)` over `item(i)` — an index is a fixture-order assumption that a scene change silently breaks, and the id is what the case is about.
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

**Also in this file: the layer panel's bottom action row.** `2026-09-25-editor-ui-polish.md`'s spec
carries one acceptance item that plan closed without meeting — "Object actions appear in the layer
panel's bottom row, not per row, and render from the same registry the canvas dock uses" — verified in
jsdom but never in a browser. It rides here because this is the task that owns `editor.spec.ts` and the
browser surface. One case: select an object, read the bottom row's action labels, read the canvas
dock's action labels for the same selection, and assert the two sets are equal. Assert the **entry set**,
not a hard-coded list — a list duplicated from the registry is a second owner of it and would pass while
the two surfaces diverged. Record the result in that spec's acceptance section as part of Task 10's
close-out pass, so the item moves from carried to met or is re-recorded as still open.

- [ ] **Step 3: Run it**

Run: `npx playwright test --project=desktop-chromium tests/e2e/snapping.spec.ts --workers=1`
Expected: PASS. Report the count.

- [ ] **Step 4: Prove the matrix can fail**

Reintroduce the `83248dc` bug — a per-gesture marker — and rerun. Expected: the multi-step cases fail for both moving and resizing. Restore. If any case survives that break, its assertion is too weak and must be tightened, because those are the cases meant to prevent the regression that already shipped once.

- [ ] **Step 5: Register the evidence and commit**

The matrix's cases assert on rendered pixels and read geometry, so most need no capture at all. **The resize capture is already registered and committed by Task 7** — do not add it again. If Step 2 introduces capture titles of its own, they belong in the `Editor mechanics` row of `docs/evidence/screenshots/README.md` (the row listing `editor-snap-guides`; locate it by that name), which already lists `editor-snap-guides` / `snaps a dragged object` — the same visible action class, so no new domain. Capture titles go through `captureVisualReview(page, testInfo, "<name>")` as the existing tests do — but note that helper is **file-scope and not exported** in `editor.spec.ts`, so a new spec file cannot call it as written. **Export three helpers, not one:** `captureVisualReview` (the capture contract), plus `sceneToClient` and `clientOfScene`, which this task's own instruction above requires it to reuse and which are equally unexported. The file currently contains **zero** `export` statements, so add all three in one edit and import them. Adding `src/web/tests/e2e/editor.spec.ts` to this task's Files list is part of this step, rather than growing a second capture helper or a second coordinate mapping that can drift from the `VIGILIA_CAPTURE` / `-<project>.png` contract and the artboard-fit arithmetic respectively. If the exports turn out to be undesirable, say so and inline equivalents — what must not happen is a `page.screenshot` call with no `VIGILIA_CAPTURE` gate, which would write a capture the README never registered, or a raw `box.x + (n / W) * box.width` mapping, which drops the artboard's `ty`.

```bash
git add src/web/tests/e2e/snapping.spec.ts \
  src/web/tests/e2e/editor.spec.ts \
  docs/evidence/screenshots/README.md
git commit -m "test(editor): snapping behaviour matrix for move and resize"
```

**Name every capture; do not stage the directory.** `docs/evidence/screenshots/` holds ~40 PNGs owned by other tasks and another plan, and an unrelated capture can be sitting modified in the working tree — a directory-wide `git add` sweeps it into this commit. `*snap*.png` is not narrow enough either: `editor-snap-guides-desktop-chromium.png` also matches the glob and belongs to the movement-snap capture Task 1's browser check rewrote.

**Do not stage `editor-snap-resize-desktop-chromium.png`.** Task 7 Step 7 produces that capture and Task 7 Step 8 commits it; by the time this task runs it is already in history, and re-staging it is either a no-op or, worse, sweeps in a re-run's byte-different replacement under a commit that did not produce it. If Step 2 introduces capture titles of its own, name each PNG they produce in this `git add` as it is added — but the matrix's value is its assertions, not its screenshots, and a matrix case needs a capture only where the plan's Review Focus items name one.

`editor.spec.ts` is in the list because Task 2 and Task 7 also touch it; confirm the working tree holds only this task's edit there before staging it.

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

**No known-failing tests are carried into this gate — a red suite is a failure to investigate, not to accept.** This step previously named two pre-existing phone-chromium failures in `display-fabric.spec.ts`; both were measured at the start of this branch and **both pass**:

```
npx playwright test --project=phone-chromium --grep "keeps repainting as samples arrive" --workers=1
  ✓ 1 passed (32.4s)
npx playwright test --project=phone-chromium --grep "is byte-stable at a fixed clock" --workers=1
  ✓ 1 passed (32.9s)
```

(The second title is a prefix match: the case in `display-fabric.spec.ts:671` is `is byte-stable at a fixed clock on one platform`.)

Report any red test with its output and a base-commit run proving when it started. Do not classify a failure as pre-existing without that proof.

- [ ] **Step 3: Decide the legacy fallback path explicitly**

The spec's Key decisions item 3 requires a stated decision on the fork's second engine — the line/pixel snapping the fork runs when its candidate path yields nothing. Read the chain in fork `index.ts` before deciding anything, because three of its five names are easy to mis-transcribe. The real one, with the call sites:

```
_applyMovementGuideSnap  ......... the entry point for a move step (:629)
  → _resolveObjectMovementContext  (:507, called at :499)
      → _resolveMovementSnapAxes   (:550, called at :522)
  → _applyObjectMovementSnap       (:572, called at :503)
      → _applyMovementGuideSnap    (:629, called at :580)
      → _applyMovementVisualGuides (:1098, called at :618)
```

over `line-snapping.ts`, `anchor-buckets.ts`, `snap-target-resolver.ts` and `pixel-grid.ts`. Cite by name, never by line: this file is ~1,400 lines of private methods and every method is one edit away from a new number.

**Two earlier revisions of this step named symbols that do not exist**, and the second was my own correction producing a fresh one — so take the block above as the measurement and the two names below as landmines. The first read the chain as `_resolveObjectMovementContext` → `_applyMovementObjectSnap` → `_applyMovementVisualGuides`: `_applyMovementObjectSnap` is not a method. The second, written to fix that, listed `_resolveObjectMovementSnapAxes` at `:550` — also not a method; `:550` is `_resolveMovementSnapAxes`. A reader who finds neither name in the file should conclude the plan is wrong, not that they are reading the wrong file.

**The answer is already measured: DROP.** Verify the measurement below rather than re-deriving it — the chain above is context for *why* the fallback existed, not a decision still to be made.

- All four fallback modules are **absent** from Vigilia: `line-snapping.ts`, `anchor-buckets.ts`, `pixel-grid.ts` and `snap-target-resolver.ts` — none exists under `snap-manager/`. The spec already classifies the fallback as absent and names these four modules.
- `scaling/scaling-step-snap-guards.ts` (1,322 lines, ported in Tasks 4–6) has **zero importers**: `grep -rn "scaling-step-snap-guards" packages/` returns only its own provenance comment. Its sole fork caller was `pixel-grid.ts`, which is absent. The ported guard family is unreachable by design.
- **Also dispose of every other ported `scaling/` file Task 7's report leaves unconsumed** — `scaling/standard-scale-control.ts` is the known one (zero importers today; its three fork consumers are all controllers this plan does not port), and Task 7 was asked to state whether its fresh controller consumes it. Re-measure rather than trusting that note: a ported file with no importer is the defect this plan exists to remove, and Task 3 already set the precedent by deleting every dead spacing port.

Record **drop** in the spec's `## Key decisions to make in planning` §3, with that reason — the fallback's entry point does not exist in Vigilia, and the guard family only it consumed is unreachable code. Vigilia's broader candidate filter is precisely why fewer objects are declined, which is the spec's own argument for why the fallback's justification is weaker. Do not leave it unstated — that is how the defects this plan fixes survived.

**Do not write a test asserting the guard family works.** A test for unreachable code is green-and-wrong: it passes while proving nothing about shipped behaviour.

**A note the earlier draft of this step got wrong.** It said `getObjectBounds` "is live again" because `scaling-step-snap-guards.ts` calls it at `:5,907,969,1269`. Those call sites are real, but they are inside the same unreachable module, so `getObjectBounds` has **no live caller** either — its only references are there. Task 3's precedent applies: it deleted every dead spacing port (`SPACING_CONTEXT_SWITCH_DISTANCE`, `resolveCommonDisplayDistance` with its `CommonDisplayDistance` type, `calculateSpacingSnap`). **Decide explicitly** whether to delete `scaling/scaling-step-snap-guards.ts` (and `getObjectBounds` with it, if nothing else reads it) on that precedent, or keep it — and if you keep it, say what would make it reachable. State the decision either way. Only `getObjectExactBounds` remains the movement path's reader.

- [ ] **Step 4: Close out §64 and §175**

§64 currently reads "Pixel rulers, configurable grid/guides, additional snapping modes and resize-time snapping are not present". Resize-time snapping now is, and the "under review / treat as unverified" sentence is discharged. Rewrite that paragraph to say movement and resize snapping are both present and verified by the behaviour matrix, and that pixel rulers, configurable grid/guides and additional snapping modes remain review candidates.

§175's body needs no change — it is the requirement this work satisfies — but it has no design link, unlike its neighbours §172–§174, which each end `Design: [<name>](../superpowers/specs/<file>.md).` Add that line to §175, pointing at `2026-09-25-snapping-fidelity.md`, in the same shape.

In the behaviour review, move the **Resize-time snapping** candidate out of `## Candidates` (it is at `:14-21`) and add it to the `## Promoted to requirements` bullet list, in the same shape as the existing two entries (name, one clause of history, the requirement it became). Its current text also carries the disproved claim that resize snapping was skipped because the scaling subsystem was "coupled to object types Vigilia does not have" — Tasks 4–6 showed only two modules carry real coupling, so state that instead. Leave `### Rulers, configurable grid/guides and pixel snapping` where it is; this plan does not touch it. Keep `### Vendored snapping geometry split` (`:48-52`) where it is — that is the rule this plan's ported files are the explicit exception under, and Task 7's `// ported: fork 9efdd78a …` marker is what cites it.

The spec's status line already names this plan (`2026-09-25-snapping-fidelity.md:3` — "planned; see [the snapping fidelity plan]"), so there is nothing to flip there; confirm it still reads that way and move on.

- [ ] **Step 5: Inspect the visible outcome**

Open, in the editor, and record what each shows: guides during a drag, guides during a resize, an equal-spacing guide with its distance label, Ctrl-drag and Ctrl-resize with no guides. Each is a visible behaviour; none is proven by a unit test asserting a guide array.

`captureVisualReview` is gated on `VIGILIA_CAPTURE`, so a plain `--grep` run produces no file — four of these five also have no registered capture name. Run the interactive walkthrough rather than inventing names: `node packages/host/bin/vigilia.js` (build the host first), then perform each gesture by hand. A screenshot the capture gate did not ask for and the README does not register is not evidence, and adding a name for it is Task 9's job, not this one's.

- [ ] **Step 6: Update STATUS.md**

Replace "Last completed change" with a 1–5 bullet summary of this commit. The line this step previously told you to resolve — "Snapping/smart-guide fidelity is under review; gap list not yet in hand" — **is not in the file**. STATUS.md's "Blockers / unverified" at the time of writing carried the `display-fabric.spec.ts` slow tests (five cases, `keeps repainting as samples arrive` among them; all pass with a longer explicit timeout, and the `60_000` per-project setting appears not to take effect), untested hook entry points, an unverified layer-panel action row, and unverified browser round-trips of text align/wrap/overflow, in-place edit + undo and run preset/override persistence. **Re-read that section rather than trusting this list**: the entrance-animation speedup landed after this text was written and moved it — `keeps repainting as samples arrive` is back under the 30s default, one case remains over it under `test.slow()`, and there is no `timeout` key in `playwright.config.ts` for a per-project `60_000` to have failed to apply. Step 2 settles the slow-test item, so update or remove whichever of those lines this work actually resolves and leave the rest. `npm run status:check`.

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

**Type consistency:** `ObjectBounds` and `getObjectExactBounds` come from `../bounds.js` throughout. `readMovementModifiers` is defined once in `index.ts`, widened in Task 7 to return `shiftKey` too, and reused by both controllers (Tasks 2, 7, 8); Task 2's guard does not read modifiers, so Task 7's widening is what serves Task 8. `stopGesture` is reused by the scaling path rather than duplicated. The marker rule — one per native pointer event from `event.e` — is stated identically in Tasks 7 and 9. Every scaling type and function name in Tasks 5–7 is copied verbatim from the fork, so the ported source and the plan cannot drift apart.

**Review Focus coverage:** item 1 → Task 7 Step 3 and Step 7; item 2 → Task 8 Step 1; item 3 → Task 6 Step 3; item 4 → Task 1 Step 1 and Step 6; item 5 → Task 3 Step 2 (second case) and Task 5 Step 3.

**Sequencing note:** Tasks 1–3 are independent of 4–8 and deliver user-visible improvements on their own. If the port proves larger than expected, 1–3 and 9 can land first — but Task 9's resize half needs Task 7, so the matrix lands whole.

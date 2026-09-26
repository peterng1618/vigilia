### Task 3: Spacing hold state — prove it, then delete the dead ports

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

- [ ] **Step 1: Write the behavioural test**

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
  // Left ends at 160, right starts at 280: a 120 gap that a 40-wide object
  // splits evenly at 200.
  const left = new Rect({ id: "left", left: 100, top: 40, width: 60, height: 100 });
  const right = new Rect({ id: "right", left: 280, top: 40, width: 60, height: 100 });
  const active = new Rect({ id: "active", left: 200, top: 180, width: 40, height: 40 });
  // Both flankers share `top: 40` and `height: 100`; `active` sits well below them.
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

- [ ] **Step 2: Run it and read the result before changing anything**

Run: `npx vitest run packages/editor/src/snap-manager/spacing-hold.dom.test.ts`

**Do not adjust the assertions to make this pass.** The outcome decides the rest of the task:

- **Both pass** → hold state provides the stickiness. Delete the two dead exports in Step 3 and say so in the commit.
- **The first fails** → stickiness is genuinely missing. **Stop and report it; do not wire `SPACING_CONTEXT_SWITCH_DISTANCE` in.** The live resolver already passes `switchDistance: previousContext ? Number.POSITIVE_INFINITY : 0` (`movement-snapping-resolver.ts:886`), which is strictly stronger than the constant's `5`, so wiring it in would *weaken* the hold while claiming to restore it. Report the observed `left` values for both steps in the commit message and leave the two exports in place.
- **The second fails** → the hold never releases, which is Review Focus item 5. Report it before continuing; a drag that never releases is worse than no snap.

Record which branch happened in the commit message, including the measured boundary. If the numbers above turn out to be wrong for the fixture, fix the fixture's geometry to reach equal spacing — do not weaken the assertions to `toBeGreaterThan`/`not.toBe`.

**One thing to confirm before trusting either step:** that the anchor being held is genuinely the *spacing* candidate and not the artboard's centre guide. The fixture's `bounds()` is deliberately off-centre for exactly this reason, but the cheap confirmation is to delete the two flanking rects and re-run: if the object still reads `200` with no neighbours, the fixture is measuring the artboard, not spacing, and the test must be rebuilt rather than adjusted.

- [ ] **Step 3: Delete only what is proven dead**

If Step 2 showed the hold works, remove `SPACING_CONTEXT_SWITCH_DISTANCE` from `constants.ts` and `resolveCommonDisplayDistance` from `distance.ts`, plus any now-unused imports.

**Deleting `resolveCommonDisplayDistance` orphans the `CommonDisplayDistance` type in the same file**, and a same-file declaration is not an import, so "plus any now-unused imports" does not cover it. The type (`distance.ts:22-27`) is referenced only by the function you are removing — verified: the only other mentions of it anywhere are its declaration and that function's parameter and return annotations. Delete it too, or the task leaves freshly-orphaned dead code behind, which is the opposite of its purpose. **Do not delete `MAX_DISPLAY_DISTANCE_DIFF`** (`distance.ts:19`): it looks like part of the same cluster but is live, imported by `spacing.ts:2` and read at `spacing.ts:561`. `resolveDisplayDistance` (`distance.ts:4`) is live too — imported by `guide-renderer.ts:5`, `spacing-chains.ts:1` and `spacing.ts:3`.

`calculateSpacingSnap` (`spacing.ts:1312`) is also unreferenced: check whether it is the entry point Step 2 exercised through `resolveSpacingNeighbors`; if it is genuinely unreachable, delete it in the same commit, and if it is reachable, leave it.

- [ ] **Step 4: Run the full snapping suite**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS. Deleting an export that something imported will show up here as a compile error, which is the point of running it.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/snap-manager
git commit -m "test(editor): pin equal-spacing hold, drop the dead spacing ports"
```

---


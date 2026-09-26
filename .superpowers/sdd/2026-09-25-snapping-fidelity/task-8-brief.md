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


### Task 1: Candidate-filter parity

**Files:**
- Modify: `src/web/packages/editor/src/snap-manager/index.ts:32-42`
- Modify: `src/web/packages/editor/src/snap-manager/excluded-objects.ts`
- Modify: `src/web/packages/editor/src/snap-manager/index.dom.test.ts`
- Test: `src/web/packages/editor/src/snap-manager/index.dom.test.ts`

**Interfaces:**
- Consumes: `shouldIgnoreObject` from `./excluded-objects.js` (already present).
- Produces: no new exports. `isSnapTarget` changes behaviour; its signature is unchanged.

Today `isSnapTarget` requires `object.selectable === true && object.get("locked") !== true`. The fork's `src/editor/utils/object-filter.ts:28-46` (`shouldIgnoreObject`) excludes only the active object and its selection children, `visible === false`, and `IGNORED_IDS`. Locking a layer in the fork prevents *moving* it, not *aligning to* it.

**The fork's filter is in a differently-named file than this brief once implied.** The path is `src/editor/utils/object-filter.ts`, not `.../snap-manager/utils/...` — read it with `git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:src/editor/utils/object-filter.ts` (read-only reference; never check out, write to, or fetch in that repository). Its exported `shouldIgnoreObject` is line-for-line the function `excluded-objects.ts` already has, so Step 3's edit to that file is the `IGNORED_IDS` value only, not the filter.

**Step 3's `IGNORED_IDS = ["scene"]` is load-bearing and is why this task cannot be a pure deletion — verified, after I first doubted it.** Removing `selectable === true` promotes every non-visible-only object to a snap target, and the starter theme's own background rect is exactly such an object: `new-fabric-theme.ts:321-329` emits `rect("background", 0, 0, 1280, 720, twilightGradient, 0, backgroundOnly, "scene")` — id `"scene"`, spanning the whole artboard, with `selectable: false`, `evented: false` from `backgroundOnly` (`:15-19`). Without the id in the ignore list it becomes a snap target whose edges sit exactly on the artboard boundary, so it would win most snaps silently. The id filter is the field that replaces `selectable`, not an optional tidy-up.

This is also distinct from `artboardPlate` (`editor-shell.ts:139`), which is assigned to `canvas.backgroundImage` (`:180`) and so never enters `getObjects()` — two full-artboard rects, one a scene object and one a background image. Only the scene object needs the id.

**Step 1's fixtures must therefore show their work.** `index.dom.test.ts` currently has no case for a locked neighbour, none for an invisible one, and none for the excluded set, so three filter branches are unexercised. Step 2 must name which assertion each new test turns red on, and the invisible-object case must be a genuinely invisible object rather than an unadded one.

- [ ] **Step 1: Write the failing tests**

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

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/editor/src/snap-manager/index.dom.test.ts`
Expected: FAIL on the first two. The third (hidden neighbour) passes both before and after — it is the labelled regression guard. The first fails because the locked object is not a snap candidate at all under the current filter; the second fails because `selectable: false` excludes the plate and nothing yet excludes it by id.

**Both new failing tests must be shown red before Step 3, and red for the stated reason — not because the fixture is out of range.** If either passes at this step, the fixture is wrong (its candidate is not in reach), not the code: fix the fixture's geometry, do not proceed. This matters because a test that is green before the change proves nothing and will still be green after a bad implementation.

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

Restore `object.selectable === true &&` to the predicate and rerun. Expected: the locked-neighbour test and the plate test both fail, and both fail on their own assertion line — `expected 98 to be 100` and `expected 160 to be 158`. The listed actual values are the check that the failure is alignment-driven; a failure reading `expected 98 to be 98` or any other value means the fixture, not the code, is being measured. Restore the relaxed version.

Then empty `IGNORED_IDS` and rerun. Expected: the plate test fails (`expected 160 to be 158`) and the locked-neighbour test still passes. Restore `["scene"]`.

- [ ] **Step 6: Inspect the starter theme for noise**

Removing the `selectable` gate makes decorative `selectable: false` objects alignable. The starter theme has exactly one such object — the artboard plate, id `scene`, created at `new-fabric-theme.ts:320-330` (the single `backgroundOnly` use is at `:328`; `:15-19` is the *style constant*, not the object). It is now excluded by id — but confirm that in the browser rather than trusting the grep:

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


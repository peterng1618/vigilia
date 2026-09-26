### Task 10: Snapping and indicators at non-1 zoom

**Files:**
- Modify: `src/web/tests/e2e/editor.spec.ts`
- Modify: `src/web/packages/editor/src/snap-manager/guide-renderer.dom.test.ts` (Steps 2 and 4 — the zoom coverage this file has never had)
- Modify: `src/web/packages/editor/src/snap-manager/guide-renderer.ts` (only if Steps 2 or 4's inspection finds a defect)
- Modify: `src/web/packages/editor/src/indicator-manager/index.ts` (only if Step 3's inspection finds a defect).
- Modify: `src/web/packages/editor/src/indicator-manager/index.dom.test.ts` (Step 3 — the zoom coverage this file has never had)

**Interfaces:**
- Consumes: the camera (Tasks 1–2) and `ViewportManager.artboardScreenRect()` (**Task 5**, which owns it). Produces: nothing new.

The spec's acceptance item "snapping guides and indicators stay correct at non-1 zoom" is a claim about existing code, so verify it rather than assuming it. `snap-manager/index.ts` divides guide width by zoom and clamps guides to the artboard; `guide-renderer.ts:30` reads `viewportTransform` and applies it to the context. Both look right, and both were only ever exercised at fit zoom.

**This task also owns two e2e tests that Task 2 turned red — they are yours to fix, not Task 2's.** Task 2 made the canvas host-sized instead of artboard-sized; the tests map a fixed artboard coordinate through the **canvas bounding box** (`box.x + (432/1280)*box.width`), an identity that held only while the canvas *was* the artboard. Measured after Task 2: canvas 626×594, zoom 0.4890625, `ty` 120.94 — so `box.height` is now the host's 594 rather than `720 × zoom = 352`, and the mapping also ignores `ty` entirely. The two failing tests are `persists an ordinary drag and restores it through undo` and `rehydrates a chart runtime after undo`. **Find them by name** — `grep -n "persists an ordinary drag\|rehydrates a chart runtime" src/web/tests/e2e/editor.spec.ts`. They were at `:1313` and `:1407` when this paragraph was written and are at `:1390` and `:1695` now; this file has moved under every task in this plan, which is why the step below identifies sites by what they are rather than where they are. Drag mechanics are **not** broken: a 60px screen drag moves an object 124.5 units, which is `60 / 0.4890625` exactly.

Fix the mapping at its owner rather than re-deriving it in the spec. **Task 5 already added `ViewportManager.artboardScreenRect()` for exactly this reason — consume it, do not define a second one.** It returns the artboard's rect **relative to the canvas element**, so the canvas box offset is added once, in one place: the `sceneToClient` helper in Step 1. Have the spec's shared helper call it through `window.vigiliaEditorBridge`; a test file must not carry its own copy of the camera's transform.
- One shared helper serves every mapping site, and **Step 1's grep derives the set — no line numbers are given here on purpose.** They have been wrong in every revision of this paragraph (`:1903-1918`, `:1806-1821`, `:1727-1730`, `:1369-1370`, `:1577-1578`…), because three different tasks have added e2e cases to this file since the paragraph was written, moving every later site by 45, 138, then 48 lines. The step below identifies each site by what it is.
- **`selectStarterChart` is passing on a near-miss and that is a latent bug.** Its click point now lands at scene (432,458); `load-gauge` spans scene y 374–462, so it still selects the chart but only 4px from the object's bottom edge, inside the `gauge-card` overlap. That margin is why `rehydrates a chart runtime after undo` grabbed the parent card instead. Rewrite the helper with the accessor **and add the precondition assertion it lacks** — that `load-gauge` is the active object before the drag — so the margin can never silently widen again.

**Teeth check for the mapping fix:** with the old box-relative mapping restored, the two drag tests must fail as they did at `093b3ec` (40 and 432, the untouched originals).

- [ ] **Step 1: Repair the box-relative mapping, and add the helpers the repointed sites use**

*(This step is the mapping work described above. It was prose only until a read-through found that a later step's `clientOfScene` — "the one the mapping fix also uses" — referred to a step that did not exist, and that the deliverable of two repaired red tests had no step of its own.)*

**First, read the mapping that already exists and steal it rather than re-deriving it.** Two blocks in this file already solved this problem correctly and documented why — find them with `grep -n "artboardScreenRect" src/web/tests/e2e/editor.spec.ts`. Each calls `artboardScreenRect()` through the bridge, adds the canvas box once, and carries an explicit comment that the offset is what keeps the gesture from landing off-canvas and passing vacuously. The helpers below are that work lifted to file scope so every mapping site can use it. Read one before writing them — they are the convention authority, and the comments below restate their reasoning rather than replacing it.

Add three shared helpers near the top of `src/web/tests/e2e/editor.spec.ts` — `artboardRect`, `sceneToClient` and `clientOfScene`. The artboard's scene
size differs per fixture, so `sceneToClient` takes it rather than assuming `1280x720`:

```ts
type ArtboardRect = { left: number; top: number; width: number; height: number };

/** The artboard's rect, CANVAS-element relative — `artboardScreenRect()` reads
 * `viewportTransform`, whose `e`/`f` are offsets inside the canvas element, not
 * in the page. So this is deliberately not client space: the helper below adds
 * the canvas box once. The canvas is host-sized and the artboard is
 * contain-fitted inside it, so the canvas box is NOT the artboard's rendered
 * extent — `rect.height` is `720 * zoom`, not the canvas height, and the rect
 * carries the `ty` the old box-relative maths dropped. */
async function artboardRect(page: Page): Promise<ArtboardRect> {
  return page.evaluate(() =>
    (window as unknown as {
      vigiliaEditorBridge: {
        editor: { viewport: { artboardScreenRect(): ArtboardRect } };
      };
    }).vigiliaEditorBridge.editor.viewport.artboardScreenRect());
}

/** A scene point in CLIENT coordinates. `sceneWidth` is the fixture's artboard
 * width; the scale is uniform, so one axis suffices. The canvas box offset is
 * this helper's whole reason to exist: without it every returned point is a
 * canvas-space coordinate used as a page coordinate, landing ~357px left and
 * ~72px above the intended object — off the canvas, where a drag selects
 * nothing and the test passes without exercising anything. */
async function sceneToClient(
  page: Page, sceneWidth: number, x: number, y: number,
): Promise<{ x: number; y: number }> {
  const rect = await artboardRect(page);
  const box = (await page
    .locator("#vigilia-fabric-editor canvas.upper-canvas")
    .boundingBox())!;
  const scale = rect.width / sceneWidth;
  return { x: box.x + rect.left + x * scale, y: box.y + rect.top + y * scale };
}

/** The client point at an object's centre, by id. Reads the object's own
 * geometry through the bridge rather than restating fixture coordinates, so a
 * fixture tweak cannot leave this test dragging at a stale point.
 *
 * Use `getCenterPoint()`, NOT `left + getScaledWidth() / 2`. An earlier revision
 * of this helper used the manual form and justified it by claiming
 * `getCenterPoint()` "returns the origin itself" — **that is false, and the
 * manual form is the one that breaks.** `getCenterPoint()` goes through
 * `translateToCenterPoint(left, top, originX, originY)`, so it converts from
 * whatever origin the object actually has; the manual form silently assumes the
 * origin is `left`/`top`.
 *
 * That assumption does not hold for the object this helper is used on. The
 * starter scene's `chart()` helper sets `originX: "center"` / `originY: "center"`
 * (`new-fabric-theme.ts:730`), and `load-gauge` is a chart. Measured on a
 * 112x88 object at `left: 432, top: 418`: the manual form gives (488, 462) and
 * `getCenterPoint()` gives (432, 418) — the manual form aims at the shape's
 * bottom-right corner, half a width and half a height past the centre. */
async function clientOfScene(
  page: Page, id: string, sceneWidth = 1280,
): Promise<{ x: number; y: number }> {
  const centre = await page.evaluate((objectId) => {
    const bridge = (window as unknown as {
      vigiliaEditorBridge: {
        editor: {
          canvas: {
            getObjects(): Array<{
              id?: string;
              getCenterPoint(): { x: number; y: number };
            }>;
          };
        };
      };
    }).vigiliaEditorBridge;
    const object = bridge.editor.canvas
      .getObjects()
      .find((candidate) => candidate.id === objectId);
    if (object === undefined) throw new Error(`no object with id ${objectId}`);
    const point = object.getCenterPoint();
    return { x: point.x, y: point.y };
  }, id);
  return sceneToClient(page, sceneWidth, centre.x, centre.y);
}
```

`artboardScreenRect()` is Task 5's accessor and the only owner of this transform — do not add a
second derivation, and do not keep any `box.x + (n / W) * box.width` arithmetic.

Then repoint every mapping site at it. **Read the set from the file with the grep below; the numbers here are a reading aid that has already rotted twice:**

```bash
rg -n 'box\.(x|y|width|height)' src/web/tests/e2e/editor.spec.ts
```

Measured at `92e846a`, that returns **14 lines — seven x/y pairs**, not "nine sites": the earlier count was a line count read as a site count. Six of the seven are the naive box-relative form and are in scope. **Identify them by shape, not by line — this file has moved under every task in this plan and the numbers below were already stale once:**

- **one pair** scales by the fixture's own artboard size — the only pair using `/ 320` and `/ 180` **against `box.width`/`box.height`**. This is the mapping defect in its plainest form. Note a *correct* block also divides by 320 and 180, but against `rect.width`/`rect.height`; the grep is what tells them apart, since only the `box.*` form is listed.
- **one asymmetric pair** uses `/ 180` with `/ 1280` — a mismatched numerator and denominator, so it is wrong on both axes.
- **one pair** whose numerator is not a variable (a literal `432 / 1280` with `418 / 720`) inside a test body.
- **two more** of the plain `/ 1280` + `/ 720` form, each in its own test body.
- **one pair** in `selectStarterChart` with the *same* `432 / 1280` + `418 / 720` numbers as the literal pair above — find the helper by name (`grep -n "async function selectStarterChart"`), not by line.

**The seventh is the most important one and is easy to talk yourself out of. Find it by its `panX`** — it is the only pair in the file that names a `panX`/`panY` variable, and the only one reaching for `viewportTransform` by hand. It reads that transform off the editor through an `Object.entries(window).find(([key]) => key.startsWith("vigilia-fabric-editor-"))` probe and applies `x: box.x + panX + zoom * x` by hand. That is not a mapping that happens to be correct — it is a **second copy of the camera's transform**, plus a private-instance hack that reaches past the bridge, which is precisely what this task exists to delete. It computes the same point `artboardScreenRect()` does (`rect.left` is the transform's `tx`, which is what that code calls `panX`), so repointing it is behaviour-preserving; the thing that test verifies is the marquee's reachability, not the transform. **Repoint it like the rest**, and if you conclude otherwise, say why in the report rather than leaving it silently unlisted.

The grep is the authority for the *set*; anything still listed when you are done is a site you missed:

| What the site is | How to find it |
|---|---|
| a `320x180` fixture's scene→client map | the only pair using `/ 320` and `/ 180` against `box.width`/`box.height` |
| two test bodies mapping `/ 1280` and `/ 720` | look for the duplicated pair |
| a third test body mapping `/ 1280` and `/ 720` | same shape, different test |
| a `180 / 1280` + `220 / 720` pair | the only asymmetric pair |
| the `432 / 1280` + `418 / 720` chart pick inside a test body | the pair whose numerator is not a variable |
| **`selectStarterChart`'s click**, `432 / 1280` + `418 / 720` | the *same* numbers as the row above, but inside the helper — find the helper by name, not by line |

That helper's own location has been cited as `:1903-1918`, `:1806-1821` and `:1727-1730` across revisions of this plan and **all three were wrong** (the last was an unrelated `atLimit` assertion). Find it with `grep -n "async function selectStarterChart"` and edit what you find.

**Every pair the grep returns is in scope — there is no exception to leave alone.** An earlier revision of this step
told the implementer to leave one pair untouched as "a UI-chrome measurement, not a scene point", identified as the
only `box.x` with no `box.width` beside it. That identifies the `panX` pair above, whose own comment reads
*"Artboard coordinates to page pixels, through the live camera"* — it is a scene mapping, and the paragraph's
instruction contradicted the one two paragraphs up that says to repoint it. **Delete that instruction, not the
site: repoint it.** If the inspection genuinely finds a `box` pair that is not mapping a scene point, say so in
the report rather than silently skipping it.

**Two blocks already call `artboardScreenRect()` and are already correct; do not flatten either.** Both add the canvas box once and carry a comment saying the offset is what stops the gesture landing off-canvas and passing vacuously: one in an interaction-flags test, one in the marquee test (find them with `grep -n "artboardScreenRect"`). An earlier revision of this step told the implementer to flatten the marquee one — that would have folded the box in twice and turned a real vacuity guard into one that passes on a marquee that selected nothing, which is the worst shape a change can take here: green, and wrong. If you want one helper rather than three copies, have both call `sceneToClient` and **keep their comments**, but do not convert either's canvas-relative `rect` into a client point before its guard compares a client coordinate against `rect.top + rect.height`.

**`selectStarterChart` also gains the precondition it never had** — assert `load-gauge` is the
active object after the click, before it opens the Data tab, so the near-miss described above cannot
silently widen into a selection of the parent card. The assertion goes between the `page.mouse.click`
and the `openInspectorTab(page, "Data")` call, because the tab lookup is what turns a wrong selection
into a confusing timeout rather than a named failure. `selectStarterChart` has **six** call sites
(`:266`, `:285`, `:739`, `:868`, `:897`, `:1740` — the count is a reading aid and the file moves, so
`grep -n "await selectStarterChart(page)"` is the authority), each in a different test, so this one
assertion covers six.

Run: `npx playwright test --project=desktop-chromium --grep "restores it through undo|rehydrates a chart runtime" --workers=1`
Expected: PASS, both. These two are the tests Task 2 turned red.

**Teeth check:** restore the old box-relative mapping in `sceneToClient` and confirm both tests
fail. If they pass either way, the helper is not being used and the edit is cosmetic. **Then repeat
with only the `box.x`/`box.y` terms dropped** while the `rect.left`/`rect.top` terms stay: both tests
must fail again. That second break is the one that matters — it is the frame confusion this step was
corrected for, and a helper that adds the offset in the wrong place still passes the first break.

- [ ] **Step 2: Pin the guide zoom arithmetic**

**The zoom-correctness decision is a unit test, not a browser assertion.** Guides are painted straight onto `canvas.getSelectionContext()` (`guide-renderer.ts:29-40`) — they were never Fabric objects, so nothing in `getObjects()` can see them, and a browser test would only be able to assert on pixels. The two things that can actually be wrong are pure arithmetic, and `guide-renderer.dom.test.ts` already has the context spy to pin them. **That file has zero zoom coverage today**, so `GUIDE_WIDTH / zoom` at `:37` is entirely unpinned — which is why it is first.

Add to `guide-renderer.dom.test.ts`:

```ts
it("keeps the hairline one screen pixel wide as the camera zooms", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const context = contextSpy(canvas);

  for (const zoom of [0.5, 1, 2, 4]) {
    vi.clearAllMocks();
    canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
    renderSnappingGuides({
      canvas,
      guideBounds: { left: 0, top: 0, right: 100, bottom: 100 },
      guides: [{ type: "vertical", position: 50 }],
      spacingGuides: [],
    });
    // The context is scaled by the viewport transform before stroking, so the
    // SCENE width must be 1/zoom for the painted width to stay 1 screen pixel.
    expect(context.lineWidth).toBeCloseTo(1 / zoom, 10);
  }
});

it("clamps guides to the given bounds rather than the viewport", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const context = contextSpy(canvas);
  // Zoomed IN far enough that the viewport is much smaller than the artboard,
  // which is where "clamp to the viewport" and "clamp to the artboard" differ.
  canvas.setViewportTransform([4, 0, 0, 4, 0, 0]);

  renderSnappingGuides({
    canvas,
    guideBounds: { left: 0, top: 0, right: 1280, bottom: 720 },
    guides: [{ type: "vertical", position: 50 }],
    spacingGuides: [],
  });

  // A vertical guide spans the bounds' full height: 0 to 720, not the 0-to-37.5
  // the viewport covers at 4x. `new Canvas(document.createElement("canvas"))`
  // gives a 300x150 backing store — measured, not assumed — so the viewport
  // bounds here are 0-75 by 0-37.5, far inside the 1280x720 artboard.
  const ys = context.moveTo.mock.calls
    .concat(context.lineTo.mock.calls)
    .map((call) => call[1] as number);
  expect(Math.min(...ys)).toBeCloseTo(0, 5);
  expect(Math.max(...ys)).toBeCloseTo(720, 5);
});
```

Run: `npx vitest run packages/editor/src/snap-manager/guide-renderer.dom.test.ts`
Expected: PASS. Then change `GUIDE_WIDTH / zoom` to `GUIDE_WIDTH * zoom` and confirm the first test fails. It
fails on the **first** iteration, `zoom = 0.5`, reading `expected 2, received 0.5` — the loop is
`[0.5, 1, 2, 4]`, so it never reaches 4x. Restore.

**Second teeth check, for the clamp test.** Drop the `guideBounds` honouring — change
`const bounds = guideBounds ?? calculateSnappingViewportBounds({ canvas });` at `:28` to
`const bounds = calculateSnappingViewportBounds({ canvas });` — and confirm the clamp test fails with `37.5`
where `720` is expected. That number comes from the canvas's 300x150 backing store divided by the 4x zoom, and
it is measured rather than derived, so a different value there means the canvas size is not what this step
assumes and the finding is worth reporting. Restore.

- [ ] **Step 3: Pin that the indicators are zoom-independent**

**This step exists because the task's own spec line names indicators and Steps 2–3 do not reach them.** The
acceptance item reads *"Snapping guides and indicators stay correct at non-1 zoom"*, and `indicator-manager` is
listed in this task's Files — but until this step no part of the task verified it, so the claim was carried by
the title alone.

Reading the module says the claim holds, and says exactly why: the two indicators are zoom-independent for
**different** reasons, and only one of them is a fact a future edit could break.

- `cursor-indicator.ts:121-123` positions with `point.clientX - parentRect.left` — **client space**, so the
  pointer's own screen position is the whole input and no scene coordinate is involved.
- The size readout passes `target.getScaledWidth()` / `getScaledHeight()` (`index.ts:95-98`) — **scene units**.
  Fabric's `getScaledWidth()` is the object's own `width * scaleX`; it does **not** include the viewport zoom.
  So at 2x zoom a 100-wide object must still read `100 × 50`, not `200 × 100`.

The second is the one worth pinning. Multiplying by `canvas.getZoom()` there is a plausible edit — it reads
like the same "convert to screen units" instinct that `GUIDE_WIDTH / zoom` correctly implements in the guide
renderer, which is precisely why someone would reach for it here. It would be wrong, and no existing test
covers a non-1 zoom, so nothing would catch it.

Add to `index.dom.test.ts`, inside its existing `describe("IndicatorManager")`:

```ts
it("reports scene size rather than screen size when the camera is zoomed", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const object = new Rect({
    id: "shape",
    width: 100,
    height: 50,
    strokeWidth: 0,
  });
  canvas.add(object);
  // Zoom the CAMERA, not the object: `getScaledWidth()` must ignore this, or the
  // readout would report the on-screen size and disagree with the inspector.
  canvas.setViewportTransform([2, 0, 0, 2, 0, 0]);
  const indicators = createIndicatorManager({ canvas });

  canvas.fire(
    "object:scaling" as never,
    { transform: { target: object }, e: pointer() } as never,
  );

  expect(
    document.querySelector<HTMLElement>(".vigilia-size-indicator")?.textContent,
  ).toBe("100 × 50");
  indicators.destroy();
});
```

Run: `npx vitest run packages/editor/src/indicator-manager/index.dom.test.ts`
Expected: PASS.

**Teeth check:** change the two arguments at `index.ts:95-98` to multiply by the canvas zoom
(`target.getScaledWidth() * canvas.getZoom()`, same for height) and confirm this test fails reading
`200 × 100`. Restore. The other cases in the file stay green through that break — they run at zoom 1 — which is
the point of adding this one.

- [ ] **Step 4: Pin that the spacing pass is painted under the same transform and width**

Every assertion in Step 2 passes `spacingGuides: []`, so none of them reaches `drawSpacingGuides`. That is a
coverage hole, not a defect: the spacing pass is called at `guide-renderer.ts:41`, **inside** the
`context.save()` / `transform(...)` / `context.lineWidth = GUIDE_WIDTH / zoom` block that opens at `:32`, so
it currently inherits the right width for free. The invariant is worth pinning because it is inherited rather
than set — moving that call one line down, past the `context.restore()` at `:43`, silently gives spacing
guides a 1-pixel *scene* width that grows with zoom, and no test would notice.

**The assertion must be on ordering, not on `lineWidth` — an earlier revision of this step read
`context.lineWidth` and could not fail.** `contextSpy`'s `restore` is a bare `vi.fn()` (`:9`), so it does not
put `lineWidth` back; and nothing in the spacing path sets it either — `drawSpacingGuide` strokes without
assigning it, and `drawGuideLabel` sets `lineWidth / safeZoom` inside its own save/restore pair. So
`context.lineWidth` reads `1 / zoom` whether the call sits inside the block or below it, and the teeth check
below would have passed in its broken state. Read the call order instead: the invariant is *the spacing stroke
happens before the outer restore*, which is exactly what "painted under the same transform" means.

**The spy needs one more method before this test can run at all.** `contextSpy` (`guide-renderer.dom.test.ts:6-34`)
defines no `quadraticCurveTo`, and `drawRoundedRectPath` (`guide-painting.ts:23`) calls it for the badge's rounded
corners — so a non-empty `spacingGuides` throws `TypeError: context.quadraticCurveTo is not a function` and the
test dies on the crash rather than reaching its assertion. **Add `quadraticCurveTo: vi.fn(),` to the spy's method
list**, next to the existing `arcTo`. That is the only spy change this step needs, and it is safe for the file's
existing cases: they all pass `spacingGuides: []`, which never reaches a label. Verified by probe — with the
method added, the run reaches the assertion and reads `strokeOrder [10]` against `restoreOrder [27, 44, 45]`.

```ts
it("paints spacing guides before the context is restored", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const context = contextSpy(canvas);

  for (const zoom of [0.5, 1, 2, 4]) {
    vi.clearAllMocks();
    canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
    renderSnappingGuides({
      canvas,
      guideBounds: { left: 0, top: 0, right: 100, bottom: 100 },
      guides: [],
      spacingGuides: [
        { type: "vertical", axis: 30, refStart: 0, refEnd: 10,
          activeStart: 20, activeEnd: 30, distance: 10 },
      ],
    });

    // Exactly one stroke: `guides` is empty, and `drawGuideLabel` only fills.
    expect(context.stroke).toHaveBeenCalledOnce();
    // The spacing pass must stroke while the save/transform block is still open.
    // The first `restore` is a label's, so the stroke has to precede it; move the
    // `drawSpacingGuides` call below the outer `context.restore()` and this
    // inverts, because that outer restore becomes the first one.
    expect(context.stroke.mock.invocationCallOrder[0]).toBeLessThan(
      context.restore.mock.invocationCallOrder[0] as number,
    );
  }
});
```

Run it. **Expected: PASS** — if it fails, the spacing pass is not where this step says it is, and that is a
finding to report rather than a fix to improvise.

**Teeth check: move the `drawSpacingGuides` call at `:41` below the `context.restore()` at `:43` and confirm
this test fails on the ordering assertion, then restore it.** Measured: the assertion's inputs invert from
`stroke [10]` / `restore [27, 44, 45]` to `stroke [11]` / `restore [5, 28, 45]`, so it goes false — the outer
restore becomes the first one. Do not instead reach for hoisting a single `context.lineWidth` above the save
block — that changes what the primary guide paints, which is the regression this step is here to prevent.

**No capture, and nothing to register.** The `Viewport | Resize or change zoom` row already has both a capture
and a test — `editor-zoom-readout` / `tracks the camera's zoom in the stage readout`, which exists (find it by
name; it was at `:2169` when this paragraph was written and is at `:2209` now) and owns
`editor-zoom-readout-desktop-chromium.png`. **Do not overwrite it.** A name this
step invents (`editor-guides-at-2x-zoom`) would have no test behind it, so the row would point the next reader at
an image nothing regenerates, which is worse than the `add when changed` placeholder it replaced.

This task's claim is arithmetic — the hairline stays one screen pixel, the clamp is to the artboard, and the
indicators report scene units — and Steps 2, 3 and 4 pin all three as unit tests against the context spy and the
jsdom DOM, where a browser test could only assert on pixels.
Guides are painted straight onto `canvas.getSelectionContext()` and were never Fabric objects, so no capture can
see them either way. If the inspection in Steps 2–3 *does* find a defect and you fix it, say so in the report;
the registration question does not reopen.

```bash
git add src/web/tests/e2e/editor.spec.ts \
  src/web/packages/editor/src/snap-manager \
  src/web/packages/editor/src/indicator-manager
git commit -m "test(editor): verify guides and indicators under camera zoom"
```

**Stage named paths, never `docs/evidence/screenshots`.** That directory holds roughly forty PNGs owned by other
tasks, and it currently carries a modified `editor-desktop-chromium.png` that no task in this plan owns — a
directory-wide `git add` would sweep an unrelated change into this commit under a message about camera zoom.
`git add` on an unmodified path is a no-op, so the three paths above are safe to stage unconditionally.

Stage the source directories too, even when the inspection found nothing: if it did find a defect, the fix is worthless unstaged, and a commit that cannot contain its own fix is the failure this step exists to prevent. If nothing changed, `git add` on an unmodified path is a no-op.

---


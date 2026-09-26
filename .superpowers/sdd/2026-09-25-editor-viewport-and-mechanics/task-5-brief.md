### Task 5: Reachable marquee

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell.ts`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/viewport-manager/index.ts`
- Modify: `src/web/tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: the camera (Tasks 1–2).
- Produces: `ViewportManager` gains `artboardScreenRect(): { left: number; top: number; width: number; height: number }` — the artboard's rect **relative to the canvas element**. Tasks 6–10 consume it; it is the one owner of "where is the artboard, in canvas space".

  **Ruled: canvas-element-relative, NOT client coordinates — and every e2e consumer adds the canvas box offset once.** Earlier revisions of this plan called this accessor's output "client coordinates" in four places. That is wrong for the maths it inherits and would have shipped a silent ~(357, 72) mis-mapping into Tasks 5, 7, 8 and 10. `artboardScreenRect` is built from `canvas.viewportTransform` (`editor-shell.ts:125-132`): `left` is `vpt[4]` and `top` is `vpt[5]`, and the camera writes those as `(viewport.width - board.width * scale) / 2` (`viewport-manager/index.ts:109-113`) where `viewport` is the **canvas** size. Measured: at the 626×594 host the artboard draws 626×352 with `ty` 120.94 — and the canvas element's own client rect is x≈357–983, y≈72–666. So `vpt[4]`/`vpt[5]` are (0, 121), near the canvas origin, **not** the client (357, 193) a "client coordinates" contract promises.

  Canvas-relative is the correct owner: it is the frame `viewportTransform` is actually in, and the alternative costs a forced layout read (`getBoundingClientRect`) on every pan and zoom notification. So each e2e consumer adds `canvasBox.x + rect.left` once, from a `boundingBox()` it already reads for its own pasteboard points.

  **Cost if wrong.** A mis-mapped drag point lands hundreds of pixels from where the test intends — past the canvas entirely, where the drag selects nothing and the test passes **vacuously** while claiming to prove the marquee works. This is the same vacuity class the marquee rewrite exists to remove, which is why it was caught here rather than by a red run: nothing about the assertion would have gone red. If a consumer ever genuinely needs client coordinates, add a second named accessor rather than changing this one's frame — the media layer at `editor-shell.ts:375` needs container-relative, which coincides with this only because the canvas fills the container.

This task owns the accessor because it is the first e2e consumer after Task 2, and every later task's browser test needs the same mapping. **Task 10 does not define it; it uses it.**

Expose the computation rather than adding a second one: `artboardScreenRect(canvas, artboard)` already exists as a module-local function at `editor-shell.ts:121`, used for the background-media element at `:375`. Move that maths onto the camera, then have `editor-shell.ts` call `viewport.artboardScreenRect()` and **delete the local copy** — two implementations of the same transform is the duplication AGENTS.md's "one owner per concept" forbids. The camera already holds the canvas, the viewport transform and the artboard accessor, so no new dependency is introduced, and the frame is unchanged: the media layer is a DOM child of the container the canvas fills (`mountBackgroundMedia` prepends it to `container` at `:365`, and `.editor-shell-stage #vigilia-fabric-editor` is `width/height: 100%`), so container-relative and canvas-relative coincide there. **Do not "fix" the returned frame to satisfy the media layer — nothing needs changing at the call site.**

Fabric's marquee is already on (`SelectableCanvas.d.ts:126`), but it is unreachable because the canvas was exactly the artboard and a full-bleed background rect covered it — verified live, where a corner drag selected and **moved** `header-wash`. Task 2 removed the size cause; the covering rect remains and must be dealt with.

The drag must start in the **pasteboard** — below `header-wash`'s 142px band in *artboard* space — because starting inside that band would grab `header-wash` itself, which is the exact failure this test claims to detect, so a red-then-green loop there would prove nothing.

**The drag coordinates must be derived from the camera, not hardcoded in page space.** Task 2 made the canvas host-sized (measured 626×594 at 1280×720, offset x≈357, y≈72, zoom 0.489), so a literal like `(20, 300)` is no longer in the canvas at all — and since this test asserts only that *nothing moved*, an off-canvas drag passes **vacuously** while proving nothing. Derive the point through the **`artboardScreenRect` accessor this task adds**, read in the page via `window.vigiliaEditorBridge.editor.viewport.artboardScreenRect()`.

*(This line used to say "the accessor Task 10 adds". That was a sequencing error corrected when the accessor moved to this task; Task 10 consumes it.)*

- [ ] **Step 1: Write the failing browser test**

```ts
test("a pasteboard drag marquees instead of moving an object", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);

  const read = (): Promise<Array<[string, number | undefined]>> =>
    page.evaluate(() => {
      const bridge = (window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getObjects(): Array<{ id?: string; left?: number }> } };
        };
      }).vigiliaEditorBridge;
      return bridge.editor.canvas
        .getObjects()
        .map((object) => [String(object.id), object.left] as [string, number | undefined]);
    });

  // The artboard's rect from the camera, in CANVAS-element coordinates — not the
  // canvas box (the canvas is host-sized and much larger than the artboard now)
  // and not client space either. `vpt[4]`/`vpt[5]` are relative to the canvas
  // element, and the canvas sits at x~357 in the page, so the offset is added
  // below rather than assumed away.
  const rect = await page.evaluate(() => {
    const bridge = (window as unknown as {
      vigiliaEditorBridge: {
        editor: { viewport: { artboardScreenRect(): { left: number; top: number; width: number; height: number } } };
      };
    }).vigiliaEditorBridge;
    return bridge.editor.viewport.artboardScreenRect();
  });
  const canvasBox = (await page
    .locator("#vigilia-fabric-editor canvas.upper-canvas")
    .boundingBox())!;
  // Artboard point -> client point. The scale is uniform and derived from the
  // rect, so this mapping is correct whether or not the artboard's aspect
  // happens to match 1280x720 — which it does NOT: `fitScale()` is
  // `Math.min(vw/1280, vh/720)` (`viewport-manager/index.ts:97-100`), a
  // contain-fit, so at the measured 626x594 host the artboard draws 626x352 and
  // every point below y=720 in artboard space is BELOW the canvas.
  //
  // The `canvasBox.x/y` terms are the whole difference between this and a
  // vacuous test: without them every point below lands ~357px left and ~72px
  // above where it belongs, off the canvas, where the drag selects nothing and
  // the assertion passes while proving nothing.
  const scale = (rect.width) / 1280;
  const at = (x: number, y: number): [number, number] => [
    canvasBox.x + rect.left + x * scale,
    canvasBox.y + rect.top + y * scale,
  ];

  const before = await read();

  // The pasteboard is the vertical band BELOW the artboard, and it is the only
  // one there is. `fitScale()` is a contain-fit, so at the 626x594 host the
  // scale is `min(626/1280, 594/720) = 0.489` and the artboard draws 626x352 —
  // full canvas width, centred vertically, leaving 121px bands above and below.
  // An earlier revision of this step claimed "about 240px of pasteboard below
  // the artboard and 350px to its right"; there is no pasteboard to its right,
  // and a pick point that assumed one would land off-canvas and pass vacuously.
  // So the press is placed by Y only, at the horizontal centre; X inside the
  // canvas is free because every X is pasteboard in that band.
  const [sx, sy] = [
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height - 16,
  ];
  // Both sides in client space: `rect` is canvas-relative, so its client
  // position is `canvasBox` + `rect`. Without the offsets these guards compare a
  // client point against a canvas-space edge and pass on a drag that is nowhere
  // near the pasteboard — the vacuity this test exists to remove, reintroduced
  // in the guard itself. The Y guard is the load-bearing one; the X guard only
  // records that the canvas is wider than the artboard's left edge, which is
  // trivially true and kept to document that X is unconstrained here.
  expect(sy).toBeGreaterThan(canvasBox.y + rect.top + rect.height);
  expect(sy).toBeLessThan(canvasBox.y + canvasBox.height);
  expect(sx).toBeGreaterThan(canvasBox.x + rect.left);
  const [ex, ey] = at(100, 200);

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Past Fabric's marquee threshold before releasing: a zero-distance drag would
  // select nothing and pass without exercising the marquee at all.
  await page.mouse.move(ex, ey, { steps: 15 });
  await page.mouse.up();

  expect(await read()).toEqual(before);

  // The vacuity guard: the same gesture started INSIDE an object must move it.
  // Without this, a canvas that ignores pointer input entirely would pass the
  // assertion above.
  // The target is `time-card` (52,150 260x330), deliberately NOT the header band:
  // Step 3 offers disarming `header-wash` as a fix, and a guard that drags inside
  // its 0..142 band would stop being interactive the moment that fix is taken,
  // failing for a reason unrelated to the marquee. (70,450) is inside the card
  // and outside every child it contains.
  const [ox, oy] = at(70, 450);
  await page.mouse.move(ox, oy);
  await page.mouse.down();
  await page.mouse.move(ox + 40, oy + 30, { steps: 10 });
  await page.mouse.up();
  expect(await read()).not.toEqual(before);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test --project=desktop-chromium --grep "pasteboard drag marquees" --workers=1`
Expected: FAIL — an object's `left` changed, because the drag grabbed it.

- [ ] **Step 3: Fix the cause**

`header-wash` is the object this drag grabs today. It is `rect("header-wash", 0, 0, 1280, 142, "#06101a70", 0)` (`new-fabric-theme.ts:331`) and **omits** the interaction argument, so it takes the helper's default and is selectable and evented. The artboard plate at `:328` passes `backgroundOnly` (`:15-19`), which already sets `selectable: false, evented: false` — so the plate is **not** the cause and needs no edit.

The fix is the one Task 2 already made — the canvas is no longer clamped to the artboard, so a point outside the artboard is now genuinely pasteboard — plus, if the drag still grabs `header-wash`, either `header-wash` passing `backgroundOnly` like the plate or its `evented: false`. **Decide from what Step 2 actually reports, and state which in the commit message.** The accessor work is a separate, mandatory part of this step: move `artboardScreenRect`'s maths onto the camera, delete the module-local copy at `editor-shell.ts:121`, and repoint the media call at `:375` (it moved from `:372`; the value is returned from `placeMedia`, which is the call to change).

Do not disable marquee, and do not add a manual hit-test. Fabric's own marquee is the owner.

**Do not solve the pasteboard drag by disarming `header-wash`.** `time-card` and every other card in the starter scene is already selectable and evented, and Step 1's vacuity guard drags `time-card` to prove the canvas still responds to pointer input. If the pasteboard drag only passes because `header-wash` became non-evented, the guard `expect(await read()).not.toEqual(before)` fails on the very next lines — Task 2's second e2e failure is exactly this case, where the drag resolved to the wrong object. Apply the `backgroundOnly` fix to `header-wash` only if Step 2 reports the *pointer landing inside the band*, and check the guard still passes afterwards.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx playwright test --project=desktop-chromium --grep "pasteboard drag marquees" --workers=1`
Expected: PASS. The inside-an-object case is **already the last block of the Step 1 test** (the vacuity guard) — do not add a second test for it, and do not weaken the pasteboard assertion to accommodate it.

Then verify the test has teeth: make the pasteboard drag start inside the `header-wash` band instead, and confirm the first assertion fails. Restore. A marquee test whose drag never reaches the canvas asserts nothing, which is the defect this rewrite exists to remove.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell.ts \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/viewport-manager/index.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "fix(editor): make the pasteboard marquee reachable"
```

---


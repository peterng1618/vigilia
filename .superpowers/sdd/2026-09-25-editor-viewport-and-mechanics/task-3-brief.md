### Task 3: Navigation gestures

**Files:**
- Create: `src/web/packages/editor/src/viewport-manager/navigation.ts`
- Create: `src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-shell.ts`

**Interfaces:**
- Consumes: `ViewportManager` (Task 1).
- Produces: `export function bindViewportNavigation(input: { readonly canvas: Canvas; readonly viewport: ViewportManager }): () => void` — returns the unbind function.

- [ ] **Step 1: Write the failing test**

```ts
// src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts
// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { bindViewportNavigation } from "./navigation.js";

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const viewport = {
    zoom: () => 1,
    zoomToPoint: vi.fn(),
    zoomBy: vi.fn(),
    zoomToFit: vi.fn(),
    zoomToSelection: vi.fn(),
    reset: vi.fn(),
    panBy: vi.fn(),
    resize: vi.fn(),
    // Declared by Task 1's ViewportManager; navigation does not call it, but the
    // stub has to satisfy the interface or this call does not compile.
    onChange: vi.fn(() => (): void => undefined),
    destroy: vi.fn(),
  };
  const unbind = bindViewportNavigation({ canvas, viewport });
  return { canvas, viewport, unbind };
}

describe("viewport navigation", () => {
  it("pans vertically on a wheel", () => {
    const { canvas, viewport } = setup();
    canvas.upperCanvasEl.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }),
    );
    expect(viewport.panBy).toHaveBeenCalledWith(0, -100);
    expect(viewport.zoomToPoint).not.toHaveBeenCalled();
  });

  it("pans horizontally on a shifted wheel", () => {
    const { canvas, viewport } = setup();
    canvas.upperCanvasEl.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 100, shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(viewport.panBy).toHaveBeenCalledWith(-100, 0);
  });

  it("zooms about the pointer on a ctrl-wheel", () => {
    const { canvas, viewport } = setup();
    canvas.upperCanvasEl.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, clientX: 40, clientY: 50, bubbles: true, cancelable: true }),
    );
    expect(viewport.zoomToPoint).toHaveBeenCalled();
    expect(viewport.panBy).not.toHaveBeenCalled();
  });

  it("pans on a space-drag and stops on release", () => {
    const { canvas, viewport } = setup();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    canvas.upperCanvasEl.dispatchEvent(
      new MouseEvent("mousedown", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
    );
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 40, clientY: 25, bubbles: true }));
    expect(viewport.panBy).toHaveBeenCalledWith(30, 15);
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));
    viewport.panBy.mockClear();
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 80, clientY: 80, bubbles: true }));
    expect(viewport.panBy).not.toHaveBeenCalled();
  });

  it("pans on a middle-drag", () => {
    // Step 3 specifies middle-drag panning; without this test the button
    // number and the release handling are both unverified.
    const { canvas, viewport } = setup();
    canvas.upperCanvasEl.dispatchEvent(
      new MouseEvent("mousedown", { button: 1, clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
    );
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 25, clientY: 40, bubbles: true }));
    expect(viewport.panBy).toHaveBeenCalledWith(15, 30);
    window.dispatchEvent(new MouseEvent("mouseup", { button: 1, bubbles: true }));
    viewport.panBy.mockClear();
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 90, clientY: 90, bubbles: true }));
    expect(viewport.panBy).not.toHaveBeenCalled();
  });

  it("unbinds every listener", () => {
    const { canvas, viewport, unbind } = setup();
    unbind();
    canvas.upperCanvasEl.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));
    expect(viewport.panBy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts`
Expected: FAIL — module does not resolve.

- [ ] **Step 3: Implement the gestures**

Wheel pans (`deltaY` → vertical, shift swaps axes); ctrl/meta-wheel zooms about the pointer; space held turns a left-drag into a pan and must set `canvas.defaultCursor = "grab"` so the affordance is visible; middle-drag pans. Every wheel handler calls `preventDefault()` so the page does not scroll. The space state resets on `blur`, or a lost keyup leaves the editor permanently in pan mode.

Also add keyboard zoom: `+`/`=` and `-` about the viewport centre, and `shift+1` for zoom-to-fit. Do **not** add them to `PRODUCT_SHORTCUTS` — that dispatcher owns product actions and defers to text fields; camera keys belong to the canvas, like Fabric's own.

**But "not in `PRODUCT_SHORTCUTS`" does not mean "unguarded" — the same deferral is mandatory here.** These are bare-key window listeners, so without a guard the following all fire while the author is typing, which is a data-loss-class defect, not a polish issue:

- `-` and `=` are ordinary text characters. While a **layer-name rename field** or any inspector input is focused, `-` must insert a hyphen and `+` must insert a plus.
- `shift+1` types `!`. Same requirement.
- **Escape already cancels a layer rename** and must keep doing so; nothing added here may consume Escape.

Reuse the existing owner rather than writing a second one: `isTextEntryTarget` is currently module-private at `src/web/packages/editor/src/shortcut-manager/index.ts:93`, with a single caller at `:68`. **Export it and import it here**; do not copy its body — one concept, one owner.

Add a sixth test to Step 1's block pinning this: focus an `<input>` appended to the document body, dispatch the zoom keys on `window`, and assert `zoomToPoint`/`zoomToFit` were **not** called. A guard that is never exercised is not a guard.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Verify the gesture test has teeth**

Make the wheel handler call `zoomToPoint` unconditionally and rerun. Expected: the first two tests fail. Restore.

Then remove the text-entry deferral from the keyboard-zoom handler and rerun. Expected: the sixth test fails. Restore. A guard whose failure you have not seen is a guard you are guessing at.

- [ ] **Step 6: Wire it into the shell and verify it in the browser**

Call `bindViewportNavigation` in `createNativeEditor` and unbind in `destroy`.

```ts
test("zooms and pans the canvas, and cannot lose the artboard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  // Read the camera through its own accessor: `viewport.zoom()` is the owner of
  // zoom (Task 1), and `window.vigiliaEditorBridge` is the page handle Plan B
  // Task 4 established. Reaching into `canvas.getZoom()` through a debug-key
  // scan reads a different owner and breaks when the handle moves.
  const readZoom = () => page.evaluate(() =>
    (window as unknown as { vigiliaEditorBridge: { editor: { viewport: { zoom(): number } } } })
      .vigiliaEditorBridge.editor.viewport.zoom());

  const fitted = await readZoom();
  await page.locator("#vigilia-fabric-editor canvas.upper-canvas")
    .hover({ position: { x: 200, y: 200 } });
  // Control is required: a plain wheel pans (Step 1 pins that), so wheeling
  // without it asserts the opposite of the unit contract and can only pass by
  // breaking it. Hold the modifier, then confirm the assertion fails with it
  // released — that is the teeth check for the modifier branch.
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -400);
  await page.keyboard.up("Control");
  expect(await readZoom()).toBeGreaterThan(fitted);

  // Pan a long way and confirm the artboard is still on screen: the clamped
  // transform keeps its edge inside the viewport.
  await page.keyboard.down("Space");
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.mouse.move(4000, 4000, { steps: 20 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  const transform = await page.evaluate(() =>
    (window as never as Record<string, { canvas: { viewportTransform: number[] } }>)
      [Object.keys(window).find((key) => key.startsWith("vigilia-fabric-editor"))!]!
      .canvas.viewportTransform);
  // The pan is clamped, so the transform saturates rather than running away.
  // Asserting only finiteness would pass for an unclamped transform — which is
  // exactly the regression this pins. Saturating is sign-agnostic and does not
  // depend on how viewportTransform[4] relates to clampPan's `offset`:
  // drag the same way again and the translate must not move.
  const translate = () => page.evaluate(() =>
    (window as never as Record<string, { canvas: { viewportTransform: number[] } }>)
      [Object.keys(window).find((key) => key.startsWith("vigilia-fabric-editor"))!]!
      .canvas.viewportTransform.slice(4, 6));
  expect(Number.isFinite(transform[4])).toBe(true);
  expect(Number.isFinite(transform[5])).toBe(true);
  const atLimit = await translate();
  await page.keyboard.down("Space");
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.mouse.move(4000, 4000, { steps: 20 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  expect(await translate()).toEqual(atLimit);
});
```

Run: `npx playwright test --project=desktop-chromium --grep "zooms and pans the canvas" --workers=1`
Expected: PASS. Then set the zoom factor to `1` (no zoom) and confirm the first assertion fails. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/viewport-manager/navigation.ts \
  src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts \
  src/web/packages/editor/src/shortcut-manager/index.ts \
  src/web/packages/editor/src/editor-shell.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): zoom and pan gestures for the canvas camera"
```

---


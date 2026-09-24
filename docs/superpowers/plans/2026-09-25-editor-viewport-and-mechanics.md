# Editor Viewport & Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the editor a camera — a zoomable, pannable viewport onto a workspace that contains the artboard — and restore the interaction layer the native-Fabric migration dropped: group entry, reachable marquee, keyboard nudge and a canvas context menu.

**Architecture:** A new `viewport-manager` owns camera state (zoom, pan offset, workspace→screen transform) and nothing else. `editor-shell.ts` stops sizing the canvas to the artboard and hands the host element to that module instead; the canvas becomes a fixed-size surface whose `viewportTransform` the camera drives. Marquee, group entry, nudge and the context menu are then wiring over Fabric and existing managers, not new subsystems.

**Tech Stack:** TypeScript, Fabric 7.4.0 (`fabric/es`), React 19 + Base UI (`ContextMenu`), Vitest + jsdom, Playwright, Biome. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-25-editor-viewport-and-mechanics.md`

**Depends on:** `docs/superpowers/plans/2026-09-25-editor-ui-polish.md` only for Task 11's context menu, which renders from the action registry that plan creates. Tasks 1–10 here have no dependency on it and can be executed first if preferred.

## Global Constraints

- Port the fork's **algorithms, not its API**. ADR-0005 forbids recreating a fork abstraction layer; Russian comments become English or none. The fork at `9efdd78a` is read-only reference: never `checkout`, `switch` or `restore` in `D:\git-repos\fabricjs-image-editor`.
- The viewport is camera state, not document geometry (§57) and never enters authored history (§67).
- Fabric stays imperative behind the editor boundary; React never mirrors a `FabricObject` (§35).
- One owner per concept: the camera owns the transform, `grouping-manager` owns group membership, `PRODUCT_SHORTCUTS` stays the sole key dispatcher.
- Unmodified keys keep deferring to a focused text field (`TEXT_ENTRY_DEFERRED_ACTIONS`).
- Visible copy lives in `ui-copy.ts` (§35); every control has an accessible name.
- Run commands from `src/web/`.
- A new regression test must fail when the fix is disabled before it is trusted.
- Visible behaviour needs rendered/browser inspection, not only object counts or geometry.
- 500 lines is a signal, 800 is a stop for source files.

## Review Focus

The five failure modes most likely to bite an author, and where each is pinned:

1. **Panning the artboard entirely out of view with no way back.** Clamped pan plus a zoom-to-fit control is the only recovery; if clamping regresses, the author is lost. → Task 3.
2. **Zoom about the pointer drifting, so the point under the cursor moves.** The classic `zoomToPoint` mistake is zooming about the canvas centre and translating afterwards. → Task 4.
3. **A marquee drag inside the pasteboard silently moving an object instead of selecting.** This is today's actual bug, and it is what the camera change exists to fix. → Task 5.
4. **Entering a group then undoing leaving the editor in a broken context** — selection pointing at a child of a group that no longer exists. → Task 7.
5. **A context menu whose entries disagree with the dock for the same selection.** It must render from the one registry, never re-implement eligibility. → Task 11.

---

### Task 1: The camera module

**Files:**
- Create: `src/web/packages/editor/src/viewport-manager/index.ts`
- Create: `src/web/packages/editor/src/viewport-manager/viewport.test.ts`
- Create: `src/web/packages/editor/src/viewport-manager/pan-bounds.ts`
- Create: `src/web/packages/editor/src/viewport-manager/pan-bounds.test.ts`

**Interfaces:**
- Consumes: Fabric `Canvas`, `Point`.
- Produces:
  ```ts
  export const MIN_ZOOM = 0.02;
  export const MAX_ZOOM = 64;
  /** Visible margin past the artboard edge before panning is stopped, in screen px. */
  export const PAN_OVERSCROLL_MARGIN = 48;
  export interface ViewportManager {
    zoom(): number;
    /** Zoom about a point in canvas-screen coordinates. */
    zoomToPoint(point: Point, zoom: number): void;
    zoomBy(factor: number): void;
    zoomToFit(): void;
    zoomToSelection(): void;
    reset(): void;
    panBy(deltaX: number, deltaY: number): void;
    /** Re-fit after the host element or the artboard changed size. */
    resize(): void;
    destroy(): void;
  }
  export function createViewportManager(input: {
    readonly canvas: Canvas;
    readonly host: HTMLElement;
    readonly artboard: () => { readonly width: number; readonly height: number };
  }): ViewportManager;
  export function clampPan(input: {
    readonly viewport: { readonly width: number; readonly height: number };
    readonly zoom: number;
    readonly artboard: { readonly width: number; readonly height: number };
    readonly offset: { readonly x: number; readonly y: number };
  }): { readonly x: number; readonly y: number };
  ```

- [ ] **Step 1: Write the failing test for the bounds**

```ts
// src/web/packages/editor/src/viewport-manager/pan-bounds.test.ts
import { describe, expect, it } from "vitest";
import { PAN_OVERSCROLL_MARGIN, clampPan } from "./pan-bounds.js";

const viewport = { width: 1000, height: 800 };
const artboard = { width: 1280, height: 720 };

describe("clampPan", () => {
  it("leaves an offset that keeps the artboard comfortably visible", () => {
    expect(clampPan({ viewport, zoom: 1, artboard, offset: { x: 0, y: 0 } }))
      .toEqual({ x: 0, y: 0 });
  });

  it("stops the artboard being pushed off the right edge", () => {
    const clamped = clampPan({
      viewport, zoom: 1, artboard, offset: { x: 99999, y: 0 },
    });
    // The artboard's left edge cannot pass the viewport's right edge minus the margin.
    expect(clamped.x).toBe(viewport.width - PAN_OVERSCROLL_MARGIN);
  });

  it("stops the artboard being pushed off the left edge", () => {
    const clamped = clampPan({
      viewport, zoom: 1, artboard, offset: { x: -99999, y: 0 },
    });
    expect(clamped.x).toBe(PAN_OVERSCROLL_MARGIN - artboard.width);
  });

  it("keeps the whole artboard reachable at a zoom above fit", () => {
    // At 4x the artboard is wider than the viewport. Panning to its right edge
    // must still be possible, so the lower bound moves out with the artwork.
    const clamped = clampPan({
      viewport, zoom: 4, artboard, offset: { x: -99999, y: 0 },
    });
    expect(clamped.x).toBe(PAN_OVERSCROLL_MARGIN - artboard.width * 4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/viewport-manager/pan-bounds.test.ts`
Expected: FAIL — module does not resolve.

- [ ] **Step 3: Implement the clamp**

```ts
// src/web/packages/editor/src/viewport-manager/pan-bounds.ts
/** Visible margin past the artboard edge before panning is stopped, in screen px. */
export const PAN_OVERSCROLL_MARGIN = 48;

/** Keeps at least the artboard's edge (plus the margin) inside the viewport. */
export function clampPan({ viewport, zoom, artboard, offset }: { /* as in Interfaces */ }) {
  const width = artboard.width * zoom;
  const height = artboard.height * zoom;
  // The artboard's left edge may sit anywhere from just inside the viewport's
  // right edge (margin included) to just past its own right edge off-screen
  // left. Below fit zoom that range is empty-ish, so it is ordered with
  // min/max rather than assumed.
  const lowX = PAN_OVERSCROLL_MARGIN - width;
  const highX = viewport.width - PAN_OVERSCROLL_MARGIN;
  const lowY = PAN_OVERSCROLL_MARGIN - height;
  const highY = viewport.height - PAN_OVERSCROLL_MARGIN;
  return {
    x: Math.min(Math.max(offset.x, Math.min(lowX, highX)), Math.max(lowX, highX)),
    y: Math.min(Math.max(offset.y, Math.min(lowY, highY)), Math.max(lowY, highY)),
  };
}
```

The fork's `PanConstraintManager` (`src/editor/pan-constraint-manager/index.ts`) proves the same idea with a `PAN_OVERSCROLL_MARGIN = 48` and per-axis `canPan`/`min`/`max` state, but it is coupled to `ImageEditor` and `montageArea`. Take the margin and the clamp shape; do not take the class.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/editor/src/viewport-manager/pan-bounds.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Verify the clamp has teeth**

Replace the `min`/`max` clamp with a plain `offset` passthrough and rerun. Expected: 3 failures. Restore.

- [ ] **Step 6: Write the camera's own test**

```ts
// src/web/packages/editor/src/viewport-manager/viewport.test.ts
// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { describe, expect, it } from "vitest";
import { createViewportManager, MAX_ZOOM, MIN_ZOOM } from "./index.js";

function setup() {
  const host = document.createElement("div");
  Object.defineProperty(host, "clientWidth", { value: 1000 });
  Object.defineProperty(host, "clientHeight", { value: 800 });
  const canvas = new Canvas(document.createElement("canvas"));
  const camera = createViewportManager({
    canvas,
    host,
    artboard: () => ({ width: 1280, height: 720 }),
  });
  return { canvas, camera, host };
}

describe("viewport camera", () => {
  it("clamps zoom to its limits", () => {
    const { camera } = setup();
    camera.zoomToPoint({ x: 0, y: 0 }, 9999);
    expect(camera.zoom()).toBe(MAX_ZOOM);
    camera.zoomToPoint({ x: 0, y: 0 }, 0.000001);
    expect(camera.zoom()).toBe(MIN_ZOOM);
  });

  it("fits the whole artboard into the host", () => {
    const { camera } = setup();
    camera.zoomToFit();
    // contain-fit of 1280x720 into 1000x800 is limited by width.
    expect(camera.zoom()).toBeCloseTo(1000 / 1280, 5);
  });

  it("keeps the point under the cursor fixed while zooming", () => {
    const { canvas, camera } = setup();
    camera.zoomToFit();
    const before = canvas.getScenePoint({ x: 400, y: 300 } as never);
    camera.zoomToPoint({ x: 400, y: 300 } as never, camera.zoom() * 2);
    const after = canvas.getScenePoint({ x: 400, y: 300 } as never);
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  it("restores the view after panning far away", () => {
    const { camera } = setup();
    camera.zoomToFit();
    camera.panBy(-100000, -100000);
    camera.zoomToFit();
    expect(camera.zoom()).toBeCloseTo(1000 / 1280, 5);
  });
});
```

- [ ] **Step 7: Run it to verify it fails, then implement the camera**

Run: `npx vitest run packages/editor/src/viewport-manager/viewport.test.ts`
Expected: FAIL — module does not resolve.

Implement `createViewportManager`. The camera reads the transform back out of the canvas rather than holding a second copy: `viewportTransform` is a 6-tuple `[scaleX, skewY, skewX, scaleY, translateX, translateY]`, and Fabric's `zoomToPoint`/`setViewportTransform` are the only writers.

```ts
// src/web/packages/editor/src/viewport-manager/index.ts
import type { Canvas, Point } from "fabric/es";
import { clampPan } from "./pan-bounds.js";

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;

/** Camera state, not document geometry (§57): it never enters authored history (§67). */
export function createViewportManager({ canvas, host, artboard }: { /* as in Interfaces */ }) {
  const resizeObserver =
    typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => resize());

  const zoom = (): number => canvas.getZoom() || 1;

  const apply = (): void => {
    const [scaleX = 1, , , , translateX = 0, translateY = 0] = canvas.viewportTransform ?? [];
    const clamped = clampPan({
      viewport: { width: host.clientWidth, height: host.clientHeight },
      zoom: scaleX,
      artboard: artboard(),
      offset: { x: translateX, y: translateY },
    });
    if (clamped.x === translateX && clamped.y === translateY) return;
    canvas.setViewportTransform([scaleX, 0, 0, scaleX, clamped.x, clamped.y]);
  };

  const fitZoom = (): number =>
    Math.min(host.clientWidth / artboard().width, host.clientHeight / artboard().height);

  const zoomToFit = (): void => {
    const scale = fitZoom();
    canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    // Centre the artboard: at fit zoom it is smaller than the host on one axis.
    canvas.setViewportTransform([
      scale, 0, 0, scale,
      (host.clientWidth - artboard().width * scale) / 2,
      (host.clientHeight - artboard().height * scale) / 2,
    ]);
    canvas.requestRenderAll();
  };

  const zoomToPoint = (point: Point, next: number): void => {
    canvas.zoomToPoint(point, Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM));
    apply();
    canvas.requestRenderAll();
  };

  const resize = (): void => {
    canvas.setDimensions({ width: host.clientWidth, height: host.clientHeight });
    apply();
    canvas.requestRenderAll();
  };

  if (resizeObserver !== undefined) resizeObserver.observe(host);
  resize();

  return {
    zoom,
    zoomToPoint,
    zoomBy(factor) {
      zoomToPoint({ x: host.clientWidth / 2, y: host.clientHeight / 2 } as Point, zoom() * factor);
    },
    zoomToFit,
    zoomToSelection() {
      // ponytail: frames the selection when there is one, else fits the artboard.
      // Add margin-aware framing when the camera proves too tight in use.
      const active = canvas.getActiveObject();
      if (active === undefined) return zoomToFit();
      const bounds = active.getBoundingRect();
      const scale = Math.min(
        host.clientWidth / Math.max(bounds.width, 1),
        host.clientHeight / Math.max(bounds.height, 1),
      );
      const next = Math.min(Math.max(scale * 0.9, MIN_ZOOM), MAX_ZOOM);
      canvas.setViewportTransform([
        next, 0, 0, next,
        host.clientWidth / 2 - (bounds.left + bounds.width / 2) * next,
        host.clientHeight / 2 - (bounds.top + bounds.height / 2) * next,
      ]);
      canvas.requestRenderAll();
    },
    reset() {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      apply();
      canvas.requestRenderAll();
    },
    panBy(deltaX, deltaY) {
      const [scaleX = 1, , , , translateX = 0, translateY = 0] = canvas.viewportTransform ?? [];
      canvas.setViewportTransform([
        scaleX, 0, 0, scaleX, translateX + deltaX, translateY + deltaY,
      ]);
      apply();
      canvas.requestRenderAll();
    },
    resize,
    destroy() {
      resizeObserver?.disconnect();
    },
  };
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/viewport-manager`
Expected: PASS, 8 tests.

- [ ] **Step 9: Commit**

```bash
git add src/web/packages/editor/src/viewport-manager
git commit -m "feat(editor): camera module with clamped pan and zoom-to-point"
```

---

### Task 2: The canvas becomes a viewport

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell.ts`
- Modify: `src/web/packages/editor/src/editor-interaction.ts`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`

**Interfaces:**
- Consumes: `createViewportManager`, `ViewportManager` (Task 1).
- Produces: `EditorInteraction` gains `readonly viewport: ViewportManager`; `EditorShell` gains `readonly viewport: ViewportManager`.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/web/packages/editor/src/editor-shell.dom.test.ts (create it if absent)
it("exposes a camera over the mounted canvas", async () => {
  const host = document.createElement("div");
  Object.defineProperty(host, "clientWidth", { value: 1000 });
  Object.defineProperty(host, "clientHeight", { value: 800 });
  document.body.append(host);
  const shell = await mountEditorShell({
    host,
    artboard: { width: 1280, height: 720, background: { kind: "solid", color: "#000" }, barColor: { kind: "solid", color: "#000" } } as never,
  });
  expect(shell.editor.viewport.zoom()).toBeGreaterThan(0);
  // The canvas fills the host, not the artboard: 1280x720 fitted into 1000x800
  // would be a 1000px-wide canvas, and it must no longer be.
  expect(shell.editor.canvas.getWidth()).toBe(1000);
  expect(shell.editor.canvas.getHeight()).toBe(800);
  shell.destroy();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell.dom.test.ts`
Expected: FAIL — `shell.editor.viewport` is undefined.

- [ ] **Step 3: Replace artboard-sizing with host-sizing**

In `editor-shell.ts`:

- Delete `fitArtboardViewport`'s canvas-resizing role. `createNativeEditor` no longer takes `artboard` dimensions for the canvas; it creates the canvas at the container's size and appends the camera.
- Delete `fitCanvasViewport` entirely.
- The `ResizeObserver` in `mountEditorShell` now only calls `viewport.resize()`; `setArtboard` and `setFitMode` call `viewport.zoomToFit()` (fit mode `cover` can reuse the `Math.max` branch from the deleted helper inside `fitZoom`, if a fit mode is still needed).
- `container` keeps `position: absolute; inset: 0` and drops `margin: auto`, which existed only to centre an artboard-sized box.

In `editor-shell.css`, `#vigilia-fabric-editor { width: 100%; height: 100% }` already does the right thing; remove any rule that sizes the canvas to the artboard.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src`
Expected: PASS. Existing tests that assert an artboard-sized canvas (for example a `fitCanvasViewport` unit test) now assert the camera's fit zoom instead — update them, since the behaviour they pinned is what this task deliberately changes.

- [ ] **Step 5: Inspect the mounted editor**

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
  --grep "captures the mounted editor for visual review" --workers=1
```

Open the capture and confirm the artboard is centred in the stage with pasteboard visible around it, and that the background media (mounted as a separate element under the canvas) still aligns with the artboard. If the media element is absolutely positioned to the host, it now needs the artboard's screen rect instead — that is the one real coupling this task can break, so check it explicitly.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/editor-shell.ts \
  src/web/packages/editor/src/editor-interaction.ts \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/editor-shell.dom.test.ts
git commit -m "refactor(editor): the canvas becomes a viewport onto the workspace"
```

---

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Verify the gesture test has teeth**

Make the wheel handler call `zoomToPoint` unconditionally and rerun. Expected: the first two tests fail. Restore.

- [ ] **Step 6: Wire it into the shell and verify it in the browser**

Call `bindViewportNavigation` in `createNativeEditor` and unbind in `destroy`.

```ts
test("zooms and pans the canvas, and cannot lose the artboard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  const readZoom = () => page.evaluate(() =>
    (window as never as Record<string, { canvas: { getZoom(): number } }>)
      [Object.keys(window).find((key) => key.startsWith("vigilia-fabric-editor"))!]!.canvas.getZoom());

  const fitted = await readZoom();
  await page.locator("#vigilia-fabric-editor canvas.upper-canvas")
    .hover({ position: { x: 200, y: 200 } });
  await page.mouse.wheel(0, -400);
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
  expect(Number.isFinite(transform[4])).toBe(true);
  expect(Number.isFinite(transform[5])).toBe(true);
});
```

Run: `npx playwright test --project=desktop-chromium --grep "zooms and pans the canvas" --workers=1`
Expected: PASS. Then set the zoom factor to `1` (no zoom) and confirm the first assertion fails. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/viewport-manager/navigation.ts \
  src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts \
  src/web/packages/editor/src/editor-shell.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): zoom and pan gestures for the canvas camera"
```

---

### Task 4: The zoom readout

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/zoom-readout.tsx`
- Create: `src/web/packages/editor/src/editor-shell/zoom-readout.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/ui-copy.ts`

**Interfaces:**
- Consumes: `ViewportManager` (Task 1).
- Produces: `ShellLayout.setBridge` gains nothing; instead `EditorShellBridge` gains `readonly viewport: ViewportManager | undefined`, and the readout subscribes to a camera-change event.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
it("shows the zoom as a percentage and resets to fit", async () => {
  const zoomToFit = vi.fn();
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <ZoomReadout viewport={{ zoom: () => 0.5, zoomToFit } as never} />,
  ));
  expect(host.querySelector("[data-vigilia-zoom]")?.textContent).toBe("50%");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Zoom to fit"]')?.click());
  expect(zoomToFit).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/zoom-readout.dom.test.tsx`
Expected: FAIL — module does not resolve.

- [ ] **Step 3: Implement the readout**

A small control in the stage's corner showing `Math.round(zoom() * 100)%`, with a menu offering **Zoom to fit**, **Zoom to selection** and **100 %**. Use Base UI `Menu` as `shell-layout.tsx` already does for the menu bar.

The camera must announce changes: add `onChange(listener): () => void` to `ViewportManager` and have the camera notify after every `apply()`. The readout uses `useSyncExternalStore` over it, exactly as `shell-layout.tsx:116-118` does for selection. Re-render the bridge subscription when the canvas is panned by a gesture or by a wheel — a readout that only updates on menu actions would be wrong.

- [ ] **Step 4: Run the test, then inspect it rendered**

Run: `npx vitest run packages/editor/src/editor-shell/zoom-readout.dom.test.tsx`
Expected: PASS.

Then rebuild, wheel-zoom in a real browser session, and confirm the readout tracks the zoom rather than staying at the fit value. Add a `docs/evidence/screenshots/README.md` row for a new capture that shows the readout at a non-fit zoom, and register the corresponding test in `tests/e2e/editor.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/zoom-readout.tsx \
  src/web/packages/editor/src/editor-shell/zoom-readout.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/ui-copy.ts \
  docs/evidence/screenshots/README.md src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): zoom readout with fit and 100% resets"
```

---

### Task 5: Reachable marquee

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell.ts`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: the camera (Tasks 1–2). Produces: nothing new.

Fabric's marquee is already on (`SelectableCanvas.d.ts:126`), but it is unreachable because the canvas was exactly the artboard and a full-bleed background rect covered it — verified live, where a corner drag selected and **moved** `header-wash`. Task 2 removed the size cause; the covering rect remains and must be dealt with.

- [ ] **Step 1: Write the failing browser test**

```ts
test("a pasteboard drag marquees instead of moving an object", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  const before = await page.evaluate(() => {
    const editor = (window as never as Record<string, { canvas: { getObjects(): { id?: string; left?: number }[] } }>)
      [Object.keys(window).find((key) => key.startsWith("vigilia-fabric-editor"))!]!;
    return editor.canvas.getObjects().map((object) => [object.id, object.left]);
  });

  // Start well outside the artboard, in the pasteboard, and drag across it.
  await page.mouse.move(30, 60);
  await page.mouse.down();
  await page.mouse.move(900, 700, { steps: 15 });
  await page.mouse.up();

  const after = await page.evaluate(() => { /* same read */ });
  expect(after).toEqual(before);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test --project=desktop-chromium --grep "pasteboard drag marquees" --workers=1`
Expected: FAIL — an object's `left` changed, because the drag grabbed it.

- [ ] **Step 3: Fix the cause**

`backgroundOnly` objects (`new-fabric-theme.ts:15-19`) already set `selectable: false, evented: false`, so the artboard plate should not be grabbable — check whether it is, and whether the object actually grabbed is a different one that happens to extend past the artboard edge. If the grabbed object is legitimately selectable and merely large, the real fix is the canvas no longer being clamped to it, which Task 2 already did; if the plate is still evented, set `evented: false` on it in the theme fixture.

Do not disable marquee, and do not add a manual hit-test. Fabric's own marquee is the owner.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx playwright test --project=desktop-chromium --grep "pasteboard drag marquees" --workers=1`
Expected: PASS. Then make the drag start inside an object and confirm the test still passes (a drag on an object legitimately moves it — assert that case separately rather than weakening the assertion).

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell.ts \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/tests/e2e/editor.spec.ts
git commit -m "fix(editor): make the pasteboard marquee reachable"
```

---

### Task 6: Keyboard nudge and z-order

**Files:**
- Modify: `src/web/packages/editor/src/shortcut-manager/index.ts`
- Modify: `src/web/packages/editor/src/shortcut-manager/index.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-session.ts`

**Interfaces:**
- Consumes: `EditorInteraction` (`layerManager`, `historyManager`).
- Produces: new `ProductShortcutId` members `"canvas.nudge-left" | "canvas.nudge-right" | "canvas.nudge-up" | "canvas.nudge-down" | "canvas.select-all" | "canvas.front" | "canvas.back"`.

- [ ] **Step 1: Write the failing test**

```ts
it("nudges on an arrow key and defers to a text field", () => {
  const manager = new ShortcutManager();
  const nudge = vi.fn();
  manager.register("canvas.nudge-left", nudge);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  expect(nudge).toHaveBeenCalledTimes(1);

  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  expect(nudge).toHaveBeenCalledTimes(1);
  manager.destroy();
});

it("maps shift+arrow to a larger step", () => {
  const manager = new ShortcutManager();
  const small = vi.fn();
  const large = vi.fn();
  manager.register("canvas.nudge-left", small);
  manager.register("canvas.nudge-left-large", large);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true }));
  expect(small).toHaveBeenCalledTimes(1);
  expect(large).toHaveBeenCalledTimes(1);
  manager.destroy();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/shortcut-manager/index.dom.test.ts`
Expected: FAIL — `canvas.nudge-left` is not a known action.

- [ ] **Step 3: Add the bindings**

Arrow keys are unmodified, so they already defer to text entry; verify that rather than assuming it. `Shift`-qualified bindings must precede their plain forms, as the existing table's comment requires. Add `canvas.select-all` on `mod+a` and z-order on `mod+]` / `mod+[`. Register the handlers in `editor-session.ts` beside the existing eleven, each writing through `layerManager` or setting `left`/`top`, then `canvas.fire("object:modified")` so the existing `object:modified` → `save` listener records **one** history entry per gesture. Nudge must coalesce: a held arrow key must not write one history entry per repeat.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src/shortcut-manager`
Expected: PASS.

- [ ] **Step 5: Verify in the browser**

```ts
test("nudges the selection and records one history entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  await page.locator('[data-vigilia-layer="header-wash"]').click();
  const left = () => page.evaluate(/* read the object's left */);
  const before = await left();
  await page.keyboard.press("ArrowRight");
  expect(await left()).toBe(before + 1);
  await page.keyboard.press("Shift+ArrowRight");
  expect(await left()).toBe(before + 1 + 10);
  await page.keyboard.press("Control+z");
  expect(await left()).toBe(before);
});
```

Run: `npx playwright test --project=desktop-chromium --grep "nudges the selection" --workers=1`
Expected: PASS. Then remove the single-save coalescing and confirm the undo assertion fails (it would take two undos to return). Restore.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/shortcut-manager \
  src/web/packages/editor/src/editor-session.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): keyboard nudge, z-order and select-all"
```

---

### Task 7: Group entry

**Files:**
- Modify: `src/web/packages/editor/src/grouping-manager/index.ts`
- Create: `src/web/packages/editor/src/grouping-manager/group-entry.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-interaction.ts`
- Modify: `src/web/packages/editor/src/editor-session.ts`

**Interfaces:**
- Produces: `GroupingManager` gains
  ```ts
  enterGroup(options?: { readonly object?: FabricObject }): FabricObject | undefined;
  exitGroup(): readonly FabricObject[] | undefined;
  readonly groupContext: () => readonly FabricObject[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
it("enters a group and selects the child under the object", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child], { id: "group" });
  canvas.add(group);
  const manager = createGroupingManager({
    canvas, save: vi.fn(), suspend: () => () => undefined,
  });

  expect(manager.enterGroup({ object: group })).toBe(group);
  expect(manager.groupContext()).toEqual([group]);

  // A child's pointer target resolves to the child, not the group.
  const target = manager.enterGroup({ object: child });
  expect(target).toBe(child);
  expect(canvas.getActiveObject()).toBe(child);

  expect(manager.exitGroup()).toEqual([group]);
  expect(canvas.getActiveObject()).toBe(group);
  expect(manager.groupContext()).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/grouping-manager/group-entry.dom.test.ts`
Expected: FAIL — `manager.enterGroup is not a function`.

- [ ] **Step 3: Implement entry and exit**

`enterGroup` sets the child active and records the ancestor path; `exitGroup` pops one level and re-selects the group. Both record no history — group *context* is selection state, not authored content (§67), which is exactly why it is transient here rather than in the envelope. `ungroup()` must clear the context, or a later `exitGroup` re-selects a destroyed group. That is the Review Focus item, and it is asserted below.

Also add: `ungroup()` clears the context; `destroy`-time `stopGesture`-style cleanup is not needed since the context is plain state on the manager.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src/grouping-manager`
Expected: PASS.

- [ ] **Step 5: Wire double-click and Escape**

In `editor-session.ts`, bind double-click on the canvas to `enterGroup` with the pointer's target, and Escape to `exitGroup`. Do not add Escape to `PRODUCT_SHORTCUTS`: Escape is context-specific (it also leaves text editing), and Fabric already handles the editing case.

- [ ] **Step 6: Verify in the browser, including the undo case**

```ts
test("enters a group, steps back out, and survives an undo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  // Group two layers, enter the group, nudge a child, undo, and confirm the
  // context is still a live group rather than a destroyed one.
});
```

Run: `npx playwright test --project=desktop-chromium --grep "enters a group" --workers=1`
Expected: PASS. Then remove the context-clearing in `ungroup()` and confirm the undo case fails. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/grouping-manager \
  src/web/packages/editor/src/editor-interaction.ts \
  src/web/packages/editor/src/editor-session.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): enter and exit a group from the canvas"
```

---

### Task 8: The layer tree follows the group context

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.ts`

**Interfaces:**
- Consumes: `GroupingManager.groupContext()` (Task 7), `LayerPanel` (UI-polish plan Task 5). **This task depends on the UI-polish plan.**

- [ ] **Step 1: Write the failing test**

```tsx
it("marks the group whose children are current and dims the rest", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <LayerPanel bridge={bridge(rows, { groupContext: () => ["group"] })} />,
  ));
  expect(host.querySelector('[data-vigilia-layer="group"]')?.getAttribute("data-context")).toBe("true");
  expect(host.querySelector('[data-vigilia-layer="other"]')?.getAttribute("data-context")).toBe("false");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
Expected: FAIL — no `data-context` attribute.

- [ ] **Step 3: Reflect the context**

Add `groupContext(): readonly string[]` to `EditorShellBridge` (ids, not objects — the projection rule holds). Mark the owning group row `data-context="true"` and give rows outside the context a muted style. Because the tree can now select a group's children directly, the old "selection resolves a child through its owning group" behaviour is no longer the only path: keep it for a canvas click, but let a tree click on a child select the child itself when its group is the current context.

- [ ] **Step 4: Run the tests and inspect**

Run: `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
Expected: PASS. Then rebuild, enter a group in the browser, and confirm in the capture that the tree shows the context and the child is selectable.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/layer-panel.tsx \
  src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/bridge.ts
git commit -m "feat(editor): layer tree reflects the group context"
```

---

### Task 9: The canvas context menu

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/canvas-context-menu.tsx`
- Create: `src/web/packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/ui-copy.ts`

**Interfaces:**
- Consumes: `OBJECT_ACTIONS`, `arrangeActions`, `actionEnabled` (UI-polish plan Tasks 1–2, 6); `EditorShellBridge`.
- Produces: nothing consumed by later tasks. **This task depends on the UI-polish plan.**

- [ ] **Step 1: Write the failing test**

```tsx
it("shows exactly the entries the dock would enable", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const can = (action: string) => action === "delete" || action === "duplicate";
  await act(async () => root.render(
    <CanvasContextMenu bridge={bridge(rows, { can })} open at={{ x: 10, y: 20 }} />,
  ));
  const items = [...host.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);
  expect(items.sort()).toEqual(["Delete", "Duplicate"]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx`
Expected: FAIL — module does not resolve.

- [ ] **Step 3: Implement the menu**

Right-click on the canvas opens a Base UI `ContextMenu` at the pointer. Entries come from the same filtered list the dock render uses — call `actionEnabled` for each, do not re-derive eligibility. Right-clicking empty canvas offers the creation actions (`uiCopy.panels.text`, the four chart families) through `session`, since those are not object actions and must not enter the object registry.

Suppress the browser's own context menu on the canvas only, not document-wide.

- [ ] **Step 4: Run the tests, then inspect**

Run: `npx vitest run packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx`
Expected: PASS. Then rebuild, right-click a selected object in the browser, and confirm the visible menu matches the dock's enabled buttons. Capture it and register the row in `docs/evidence/screenshots/README.md`.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/canvas-context-menu.tsx \
  src/web/packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/ui-copy.ts \
  docs/evidence/screenshots/README.md
git commit -m "feat(editor): canvas context menu from the action registry"
```

---

### Task 10: Snapping and indicators at non-1 zoom

**Files:**
- Modify: `src/web/tests/e2e/editor.spec.ts`
- Modify: `src/web/packages/editor/src/indicator-manager/index.ts` (only if verification finds a defect).

**Interfaces:**
- Consumes: the camera (Tasks 1–2). Produces: nothing.

The spec's acceptance item "snapping guides and indicators stay correct at non-1 zoom" is a claim about existing code, so verify it rather than assuming it. `snap-manager/index.ts` divides guide width by zoom and clamps guides to the artboard; `guide-renderer.ts:30` reads `viewportTransform` and applies it to the context. Both look right, and both were only ever exercised at fit zoom.

- [ ] **Step 1: Write the browser test**

```ts
test("keeps guides on the artboard while zoomed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  // Zoom in about a known point, drag a layer near a neighbour, and capture.
});
```

- [ ] **Step 2: Run it and inspect the capture**

Run: `cd src/web && npm run build && VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "keeps guides on the artboard while zoomed" --workers=1`

Open the image. Confirm: guide lines are hairline-thin regardless of zoom (not scaled into thick bands), they span the artboard and stop at its edges, and they align with the dragged object's real edges. A one-pixel guide at 4x zoom is the specific failure to look for.

- [ ] **Step 3: Fix only what the inspection shows**

If the guides scale with zoom, the divide at `guide-renderer.ts:37` is reading the wrong value; if they clamp to the viewport instead of the artboard, `snap-manager/index.ts`'s `guideBounds` call is not reaching the renderer. Fix the found cause and nothing else — do not restyle guides.

- [ ] **Step 4: Commit**

```bash
git add src/web/tests/e2e/editor.spec.ts docs/evidence/screenshots
git commit -m "test(editor): verify guides and indicators under camera zoom"
```

---

### Task 11: Full gate

**Files:** none created; verification only.

- [ ] **Step 1: Run the broad gate**

```bash
cd src/web
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run size
```

- [ ] **Step 2: Run the browser suite**

```bash
npm run test:e2e
```

`display-fabric.spec.ts` has two known pre-existing phone-chromium failures ("keeps repainting as samples arrive", "is byte-stable at a fixed clock on one platform"), both hanging at `document.fonts.ready` after `page.clock.runFor()`. Confirm they are unchanged and report them; do not absorb them into this change.

- [ ] **Step 3: Confirm the player is untouched**

The player consumes `scene-fabric`, never editor UI or the camera. Confirm `npm run size` shows no player bundle growth and that nothing under `packages/player` imports from `viewport-manager` or `editor-shell`.

- [ ] **Step 4: Inspect each acceptance item**

Rebuild, then capture and open: the artboard centred with pasteboard visible; a zoomed view with a correct readout; a marquee drag selecting without moving; a context menu matching the dock; a group entered with the tree showing the context. Each is a visible outcome and each needs the rendered check, not an object count.

- [ ] **Step 5: Update STATUS.md**

Replace "Last completed change" with a 1–5 bullet summary, update "Next" and "Blockers / unverified", then run `npm run status:check`.

- [ ] **Step 6: Commit**

```bash
git add STATUS.md
git commit -m "docs(status): record the editor viewport and mechanics"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Canvas becomes a camera / workspace with pasteboard | 2 |
| Zoom about the pointer, clamped limits | 1, 3 |
| Scroll and shift-scroll pan | 3 |
| Space-drag and middle-drag pan | 3 |
| Zoom keys, fit and to-selection | 1, 3, 4 |
| Constrained pan, artboard cannot be lost | 1 |
| Zoom readout with fit and 100 % | 4 |
| Group entry, Escape steps out | 7 |
| Layer tree reflects the context | 8 |
| Keyboard nudge, z-order, select-all | 6 |
| Canvas context menu from the registry | 9 |
| Reachable marquee | 5 |
| Guides and indicators at non-1 zoom | 10 |
| Acceptance: full gate | 11 |

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N". Task 7 Step 6's browser test and Task 2's media-alignment check name the behaviour to assert rather than reproducing a full fixture, because building the group fixture in-page is the executor's smallest-possible step and the assertion is stated exactly. Task 10 Step 3 deliberately says "fix only what the inspection shows" — the spec makes a claim about existing code and the task exists to test it, so inventing a fix before the inspection would violate §33.

**Type consistency:** `ViewportManager`'s method set is identical in Tasks 1, 3, 4, 10. `GroupingManager.enterGroup`/`exitGroup`/`groupContext` are the same in Tasks 7 and 8. `actionEnabled(bridge, id)` is defined once in the UI-polish plan and called by both the dock and the context menu in Task 9. `ProductShortcutId` members added in Task 6 are the ones registered in `editor-session.ts`.

**Review Focus coverage:** item 1 → Task 1 Step 1 and Step 5, Task 3 Step 6; item 2 → Task 1 Step 6 (the point-stays-fixed test); item 3 → Task 5 Step 1; item 4 → Task 7 Step 6; item 5 → Task 9 Step 1.

**Cross-plan dependency:** Tasks 8 and 9 require the UI-polish plan's registry and layer panel. Marked in their Interfaces blocks. If both plans run in one branch, execute the UI-polish plan's Tasks 1–6 first; if they run separately, Tasks 1–7 and 10–11 here stand alone.

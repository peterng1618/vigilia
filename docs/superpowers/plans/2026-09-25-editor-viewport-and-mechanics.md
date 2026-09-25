# Editor Viewport & Mechanics Implementation Plan

> **Active plan.** `STATUS.md` names this plan as the one active plan.
> Tasks 1-8 are **landed**, each marked below with its commit. Task 9, the
> canvas context menu, has also landed and carries the measured mechanism the
> earlier draft got wrong. **Task 11 is the remaining gate.**
> Execute remaining work with `superpowers:subagent-driven-development` or
> `superpowers:executing-plans`. Parallelize only independent tasks inside
> the current phase.
>
> Landed tasks are kept whole as the record of what was built. Do not
> re-dispatch one. Task 9 is corrected in place rather than marked, because
> its steps were wrong and the corrections are the mechanism.

**Goal:** Give the editor a camera — a zoomable, pannable viewport onto a workspace that contains the artboard — and restore the interaction layer the native-Fabric migration dropped: group entry, reachable marquee, keyboard nudge and a canvas context menu.

**Architecture:** A new `viewport-manager` owns camera state (zoom, pan offset, workspace→screen transform) and nothing else. `editor-shell.ts` stops sizing the canvas to the artboard and hands the host element to that module instead; the canvas becomes a fixed-size surface whose `viewportTransform` the camera drives. Marquee, group entry, nudge and the context menu are then wiring over Fabric and existing managers, not new subsystems.

**Tech Stack:** TypeScript, Fabric 7.4.0 (`fabric/es`), React 19 + Base UI (`ContextMenu`), Vitest + jsdom, Playwright, Biome. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-25-editor-viewport-and-mechanics.md`

**Depends on:** `docs/superpowers/plans/2026-09-25-editor-ui-polish.md` for **Tasks 8 and 9** — Task 9's context menu renders from the action registry that plan creates, and Task 8 modifies `editor-shell/layer-panel.tsx` and consumes `editor-shell/layer-tree.ts`, both of which that plan creates. Tasks 1–7 and 10–11 have no dependency on it.

## Global Constraints

- Port the fork's **algorithms, not its API**. ADR-0005 forbids recreating a fork abstraction layer; Russian comments become English or none. The fork at `9efdd78a` is read-only reference: never `checkout`, `switch` or `restore` in `D:\git-repos\fabricjs-image-editor`.
- The viewport is camera state, not document geometry (§57) and never enters authored history (§67).
- Fabric stays imperative behind the editor boundary; React never mirrors a `FabricObject` (§35).
- One owner per concept: the camera owns the transform, `grouping-manager` owns group membership, `PRODUCT_SHORTCUTS` stays the sole key dispatcher.
- A focused text field keeps its own keys: an **unmodified** binding defers unconditionally, and a **modifier** binding defers only when its action is in `MODIFIED_KEY_DEFERRED_ACTION_IDS` (`shortcut-manager/index.ts`). (An earlier revision named this set `TEXT_ENTRY_DEFERRED_ACTIONS`; Task 6 renamed it, because the old name described only one of the two cases the predicate handles.)
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
5. **A context menu whose entries disagree with the dock for the same selection.** It must render from the one registry, never re-implement eligibility. → **Task 9**, which builds the menu (an earlier revision said Task 11; Task 11 is the full gate and owns no menu code). Task 9's Step 1 pins it.

---

### Task 1: The camera module

> **Landed** - `1f05897`.

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
    /** Subscribes to camera changes; returns the unsubscribe function. Task 4's
     * zoom readout is the consumer. */
    onChange(listener: () => void): () => void;
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

- [x] **Step 1: Write the failing test for the bounds**

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

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/viewport-manager/pan-bounds.test.ts`
Expected: FAIL — module does not resolve.

- [x] **Step 3: Implement the clamp**

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

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/editor/src/viewport-manager/pan-bounds.test.ts`
Expected: PASS, 4 tests.

- [x] **Step 5: Verify the clamp has teeth**

Replace the `min`/`max` clamp with a plain `offset` passthrough and rerun. Expected: 3 failures. Restore.

- [x] **Step 6: Write the camera's own test**

```ts
// src/web/packages/editor/src/viewport-manager/viewport.test.ts
// @vitest-environment jsdom
import { Canvas, Point } from "fabric/es";
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
    // A real MouseEvent, not {x, y}: getScenePoint resolves through getPointer,
    // which reads event.clientX/clientY. A bare object yields NaN on both sides
    // and toBeCloseTo can never pass on NaN.
    const at = (x: number, y: number) =>
      canvas.getScenePoint(
        new MouseEvent("pointermove", { clientX: x, clientY: y }),
      );
    const before = at(400, 300);
    camera.zoomToPoint(new Point(400, 300), camera.zoom() * 2);
    const after = at(400, 300);
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

- [x] **Step 7: Run it to verify it fails, then implement the camera**

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

- [x] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/viewport-manager`
Expected: PASS, 8 tests.

- [x] **Step 9: Commit**

```bash
git add src/web/packages/editor/src/viewport-manager
git commit -m "feat(editor): camera module with clamped pan and zoom-to-point"
```

---

### Task 2: The canvas becomes a viewport

> **Landed** - `093b3ec`.

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell.ts`
- Modify: `src/web/packages/editor/src/editor-interaction.ts`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`

**Interfaces:**
- Consumes: `createViewportManager`, `ViewportManager` (Task 1).
- Produces: `EditorInteraction` gains `readonly viewport: ViewportManager`; `EditorShell` gains `readonly viewport: ViewportManager`.

- [x] **Step 1: Write the failing test**

```ts
// append to src/web/packages/editor/src/editor-shell.dom.test.ts
// The file already exists — add the case beside the existing mountEditorShell
// tests and keep the `getContext` proxy `beforeEach` intact. The proxy is
// load-bearing: without it Fabric's render pass cannot drawImage an undecoded
// image in jsdom, and unrelated tests fail with an opaque render error.
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

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell.dom.test.ts`
Expected: FAIL — `shell.editor.viewport` is undefined.

- [x] **Step 3: Replace artboard-sizing with host-sizing**

In `editor-shell.ts`:

- Delete `fitArtboardViewport`'s canvas-resizing role. `createNativeEditor` no longer takes `artboard` dimensions for the canvas; it creates the canvas at the container's size and appends the camera. **Its `artboard: Artboard` parameter then becomes unused — verified: the only reads are `width: artboard.width, height: artboard.height` at `editor-shell.ts:196-197`, both of which go with the resize — so drop the parameter and its argument at the `:316` call site rather than leaving a dead one.** The camera's `artboard` accessor is what still knows the board's size.
- **The camera's `host` is the shell's `host` element** — the one `mountEditorShell` receives — not `container`. This is the line the Architecture section already draws ("hands the host element to that module", plan:7), and `createViewportManager({ host })` must be constructed with it. **`container` becomes a passive full-bleed child**: it keeps `position: absolute; inset: 0` and loses the `container.style.width/height` writes that `fitArtboardViewport` makes today (`editor-shell.ts:110-115`), which is what currently sizes it to the scaled artboard. Verified the two facts that decide this:
  - `container` is created *inside* `mountEditorShell` (`editor-shell.ts:279-289`) and has no measured size of its own — in jsdom its `clientWidth` is `0` even with `inset: 0`, because there is no layout engine. The tests stub dimensions on the **host they pass in** (`editor-shell.dom.test.ts:35-36` and five more sites, all `clientWidth: 400, clientHeight: 300`). A camera constructed with `container` would therefore hit Task 1's zero-size guard at every entry point and silently do nothing, and this task's own `getWidth() === 1000` assertion could not pass.
  - `fitArtboardViewport` already reads `host` for the fit while writing `container`'s dimensions (`:142` vs `:130-131`), so `host` is the box the scale was always computed from. Keeping it as the camera's box preserves that relationship rather than inventing a new one.
- Delete `fitCanvasViewport` entirely.
- The `ResizeObserver` in `mountEditorShell` now only calls `viewport.resize()`; `setArtboard` and `setFitMode` call `viewport.zoomToFit()` (fit mode `cover` can reuse the `Math.max` branch from the deleted helper inside `fitZoom`, if a fit mode is still needed).
- `container` keeps `position: absolute; inset: 0` and drops `margin: auto`, which existed only to centre an artboard-sized box.

In `editor-shell.css`, `#vigilia-fabric-editor { width: 100%; height: 100% }` already does the right thing; remove any rule that sizes the canvas to the artboard.

- [x] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src`
Expected: PASS. Existing tests that assert an artboard-sized canvas (for example a `fitCanvasViewport` unit test) now assert the camera's fit zoom instead — update them, since the behaviour they pinned is what this task deliberately changes.

- [x] **Step 5: Inspect the mounted editor**

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
  --grep "captures the mounted editor for visual review" --workers=1
```

Open the capture and confirm the artboard is centred in the stage with pasteboard visible around it, and that the background media (mounted as a separate element under the canvas) still aligns with the artboard. If the media element is absolutely positioned to the host, it now needs the artboard's screen rect instead — that is the one real coupling this task can break, so check it explicitly.

- [x] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/editor-shell.ts \
  src/web/packages/editor/src/editor-interaction.ts \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/editor-shell.dom.test.ts
git commit -m "refactor(editor): the canvas becomes a viewport onto the workspace"
```

---

### Task 3: Navigation gestures

> **Landed** - `1425593`.

**Files:**
- Create: `src/web/packages/editor/src/viewport-manager/navigation.ts`
- Create: `src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-shell.ts`

**Interfaces:**
- Consumes: `ViewportManager` (Task 1).
- Produces: `export function bindViewportNavigation(input: { readonly canvas: Canvas; readonly viewport: ViewportManager }): () => void` — returns the unbind function.

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts`
Expected: FAIL — module does not resolve.

- [x] **Step 3: Implement the gestures**

Wheel pans (`deltaY` → vertical, shift swaps axes); ctrl/meta-wheel zooms about the pointer; space held turns a left-drag into a pan and must set `canvas.defaultCursor = "grab"` so the affordance is visible; middle-drag pans. Every wheel handler calls `preventDefault()` so the page does not scroll. The space state resets on `blur`, or a lost keyup leaves the editor permanently in pan mode.

Also add keyboard zoom: `+`/`=` and `-` about the viewport centre, and `shift+1` for zoom-to-fit. Do **not** add them to `PRODUCT_SHORTCUTS` — that dispatcher owns product actions and defers to text fields; camera keys belong to the canvas, like Fabric's own.

**But "not in `PRODUCT_SHORTCUTS`" does not mean "unguarded" — the same deferral is mandatory here.** These are bare-key window listeners, so without a guard the following all fire while the author is typing, which is a data-loss-class defect, not a polish issue:

- `-` and `=` are ordinary text characters. While a **layer-name rename field** or any inspector input is focused, `-` must insert a hyphen and `+` must insert a plus.
- `shift+1` types `!`. Same requirement.
- **Escape already cancels a layer rename** and must keep doing so; nothing added here may consume Escape.

Reuse the existing owner rather than writing a second one: `isTextEntryTarget` lives in `src/web/packages/editor/src/shortcut-manager/index.ts` (declared `:94`, with its doc comment at `:92-93`), with a single caller in the same file. **Task 3 already exported it** — verify with `grep -n "export function isTextEntryTarget"` rather than trusting a line number, since this file gains listeners as the plan proceeds. Import it; do not copy its body — one concept, one owner.

Add a sixth test to Step 1's block pinning this: focus an `<input>` appended to the document body, dispatch the zoom keys on `window`, and assert `zoomToPoint`/`zoomToFit` were **not** called. A guard that is never exercised is not a guard.

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts`
Expected: PASS, 7 tests.

- [x] **Step 5: Verify the gesture test has teeth**

Make the wheel handler call `zoomToPoint` unconditionally and rerun. Expected: the first two tests fail. Restore.

Then remove the text-entry deferral from the keyboard-zoom handler and rerun. Expected: the sixth test fails. Restore. A guard whose failure you have not seen is a guard you are guessing at.

- [x] **Step 6: Wire it into the shell and verify it in the browser**

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

- [x] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/viewport-manager/navigation.ts \
  src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts \
  src/web/packages/editor/src/shortcut-manager/index.ts \
  src/web/packages/editor/src/editor-shell.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): zoom and pan gestures for the canvas camera"
```

---

### Task 4: The zoom readout

> **Landed** - `a2a1156 + 230bb58`.

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/zoom-readout.tsx`
- Create: `src/web/packages/editor/src/editor-shell/zoom-readout.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Modify: `src/web/tests/e2e/editor.spec.ts` (the readout's browser case, Step 4)

**Interfaces:**
- Consumes: `ViewportManager` (Task 1), including its `onChange` subscription, which Task 1 declares. Reached through the **existing** `EditorShellBridge.editor.viewport`.
- Produces: nothing on the bridge. `ZoomReadout` takes the camera as a prop, and `shell-layout.tsx` passes `bridge?.editor.viewport`.

**Ruled: the bridge gains no `viewport` member — the path it needs already exists and is required.** The earlier version of this task added `EditorShellBridge.viewport: ViewportManager | undefined` and told the implementer to "add the field to whatever literal constructs the bridge". Both halves are wrong:

- `EditorShellBridge` already declares `readonly editor: EditorInteraction` (`bridge.ts:51`, `:67`, `:200`), and `EditorInteraction` already declares `readonly viewport: ViewportManager` (`editor-interaction.ts:12-13`) — **required, not optional**. So `bridge.editor.viewport` is already in the public surface and already type-checks. A second member would be a second owner for one concept, which `docs/architecture/ownership.md` and AGENTS.md's "one owner per concept" both forbid.
- The literal that constructs the bridge is `createEditorShellBridge({ editor, session })` at `editor-main.ts:155`, and it **already passes `editor`**. So the field the earlier text asked for was not merely redundant, it was already there under another name — and the `| undefined` would have weakened a required member into a nullable one, forcing every consumer to handle a case that cannot occur.

The readout therefore does **not** read the bridge at all. It is a presentational component taking `viewport: ViewportManager` as a prop, which is also what makes Step 1's stub — a value satisfying `ViewportManager` with no bridge and no cast — the natural shape rather than a contrivance. `shell-layout.tsx` is the only file that touches the bridge, at the call site:

```tsx
{bridge === undefined ? null : <ZoomReadout viewport={bridge.editor.viewport} />}
```

**Cost if wrong.** If a later task wants the readout to work with no editor mounted, it would need the optional member back. That is a new requirement with a real caller, and the change is one member. The alternative today is an optional duplicate of a required member, on the surface every panel reads.

`ZoomReadout` does not touch `EditorShellBridge`; `shell-layout.tsx` is where the bridge is read, and `editor-main.ts` needs no edit at all.

- [x] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
it("shows the zoom as a percentage and resets to fit", async () => {
  const zoomToFit = vi.fn();
  const listeners = new Set<() => void>();
  let zoom = 0.5;
  // A stub with every ViewportManager member and no `as never`: the cast would
  // erase a missing `onChange`, which is exactly the defect to catch.
  const viewport = {
    zoom: () => zoom,
    zoomToPoint: vi.fn(),
    zoomBy: vi.fn(),
    zoomToFit,
    zoomToSelection: vi.fn(),
    reset: vi.fn(),
    panBy: vi.fn(),
    resize: vi.fn(),
    onChange: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: vi.fn(),
  } satisfies ViewportManager;

  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<ZoomReadout viewport={viewport} />));
  expect(host.querySelector("[data-vigilia-zoom]")?.textContent).toBe("50%");

  // The readout must track the camera, not just render its first value.
  await act(async () => {
    zoom = 2;
    for (const listener of listeners) listener();
  });
  expect(host.querySelector("[data-vigilia-zoom]")?.textContent).toBe("200%");

  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Zoom to fit"]')?.click());
  expect(zoomToFit).toHaveBeenCalled();
});
```

Import `type { ViewportManager }` from `../viewport-manager/index.js` in this test. `satisfies` rather than `as never` is deliberate: it is the only reason the missing-`onChange` failure surfaces in this task instead of in a later one.

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/zoom-readout.dom.test.tsx`
Expected: FAIL — module does not resolve.

- [x] **Step 3: Implement the readout**

A small control in the stage's corner showing `Math.round(zoom() * 100)%`, with a menu offering **Zoom to fit**, **Zoom to selection** and **100 %**. Use Base UI `Menu` as `shell-layout.tsx` already does for the menu bar.

The camera announces changes through the `onChange` subscription **Task 1 already declares on `ViewportManager`** — do not add the member here; the interface has one owner and it is Task 1's file. Task 1's implementation notifies subscribers after every `apply()`. The readout uses `useSyncExternalStore` over it, with the same caveat as everywhere else in this repo: `getSnapshot` must return a stable value for an unchanged camera, so return a primitive (the rounded percentage, or `zoom()` itself) rather than a fresh object, or the component re-renders forever. Re-render when the canvas is panned by a gesture or a wheel — a readout that only updates on menu actions would be wrong.

Task 1's `onChange` is what this readout hangs off, so **check it exists before writing the readout**: if Task 1 shipped without it, stop and report rather than adding it here.

**Read the current `ViewportManager` before writing the stub**, since Task 1's fixes and Task 5's later addition both land on that interface. Step 1's stub must satisfy whatever is there at the time — a `satisfies` that fails to compile is the intended outcome, and filling in a member the interface no longer has is not.

- [x] **Step 4: Run the test, then inspect it rendered**

Run: `npx vitest run packages/editor/src/editor-shell/zoom-readout.dom.test.tsx`
Expected: PASS.

Then rebuild, wheel-zoom in a real browser session, and confirm the readout tracks the zoom rather than staying at the fit value. A capture alone does not prove the tracking: the readout renders a plausible number at fit too. Pan with a space-drag and confirm the percentage is **unchanged** by the pan while the canvas visibly moves, then ctrl-wheel and confirm it changes — that pair is what distinguishes "tracking the camera" from "rendered once at mount".

Add a `docs/evidence/screenshots/README.md` row for the capture and register the corresponding test in `tests/e2e/editor.spec.ts`. **The e2e must be named in the Files list above**, and it must read the percentage through `window.vigiliaEditorBridge` rather than the canvas: Task 1 made `ViewportManager` the owner of zoom, so a test that reads `canvas.getZoom()` cannot detect a readout that stopped following the camera.

**Any pointer coordinate this test needs comes from the canvas, never a literal.** Task 5 adds the camera-derived shared helper (`artboardScreenRect`-based) for tests that need an *artboard* point; this task runs first and needs only "somewhere over the canvas", so the locator is the right and smaller source — and it is the idiom `editor.spec.ts:1828-1835` (`canvas.upper-canvas` locator at `:1829`) already uses:

**Citation note.** This task's own e2e case lands at `editor.spec.ts:1875-1922`. Anything in this
plan that read `:1829` or later when Task 4 was written is **+48** from that reading — the case was
inserted just above `reorders a layer`, which is the nearest case after it. Task 10's `:1995` is the
one affected citation and has been corrected; the `:1313` and `:1369-1370` readings sit above the
insertion and are unchanged.

```ts
await page
  .locator("#vigilia-fabric-editor canvas.upper-canvas")
  .hover({ position: { x: 200, y: 200 } });
// Control is required: a plain wheel PANS (see the navigation tests), so
// wheeling without the modifier asserts the opposite of the contract and can
// only pass by breaking it.
await page.keyboard.down("Control");
await page.mouse.wheel(0, -400);
await page.keyboard.up("Control");
```

A literal like `(640, 360)` is a page coordinate that no longer lands on the canvas now that the canvas is host-sized (measured x≈357–983, y≈72–666 at 1280×720). A wheel dispatched outside the canvas reaches nothing and the zoom never changes, so an assertion about the readout then either fails for an unrelated reason or — worse — passes against a readout that never updated.

- [x] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/zoom-readout.tsx \
  src/web/packages/editor/src/editor-shell/zoom-readout.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/ui-copy.ts \
  docs/evidence/screenshots/README.md src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): zoom readout with fit and 100% resets"
```

`bridge.ts` is **not** in this list: this task does not modify it. The camera is reached through the `editor.viewport` the interface already declares.

---

### Task 5: Reachable marquee

> **Landed** - `06655e6`.

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

- [x] **Step 1: Write the failing browser test**

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

- [x] **Step 2: Run it to verify it fails**

Run: `npx playwright test --project=desktop-chromium --grep "pasteboard drag marquees" --workers=1`
Expected: FAIL — an object's `left` changed, because the drag grabbed it.

- [x] **Step 3: Fix the cause**

`header-wash` is the object this drag grabs today. It is `rect("header-wash", 0, 0, 1280, 142, "#06101a70", 0)` (`new-fabric-theme.ts:331`) and **omits** the interaction argument, so it takes the helper's default and is selectable and evented. The artboard plate at `:328` passes `backgroundOnly` (`:15-19`), which already sets `selectable: false, evented: false` — so the plate is **not** the cause and needs no edit.

The fix is the one Task 2 already made — the canvas is no longer clamped to the artboard, so a point outside the artboard is now genuinely pasteboard — plus, if the drag still grabs `header-wash`, either `header-wash` passing `backgroundOnly` like the plate or its `evented: false`. **Decide from what Step 2 actually reports, and state which in the commit message.** The accessor work is a separate, mandatory part of this step: move `artboardScreenRect`'s maths onto the camera, delete the module-local copy at `editor-shell.ts:121`, and repoint the media call at `:375` (it moved from `:372`; the value is returned from `placeMedia`, which is the call to change).

Do not disable marquee, and do not add a manual hit-test. Fabric's own marquee is the owner.

**Do not solve the pasteboard drag by disarming `header-wash`.** `time-card` and every other card in the starter scene is already selectable and evented, and Step 1's vacuity guard drags `time-card` to prove the canvas still responds to pointer input. If the pasteboard drag only passes because `header-wash` became non-evented, the guard `expect(await read()).not.toEqual(before)` fails on the very next lines — Task 2's second e2e failure is exactly this case, where the drag resolved to the wrong object. Apply the `backgroundOnly` fix to `header-wash` only if Step 2 reports the *pointer landing inside the band*, and check the guard still passes afterwards.

- [x] **Step 4: Run it to verify it passes**

Run: `npx playwright test --project=desktop-chromium --grep "pasteboard drag marquees" --workers=1`
Expected: PASS. The inside-an-object case is **already the last block of the Step 1 test** (the vacuity guard) — do not add a second test for it, and do not weaken the pasteboard assertion to accommodate it.

Then verify the test has teeth: make the pasteboard drag start inside the `header-wash` band instead, and confirm the first assertion fails. Restore. A marquee test whose drag never reaches the canvas asserts nothing, which is the defect this rewrite exists to remove.

- [x] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell.ts \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/viewport-manager/index.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "fix(editor): make the pasteboard marquee reachable"
```

---

### Task 6: Keyboard nudge and z-order

> **Landed** - `a0a44ff + 49080b0 + aad9d5f`.

**Files:**
- Modify: `src/web/packages/editor/src/shortcut-manager/index.ts`
- Modify: `src/web/packages/editor/src/shortcut-manager/index.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-session.ts`
- Modify: `src/web/packages/editor/src/history-manager/index.test.ts`
- Modify: `src/web/tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `EditorInteraction` (`layerManager`, `historyManager`).
- Produces: new `ProductShortcutId` members `"canvas.nudge-left" | "canvas.nudge-right" | "canvas.nudge-up" | "canvas.nudge-down" | "canvas.select-all" | "canvas.front" | "canvas.back"`.

- [x] **Step 1: Write the failing test**

```ts
it("nudges on an arrow key and defers to a text field", () => {
  const manager = new ShortcutManager();
  const nudge = vi.fn();
  manager.register("canvas.nudge-left", nudge);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  expect(nudge).toHaveBeenCalledTimes(1);

  // Dispatched ON the input, not on `window`. `window.dispatchEvent` sets the
  // event's `target` to `window` itself, so `isTextEntryTarget(event.target)`
  // reads the window and the nudge fires a second time — the assertion below
  // could never hold, whatever the binding did. `bubbles: true` is what carries
  // it up to the window listener; this is the idiom every existing deferral
  // test in this file already uses (`:42`, `:61`, `:109`, `:139`).
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
  );
  expect(nudge).toHaveBeenCalledTimes(1);
  input.remove();
  manager.destroy();
});

it("routes both plain and shift+arrow to the same action", () => {
  const manager = new ShortcutManager();
  const nudge = vi.fn();
  // One id, one handler: the large step is the handler reading event.shiftKey,
  // not a second action id. `ShortcutHandler` takes no argument today, so the
  // shift step is the handler's own concern — Step 5 proves it in the browser.
  // The Produces union above is the authority on which ids exist.
  manager.register("canvas.nudge-left", nudge);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true }),
  );
  expect(nudge).toHaveBeenCalledTimes(2);
  manager.destroy();
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/shortcut-manager/index.dom.test.ts`
Expected: FAIL — `canvas.nudge-left` is not a known action.

- [x] **Step 3: Add the bindings**

**The `key` field is lower-case, and this is the step most likely to fail silently.** `bindingFor` lower-cases the event key and compares it to `binding.key` with `===` (`shortcut-manager/index.ts:40-47`), so every existing entry is lower-case (`"n"`, `"delete"`, `"backspace"`, `:24-35`). Write the arrow bindings as `"arrowleft"`, `"arrowright"`, `"arrowup"`, `"arrowdown"` — a binding written `"ArrowLeft"` matches nothing, and Task 3's browser test would have been the only thing to notice.

`]` and `[` have no case, so `"mod+]"`/`"mod+["` are written `{ key: "]", modifier: true, ... }` and `{ key: "[", modifier: true, ... }` as the existing table's shape requires.

Arrow keys are unmodified, so they already defer to text entry; verify that rather than assuming it — and note the deferral is on `event.target`, so it only works when the event actually originates at the field (see Step 1). `Shift`-qualified bindings must precede their plain forms, as the existing table's comment requires — but the nudge bindings need **no** `shift` field at all: `bindingFor` matches when `binding.shift === undefined`, so one `{ key: "arrowleft", modifier: false, action: "canvas.nudge-left" }` covers both the plain and the shifted press and the handler decides the step.

`ShortcutHandler` is `() => void` today (`shortcut-manager/index.ts:1`), so it cannot read `shiftKey`. Widen it to `(event: KeyboardEvent) => void` and pass the event in `#onKeyDown`; the existing handlers take no parameters and stay assignable unchanged. (The count is deliberately not stated — Task 3 and Task 6 each add registrations, and an earlier revision said "eleven" when the file already held eighteen.)

**`mod+a` must defer to text entry, and the existing mechanism does not cover it.** `mod+a` is modifier-qualified, and the deferral rule at `shortcut-manager/index.ts:66-69` only consults the deferred set for modifier bindings — a set that holds `file.new`, `edit.undo`, `edit.redo` and **not** this new action. Left alone, Ctrl+A would select every object on the canvas while the author is renaming a layer and expecting to select the text they just typed. Ctrl+A is not a product action while an editable field has focus; it is the field's own select-all.

**Note on the file's current state:** Task 3 already exported the element check in `shortcut-manager/index.ts` (declared `:94`; this read `:93`) as `isTextEntryTarget` so its keyboard zoom could reuse it. That export is the check on the **target**; the set below is the separate list of **action ids** that a modifier binding must be in to defer. Do not conflate them, and do not move the export back to private.

**Ruled: rename the constant to `MODIFIED_KEY_DEFERRED_ACTION_IDS` and add `canvas.select-all`.** The old name described only one of the two cases the predicate handles, which is why the gap was easy to miss. The rename is done — the constant is `MODIFIED_KEY_DEFERRED_ACTION_IDS`, holding `file.new`, `edit.undo`, `edit.redo`, `canvas.select-all` — so any later task referring to `TEXT_ENTRY_DEFERRED_ACTIONS` is reading a superseded revision of this plan; the unmodified-key half of the rule is the `!binding.modifier` branch and has no named set.

`edit.delete` is worse and is **not** this task's to fix, but do not make it worse: `delete` and `backspace` are unmodified and already defer, so they are fine. Adding a modifier variant of either without adding its id to the renamed set would silently delete the object behind a rename field.

Add `canvas.select-all` on `mod+a` and z-order on `mod+]` / `mod+[`. Register the handlers in `editor-session.ts` beside the existing `#shortcuts.register` calls. For z-order, call the same `layerManager` methods the bridge already maps for `front`/`back` (`bridge.ts:275`, `:280`) — do not reimplement ordering, and do not route through the bridge from the session. Those two already `save()` internally, so their handlers need no further history call:

```ts
this.#shortcuts.register("canvas.front", () => {
  options.shell.editor.layerManager.bringToFront();
});
this.#shortcuts.register("canvas.back", () => {
  options.shell.editor.layerManager.sendToBack();
});
```

**`canvas.select-all` and the four nudges need a sketch, because the obvious implementation is wrong in two places. Read `arrange.ts:19-42` first — it is the repo's own answer to both.**

**1. Selecting every object must not select the plate.** `canvas.getObjects()` returns the artboard plate too, and `artboardPlate` (`editor-shell.ts:139-156`) is `selectable: false, evented: false, excludeFromExport: true` — it is a background image, not a layer. Selecting it would put a non-selectable object in the selection and, on a nudge, move the artboard itself. Filter on `selectable`:

```ts
const selectableObjects = (): FabricObject[] =>
  canvas.getObjects().filter((object) => object.selectable === true);
```

`selectable === true` is an exact-match against the default. It is deliberately **not** the predicate `snap-manager`'s `isSnapTarget` uses: a snap target may be locked (locking prevents *moving* an object, not *aligning to* it), while a selection member may not, because Ctrl+A must not put a locked object into a selection the author can then drag. A locked object is `selectable: false` (`object-lock-manager/index.ts:14`), so this test excludes it. `ActiveSelection` of one object is not a selection, so guard `objects.length < 2` and return without touching history.

```ts
this.#shortcuts.register("canvas.select-all", () => {
  const objects = selectableObjects();
  if (objects.length < 2) return;
  canvas.discardActiveObject();
  canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
  canvas.requestRenderAll();
});
```

No `historyManager.saveState()` and no `object:modified`: selection is transient, never authored. §67 spells this out, and `selectLayer` (`bridge.ts:143-153`) is the existing precedent — it selects and notifies, and never saves.

**2. A nudge must move the objects, not the selection's own `left`/`top`.** `canvas.getActiveObject()` returns the `ActiveSelection` when several objects are selected, and setting `left`/`top` on it does translate its members — measured, `sel.set({left: sel.left + 1})` then `sel.setCoords()` moves both members by exactly 1 scene unit, because `ActiveSelection.set` converts the delta into each member's own transform. But it also leaves `sel.left` reading `26` for a selection whose members sit at 1 and 51 (Fabric's `left` is the group origin, not the bounding-box left), so a handler that nudges by reassigning `left` then reading it back drifts. Use the repo's own idiom instead: `object.setPositionByOrigin(new Point(x + dx, y + dy), "center", "center")` per object, exactly as `arrange.ts:143-151` does — and skip `locked` objects, which `arrange.ts:53` also refuses.

```ts
const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;

const nudge = (dx: number, dy: number): void => {
  const active = canvas.getActiveObject();
  if (active === undefined) return;
  const targets = (
    active instanceof ActiveSelection ? active.getObjects() : [active]
  ).filter((object) => object.get("locked") !== true);
  if (targets.length === 0) return;
  for (const object of targets) {
    const centre = object.getCenterPoint();
    object.setPositionByOrigin(
      new Point(centre.x + dx, centre.y + dy),
      "center",
      "center",
    );
    object.setCoords();
  }
  canvas.requestRenderAll();
  ...
};
```

`getCenterPoint()` is the **origin** point under `originX/originY` — Fabric returns `{x: left, y: top}` for a default object and only computes the true geometric centre when the origin is `"center"`. `arrange.ts` uses it exactly this way, paired with `setPositionByOrigin(..., "center", "center")`, and that pairing is what makes it correct: the read and the write must name the same origin. Do not "fix" it to a hand-computed centre; the pair is the idiom.

**This citation is about a nudge, not about `arrange.ts` — and `arrange.ts` is correct, so do not "fix" it either.** A later reader (and one reviewer, on Task 7) has twice taken this paragraph as evidence that `arrange.ts:144` has the same cross-plane bug Task 7 fixed in `canvas-nudge.ts`. It cannot: `applyArrange` returns `false` unless `active instanceof ActiveSelection` (`arrange.ts:24`) and `canArrange` repeats the guard at `:50`, and the only caller of `arrange.ts`'s private `move()` is `distribute()` over `active.getObjects()` — members Fabric has already detached from any group, so `object.group` is `undefined` and `getCenterPoint()` returns the same point as `getRelativeCenterPoint()`. The plane hazard needs a grouped child to exist at all, and no path into `arrange.ts` can produce one. `canvas-nudge.ts` was different because a nudge moves `canvas.getActiveObject()`, which Task 7 *can* make a grouped child.

Then the wiring, which is where the coalescing from the paragraphs below lands:

```ts
const nudgeBy = (dx: number, dy: number): void => {
  const active = canvas.getActiveObject();
  if (active === undefined) return;
  if (release === undefined) {
    release = input.editor.historyManager.suspend();
  }
  if (idle !== undefined) clearTimeout(idle);
  idle = window.setTimeout(endBurst, NUDGE_IDLE_MS);
  nudge(dx, dy);
  // Fired per press and deliberately NOT the thing that records history: it has
  // three other listeners that need it, and `save` is a no-op for the whole
  // burst because the suspension counter is still non-zero. `endBurst` is what
  // records the entry. Do not "simplify" this call away, and do not delete the
  // explicit saveState inside `endBurst`.
  canvas.fire("object:modified", { target: active });
};

// Four literal registrations, not a loop over a key map: `ProductShortcutId` is
// a closed union and a template literal is not assignable to it without a cast.
this.#shortcuts.register("canvas.nudge-left", (event) => {
  nudgeBy(-stepFor(event), 0);
});
this.#shortcuts.register("canvas.nudge-right", (event) => {
  nudgeBy(stepFor(event), 0);
});
this.#shortcuts.register("canvas.nudge-up", (event) => {
  nudgeBy(0, -stepFor(event));
});
this.#shortcuts.register("canvas.nudge-down", (event) => {
  nudgeBy(0, stepFor(event));
});
```

with

```ts
const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;
const NUDGE_IDLE_MS = 300;
const stepFor = (event: KeyboardEvent): number =>
  event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
```

**Return before suspending when there is nothing to move.** The `active === undefined` guard is above the `suspend()` call on purpose: suspending with no selection would open a burst that never records anything, and the next `saveState` from any other action would be swallowed into it. `deleteActive` and `arrange` both refuse on an empty selection the same way.

**`{ target: active }` is the payload Fabric itself sends** — `this.fire("object:modified", options)` where `options.target` is the transformed object (`index.mjs`, the `endCurrentTransform` path). `chart-manager`'s listener reads `event.target` and returns early unless it is a `VigiliaChart`, and `indicator-manager`'s reads the same field, so an empty payload would silently skip both.

Capturing `active` before the move rather than re-reading it after is a readability choice, not a correctness one: measured, moving the targets through `setPositionByOrigin` leaves `canvas.getActiveObject()` identical, so both orders give the same payload. Prefer naming the thing once.

Write the four `register` calls out rather than deriving the id by string concatenation — `ProductShortcutId` is a closed union and a template literal is not assignable to it without a cast, which the repo's `noUncheckedIndexedAccess`-strict style avoids. The loop above is a sketch of the *shape*; the four literal calls are the implementation.

**Declaration order:** `release`, `idle`, `endBurst` and `NUDGE_IDLE_MS = 300` are the block two paragraphs below. Put that block **above** `nudgeBy`, since `nudgeBy` closes over all four; the sketch order here is for reading, not for transcribing.

`nudgeBy` must call `endBurst` before the next `nudge`, or a burst that spans the idle boundary leaves the first `release` dangling — which is why `endBurst` clears `idle` and nulls `release` itself.

**Coalescing, precisely — and the suspend/resume pair alone does not produce an entry.** A burst of nudges must be one history entry. `HistoryManager.suspend()` is a **counter** (`history-manager/index.ts:41-49`), so it batches one *gesture*, not one idle window: suspend on the first nudge, resume on a short idle timeout (~300ms) or on any other action, whichever comes first.

**But `save()` early-returns while suspended, and nothing re-triggers it on release.** Read it: `save()` is `if (this.#suspended > 0) return;` (`:51-52`), and the two paths that could record the burst — `saveState` (`editor-shell.ts:232`) and the `object:modified` listener (`:222`) — are both that same function. So `suspend()` → nudge → fire `object:modified` → `release()` records **nothing**, and the burst never enters history. Step 5's `Control+z` assertion is the test that catches it, which is why it is there.

Record the entry **explicitly, after the release**, and in that order:

```ts
let release: (() => void) | undefined;
let idle: number | undefined;

/** The burst ends on the idle window or on any other action. Resuming before
 * saving is what makes the entry exist at all: `save()` is a no-op while the
 * suspension counter is non-zero. */
const endBurst = (): void => {
  if (idle !== undefined) clearTimeout(idle);
  idle = undefined;
  if (release === undefined) return;
  release();
  release = undefined;
  input.editor.historyManager.saveState();
};
```

**Still fire `object:modified` on each nudge** — it has three other listeners that need it (`chart-manager/index.ts:87` rerasterizes a scaled chart, `indicator-manager/index.ts:113,121` hides the angle and size indicators, `selection-inspector/index.ts:306` re-renders the fields). It simply cannot be the thing that records history here, because it is suppressed for the whole burst. Say that in a comment, or the next reader will "simplify" the explicit `saveState` away.

The alternative — fire `object:modified` and let it save, without suspending — gives one entry *per keypress*, so a ten-step nudge needs ten undos. That is the behaviour this paragraph exists to avoid.

- [x] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src/shortcut-manager`
Expected: PASS.

- [x] **Step 5: Verify in the browser**

```ts
test("nudges the selection and records one history entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  // Select through the bridge, not the layer row: a focused panel row is a
  // different starting state, and this test is about the nudge binding.
  await page.evaluate(() => {
    (window as unknown as { vigiliaEditorBridge: { selectLayer(id: string): void } })
      .vigiliaEditorBridge.selectLayer("header-wash");
  });
  const left = (): Promise<number | undefined> =>
    page.evaluate(() => {
      const b = (window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getObjects(): Array<{ id?: string; left?: number }> } };
        };
      }).vigiliaEditorBridge;
      return b.editor.canvas
        .getObjects()
        .find((object) => object.id === "header-wash")?.left;
    });
  const before = await left();
  // Playwright's `expect` has no `toBeTypeOf` — that is Vitest's matcher.
  expect(typeof before).toBe("number");
  await page.keyboard.press("ArrowRight");
  expect(await left()).toBe(before + 1);
  await page.keyboard.press("Shift+ArrowRight");
  expect(await left()).toBe(before + 1 + 10);

  // The burst only becomes a history entry when its idle window closes (300ms),
  // and Control+z before that finds nothing to undo — measured: the object stays
  // at `before + 11` and the undo is a silent no-op. Waiting past the window is
  // what makes the two assertions below measure coalescing rather than timing.
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+z");
  expect(await left()).toBe(before);
  // Both presses are one entry, so one redo must restore the *whole* burst. A
  // mechanism that recorded two entries would land at `before + 1` here.
  await page.keyboard.press("Control+y");
  expect(await left()).toBe(before + 11);

  const selectedCount = (): Promise<number> =>
    page.evaluate(() => {
      const b = (window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getActiveObjects(): unknown[] } };
        };
      }).vigiliaEditorBridge;
      return b.editor.canvas.getActiveObjects().length;
    });

  // Ctrl+A inside a text field belongs to the field, not to select-all. Focus
  // the layer rename input (Plan B Task 5) and confirm the selection is
  // untouched; without this the binding silently steals the field's own
  // select-all and the author's typed text is never selected.
  await page.locator('[data-vigilia-layer="header-wash"]').dblclick();
  const rename = page.locator('input[aria-label^="Rename"]');
  await expect(rename).toBeFocused();
  await rename.press("Control+a");
  expect(await selectedCount()).toBe(1);
});
```

Both helpers are defined **inside** the test, beside `left`; `page` is the only thing they close over, so they are test-local and not hoisted anywhere. Neither is imported.

Run: `npx playwright test --project=desktop-chromium --grep "nudges the selection" --workers=1`
Expected: PASS.

**Teeth check 1 — the coalescing, and which assertion actually has the teeth.** Make `endBurst` release *without* calling `saveState`, and run the browser test. Measured against the real `EditorHistory` with this exact shape, the two mechanisms diverge on the **redo** assertion, not the undo one:

| `endBurst` | after `Control+z` | after `Control+y` | e2e verdict |
|---|---|---|---|
| with the explicit `saveState` | `before` ✓ | `before + 11` ✓ | PASS |
| without it (the break) | `before` ✓ (passes) | `before + 11` ✓ (passes) | **PASS — the break is invisible** |

Without the explicit save the burst still produces an entry, because the **`Control+z` handler itself** calls `historyManager.undo()`, and Fabric's `reviveScene` re-drives the canvas, which fires `object:modified` → `save()` — no longer suspended by then, so it records the *current* position as an entry before stepping back. The single undo then lands on `before` anyway. So neither assertion in this test distinguishes the two mechanisms, and the explicit `saveState` is unproven by it.

**The unit test is what pins the mechanism, and it does not belong in the shortcut-manager file.** Put it in `src/web/packages/editor/src/history-manager/index.test.ts`, beside the existing "revives an earlier authored scene without saving the revive". That file is the mechanism's owner, it already has a `describe("EditorHistory")` block and the `EditorHistory` import, and it needs **no** `// @vitest-environment jsdom` — the probe below runs green in the default node environment. Add `src/web/packages/editor/src/history-manager/index.test.ts` to this task's **Files** list and to Step 6's `git add`. It drives `EditorHistory` directly and distinguishes the two mechanisms with no timing in it:

```ts
it("records one entry for a suspended burst, and none while suspended", async () => {
  let value = 0;
  const history = new EditorHistory({
    canvas: { fire: () => undefined } as never,
    serialize: () => ({ value }) as never,
    revive: async (_canvas, scene) => {
      value = (scene as { value: number }).value;
    },
  });
  history.reset();

  const release = history.suspend();
  value = 1;
  history.save(); // suppressed: the counter is non-zero
  release();
  history.save(); // the entry `endBurst` must produce

  value = 2;
  history.save();

  await history.undo();
  expect(value).toBe(1);
  await history.undo();
  expect(value).toBe(0); // straight past the burst: it is ONE entry
});
```

Both undos must step exactly one place. A mechanism that recorded per-press entries would need three undos to reach `0`. Run teeth check 1 against **this** test: delete the second `history.save()` and it must fail on the first `expect(value).toBe(1)` — measured, it fails with `expected +0 to be 1`, because the undo steps straight past the burst to `0`. Restore.

**Teeth check 2 — the deferral.** Remove `canvas.select-all` from the deferred set and confirm the Ctrl+A assertion fails. Restore.

**The idle window is a real race in the browser, and the `waitForTimeout(400)` above is what closes it.** A `Control+z` inside the 300ms window does nothing, because `release` has not run and no entry exists yet — measured: the object stays at `before + 11` and the undo is a silent no-op. Do not remove the wait on the grounds that the presses "usually" finish in time; a loaded CI machine is exactly where it will bite. Report the measured gap between the two presses.

The rename field's label is `` `${uiCopy.panels.rename} ${row.name}` `` (`layer-panel.tsx:229`, and `uiCopy.panels.rename` in `ui-copy.ts` — cite it by symbol, not by line: this file gains entries as the plan proceeds), so `input[aria-label^="Rename"]` matches. If Plan B Task 5 has been reordered after this task and the field does not exist, focus any inspector text field instead and say which you used.

**`page.keyboard.press("ArrowRight")` needs focus on the document, not on a form control.** `page.goto` leaves focus on `<body>`, which is what the window-level dispatcher needs. If the assertion `expect(await left()).toBe(before + 1)` fails while the unit tests pass, check whether an earlier interaction in this test focused something — the bridge call at the top does not, and the rename field is not focused until the Ctrl+A block near the end.

- [x] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/shortcut-manager \
  src/web/packages/editor/src/editor-session.ts \
  src/web/packages/editor/src/history-manager/index.test.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): keyboard nudge, z-order and select-all"
```

---

### Task 7: Group entry

> **Landed** - `fb3aa92 + 8292477`.

**Files:**
- Modify: `src/web/packages/editor/src/grouping-manager/index.ts`
- Create: `src/web/packages/editor/src/grouping-manager/group-entry.dom.test.ts`
- Modify: `src/web/packages/editor/src/canvas-nudge.ts` + `canvas-nudge.dom.test.ts` + `editor-session.dom.test.ts` (Step 3b — Task 6's latent plane bug)
- Modify: `src/web/packages/editor/src/editor-shell.ts` (Step 5 — the double-click binding)
- Modify: `src/web/packages/editor/src/shortcut-manager/index.ts` (`ProductShortcutId` + `CONTEXT_SHORTCUTS` — Step 5)
- Modify: `src/web/packages/editor/src/editor-session.ts` (Step 5 — the Escape handler)
- Modify: `src/web/tests/e2e/editor.spec.ts` (Step 6)

`editor-interaction.ts` is **not** edited: it only *consumes* `GroupingManager` (`:46`), so widening that
interface flows through it without a line changing there. An earlier revision listed it as "Modify", which
sends an implementer looking for an edit that does not exist — and the defect this replaced was worse:
`editor-shell.ts` was missing from both this block and Step 7's `git add`, so the file that actually binds
the event would have been left unstaged by a literal Step 7, committing a tree that does not compile.

**Interfaces:**
- Produces: `GroupingManager` gains
  ```ts
  enterGroup(options?: { readonly object?: FabricObject }): FabricObject | undefined;
  exitGroup(): readonly FabricObject[] | undefined;
  readonly groupContext: () => readonly FabricObject[];
  ```

- [x] **Step 1: Write the failing test**

```ts
it("enters a group and selects the child under the object", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ id: "child", width: 10, height: 10 });
  // `id` is not a `Partial<GroupProps>` key, so it needs `set` — the
  // constructor overload rejects it.
  const group = new Group([child]);
  group.set("id", "group");
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
  // Asserted on the flags themselves, so a failure names the mechanism rather
  // than only the symptom: Fabric retargets only when both are true.
  expect(group.subTargetCheck).toBe(true);
  expect(group.interactive).toBe(true);

  expect(manager.exitGroup()).toEqual([group]);
  expect(canvas.getActiveObject()).toBe(group);
  expect(manager.groupContext()).toEqual([]);
  expect(group.subTargetCheck).toBe(false);
  expect(group.interactive).toBe(false);
});
```

**The rule those assertions pin, stated once because the step is otherwise ambiguous.**
`enterGroup({ object })` sets the context to `[ownerGroup(object) ?? object]` and makes the active
object `object`; it does **not** push onto the context. That is why entering the group leaves the
context `[group]`, and why entering its child (`child`, whose owner is `group`) leaves the context
unchanged rather than making it `[group, child]` — so the single `exitGroup()` afterwards yields
`[]`, not `[group]`. Figma behaves this way: clicking a child inside an entered group selects the
child without deepening the context. `exitGroup()` returns the context **before** it popped
(`[group]` here) so a caller can restore a selection, and clears the through-selection flags as the
last two assertions show. An implementation that pushes instead fails the last three assertions
together — read them as the specification rather than adjusting them.

```ts
it("clears the context when the group is ungrouped", () => {
  // Step 3 says this guard "is asserted below" — it was not, in either this
  // test or Step 6, so the guard could be deleted with the suite green. This is
  // Review Focus item 4: a stale context re-selects a destroyed group.
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ id: "child", width: 10, height: 10 });
  // `id` is not a `Partial<GroupProps>` key, so it needs `set` — the
  // constructor overload rejects it.
  const group = new Group([child]);
  group.set("id", "group");
  canvas.add(group);
  canvas.setActiveObject(group);
  const manager = createGroupingManager({
    canvas, save: vi.fn(), suspend: () => () => undefined,
  });

  // `ungroup()` requires a Group to be active, so activate it before entering —
  // entering a group does not make it the canvas's active object.
  expect(manager.enterGroup({ object: child })).toBe(child);
  expect(manager.groupContext()).toEqual([group]);

  // `removeAll` normally bakes the transform into the children; this fixture's
  // child is plain geometry, so the members it returns are what matters.
  expect(manager.ungroup()).toEqual([child]);

  expect(manager.groupContext()).toEqual([]);
  // The real failure the guard prevents: an exit now would re-select a group
  // that is no longer on the canvas.
  expect(canvas.getObjects()).not.toContain(group);
  expect(manager.exitGroup()).toBeUndefined();
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/grouping-manager/group-entry.dom.test.ts`
Expected: FAIL — `manager.enterGroup is not a function`.

- [x] **Step 3: Implement entry and exit**

**`enterGroup` needs the pointer's scene point, not just the object.** Fabric hit-tests **before** your
handler runs, and a group is opaque to the pointer until `subTargetCheck`/`interactive` are set — so the
entering double-click's own `event.target` is always the **group**, never the child, and an implementation
that only armed the flags would need a *second* double-click to reach the child. Resolve the deepest target
from the event's `scenePoint` after arming, and take that as an optional `scenePoint` argument
(`enterGroup(options?: { object?: FabricObject; scenePoint?: Point })`). A Fabric scene point and a client
point are different planes; pass the scene point, and if you find yourself compensating with a canvas box
offset, stop — that is the mapping bug Task 10 exists to remove, not a thing to work around here.

`enterGroup` **records the ancestor path first, then** sets the child active — that order is required, not stylistic. Fabric's `setActiveObject` fires `selection:created` **synchronously**, the bridge subscribes to that event pair and calls `notify()`, and the layer store re-reads `bridge.layers()` on every notify. So the panel renders at the moment you set the active object, and if the context is recorded after, the tree renders once with the stale context and only corrects on the next unrelated notification — a one-notification-late tree that reads like a React batching bug. `exitGroup` pops one level and re-selects the group. Both record no history — group *context* is selection state, not authored content (§67), which is exactly why it is transient here rather than in the envelope. `ungroup()` must clear the context, or a later `exitGroup` re-selects a destroyed group. That is the Review Focus item, and it is asserted below.

Also add: `ungroup()` clears the context; `destroy`-time `stopGesture`-style cleanup is not needed since the context is plain state on the manager.

**`enterGroup({ object: child })` must also make the group selectable-through, and the plan previously never said so.** Fabric retargets a pointer inside a group to the child only when the group has **both** `subTargetCheck: true` and `interactive: true` — `searchPossibleTargets` requires `target.subTargetCheck` at `index.node.cjs:11246` to run the sub-search at all, and then `container.interactive` at `:11269` to adopt `subTargets[0]`. With either left at its default `false` the pointer keeps resolving to the group, Step 6's `expect.poll(...).toBe("child")` never settles, and a correct `enterGroup` fails its own browser test.

A flag at its **default** value is stripped from the document, so the pair is free while it is `false`. A flag set `true` **is** persisted — `persist.dom.test.ts`'s second case asserts the exact key list of a group constructed with them, and that list contains both — so a group left `true` at serialisation time carries editor state into a portable file. Setting them is safe only because you restore them: `enterGroup` sets them on the group it enters and remembers which ones it changed; `exitGroup` restores them. **A group already carrying them — a scene built by `createSceneAdapter` passes `subTargetCheck: false, interactive: false` explicitly (`fabric-nodes.ts:194-195`) — may be left alone and need not be restored.** The test above asserts the child is the resolved target, which is what pins this; assert the two flags directly too, so a failure names the mechanism rather than the symptom. Note also that `persist.dom.test.ts` builds its own fixtures rather than driving the editor, so its red is a serialiser red — the assertions in the test above are this task's guard on the gesture itself, and Step 4 says so.

**An earlier revision of this paragraph said the restore makes the pair safe, full stop. It does not — there is a third path out of an entered group, and it is the save.** Exit and undo both clear `flagsSet` before anything is serialised, but a save while the author is *inside* a group serialises the armed pair, because `Group.toObject` forces both keys into its output unconditionally (`fabric/dist/src/shapes/Group.mjs:375-384`) and `includeDefaultValues = false` (`persist.ts:58`) strips only keys whose value *equals its default* — both defaults are `false` (`Group.mjs:25-26`), so `true` survives. The reopened document then has a group that is permanently pointer-transparent, and a click inside it selects the child, bypassing the layer tree's own rule. `flagsSet` cannot help: it is transient and already empty when the serialiser runs.

The fix belongs in `persist.ts`, beside the existing `removeRuntimeText` walk: delete `subTargetCheck` and `interactive` from every object in the serialised tree. No type test is needed — Fabric forces those keys in only from `Group.toObject`, so delete-if-present cannot miss a nested group and cannot remove anything an author authored, because there is no way to author them: the grouping manager is the only writer (`grouping-manager/index.ts:54-63`, `:131-132`) and `fabric-nodes.ts:194-195` only seeds the default. **Do not instead clear the group context inside `shell.snapshot()`** — `snapshot` is a read path as well as a save path (`editor-session.ts:439`, `:466` return it from public methods), so that would silently drop an author out of their group when they merely read the envelope.

- [x] **Step 3b: Fix Task 6's nudge plane, which only this task can reach**

`canvas-nudge.ts`'s `nudge()` reads `object.getCenterPoint()` and writes `setPositionByOrigin(...)`. For a
**grouped child** those are different planes: `getCenterPoint()` returns the centre **relative to the
canvas**, mapped through the group's transform (`index.node.cjs:5473-5476`), while `setPositionByOrigin`
writes the object's **local** `left`/`top`. Fabric's own typings say it plainly —
`ObjectGeometry.d.ts:306` calls `getCenterPoint()` "relative to canvas" and `:311` calls
`getRelativeCenterPoint()` "relative to it's parent".

So `ArrowRight` on a child inside an entered group moves it by the group's centre minus its own, not by one
unit. Observed in this task's own Step 6: `Expected: 1, Received: 41` — the child jumping to `left: 41`
instead of `1`, with the assertion written one line away from the nudge, which is what makes it look like a
nudge bug rather than a coordinate-plane bug.

**Change `getCenterPoint()` to `getRelativeCenterPoint()` in `canvas-nudge.ts`, and rename the same member in
its two test doubles** (`canvas-nudge.dom.test.ts`, `editor-session.dom.test.ts`). The two are identical for
an ungrouped object, so Task 6's own tests stay green either way — which is exactly why the defect survived
that task. **Do not weaken Step 6's assertion to accept `41`**: the assertion is right and the code is wrong,
and a nudge that moves a grouped child by the group's offset is a real failure the user would see.

This is the third time this bug class has appeared in this plan's area — `A10` exists for the same scene-vs-
screen confusion in the e2e helpers — so name the plane in the code comment you leave behind.

- [x] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src/grouping-manager packages/scene-fabric/src/persist.dom.test.ts`
Expected: PASS. `persist.dom.test.ts` is the regression check on this: its second case arms a group and asserts the serialised key list contains no `subTargetCheck` or `interactive`, so it goes red if the strip in `persist.ts` is ever removed. It builds its own fixture rather than driving the editor, so it pins the serialiser's contract and not the gesture — the flag assertions in Step 3 are what hold the gesture side.

- [x] **Step 5: Wire double-click and Escape**

Bind double-click on the canvas to `enterGroup` with the pointer's target. `text-manager` already owns this event — `canvas.on("mouse:dblclick")` at `text-manager/index.ts:30` — and its handler returns early for any non-`IText` target, so a group double-click reaches your handler untouched. Two listeners on one event is correct here; do not take the event over.

**Re-apply the flags after every history restore.** Undo runs `reviveScene` → `loadFromJSON` (`scene-fabric/persist.ts:87-93`), which builds **new** Group instances with the flags back at their defaults — probed: the post-revive group is a different object, and the stale pre-undo instance has `canvas === undefined`. Hook the re-apply to `editor:history-state-loaded` (`history-manager/index.ts:75`), the same point `editor-shell.ts:334` already uses to restore the artboard plate, and restore the context's object references from the revived tree **by id** at the same time. Step 6's `childLeft` after `Control+z` and its Escape assertion are what prove both halves.

Escape goes through `ShortcutManager`, not a raw window listener: it is already the owner of window-level keys, and a second global keydown listener would both duplicate that owner and race it. Add `"view.exit-group"` to `ProductShortcutId`, add `{ key: "escape", modifier: false, action: "view.exit-group" }` to `CONTEXT_SHORTCUTS` — the array for bindings that are dispatched but never displayed, which is why this one belongs there and not in `PRODUCT_SHORTCUTS` — and register the handler in `editor-session.ts` beside the other `#shortcuts.register` calls.

**Escape defers to a focused text field for free, and do not add it to the deferred set.** `escape` carries no `modifier`, so the dispatcher's `!binding.modifier` branch already defers it whenever `isTextEntryTarget(event.target)` — which is what keeps Fabric's own in-place editing case owning its own Escape. Adding `view.exit-group` to `MODIFIED_KEY_DEFERRED_ACTION_IDS` would be wrong twice: the set is consulted only for modifier bindings, and membership would not change this binding's behaviour. An earlier revision said to register it with `TEXT_ENTRY_DEFERRED_ACTIONS`; that name is superseded (see Task 6's rename ruling) and the instruction was never needed. Confirm the deferral in the browser instead of asserting it in code.

- [x] **Step 6: Verify in the browser, including the undo case**

```ts
test("enters a group, steps back out, and survives an undo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  await setThemePackage(page, "grouping.vigilia-theme", {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "grouping",
    artboard: { width: 320, height: 180 },
    // A raw `fill` with no `vigiliaPaint` is rejected by the validator:
    // "fill must reference an existing palette token through vigiliaPaint."
    // Every fixture in this file declares the palette it paints from.
    globals: {
      palette: {
        none: { name: "None", value: { kind: "solid", color: "transparent" } },
        accent: { name: "Accent", value: { kind: "solid", color: "#00b8d9" } },
      },
    },
    scene: {
      version: "7.4.0",
      objects: [
        // `width`/`height` are load-bearing: without them the group revives 0x0,
        // its `aCoords` collapse to a single point, and the pointer never finds
        // a target — the gesture does not start at all.
        { type: "Group", id: "grp", left: 40, top: 40, width: 30, height: 30,
          objects: [
            { type: "Rect", id: "child", left: 0, top: 0, width: 30, height: 30,
              fill: "#00b8d9", vigiliaPaint: { fill: "palette.accent" },
              originX: "left", originY: "top" },
          ] },
        { type: "Rect", id: "outside", left: 240, top: 40, width: 30, height: 30,
          fill: "#00b8d9", vigiliaPaint: { fill: "palette.accent" },
          originX: "left", originY: "top" },
      ],
    },
  });
  await expect(page.locator("#status")).toHaveText("Opened grouping.vigilia-theme");

  // Points are derived from the camera, never from the canvas box: the canvas is
  // host-sized, so its box says nothing about where the artboard is.
  const rect = await page.evaluate(() => {
    const b = (window as unknown as {
      vigiliaEditorBridge: {
        editor: {
          viewport: {
            artboardScreenRect(): { left: number; top: number; width: number; height: number };
          };
        };
      };
    }).vigiliaEditorBridge;
    return b.editor.viewport.artboardScreenRect();
  });
  // `rect` is canvas-relative, so the canvas box offset is added here. Task 10
  // assembles this same pair into one `sceneToClient` helper; this test is the
  // first consumer and the local form is deliberate, not a second owner.
  const canvasBox = (await page
    .locator("#vigilia-fabric-editor canvas.upper-canvas")
    .boundingBox())!;
  const at = (x: number, y: number): [number, number] => [
    canvasBox.x + rect.left + (x / 320) * rect.width,
    canvasBox.y + rect.top + (y / 180) * rect.height,
  ];

  const state = (): Promise<{
    active: string | undefined;
    childLeft: number | undefined;
    groupPresent: boolean;
  }> =>
    page.evaluate(() => {
      const b = (window as unknown as {
        vigiliaEditorBridge: {
          editor: {
            canvas: {
              getActiveObject(): { id?: string } | undefined;
              getObjects(): Array<{
                id?: string;
                getObjects?(): Array<{ id?: string; left?: number }>;
              }>;
            };
          };
        };
      }).vigiliaEditorBridge;
      const canvas = b.editor.canvas;
      const group = canvas.getObjects().find((object) => object.id === "grp");
      return {
        active: canvas.getActiveObject()?.id,
        childLeft: group
          ?.getObjects?.()
          .find((object) => object.id === "child")?.left,
        groupPresent: group !== undefined,
      };
    });

  // Double-click inside the child: the pointer's target resolves to the child,
  // which becomes the active object while the group stays in the context.
  const [cx, cy] = at(55, 55);
  await page.mouse.dblclick(cx, cy);
  await expect.poll(async () => (await state()).active).toBe("child");

  const before = (await state()).childLeft;
  // Playwright's `expect` has no `toBeTypeOf` — that is Vitest's matcher.
  expect(typeof before).toBe("number");

  // Nudge (Task 6's binding), then undo it. The undo must not leave the context
  // pointing at a destroyed object.
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state()).childLeft).toBe((before ?? 0) + 1);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await state()).childLeft).toBe(before);

  // Escape is the assertion that survives the undo — but only if it reads
  // identity rather than id. Every read above is by `id`, and a revived object
  // keeps its `id`: a context still holding the *pre-undo* instance satisfies
  // `active === "grp"` just as well as a re-resolved one, and `groupPresent`
  // reads the revived canvas either way. Neither can tell the two apart.
  //
  // `exitGroup` is the one path that reads the group off the canvas, so assert
  // what it actually put there.
  const inCanvas = (): Promise<boolean> =>
    page.evaluate(() => {
      const b = (window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getActiveObject(): unknown; getObjects(): unknown[] } };
        };
      }).vigiliaEditorBridge;
      return b.editor.canvas
        .getObjects()
        .includes(b.editor.canvas.getActiveObject());
    });

  await page.keyboard.press("Escape");
  // For a one-object selection Fabric sets `activeObject` to that object, so
  // `setActiveObject(target)` makes `getActiveObject() === target`. Identity is
  // therefore readable here, and is the only thing that separates a live group
  // from the destroyed instance.
  await expect.poll(inCanvas).toBe(true);
  await expect.poll(async () => (await state()).active).toBe("grp");
  expect((await state()).groupPresent).toBe(true);
});
```

Run: `npx playwright test --project=desktop-chromium --grep "enters a group" --workers=1`
Expected: PASS. Then run two teeth checks and restore after each:

1. Drop the post-restore re-apply from Step 5 and confirm the `inCanvas` poll fails. **Verify this one by actually breaking it.** An earlier revision named the `Control+z` step as the witness, and that step cannot witness it: `childLeft` is a property of an object the *scene* rebuilt, so it equals `before` whether or not the context was re-resolved, and the id-only `active`/`groupPresent` reads are equally blind. The identity check is the only assertion above that separates a re-resolved group from the destroyed one.
2. Remove the context-clearing in `ungroup()` and confirm the unit test's final `expect(manager.exitGroup()).toBeUndefined()` fails. **The undo case above is not the witness for this one** — this e2e test never calls `ungroup()`, so a change confined to `ungroup` cannot redden it, and an implementer told to break `ungroup` and watch this test fail would conclude a correct fix was ineffective.

**The undo case is the one that matters and the unit test above cannot reach it**, because only the browser path goes through real history restore — a restored scene builds *new* Fabric objects, so a context holding the pre-undo instances points at objects that are no longer on the canvas. That is Review Focus item 4.

- [x] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/grouping-manager \
  src/web/packages/editor/src/canvas-nudge.ts \
  src/web/packages/editor/src/canvas-nudge.dom.test.ts \
  src/web/packages/editor/src/editor-session.dom.test.ts \
  src/web/packages/editor/src/editor-shell.ts \
  src/web/packages/editor/src/shortcut-manager \
  src/web/packages/editor/src/editor-session.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): enter and exit a group from the canvas"
```

---

### Task 8: The layer tree follows the group context

> **Landed** - `da5f0b2 + f5109c9`.

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.ts`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `GroupingManager.groupContext()` (Task 7), `LayerPanel` (UI-polish plan Task 5). **This task depends on the UI-polish plan.**

- [x] **Step 1: Write the failing test**

```tsx
it("marks the group whose children are current and dims the rest", async () => {
  // Two groups, so the negative half of the assertion has a row to read. The
  // non-current group is what makes this a test of "dims the rest" rather than
  // of "sets an attribute somewhere".
  const rows = [
    { id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false },
    { id: "child", name: "Child", kind: "text", depth: 1, parentId: "group",
      hasChildren: false, visible: true, locked: false, selected: true },
    { id: "other", name: "Other", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false },
  ];
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <LayerPanel bridge={bridge(rows, { groupContext: () => ["group"] })} />,
  ));
  expect(host.querySelector('[data-vigilia-layer="group"]')?.getAttribute("data-context")).toBe("true");
  expect(host.querySelector('[data-vigilia-layer="other"]')?.getAttribute("data-context")).toBe("false");
  // The child inside the current context is selectable in its own right — the
  // half of the branch that Step 3 adds, and the reason the context is marked.
  expect(host.querySelector('[data-vigilia-layer="child"]')?.getAttribute("data-context")).toBe("true");
});
```

`bridge(rows, overrides)` is the existing helper (`layer-panel.dom.test.tsx:9`); it spreads
`...overrides` before its closing `as EditorShellBridge`, so passing `groupContext` here compiles
once Step 3 declares the member and fails at runtime with a missing attribute until then — which
is the failure this step expects.

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
Expected: FAIL — no `data-context` attribute.

- [x] **Step 3: Reflect the context**

Add `groupContext(): readonly string[]` to `EditorShellBridge` (ids, not objects — the projection rule holds).

Two distinct `groupContext` signatures meet here, and the step must not blur them: `GroupingManager.groupContext(): readonly FabricObject[]` from Task 7 returns **objects**, and the bridge's returns **ids**. Derive the bridge's by mapping each object to its `id`, and only for objects that have one — an anonymous object has no row to mark. The projection rule (`docs/architecture/ownership.md`) is why the bridge cannot simply forward the manager's array.

**The panel updates itself; no new wiring is needed, and do not add a listener pair for it.** Task 7's `enterGroup` calls `canvas.setActiveObject(child)` (Task 7 Step 3), and Fabric's `setActiveObject` fires `selection:created` **synchronously** (`index.node.cjs:11456-11460`, via `_fireSelectionEvents`) — which the bridge already subscribes to, to `notify()` (`bridge.ts:77-79` defines `notify`, and `:85` is the `canvas.on(event, notify)` registration; the range `:74-79` this cited is the `createEditorShellBridge` signature into `notify`, not the subscription). `LayerStore.set`'s subscription re-reads `bridge.layers()` on every notify (`layer-panel.tsx:41-45`; this read `:42-45`, which is the same body — the read is at `:42` and the subscribe callback at `:43-45`). So one entry is enough, and because the store caches the projection rather than rebuilding it per `getSnapshot` (`layer-panel.tsx:28-31` states the reason, `:34` holds the cached `#rows` field and `:67` is the `get` that returns it), reading `groupContext()` inside `layers()` is safe.

**What that does mean is that Task 7's ordering is load-bearing here.** `enterGroup` must record the context **before** it changes the active object: `setActiveObject` notifies the panel synchronously, so a context recorded afterwards is one render late, and Task 8's own browser check sees a tree that has not yet marked the group. If Task 7 shipped with the record after the selection change, fix it there — do not compensate in the panel with a second notification, which would make two owners of "when the tree is stale".

Mark `data-context="true"` on **every row inside the current context, not only the group row**: the entered group itself *and* its descendants, since entering a group is precisely what makes its children individually selectable. The step above asserts `"true"` on `group` *and* on `child`, so a rule that marked only the group row would fail the test the same step specifies. Rows outside the context get `data-context="false"` and a muted style — **and with no group entered the attribute is omitted rather than written `"false"`, which the stylesheet section below explains at length because getting it wrong dims the whole tree.**

Because the tree can now select a group's children directly, the old "selection resolves a child through its owning group" behaviour is no longer the only path: keep it for a canvas click, but let a tree click on a child select the child itself when its group is the current context.

**The muted style is a stylesheet rule, not an inline style.** `data-context` is already on the row, so `editor-shell.css` owns the declaration next to `.vigilia-layer-row`:

```css
/* Only an entered group dims anything: with no context every row is reachable,
   and the rows would carry the attribute with the misleading value. */
.vigilia-layer-row[data-context="false"] {
  opacity: 0.45;
}
```

`layer-panel.tsx` gets **no** `opacity` in its `style` object. Its existing inline entries (`"--layer-depth"` and the `paddingLeft` that dereferences it) are values *handed to* CSS, with the declaration itself in `editor-shell.css:483`; an `opacity` declaration there would be a second owner of the visual language.

**The guard lives in the attribute expression, not in a helper.** With no group entered `context.has(row.id)` is `false` for every row, and React renders a boolean `data-*` as the **string** `"false"` rather than dropping it. A bare `[data-context="false"]` rule would therefore dim the entire tree the moment the editor opens with nothing entered — and with nothing entered every top-level layer *is* selectable, so that would assert the opposite of the truth. The fix is to omit the attribute when there is no context, which makes the rule match nothing:

```tsx
data-context={context.size > 0 ? context.has(row.id) : undefined}
```

**This replaces the earlier `dimmed()` helper entirely — do not keep one.** The first revision of this step kept a JS helper (`context.size > 0 && !context.has(id)`) driving an inline `opacity`. Once the declaration moves to the stylesheet, a helper that computes the same predicate is a second owner of "which rows are dimmed", and the only thing it can do is disagree with the rule. Putting the condition in the attribute expression means the rule and the attribute cannot drift: an omitted attribute is the single fact both read.

**Both halves need a test, and the existing one covers only the attribute.** The muted style has no assertion anywhere — deleting the declaration leaves the suite green — so the fix must add one. In jsdom the stylesheet is not applied (vitest does not process the `editor-main.ts` CSS import), so the jsdom half pins the *attribute* that the rule keys on, and the browser half pins the *rendering*.

The empty-context case asserts **`null`**, not `"false"`:

```tsx
it("dims nothing when no group is entered", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <LayerPanel bridge={bridge(contextRows, { groupContext: () => [] })} />,
  ));
  for (const row of host.querySelectorAll(".vigilia-layer-row"))
    expect(row.getAttribute("data-context")).toBeNull();
});
```

**A note for anyone who reads the review instead of this plan:** the task review called the `context.size > 0` guard "redundant once the rule is CSS" and suggested dropping it. That is wrong here — but the reasoning is subtle enough to be worth stating, because the review's own fix is *nearly* right. An absent attribute genuinely matches nothing, so the review is correct that the *rule* needs no guard; what it missed is that a guard must still exist to keep the attribute from being written. Deleting the condition without moving it into the attribute expression produces the dimmed-on-open tree. The condition, not the rule, is what moved.

In `tests/e2e/editor.spec.ts`, extend Task 7's committed "enters a group, steps back out, and survives an undo" case rather than writing a new spec: it already carries the `grouping.vigilia-theme` fixture and the camera-mapped `at(x, y)`. After it enters the group, assert on its existing rows that the entered group's row and its child read `data-context="true"`, an outside row reads `"false"`, and the outside row's computed `opacity` is `"0.45"` while the child's is **`"1"`** — the computed value, not the attribute, is what proves the stylesheet rule actually selects the row, and the child's positive assertion is what stops a rule that dimmed every row from passing. **This file is single-occupancy**: the UI-polish plan's Task 9 (B9) and this plan's Tasks 7 and 10 all edit it, so dispatch this fix only when no other implementer holds it.

**That conditional is a real branch in `selectLayer`, and the existing test already pins the other half.** `bridge.dom.test.ts:212-217` asserts `selectLayer("child")` calls `setActiveObject(group)` — the owning group — and Task 5's `bridgeFor` widened the canvas stub, so that assertion is live. The new branch must therefore be *only* "the child's group is the current context", leaving the group resolution in place for every other case; a bare "select the child" rewrite turns that existing test red for the right reason. Note also that `selectLayer` resolves through `ownerOf(root, id)` (`bridge.ts:150`; this read `:144`, which is `const root = canvas.getObjects();` — the same function, three lines above the call), whose first parameter is root and whose only caller here passes `canvas.getObjects()` — not the object form.

- [x] **Step 4: Run the tests and inspect**

Run: `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
Expected: PASS. Then rebuild, enter a group in the browser, and confirm in the capture that the tree shows the context and the child is selectable.

- [x] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/layer-panel.tsx \
  src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/bridge.ts \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/tests/e2e/editor.spec.ts
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
- Modify: `src/web/tests/e2e/editor.spec.ts` (Step 4 — the menu's capture)
- Modify: `docs/evidence/screenshots/README.md` (Step 4 — its registry row)

**Interfaces:**
- Consumes: `OBJECT_ACTIONS`, `actionEnabled` (UI-polish plan Tasks 1–2); `EditorShellBridge`.
- Consumes: **this plan's Task 10 helpers** — `sceneToClient(page, sceneWidth, x, y)` and
  `clientOfScene(page, id, sceneWidth)`, added at file scope in `editor.spec.ts`. This task runs **after**
  Task 10, whose whole deliverable was deleting box-relative scene→client mappings for this spec file. A new
  capture test that hand-rolls `box.x + (180 / 1280) * box.width` reintroduces exactly that defect, one task
  after it was removed, and it would land *after* Task 10's grep-derived sweep. Use the helper.
- Produces: nothing consumed by later tasks. **This task depends on the UI-polish plan.**

`arrangeActions` is deliberately **not** consumed. The UI-polish plan rules that arrange moves to the stage toolbar, which that plan's Task 7 owns, and this menu renders the same `OBJECT_ACTIONS` list the dock renders — that shared list is the property Step 1's test pins. Reaching for `arrangeActions` here would put arrange in two surfaces and make the two lists disagree.

**Landed mechanism, measured 2026-09-25/26. Do not re-derive this; the steps it
replaces were wrong.**

- **No `ContextMenu.Trigger`.** Fabric binds its own `contextmenu` listener on
  `upperCanvasEl` and calls `preventDefault` + `stopPropagation`. A Trigger
  wrapping the canvas is a parent listener, so Fabric's `stopPropagation` starves
  it: measured, zero `menuitem`s. A listener registered **on `upperCanvasEl`
  itself** is a same-element listener and is *not* blocked by the earlier one's
  `stopPropagation` — measured, both fire in order.
- Open the menu from that listener with a **controlled** `ContextMenu.Root`
  (`open` / `onOpenChange`) plus `Portal` and a `Positioner` given a **virtual
  anchor** (`{ getBoundingClientRect: () => point }`) at the pointer, not an
  element. Measured: the popup renders at the anchor. `ContextMenu.Positioner`
  requires a `Portal` ancestor — rendering it without one throws.
- The menu kind follows the object **under the pointer**, not the current
  selection: Fabric's `__onMouseDown` returns early for `button !== 0`, so a
  right-click never clears or changes the selection. Use the canvas's own
  `findTarget(event)` and select a hit before opening, or `actionEnabled` gates
  the entries against whatever was selected before.
- In jsdom the portal lands in `document.body`, not the render host, and wrapping
  an **anchored** positioner's render in `act()` times out — floating-ui's
  measurement never settles. Query `document.body` and flush with macrotasks.
- **A Base UI popup in jsdom costs ~35 s per open without two selector stubs.**
  Floating-ui's `isTopLayer()` calls `matches(':popover-open')` and
  `matches(':modal')` while positioning; jsdom's nwsapi cannot answer either and
  spends ~0.45-1.05 s per call, with `matches` entered roughly 72 M times. Stub
  both to `false` on `Element.prototype.matches` in the DOM test's `beforeAll`,
  preserving the original for every other selector. Nothing here is specific to
  the context menu: any Base UI popup stalls identically.

**The oracle rule.** Derive the expected entry set from the registry's own
predicate — `OBJECT_ACTIONS.filter((action) => action.eligible(target)).map((action) => action.label)` —
and **never** from `actionEnabled(gate, id)`. `actionEnabled` is the function the
menu itself calls, so deriving through it makes the assertion self-referential: a
menu that ignored the registry and rendered the same wrong list would still pass.
Assert the expected set's length too, or the comparison passes on a menu that
rendered nothing.

**Arrow keys: no code change, and that is a measured result.** `PRODUCT_SHORTCUTS`
binds the bare arrows to `canvas.nudge-*` and `ShortcutManager.#onKeyDown` never
consults `event.defaultPrevented`, so an open menu and a nudge looked like they
would collide. Measured in Chromium: Base UI already stops ArrowDown and Escape
while the menu is open, so the object does not move and `ShortcutManager` is
untouched. The browser test must carry a **control** proving the nudge still fires
once the menu closes, or "it did not move" is vacuous.

- [x] **Step 1: Write the failing test**

Landed as `canvas-context-menu.dom.test.tsx`, four cases. The test shape the earlier
draft specified here cannot work and is not what shipped: it rendered through
`act()`, read `host.querySelectorAll('[role="menuitem"]')`, and took `open` / `at`
as props. All three are wrong for a portalled, anchored popup — see the mechanism
block above. What shipped instead builds a partial `EditorShellBridge` double,
dispatches a real bubbling `contextmenu` `MouseEvent` at `upperCanvasEl`, flushes
with macrotasks rather than `act`, and queries `document.body`.

The first case pins the oracle rule above: the expected label set comes from
`action.eligible(target)`, its length is asserted so a menu that rendered nothing
cannot pass, and `setActiveObject` is asserted against the hit object because a
right-click selects nothing on its own. The others cover dispatch through
`bridge.run`, the five creation entries on empty canvas with no registry entry
among them, and the inert case before a document mounts a bridge.

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx`
Expected: FAIL — module does not resolve.

- [x] **Step 3: Implement the menu**

Superseded. Landed as `canvas-context-menu.tsx`; the measured mechanism above is
what the file implements. The earlier text here prescribed a `ContextMenu.Trigger`
and a hand-rolled scene-to-client mapping, and both are wrong: the Trigger never
opens, and `clientOfScene` is the mapping's only owner.

- [x] **Step 4: Run the tests, then inspect**

Landed. Four DOM cases run green in ~3.6 s with the two selector stubs. The
browser case is `captures the canvas context menu over a selected object` in
`editor.spec.ts`, right-clicking through `clientOfScene(page, "load-gauge")` after
`selectStarterChart(page)` so it cannot silently open the empty-canvas menu, and
asserting the `Duplicate` entry is visible before capturing. Its capture is
registered in `docs/evidence/screenshots/README.md`'s `Editor mechanics` row as
`editor-canvas-context-menu`.

- [x] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/canvas-context-menu.tsx \
  src/web/packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/ui-copy.ts \
  src/web/tests/e2e/editor.spec.ts \
  docs/evidence/screenshots/README.md \
  docs/evidence/screenshots/editor-canvas-context-menu-desktop-chromium.png
git commit -m "feat(editor): canvas context menu from the action registry"
```

**Stage the capture by name, never `docs/evidence/screenshots` as a directory** — it holds roughly forty PNGs
owned by other tasks and another plan, and it currently carries a modified `editor-desktop-chromium.png` that no
task here owns. If the capture file is absent, the capture step did not run: check `VIGILIA_CAPTURE=1` was set
and the grep reported a non-zero test count rather than exiting zero having run nothing.

---

### Task 10: Snapping and indicators at non-1 zoom

> **Landed** - `b206070 + a20d0de`.

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

- [x] **Step 1: Repair the box-relative mapping, and add the helpers the repointed sites use**

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

- [x] **Step 2: Pin the guide zoom arithmetic**

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

- [x] **Step 3: Pin that the indicators are zoom-independent**

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

- [x] **Step 4: Pin that the spacing pass is painted under the same transform and width**

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

### Task 11: Full gate

> **The remaining task.** Tasks 1-10 are landed; this gate closes the plan.

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

**Five `display-fabric.spec.ts` cases are known-slow, not known-failing.**
Measured in two ledgers this session at 30.2-47.7 s against Playwright's 30 s
default; each passes with an explicit longer timeout. Report true counts, change no
timeout, and do not label a red test pre-existing without a base-commit run proving
it. The earlier draft's "no known-failing tests" claim predates that measurement
and is replaced by this one. Both tests this plan previously named as pre-existing phone-chromium failures were measured and **both pass**:

```
npx playwright test --project=phone-chromium --grep "keeps repainting as samples arrive" --workers=1
  ✓ 1 passed (32.4s)
npx playwright test --project=phone-chromium --grep "is byte-stable at a fixed clock" --workers=1
  ✓ 1 passed (32.9s)
```

The two editor drag tests Task 2 turned red (`persists an ordinary drag and restores it through undo`, `rehydrates a chart runtime after undo`) are Task 10's deliverable and must be **green** by the time this task runs. If any test is red here, report it as a finding with its output — do not classify it as pre-existing without a base-commit run proving it.

- [ ] **Step 3: Confirm the player is untouched**

The player consumes `scene-fabric`, never editor UI or the camera. Confirm `npm run size` shows no player bundle growth and that nothing under `packages/player` imports from `viewport-manager` or `editor-shell`.

- [ ] **Step 4: Inspect each acceptance item**

Open, in the editor, and record what each shows: the artboard centred with pasteboard visible; a zoomed view with a correct readout; a marquee drag selecting without moving; a context menu matching the dock; a group entered with the tree showing the context. Each is a visible outcome and each needs the rendered check, not an object count.

`captureVisualReview` returns immediately unless `VIGILIA_CAPTURE` is set, so running the spec files with `--grep` produces no image. Three of the five have registered names — `editor-zoom-readout` (the zoom readout), `editor-toolbar` (the dock, whose entry set the menu must match) and `editor-canvas-context-menu` (the menu itself, added by Task 9) — so re-run those three captures under the gate:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --workers=1 \
  --grep "tracks the camera's zoom|captures the canvas dock|captures the canvas context menu"
```

That third capture is also the direct evidence for "a context menu matching the dock": the dock image and the menu image show the object entries each surface offers for one selection, and comparing them is the check — no rendered-browser test pins the two surfaces against each other.

In PowerShell the same call needs the pattern single-quoted — `--grep 'tracks the camera''s zoom|captures the canvas dock|captures the canvas context menu'` — or the `|` is read as a pipe (AGENTS.md's known trap). Use the Bash tool if that is simpler.

The centred artboard-and-pasteboard view, the marquee and the group entry have no registered name; inspect those by hand. Run the host (`node packages/host/bin/vigilia.js`, built first) and perform each gesture rather than inventing a capture title in the last commit — a screenshot the gate did not ask for and the README does not register is not evidence.

- [ ] **Step 5: Update STATUS.md**

Replace "Last completed change" with a 1–5 bullet summary, update "Next" and "Blockers / unverified", then run `npm run status:check`.

- [ ] **Step 6: Commit**

```bash
git add STATUS.md
git commit -m "docs(status): record the editor viewport and mechanics"
```

---

## Self-Review

**State at handoff (2026-09-26).** Tasks 1-8 and 10 are landed and marked above with
their commits, including every fix round. Task 9 landed as `199bb71` — its steps were
rewritten rather than marked, because the design they specified could not work and the
measured mechanism that replaced it is the load-bearing part. **Task 11 is the only
open task**, and its six steps are the only unticked boxes in this file. One review
item is still unverified by anyone but the implementing agent: `ShortcutManager` is
unchanged on the strength of a Chromium measurement, and Task 11's rendered inspection
is what corroborates it.

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

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N". Task 2's media-alignment check names the behaviour to assert rather than reproducing a full fixture, because the assertion is stated exactly. Task 10 Step 3 deliberately says "fix only what the inspection shows" — the spec makes a claim about existing code and the task exists to test it, so inventing a fix before the inspection would violate §33.

**Corrected by a later read-through:** Task 10's browser step referred to "the one Step 0's mapping fix also uses", and there was no Step 0 — the mapping fix (the repair of two tests Task 2 turned red) was written as prose in Task 10's preamble with no step and no test, while Step 2 already consumed a helper that step was supposed to create. It is now Task 10 **Step 1**, and Task 10's steps are numbered 1-4. An earlier revision of this note also defended Task 7 Step 6 and Task 10 Step 1 as "naming the behaviour to assert rather than reproducing a full fixture". Both were in fact `await page.goto(EDITOR)` followed by a comment and no assertion — a test that passes forever and reads as coverage. Both have since been written in full. Where a browser step is genuinely better left to the executor's judgment, the plan says so in that step; "the assertion is stated exactly" was not true of either.

**Type consistency:** `ViewportManager`'s method set is identical in Tasks 1, 3, 4, 10. `GroupingManager.enterGroup`/`exitGroup`/`groupContext` are the same in Tasks 7 and 8. `actionEnabled(bridge, id)` is defined once in the UI-polish plan and called by both the dock and the context menu in Task 9. `ProductShortcutId` members added in Task 6 are the ones registered in `editor-session.ts`.

**Review Focus coverage:** item 1 → Task 1 Step 1 and Step 5, Task 3 Step 6; item 2 → Task 1 Step 6 (the point-stays-fixed test); item 3 → Task 5 Step 1; item 4 → Task 7 Step 6; item 5 → Task 9 Step 1.

**Cross-plan dependency:** Tasks 8 and 9 require the UI-polish plan's registry and layer panel. Marked in their Interfaces blocks. If both plans run in one branch, execute the UI-polish plan's Tasks 1–6 first; if they run separately, Tasks 1–7 and 10–11 here stand alone.

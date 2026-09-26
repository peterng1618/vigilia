### Task 4: The zoom readout

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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/zoom-readout.dom.test.tsx`
Expected: FAIL — module does not resolve.

- [ ] **Step 3: Implement the readout**

A small control in the stage's corner showing `Math.round(zoom() * 100)%`, with a menu offering **Zoom to fit**, **Zoom to selection** and **100 %**. Use Base UI `Menu` as `shell-layout.tsx` already does for the menu bar.

The camera announces changes through the `onChange` subscription **Task 1 already declares on `ViewportManager`** — do not add the member here; the interface has one owner and it is Task 1's file. Task 1's implementation notifies subscribers after every `apply()`. The readout uses `useSyncExternalStore` over it, with the same caveat as everywhere else in this repo: `getSnapshot` must return a stable value for an unchanged camera, so return a primitive (the rounded percentage, or `zoom()` itself) rather than a fresh object, or the component re-renders forever. Re-render when the canvas is panned by a gesture or a wheel — a readout that only updates on menu actions would be wrong.

Task 1's `onChange` is what this readout hangs off, so **check it exists before writing the readout**: if Task 1 shipped without it, stop and report rather than adding it here.

**Read the current `ViewportManager` before writing the stub**, since Task 1's fixes and Task 5's later addition both land on that interface. Step 1's stub must satisfy whatever is there at the time — a `satisfies` that fails to compile is the intended outcome, and filling in a member the interface no longer has is not.

- [ ] **Step 4: Run the test, then inspect it rendered**

Run: `npx vitest run packages/editor/src/editor-shell/zoom-readout.dom.test.tsx`
Expected: PASS.

Then rebuild, wheel-zoom in a real browser session, and confirm the readout tracks the zoom rather than staying at the fit value. A capture alone does not prove the tracking: the readout renders a plausible number at fit too. Pan with a space-drag and confirm the percentage is **unchanged** by the pan while the canvas visibly moves, then ctrl-wheel and confirm it changes — that pair is what distinguishes "tracking the camera" from "rendered once at mount".

Add a `docs/evidence/screenshots/README.md` row for the capture and register the corresponding test in `tests/e2e/editor.spec.ts`. **The e2e must be named in the Files list above**, and it must read the percentage through `window.vigiliaEditorBridge` rather than the canvas: Task 1 made `ViewportManager` the owner of zoom, so a test that reads `canvas.getZoom()` cannot detect a readout that stopped following the camera.

**Any pointer coordinate this test needs comes from the canvas, never a literal.** Task 5 adds the camera-derived shared helper (`artboardScreenRect`-based) for tests that need an *artboard* point; this task runs first and needs only "somewhere over the canvas", so the locator is the right and smaller source — and it is the idiom `editor.spec.ts:1829-1835` already uses:

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

`bridge.ts` is **not** in this list: this task does not modify it. The camera is reached through the `editor.viewport` the interface already declares.

---


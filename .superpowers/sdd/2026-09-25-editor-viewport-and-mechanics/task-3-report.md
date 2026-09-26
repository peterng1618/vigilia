# Task 3 report — Navigation gestures

## What changed, per file

### `src/web/packages/editor/src/viewport-manager/navigation.ts` (new)

`bindViewportNavigation({ canvas, viewport })` returns the unbind function. Six
gestures, all routed through `ViewportManager` so the camera stays the only
writer of `viewportTransform`:

- `wheel` (no modifier) -> `panBy(0, -deltaY)`; `shift+wheel` -> `panBy(-deltaY, 0)`.
- `ctrl`/`meta` + `wheel` -> `zoomToPoint(canvas.getViewportPoint(event), zoom * exp(-deltaY/1000))`.
  Exponential, so a notched mouse and a trackpad (whose `deltaY` differ by an
  order of magnitude) feel the same. Every wheel path calls `preventDefault()`.
- Space held + left-drag, and middle-drag (button 1), both pan by the pointer
  delta.
- `+`/`=` -> `zoomBy(1.1)`; `-` -> `zoomBy(1/1.1)`; `shift+1` (key `"!"`) ->
  `zoomToFit()`. `zoomBy` is Task 1's host-centre zoom, so no new centre point is
  invented here.

Two departures from the brief's sketch, both deliberate:

1. **A pan claims the canvas through Fabric, not just a cursor.** Space-drag and
   middle-drag set `canvas.skipTargetFind = true` and `canvas.selection = false`
   for the gesture and restore both on release. Without this, a space-drag that
   starts over an object hands the press to Fabric's own transform path and moves
   authored content instead of the camera. The brief only asked for
   `defaultCursor = "grab"`; the cursor alone does not stop the drag.
2. **The cursor is written through `canvas.defaultCursor` and `canvas.setCursor`,
   not `upperCanvasEl.style`.** Fabric re-applies `defaultCursor` on every
   `_onMouseMove`, so a value written straight to the element is overwritten the
   moment the pointer moves (measured in the browser: `grabbing` collapsed back to
   `grab` mid-drag). Setting Fabric's own hover value is the fix.

Guards, all three of which fail a test when removed:

- Camera keys defer through `isTextEntryTarget` (imported, not copied) on both
  `event.target` and `document.activeElement`.
- Space is left to a focused control that activates on it (`<button>`, or
  `role` in button/checkbox/menuitem/radio/switch/tab) — see the defect below.
- `blur` clears the space hold and releases the claim, so a lost keyup cannot
  wedge the editor in pan mode.

### `src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts` (new)

Nine tests. The brief's eight (wheel pan, shifted wheel, ctrl-wheel zoom,
space-drag, middle-drag, unbind, text-entry deferral, keyboard zoom direction)
plus one for the Space-on-a-button guard. Additions to the brief's text:

- A **second** `mousemove` on both drag tests asserting the second delta. The
  brief's single-move assertions pass even if the handler never updates its
  anchor, i.e. if every move measured from the press point.
- `skipTargetFind` and `defaultCursor` assertions around the space-drag
  (claim, active cursor, restore).
- `defaultPrevented === false` on the deferred keys, so a guard that swallowed
  the keystroke instead of passing it through would fail.
- The keyboard-zoom test asserts the *direction* (`zoomBy` arg > 1 / < 1), not
  just that `zoomBy` was called.

### `src/web/packages/editor/src/shortcut-manager/index.ts` (modified)

One token: `isTextEntryTarget` gained `export`. Comment extended to name the
second caller. No behavioural change; its four existing tests still pass.

### `src/web/packages/editor/src/editor-shell.ts` (modified)

`bindViewportNavigation({ canvas, viewport })` is called in `createNativeEditor`
right after the camera is created; the returned unbind runs in `destroy` before
`viewport.destroy()` and `canvas.dispose()`.

### `src/web/tests/e2e/editor.spec.ts` (modified)

Added `zooms and pans the canvas, and cannot lose the artboard` inside the
existing `describe`. Two changes from the brief's text:

- The transform is read through `window.vigiliaEditorBridge.editor.canvas`
  instead of the `vigilia-fabric-editor*` debug-key scan. The brief's own Step 6
  comment says the debug key is the wrong owner; the scan would also read
  whichever editor mounted first, so the clamp assertion could have been made
  against a stale canvas.
- `expect(atLimit.length).toBe(2)` added, so an empty `slice(4, 6)` cannot make
  the final `toEqual` pass vacuously.

## TDD evidence

Red run before implementation (`npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts`):

```
Error: Failed to resolve import "./navigation.js" from "packages/editor/src/viewport-manager/navigation.dom.test.ts"
 Test Files  1 failed (1)
      Tests  no tests
```

Green after implementation: 9 passed (9).

## Revert-and-confirm teeth checks

Every check below was run against the final test file, with the break reverted
immediately after.

| Break | Result | Exact assertion |
|---|---|---|
| Wheel handler zooms unconditionally (`if (true \|\| ctrlKey \|\| metaKey)`) | **2 failed**, exactly the first two | `AssertionError: expected "vi.fn()" to be called with arguments: [ +0, -100 ]` (test 1); `[ -100, +0 ]` (test 2) |
| Text-entry deferral removed from the keydown handler | **1 failed** | `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 3 times` |
| Space-on-a-button guard removed | **1 failed** | `AssertionError: expected true to be false` (`event.defaultPrevented`) |
| `claim()` stops setting `skipTargetFind` | **1 failed** | `AssertionError: expected false to be true` |
| Drag anchor never updated (`lastX = clientX + 7`) | **2 failed** | `AssertionError: expected 2nd "vi.fn()" call to have been called with [ 15, 15 ]` (both drag tests) |
| Zoom factor forced to 1 in `navigation.ts` (browser) | **1 failed** | `expect(received).toBeGreaterThan(expected)` — `Expected: > 0.4890625 / Received: 0.4890625` |
| `Control` released for the wheel (browser, modifier branch) | **1 failed** | same assertion, `Expected: > 0.4890625 / Received: 0.4890625` |
| `clampPan` widened to ±1e12 (browser, clamp-saturation) | **1 failed** | `expect(received).toEqual(expected) // deep equality` on `expect(await translate()).toEqual(atLimit)` |

## Test results

- `npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts` — 9 passed.
- `npm test` (unit, whole workspace) — **122 files, 1298 tests, all passed.**
  The only noise is the pre-existing `couldn't load font "Old 400px", falling
  back to "Sans 400px", expect ugly output` from Fabric's jsdom canvas, unrelated
  to this task.
- `npx playwright test --project=desktop-chromium tests/e2e/editor.spec.ts --workers=1`
  — **36 passed, 2 failed.** The two failures are exactly
  `persists an ordinary drag and restores it through undo` and
  `rehydrates a chart runtime after undo`, the known-red pair Task 10 owns. No
  other test in the file regressed.
- `npm run typecheck` — clean (exit 0).
- `npm run format:check`, `npm run lint` — clean.
- `npm run status:check` — exit 0, STATUS.md 55 lines.

## Browser inspection (not object counts)

`vite preview` on `packages/editor`, Chromium 1280x720, driving the real page:

```
fit 0.4890625 -> ctrl+wheel 0.7296 -> "=" 0.8026 -> "-" 0.7296 -> shift+1 0.4890625
cursor on space: "grab" -> dragging: "grabbing" -> released: "move"
typing "-" and "=" into a focused input: zoom unchanged (0.4890625), field value "=-"
```

- Screenshot after a space-drag: the dashboard is visibly shifted inside the
  grey pasteboard, i.e. the camera moved and the content did not.
- Middle-drag: `viewportTransform.slice(4,6)` moved `[60, 163.4] -> [120, 143.4]`
  for a 60x40 pointer move, and `selectedCount` stayed 0 (a middle-drag over an
  object pans rather than selecting it).
- Selection still works after both pan kinds: `snapshot().selectedCount` is 1
  after a plain click on a card, after a space-drag, and after a middle-drag.
  This is the check that the claim is actually released.
- Space on a focused `View` button opens its menu again after the guard fix.

## Found but not fixed

1. **Space on a focused toolbar button was broken by the pan claim, and is now
   fixed in this task.** The first implementation called `preventDefault()` on
   every bare Space keydown, which stopped `<button>` activation by keyboard.
   Measured in the browser before the fix: `spaceOnFocusedViewButtonOpensMenu
   false`; after: `true`. `activatesOnSpace` is the guard. It is a defect this
   task introduced and closed, reported here because the brief did not name it.
2. **Pre-existing menu toggle quirk, not mine.** Clicking the `View` menu button
   three times in a row yields menu item counts `0, 3, 0` — the first click
   appears to be consumed. Reproduces with plain `click()` and no Space or
   keyboard involvement, so it is not caused by the new key handler. The menus
   belong to Spec B (Task 6 / the action registry), so I did not touch it.
3. **The `.superpowers/` and `docs/superpowers/plans|specs` files were already
   modified in the working tree** when this task started (`git status` at
   session start). They are not part of this task and were left untouched and
   unstaged.
4. **Nothing tells the author what the zoom is.** Expected: Task 4 owns the zoom
   readout.

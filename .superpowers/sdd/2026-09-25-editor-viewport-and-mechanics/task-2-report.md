# Task 2 report — the canvas becomes a viewport

Status: **DONE_WITH_CONCERNS** (see "Unverified" — two e2e drag tests fail on
coordinate mapping and belong to Task 5's file).

## What changed per file

### `src/web/packages/editor/src/editor-shell.ts`

- `createNativeEditor` creates the canvas at the **host's** measured size
  (`Math.max(1, host.clientWidth)` × `clientHeight`), no longer the artboard's.
  Its `artboard: Artboard` parameter became unused and was dropped, along with
  the argument at the call site.
- Builds the camera with `createViewportManager({ canvas, host, artboard: () => input.artboard() })`,
  returns it, and `destroy` calls `viewport.destroy()`.
- `fitCanvasViewport` deleted entirely; `fitArtboardViewport` and its
  canvas/container dimension writes deleted. Nothing writes
  `viewportTransform` except the camera module.
- The `ResizeObserver` only calls `editor.viewport.resize()` (and its `let` is at
  `mountEditorShell` scope, because `catch` and `destroy` both reference it).
- `setArtboard` and `setFitMode` call `editor.viewport.zoomToFit()`; `setFitMode`
  lost its now-unused parameter.
- `container` keeps `position: absolute; inset: 0` and drops `margin: auto`.
- Initial framing is `editor.viewport.zoomToFit()` after the paint is applied.

Two defects were found and fixed here (both outside the brief's prediction, both
required for the acceptance inspection):

**1. The artboard paint covered the pasteboard.** `canvas.backgroundColor` with
Fabric's default `backgroundVpt: true` never bounds the fill:
`_renderBackgroundOrOverlay` walks a path for the whole canvas rect, then applies
the CTM *before* `ctx.fill()`, and a post-path transform does not clip a fill.
Proved with a direct browser probe (build path → set `fillStyle` →
`ctx.transform(0.5,0,0,0.5,25,25)` → `fill()`), which returned `255,0,0,255` at
(5,5), (30,30), (50,50) and (95,95). Pre-Task-2 the canvas was exactly the
artboard, so the bug could not exist; at viewport size it paints over everything.
Replaced with `artboardPlate()` — a bounded `Rect` at (0,0) carrying the
artboard's own paint, assigned to `canvas.backgroundImage`, with
`excludeFromExport: true` (the authored paint belongs to the envelope's artboard,
so the scene must not carry a second copy), and
`selectable/evented/hasControls/hasBorders` false. It is not in `getObjects()`
(no layer-tree row) and not in the serialized scene. The adapter's
`canvas.backgroundColor` is cleared after the plan applies, last.
A `clipPath` was rejected: it would hide the objects outside the artboard too.

**2. The plate was lost on undo.** `loadFromJSON` calls `this.clear()` (firing
`canvas:cleared`) and *then* `this.set(serialized)` / `this.set(enlivedMap)`, so a
`canvas:cleared` rebuild is overwritten by the serialized background. Switched to
`editor:history-state-loaded` (fired by `EditorHistory.#restore` after revive).
Live probe confirmed the plate survives both undo and redo.

`artboardScreenRect()` + `placeMedia()` (the background-media coupling) — see
below.

### `src/web/packages/editor/src/editor-interaction.ts`

`EditorInteraction` gains `readonly viewport: ViewportManager` — the camera is
the single writer of the canvas's viewport transform, and product panels read
zoom through it.

### `src/web/packages/editor/src/editor-shell.dom.test.ts`

Appended the brief's test verbatim as
`it("exposes a camera over the mounted canvas", ...)`. The `getContext` proxy
`beforeEach` is intact.

### `src/web/packages/editor/src/editor-shell/editor-shell.css`

**No change made.** Verified the only canvas-sizing rules are
`.editor-shell-stage #canvas-host { position: absolute; inset: 0 }` and
`.editor-shell-stage #vigilia-fabric-editor { width: 100%; height: 100% }`. There
is no rule sizing the canvas to the artboard, so the brief's "remove any rule
that sizes the canvas to the artboard" had nothing to remove. The brief lists the
file as modified; it ended up untouched, and Step 6's `git add` on it is a no-op.

## TDD evidence

Red — parent `editor-shell.ts` (`git show HEAD:...`) with the new test in place:

```
failed exposes a camera over the mounted canvas
TypeError: Cannot read properties of undefined (reading 'zoom')
    at D:/git-repos/vigilia/src/web/packages/editor/src/editor-shell.dom.test.ts:221:34
suites 2 passed 6 failed 1
```

Green — focused:

```
suites 2 passed 7 failed 0
```

Green — brief's Step 4 scope:

```
suites 109 passed 303 failed 0
```

## Teeth check

Attempt 1 had **no teeth**: disabling only `canvas.setDimensions(viewport)` in
`viewport-manager/index.ts::resize()` still passed 7/7, because
`createNativeEditor` already creates the canvas host-sized, so `resize()`'s
`setDimensions` is redundant for the assertion. Reported rather than hidden.

Attempt 2 — that break plus restoring the pre-Task-2 artboard sizing in
`new Canvas(...)`:

```
failed exposes a camera over the mounted canvas
AssertionError: expected 1280 to be 1000 // Object.is equality
    at D:/git-repos/vigilia/src/web/packages/editor/src/editor-shell.dom.test.ts:224:44
suites 2 passed 6 failed 1
```

Both breaks reverted; re-ran green (7 passed);
`git status src/web/packages/editor/src/viewport-manager/` clean.

## Existing tests updated

**None.** The brief predicted "existing tests that assert an artboard-sized canvas
(for example a `fitCanvasViewport` unit test)". Grepped `src`, `docs` and
`.superpowers`: there is no unit test for `fitCanvasViewport` or
`fitArtboardViewport` — every reference is plan/spec/SDD prose. The six
pre-existing `editor-shell.dom.test.ts` cases stub the host at
`clientWidth: 400, clientHeight: 300` and assert behaviour independent of canvas
dimensions (text mechanics, window exposure, history, crop, layer names), so all
six pass unchanged. Nothing pinned the old behaviour, so nothing needed changing.

## Background-media coupling (the one real coupling)

`mountBackgroundMedia` prepends a layer to `container` with
`position: absolute; inset: 0` and a `setBounds({left,top,width,height})` API.
Under the old artboard-sized canvas, `inset: 0` on a canvas-sized container *was*
the artboard rect. With a viewport-sized container, `inset: 0` is the whole host,
so the media would have stretched to the stage and drifted off the board.

Fix: `artboardScreenRect(canvas, artboard)` reads the camera transform
(`left = vpt[4]`, `top = vpt[5]`, `width = artboard.width * vpt[0]`,
`height = artboard.height * vpt[0]`), and `placeMedia()` feeds it to
`media.setBounds(...)`. It is subscribed with
`editor.viewport.onChange(placeMedia)` and called after mount, after
`setArtboard` and after `setBackgroundMedia`. Note the subscription is registered
*after* `let media = ...`: `zoomToFit()` notifies synchronously, and registering
earlier threw `ReferenceError: Cannot access 'media' before initialization` in
all seven tests.

Measured: the media layer/img rect is `{l:357, t:194, w:626, h:352}`, exactly
`vpt [0.489, 0, 0, 0.489, 0, 120.438]` applied to a 1280×720 board.

## Capture inspected

`docs/evidence/screenshots/editor-desktop-chromium.png`, regenerated via the
brief's Step 5 command (`npm run build`, then `VIGILIA_CAPTURE=1 npx playwright
test --project=desktop-chromium --grep "captures the mounted editor for visual
review" --workers=1`), and sampled with `System.Drawing`:

- Artboard plate fill `10,23,38`; bbox x[357..982] y[193..522] → 626×352, ratio
  1.78 = the 1280×720 artboard's own ratio.
- `626 / 1280 = 0.48906` — exactly the camera's fit scale. The plate is the
  artboard at the camera's zoom, centred in the stage.
- Pasteboard above, below and beside the plate reads `0,0,0` (the bar colour),
  distinct from the plate's `10,23,38`. **Pasteboard is visible around the board
  again** — the acceptance condition.
- The plate's left edge column shows the authored gradient (`20,38,58` at the
  edges vs `10,23,38` in the body), so the gradient survived the move from
  `backgroundColor` to a `Rect`.
- The `authors a packaged background image through Theme settings` capture was
  also regenerated and opened; the media layer sits on the board.

## Unverified / concerns

1. **Two `tests/e2e/editor.spec.ts` drag tests fail** — full spec run 2 failed,
   35 passed:
   - `persists an ordinary drag and restores it through undo` —
     `Expected: > 100, Received: 40`.
   - `rehydrates a chart runtime after undo` —
     `Expected: > 432, Received: 432`.

   Both map fixed artboard coordinates through the canvas bounding box
   (`point(76, 66) = { x: box.x + (76/320)*box.width, ... }`, and
   `432/1280 * box.width`). The canvas is no longer the artboard's size, so `box`
   is now the stage, not the board: the drags land in the pasteboard and grab
   nothing, leaving the object's `left` unchanged. This is coordinate remapping,
   not a regression in drag behaviour — the `40` and `432` are the untouched
   original values. `editor.spec.ts` is **Task 5's** file (its `Files:` list, and
   its Step 3 says the fix is "the one Task 2 already made"), and Task 2 Step 6
   does not stage it, so I did not edit it. Flagged rather than silently fixed.
2. `editor-shell/editor-shell.css` needed no change, so the commit touches four
   files, not five.
3. The regenerated captures are left **unstaged**: Task 2 Step 6 does not stage
   `docs/evidence/screenshots`, and Task 10 stages that directory (`git add
   ... docs/evidence/screenshots`). They will therefore be swept into a later
   commit under an unrelated message unless staged deliberately.
4. No browser-level check of media alignment beyond the rect probe above and
   opening the two regenerated captures; I did not zoom in the browser and
   re-confirm alignment at a non-fit zoom.

# Task 5 report: Reachable marquee

Commit: `06655e6` fix(editor): make the pasteboard marquee reachable

## What I implemented

1. **`ViewportManager.artboardScreenRect()`** — the one owner of "where the
   artboard draws, in canvas-element coordinates". The maths is the module-local
   `artboardScreenRect(canvas, artboard)` moved verbatim off `editor-shell.ts`
   (built from `canvas.viewportTransform`: `left = vpt[4]`, `top = vpt[5]`,
   `width/height = artboard * vpt[0]`). The local copy is deleted and the
   background-media call site is repointed at `editor.viewport.artboardScreenRect()`;
   nothing at that call site else changed, per the brief.

2. **The e2e** — `a pasteboard drag marquees instead of moving an object`, added
   above `reorders a layer` (Task 4's insertion point convention).

3. **Fix the cause: nothing needed disarming.** The marquee was already
   reachable on this tree. Step 2's measured result (below) shows the drag
   creating an `ActiveSelection` of 26 objects, so `header-wash` kept its
   interaction flags and the artboard plate was untouched. Per the brief's
   conditional — "Apply the `backgroundOnly` fix to `header-wash` **only if**
   Step 2 reports the pointer landing inside the band" — Step 2 reported no such
   thing, so no `new-fabric-theme.ts` edit was made.

4. **Two stub updates** required by the widened `ViewportManager` interface
   (`zoom-readout.dom.test.tsx`, `navigation.dom.test.ts`). These are `satisfies`
   stubs, so a missing member is a compile error, not a silent pass; they now
   carry a no-op `artboardScreenRect`.

5. **Two unit tests** on the accessor: the canvas-relative frame at a contain-fit
   (proving `left` is 0 and `top` is the letterbox band, i.e. *not* client
   coordinates), and that a pan moves the rect with the transform.

## What I tested, commands, measured results

### Measured drag numbers (the point of this task)

Instrumented one run of the test with a `console.log` of the values, then removed
the log. Raw output:

```
MEASURED {"rect":{"left":0,"top":120.4375,"width":626,"height":352.125},
          "canvasBox":{"x":357,"y":73.1875,"width":626,"height":593},
          "start":[670,650.1875],"end":[405.90625,291.4375]}
ACTIVE   {"type":"activeselection","count":26,"left":640.5}
```

Reading these:

- `rect` = `{left: 0, top: 120.4375, width: 626, height: 352.125}`. This is
  **canvas-element-relative**, as the brief ruled: `left` is `0`, not the page's
  `x≈357`. Scale is `626/1280 = 0.489`, the contain-fit; `top` is the 121px
  letterbox band. Confirms the ruling against the "client coordinates" wording
  the brief corrected.
- Canvas box (client): `x 357, y 73.1875, w 626, h 593`.
- Offsets added once each: `+357` on X, `+73.1875` on Y (via `canvasBox.x/y`).
- Press (`start`) = `(670, 650.1875)` client — horizontally centred, 16px above
  the canvas bottom, i.e. in the pasteboard band below the artboard
  (artboard bottom edge in client space is `73.1875 + 120.4375 + 352.125 = 545.75`;
  `650 > 545.75`, and `650 < 73.1875 + 593 = 666.1875`). Both guards hold.
- Release (`end`) = `(405.9, 291.4)` client, derived from artboard point `(100, 200)`.
- Result: an `ActiveSelection` of **26** objects; every object's world rect
  unchanged (`background` 0,0; `wordmark` 54; `time-card` 52,150; … unchanged
  before and after). No object moved; the marquee ran.
- Vacuity guard: press at artboard `(70, 450)` (inside `time-card`, 52,150 260x330)
  then `+40/+30` moved `time-card` and its children — world rects changed.

### Cross-check that the drag reached the canvas

The brief's `read()` compares raw object `left`. That is the wrong instrument and
produced a false red (see "Self-review findings"). Measured world rects before
and after the pasteboard drag, via `getBoundingRect`, are identical for all 46
objects, and 26 of them became selection members. The published test compares
those.

### Teeth checks (brief Step 4 + the off-canvas class)

All three were run, confirmed red, then restored; the restored test is green.

1. **Drop the canvas offsets** (`sx = canvasBox.width / 2`, no `+canvasBox.x`):
   **FAIL** — `expect(received).toBeGreaterThan(expected) / Expected: > 357 /
   Received: 313`. The X guard fires.
2. **Start the drag inside the `header-wash` band** (`sy = canvasBox.y + rect.top
   + 40 * scale`) with the Y guard bypassed: **FAIL** on the first assertion —
   `header-wash` world rect `0,0` → `-541,0`. Confirms the marquee would grab
   `header-wash` if the press landed in its band, and that the pasteboard press
   is what avoids it.
3. **Off-canvas drag** (`sx,sy = canvasBox.x - 400, canvasBox.y - 400`) with all
   three guards bypassed: **FAIL** — `Expected: > 0 / Received: 0`. Only the
   `selected` assertion caught it; the rects comparison **passed**, which is
   precisely the vacuity the brief warns about. Detail below.

## TDD Evidence

### RED (Step 2)

Command:
```
npx playwright test --project=desktop-chromium --grep "pasteboard drag marquees" --workers=1
```
(bundle rebuilt first: `npm run build -w @vigilia/editor`)

Failing output, read from `test-results/summary.json` (a hook rewrites stdout):
```
SPEC: a pasteboard drag marquees instead of moving an object | status: failed
 Error: page.evaluate: TypeError: bridge.editor.viewport.artboardScreenRect is not a function
```
Expected: the accessor does not exist yet — that is the first thing the test
consumes, so this is the correct first failure.

Second RED, after the accessor existed but before the e2e's instrument was
corrected — the raw-`left` comparison:
```
- Expected - 26   + Received + 26
  Array [ "time-card",  - 52,   + -588.5 ]
  Array [ "time",       - 78,   + -562.5 ]
  ... 24 more
```

### GREEN (Step 4)

```
✓ 1 [desktop-chromium] › tests\e2e\editor.spec.ts:1931:3 › Fabric editor route ›
  a pasteboard drag marquees instead of moving an object (1.8s)
1 passed (5.3s)
```

### Full editor spec (regression check)

```
2 failed
  [desktop-chromium] › editor.spec.ts:1313:3 › persists an ordinary drag and restores it through undo
  [desktop-chromium] › editor.spec.ts:1407:3 › rehydrates a chart runtime after undo
40 passed (49.4s)
```
Both failures are the two pre-existing ones the brief names. Verified pre-existing
by stashing all six of my source files, rebuilding, and re-running just those two
on the pristine tree — they failed identically (`Expected: > 100 / Received: 40`
and `Expected: > 432 / Received: 432`), then restored.

## Gates (raw)

```
=== typecheck ===   (npm run typecheck — all workspaces)
> @vigilia/host@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
(no errors; every workspace emitted only its banner)

=== lint ===        (npm run lint)
Checked 317 files in 501ms. No fixes applied.

=== format:check === (npm run format:check)
Checked 317 files in 126ms. No fixes applied.

=== focused unit === (npx vitest run packages/editor/src/viewport-manager
                       packages/editor/src/editor-shell packages/editor/src/editor-shell.dom.test.ts)
Test Files  10 passed (10)
     Tests  92 passed (92)

=== status:check === (npm run status:check)
(no output; exit 0)
```

## Files changed

- `src/web/packages/editor/src/viewport-manager/index.ts` — `artboardScreenRect`
  on the interface and the implementation.
- `src/web/packages/editor/src/editor-shell.ts` — local copy deleted;
  `placeMedia` calls the camera (`+1 −13`).
- `src/web/packages/editor/src/viewport-manager/viewport.test.ts` — two tests.
- `src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts` — stub member.
- `src/web/packages/editor/src/editor-shell/zoom-readout.dom.test.tsx` — stub member.
- `src/web/tests/e2e/editor.spec.ts` — the new test.
- `STATUS.md` — "Last completed change" replaced (AGENTS.md requires this per commit).

## Self-review findings

**1. The brief's `read()` is a broken instrument — this is the substantive finding.**

The brief's `read()` returns `[id, object.left]`. A marquee press does not merely
select: Fabric's `ActiveSelection.enterGroup` **rebases every hit child's `left`**
to be relative to the selection. Measured: after the pasteboard drag, 26 objects'
`left` moved by a uniform `−640.5` while their world positions were unchanged
(`getBoundingRect` identical before and after). So:

- `expect(await read()).toEqual(before)` fails on a working marquee — a false red,
  which is what the second RED above shows.
- Worse, the brief's stated assertion intent ("nothing moved") is only measurable
  in world space. Using `left` cannot distinguish "a marquee selected things" from
  "a drag moved things", which is the exact discrimination the test exists to make.

I changed `read()` to `getBoundingRect` (world-space, correct under either
mechanism) plus a `selected` count. The guards, the derivation through
`artboardScreenRect`, the `canvasBox` offsets, the press/release points and the
`time-card` vacuity guard are all as the brief specified.

**2. The brief's assertion has a vacuity hole, and I closed it rather than ship it.**

The brief's comment says an off-canvas drag "selects nothing and the test passes
vacuously while claiming to prove the marquee works", and calls the `canvasBox`
offsets "the whole difference between this and a vacuous test". Measured, that is
not sufficient: teeth check 3 shows **all three guards bypassed + an off-canvas
drag still passes the rects comparison** (nothing moved), and only the added
`selected > 0` line goes red. The offsets make the drag *land* where intended, but
nothing in the brief's assertion set verifies the drag *did* anything. Since the
task's stated purpose is "remove the vacuity class", I added
`expect(before.selected).toBe(0)` / `expect((await read()).selected).toBeGreaterThan(0)`.
It is one assertion, it is the one that has teeth for this failure mode, and teeth
check 3 is its evidence.

**3. Scope/ruling compliance.**

- The accessor is canvas-element-relative, per the ruling; the unit test pins that
  (`left` is 0, not 357). No `getBoundingClientRect` in the accessor.
- No "fix" was applied to satisfy the media layer; the media call site is
  unchanged except for the call target, and container-relative coincides with
  canvas-relative as the brief states.
- Fabric's own marquee is the owner; no manual hit test, no `selection = false`.
- `new-fabric-theme.ts` was **not** touched — Step 2 measured the pointer landing
  in the pasteboard, not in the `header-wash` band, so the brief's conditional fix
  does not apply. Stated in the commit message.

**4. Judge ask: `editor-shell.css` was in the brief's Files list; I made no change
to it.** The brief's prose gives exactly one CSS-relevant reason to touch anything
— "the covering rect remains and must be dealt with" — and the intended fix for
that is disarming `header-wash`, which lives in `new-fabric-theme.ts`, not CSS. The
only CSS relevant to marquee reachability is the
`.editor-shell-stage #vigilia-fabric-editor { width/height: 100% }` rule, which
predates this plan (added in `78c8bc3`), so it is not a Task 2/4 artifact to
extend. Since Step 2 showed the marquee already works and Step 4's guards hold, I
found no defensible CSS change and made none rather than inventing one. Flagging it
explicitly because the brief lists the file.

## Issues / concerns

1. **The two pre-existing e2e failures** (`persists an ordinary drag…` at
   `editor.spec.ts:1313`, `rehydrates a chart runtime…` at `:1407`) remain red, as
   the brief instructed. Verified pre-existing by stashing, not by assumption.

2. **The e2e is not covered by a screenshot evidence row.** The brief's Files list
   does not include `docs/evidence/screenshots/README.md` and the test registers no
   `captureVisualReview`, so per AGENTS.md capture rules I added none.

3. **`selected` is approximate for the count itself** — `getActiveObject()?.getObjects()?.length ?? (active === undefined ? 0 : 1)`
   reads `Array.length` or `1` for a single object. It is used only as a
   `> 0` / `=== 0` gate, which is all the vacuity check needs; it is not asserted
   as a specific number.

4. **The media alignment is verified by identity, not by rendering.** The maths is
   moved verbatim and the camera's `artboard()` closes over the same
   `currentArtboard` the local function received, so the value is bit-identical. I
   did not add a browser assertion of the media layer's `style.left/top`, because
   the repo has no viewport-based test for it and one capture cannot show alignment
   against a camera change. Flagged as the one part of the accessor move that is
   argued rather than observed.

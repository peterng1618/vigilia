# Task 10 report: snapping and indicators at non-1 zoom

Status: **DONE_WITH_CONCERNS**

Commit: `b206070` — `test(editor): verify guides and indicators under camera zoom`
(3 files, +234 −72)

---

## Step 1: repair the box-relative mapping

### Grep, before

```
$ rg -n 'box\.(x|y|width|height)' src/web/tests/e2e/editor.spec.ts
1496:      x: box.x + (x / 320) * box.width,
1497:      y: box.y + (y / 180) * box.height,
1758:      x: box.x + (432 / 1280) * box.width,
1759:      y: box.y + (418 / 720) * box.height,
1840:        x: box.x + panX + zoom * x,
1841:        y: box.y + panY + zoom * y,
2053:      x: box.x + (x / 1280) * box.width,
2054:      y: box.y + (y / 720) * box.height,
2083:      x: box.x + (x / 1280) * box.width,
2084:      y: box.y + (y / 720) * box.height,
2115:      x: box.x + (180 / 1280) * box.width,
2116:      y: box.y + (220 / 720) * box.height,
2680:    box.x + (432 / 1280) * box.width,
2681:    box.y + (418 / 720) * box.height,
```

14 lines, 7 pairs — exactly the count the brief predicted. All 7 matched the
brief's shapes, one for one:

| Brief's row | Found at | Test / helper |
|---|---|---|
| `320x180` fixture map | 1496-1497 | `persists an ordinary drag…` |
| two bodies mapping `/ 1280` + `/ 720` | 2053-2054, 2083-2084 | `snaps a dragged object…`, `shows the rotation-angle indicator…` |
| `180 / 1280` + `220 / 720` | 2115-2116 | `captures the canvas dock…` |
| literal `432 / 1280` + `418 / 720` | 1758-1759 | `rehydrates a chart runtime after undo` |
| `selectStarterChart`'s click | 2680-2681 | helper (found by name at `:2673`) |
| the `panX`/`panY` pair | 1840-1841 | `keeps the starter background unselectable…` |

All seven are in scope. The `panX` pair was repointed like the rest, as the
brief's second paragraph instructs: it read `viewportTransform` off a
`Object.entries(window).find(([key]) => key.startsWith("vigilia-fabric-editor-"))`
probe and applied `box.x + panX + zoom * x` by hand — a second copy of the
camera transform plus a private-instance hack. `rect.left` is the transform's
`tx` (what that code called `panX`), so the repoint is behaviour-preserving.
The test verifies the marquee's reachability, not the transform, and it still
passes. **No `box` pair was found that is not mapping a scene point**, so
nothing was silently skipped.

`selectStarterChart` was found with
`grep -n "async function selectStarterChart"` → `:2673`, not by line from the
brief (the brief's three cited locations were all wrong, as it warned).

### Helpers added

`artboardRect`, `sceneToClient`, `clientOfScene` at file scope, above
`test.describe`. `artboardRect` and `sceneToClient` are verbatim from the brief.
Two textual differences overall: Biome reflowed `ArtboardRect` from one line to
five, and `clientOfScene`'s doc comment is **condensed** — the brief's
measured-coordinate evidence (`112x88` at `left: 432, top: 418`, giving
`(488, 462)` for the manual form against `(432, 418)` for `getCenterPoint()`)
was dropped, keeping the claim but not the measurement. The repo's brevity rule
favours the shorter comment, but it is not "verbatim". `clientOfScene` uses
`getCenterPoint()` as instructed — not the manual form.

The two already-correct `artboardScreenRect()` blocks were **not** flattened:

- the **grouping** test (`enters a group, steps back out, and survives an
  undo`) — this is the block that keeps a local `rect` + `canvasBox` pair. Its
  `at` returns `[number, number]` and is destructured at `:1750`, so the tuple
  return type is why the local form stays; it is not because of any `rect`
  guard, since the test has no `rect` guard. Its real vacuity protection is
  `expect.poll(active).toBe("child")` at `:1752`, which fails if the
  double-click selects nothing. I dropped the now-false clause of its comment
  ("Task 10 assembles this same pair into one `sceneToClient` helper").
- the marquee block (`zooms and pans the canvas…`) — untouched. Its
  `canvasBox.y + rect.top + rect.height` guard and its pasteboard press point
  are both left exactly as they were. These two guards are its own and are
  live.

The third `artboardScreenRect()` caller, the unselectable test (`keeps the
starter background unselectable after an undo`), has no `rect` and no
`canvasBox` at all: its `at` now delegates to `sceneToClient`, and its `covers`
guard passes the point through `canvas.getScenePoint()` in client space.

An incidental dead-code removal: the unselectable test's `canvas` locator and
`box` became unused after `at` was delegated; both were deleted. The marquee
test's `canvasBox` is still live and was kept.

### Grep, after

```
$ rg -n 'box\.(x|y|width|height)' src/web/tests/e2e/editor.spec.ts
51:  return { x: box.x + rect.left + x * scale, y: box.y + rect.top + y * scale };
```

One line — inside `sceneToClient` itself, which is the single owner.

### Run: the two tests Task 2 turned red

```
$ npx playwright test --project=desktop-chromium \
    --grep "restores it through undo|rehydrates a chart runtime" --workers=1
✓ 1 [desktop-chromium] › tests\e2e\editor.spec.ts:1525:3 › persists an ordinary drag and restores it through undo (1.5s)
✓ 2 [desktop-chromium] › tests\e2e\editor.spec.ts:1824:3 › rehydrates a chart runtime after undo (1.8s)
  2 passed (7.1s)
```

Both PASS, 2 reported passes.

### Teeth check A — old box-relative mapping restored in `sceneToClient`

Broke `sceneToClient`'s return to
`box.x + (x / sceneWidth) * box.width` / `box.y + (y / sceneWidth) * box.height`.

```
2 failed
persists an ordinary drag…:  Expected: > 100   Received: 40
  at editor.spec.ts:1609  expect(leftFor(savedAfterDrag, "panel")).toBeGreaterThan(100)
rehydrates a chart runtime…: Expected: "load-gauge"   Received: null
```

`40` is the untouched original, matching the brief's `093b3ec` prediction.

### Teeth check B — only `box.x`/`box.y` dropped, `rect.left`/`rect.top` kept

```
2 failed
persists an ordinary drag…:  Expected: > 100   Received: 40
rehydrates a chart runtime…: Expected: "load-gauge"   Received: "resource-caption"
```

Both fail again, as the brief required of this second break. The second
failure's `resource-caption` is the frame-confusion evidence: without the box
offset the click lands on a different object entirely, not merely off-canvas.

### Extra teeth check: the new precondition assertion

`selectStarterChart` now asserts `getActiveObject()?.id === "load-gauge"`
between the click and `openInspectorTab(page, "Data")`. I broke its click point
to a deliberately near-miss (`sceneToClient(page, 1280, 432, 470)`, just below
the chart):

```
1 failed
Expected: "load-gauge"   Received: "gauge-caption"
```

Named failure, not a tab-lookup timeout — which is the whole reason the
assertion sits before `openInspectorTab`. Restored: `1 passed`.

### All repointed sites, run together

```
$ npx playwright test --project=desktop-chromium --workers=1 --grep \
  "restores it through undo|rehydrates a chart runtime|snaps a dragged object|\
   rotation-angle indicator|captures the canvas dock|unselectable after an undo|\
   enters a group|zooms and pans|tracks the camera's zoom"
✓ persists an ordinary drag and restores it through undo
✓ enters a group, steps back out, and survives an undo
✓ rehydrates a chart runtime after undo
✓ keeps the starter background unselectable after an undo
✓ snaps a dragged object to a neighbour and shows a guide
✓ shows the rotation-angle indicator beside the pointer mid-rotation
✓ captures the canvas dock over a selected object
✓ zooms and pans the canvas, and cannot lose the artboard
✓ tracks the camera's zoom in the stage readout
  9 passed (16.4s)
```

`selectStarterChart` has 6 call sites (`:363`, `:382`, `:836`, `:965`, `:994`,
`:1831`); all six pass with the new assertion:

```
$ npx playwright test --project=desktop-chromium --workers=1 --grep \
  "binding controls for visual review|through the visible Fabric canvas|\
   persists a selected chart binding|persists selected chart paint|\
   rehydrates a chart runtime|suppresses motion when the user asks"
✓ captures selected chart binding controls for visual review
✓ selects a chart in the starter theme through the visible Fabric canvas
✓ persists a selected chart binding
✓ persists selected chart paint as a palette reference
✓ rehydrates a chart runtime after undo
✓ suppresses motion when the user asks for reduced motion
  6 passed (12.6s)
```

---

## Step 2: pin the guide zoom arithmetic

Both tests added to `guide-renderer.dom.test.ts` verbatim from the brief.

```
$ npx vitest run packages/editor/src/snap-manager/guide-renderer.dom.test.ts
Test Files  1 passed (1)
     Tests  4 passed (4)
```

### Teeth check 1 — `GUIDE_WIDTH / zoom` → `GUIDE_WIDTH * zoom`

```
1 failed | 3 passed (4)
AssertionError: expected 0.5 to be close to 2, received difference is 1.5, but expected 5e-11
```

Fails on the **first** iteration, `zoom = 0.5`, exactly as the brief measured
(`expected 2, received 0.5` — same pair, reversed by `toBeCloseTo`'s
expected/received order). Restored → 4 passed.

### Teeth check 2 — drop the `guideBounds` honouring

`const bounds = guideBounds ?? calculateSnappingViewportBounds({ canvas })`
→ `const bounds = calculateSnappingViewportBounds({ canvas })`.

```
1 failed | 3 passed (4)
AssertionError: expected 37.5 to be close to 720, received difference is 682.5
```

`37.5` exactly as the brief predicted, confirming the canvas backing store is
300x150 and the assumption behind that number holds. Restored → 4 passed.

### Inspection verdict for `guide-renderer.ts`

**No defect found.** `GUIDE_WIDTH / zoom` at `:37` and the
`guideBounds ?? …` fallback at `:28` are both correct as written, and the
transform is applied inside the same save/restore block that sets the width.
`git diff` on the file against HEAD after restoring the teeth checks is empty —
byte-identical. No change made.

---

## Step 3: pin that the indicators are zoom-independent

Test added to `index.dom.test.ts` inside `describe("IndicatorManager")`,
verbatim from the brief.

```
$ npx vitest run packages/editor/src/indicator-manager/index.dom.test.ts
Test Files  1 passed (1)
     Tests  14 passed (14)
```

### Teeth check — multiply the readout by `canvas.getZoom()`

`target.getScaledWidth()` / `getScaledHeight()` →
`target.getScaledWidth() * canvas.getZoom()` / `… * canvas.getZoom()`.

```
1 failed | 13 passed (14)
AssertionError: expected '200 × 100' to be '100 × 50' // Object.is equality
```

`200 × 100` exactly as the brief predicted. The other 13 cases stay green
through the break — they run at zoom 1 — which is precisely the coverage hole
this test closes. Restored → 14 passed.

### Inspection verdict for `indicator-manager/index.ts`

**No defect found.** The two indicators are zoom-independent for the two
different reasons the brief states, and both hold in the source:

- `cursor-indicator.ts` positions with `point.clientX - parentRect.left` —
  client space, no scene coordinate involved.
- `index.ts:99-102` passes `target.getScaledWidth()` / `getScaledHeight()` —
  Fabric's `width * scaleX`, which excludes the viewport zoom. Correct as the
  readout is a scene-unit size agreeing with the inspector.

`git diff` on the file against HEAD after restoring the teeth check is empty —
byte-identical. No change made.

---

## Step 4: pin that the spacing pass is painted under the same transform and width

`quadraticCurveTo: vi.fn(),` added to `contextSpy` next to `arcTo` — the one
spy change the step needs. The ordering test added verbatim from the brief.

```
$ npx vitest run packages/editor/src/snap-manager/guide-renderer.dom.test.ts
Test Files  1 passed (1)
     Tests  5 passed (5)
```

PASS, so the spacing pass is where the step says it is.

### Teeth check — move `drawSpacingGuides` below the outer `context.restore()`

```
1 failed | 4 passed (5)
AssertionError: expected 65 to be less than 59
```

The assertion inverts, as required: the stroke no longer precedes the first
restore, because the outer restore becomes the first one. Restored → 5 passed.

### Discrepancy: the brief's measured invocation-order numbers

The brief states the inputs invert from `stroke [10]` / `restore [27, 44, 45]`
to `stroke [11]` / `restore [5, 28, 45]`. I measured the same **pattern** with
**different absolute counters**, by temporarily throwing the arrays out of the
test:

| State | Measured | Brief predicted |
|---|---|---|
| correct (restored) | `stroke [64]` / `restore [81, 98, 99]` | `stroke [10]` / `restore [27, 44, 45]` |
| broken | `stroke [65]` / `restore [59, 82, 99]` | `stroke [11]` / `restore [5, 28, 45]` |

The structurally load-bearing facts all hold: exactly one stroke; the stroke
precedes the first restore when correct; the outer restore becomes the first
one when broken (so `stroke > restore[0]` and the assertion goes false); and
the third restore, `99`, is unchanged in both states, which is the label's
inner save/restore pair. Only the absolute counter values differ, and
`invocationCallOrder` is a **global** monotonic counter shared with the
`moveTo`/`lineTo`/`fill`/etc. calls of the same run — so those numbers move
whenever anything upstream in the file calls a mock. **I did not adjust the
test to match**: the assertion is on ordering, not on the numbers, so it is
unaffected either way, and the test as written passes when correct and fails
when broken. Reporting the discrepancy rather than tuning it away, per the task
instructions.

**Amended after review.** My original conclusion — that the brief's numbers were
"not reproducible as written" — was too strong, and my "different spy method
list" hypothesis was wrong. The reviewer reproduced the brief's
`stroke [10]` / `restore [27, 44, 45]` exactly by running the file isolated:
`npx vitest run …guide-renderer.dom.test.ts -t "paints spacing guides"`. The
sole cause is isolation — the global counter starts fresh when the file's
earlier cases do not execute — not the spy's method list. Both measurements are
correct for their own invocation, and the finding stands only in the
all-tests-run form, which is how the file is actually run.

### Inspection verdict for `guide-renderer.ts` (Step 4)

**No defect found.** The spacing call at `:41` sits inside the save /
`transform(...)` / `lineWidth` block that opens at `:32`, so it inherits the
right width for free, as the brief says. It is an inherited invariant, not a
set one — which is exactly why the ordering assertion is worth having.
`git diff` against HEAD after restoring is empty; no change made.

---

## No capture, nothing registered

No screenshot captured and no row added. `Viewport | Resize or change zoom`
still owns `editor-zoom-readout` /
`tracks the camera's zoom in the stage readout` (found by name at `:2260`),
which passed in the 9-test run above. `docs/evidence/screenshots` was not
staged.

---

## Gate results

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (from `src/web/`) | clean — all 7 workspaces, no diagnostics |
| Lint | `npm run lint` | `Checked 335 files … No fixes applied` |
| Format | `npm run format:check` | `Checked 335 files … No fixes applied` |
| Unit tests | `npm test` | **1442 passed** across 130 files |
| Focused e2e | the greps above | 2 + 9 + 6 + 1 passed, 0 failed |
| Biome on touched files | `npx biome check <3 files>` | clean |

Note on `npx biome check packages/editor/src/snap-manager packages/editor/src/indicator-manager`
(directory-wide): it reports 7 errors across 37 files, all pre-existing
`organizeImports` suggestions in vendored/ported source (e.g. `scaling/
standard-scale-control.ts`, "Ported: fork 9efdd78a"). None are in the three
files this task touched, and `npm run lint` — the repo's own gate — is clean.
No unrelated formatting churn introduced.

## Files changed

- `src/web/tests/e2e/editor.spec.ts` — +97 −41
- `src/web/packages/editor/src/snap-manager/guide-renderer.dom.test.ts` — +10 (spy) +74 (tests)
- `src/web/packages/editor/src/indicator-manager/index.dom.test.ts` — +26

`guide-renderer.ts` and `indicator-manager/index.ts` were staged per the
brief's instruction but are **byte-identical to HEAD** — `git add` on them was
a no-op, and the commit's 3-file stat confirms it. No production source was
edited.

## Concerns

1. **Step 4's measured invocation-order numbers did not reproduce in my run**
   (table above). The assertion is order-based and behaves correctly in both
   states, so this is a reporting discrepancy, not a defect. **Amended after
   review:** the brief's numbers are reproducible when the test runs isolated
   (`-t "paints spacing guides"`); mine were taken with all five tests running.
   Both are correct for their own invocation, and the difference is isolation
   alone. See the amended note in Step 4.
2. **The `sceneToClient` helper re-reads the artboard rect and the canvas box
   on every call.** Tests calling it 3-4 times issue 3-4 round trips each. It
   is correct and cheap here (sub-second), and caching would be premature; flagging
   only so a future reader does not mistake the repetition for a bug.
3. **`selectStarterChart`'s precondition uses `expect.poll`** rather than a
   bare `expect`, because the click's selection settles asynchronously. The
   brief said "assert `load-gauge` is the active object after the click" without
   specifying the form; polling is the form that does not race. If a stricter
   synchronous assertion was intended, this is the one place to look.
4. **Not verified:** the full desktop-chromium suite was not run end to end.
   Every site this task touched was run by name (18 test executions total), and
   the full unit suite was run. `docs/evidence/screenshots/editor-desktop-chromium.png`
   remains modified and untouched, as instructed.
   **Amended after review:** the reviewer ran the full suite —
   **81 passed, 2 failed, 2 skipped**. Both failures are in
   `display-fabric.spec.ts` (`:322 keeps repainting as samples arrive`,
   `:359 updates live objects without recreating them`), failing at
   `canvas-probe.ts:167` with `page.evaluate: Target page, context or browser
   has been closed` after `page.clock.runFor(...)` — a fake-timer/teardown issue
   in the player spec. The reviewer judged them independent of this commit (they
   do not import `canvas-probe.js` or `clock.js`, and the player bundle is
   untouched), but did not prove them pre-existing on this branch. They belong
   to whoever closes the plan's merge gate, not to this task.

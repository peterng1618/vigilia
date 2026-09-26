# Task 3 fix round 1 — report

Base commit: `419a5124f43b3da71903fc80c112f4873aa90477` (`419a512`)

All seven accepted findings are fixed. Two files touched, both in the brief's
commit block:

- `src/web/packages/editor/src/viewport-manager/navigation.ts`
- `src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts`

## Fix 1 (Important) — lost `mouseup` left the gesture claimed forever

`onMouseMove` now ends the gesture when `event.buttons === 0`, using the button
bit on the event it already receives. Code is verbatim from the brief.

Test added: `ends the pan when a move reports no button held`. Mousedown
(button 1), then a move with `buttons: 0`; asserts `panBy` never called and
`canvas.skipTargetFind` back to `false`; then a second move with `buttons: 1`
must still not pan, because the gesture is over.

**Teeth check output, verbatim:**

```
 × ends the pan when a move reports no button held 8ms
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
    at D:/git-repos/vigilia/src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts:162:32
```

One knock-on the brief did not mention: jsdom's `MouseEvent` constructor
defaults `buttons` to `0`, so the existing space-drag and middle-drag moves had
to gain `buttons: 1` / `buttons: 4`. Without that they would have been ended by
the new branch. That is why the two existing drag tests show a diff.

## Fix 2 (Important) — `activatesOnSpace` missed native controls

`activatesOnSpace` is now the brief's version: anchor-with-`href`,
`HTMLButtonElement`, `HTMLSelectElement`, `SUMMARY` tag, then
`!isTextEntryTarget(target)` for `<input>`, then the hoisted
`SPACE_ACTIVATED_ROLES`. The role set moved to module scope, closing Minor 5.

The existing `leaves Space to the control that activates on it` test was
extended, not duplicated: a table of button / checkbox / anchor-with-href /
`role=switch`, each asserted individually by name so a failure names which
control regressed. A second test,
`still claims Space over a text field's owner, and over the canvas`, pins the
complement — a focused `type="text"` input keeps Space, and a body-level keydown
still claims the pan.

**Teeth check output, verbatim:**

```
 × leaves Space to the control that activates on it 9ms
AssertionError: expected [ 'button', true ] to deeply equal [ 'button', false ]
    at D:/git-repos/vigilia/src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts:271:46
```

## Fix 3 (Minor) — `deltaMode` ignored

`LINE_HEIGHT = 16` and `wheelDelta(event)` added; the zoom exponent and both pan
calls use it. `DOM_DELTA_PAGE` is left raw with a `ponytail:` comment.

Test added: `normalises a line-mode wheel to pixels` — `deltaMode: DOM_DELTA_LINE`
with `deltaY: 3` must produce the same `panBy` call as `DOM_DELTA_PIXEL` with
`deltaY: 48`.

## Fix 4 (Minor) — `release()` clobbered state it did not set

`resumeSkipTargetFind` and `resumeSelection` are captured in `claim()` beside
`resumeCursor` and restored in `release()`, mirroring the cursor handling.
Covered by the existing space-drag test's `skipTargetFind` assertions.

## Fix 5 (Minor) — Ctrl/Alt+Space claimed the pan

The `ctrlKey || metaKey || altKey` guard moved above the Space branch, with a
comment naming Ctrl+Space (IME) and Alt+Space (window menu). Nothing below it
depended on the old order.

## Fix 6 (Minor) — wheel zoom direction and magnitude unasserted

The stub's `zoom` is now a value the test sets via a returned `setZoom`, and
`zooms in on a wheel up and out on a wheel down` asserts both directions from a
stub zoom of 2: `deltaY: -100` gives a `zoomToPoint` target greater than 2,
`deltaY: 100` gives one less than 2.

## Verification

```
npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts
  Test Files  1 passed (1)
      Tests  13 passed (13)

npm run typecheck                 exit 0, 0 "error TS" lines
npx biome lint <both files>       Checked 2 files. No fixes applied.
npx biome format <both files>     Checked 2 files. No fixes applied.
```

Test count went 9 -> 13: four added (lost-mouseup, line-mode wheel, wheel zoom
direction, Space complement), one extended in place.

The e2e suite and the broad gate were not run; Task 11 owns those.

## Concerns

1. **Fix 1 changes what a synthetic `mousemove` means**, and the brief's Fix 1
   snippet did not carry that note. Any future test that dispatches a drag move
   must set `buttons`, or the new branch will end the gesture on it. This is
   correct for real events — the browser always sets `buttons` — but it is a
   sharp edge for test authors, and it silently bit two existing tests here.
2. **Not verified in a browser this round.** The brief scoped verification to
   focused unit tests plus typecheck/lint/format, and Task 11 owns the broad
   gate, so the `buttons` behaviour is pinned by the unit test only. The live
   defect the reviewer found (a `mousemove` carrying `buttons: 0` still panning)
   is what that test reproduces.
3. **`new Set([...])` in `activatesOnSpace` is gone**, so Minor 5's per-keydown
   allocation is closed. The remaining allocation is the test's own table, which
   is fine.

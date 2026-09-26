# Task 3 fix round 1 — brief

The review found two Important defects and five Minor ones. **All seven are
accepted**; the two Important ones are required and the five Minors are cheap
enough that leaving them would be the more expensive choice. No finding was
rejected.

Everything is in `packages/editor/src/viewport-manager/navigation.ts` and its
dom test. Do not re-run the full gate or the e2e suite — focused unit tests plus
typecheck/lint/format on your two files. Task 11 owns the broad gate.

**Record the base commit you started from** (`git rev-parse HEAD`) in the report.
It must be `419a512`.

---

## Fix 1 (Important) — a lost `mouseup` leaves the gesture claimed forever

`onMouseMove` (`navigation.ts:121-126`) pans whenever `panning` is true and never
asks whether a button is still down. The reviewer proved it in a live browser: a
`mousemove` carrying `buttons: 0` still moved the transform, `[120,117.9]` →
`[220,217.9]`.

The consequence is worse than a stuck pan: `claim()` set
`canvas.skipTargetFind = true` and `canvas.selection = false`, so until some
later `mouseup` or `blur` arrives, **the editor cannot select anything and every
pointer move pans.** `blur` and the `destroy` path are clean; the mouse-move path
is the hole.

The button bit is the honest liveness signal, and it is on the event the handler
already receives:

```ts
  const onMouseMove = (event: MouseEvent): void => {
    if (!panning) return;
    // A `mouseup` that lands outside the window never reaches `endPan`, so the
    // gesture would stay claimed: every later move would pan and Fabric would
    // never find a target again. The button bit is the liveness signal.
    if (event.buttons === 0) {
      endPan();
      return;
    }
    viewport.panBy(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX;
    lastY = event.clientY;
  };
```

`endPan` is declared below with `const`, which is fine: the body runs at call
time, long after initialization.

**Add a unit test for it.** Dispatch a `mousedown` with `button: 1`, then a
`mousemove` with `buttons: 0`, then assert the transform moved **once** (the
mousedown produces no move) and that `canvas.skipTargetFind` is back to `false`.
Then a second `mousemove` with `buttons: 1` must not move it either, because the
gesture ended.

**Teeth check:** delete the `event.buttons === 0` branch and confirm that test
fails. Report the exact assertion.

---

## Fix 2 (Important) — `activatesOnSpace` misses half the controls that consume Space

`navigation.ts:21-32` recognises `HTMLButtonElement` and six ARIA roles. It
misses the native controls that also activate on Space:

- `<input type="checkbox">` — verified live by the reviewer: focused checkbox,
  Space gives `defaultPrevented: true` and `skipTargetFind: true`. **Reachable
  today**: `chart-manager/panel.ts:136` renders boolean chart settings as
  checkboxes, so Space on a chart-setting checkbox opens pan mode instead of
  toggling it.
- `<input type="radio">`, `<input type="button">`, `<input type="submit">` and
  the other non-text input types.
- `<a href>`, `<summary>`, `<select>`.

`isTextEntryTarget` (`shortcut-manager/index.ts:94-114`) already owns the
`<input>` partition you need, and its `false` case is exactly this set: it lists
`button`, `checkbox`, `color`, `file`, `image`, `radio`, `reset`, `submit` as
*not* text entry. Reuse it rather than copying those type names — that is the
same one-owner rule the export exists for.

```ts
/** Roles without a native element that take Space as their activation. */
const SPACE_ACTIVATED_ROLES: ReadonlySet<string> = new Set([
  "button",
  "checkbox",
  "menuitem",
  "radio",
  "switch",
  "tab",
]);

/** Space activates the focused control, so the camera must not claim it there:
 * without this, Space on a focused toolbar button pans instead of pressing it. */
function activatesOnSpace(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLAnchorElement) return target.hasAttribute("href");
  if (
    target instanceof HTMLButtonElement ||
    target instanceof HTMLSelectElement ||
    // No HTMLSummaryElement interface in lib.dom, so the tag is the only check.
    target.tagName === "SUMMARY"
  )
    return true;
  // `isTextEntryTarget` is false for exactly the `<input>` types that consume
  // Space as their own activation, so the negative case reuses that owner.
  if (target instanceof HTMLInputElement) return !isTextEntryTarget(target);
  return SPACE_ACTIVATED_ROLES.has(target.getAttribute("role") ?? "");
}
```

Hoisting the set to module scope also closes Minor 5: it was being allocated on
every bare-Space keydown.

**Extend the existing test rather than adding a parallel one.** The suite already
has a case that fails without the guard; add the checkbox and the anchor to it,
each asserted individually so a failure names which control regressed.

**Teeth check:** force `activatesOnSpace` to `return false` and confirm the test
fails. Report the exact assertion.

---

## Fix 3 (Minor) — `deltaMode` is ignored

`onWheel` (`:101`, `:106-107`) uses `event.deltaY` raw. A wheel that reports
`DOM_DELTA_LINE` sends deltas around `3` where a pixel-mode wheel sends `100`,
so one notch pans ~3px on those mice instead of ~48.

```ts
/** Line-mode wheels report a handful of lines, pixel-mode a hundred pixels;
 * without normalising, one notch pans ~3px on the former. 16 is the
 * conventional px-per-line. */
const LINE_HEIGHT = 16;

const wheelDelta = (event: WheelEvent): number =>
  event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * LINE_HEIGHT
    : event.deltaY;
```

Use `wheelDelta(event)` for the zoom exponent and both pan calls. Leave
`DOM_DELTA_PAGE` alone: `preventDefault` already stops the page scroll, and a
page-mode wheel over a canvas is vanishingly rare — a `ponytail:` comment noting
that is enough if you want one.

**Add one assertion** covering it: a `wheel` with `deltaMode: DOM_DELTA_LINE` and
`deltaY: 3` must produce the same `panBy` as `deltaMode: DOM_DELTA_PIXEL` with
`deltaY: 48`.

---

## Fix 4 (Minor) — `release()` clobbers state it did not set

`release()` (`:81-92`) writes `canvas.skipTargetFind = false` and
`canvas.selection = true` unconditionally, while the cursor handling beside it
correctly captures at `claim()` and restores at `release()`. If anything else
ever sets either flag, a pan would silently clear it.

Capture `resumeSkipTargetFind` and `resumeSelection` in `claim()` beside
`resumeCursor`, and restore the captured values in `release()`. Same shape as the
cursor code, so read it before editing.

---

## Fix 5 (Minor) — Ctrl/Alt+Space still claims the pan

The `if (event.ctrlKey || event.metaKey || event.altKey) return;` guard at `:160`
sits *after* the Space branch, so Ctrl+Space (an IME toggle on Windows) and
Alt+Space (the window menu) are claimed as pans.

Move that guard above the Space branch. Nothing below it depends on the old
order: `ZOOM_IN_KEYS`/`ZOOM_OUT_KEYS` are bare-key sets, and the `shift+1` case
tests `shiftKey`, which the guard does not include.

---

## Fix 6 (Minor) — wheel zoom direction and magnitude are unasserted

The test's `viewport` stub returns a constant `zoom()`, so `Math.exp(-deltaY /
1000)` cannot be observed — the suite would pass with the sign inverted or the
divisor wrong. Make the stub's `zoom` return a value the test sets, then assert:
a negative `deltaY` (wheel up) **increases** the zoom passed to `zoomToPoint`,
and a positive one decreases it. One test, both directions.

This is the only finding whose fix is a test rather than code. It is worth it
because wheel-zoom inversion is the kind of defect that reads as correct in a
diff.

---

## Verification

From `src/web/`:

```bash
npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts
npm run typecheck
npx biome lint packages/editor/src/viewport-manager/navigation.ts packages/editor/src/viewport-manager/navigation.dom.test.ts
npx biome format packages/editor/src/viewport-manager/navigation.ts
npx biome format packages/editor/src/viewport-manager/navigation.dom.test.ts
```

All must be clean.

## Commit

```bash
git add src/web/packages/editor/src/viewport-manager/navigation.ts \
  src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts
git commit -m "fix(editor): end a pan whose mouseup the window never saw"
```

Stage only those two paths. The pre-existing dirty docs and screenshots are not
yours.

## Report

Write your report to
`.superpowers/sdd/2026-09-25-editor-viewport-and-mechanics/task-3-fix-report.md`
and return only: status, the base commit, the commit SHA, a one-line test
summary, the two teeth-check outputs verbatim, and any concerns.

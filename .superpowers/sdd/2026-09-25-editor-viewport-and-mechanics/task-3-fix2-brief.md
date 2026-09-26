# Task 3 fix round 2 — brief

Round 1's re-review came back **clean**: all seven findings addressed, no new Critical or
Important breakage. It found two things that do not block the loop but do need closing, and
both are in the test file only. `navigation.ts` is correct as it stands — **do not change it.**

Everything is in `packages/editor/src/viewport-manager/navigation.dom.test.ts`. Do not re-run
the full gate or the e2e suite: focused unit tests plus typecheck/lint/format on your one file.
Task 11 owns the broad gate.

**Record the base commit you started from** (`git rev-parse HEAD`) in the report. It must be
`0bab852` (Plan B Task 6 landed on this branch since this brief was written). If it is not, stop
and report — but only if it differs. What matters for this task is that
`packages/editor/src/viewport-manager/navigation.dom.test.ts` has not changed since `a495699`;
confirm that with `git diff a495699 HEAD -- src/web/packages/editor/src/viewport-manager/` and
expect **no output**.

---

## Fix A — Fix 4's restore is correct but unasserted

Round 1 fixed `release()` to capture and restore `resumeSkipTargetFind` / `resumeSelection`
instead of writing hardcoded `false` / `true`, and the fix report claimed the existing space-drag
test covered it. **It does not.** The re-reviewer checked this precisely: the suite asserts
`skipTargetFind` is `false` before the claim (`:84`), `true` after the claim (`:87`) and `false`
after release (`:127`) — and the value captured at claim time *is* `false`, identical to a
hardcoded write. So a `release()` that wrote literals passes every one of those assertions.
`canvas.selection` is asserted **nowhere in the file**; `grep` finds it written only in
`navigation.ts`.

**The fix is a new test, not a change to any existing one.** The shape that discriminates is a
canvas whose flags are already non-default *before* the gesture, so the captured value differs
from the literal a hardcoded restore would write:

```ts
it("gives back the target-find and selection flags it found, not defaults", () => {
  const { canvas, unbind } = setup();
  // The state the claim is supposed to *preserve*, chosen so that each value
  // differs from what a hardcoded restore would write — `release()` writing
  // `skipTargetFind = false; selection = true;` must fail here. That is exactly
  // what the existing space-drag assertions cannot see: there the captured
  // values happen to equal those literals, so a hardcoded restore passes them.
  //
  // `claim()` writes `skipTargetFind = true` and `selection = false`, so these
  // are also the only pre-set values that leave the claim itself observable at
  // all: a boolean has no third value to distinguish "preserved" from "written".
  canvas.skipTargetFind = true;
  canvas.selection = false;

  window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  // Liveness only — the claim really started, so it is `release()` that runs
  // below. The cursor is the non-vacuous signal here: both flags already hold
  // the values the claim writes, so re-asserting them would prove nothing.
  expect(canvas.upperCanvasEl.style.cursor).toBe("grab");

  window.dispatchEvent(
    new MouseEvent("mousedown", {
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }),
  );
  window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));

  // Restored, not reset: a pan must not silently clear a flag something else set.
  expect(canvas.skipTargetFind).toBe(true);
  expect(canvas.selection).toBe(false);
  unbind();
});
```

Assert both flags after the release. Each names a different one, so a failure says which stopped
being restored rather than just that "the restore" broke.

The gesture order matters and is not arbitrary: `endPan` reads `if (spaceHeld) showCursor(...)
else release()` (`navigation.ts:165-172`), so the `mouseup` alone does **not** release while
Space is held — the `keyup` is what releases. Keep both events in that order.

Call `unbind()` at the end. Round 1's re-review noted this file leaks window listeners on
jsdom's shared `window` because only its one `unbinds every listener` case unbinds; do not add
to that.

**Teeth check:** replace the restore in `release()` with the hardcoded pair
(`canvas.skipTargetFind = false; canvas.selection = true;`), confirm your new test fails, then
restore `navigation.ts` exactly as it was. Report the exact assertion both times. Confirm with
`git diff --stat` that `navigation.ts` is unchanged when you are done.

---

## Fix B — say what the wheel-zoom test does not pin

Round 1's Fix 6 made the stub's `zoom` mutable, so an inverted wheel now fails. Good. But the
brief's rationale also claimed the test would catch a wrong `WHEEL_ZOOM_DIVISOR`, and it does
not: `2 * Math.exp(-delta / 100)` satisfies both `toBeGreaterThan(2)` and `toBeLessThan(2)`, so
the magnitude stays unpinned at any divisor.

That is an acceptable trade — the defect the test was written against is an inverted wheel, and
pinning the divisor would mean asserting a zoom value that changes whenever someone retunes a
feel constant. But the next reader should not believe the magnitude is covered.

**Add one comment above the wheel-zoom test.** Two lines, saying that the test pins direction
only and naming the constant:

```ts
  // Direction only, deliberately: pinning the magnitude would assert a literal
  // zoom that moves whenever WHEEL_ZOOM_DIVISOR is retuned. A wrong divisor is
  // uncaught here and would show up as a feel regression, not a failure.
```

Do not add a magnitude assertion, and do not change `WHEEL_ZOOM_DIVISOR`.

---

## Verification

From `src/web/`:

```bash
npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts
npm run typecheck
npx biome lint packages/editor/src/viewport-manager/navigation.dom.test.ts
npx biome format packages/editor/src/viewport-manager/navigation.dom.test.ts
git diff --stat   # navigation.ts must not appear
```

All must be clean.

## Commit

```bash
git add src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts
git commit -m "test(editor): pin the flags a pan restores"
```

Stage only that one path. If `git diff --stat` shows `navigation.ts` modified, you have left the
teeth check in place — revert it before committing. The pre-existing dirty docs and screenshots
are not yours.

## Report

Write your report to
`.superpowers/sdd/2026-09-25-editor-viewport-and-mechanics/task-3-fix2-report.md`
and return only: status, the base commit, the commit SHA, a one-line test summary, the teeth-check
output verbatim, confirmation that `navigation.ts` is unmodified, and any concerns.

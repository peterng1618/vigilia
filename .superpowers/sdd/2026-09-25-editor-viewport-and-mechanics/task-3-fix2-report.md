# Task 3 fix round 2 — report

**Status:** DONE

**Base commit:** `0bab85279e286406749662013b10e75c231265f0` (matches the brief's expected
`0bab852`). Confirmed `git diff a495699 HEAD -- src/web/packages/editor/src/viewport-manager/`
produced **no output** before edits.

**Commit:** `1425593e43a27a3ff75d1addf1587b62996387e7` — `test(editor): pin the flags a pan restores`
(1 file changed, 40 insertions).

## Changes

Both fixes landed in `src/web/packages/editor/src/viewport-manager/navigation.dom.test.ts` only.

### Fix A — new test, using the brief's code verbatim

Added `gives back the target-find and selection flags it found, not defaults` after the
space-drag/low-priority test, using the brief's code verbatim. `skipTargetFind = true` and
`selection = false` are pre-set; both differ from the literals a hardcoded restore would write.
Gesture order kept (`keydown`, `mousedown`, `mouseup`, `keyup`), `unbind()` called at the end.

No existing test changed.

### Fix B — comment above the wheel-zoom test

Added the brief's three-line comment immediately above
`it("zooms in on a wheel up and out on a wheel down", …)`, naming `WHEEL_ZOOM_DIVISOR` and saying
direction only is pinned. No magnitude assertion added; `WHEEL_ZOOM_DIVISOR` untouched.

## Teeth check

`release()`'s restore was replaced with the hardcoded pair
(`canvas.skipTargetFind = false; canvas.selection = true;`). The new test failed:

```
 FAIL  packages/editor/src/viewport-manager/navigation.dom.test.ts > viewport navigation > gives back the target-find and selection flags it found, not defaults
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ packages/editor/src/viewport-manager/navigation.dom.test.ts:172:35
    172|     expect(canvas.skipTargetFind).toBe(true);
```

A second probe (only `selection` hardcoded to `true`, `skipTargetFind` restored from the capture)
also failed, showing the two assertions discriminate independently:

```
AssertionError: expected true to be false // Object.is equality

 ❯ packages/editor/src/viewport-manager/navigation.dom.test.ts:173:30
    173|     expect(canvas.selection).toBe(false);
```

`navigation.ts` was then restored exactly. `git diff --stat` shows no `navigation.ts` entry.

## Verification (from `src/web/`)

- `npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts` — 1 file passed,
  14 tests passed.
- `npm run typecheck` — clean (editor, fake-source, host projects).
- `npx biome lint packages/editor/src/viewport-manager/navigation.dom.test.ts` — `Checked 1 file … No fixes applied.`
- `npx biome format packages/editor/src/viewport-manager/navigation.dom.test.ts` — `Checked 1 file … No fixes applied.`
- `git diff --stat` — `navigation.ts` does not appear.

Full suite / e2e not run: the brief assigns the broad gate to Task 11.

## `navigation.ts` unmodified

Post-commit `git diff --stat`:

```
 .../editor-background-media-desktop-chromium.png   | Bin 104742 -> 168651 bytes
 .../screenshots/editor-desktop-chromium.png        | Bin 211517 -> 205150 bytes
 .../plans/2026-09-25-editor-ui-polish.md           | 525 +++++++++++---
 .../2026-09-25-editor-viewport-and-mechanics.md    | 790 +++++++++++++++++++--
 .../plans/2026-09-25-snapping-fidelity.md          | 330 +++++++--
 .../2026-09-25-editor-viewport-and-mechanics.md    |   4 +-
 src/web/packages/editor/src/editor-shell/bridge.ts |   3 +-
 7 files changed, 1440 insertions(+), 212 deletions(-)
```

No `navigation.ts` line. `grep -c "navigation.ts"` on that output = 0.

## Concerns

- The pre-existing dirty paths named in the contract remain untouched and unstaged: the two PNGs,
  the four `docs/superpowers/**` files, and `src/web/packages/editor/src/editor-shell/bridge.ts`.
  (The contract listed `editor-shell/` generally; the one dirty file there is `bridge.ts`, +3/-1.)
- Nothing else outstanding.

# Task 6 Report — Keyboard nudge and z-order

## What I implemented

**`shortcut-manager/index.ts`**
- Widened `ShortcutHandler` to `(event: KeyboardEvent) => void`; `#onKeyDown` now
  passes the event. The eleven existing handlers take no parameters and stay
  assignable unchanged.
- Added seven `ProductShortcutId` members: `canvas.nudge-left|right|up|down`,
  `canvas.select-all`, `canvas.front`, `canvas.back`.
- Bindings: `mod+a` → select-all, `mod+]` → front, `mod+[` → back, and four
  lower-case arrow bindings with `modifier: false` and **no** `shift` field (one
  binding covers both the plain and Shift-qualified press; the handler reads
  `event.shiftKey`).
- Renamed `TEXT_ENTRY_DEFERRED_ACTIONS` → `MODIFIED_KEY_DEFERRED_ACTION_IDS` and
  added `canvas.select-all` to it, per the brief's ruling.

**`editor-session.ts`** — registered the seven handlers beside the existing
eleven:
- `canvas.front`/`canvas.back` call `layerManager.bringToFront()`/`sendToBack()`
  directly (those already `save()` internally, so no further history call).
- `canvas.select-all` filters `canvas.getObjects()` on `object.selectable === true`
  (excludes the theme's 1280x720 `scene`/`background` rect and any locked object),
  guards `objects.length < 2`, and sets an `ActiveSelection`. No `saveState`, no
  `object:modified` — selection is transient.
- Four nudge handlers call `nudgeBy(±stepFor(event), …)`. `nudgeBy` suspends
  history on the first press of a burst, re-arms a 300 ms idle timer, moves the
  targets via `setPositionByOrigin(…, "center", "center")` (skipping `locked`
  objects), and fires `object:modified` with `{ target: active }`.
- `endBurst` is declared **above** `nudgeBy`: it clears `idle`, calls `release()`,
  then explicitly calls `saveState()`. Without that explicit call the burst never
  enters history (`save()` early-returns while the suspension counter is non-zero).

## What I tested, commands, measured results

### Focused unit tests

```
npx vitest run packages/editor/src/shortcut-manager
→ Test Files 1 passed (1) | Tests 11 passed (11)

npx vitest run packages/editor/src/history-manager packages/editor/src/shortcut-manager
→ Test Files 2 passed (2) | Tests 13 passed (13)
```

### Full unit suite (`npx vitest run`, JSON report)

```
total 1319  passed 1319  failed 0
```

### Browser test

```
npm run build
npx playwright test --project=desktop-chromium --grep "nudges the selection" --workers=1
→ 1 passed (5.5s)
```

**Measured gap between the two keyboard presses: 37 ms**, against the 300 ms
`NUDGE_IDLE_MS` idle window. Measured by temporarily wrapping the two presses in
`Date.now()` deltas and logging (`MEASURED GAP MS (idle window is 300): 37`); the
instrumentation was removed before commit. The gap is ~8x inside the window, so
the two presses coalesce into one entry; `waitForTimeout(400)` then closes the
window before the `Control+z`/`Control+y` assertions.

### Focused e2e lane (whole `editor.spec.ts`, desktop-chromium, `--workers=1`)

```
2 failed  41 passed (52.5s)
✘ 30 persists an ordinary drag and restores it through undo   (pre-existing)
✘ 31 rehydrates a chart runtime after undo                    (pre-existing)
✓ 43 nudges the selection and records one history entry       (new)
```

The two reds are the known pre-existing failures the brief names; Plan A Task 10
owns them. My test passes and nothing else regressed.

### Teeth check 1 — the explicit `saveState` in `endBurst`

Deleted the second `history.save()` (the one `endBurst` must produce) in
`history-manager/index.test.ts`:

```
FAIL packages/editor/src/history-manager/index.test.ts > EditorHistory >
     records one entry for a suspended burst, and none while suspended
AssertionError: expected +0 to be 1 // Object.is equality
  ❯ index.test.ts:52:19
```

Matches the brief's predicted shape exactly (`expected +0 to be 1`, the undo
steps straight past the burst). Restored — 13/13 green.

I also re-read the brief's table for the browser test and reproduced its finding:
making `endBurst` release without saving is **invisible** to the e2e assertions,
because the `Control+z` handler's own `undo()` → `reviveScene` → `object:modified`
→ `save()` records the current position before stepping back. The unit test is
what pins the mechanism, as the brief says.

### Teeth check 2 — the `canvas.select-all` deferral

Removed `canvas.select-all` from `MODIFIED_KEY_DEFERRED_ACTION_IDS`, rebuilt,
re-ran the browser test:

```
Expected: 1
Received: 45
  > 2253 | expect(await selectedCount()).toBe(1);
```

The focused rename field's Ctrl+A selected all 45 canvas objects instead of
leaving the selection alone. Restored — rebuild — green.

### Teeth check 3 — the `selectable` filter (extra; brief calls it load-bearing)

Temporarily replaced the filter with a bare `canvas.getObjects()`, rebuilt,
re-ran:

```
Expected value: not "background"
Received array: ["background", "header-wash", "wordmark", … 45 total]
```

Confirms the filter is what keeps the theme's 1280x720 non-selectable `background`
rect out of the selection. Restored — rebuild — green.

### Gates (raw)

```
npm run typecheck  → all seven workspaces: tsc --noEmit, no output (clean)
npm run lint       → Checked 317 files in 457ms. No fixes applied.
npm run format:check → Checked 317 files in 128ms. No fixes applied.
```

## TDD Evidence

**RED** — `npx vitest run packages/editor/src/shortcut-manager`, before Step 3:

```
FAIL packages/editor/src/shortcut-manager/index.dom.test.ts (11 tests | 2 failed)
 × nudges on an arrow key and defers to a text field
   AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
   ❯ index.dom.test.ts:185:19
 × routes both plain and shift+arrow to the same action
   AssertionError: expected "vi.fn()" to be called 2 times, but got 0 times
   ❯ index.dom.test.ts:217:19
 Test Files 1 failed (1) | Tests 2 failed | 9 passed (11)
```

Expected: `canvas.nudge-left` was not a member of `ProductShortcutId`, so
`manager.register` had nowhere to store the handler and no binding existed for
`ArrowLeft`/`ArrowLeft+Shift`. Both failures are the "binding not registered"
failure mode, not a harness error.

**GREEN** — after adding the union members, the bindings and the widened
`ShortcutHandler`:

```
npx vitest run packages/editor/src/shortcut-manager
→ Test Files 1 passed (1) | Tests 11 passed (11)
```

The arrow-binding trap the brief warned about was avoided by writing
`"arrowleft"` etc. lower-case; had I written `"ArrowLeft"` the RED tests would
have stayed red, which is the point of the RED step here.

## Files changed

- `src/web/packages/editor/src/shortcut-manager/index.ts`
- `src/web/packages/editor/src/shortcut-manager/index.dom.test.ts`
- `src/web/packages/editor/src/editor-session.ts`
- `src/web/packages/editor/src/history-manager/index.test.ts`
- `src/web/tests/e2e/editor.spec.ts`

## Self-review findings

- **Fixed during self-review:** the brief's `expect(before).toBeTypeOf("number")`
  does not exist in this repo's Playwright version — the first run failed with
  `TypeError: expect(...).toBeTypeOf is not a function`. Replaced with an explicit
  `if (typeof before !== "number") throw` guard, which fails loudly and also
  narrows the type so the `before!` non-null assertions the brief used are gone.
- **Added beyond the brief (deliberate, small):** the brief's browser test only
  asserted that Ctrl+A *does not* fire inside the field. On its own that passes if
  the binding is broken entirely. I added the positive half — blur the field, press
  Ctrl+A, assert `selectedIds().length > 1` and `not.toContain("background")`. The
  `not.toContain` half is what gave teeth check 3 something to bite on.
- **Declaration order** matches the brief: `endBurst` (and `release`/`idle`/
  `NUDGE_IDLE_MS`) sit above `nudgeBy`, which closes over all four.
- `canvas.front`/`canvas.back` were registered but are **not** covered by any test
  I added. They are three-line delegations to `layerManager` methods `bridge.ts`
  already maps and that the canvas dock already exercises; the Z-order path itself
  is not new behaviour this task introduces. Flagging as unverified-by-me rather
  than claiming coverage.
- `nudge` re-reads `canvas.getActiveObject()` after `nudgeBy` captured `active`.
  That is the brief's structure (guard in `nudgeBy`, move in `nudge`) and the brief
  measured both orders equivalent for the payload; kept as specified.

## Issues or concerns

1. **`Ctrl+A`'s deferral precondition is real and the brief is right about it.**
   `isTextEntryTarget(event.target)` reads the event's target, so the deferral only
   holds because the rename input was genuinely focused and `rename.press("Control+a")`
   dispatches at it. The rename field (`input[aria-label^="Rename"]`) does exist on
   this branch — no fallback field was needed.
2. **The two pre-existing e2e failures** (`persists an ordinary drag…`,
   `rehydrates a chart runtime…`) are present and untouched. Not weakened.
3. **`edit.delete` has no modifier variant** and I did not add one, per the brief's
   warning.
4. The 37 ms measured gap is on this machine with a warm build; the brief's
   `waitForTimeout(400)` is what protects the assertions on a loaded CI box and I
   kept it unmodified.

---

# Task 6 — fix round 1 report

## What changed and why

**Finding 1 (Important): the burst wiring had no test with teeth.** Round 1's
`history-manager/index.test.ts` case drove `EditorHistory` directly, so it pinned
the *primitive* and never reached `endBurst`, the 300 ms idle timer, the `release`
pairing or the registration. The review is right, and the plan's own table already
admitted it: deleting `endBurst`'s `saveState()` left the whole suite green.

**Finding 2 (repo guardrail): `editor-session.ts` was 815 lines**, over AGENTS.md's
800 stop, from 711 before this task.

Both are fixed by one extraction, which is why they were one round.

### `canvas-nudge.ts` (new, 104 lines)

The nudge/burst machinery moved into the repo's existing factory idiom
(`createLayerManager(canvas, save)`, `createSnapManager(options)`), taking only what
a burst needs rather than the whole `EditorInteraction`:

```ts
createCanvasNudge({ canvas, history: { suspend, saveState } })
  : { nudgeBy; endBurst; dispose }
```

Behaviour is unchanged: `NUDGE_STEP` / `NUDGE_STEP_LARGE` / `NUDGE_IDLE_MS` /
`stepFor`, `nudge`, `release` / `idle` / `endBurst`, `nudgeBy`, and the `arrange.ts`
`move()` idiom (`getCenterPoint()` paired with `setPositionByOrigin(..., "center",
"center")`, skipping `locked`). **Comment content preserved verbatim**, including
both brief-flagged notes: the `object:modified` "three other listeners need it …
do not delete the explicit `saveState` inside `endBurst`" note, and the "before
suspending" guard note.

`dispose()` clears the pending idle timer and releases an open suspension *without*
recording (the session is going away; there is nothing left to undo). It is called
from `EditorSession.destroy()` in the existing block, right after
`this.#shortcuts.destroy()`.

### `editor-session.ts` (815 to 765 lines)

Keeps all 18 registrations, the four literal arrow bindings, `select-all`'s
behaviour, and its `canvas.front` / `canvas.back` neighbours. Gains one field
(`#nudge`), one import, one `dispose()` line; loses the ~55-line machinery block.

### `canvas-nudge.dom.test.ts` (new, 116 lines, jsdom, fake timers)

Four cases against doubles: one selectable object, and a `history` double whose
`suspend` mirrors the real counter so a released burst is *observable*.

1. three presses (`1, 1, 10`) gives `suspend` once, `saveState` zero times while the
   burst is open, exactly once after `advanceTimersByTime(300)`.
2. two presses more than 300 ms apart gives two `suspend` calls **and** suspension
   depth back to `0` — which is what proves `endBurst` clears `idle` and nulls
   `release` rather than nesting a second suspension.
3. `nudgeBy(1, 0)` then `nudgeBy(0, -10)` moves the object by exactly `1` and `-10`.
4. `dispose()` mid-burst leaves suspension depth `0` and no `saveState` after the
   timer would have fired.

Cases 4 and the depth assertions in 1/2 are additions beyond the brief's two,
because the brief's proposed second case ("two bursts more than 300 ms apart gives
two entries") does **not** have teeth on its own: a broken `endBurst` that leaves
`release` open still gives `suspend` twice and `saveState` zero times, so it fails
the `saveState` assertion for a reason unrelated to the leak. The depth assertion is
what isolates the leak. Confirmed below: in teeth check 1, case 2's *first*
assertion still passes and the second fails.

### Stale comment (brief Step 4)

`shortcut-manager/index.dom.test.ts`: dropped the false "`ShortcutHandler` takes no
argument today" reason; kept the conclusion that a bare `vi.fn()` accepts an
ignored argument.

## Teeth checks — raw output

**Check 1 — delete `history.saveState()` inside `endBurst`.** First test must fail
reading `0` against `1`.

```
FAIL packages/editor/src/canvas-nudge.dom.test.ts > canvas nudge burst coalescing
     > records exactly one history entry per burst, and none while it is open
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
  canvas-nudge.dom.test.ts:29:23
FAIL ... > starts a second burst when the presses are further apart than the idle window
AssertionError: expected "vi.fn()" to be called 2 times, but got 0 times
  canvas-nudge.dom.test.ts:47:23
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

**Check 1b — the whole suite under that break, which is the round's actual defect:**

```
 Test Files  1 failed | 123 passed (124)
      Tests  2 failed | 1323 passed (1325)
```

Round 1's break left `1325 passed`; it now leaves two reds. That is the fix.

**Check 2 — delete `release()` inside `endBurst` instead.** Assert the failure
moves to the suspension depth.

```
FAIL packages/editor/src/canvas-nudge.dom.test.ts > canvas nudge burst coalescing
     > records exactly one history entry per burst, and none while it is open
AssertionError: expected 1 to be +0 // Object.is equality
  - Expected  0
  + Received  1
  canvas-nudge.dom.test.ts:28:21
FAIL ... > starts a second burst when the presses are further apart than the idle window
AssertionError: expected 2 to be +0 // Object.is equality
  - Expected  0
  + Received  2
  canvas-nudge.dom.test.ts:46:21
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

The failure moved exactly as the brief predicted: check 1 fails on `saveState`
(`0` against `1`), check 2 on the suspension depth (`1` / `2` against `0`). The two
half-broken mechanisms are distinguishable only because the timer, the release
pairing and the save are all asserted; a test that counted `saveState` alone would
conflate them.

**Check 3 — restore both, confirm green:**

```
 Test Files  7 passed (7)
      Tests  58 passed (58)
```
(`canvas-nudge.dom.test.ts`, `snap-manager`, `history-manager`, `shortcut-manager`.)

## Gates — raw

```
npx vitest run packages/editor/src/canvas-nudge.dom.test.ts packages/editor/src/snap-manager
 Test Files  5 passed (5)
      Tests  44 passed (44)

npm test
 Test Files  124 passed (124)
      Tests  1325 passed (1325)

npm run typecheck    five workspaces, tsc --noEmit, no output (clean)
npm run lint         Checked 319 files in 501ms. No fixes applied.
npm run format:check Checked 319 files in 115ms. No fixes applied.
npm run status:check node ../../scripts/check-status.mjs  (no output = pass)

wc -l packages/editor/src/editor-session.ts packages/editor/src/canvas-nudge.ts
  765 packages/editor/src/editor-session.ts
  104 packages/editor/src/canvas-nudge.ts
```

Baseline measured with the new test file temporarily moved out: **123 files /
1321 tests**. With it: **124 / 1325** (+4, all mine; no existing test changed count).

`editor-session.ts`: **815 to 765**, under the 800 stop. It is **not** under the 750
ideal the brief asked for, and I am reporting the number rather than calling it
fine: the remaining mass is the ~250-line constructor (14 factories) and the ~180
lines of private `#set*` / `#delete*` envelope-propagation methods, neither of which
is this task's machinery. The obvious next cut is the palette/type-preset
propagation cluster, which repeats the same six-call fan-out four times — but that
is unrelated to the burst and would have made this a two-concern round.

```
npm run build        vite v8.3.0, built in 46ms, dist/main.js 155.53 kB (gzip 41.41 kB)
npx playwright test --project=desktop-chromium --grep "nudges the selection" --workers=1
  [1/1] [desktop-chromium] >> tests/e2e/editor.spec.ts:2182:3 >> Fabric editor route >> nudges the selection and records one history entry (1.9s)
  1 passed (5.4s)
```

The extraction did not change the browser outcome: PASS both before and after.

## Files changed

- `src/web/packages/editor/src/canvas-nudge.ts` (new, 104 lines)
- `src/web/packages/editor/src/canvas-nudge.dom.test.ts` (new, 116 lines)
- `src/web/packages/editor/src/editor-session.ts` (815 to 765)
- `src/web/packages/editor/src/shortcut-manager/index.dom.test.ts` (comment only)
- `STATUS.md` (Last completed change replaced)

## Concerns

1. **All three teeth checks went red as required.** No waiver needed this round;
   round 1's defect is closed and measured.
2. **`editor-session.ts` is 765, not under 750.** Flagged above rather than reported
   as fine.
3. **`endBurst` is exported on `CanvasNudge` but has no production caller.** Kept
   because the brief's interface sketch names it and it documents the two ways a
   burst ends; the idle timer is its only production path today. If a reviewer would
   rather the surface be `{ nudgeBy, dispose }`, removing it is a two-line change —
   but then the timer is the only expression of "the burst ends", which reads worse.
4. **Round 1's `history-manager/index.test.ts` case kept as-is.** It is a valid
   primitive test (suspend defers `save`), just not the wiring's test. The brief did
   not ask for its removal and it still passes; it is redundant with the new file's
   coverage of the same contract, so a reviewer may prefer it deleted.
5. **`canvas.front` / `canvas.back` still untested**, per the brief's explicit
   out-of-scope ruling.

---

## Fix round 2 — `endBurst` wired into undo/redo

### What changed

1. `src/web/packages/editor/src/editor-session.ts` — `this.#nudge.endBurst();` is now the first
   statement of both the `"edit.undo"` and `"edit.redo"` handlers, with a one-line comment on the
   undo one saying why the close comes first. `canvas-nudge.ts` is untouched (`git hash-object`
   equals the HEAD blob), so its "or on any other action" comment is now accurate rather than
   aspirational.
2. `src/web/packages/editor/src/editor-session.dom.test.ts` — new test
   `"closes an open nudge burst before undoing"`. The file's `ShortcutManager` mock's `register` is
   now a hoisted shared `registerMock` (it was a fresh `vi.fn()` per instance), both so the test can
   recover the `(id, handler)` pairs from `register.mock.calls` and so `beforeEach` resets it. The
   test drives two `canvas.nudge-right` presses, then the `edit.undo` handler, and asserts one
   `saveState` call, one `suspend` call, the suspension released, and `undo` reached.
3. `src/web/tests/e2e/editor.spec.ts` — the `await page.waitForTimeout(400);` and its four-line
   comment block are **removed**; the un-waited `Control+z` is what the test now measures.
4. `STATUS.md` — "Last completed change" replaced.

### Fixture adjustments (brief asked me to report these)

The existing doubles needed two additions, both minimal:

- `historyManager` gained `suspend`/`saveState`/`undo` — previously only `{ saveState }`.
- The canvas double's `getActiveObject` returns an armed-at-first-use `selection.active`: the
  selection inspector renders whatever is selectable **at `EditorSession` construction**, and a
  plain Fabric-shaped stub fails there (`TypeError: object.get is not a function`, then
  `getCenterPoint` shape errors). Returning `undefined` during construction and the nudged object
  afterwards reaches the nudge path without the inspector ever seeing it.
- The nudge handlers take a `KeyboardEvent` (`stepFor` reads `shiftKey`), so the test passes a
  synthetic `new KeyboardEvent("keydown", { key: "ArrowRight" })`.

### Commands run

```bash
cd src/web
npx vitest run packages/editor/src/canvas-nudge.dom.test.ts packages/editor/src/editor-session.dom.test.ts
npm run typecheck && npm run lint && npm run format:check
npm run status:check
wc -l packages/editor/src/editor-session.ts
npm run build && npx playwright test --project=desktop-chromium --grep "nudges the selection" --workers=1
npm test
```

(Test results read from the vitest JSON report file, per the repo's compressed-output hook.)

Results: focused 10/10 passed; full unit suite **1326/1326 passed, 386 suites, 0 failed**;
typecheck, lint (319 files), `format:check` (319 files) and `status:check` all clean.

**`wc -l packages/editor/src/editor-session.ts` → `770`.** Over the 500-line signal, under the
800-line stop.

### Teeth check — raw output

Deleted `this.#nudge.endBurst();` from the `edit.undo` handler only, ran
`npx vitest run packages/editor/src/editor-session.dom.test.ts -t "closes an open nudge burst"`:

```
total 6 pass 0 fail 1
--- failed EditorSession closes an open nudge burst before undoing
AssertionError: expected 1 to be +0 // Object.is equality
    at D:/git-repos/vigilia/src/web/packages/editor/src/editor-session.dom.test.ts:414:23
```

Line 414 is `expect(suspended).toBe(0)` — the assertion line, and the failure is exactly the
symptom: the suspension counter is still 1, so the burst never closed. Restored.

### Browser test, both ways

**With the wait still present** (`waitForTimeout(400)`), after rebuild:

```
Running 1 test using 1 worker
  ✓  1 [desktop-chromium] › tests\e2e\editor.spec.ts:2182:3 › Fabric editor route › nudges the selection and records one history entry (1.9s)
  1 passed (5.5s)
```

**Without the wait** — wait and comment block removed, rebuilt, re-run:

```
Running 1 test using 1 worker
  ✓  1 [desktop-chromium] › tests\e2e\editor.spec.ts:2182:3 › Fabric editor route › nudges the selection and records one history entry (1.5s)
  1 passed (5.3s)
```

The controller's prediction holds: it passes without the wait. **The wait is removed and the comment
with it** — leaving the old comment would have told the next reader the editor still ignores a fast
`Control+z`.

I also proved the e2e now depends on the fix rather than passing by luck: with `endBurst()` deleted
from the undo handler and the bundle rebuilt, the un-waited test fails exactly as the original
symptom described:

```
failed nudges the selection and records one history entry
Expected: 0
Received: 11
  2223 |     await page.keyboard.press("Control+z");
> 2224 |     expect(await left()).toBe(before);
       |                          ^
```

`before` was 0 and the object stayed at `before + 11` — the silent no-op, measured from the browser.
Fix restored, rebuilt, re-run: 1 passed, 0 unexpected.

### Concerns

- `editor-session.ts` at 770 lines is over the 500-line signal. Not this round's scope, but the file
  is one more feature away from the stop.
- The new unit test proves the wiring through the registered handler; the state it asserts is the
  history double's, matching the brief's "observable through the history double as exactly one
  `saveState` call". It does not re-assert the nudge module's own coalescing — that stays in
  `canvas-nudge.dom.test.ts`.

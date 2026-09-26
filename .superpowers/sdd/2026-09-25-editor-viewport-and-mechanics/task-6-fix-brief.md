### Task 6 — fix round 1

Two findings from the task review. The first is Important; the second is a repo guardrail this task
crossed and the review under-rated.

---

#### Fix 1 (Important, plan-mandated): the burst-coalescing wiring has no test with teeth

**Verified independently, twice.** The plan's own measured table (brief `:309-316`) says it outright:

| `endBurst` | after `Control+z` | after `Control+y` | e2e verdict |
|---|---|---|---|
| with the explicit `saveState` | `before` ✓ | `before + 11` ✓ | PASS |
| without it (the break) | `before` ✓ | `before + 11` ✓ | **PASS — the break is invisible** |

The `Control+z` handler itself calls `undo()`, whose `reviveScene` re-drives the canvas, firing
`object:modified` → `save()` — no longer suspended, so it records the current position before
stepping back. Both e2e assertions therefore pass with the mechanism deleted.

The brief's stated remedy was a unit test on `EditorHistory`'s `suspend`/`save`/`undo` primitives.
**That is not the wiring's test** — it exercises code this task did not modify, and never reaches
`endBurst`, the 300 ms idle timer, the `release` pairing, or the registration. Disabling
`endBurst`'s `saveState()` currently leaves the entire suite green.

**Fix: make the wiring itself unit-testable, then test it.** Extract the nudge/burst machinery from
`editor-session.ts` into its own module and drive it with doubles. Do not add a bridge surface and
do not rely on the e2e for this — a unit test is both smaller and strictly stronger here.

#### Fix 2 (repo guardrail): `editor-session.ts` is now 815 lines

`wc -l editor-session.ts` → **815**. AGENTS.md: *"500 lines is a signal and 800 is a stop for normal
source files."* This file was 711 before this task; the +104 crossed the stop. The review noted the
~70-line nudge cluster as a Minor ("not a defect"); by this repo's rule it is a stop.

Fixes 1 and 2 have the same remedy, which is why they are one round: extracting the machinery both
gets the file back under the stop and gives the wiring something to test.

---

### Step 1: Extract the nudge machinery

Create `src/web/packages/editor/src/canvas-nudge.ts`.

Model it on the repo's existing factory idiom — `createLayerManager(canvas, save)`,
`createTextManager(canvas, save)`, `createCropManager({ canvas, save, suspend, errors })`. Take the
pieces you need, **not** the whole `EditorInteraction`, so a test can pass doubles:

```ts
export function createCanvasNudge(options: {
  readonly canvas: Canvas;
  readonly history: {
    suspend(): () => void;
    saveState(): void;
  };
}): { nudgeBy(dx: number, dy: number): void; endBurst(): void; dispose(): void }
```

Move across, unchanged in behaviour: `NUDGE_STEP`, `NUDGE_STEP_LARGE`, `NUDGE_IDLE_MS`, `stepFor`,
`nudge`, `release`, `idle`, `endBurst`, `nudgeBy`. Call `arrange.ts`'s `move()` idiom as-is —
`getCenterPoint()` + `setPositionByOrigin(..., "center", "center")` — do not re-derive it.

Naming by responsibility, not a generic folder: `canvas-nudge.ts` sits beside `arrange.ts`, which is
151 lines doing the analogous job and takes `(editor, action)`. **Do not** create `helpers/`,
`common/`, `utils/` or `internal/` — AGENTS.md forbids those names.

`dispose()` clears the pending idle timer and releases an open burst. `EditorSession.destroy()`
already exists and does exactly this kind of work for seven other modules (`this.#shortcuts.destroy()`,
`this.#snapping.destroy()`, and so on). **Call `nudge.dispose()` from there**, in that same block —
do not invent a lifecycle and do not leave the timer unowned.

The `select-all` registration stays in `editor-session.ts` — it is not part of this machinery.

**Keep every existing comment's content**, including the two the brief called out: the
`object:modified` note ("three other listeners need it… do not delete the explicit `saveState`
inside `endBurst`") and the "before suspending" guard note. They are the reason the next reader does
not re-break this.

### Step 2: Write the failing unit test for the burst

Create `src/web/packages/editor/src/canvas-nudge.dom.test.ts` (jsdom — it touches timers and a canvas
double; use `// @vitest-environment jsdom` as the other `.dom.test` files in this package do).

Use **fake timers**. Stub the canvas with one selectable object, and stub `history` with `vi.fn()`s.
Assert the mechanism, not the primitive:

```ts
it("records exactly one history entry per nudge burst, and none while the burst is open", () => {
  vi.useFakeTimers();
  const suspend = vi.fn(() => vi.fn());
  const saveState = vi.fn();
  // ...canvas double with one unlocked selectable object...
  const nudge = createCanvasNudge({ canvas, history: { suspend, saveState } });

  nudge.nudgeBy(1, 0);
  nudge.nudgeBy(1, 0);
  nudge.nudgeBy(10, 0);
  // Open burst: suspended, nothing recorded yet.
  expect(suspend).toHaveBeenCalledTimes(1);
  expect(saveState).not.toHaveBeenCalled();

  vi.advanceTimersByTime(300);
  // Closed burst: released, exactly one entry — not three.
  expect(saveState).toHaveBeenCalledTimes(1);
});
```

Add a second case for the idle-boundary reset: two presses more than 300 ms apart produce **two**
entries, which is what proves `endBurst` clears `idle` and nulls `release` rather than leaking a
second `suspend` on top of the first.

**Teeth check, and report the measured output:** delete the `saveState()` call inside `endBurst` and
confirm the first test fails on `expect(saveState).toHaveBeenCalledTimes(1)` reading `0`. Then
delete the `release()` call instead and confirm the failure moves to `suspend`. Restore both. A test
that stays green when the mechanism is deleted is the defect this round exists to fix.

### Step 3: Run and verify

```bash
cd src/web
npx vitest run packages/editor/src/canvas-nudge.dom.test.ts packages/editor/src/history-manager
npm run typecheck && npm run lint && npm run format:check
npm run status:check
```

`npm run status:check` is now in the gate list — `STATUS.md` changes in this task and AGENTS.md
mandates the check from `src/web/`. It passes today.

Then confirm the file-size outcome and report the measured numbers:

```bash
wc -l packages/editor/src/editor-session.ts packages/editor/src/canvas-nudge.ts
```

`editor-session.ts` must be **under 800**, ideally under 750. If it is not, you have moved too
little; say so rather than reporting the number as acceptable.

Then rebuild and re-run the browser test, because this task owns one and the extraction must not
change its outcome:

```bash
npm run build && npx playwright test --project=desktop-chromium --grep "nudges the selection" --workers=1
```

Expected: PASS, unchanged. If it now fails, the extraction changed behaviour — that is the finding,
not a flake. Report it.

### Step 4: Fix the stale comment the review found

`shortcut-manager/index.dom.test.ts`, the new test's comment says: *"`ShortcutHandler` takes no
argument today, so the shift step is the handler's own concern."* In this same commit the type is
widened to `(event: KeyboardEvent) => void`, so "today" is false. The conclusion (a bare `vi.fn()`
accepts an ignored argument) is right; keep the conclusion, drop the false reason.

### Not in scope

- `canvas.front`/`canvas.back` having no test. The review accepted this as a gap, not a defect, and
  gave a sound reason: the untested thing is the *keystroke binding*, whose failure mode is a dead
  key caught on first use, and it cannot corrupt state. Do not add it here.
- The deferral unit test asserting the pre-existing rule (review Minor 4). The review said keep it;
  keep it.
- Any change to the four arrow bindings, the deferral set, or `select-all`'s behaviour.

### Commit

```bash
git add src/web/packages/editor/src/canvas-nudge.ts \
  src/web/packages/editor/src/canvas-nudge.dom.test.ts \
  src/web/packages/editor/src/editor-session.ts \
  src/web/packages/editor/src/shortcut-manager/index.dom.test.ts \
  STATUS.md
git commit -m "refactor(editor): extract the nudge burst, and test its wiring"
```

End the commit message with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

Then append a fix report to your report file: what you changed, every command you ran, and the raw
output — including both teeth-check failures, the `wc -l` numbers, and the browser test result.
Reviewers do not re-run tests for you; your report is the test evidence.

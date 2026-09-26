### Task 6 — fix round 2

Round 1 is closed: its re-review found all findings addressed with no new Critical or Important
breakage, and confirmed your two teeth checks bite. This round is one Minor from that re-review that I
am choosing to spend a cycle on rather than park, because it is a shipped user-visible defect and not
just dead surface.

---

#### The finding: `endBurst` is exported with no caller, and the comment describes behaviour that does not exist

Measured, and the re-reviewer measured it independently:

- `canvas-nudge.ts:32` declares `endBurst`, `:96` returns it. **Grep across `src/web` finds no
  caller** — production or test. Its only execution path is the idle timer at `:86`.
- The retained comment at `:66-67` says the burst ends "on the idle window **or on any other
  action**". Nothing implements the second half.

#### Why this is worth a round, when the reviewer rated it Minor

The plan's own text documents the consequence as a **measured** symptom
(`docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md:1309`):

> A `Control+z` inside the 300ms window does nothing, because `release` has not run and no entry exists
> yet — measured: the object stays at `before + 11` and the undo is a silent no-op.

So today: nudge an object, press Ctrl+Z within 300 ms, and **nothing happens**. Press it again and it
works. The plan's remedy was a `waitForTimeout(400)` in the browser test — the test waits out a window
in which the shipped editor ignores the author's keystroke.

**Fix the mechanism, not the wait.** Wire `endBurst` into the undo/redo handlers so any history
operation closes an open burst first.

#### Step 1: Wire it

In `editor-session.ts`, the two handlers registered as `"edit.undo"` and `"edit.redo"` (find them by
those ids, not by line — a concurrent task is editing this file above them):

```ts
this.#shortcuts.register("edit.undo", () => {
  void options.shell.editor.historyManager.undo();
});
this.#shortcuts.register("edit.redo", () => {
  void options.shell.editor.historyManager.redo();
});
```

Add `this.#nudge.endBurst();` as the **first** statement of each. `#nudge` is declared
`readonly #nudge: CanvasNudge` and assigned by the `createCanvasNudge` call that follows these
registrations — that forward reference is fine, the callbacks run later, which is the same pattern the
four nudge registrations below it already rely on.

Add a one-line comment saying **why** the close comes first: a burst's entry is not recorded until it
closes, so an undo before the idle window finds nothing to step back to.

Do not change `canvas-nudge.ts`'s behaviour. The comment there is already correct once this caller
exists — that is the point of this fix.

#### Step 2: Test the wiring, and prove it has teeth

The seam to drive is `editor-session.dom.test.ts`. It already mocks `ShortcutManager` with
`register = vi.fn()`, so the registered handlers are recoverable from `register.mock.calls` — read the
`(id, handler)` pairs and invoke the `edit.undo` one directly.

Write a test that:

1. Captures the registered handlers from the `ShortcutManager` mock's calls.
2. Invokes the `canvas.nudge-right` handler (or any nudge) **twice**, so a burst is open.
3. Invokes the `edit.undo` handler.
4. Asserts the burst closed — observable through the history double as exactly one `saveState` call,
   and the suspension released.

Read the existing test file first and follow its fixture style — it already builds an editor double
and mocks `./shortcut-manager/index.js` at the top. Do not invent a new harness if its fixture reaches
`canvas.getActiveObject()`; if the existing double cannot support this, adapt it minimally and say in
your report what you had to add.

**Teeth check, and report the measured output verbatim: delete the `endBurst()` call from the
`edit.undo` handler and confirm the new test fails on its own assertion line.** Then restore it. A test
that stays green with the call removed has not tested the wiring — that is the exact defect round 1
existed to fix, and it would be embarrassing to reintroduce it in the round written to close it.

**If the capture-the-handler route turns out to be impractical**, do not ship a weaker test to
compensate. Report that instead, with what blocked it, and leave the wiring in place — I would rather
have the fix with an honest gap than the fix with a test that cannot fail.

#### Step 3: Run and verify

```bash
cd src/web
npx vitest run packages/editor/src/canvas-nudge.dom.test.ts packages/editor/src/editor-session.dom.test.ts
npm run typecheck && npm run lint && npm run format:check
npm run status:check
wc -l packages/editor/src/editor-session.ts
```

Then rebuild and re-run the browser test this task owns, because it currently encodes the symptom as a
wait:

```bash
npm run build && npx playwright test --project=desktop-chromium --grep "nudges the selection" --workers=1
```

**Now try removing the `await page.waitForTimeout(400)` and its comment block** from that test and run
it again. The presses-to-undo gap is ~37 ms (measured in round 1), well inside the 300 ms window, so
with this fix the assertions should pass **without** the wait. Report both results:

- If it passes without the wait: **remove the wait and the comment**, because the comment now documents
  a defect that no longer exists — leaving it would tell the next reader the editor still ignores a
  fast Ctrl+Z. Say so explicitly in your report and in `STATUS.md`.
- If it fails without the wait: **restore the wait and report it**, with the failure output. That means
  my ruling was wrong and the burst is still open when the undo arrives; leave the wait in place and I
  will re-rule.

Do not remove the wait unless the test genuinely passes without it.

#### Step 4: `STATUS.md`

Update "Last completed change" for this round and run `npm run status:check`.

### Commit

Stage explicit paths only — `canvas-nudge.ts` if you touched it, `editor-session.ts` (or its test
file), `src/web/tests/e2e/editor.spec.ts` if the wait came out, and `STATUS.md`:

```bash
git add src/web/packages/editor/src/editor-session.ts \
  src/web/packages/editor/src/editor-session.dom.test.ts \
  src/web/tests/e2e/editor.spec.ts \
  STATUS.md
git commit -m "fix(editor): close an open nudge burst on undo"
```

End the commit message with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

Then append a fix-round-2 section to your report file: what changed, every command, the raw teeth-check
failure, and both browser-test results (with and without the wait).

### Not in scope

- `canvas.front` / `canvas.back` having no test. Parked for Task 10, which owns the e2e file.
- The nudge module's double not exercising the `ActiveSelection` / `locked` branches. Parked — that is
  moved-unchanged code.
- Any further change to the extraction itself. Round 1's re-review verified it behaviour-preserving;
  leave it alone.

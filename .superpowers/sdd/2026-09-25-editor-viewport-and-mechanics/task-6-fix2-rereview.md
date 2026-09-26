# Task 6 — fix round 2 re-review (69e5121..aad9d5f)

Reviewed commit `aad9d5f`. Sources read directly: `editor-session.ts`,
`editor-session.dom.test.ts`, `canvas-nudge.ts`, `tests/e2e/editor.spec.ts`.

## Verdict

1. **Step 1 wiring — ADDRESSED.** `editor-session.ts:278-283` (`edit.undo`): line 281
   `this.#nudge.endBurst();` is the first statement, line 282 the `undo()` call, with the
   why-comment at 279-280 ("a burst's entry is not recorded until it closes, so an undo inside
   the idle window would find nothing to step back to"). `editor-session.ts:284-287`
   (`edit.redo`): line 285 is first, line 286 `redo()`. Forward reference is safe: `#nudge` is
   assigned at 333-336, after registration, and the callbacks run later — same pattern the four
   nudge registrations at 341-352 already use.
2. **Step 2 real seam — ADDRESSED.** `editor-session.dom.test.ts:9` hoists `registerMock`
   (`vi.fn()`), the `ShortcutManager` mock's `register` is that shared mock (line 40), reset in
   `beforeEach` (line 59). The test recovers pairs at 392 from `registerMock.mock.calls`, throws
   if absent (393), and invokes the recovered `edit.undo` handler at 407 — the real registered
   closure, not a re-implementation. `canvas.nudge-right` is likewise recovered (400-401), so
   both sides of the seam are the production handlers.
3. **Step 2 teeth — ADDRESSED (credible).** See answers below: the unit assertion is causally
   dependent on `endBurst()`, and the e2e assertion is reachable only through the wiring.
4. **Step 3 wait removed — ADDRESSED.** No `waitForTimeout` remains in this test; the only two in
   the file (1591, 1593) belong to the preceding capture test. The four-line comment that
   documented the silent-no-op defect is gone, replaced at 2221-2222 by a comment describing
   shipped behaviour ("the burst's entry is not recorded until it closes, so the undo binding must
   close it first") — accurate.
5. **No collateral change — ADDRESSED.** `git rev-parse HEAD~1:...canvas-nudge.ts` =
   `git rev-parse HEAD:...` = `git hash-object <worktree>` = `edc98f5a1606cadf923783d6aac217cb8f94083a`.
   `git diff --exit-code HEAD -- canvas-nudge.ts` exits 0. (`git status` reports ` M` on that path
   — a stat-cache/mtime artifact, not a content change; the hashes and `diff --exit-code` disagree
   with status and agree with each other.)

Commit contains exactly the four expected files (99 insertions / 21 deletions): STATUS.md,
`editor-session.dom.test.ts`, `editor-session.ts`, `tests/e2e/editor.spec.ts`. No deleted tests,
no weakened assertions elsewhere, no unrelated edits. `git diff HEAD -- src/web/packages/editor/src
src/web/tests` is empty.

## Findings

None Critical, none Important.

- **Minor — the unit test pins both effects but not their order.**
  `editor-session.dom.test.ts:407-411`. The test asserts `endBurst` ran (saveState === 1,
  suspended === 0) and that `undo` ran, but nothing enforces that the close precedes the undo.
  Failure scenario: move `this.#nudge.endBurst();` below `void ...undo()` in the `edit.undo`
  handler — the unit test stays green (all four assertions still hold, since `undo()` is invoked
  synchronously by the handler and the double does not care), while the shipped defect returns
  (undo steps past nothing, then records the entry). Ordering's only teeth is the e2e assertion at
  `tests/e2e/editor.spec.ts:2224`. Cheap tightening if wanted: assert order via a shared call log,
  e.g. `expect(undo.mock.invocationCallOrder[0]).toBeGreaterThan(saveState.mock.invocationCallOrder[0])`.
- **Minor — pre-existing timing fragility in the e2e is unchanged, not introduced.**
  `tests/e2e/editor.spec.ts:2216-2224`. The two presses must land inside one 300 ms window; on a
  loaded CI box where the gap exceeds `NUDGE_IDLE_MS`, they become two entries, the post-undo
  position is `before + 1` and line 2224 fails. The removed `waitForTimeout(400)` sat *after* both
  presses and never protected this gap, so removing it does not worsen the exposure — and for the
  undo step itself the removal makes the test strictly more robust, since the burst is now closed
  by the handler rather than by elapsed time.

## Answers to the three specific questions

1. **Does the fixture distinguish "burst closed" from "burst never opened"?** Yes.
   `editor-session.dom.test.ts:402` asserts `suspended === 1` before the undo — a vacuous fixture
   (nudge handler a no-op, or `nudgeBy` early-returning because `getActiveObject()` is undefined)
   would read 0 there and fail before reaching the assertions under test. `403` additionally pins
   `saveState` untouched while the burst is open, so the single call at 408 cannot be attributed to
   the nudge presses. The `suspend` double is self-referential (`suspended` counter closed over,
   release idempotent via the `released` latch), so it mirrors the real counter rather than
   reporting a fixed value.
2. **Can the two `nudge-right` presses be no-ops while the assertions still pass?** No, for the
   same reason: `402` is the guard. The lazily-armed `selection.active` (set at 399, only after the
   session has constructed) means `getActiveObject()` returns `undefined` during construction (so
   the selection inspector never sees a partial stub) and the object afterwards — `nudgeBy`'s
   "suspend only with a selection" guard therefore *does* suspend, which is what `402` measures.
   If the arming broke, `402` would fail rather than pass vacuously. One residual: the test does not
   assert the object moved (`setPositionByOrigin` is a `vi.fn()` and uncounted); movement is covered
   by `canvas-nudge.dom.test.ts` case 3, so this is not a gap in this diff.
3. **Is the e2e comment accurate about shipped behaviour?** Yes. Lines 2221-2222 describe the
   mechanism the diff installs (the burst's entry exists only once it closes, so the undo binding
   must close it first) and no longer claim the editor ignores a fast `Control+z`. The stale
   claim — "the object stays at `before + 11` and the undo is a silent no-op" — is gone. The
   redo comment at 2225-2226 (two presses = one entry) remains correct.

## Could not verify

- The **e2e assertions were not re-run** here (read-only; a rebuild plus browser run is outside this
  review's scope). Both browser results — pass without the wait, and `Expected: 0 / Received: 11`
  at `editor.spec.ts:2224` with `endBurst()` deleted — are taken from the implementer's report.
  The report's unit-test teeth output (`expected 1 to be +0`, `editor-session.dom.test.ts:414`) does
  not match the current file: line 414 is `});`, and `expect(suspended).toBe(0)` is at **410** in the
  committed file. The assertion text and the described cause are consistent (the file grew by one
  comment line relative to the run), but the line number in the report is stale by four lines.
- Whether the un-modified `waitForTimeout` sites at `editor.spec.ts:1591,1593` are still needed is
  outside this brief (different test, different mechanism).
- `npm test` / `typecheck` / `lint` / `status:check` were not re-run; STATUS.md is 58 lines, under
  the 70-line cap.

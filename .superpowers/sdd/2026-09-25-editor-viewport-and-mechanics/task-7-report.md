# Task 7 report: Group entry

Commit: `fb3aa92` — `feat(editor): enter and exit a group from the canvas`

## Files changed, and why

### `src/web/packages/editor/src/grouping-manager/index.ts` (core)

- `GroupingManager` gains `enterGroup`, `exitGroup`, `groupContext` (transient selection
  state, §67 — never persisted, never history).
- `context` array + `flagsSet` Set: `flagsSet` records which groups *this manager* flagged,
  so `exitGroup` restores only those and leaves an author's own flags alone.
- `makeSelectableThrough` / `clearThroughFlags`: the `subTargetCheck` + `interactive` pair.
- `enterGroup`:
  - entry target is `ownerGroup(object) ?? object`, so entering a child keeps the context at
    `[group]` rather than pushing (the brief's own rule).
  - **the entry group is armed before the child is resolved, and the child is re-resolved
    from `scenePoint`.** This is the load-bearing correction to the brief; see "Brief
    corrections" below.
  - context recorded *before* `setActiveObject`, because that fires `selection:created`
    synchronously and the bridge re-reads the layer tree on it.
- `ungroup` clears the context, drops the group from `flagsSet` and resets its two flags, so
  a later `exitGroup` cannot re-select a destroyed object.
- `onHistoryLoaded` (on `editor:history-state-loaded`): `loadFromJSON` builds *new* Group
  instances, so the recorded context points off-canvas. Re-resolves by id via `findById`,
  re-arms the pair, clears the stale flag record.

### `src/web/packages/editor/src/editor-shell.ts`

`createGroupingManager(...)` hoisted to `const grouping`; a `mouse:dblclick` listener calls
`grouping.enterGroup({ object: event.target, scenePoint: event.scenePoint })`; `destroy()`
removes it. `text-manager` owns the same event and returns early for a non-`IText` target, so
both listeners coexist. `Point` added to the `fabric/es` import.

### `src/web/packages/editor/src/shortcut-manager/index.ts`

`"view.exit-group"` added to `ProductShortcutId`; new `CONTEXT_SHORTCUTS` array holding
`{ key: "escape", modifier: false, action: "view.exit-group" }`; `bindingFor` searches
`[...PRODUCT_SHORTCUTS, ...CONTEXT_SHORTCUTS]`. It is *not* in `PRODUCT_SHORTCUTS` (no menu
displays it), and it needs no deferral entry: an unmodifiered binding already defers whenever
`isTextEntryTarget(event.target)`.

### `src/web/packages/editor/src/editor-session.ts`

`this.#shortcuts.register("view.exit-group", () => options.shell.editor.groupingManager.exitGroup())`.

### `src/web/packages/editor/src/canvas-nudge.ts` (+ its two test doubles)

`getCenterPoint()` → `getRelativeCenterPoint()`. See "Defect found" below. `canvas-nudge.dom.test.ts`
and `editor-session.dom.test.ts` stubs renamed to match.

### `src/web/packages/editor/src/shortcut-manager/index.dom.test.ts`

New `describe("ShortcutManager context bindings")`: Escape dispatches `view.exit-group` and sets
`defaultPrevented`; Escape dispatched on a `<textarea>` does not fire it.

### `src/web/packages/editor/src/grouping-manager/group-entry.dom.test.ts` (new)

The brief's two tests, with two corrections (below).

### `src/web/tests/e2e/editor.spec.ts`

The brief's Step 6 test, with corrections (below).

### `STATUS.md`

"Last completed change" replaced.

Not touched: `editor-interaction.ts` — as the correction states, it only consumes the interface.

## Commands and results

| Command | Result |
|---|---|
| `npx vitest run packages/editor/src/grouping-manager packages/scene-fabric/src/persist.dom.test.ts` | PASS — 3 files, 38 tests |
| `npm test` | PASS — 125 files, 1330 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — 320 files |
| `npm run format:check` | PASS (after `biome format --write` on the two files I had touched) |
| `npm run build` | PASS |
| `npm run status:check` | PASS |
| `npx playwright test --project=desktop-chromium --grep "enters a group" --workers=1` | PASS (4.5s) |

## Teeth check 1 — dropping the post-restore re-apply

Commented out `canvas.on("editor:history-state-loaded", onHistoryLoaded)`, rebuilt, reran. Raw
output from `test-results/.../error-context.md`:

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

That is the brief's `inCanvas` identity poll (`expect.poll(inCanvas).toBe(true)`) — the assertion
the regenerated brief added, and the only one that separates a re-resolved group from the destroyed
instance. Restored, rebuilt, re-ran: PASS.

(The obsolete `Control+z` witness does *stay green* when the re-apply is dropped, exactly as the
correction predicted.)

## Teeth check 2 — removing `ungroup()`'s context-clearing

Removed the four clearing lines. Ran `npx vitest run packages/editor/src/grouping-manager`:

```
 FAIL  packages/editor/src/grouping-manager/group-entry.dom.test.ts > group entry > clears the context when the group is ungrouped
AssertionError: expected [ v{ __eventListeners: {}, …(83) } ] to deeply equal []

- Expected
+ Received

- []
+ [
+   {
+     "angle": 0,
...
+     "interactive": true,
...
+   }
+ ]

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 6 passed (7)
```

Note on the correction's exact wording: the failure lands on the earlier
`expect(manager.groupContext()).toEqual([])`, not on the final
`expect(manager.exitGroup()).toBeUndefined()` the brief now names — the earlier assertion fires
first and aborts the test. Same guard, same green → red. Restored: PASS.

## Browser / render evidence

Driven against the built editor preview on `127.0.0.1:4174` with the test's own fixture:

- before any gesture: `active: null, subTargetCheck: false, interactive: false`
- after one double-click at artboard (55, 55): `active: "child", subTargetCheck: true, interactive: true`
- after `ArrowRight` then `Control+z`: `childLeft` `0 → 1 → 0`, `active` back to `child`
- after Escape on the canvas: `active: "grp"`, both flags back to `false`,
  `getObjects().includes(getActiveObject()) === true`
- Escape deferral, confirmed live rather than asserted in code: with a Design-panel `<input>`
  focused, Escape left the context untouched (`active: "child"`); pressed on the canvas it exited.

Rendered inspection (screenshot, not an object count): the layer tree shows `grp` expanded with
`child` highlighted, and the selection handles sit on the inner 30×30 rect inside the 320×180
artboard, with `outside` untouched at the right.

## Brief corrections — things the brief got wrong

The coordinator supplied two corrections mid-task (Step 7's `git add` list gained `editor-shell.ts`
and `shortcut-manager/`, dropped `editor-interaction.ts`; Step 6's teeth checks were re-pointed at
the `inCanvas` poll and the unit test). Beyond those, the following did not hold as written:

1. **Step 6's single `page.mouse.dblclick` cannot resolve to the child by itself.** Fabric hit-tests
   the pointer *before* `enterGroup` runs, and a group is opaque to a pointer until
   `subTargetCheck`/`interactive` are set — so the entering gesture's own target is always the
   group. Armed twice experimentally: with the flags off, `searchPossibleTargets` returns `grp`;
   with them on, it returns `child`. An implementation that only armed the flags would need a
   *second* double-click to reach the child. So `enterGroup` takes the event's `scenePoint` and
   re-resolves the deepest target from it once the flags are on. This matches the spec's own
   acceptance wording ("Double-clicking a group selects the child **under the pointer**").
   The unit test's second `enterGroup({ object: child })` call is the *other* path (the flags are
   already on from the first call), which is why the brief's unit test never caught this.
2. **Step 6's fixture is rejected by the validator.** A raw `fill` with no `vigiliaPaint` palette
   reference fails `writeThemePackage` with `fill must reference an existing palette token through
   vigiliaPaint.`; the fixture now declares `globals.palette` and `vigiliaPaint`, like every other
   fixture in the spec.
3. **Step 6's Group revives 0×0.** With no `width`/`height` the group's `aCoords` collapse to a
   single point (all four corners at `40,40`), so `_checkTarget` finds nothing and the gesture never
   starts. Added `width: 30, height: 30`.
4. **`expect(before).toBeTypeOf("number")` is Vitest's matcher.** Playwright's `expect` has no
   `toBeTypeOf`; replaced with `expect(typeof before).toBe("number")`.
5. **Step 1's `new Group([child], { id: "group" })` does not typecheck** (`id` is not a
   `Partial<GroupProps>` key) — `group.set("id", "group")`, as `index.dom.test.ts` already does.
6. **Step 1's second test is internally inconsistent.** Its comment says "activate it before
   entering — entering a group does not make it the canvas's active object", but the fixture never
   activates the group; `enterGroup({ object: child })` leaves the *child* active, so the
   Group-precondition in `ungroup()` fails and `ungroup()` returns `undefined`. Added the missing
   `canvas.setActiveObject(group)` with a comment naming the inconsistency.
7. **Step 5's `TEXT_ENTRY_DEFERRED_ACTIONS` does not exist**; the real symbol is
   `MODIFIED_KEY_DEFERRED_ACTION_IDS`, and it is consulted only for modifier bindings — an
   unmodified binding defers unconditionally. The regenerated brief already says this.

## Defect found and fixed in Task 6's code

`canvas-nudge`'s `nudge()` read `object.getCenterPoint()` and wrote `setPositionByOrigin(...)`.
For a grouped child those are different planes: `getCenterPoint()` maps the centre through the
group's transform matrix (`index.node.cjs:5473-5476`) while `setPositionByOrigin` writes the
object's *local* `left`/`top`. So `ArrowRight` inside an entered group moved the child from
`left: 0` to `left: 41` instead of `1` — the observed e2e failure was `Expected: 1, Received: 41`.
`getRelativeCenterPoint()` is the matching plane and is identical for an ungrouped object, so
Task 6's own tests are unaffected. This was not reachable before Task 7: no prior path let a
grouped child be the active object. I changed it rather than weakening the e2e assertion.

## Unverified

- The `dropping-the-re-apply` teeth check was run against the *old* brief's witness too, and it
  stayed green — reported above as expected, not as a pass.
- Nothing else in the browser test was run against the other Playwright projects; the test is
  `desktop-chromium`-gated by the brief.
- Screenshots are on-disk evidence only, not staged golden files (the three modified screenshots in
  `git status` belong to other tasks and were left unstaged).

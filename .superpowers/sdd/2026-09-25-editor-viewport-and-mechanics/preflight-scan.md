# Pre-flight conflict scan — `2026-09-25-editor-viewport-and-mechanics`

Read-only. Plan scanned: `docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md`
(1099 lines, 11 tasks). Binding spec: `docs/superpowers/specs/2026-09-25-editor-viewport-and-mechanics.md`.

Every claim below was confirmed against source in the working tree with `file:line`.
**Working-tree state at scan time:** HEAD `68d9b68` — the sibling UI-polish plan's Tasks 1–2
(`object-actions.ts`, `ui-copy.ts`, `editor-shell/bridge.ts` rewritten, `canvas-dock.tsx` routed
through the registry) have **already landed**. Conclusions are based on shell-verified content,
not the session-start snapshot.

---

## Table 1 — Pair scan (tasks sharing a file or an interface)

| Tasks | Shared surface | Produces → Consumes | Found |
|---|---|---|---|
| 1 ↔ 2 | `ViewportManager`, `createViewportManager`; `editor-shell.ts` | T1 `zoom/zoomToPoint/zoomBy/zoomToFit/zoomToSelection/reset/panBy/resize/destroy` → T2 | Consistent method-by-method. T2's Files list omits `editor-shell.dom.test.ts`, which its own Step 6 `git add`s. |
| 1 ↔ 3 | `ViewportManager` | T3's `bindViewportNavigation` stub → T1 | **D1**: the stub (plan:447-457) omits `onChange`, and no Stub is ever compiled against `ViewportManager`. |
| 1 ↔ 4 | `ViewportManager` | T4 adds `onChange(listener): () => void` (plan:621) → T1's Produces block (plan:55-72) does not contain it | **D1** confirmed. T4's Files list also has no `viewport-manager/**` path. |
| 1 ↔ 10 | `ViewportManager` method set; `guide-renderer.ts:37` | T10 consumes the camera | Method set consistent. Self-Review (plan:1094) "identical in Tasks 1, 3, 4, 10" is false once `onChange` exists. |
| 2 ↔ 4 | `EditorShellBridge` — owner is `src/web/packages/editor/src/editor-shell/bridge.ts:24` | T4 produces `readonly viewport: ViewportManager \| undefined` (plan:593) → nothing | **D2**: the owning file and `editor-main.ts:166` (`layout.setBridge`) are absent from T4's Files list. |
| 2 ↔ 5 | `editor-shell.ts`, `editor-shell.css`, `tests/e2e/editor.spec.ts` | T2 removes artboard sizing → T5 removes the covering rect | **D3**: T5 blames the plate that is already non-interactive and names T2's cause explicitly; the real gripper is `header-wash`. |
| 2 ↔ 8 | `fitCanvasViewport` / `fitArtboardViewport` | T2 deletes both (plan:390-391) | Clean — no other consumer (`editor-shell.ts:94,118,125,278,286,301,353,381` only). |
| 4 ↔ 7/9 | `EditorShellBridge` members | T4 adds `viewport`, T8 adds `groupContext()` | T8 names `bridge.ts` in its Files; T4 does not. |
| 6 ↔ session/history | `ProductShortcutId` (`shortcut-manager/index.ts:2-13`), `editor-session.ts`, `history-manager` | T6 registers 7 new ids | **D4** (`canvas.nudge-left-large` is not in T6's own Produces union) and **D8** (coalescing rule vs. the e2e undo assertion). |
| 7 ↔ 8 | `GroupingManager.groupContext()` | T8 consumes it, and types it `readonly string[]` | **D5**: T7 produces `readonly FabricObject[]` (plan:809). |
| 7 ↔ 8, 9 ↔ | `editor-shell/layer-panel.tsx` | T8 modifies it | **D6**: the file does not exist yet; it is created by UI-polish Task 5. Plan:13 says the dependency is "only for Task 11's context menu". |
| 9 ↔ dock | `actionEnabled`, `OBJECT_ACTIONS` (`object-actions.ts:73-79`) | T9 "call `actionEnabled` for each, do not re-derive eligibility" (plan:968) | **D7**: `actionEnabled(gate, id)` reads `gate.target()`/`gate.canArrange` only — there is no `can`. |
| 5, 6, 10 ↔ e2e | `tests/e2e/editor.spec.ts` | Three tasks append to one file | Sequencing fine; each commits it in its own step. |
| 11 ↔ all | full gate, report-only | — | Clean. |

---

## Table 2 — Self-consistency scan (one row per task)

| Task | Self-consistent? |
|---|---|
| 1 camera module | **No — D1** (`onChange` produced by T4, absent here) and **D9** (`getScenePoint({x,y})` cannot pass). Pan-bounds arithmetic verified internally consistent (all four cases). |
| 2 canvas becomes viewport | **No — D2/D10**: Step 1 says "(create it if absent)" for a file that exists (with a load-bearing `getContext` proxy); Files list omits it; the `git add` includes it. |
| 3 navigation gestures | Yes for its own text, with two caveats (see U2/U4): `shift+1` vs `bindingFor`'s `toLowerCase`, and a finite-number assertion that is weaker than the claim. |
| 4 zoom readout | **No — D1/D2**. Its test (plan:532-542) asserts `toHaveBeenCalled()` on an untyped `as never` object, so it cannot catch the missing `onChange`. |
| 5 reachable marquee | **No — D3** and **D11**: Step 1's drag starts at `(30,60)` while its own comment says "well outside the artboard"; Step 3's "if the plate is still evented" branch is dead code. |
| 6 keyboard nudge | **No — D4** (`nudge-left-large`) and **D8** (undo assertion after two distinct presses). |
| 7 group entry | **No — D5** (return type). Also **D7a**: Step 3 says "add `ungroup()` clears the context … it is asserted below", but Step 1's test never asserts it. |
| 8 layer tree follows group context | **No — D5/D6**. Dependency on the UI-polish plan *is* declared. |
| 9 canvas context menu | **No — D7**. |
| 10 snapping at non-1 zoom | Yes for its own text; Step 3's `guide-renderer.ts:37` citation is exactly right (`context.lineWidth = GUIDE_WIDTH / zoom;`). Test body is a comment only (see U3). |
| 11 full gate | Yes. Note plan:13 mislabels the dependent task as "Task 11's context menu" — the context menu is Task 9; Task 11 is the gate. |

---

## Confirmed defects

### D1 — `ViewportManager.onChange` is added by Task 4 but owned by Task 1, and Task 4 may not edit Task 1's file
- Plan: **Task 1** Interfaces, lines 55-72 (the produced `ViewportManager` block) and **Task 4** Step 3, line 621: "add `onChange(listener): () => void` to `ViewportManager`".
- Task 1's Produces block lists `zoom/zoomToPoint/zoomBy/zoomToFit/zoomToSelection/reset/panBy/resize/destroy` — no `onChange`.
- Task 4's Files list (plan:585-589) is `zoom-readout.tsx`, `zoom-readout.dom.test.tsx`, `shell-layout.tsx`, `editor-shell.css`, `ui-copy.ts` — no `viewport-manager/index.ts`.
- Evidence the interface is the only source: `src/web/packages/editor/src/viewport-manager/` does not exist yet; Task 1 Step 4 expects `npx vitest run packages/editor/src/viewport-manager/...` to PASS, so the implementer's `ViewportManager` will be whatever Task 1 wrote.
- Consequence: Task 4 has no file in which it is allowed to add the method, and Task 1's implementer (running first) has no reason to declare it.
- Worst part: the Task 4 test (plan:532-542) passes `{ zoom, zoomToFit } as never`, so no compile error surfaces. The readout simply never subscribes → a **silently wrong feature**.
- Smallest correction: add `onChange(listener: () => void): () => void;` to Task 1's `ViewportManager` block (and to the T3 stub), and add `src/web/packages/editor/src/viewport-manager/index.ts` to Task 4's Files list. Alternatively drop `onChange` and have `ShellLayout.setBridge` carry the camera.
- Caught by: **nothing** as printed — the cast to `never` defeats type checking.

### D2 — Task 4 adds a member to `EditorShellBridge` without naming the file that owns it
- Plan: Task 4 Interfaces, lines 592-593: "`EditorShellBridge` gains `readonly viewport: ViewportManager | undefined`".
- Real owner: `src/web/packages/editor/src/editor-shell/bridge.ts:24` (`export interface EditorShellBridge` — verified; the sibling plan has already rewritten this file).
- Real construction site: `src/web/packages/editor/src/editor-main.ts:166` (`layout.setBridge(bridge, viewControls)`).
- Neither path appears in Task 4's Files list (plan:585-589).
- Consequence: an implementer following the Files list edits `shell-layout.tsx` and never adds the member, or adds it somewhere else. Task 8, by contrast, correctly lists `editor-shell/bridge.ts` (plan:889), so the two tasks disagree about where the interface lives.
- Smallest correction: add `src/web/packages/editor/src/editor-shell/bridge.ts` to Task 4's Files list and to its `git add`.
- Caught by: **compile error**, but only where a bridge literal is checked (Task 5 of the UI-polish plan).

### D3 — Task 5 blames the wrong object; its drag starts inside a selectable object
- Plan: Task 5, line 654: "the canvas was exactly the artboard and a full-bleed background rect covered it"; Step 1 line 668 comment: "Start well outside the artboard, in the pasteboard"; Step 1 line 669: `await page.mouse.move(30, 60);`; Step 3 line 686: "if the plate is still evented, set `evented: false` on it in the theme fixture".
- Real source: `src/web/packages/editor/src/new-fabric-theme.ts:15-19` already defines `backgroundOnly = { ...positioned, selectable: false, evented: false }`, and the plate uses it at `new-fabric-theme.ts:320-330` (`rect("background", 0, 0, 1280, 720, twilightGradient, 0, backgroundOnly, "scene")`). The Step 3 branch is dead code.
- The object that actually occupies `(30,60)` is `header-wash`: `new-fabric-theme.ts:331` — `rect("header-wash", 0, 0, 1280, 142, "#06101a70", 0)`. Its `interaction` argument falls through to the helper default `positioned` (`new-fabric-theme.ts:549`), which does **not** set `selectable: false` / `evented: false`, so it is fully selectable and evented. It spans artboard x 0..1280, y 0..142 — screen y 0..142 at any zoom.
- Consequence: the drag grabs and moves `header-wash`, exactly the failure Step 2 says it expects — so the "make it fail, then pass" evidence loop proves nothing about the marquee.
- Smallest correction: start the drag where no interactive object exists (e.g. `page.mouse.move(20, 300)` — below `header-wash`'s 142px band and left of the 1280px artboard once Task 2 has unclamped the canvas), and name `header-wash` rather than the plate in Step 3.
- Caught by: **silently wrong test** — it fails for the wrong reason and passes for the wrong reason.

### D4 — Task 6's own test registers a shortcut id its Produces union does not declare
- Plan: Task 6, line 715 (Produces): `"canvas.nudge-left" | "canvas.nudge-right" | "canvas.nudge-up" | "canvas.nudge-down" | "canvas.select-all" | "canvas.front" | "canvas.back"`. Line 741 registers `manager.register("canvas.nudge-left-large", large);`.
- Real signature: `src/web/packages/editor/src/shortcut-manager/index.ts:82` — `register(action: ProductShortcutId, handler: ShortcutHandler): void`.
- Consequence: `"canvas.nudge-left-large"` is not a member of `ProductShortcutId` → TS2345. There is also no `canvas.nudge-left-large` binding in `PRODUCT_SHORTCUTS` (`shortcut-manager/index.ts:23-36`), so the handler could never fire.
- Smallest correction: either add `"canvas.nudge-left-large"` (and the other three large variants) to the Produces union, or drop it from the test and assert the plain/large distinction inside one handler that reads `event.shiftKey`.
- Caught by: **compile error.**

### D5 — Tasks 7 and 8 disagree about `groupContext()`'s return type
- Plan: Task 7 Interfaces, line 809: `readonly groupContext: () => readonly FabricObject[];` (and Task 7 Step 1 line 833: `expect(manager.groupContext()).toEqual([group]);`).
- Plan: Task 8 Step 3, line 895: "Add `groupContext(): readonly string[]` to `EditorShellBridge` (ids, not objects — the projection rule holds)."
- These are two different interfaces (`GroupingManager.groupContext` vs `EditorShellBridge.groupContext`), so the type itself is defensible — but Task 8's Files list includes `bridge.ts` (plan:889) while Task 4's does not, and Task 8 never says *which* `groupContext` it is calling or that it must map objects to ids. The bridge does hold `editor: EditorInteraction` (verified in the working tree), so the projection is available.
- Consequence: an implementer can put `readonly FabricObject[]` on the bridge and then hit TS2322 against Task 8's own `groupContext: () => ["group"]` test fixture.
- Smallest correction: state in Task 8 Step 3 that the bridge's `groupContext()` derives ids from `this.editor.groupingManager.groupContext().map((o) => o.id)`, and name the two signatures explicitly.
- Caught by: **compile error** at the test fixture.

### D6 — Task 8 targets a file that only exists after the sibling plan, and plan:13 understates the dependency
- Plan: Task 8 Files, lines 887-888: `src/web/packages/editor/src/editor-shell/layer-panel.tsx` and `.../layer-panel.dom.test.tsx`; Step 2 line 910 and Step 5 line 925-926 use those paths.
- Real source: the panel is `src/web/packages/editor/src/layer-panel.ts` (238 lines, verified) with `src/web/packages/editor/src/layer-panel.dom.test.ts`; `src/web/packages/editor/src/editor-shell/layer-panel.tsx` does not exist (nor does `editor-shell/layer-tree.ts`, which UI-polish Task 3 creates).
- Plan:13 says the dependency on the UI-polish plan is "only for Task 11's context menu"; the Self-Review (plan:1097) correctly says Tasks 8 and 9 require it. The two statements contradict each other, and the earlier one is the one an executor reads first.
- Consequence: run standalone, `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx` (Task 8 Step 2's exact command) matches no file.
- Smallest correction: fix plan:13 to "Tasks 8 and 9 here depend on the UI-polish plan; Tasks 1-7 and 10-11 do not", matching the Self-Review.
- Caught by: **no test files found** — loud, but only at Step 2.

### D7 — Task 9's test asserts a `can` gate that the mechanism it mandates does not have
- Plan: Task 9 Step 1, lines 947-956: `const can = (action: string) => action === "delete" || action === "duplicate";`, renders `<CanvasContextMenu bridge={bridge(rows, { can })} … />`, then `expect(items.sort()).toEqual(["Delete", "Duplicate"]);`.
- Plan: Task 9 Step 3, line 968: "call `actionEnabled` for each, do not re-derive eligibility."
- Real source: `src/web/packages/editor/src/object-actions.ts:73-79` —
  `actionEnabled(gate: ActionGate, id: ObjectActionId)` calls `objectAction(id).eligible(gate.target())` and, for `arrange:` ids only, `gate.canArrange(...)`. `ActionGate` (object-actions.ts:67-70) declares exactly `target` and `canArrange`. There is no `can` and the doc comment at 62-66 says a per-id `can` would only re-enter `actionEnabled`.
- The dock already does this: `src/web/packages/editor/src/editor-shell/canvas-dock.tsx` renders `OBJECT_ACTIONS.filter((action) => actionEnabled(bridge, action.id))`.
- With the UI-polish Task 5 stub's default `target()` (`{kind:"object",locked:false,memberCount:1,isGroup:false}`, ui-polish plan:714), `eligible` is true for `duplicate`, `copy`, `cut`, `delete`, `front`, `bring-forward`, `send-backward`, `back`, `lock`, `arrange:*` (8 of them) and `group`; only `unlock` and `ungroup` fail. So the rendered list is far larger than two entries and the assertion cannot pass through the mandated code path.
- (Labels do match: `uiCopy.actions.delete` = "Delete", `uiCopy.actions.duplicate` = "Duplicate". The defect is the gating mechanism, not the strings.)
- Smallest correction: make the fixture express eligibility instead of `can` — e.g. render `bridge(rows, { target: () => ({ kind: "object", locked: false, memberCount: 1, isGroup: false }) })` and assert the exact set that `OBJECT_ACTIONS.filter(...)` yields, or assert against `OBJECT_ACTIONS.filter((a) => actionEnabled(bridge, a.id)).map((a) => a.label)` rather than a hand-written two-element literal.
- Caught by: **silently wrong test** — it fails as written, but the "fix" an implementer is tempted to make is to re-derive eligibility in the menu, which is precisely what Step 3 forbids and Review Focus item 5 exists to prevent.

### D8 — Task 6's e2e asserts one undo restores two keystrokes
- Plan: Task 6 Step 3, line 763: "Nudge must coalesce: a held arrow key must not write one history entry per repeat." Step 5 lines 784-791: `press("ArrowRight")` → `left + 1`; `press("Shift+ArrowRight")` → `left + 11`; `press("Control+z")` → `expect(await left()).toBe(before)`. Step 5 line 797: "remove the single-save coalescing and confirm the undo assertion fails (it would take two undos to return)."
- The two assertion sets only agree if the coalescing window spans two distinct `press()` calls. Step 3 specifies coalescing only against *key repeat* of one held key; a per-gesture or per-keydown batching rule (which is what `history-manager`'s `suspend()` counter at `src/web/packages/editor/src/history-manager/index.ts:41-49` naturally gives) produces **two** entries for two presses, and one undo returns `before + 1`.
- Consequence: a correct implementation of the rule as written fails the test; passing requires an unspecified time- or gesture-window.
- Smallest correction: state the coalescing rule in Step 3 as "a burst of nudges is one history entry: open on the first nudge and close on a short idle window or on any other action", or change the final assertion to `before + 1`.
- Caught by: **silently wrong test** (timing-dependent flake, not a compile error).

### D9 — Task 1's "point under the cursor fixed" test cannot pass: `getScenePoint` is a DOM-event API
- Plan: Task 1 Step 6, lines 207 and 209: `const before = canvas.getScenePoint({ x: 400, y: 300 } as never);` and the same for `after`, then `expect(after.x).toBeCloseTo(before.x, 3);`.
- Real signature: `src/web/node_modules/fabric/dist/src/canvas/SelectableCanvas.d.ts:418` — `getScenePoint(e: TPointerEvent): Point;`. The implementation (`SelectableCanvas.mjs:616-619`, `_getPointerImpl` at 629-647) resolves the pointer through `getPointer(e)`, which is `new Point(event.clientX + scroll.left, event.clientY + scroll.top)` — see `fabric/dist/src/util/dom_event.mjs:14-17`. A bare `{ x, y }` has no `clientX`/`clientY`, so both `before` and `after` are `NaN`/`NaN`.
- `toBeCloseTo` never passes on NaN: `node_modules/vitest/dist/chunks/index.OVGXnVRj.js:2157-2169` computes `receivedDiff = Math.abs(expected - received); pass = receivedDiff < expectedDiff;` with only two ±Infinity special cases.
- Consequence: the test that Review Focus item 2 is mapped to fails regardless of the implementation.
- Smallest correction: dispatch a real `MouseEvent` with `clientX`/`clientY` (`canvas.upperCanvasEl.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 300, bubbles: true }))`) and read `canvas.getScenePoint(event)`, or assert the invariance directly with `canvas.sendPointToPlane`/`util.transformPoint` around `camera.zoomToPoint`.
- Caught by: **test always fails** — the assertion itself cannot be satisfied.

### D10 — Task 2 Step 1 says "(create it if absent)" for a file that exists and needs its `getContext` proxy
- Plan: Task 2 Step 1, line 361: `// append to src/web/packages/editor/src/editor-shell.dom.test.ts (create it if absent)`.
- Real source: `src/web/packages/editor/src/editor-shell.dom.test.ts` exists and its `beforeEach` (`editor-shell.dom.test.ts:9-29`) proxies `HTMLCanvasElement.prototype.getContext` to no-op `drawImage` and swallow `patternQuality`, with the comment "jsdom cannot drawImage an undecoded img inside Fabric's render pass". Without it the `mountEditorShell` tests in that file cannot render.
- Task 2's Files list (plan:350-352) omits this file while Step 6's `git add` (plan:411-415) includes it.
- Smallest correction: change the parenthetical to "the file already exists — add the case beside the existing `mountEditorShell` tests; keep the `getContext` proxy `beforeEach`", and list the file under Modify.
- Caught by: **nothing** — a passing suite with an added proxy, or a confusing failure if the proxy is dropped.

### D11 — Task 5's Step 3 branch is dead code, stated as a live fix
Covered by D3; recorded separately because it is the *instruction* that misleads, not just the fixture: plan:686 tells the implementer to set `evented: false` on the plate "if the plate is still evented" — `new-fabric-theme.ts:15-19` already does exactly that, so the instruction sends the implementer to edit a fixture that is already correct.

---

## Unverified suspicions (not findings)

- **U1 — `+`/`=` and `shift+1` for camera zoom (plan Task 3 Step 3, line 512).** `bindingFor` (`shortcut-manager/index.ts:40`) lowercases `event.key`, so `event.key === "!"` for shift+1; but Task 3 explicitly says these keys are **not** added to `PRODUCT_SHORTCUTS` and live in `navigation.ts`, whose key handling I have not read (the file does not exist). Whether the camera's own handler must lowercase I could not check. Low risk.
- **U2 — Task 3 Step 6's assertion does not test its own claim.** Plan:558-559 asserts only `Number.isFinite(transform[4])`/`[5]`. A finite-but-wrong translate passes, so the test cannot detect the clamped-pan regression Review Focus item 1 is mapped to. This is a weakness, not an incorrectness; I did not confirm whether any other test covers the clamp at e2e level (Task 1's `pan-bounds.test.ts` covers `clampPan` as a pure function, not its use by `panBy`).
- **U3 — placeholder bodies.** Plan Task 5 line 675 (`page.evaluate(() => { /* same read */ })`), Task 6 line 782 (`page.evaluate(/* read the object's left */)`), Task 7 Step 6 (a test whose body is a comment), Task 10 Step 1 (same). Task 11's Self-Review (plan:1092) claims "no 'TBD'/'handle edge cases'/'similar to Task N'" — literally true of those three strings, and it separately justifies Tasks 7 and 10, but it does not cover Task 5's and Task 6's inline placeholders. Task 1 Step 3 also prints `{ /* as in Interfaces */ }` inside the code to be typed (plan:139-146), which the implementer must fill before the "Expected: PASS, 4 tests" of Step 4. Minor; the intent is legible in every case.
- **U4 — spec citations that I could not make correct.** The spec is the binding authority, so these are worth fixing even though the plan around them is right:
  - spec:36 cites `snap-manager/index.ts:125` as a zoom read. Line 125 is `if (startBounds === null) return undefined;`; the real `canvas.getZoom()` in that file is at `snap-manager/index.ts:155`.
  - spec:37 paths the guide renderer as `guide-renderer/index.ts:30`; the real path is `src/web/packages/editor/src/snap-manager/guide-renderer.ts:30` (that line number is correct — `const zoom = canvas.getZoom() || 1;`), with the divide at `guide-renderer.ts:37`, which plan Task 10 cites exactly right.
  - spec:6-7 cites `editor-shell.ts:132` as the single `setViewportTransform` — correct in this package; note `packages/scene-fabric/src/scene.ts:125` has a second one for the player, which the spec's phrasing ("one `setViewportTransform` call") does not acknowledge. Not a defect against the plan.
- **U5 — spec:19 "`PRODUCT_SHORTCUTS` is 12 file/edit bindings".** The array is 12 entries (`shortcut-manager/index.ts:23-36`, `delete` and `backspace` both → `edit.delete`) while the `ProductShortcutId` union has 11 members (`:2-13`). Task 6 Step 3's "beside the existing eleven" matches the union. Both statements are individually defensible; they are not the same number.
- **U6 — fork references.** `git -C D:/git-repos/fabricjs-image-editor ls-tree`/`show` (read-only, no checkout) confirms `src/editor/zoom-manager/index.ts` is exactly 561 lines and `src/editor/pan-constraint-manager/index.ts` exists with `PAN_OVERSCROLL_MARGIN = 48` at line 57. The fork's `zoom-manager` calls `canvas.zoomToPoint` (lines 493, 526, 551) and reads `canvas.viewportTransform` throughout but never calls `getScenePoint`, comment at line 95 says `zoomToPoint` works in viewport coordinates. I did **not** verify the fork's handling of `viewport.width`/`height` for `getScenePoint` or whether it has a scene-point helper that Task 1's test should have copied — I read only grep hits, not the full file.
- **U7 — `@base-ui/react/context-menu` is not imported anywhere** (`grep -rn "context-menu\|ContextMenu" packages/*/src` returns nothing), so the spec's "ships `ContextMenu` unused" (spec:39) holds. `@base-ui/react` is a dependency of `packages/editor` (`packages/editor/package.json:15`, `^1.8.0`). Task 9 will be the first user; whether the installed `MenuPortal` accepts a container under the new camera layout I did not check beyond `MenuPortal.d.ts:21` (`container?: HTMLElement | ShadowRoot | RefObject<...> | null`).
- **U8 — Task 11's named pre-existing failures.** Both names exist in `src/web/tests/e2e/display-fabric.spec.ts`: `"keeps repainting as samples arrive"` at line 322 and `"is byte-stable at a fixed clock on one platform"` at line 671. I did not run the suite, so I cannot confirm they actually fail, nor that they hang at `document.fonts.ready`, nor that they are the only two.

---

## Verdict per task

| Task | Verdict |
|---|---|
| 1 camera module | **Not clean** — D1 (`onChange` unowned) and D9 (`getScenePoint` test cannot pass). Pan-bounds arithmetic verified internally consistent. |
| 2 canvas becomes viewport | **Not clean** — D2's sibling form (the owner file for the bridge is Task 4's problem) and D10 (existing test file treated as absent). The container-sizing deletion itself is correctly scoped: only `editor-shell.ts:94,118,125,278,286,301,353,381` reference the deleted helpers. |
| 3 navigation gestures | **Clean for its own text**, with U1 and the weak assertion at plan:558-559 (U2). |
| 4 zoom readout | **Not clean** — D1 and D2. This is the weakest task in the plan. |
| 5 reachable marquee | **Not clean** — D3/D11. |
| 6 keyboard nudge | **Not clean** — D4 (compile error) and D8 (timing-dependent undo assertion). |
| 7 group entry | **Not clean** — D5's return type; also plan:851 says the `ungroup()` context-clearing "is asserted below" and Step 1's test does not assert it. |
| 8 layer tree follows group context | **Not clean** — D5 and D6. |
| 9 canvas context menu | **Not clean** — D7. |
| 10 snapping at non-1 zoom | **Clean.** Its `guide-renderer.ts:37` citation is exactly correct, and the "verify, do not assume" framing matches the code. |
| 11 full gate | **Clean.** Plan:13's "Task 11's context menu" is a numbering slip — the context menu is Task 9. |

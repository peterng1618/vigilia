### Task 9: The canvas context menu

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/canvas-context-menu.tsx`
- Create: `src/web/packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Modify: `src/web/tests/e2e/editor.spec.ts` (Step 4 — the menu's capture)
- Modify: `docs/evidence/screenshots/README.md` (Step 4 — its registry row)

**Interfaces:**
- Consumes: `OBJECT_ACTIONS`, `actionEnabled` (UI-polish plan Tasks 1–2); `EditorShellBridge`.
- Consumes: **this plan's Task 10 helpers** — `sceneToClient(page, sceneWidth, x, y)` and
  `clientOfScene(page, id, sceneWidth)`, added at file scope in `editor.spec.ts`. This task runs **after**
  Task 10, whose whole deliverable was deleting box-relative scene→client mappings for this spec file. A new
  capture test that hand-rolls `box.x + (180 / 1280) * box.width` reintroduces exactly that defect, one task
  after it was removed, and it would land *after* Task 10's grep-derived sweep. Use the helper.
- Produces: nothing consumed by later tasks. **This task depends on the UI-polish plan.**

`arrangeActions` is deliberately **not** consumed. The UI-polish plan rules that arrange moves to the stage toolbar, which that plan's Task 7 owns, and this menu renders the same `OBJECT_ACTIONS` list the dock renders — that shared list is the property Step 1's test pins. Reaching for `arrangeActions` here would put arrange in two surfaces and make the two lists disagree.

- [ ] **Step 1: Write the failing test**

```tsx
it("shows exactly the entries the dock would enable", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  // A local stub, not the layer panel's test helper: `bridge()` lives in
  // `layer-panel.dom.test.tsx` and is **not exported**, and no test in this repo
  // imports from another test file — so reaching for it would mean widening that
  // file's surface to serve a consumer outside it.
  //
  // `target` is annotated rather than inferred: without the annotation the
  // literal's `kind` widens to `string` and the assertion below stops comparing
  // against the nine-label set it is supposed to pin. The outer cast stays
  // because `EditorShellBridge` is thirty-odd members and this stub supplies the
  // two the menu reads — a partial double, which is what a cast is for.
  const target: ObjectTarget = { kind: "object", locked: false, memberCount: 1, isGroup: false };
  const gate = {
    target: () => target,
    canArrange: () => false,
  } as EditorShellBridge;
  // `canArrange` is deliberately `false`: `actionEnabled` consults it only for
  // `arrange:` ids, of which OBJECT_ACTIONS has none — so a menu that wrongly
  // consulted it would show zero arrange entries either way, and the derivation
  // below is what pins the set rather than the flag.
  await act(async () => root.render(
    <CanvasContextMenu bridge={gate} open at={{ x: 10, y: 20 }} />,
  ));
  const items = [...host.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);
  // `expected` must come from `objectAction(...).eligible` — the *eligibility*
  // predicate every action carries (the `OBJECT_ACTIONS` array) — and NOT from
  // `actionEnabled(gate, id)`. Deriving it through `actionEnabled` would ask the
  // exact function Step 3 tells the menu to call, so a menu that ignored the
  // registry entirely and rendered the same wrong list would still match. The
  // registry is the independent oracle; going through the shared predicate makes
  // the assertion self-referential.
  const expected = OBJECT_ACTIONS
    .filter((action) => action.eligible(gate.target()))
    .map((action) => action.label);
  // Measured against that target: nine labels. Eligible — duplicate, copy, cut,
  // front, bring-forward, send-backward, back, lock, delete. Ineligible —
  // `unlock` needs `t.locked`, `group` needs `t.memberCount > 1 && !t.isGroup`,
  // `ungroup` needs `t.isGroup`. Assert the count too, so a menu that renders
  // nothing fails on the first line rather than comparing two empty arrays.
  expect(expected).toHaveLength(9);
  expect(items.sort()).toEqual([...expected].sort());
});
```

Do not replace the gate's `target` with anything else — `{kind:"object", locked:false,
memberCount:1, isGroup:false}` is the fixture that produces the nine-label set, and the
derivation is what makes the assertion meaningful.

Import the registry and both types as `layer-panel.dom.test.tsx:7` does:

```ts
import { OBJECT_ACTIONS } from "../object-actions.js";
import type { ActionGate, ObjectTarget } from "../object-actions.js";
import type { EditorShellBridge } from "./bridge.js";
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx`
Expected: FAIL — module does not resolve.

- [ ] **Step 3: Implement the menu**

Right-click on the canvas opens a Base UI `ContextMenu` at the pointer. Entries come from the same filtered list the dock render uses — call `actionEnabled` for each, do not re-derive eligibility. Right-clicking empty canvas offers the creation actions (`uiCopy.panels.text`, the four chart families) through `session`, since those are not object actions and must not enter the object registry.

Suppress the browser's own context menu on the canvas only, not document-wide.

- [ ] **Step 4: Run the tests, then inspect**

Run: `npx vitest run packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx`
Expected: PASS.

Then rebuild and check it rendered:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --workers=1 \
  --grep "captures the canvas dock over a selected object"
```

`captureVisualReview` returns immediately unless `VIGILIA_CAPTURE` is set, so an ungated run writes no file and this step becomes "open an image that is not there". Confirm the run reported a non-zero test count — a `--grep` matching nothing exits successfully having run nothing.

That capture is the dock, not the menu. **The menu is a new visible surface, and it needs its own capture and
its own registered name — an earlier revision of this step said to add them without giving this task any way to
produce one: no `editor.spec.ts` in the Files list, no image in the `git add` below, and no test to generate it.**
A registry row pointing at a name no test writes is an image nothing regenerates, which is worse than
`add when changed`.

So add one capture test to `src/web/tests/e2e/editor.spec.ts`, beside `captures the canvas dock over a selected
object` (`:2049`), following that test's shape exactly — same `desktop-chromium` skip clause, same `await
page.goto(EDITOR)`, same `captureVisualReview(page, testInfo, "editor-canvas-context-menu")` close. Machine-
checkable requirements, because a capture test that drifts from these is a failure this step already owns once:

- **Map the gesture through `clientOfScene(page, "<id>")`, not through the canvas box.** It is Task 10's
  file-scope helper and the only owner of the camera transform. `clientOfScene` returns a client point; the
  right-click is `await page.mouse.click(point.x, point.y, { button: "right" })`.
- **Right-click a selected object**, so the menu offers the object actions rather than the creation actions:
  `await selectStarterChart(page)` first (a file-scope helper with four existing call sites), then right-click
  the object it selects. `selectStarterChart` asserts `load-gauge` is active, so this cannot silently right-click
  empty canvas and capture the wrong menu.
- **Assert the menu opened before capturing**, and assert one entry by name:
  `await expect(page.getByRole("menuitem", { name: "Duplicate" })).toBeVisible()`. A capture of a menu that never
  opened is an image of the editor, which is not evidence of this task — and the `--grep` for a capture is not
  what proves the menu is real, this assertion is.
- **Title the test** `captures the canvas context menu over a selected object`.

Then register it. `docs/evidence/screenshots/README.md`'s `Editor mechanics` row already lists
`editor-snap-guides`, `editor-rotation-indicator` and `editor-toolbar`; append
`` `editor-canvas-context-menu` / `captures the canvas context menu over a selected object` `` to that row rather
than inventing a domain — it is the same visible action class.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/canvas-context-menu.tsx \
  src/web/packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/ui-copy.ts \
  src/web/tests/e2e/editor.spec.ts \
  docs/evidence/screenshots/README.md \
  docs/evidence/screenshots/editor-canvas-context-menu-desktop-chromium.png
git commit -m "feat(editor): canvas context menu from the action registry"
```

**Stage the capture by name, never `docs/evidence/screenshots` as a directory** — it holds roughly forty PNGs
owned by other tasks and another plan, and it currently carries a modified `editor-desktop-chromium.png` that no
task here owns. If the capture file is absent, the capture step did not run: check `VIGILIA_CAPTURE=1` was set
and the grep reported a non-zero test count rather than exiting zero having run nothing.

---


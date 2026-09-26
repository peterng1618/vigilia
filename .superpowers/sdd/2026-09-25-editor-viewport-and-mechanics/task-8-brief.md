### Task 8: The layer tree follows the group context

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.ts`

**Interfaces:**
- Consumes: `GroupingManager.groupContext()` (Task 7), `LayerPanel` (UI-polish plan Task 5). **This task depends on the UI-polish plan.**

- [ ] **Step 1: Write the failing test**

```tsx
it("marks the group whose children are current and dims the rest", async () => {
  // Two groups, so the negative half of the assertion has a row to read. The
  // non-current group is what makes this a test of "dims the rest" rather than
  // of "sets an attribute somewhere".
  const rows = [
    { id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false },
    { id: "child", name: "Child", kind: "text", depth: 1, parentId: "group",
      hasChildren: false, visible: true, locked: false, selected: true },
    { id: "other", name: "Other", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false },
  ];
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <LayerPanel bridge={bridge(rows, { groupContext: () => ["group"] })} />,
  ));
  expect(host.querySelector('[data-vigilia-layer="group"]')?.getAttribute("data-context")).toBe("true");
  expect(host.querySelector('[data-vigilia-layer="other"]')?.getAttribute("data-context")).toBe("false");
  // The child inside the current context is selectable in its own right — the
  // half of the branch that Step 3 adds, and the reason the context is marked.
  expect(host.querySelector('[data-vigilia-layer="child"]')?.getAttribute("data-context")).toBe("true");
});
```

`bridge(rows, overrides)` is the existing helper (`layer-panel.dom.test.tsx:9`); it spreads
`...overrides` before its closing `as EditorShellBridge`, so passing `groupContext` here compiles
once Step 3 declares the member and fails at runtime with a missing attribute until then — which
is the failure this step expects.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
Expected: FAIL — no `data-context` attribute.

- [ ] **Step 3: Reflect the context**

Add `groupContext(): readonly string[]` to `EditorShellBridge` (ids, not objects — the projection rule holds).

Two distinct `groupContext` signatures meet here, and the step must not blur them: `GroupingManager.groupContext(): readonly FabricObject[]` from Task 7 returns **objects**, and the bridge's returns **ids**. Derive the bridge's by mapping each object to its `id`, and only for objects that have one — an anonymous object has no row to mark. The projection rule (`docs/architecture/ownership.md`) is why the bridge cannot simply forward the manager's array.

**The panel updates itself; no new wiring is needed, and do not add a listener pair for it.** Task 7's `enterGroup` calls `canvas.setActiveObject(child)` (Task 7 Step 3), and Fabric's `setActiveObject` fires `selection:created` **synchronously** (`index.node.cjs:11456-11460`, via `_fireSelectionEvents`) — which the bridge already subscribes to, to `notify()` (`bridge.ts:77-79` defines `notify`, and `:85` is the `canvas.on(event, notify)` registration; the range `:74-79` this cited is the `createEditorShellBridge` signature into `notify`, not the subscription). `LayerStore.set`'s subscription re-reads `bridge.layers()` on every notify (`layer-panel.tsx:41-45`; this read `:42-45`, which is the same body — the read is at `:42` and the subscribe callback at `:43-45`). So one entry is enough, and because the store caches the projection rather than rebuilding it per `getSnapshot` (`layer-panel.tsx:28-31` states the reason, `:34` holds the cached `#rows` field and `:67` is the `get` that returns it), reading `groupContext()` inside `layers()` is safe.

**What that does mean is that Task 7's ordering is load-bearing here.** `enterGroup` must record the context **before** it changes the active object: `setActiveObject` notifies the panel synchronously, so a context recorded afterwards is one render late, and Task 8's own browser check sees a tree that has not yet marked the group. If Task 7 shipped with the record after the selection change, fix it there — do not compensate in the panel with a second notification, which would make two owners of "when the tree is stale".

Mark `data-context="true"` on **every row inside the current context, not only the group row**: the entered group itself *and* its descendants, since entering a group is precisely what makes its children individually selectable. The step above asserts `"true"` on `group` *and* on `child`, so a rule that marked only the group row would fail the test the same step specifies. Rows outside the context get `data-context="false"` and a muted style.

Because the tree can now select a group's children directly, the old "selection resolves a child through its owning group" behaviour is no longer the only path: keep it for a canvas click, but let a tree click on a child select the child itself when its group is the current context.

**That conditional is a real branch in `selectLayer`, and the existing test already pins the other half.** `bridge.dom.test.ts:212-217` asserts `selectLayer("child")` calls `setActiveObject(group)` — the owning group — and Task 5's `bridgeFor` widened the canvas stub, so that assertion is live. The new branch must therefore be *only* "the child's group is the current context", leaving the group resolution in place for every other case; a bare "select the child" rewrite turns that existing test red for the right reason. Note also that `selectLayer` resolves through `ownerOf(root, id)` (`bridge.ts:150`; this read `:144`, which is `const root = canvas.getObjects();` — the same function, three lines above the call), whose first parameter is root and whose only caller here passes `canvas.getObjects()` — not the object form.

- [ ] **Step 4: Run the tests and inspect**

Run: `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
Expected: PASS. Then rebuild, enter a group in the browser, and confirm in the capture that the tree shows the context and the child is selectable.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/layer-panel.tsx \
  src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/bridge.ts
git commit -m "feat(editor): layer tree reflects the group context"
```

---


### Task 3: Define the shell bridge without moving editor actions

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/bridge.ts`
- Create: `src/web/packages/editor/src/editor-shell/bridge.dom.test.ts`
- Modify: `src/web/packages/editor/src/fork-extensions/index.ts`
- Modify: `src/web/packages/editor/src/fork-main.ts`

**Interfaces:**
- Consumes: `ForkExtensions`, `ForkShell.editor`, `applyArrange()`, and adopted-fork duplicate/lock/order/delete APIs.
- Produces: `EditorShellBridge` with `subscribe(listener)`, `snapshot()`, `run(action)`, and `destroy()`; it reports transient selection/action eligibility only.

- [ ] **Step 1: Write failing bridge tests**

Cover selection creation/clear, bridge cleanup, and action eligibility. Assert that duplicate, lock, order, align, distribute, and delete invoke existing owners rather than duplicate geometry or persistence logic.

```ts
bridge.run({ type: "arrange", action: "align-left" });
expect(applyArrange).toHaveBeenCalledWith(editor, "align-left");
bridge.destroy();
expect(canvas.off).toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- bridge.dom.test.ts`

Expected: FAIL because the bridge module does not exist.

- [ ] **Step 3: Implement a narrow bridge**

Subscribe to Fabric selection events and expose a plain immutable snapshot: selected object count, lock state, and each action's enabled state. Delegate arrange to `applyArrange`, file actions to existing extension methods, and generic object actions to the adopted fork. Do not add React state to `ForkExtensions`, a parallel layer tree, a window key listener, or a serialized UI field.

- [ ] **Step 4: Mount/destroy the bridge with the current editor cycle**

In `fork-main.ts`, create one bridge after `mountForkShell` and `ForkExtensions` succeed; destroy it before extensions/shell replacement. Keep the current font-release failure path intact so a shell mount error cannot leave a half-mounted canvas.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- bridge.dom.test.ts fork-extensions/index.dom.test.ts && npm run typecheck -w @vigilia/editor`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/bridge.ts src/web/packages/editor/src/editor-shell/bridge.dom.test.ts src/web/packages/editor/src/fork-extensions/index.ts src/web/packages/editor/src/fork-main.ts
git commit -m "feat: bridge editor actions into shell"
```


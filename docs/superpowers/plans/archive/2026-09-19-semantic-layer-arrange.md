# Semantic Layer and Arrange Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a Vigilia semantic layer projection and selection-relative align/distribute controls without a second scene model.

**Architecture:** `layer-panel.ts` projects the Fabric canvas/group graph and delegates generic order/lock/history to the adopted fork. `arrange.ts` moves an `ActiveSelection` from rendered Fabric bounds, then saves exactly one fork history state. `ForkExtensions` composes both panels.

**Tech Stack:** TypeScript, `fabric/es` 7.4.0, adopted `fabricjs-image-editor`, Vitest/jsdom, Playwright.

**Spec:** `.agents/specs/0011-editor-property-model.md`

## Global Constraints

- Fabric remains the only object graph; the tree is derived and never persisted.
- Labels are Fabric kind plus stable id; do not add editable object names.
- Child rows navigate to the owning group only; independent grouped-child editing waits for a supported fork API.
- Alignment needs two unlocked objects; distribution needs three.
- The fork owns generic z-order, grouping, locks and history.
- Preserve `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.

## Review Focus

- A hidden child reveals its hidden parent path rather than becoming an invisible selection.
- Grouping/ungrouping changes the tree immediately, without stale cached nodes.
- Rotated objects use rendered bounds rather than width/height.
- Locked selection members reject arrange actions without a history entry.
- Three-object distribution keeps the endpoints fixed and equalizes the two gaps; two objects cannot distribute.

---

### Task 1: Expose the existing fork managers

**Files:**
- Modify: `src/web/packages/editor/src/fabric-image-editor.d.ts:5-29`
- Test: `src/web/packages/editor/src/fork-shell.dom.test.ts`

**Interfaces:**
- Produces typed `ImageEditor.layerManager`, `objectLockManager`, and `historyManager` for Tasks 2–3.
- Consumes the already-shipped compiled fork managers.

- [ ] **Step 1: Write a failing typed-use test**

Add a compile-checked fake editor to `fork-shell.dom.test.ts`:

```ts
const editor = { layerManager: { bringToFront: vi.fn() }, historyManager: { saveState: vi.fn() } } as ImageEditor;
editor.layerManager.bringToFront();
editor.historyManager.saveState();
```

- [ ] **Step 2: Run it and observe the missing declarations**

Run from `src/web/`:

```text
cmd.exe /d /s /c "npm test -- --run packages/editor/src/fork-shell.dom.test.ts"
```

Expected: the typed usage cannot compile because these manager fields are absent.

- [ ] **Step 3: Add the narrow public declaration**

Add to `ImageEditor`:

```ts
readonly layerManager: {
  bringToFront(object?: FabricObject): void; bringForward(object?: FabricObject): void;
  sendToBack(object?: FabricObject): void; sendBackwards(object?: FabricObject): void;
};
readonly objectLockManager: {
  lockObject(input?: { readonly object?: FabricObject }): void;
  unlockObject(input?: { readonly object?: FabricObject }): void;
};
readonly historyManager: { saveState(): void };
```

- [ ] **Step 4: Run focused proof**

```text
cmd.exe /d /s /c "npm run typecheck -w @vigilia/editor && npm test -- --run packages/editor/src/fork-shell.dom.test.ts"
```

Expected: editor typecheck and focused test pass.

- [ ] **Step 5: Commit and push**

```text
git add src/web/packages/editor/src/fabric-image-editor.d.ts src/web/packages/editor/src/fork-shell.dom.test.ts
git commit -m "feat(editor): expose fork layer controls"
git push origin feat/fabric-editor-migration
```

### Task 2: Add the semantic layer projection

**Files:**
- Create: `src/web/packages/editor/src/layer-panel.ts`
- Create: `src/web/packages/editor/src/layer-panel.dom.test.ts`
- Modify: `src/web/packages/editor/src/fork-extensions/index.ts:1-74`

**Interfaces:**
- Produces `createLayerPanel(host, editor): LayerPanel` where `LayerPanel` has `root` and `destroy()`.
- Consumes Task 1’s managers plus `Canvas`, `FabricObject`, and `Group` from `fabric/es`.

- [ ] **Step 1: Write failing projection/interaction tests**

Build a jsdom canvas fake with roots `[background, group, foreground]` and `group.getObjects()` returning `[child]`. Assert reverse paint order and labels:

```ts
expect(panel.root.querySelectorAll('[data-vigilia-layer]')).toHaveLength(4);
expect(panel.root.textContent).toContain('Rect foreground');
expect(panel.root.textContent).toContain('Group group');
expect(panel.root.textContent).toContain('Textbox child');
```

Also assert that group selection calls `canvas.setActiveObject(group)`, child navigation selects `group` rather than `child`, revealing a hidden child reveals all hidden ancestors and calls history once, manager buttons forward their object, canvas selection/object lifecycle events re-render, and `destroy()` unregisters every listener.

- [ ] **Step 2: Run the test to verify it fails**

```text
cmd.exe /d /s /c "npm test -- --run packages/editor/src/layer-panel.dom.test.ts"
```

Expected: module-not-found for `layer-panel.js`.

- [ ] **Step 3: Implement the projection and controls**

Define:

```ts
export interface LayerPanel { readonly root: HTMLElement; destroy(): void }
export function createLayerPanel(host: HTMLElement, editor: ImageEditor): LayerPanel
```

Use `canvas.getObjects().slice().reverse()` and `Group#getObjects().slice().reverse()`. Read custom `id` and `locked` using a local structural type. Render `data-vigilia-layer=id`, a derived `${object.type} ${id}` label, effective ancestor visibility/lock, and labelled Show/Hide, Lock/Unlock, Front/Forward/Backward/Back buttons. A child click selects its owning group. Show sets every hidden ancestor visible, calls `setCoords()`, requests render, and saves exactly once. Lock/order delegate to Task 1’s fork managers. Subscribe/unsubscribe `selection:created`, `selection:updated`, `selection:cleared`, `object:added`, `object:removed`, and `object:modified`.

- [ ] **Step 4: Compose it in `ForkExtensions`**

Construct one panel after `#newObjects`, retain it as `#layers`, and call `#layers.destroy()` from `destroy()`. Do not modify `ForkShell`, persistence, renderer-core, or the scene serializer.

- [ ] **Step 5: Run focused proof**

```text
cmd.exe /d /s /c "npm run typecheck -w @vigilia/editor && npm test -- --run packages/editor/src/layer-panel.dom.test.ts"
```

Expected: typecheck, reverse-order, inherited-state, action forwarding, refresh, and teardown tests pass.

- [ ] **Step 6: Commit and push**

```text
git add src/web/packages/editor/src/layer-panel.ts src/web/packages/editor/src/layer-panel.dom.test.ts src/web/packages/editor/src/fork-extensions/index.ts
git commit -m "feat(editor): add semantic layer panel"
git push origin feat/fabric-editor-migration
```

### Task 3: Add selection-relative arrange actions

**Files:**
- Create: `src/web/packages/editor/src/arrange.ts`
- Create: `src/web/packages/editor/src/arrange.dom.test.ts`
- Modify: `src/web/packages/editor/src/layer-panel.ts`

**Interfaces:**
- Produces `applyArrange(editor, action): boolean`.
- `action` is `align-left`, `align-center-x`, `align-right`, `align-top`, `align-center-y`, `align-bottom`, `distribute-x`, or `distribute-y`.

- [ ] **Step 1: Write failing geometry/history tests**

Use real `Rect` objects, including a rotated rectangle, inside a real `ActiveSelection` on a fake canvas. Cover:

```ts
expect(applyArrange(editor, 'align-left')).toBe(true);
expect(leftEdges(selection.getObjects())).toEqual([10, 10, 10]);
expect(editor.historyManager.saveState).toHaveBeenCalledTimes(1);
expect(applyArrange(twoObjectSelection, 'distribute-x')).toBe(false);
expect(applyArrange(lockedSelection, 'align-top')).toBe(false);
```

For three different widths, assert first left and last right do not move, intermediate gaps are equal, and the same active selection remains active.

- [ ] **Step 2: Run the test to verify it fails**

```text
cmd.exe /d /s /c "npm test -- --run packages/editor/src/arrange.dom.test.ts"
```

Expected: module-not-found for `arrange.js`.

- [ ] **Step 3: Implement rendered-bound commands**

Resolve only an `ActiveSelection`; reject locked members and insufficient cardinality without mutation. Use `getBoundingRect()` for all target calculations. Move by bounding-box delta while preserving transforms:

```ts
object.setPositionByOrigin(
  new Point(object.getCenterPoint().x + dx, object.getCenterPoint().y + dy),
  'center', 'center',
);
object.setCoords();
```

Align against union edges/centres. For distribution, sort by rendered left/top, preserve first/last, and place each intermediate object after its predecessor plus `(lastStart - firstEnd - intermediateSizes) / (count - 1)`. Restore the active selection, request one render, and save one history state.

- [ ] **Step 4: Wire labelled buttons and eligibility**

Append an `Arrange` section to `layer-panel.ts` with all eight labelled actions. Disable alignment below two unlocked members and distribution below three. On success, re-render the panel.

- [ ] **Step 5: Run focused proof**

```text
cmd.exe /d /s /c "npm run typecheck -w @vigilia/editor && npm test -- --run packages/editor/src/arrange.dom.test.ts packages/editor/src/layer-panel.dom.test.ts"
```

Expected: geometry, rotation, rejection, history, selection preservation, and button eligibility tests pass.

- [ ] **Step 6: Commit and push**

```text
git add src/web/packages/editor/src/arrange.ts src/web/packages/editor/src/arrange.dom.test.ts src/web/packages/editor/src/layer-panel.ts src/web/packages/editor/src/layer-panel.dom.test.ts
git commit -m "feat(editor): add layer arrange actions"
git push origin feat/fabric-editor-migration
```

### Task 4: Verify the active route and record evidence

**Files:**
- Modify: `src/web/tests/e2e/editor-fork.spec.ts`
- Create: `.agents/screenshots/editor-layer-arrange-desktop-chromium.png`
- Modify: `.agents/architecture.md`, `.agents/specs/0011-editor-property-model.md`, `.agents/status.md`

**Interfaces:**
- Consumes Tasks 1–3 and produces current visual/browser documentation evidence.

- [ ] **Step 1: Write the failing active-fork assertion**

Extend `editor-fork.spec.ts` to load `/editor`, wait for `[data-vigilia-layer]`, select a visible row, invoke an enabled arrange action after fixture multi-selection, and assert selected ids remain active. Capture the sidebar with `VIGILIA_CAPTURE=1`.

- [ ] **Step 2: Run it before wiring**

```text
VIGILIA_CAPTURE=1 npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --workers=1
```

Expected: the new hooks are absent until Tasks 2–3 complete.

- [ ] **Step 3: Run the full verification tier**

```text
npm run typecheck
npm test
npm run build
VIGILIA_CAPTURE=1 npx playwright test -g "visual review" --workers=1
npm run size
npm run test:e2e
```

Inspect every captured screenshot before proceeding. If browser launch reports `spawn EPERM`, record visual/browser evidence as unverified and do not claim a pass.

- [ ] **Step 4: Update only observed current documentation**

Record `editor/src/layer-panel.ts` as semantic projection owner, retain fork ownership of generic grouping/order/locks, replace the spec pending line only with observed behavior, and add exact command outcomes or browser limitation to status.

- [ ] **Step 5: Commit and push evidence**

```text
git add src/web/tests/e2e/editor-fork.spec.ts .agents/screenshots/editor-layer-arrange-desktop-chromium.png .agents/architecture.md .agents/specs/0011-editor-property-model.md .agents/status.md
git commit -m "test(editor): verify semantic layer workflow"
git push origin feat/fabric-editor-migration
```

## Self-review

- Tasks 2–3 cover every accepted spec rule; Task 4 supplies runtime evidence.
- The five review-focus cases map to Task 2 (hidden/group state) and Task 3 (geometry, locks, cardinality).
- Every named API is introduced before a later task consumes it.
- The plan has no deferred implementation placeholders.

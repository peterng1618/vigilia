# Native Fabric Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace the adopted image-editor package with native @vigilia/editor mechanics over fabric/es while preserving the v2 authoring contract.

**Architecture:** scene-fabric continues to own Fabric persistence, revival and renderer primitives. The editor introduces narrowly owned native mechanics for history, object actions and interactive canvas lifecycle; existing product panels consume those mechanics directly. The current fork-extensions composition is dissolved into the editor root rather than copied behind a new wrapper.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright, Fabric 7.4.0 via fabric/es.

**Spec:** .agents/specs/0016-native-fabric-editor.md

## Global Constraints

- Keep renderer-core Fabric/DOM-free and the player independent of editor modules.
- Preserve v2 envelope validation before revival and theme-package dirty-work protection.
- Persist authored scene/envelope state only; runtime samples, selection and viewport remain outside history.
- Do not add dependencies, alter the Fabric version, add a v1 reader or port spec-0014 review-only behaviour.
- Translate migrated source comments and user-visible editor text to English; do not bulk-edit unrelated modules.
- A changed visible interaction requires full local E2E plus inspected selected screenshot evidence.
- Execute Task 3 first: it moves the customized composition from `fork-extensions` to the editor root while retaining the current shell only as a temporary canvas provider. Then execute Tasks 1, 2, 4 and 5 in order.

## Review Focus

- Invalid v2 envelopes must fail before the mounted canvas changes; Task 2 adds the mount rejection test.
- Runtime refresh must not make the document dirty or add an undo entry; Task 1 tests suspended history and Task 4 exercises live bindings.
- Undo/redo must revive VigiliaChart objects without persisted engine pixels; Task 1 tests the native history callback boundary and Task 4 retains chart hydration coverage.
- Replacing an image/SVG must preserve its asset declaration/reference and reject unsafe SVG; Task 4 retains asset-manager DOM tests.
- Disposal during New/Open must disconnect observers, background media and product listeners before replacing the canvas; Task 2 tests replacement and failed mounts.

---

### Task 1: Native editor contract and history

**Files:**
- Create: src/web/packages/editor/src/editor-history.ts
- Create: src/web/packages/editor/src/editor-history.test.ts
- Create: src/web/packages/editor/src/editor-actions.ts
- Create: src/web/packages/editor/src/editor-actions.test.ts
- Modify: src/web/packages/editor/src/arrange.ts
- Modify: src/web/packages/editor/src/arrange.dom.test.ts
- Modify: src/web/packages/editor/src/new-object-panel.ts
- Modify: src/web/packages/editor/src/new-object-panel.dom.test.ts

**Interfaces:**
- Consumes: serialiseScene and reviveScene from @vigilia/scene-fabric; Fabric Canvas, FabricObject, IText, FabricImage, Group and ActiveSelection from fabric/es.
- Produces: EditorHistory with save(), reset(), undo(), redo(), suspend(callback), dispose(); EditorActions with addText(), importImage(), lock(), unlock(), and stack-order actions.

- [ ] **Step 1: Write failing history tests**

~~~ts
it("restores a serialized Fabric scene without recording the revive", async () => {
  const history = new EditorHistory({ canvas, serialize: serialiseScene, revive: reviveScene });
  history.reset();
  canvas.add(new Rect({ id: "later" }));
  history.save();
  await history.undo();
  expect(canvas.getObjects().map((object) => object.get("id"))).not.toContain("later");
  expect(history.canRedo).toBe(true);
});
~~~

- [ ] **Step 2: Run the failing history test**

Run: npm test -- --run packages/editor/src/editor-history.test.ts

Expected: FAIL because EditorHistory does not exist.

- [ ] **Step 3: Implement bounded snapshot history**

~~~ts
export class EditorHistory {
  #entries: SerialisedScene[] = [];
  #index = -1;
  #suspended = 0;

  save(): void {
    if (this.#suspended > 0) return;
    const next = this.#serialize(this.#canvas);
    if (JSON.stringify(next) === JSON.stringify(this.#entries[this.#index])) return;
    this.#entries.splice(this.#index + 1);
    this.#entries.push(next);
    this.#index += 1;
  }
  async undo(): Promise<void> {
    if (this.#index > 0) await this.#restore(this.#index - 1);
  }
  async redo(): Promise<void> {
    if (this.#index + 1 < this.#entries.length) await this.#restore(this.#index + 1);
  }
}
~~~

Use complete SerialisedScene snapshots, not a diff engine. History owns only authored canvas scene state; it raises editor:history-state-loaded after a successful revive so charts hydrate at their existing owner.

- [ ] **Step 4: Run the history test**

Run: npm test -- --run packages/editor/src/editor-history.test.ts

Expected: PASS.

- [ ] **Step 5: Write failing native-action tests**

~~~ts
it("adds text with supplied defaults and records one authored history entry", () => {
  const actions = new EditorActions({ canvas, history });
  actions.addText({ text: "New text", fill: "#fff" });
  expect(canvas.getActiveObject()).toBeInstanceOf(IText);
  expect(history.save).toHaveBeenCalledTimes(1);
});
~~~

- [ ] **Step 6: Implement only the fork API exercised by current consumers**

Implement direct Fabric text/image creation, locking (selectable, evented, locked), and stack ordering with canvas.bringObjectToFront, bringObjectForward, sendObjectBackwards and sendObjectToBack. Update arrange.ts and new-object-panel.ts to consume EditorActions, not an ImageEditor structural type.

- [ ] **Step 7: Prove the action and panel regressions**

Run: npm test -- --run packages/editor/src/editor-actions.test.ts packages/editor/src/arrange.dom.test.ts packages/editor/src/new-object-panel.dom.test.ts

Expected: PASS.

- [ ] **Step 8: Commit**

~~~powershell
git add src/web/packages/editor/src/editor-history.ts src/web/packages/editor/src/editor-history.test.ts src/web/packages/editor/src/editor-actions.ts src/web/packages/editor/src/editor-actions.test.ts src/web/packages/editor/src/arrange.ts src/web/packages/editor/src/arrange.dom.test.ts src/web/packages/editor/src/new-object-panel.ts src/web/packages/editor/src/new-object-panel.dom.test.ts
git commit -m "feat(editor): add native Fabric history and actions"
~~~

### Task 2: Native interactive canvas mount

**Files:**
- Create: src/web/packages/editor/src/editor-canvas.ts
- Create: src/web/packages/editor/src/editor-canvas.dom.test.ts
- Modify: src/web/packages/editor/src/fork-main.ts
- Delete: src/web/packages/editor/src/fork-shell.ts
- Delete: src/web/packages/editor/src/fork-shell.dom.test.ts

**Interfaces:**
- Consumes: EditorHistory and EditorActions from Task 1; v2 validation and artboard/paint/media helpers already used by fork-shell.ts.
- Produces: mountEditorCanvas(options): Promise<EditorCanvas> with canvas, history, actions, snapshot(), setArtboard(), setBackgroundMedia(), setGlobals(), setFitMode() and destroy().

- [ ] **Step 1: Write failing mount tests**

~~~ts
it("rejects an invalid envelope before creating a canvas", async () => {
  await expect(mountEditorCanvas({ host, artboard, envelope: invalid })).rejects.toThrow("Invalid Fabric theme");
  expect(host.querySelector("canvas")).toBeNull();
});
~~~

- [ ] **Step 2: Run the failing mount test**

Run: npm test -- --run packages/editor/src/editor-canvas.dom.test.ts

Expected: FAIL because mountEditorCanvas does not exist.

- [ ] **Step 3: Implement the direct Fabric mount**

Create the canvas in the existing unique container, instantiate Fabric Canvas, attach native history event listeners for authored object mutations, and retain the current resize observer, viewport fitting, artboard paint, background-media and v2 revive/snapshot paths. Dispose listeners, history, scene adapter, media and Fabric canvas in reverse mount order. Do not copy fork canvas-manager or UI state.

- [ ] **Step 4: Move the production root to the native mount**

Replace mountForkShell in fork-main.ts with mountEditorCanvas and remove all fork-shell imports. The old file is deleted; no compatibility wrapper or alias is permitted.

- [ ] **Step 5: Run focused proof**

Run: npm test -- --run packages/editor/src/editor-canvas.dom.test.ts

Expected: PASS.

- [ ] **Step 6: Commit**

~~~powershell
git add src/web/packages/editor/src/editor-canvas.ts src/web/packages/editor/src/editor-canvas.dom.test.ts src/web/packages/editor/src/fork-main.ts src/web/packages/editor/src/fork-shell.ts src/web/packages/editor/src/fork-shell.dom.test.ts
git commit -m "feat(editor): mount native Fabric canvas"
~~~

### Task 3: Dissolve fork-extension composition

**Files:**
- Create: src/web/packages/editor/src/editor-session.ts
- Create: src/web/packages/editor/src/editor-session.dom.test.ts
- Modify: src/web/packages/editor/src/fork-main.ts
- Delete: src/web/packages/editor/src/fork-extensions/index.ts
- Delete: src/web/packages/editor/src/fork-extensions/index.dom.test.ts
- Modify: src/web/packages/editor/src/index.ts

**Interfaces:**
- Consumes: the temporary ForkShell canvas surface and existing panels/managers.
- Produces: EditorSession owning the open envelope/assets, product panels, live runtime, chart manager, package commands, dirty-work confirmation and deterministic disposal.

- [ ] **Step 1: Write failing session tests**

~~~ts
it("disposes the old session before mounting a New theme", async () => {
  const old = await createEditorSession(options);
  await replaceEditorSession(old, nextTheme);
  expect(old.destroy).toHaveBeenCalledOnce();
});
~~~

- [ ] **Step 2: Run the failing session test**

Run: npm test -- --run packages/editor/src/editor-session.dom.test.ts

Expected: FAIL because EditorSession does not exist.

- [ ] **Step 3: Move product composition without a wrapper layer**

Move constructor/lifecycle responsibilities from ForkExtensions to EditorSession. It directly consumes the temporary shell in fork-main.ts; panel callbacks update its envelope and canvas. Rename fork chart-panel symbols while touching their owner. Remove ForkExtensions and its tests rather than exporting an adapter. Task 2 replaces the temporary shell with EditorCanvas.

- [ ] **Step 4: Run focused proof**

Run: npm test -- --run packages/editor/src/editor-session.dom.test.ts packages/editor/src/persistence-manager/index.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add src/web/packages/editor/src/editor-session.ts src/web/packages/editor/src/editor-session.dom.test.ts src/web/packages/editor/src/fork-main.ts src/web/packages/editor/src/fork-extensions src/web/packages/editor/src/index.ts
git commit -m "refactor(editor): own native editor session"
~~~

### Task 4: Migrate panel consumers and asset insertion

**Files:**
- Modify: src/web/packages/editor/src/asset-manager/index.ts
- Modify: src/web/packages/editor/src/asset-manager/index.dom.test.ts
- Modify: src/web/packages/editor/src/layer-panel.ts
- Modify: src/web/packages/editor/src/layer-panel.dom.test.ts
- Modify: src/web/packages/editor/src/chart-manager/index.ts
- Modify: src/web/packages/editor/src/chart-manager/index.dom.test.ts
- Modify: src/web/packages/editor/src/arrange.ts

**Interfaces:**
- Consumes: EditorSession from Task 3 plus EditorCanvas and EditorActions from Tasks 1-2.
- Produces: no fork package type imports in product panels or their tests.

- [ ] **Step 1: Write failing consumer contract tests**

~~~ts
it("adds an imported SVG through native actions and records its asset reference", async () => {
  await panel.import(file);
  expect(objectAssetReference(canvas.getActiveObject()!)).toEqual({ assetId: "icon", kind: "svg" });
  expect(history.save).toHaveBeenCalled();
});
~~~

- [ ] **Step 2: Run the failing consumer test**

Run: npm test -- --run packages/editor/src/asset-manager/index.dom.test.ts

Expected: FAIL until the asset panel consumes native actions.

- [ ] **Step 3: Replace structural fork types with native contracts**

Update asset, layer, chart and arrange owners to use EditorCanvas/EditorActions. Preserve SVG sanitization, asset-reference checks, chart rehydration after native history events, palette/type reassignment and one history save per authored operation.

- [ ] **Step 4: Run focused unit and DOM proof**

Run: npm test -- --run packages/editor/src/asset-manager/index.dom.test.ts packages/editor/src/layer-panel.dom.test.ts packages/editor/src/chart-manager/index.dom.test.ts packages/editor/src/arrange.dom.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add src/web/packages/editor/src/asset-manager src/web/packages/editor/src/layer-panel.ts src/web/packages/editor/src/layer-panel.dom.test.ts src/web/packages/editor/src/chart-manager src/web/packages/editor/src/arrange.ts src/web/packages/editor/src/arrange.dom.test.ts
git commit -m "refactor(editor): migrate panels to native Fabric actions"
~~~

### Task 5: Remove the external editor dependency

**Files:**
- Delete: src/web/packages/editor/src/fabric-image-editor.d.ts
- Modify: src/web/packages/editor/package.json
- Modify: src/web/packages/editor/vite.config.ts
- Modify: src/web/packages/editor/index.html
- Modify: src/web/package-lock.json
- Create: src/web/packages/editor/src/editor-boundaries.test.ts
- Modify: .agents/architecture.md
- Modify: .agents/status.md

**Interfaces:**
- Consumes: native editor root/session from Tasks 1-4.
- Produces: editor workspace with no package, alias, import, declaration or fork-named production path for @anu3ev/fabric-image-editor.

- [ ] **Step 1: Write the removal assertion**

~~~ts
it("keeps the editor bundle independent of the adopted image-editor package", () => {
  expect(readFileSync("packages/editor/package.json", "utf8")).not.toContain("@anu3ev/fabric-image-editor");
});
~~~

- [ ] **Step 2: Run it to prove the dependency remains**

Run: npm test -- --run packages/editor/src/editor-boundaries.test.ts

Expected: FAIL before dependency removal.

- [ ] **Step 3: Remove dependency-owned paths**

Delete the shim and obsolete fork files, remove the manifest dependency and Vite alias, update the HTML entry to the native root, then run npm install from src/web to regenerate the lockfile. Rewrite architecture ownership from temporary migration language to the implemented native boundary.

- [ ] **Step 4: Prove no residual dependency surface**

Run: rg -n "@anu3ev/fabric-image-editor|ForkShell|ForkExtensions|fork-main" src/web/packages/editor src/web/package-lock.json

Expected: exit code 1.

- [ ] **Step 5: Run required local verification**

Run: npm run typecheck && npm test && npm run build && npm run size && npm run test:e2e

Expected: all commands pass. Stop at the first failure and report it rather than claiming the migration complete.

- [ ] **Step 6: Capture and inspect changed editor flows**

Run: $env:VIGILIA_CAPTURE='1'; npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --grep 'package round-trip|chart creation|background media|live text' --workers=1

Expected: PASS. Inspect each emitted selected PNG and record only observations that change a decision in .agents/status.md.

- [ ] **Step 7: Commit and publish**

~~~powershell
git add .agents/architecture.md .agents/status.md src/web/packages/editor src/web/package-lock.json
git commit -m "feat(editor): remove external image editor"
git push
~~~

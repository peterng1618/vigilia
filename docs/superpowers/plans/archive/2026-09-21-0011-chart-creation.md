# Spec 0011 Chart Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete spec 0011 by adding semantic creation commands for the four supported chart families.

**Architecture:** `new-object-defaults.ts` derives token-safe chart settings from the open envelope. `ChartManager` constructs, adds, selects, hydrates and records a `VigiliaChart`; `new-object-panel.ts` renders commands and delegates. The fork retains generic construction, ordering and history ownership.

**Tech Stack:** TypeScript, Fabric 7.4.0, adopted `fabricjs-image-editor`, Vitest, Playwright.

**Spec:** `.agents/specs/0011-editor-property-model.md`

## Global Constraints

- Reuse the fork for generic editor mechanics; do not add an editor abstraction.
- Persist typed Vigilia chart settings only; raw ECharts options and runtime samples never enter a theme.
- Every chart paint uses an existing `palette.<id>` reference; unavailable globals reject creation.
- Use the existing `ChartManager` as the chart lifecycle/renderer owner.
- No dependency, compatibility layer, or mutable document default state.

## Review Focus

- Missing palette globals reject every chart command without adding a partial object; test in Task 1.
- Every default paint reference exists in the supplied palette; test in Task 1.
- New charts have valid positive dimensions, a stable id and selected Fabric object; test in Task 2.
- A new chart records one authored history state; its rendered runtime option is excluded from serialized output; test in Task 2.
- All four visible commands create their matching family and survive package Save/Open; prove in Task 3.

---

### Task 1: Derive chart defaults

**Files:**
- Modify: `src/web/packages/editor/src/new-object-defaults.ts`
- Test: `src/web/packages/editor/src/new-object-defaults.test.ts`

**Interfaces:**
- Consumes: `FabricGlobals`, `ChartFamily`, and family defaults from `@vigilia/renderer-core`.
- Produces: `createNewChartDefaults(globals: FabricGlobals | undefined, family: ChartFamily): ChartContent["settings"]`.

- [ ] **Step 1: Write failing tests**

```typescript
it.each(["gauge", "line", "bar", "pie"] as const)(
  "derives %s settings using only existing palette references",
  (family) => {
    const settings = createNewChartDefaults(globals, family);
    expect(JSON.stringify(settings)).toContain("palette.ink");
    expect(JSON.stringify(settings)).not.toContain('"color"');
  },
);

it("refuses chart creation without a non-transparent palette token", () => {
  expect(() => createNewChartDefaults(undefined, "gauge")).toThrow(
    "palette token",
  );
});
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- --run packages/editor/src/new-object-defaults.test.ts`

Expected: FAIL because `createNewChartDefaults` is not exported.

- [ ] **Step 3: Implement the minimal defaults helper**

```typescript
export function createNewChartDefaults(
  globals: FabricGlobals | undefined,
  family: ChartFamily,
): ChartContent["settings"] {
  const { [VIGILIA_PAINT_PROPERTY]: paints } = createNewPaintDefaults(globals);
  return settingsFor(family, paints.fill!);
}
```

`settingsFor` returns these complete settings: gauge `{ ...defaultGaugeSettings, track: { ref }, progress: { ref } }`; line destructures `area` out of `defaultLineSettings` then returns the remainder with `stroke: { ref }` and `palette: [{ ref }]`; bar `{ ...defaultBarSettings, fill: { ref }, track: { ref } }`; pie `{ ...defaultPieSettings, palette: [{ ref }], remainderFill: { ref } }`. It never invents a literal colour, binding, ECharts option or sample.

- [ ] **Step 4: Verify the focused test**

Run: `npm test -- --run packages/editor/src/new-object-defaults.test.ts`

Expected: PASS.

- [ ] **Step 5: Verify editor types**

Run: `npm run typecheck -w @vigilia/editor`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/web/packages/editor/src/new-object-defaults.ts src/web/packages/editor/src/new-object-defaults.test.ts
git commit -m "feat(editor): derive chart creation defaults"
```

### Task 2: Create charts through ChartManager

**Files:**
- Modify: `src/web/packages/editor/src/chart-manager/index.ts`
- Test: `src/web/packages/editor/src/chart-manager/index.dom.test.ts`

**Interfaces:**
- Consumes: `createNewChartDefaults(globals, family)` from Task 1.
- Produces: `ChartManager.addChart(family: ChartFamily): void`.

- [ ] **Step 1: Write a failing manager test**

```typescript
it("adds, selects and records a palette-backed gauge", () => {
  const { manager, canvas, historyManager } = managerFixture(globals);
  manager.addChart("gauge");
  expect(canvas.add).toHaveBeenCalledWith(
    expect.objectContaining({ family: "gauge", width: expect.any(Number) }),
  );
  expect(canvas.setActiveObject).toHaveBeenCalledWith(expect.any(VigiliaChart));
  expect(historyManager.saveState).toHaveBeenCalledTimes(1);
});
```

Add parameterized `line`, `bar`, and `pie` cases that assert family. Add a missing-globals case that asserts `addChart` throws `palette token` and no canvas or history calls occur. Serialize the created chart through `serialiseScene` and assert its JSON contains `family` and `settings` but not `option`.

- [ ] **Step 2: Run the focused test**

Run: `npm test -- --run packages/editor/src/chart-manager/index.dom.test.ts`

Expected: FAIL because `addChart` does not exist.

- [ ] **Step 3: Add manager-owned insertion**

```typescript
addChart(family: ChartFamily): void {
  const chart = new VigiliaChart({
    family,
    settings: createNewChartDefaults(this.#globals, family),
    width: 240,
    height: 160,
    id: `chart-${crypto.randomUUID()}`,
    left: 120,
    top: 80,
  });
  this.#editor.canvas.add(chart);
  this.#editor.canvas.setActiveObject(chart);
  this.#applyChart(chart.get("id"), chart);
  this.#editor.historyManager.saveState();
  this.#editor.canvas.requestRenderAll();
}
```

The UUID-backed id satisfies the document's stable-id syntax. Dimensions and placement are fixed chart insertion semantics. The thrown defaults error must occur before construction.

- [ ] **Step 4: Verify the focused test**

Run: `npm test -- --run packages/editor/src/chart-manager/index.dom.test.ts`

Expected: PASS.

- [ ] **Step 5: Verify editor types**

Run: `npm run typecheck -w @vigilia/editor`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/web/packages/editor/src/chart-manager/index.ts src/web/packages/editor/src/chart-manager/index.dom.test.ts
git commit -m "feat(editor): add chart insertion commands"
```

### Task 3: Wire commands and prove package round-trip

**Files:**
- Modify: `src/web/packages/editor/src/new-object-panel.ts`
- Modify: `src/web/packages/editor/src/fork-extensions/index.ts`
- Test: `src/web/packages/editor/src/new-object-panel.dom.test.ts`
- Test: `src/web/tests/e2e/editor-fork.spec.ts`
- Modify: `.agents/status.md`
- Delete: `.agents/specs/0011-editor-property-model.md`
- Move: `docs/superpowers/plans/2026-09-21-0011-chart-creation.md` to `docs/superpowers/plans/archive/2026-09-21-0011-chart-creation.md`

**Interfaces:**
- Consumes: `ChartManager.addChart(family)` from Task 2.
- Produces: Add-panel buttons `Gauge`, `Line`, `Bar`, and `Pie`, plus retired spec 0011.

- [ ] **Step 1: Write failing panel tests**

```typescript
it.each([
  ["Gauge", "gauge"],
  ["Line", "line"],
  ["Bar", "bar"],
  ["Pie", "pie"],
] as const)("delegates %s to ChartManager", (label, family) => {
  const addChart = vi.fn();
  const panel = createNewObjectPanel(document.body, editor, globals, { addChart });
  [...panel.root.querySelectorAll("button")]
    .find((button) => button.textContent === label)!
    .click();
  expect(addChart).toHaveBeenCalledWith(family);
});
```

- [ ] **Step 2: Run the panel tests**

Run: `npm test -- --run packages/editor/src/new-object-panel.dom.test.ts`

Expected: FAIL because the panel has no chart command dependency or buttons.

- [ ] **Step 3: Wire four approved commands through existing composition**

```typescript
this.charts = new ChartManager({
  editor: options.shell.editor,
  scene: options.shell.scene,
  source: options.source,
  ...(options.envelope.bindings === undefined ? {} : { bindings: options.envelope.bindings }),
  ...(options.envelope.globals === undefined ? {} : { globals: options.envelope.globals }),
  panelHost: options.panelHost,
  onBindingsChange: (id, bindings) => this.#setBindings(id, bindings),
});
this.#newObjects = createNewObjectPanel(
  options.panelHost,
  options.shell.editor,
  this.#envelope.globals,
  { addChart: (family) => this.charts.addChart(family) },
);
```

Render only `Text` and the four approved chart families. Do not add shape, image or SVG commands.

- [ ] **Step 4: Verify panel tests**

Run: `npm test -- --run packages/editor/src/new-object-panel.dom.test.ts`

Expected: PASS.

- [ ] **Step 5: Add browser round-trip proof**

```typescript
test("adds a chart family with authored settings that survive package reopen", async ({ page }) => {
  await page.getByRole("button", { name: "Gauge" }).click();
  await expect(page.locator('[data-vigilia-chart-setting="thickness"]')).toBeVisible();
  const saved = await savePackage(page);
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name: "created-chart.vigilia-theme",
    mimeType: "application/octet-stream",
    buffer: saved.bytes,
  });
  await expect(page.locator('[data-vigilia-chart-setting="thickness"]')).toBeVisible();
});
```

- [ ] **Step 6: Build and run browser proof**

Run: `npm run build -w @vigilia/editor; npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --grep 'chart family.*package reopen'`

Expected: PASS.

- [ ] **Step 7: Capture and inspect changed UI**

Add this browser case, then run it:

```typescript
test("captures chart creation commands for visual review", async ({ page }, testInfo) => {
  await page.goto(EDITOR);
  await page.getByRole("button", { name: "Gauge" }).click();
  await expect(page.locator('[data-vigilia-chart-setting="thickness"]')).toBeVisible();
  await captureVisualReview(page, testInfo, "editor-fork-chart-creation");
});
```

Run: `$env:VIGILIA_CAPTURE='1'; npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --grep 'captures chart creation commands' --workers=1`

Expected: PASS; inspect the generated PNG and stage it only if it proves the changed UI.

- [ ] **Step 8: Retire the spec and record evidence**

Delete completed spec 0011 and update `.agents/status.md` with observed evidence. Do not change `.agents/architecture.md`: `ChartManager` already owns chart lifecycle. After the task's final test run is recorded, move this plan and the completed `2026-09-20-0011-property-corrections.md` plan into `docs/superpowers/plans/archive/` before the completion commit.

- [ ] **Step 9: Commit**

```powershell
git add src/web/packages/editor/src/new-object-panel.ts src/web/packages/editor/src/fork-extensions/index.ts src/web/packages/editor/src/new-object-panel.dom.test.ts src/web/tests/e2e/editor-fork.spec.ts .agents/specs/0011-editor-property-model.md .agents/status.md docs/superpowers/plans
git commit -m "feat(editor): complete chart creation commands"
```

## Verification

Run from `src/web/`:

```powershell
npm run typecheck -w @vigilia/editor
npm test -- --run packages/editor/src/new-object-defaults.test.ts packages/editor/src/chart-manager/index.dom.test.ts packages/editor/src/new-object-panel.dom.test.ts
npm run build -w @vigilia/editor
npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --grep 'chart family.*package reopen'
```

## Self-review

- Spec coverage: chart creation is the sole implementation gap; Tasks 1-3 cover defaults, lifecycle/history, visible commands, package persistence and spec retirement.
- Interfaces: Task 1 produces defaults for Task 2; Task 2 produces `addChart` for Task 3.
- Review focus: every listed failure mode has an owning test.
- Placeholder scan: none.

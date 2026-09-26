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


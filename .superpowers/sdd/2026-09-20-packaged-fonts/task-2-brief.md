### Task 2: Validate declared faces and starter presets

**Files:**
- Modify: `src/web/packages/renderer-core/src/theme/document.ts`
- Modify: `src/web/packages/renderer-core/src/theme/validate.ts`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts`
- Modify: `schema/theme-document.schema.json`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts`

**Interfaces:** Produce `FontAssetReference` with `family`, `weight`, `style`, `format`, source and license metadata. `TypePreset` gains `face: { assetId: string }` and optional `trioRole`. `validateFabricThemeEnvelope(input, { requireTrioRoles?: boolean })` remains tolerant by default for existing v2 Open and becomes strict only for New/Save.

- [ ] **Step 1: Write failing validation tests.**

```ts
expect(validateFabricThemeEnvelope(withStarterPresetsAndExactFaces())).toMatchObject({ ok: true });
expect(validateFabricThemeEnvelope(withStarterPresetsAndWrongWeight())).toMatchObject({ ok: false });
expect(validateFabricThemeEnvelope(withoutStarterPreset('mono'), { requireTrioRoles: true })).toMatchObject({ ok: false });
```

Cover malformed metadata, extension/format mismatch, non-font face IDs, duplicate IDs, absent required role, valid shared roles, unknown keys, and schema parity.

- [ ] **Step 2: Confirm failure.**

```bash
npm test -- --run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts
```

Expected: FAIL because font faces and starter presets are absent.

- [ ] **Step 3: Implement the smallest contract.** Discriminate asset declarations by kind and validate exact face family/weight/style. Allow zero or more presets to share a role. Require the three roles only through `requireTrioRoles` at New/Save, never while opening an existing v2 package.

- [ ] **Step 4: Verify and commit.**

```bash
npm run typecheck -w @vigilia/renderer-core
npm test -- --run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts
git add src/web/packages/renderer-core/src/theme/document.ts src/web/packages/renderer-core/src/theme/validate.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts schema/theme-document.schema.json src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts
git commit -m "feat(theme): validate packaged font presets"
```


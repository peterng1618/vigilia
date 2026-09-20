# Packaged Font Trios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start each new theme with presets covering three editable heading/body/mono roles, preview and explicitly apply curated trios, and embed only adopted font faces.

**Architecture:** `renderer-core` owns font-face declarations and preset validation. The editor owns curated metadata, temporary previews, and face-only pairing application. `scene-fabric` registers packaged bytes through `FontFace` before text measurement. A preset may declare a trio role; applying a trio changes the faces of role-assigned presets, preserving their global size, weight, line-height, and letter spacing.

**Tech Stack:** TypeScript, `FontFace`, Fabric 7.4.0, Vitest/jsdom, Playwright, Fontsource WOFF2.

**Spec:** `.agents/specs/0011-editor-property-model.md`; `.agents/specs/0013-fabric-scene-migration.md`

## Global Constraints

- Type presets remain complete global treatments; styled runs keep preset references and never own local typography.
- New themes contain at least `heading`, `body`, and `mono` role presets. Additional starter presets may share one of those three roles to retain a usable hierarchy. Mono is a technical/code option, never the default for large metrics.
- Apply updates faces on every role-assigned preset. It never changes their scale, palette references, or unassigned custom presets.
- Preview fetches/loads transiently. It must not create assets, history, dirty state, or persisted URLs.
- Every type preset exposes the same curated face picker. Applying one face adopts only that face and persists until the next trio Apply, which replaces every role-assigned preset face again.
- Adopted assets use exact Fontsource versions, WOFF2, source/license metadata, and no `latest` URL.
- Fonttrio-derived data needs MIT attribution in `THIRD-PARTY-NOTICES.md`; add no dependency.
- The current TypeScript DOM controls are a temporary adapter. Keep catalog, preview, adoption, and trio-application APIs independent of DOM layout so the later shadcn/Base UI shell can consume them without migration glue.

## Review Focus

- Rapid preview replacement leaves the package and dirty document unchanged.
- Applying a trio preserves numeric/style values across all role-assigned presets and leaves unassigned custom presets unchanged.
- Replacing a single preset face preserves its numeric/style values and does not download the other two faces in its current trio.
- Missing exact font faces reject the envelope before replacement.
- Runtime font failure remains visible and releases no unrelated face.
- Existing v2 themes remain readable until an editor action creates missing starter presets.

---

### Task 1: Record the revised contract

**Files:**
- Modify: `.agents/specs/0011-editor-property-model.md`
- Modify: `.agents/architecture.md`
- Modify: `THIRD-PARTY-NOTICES.md`

**Interfaces:** Documents `typePresets.heading`, `body`, and `mono`; defines optional `trioRole: 'heading' | 'body' | 'mono'` on a complete preset; starter scale presets may share a role; declares `editor/src/font-catalog.ts` as pairing-data owner.

- [x] **Step 1: Update the active typography rules.** Replace Google CSS endpoint acquisition with pinned Fontsource artifacts. State the three starter presets, mono's non-metric role, preview boundary, and face-only apply semantics.

- [x] **Step 2: Update ownership and notices.** Assign catalog data to the editor and add the Fonttrio MIT attribution for copied pairing metadata.

- [x] **Step 3: Review prose.** Verify no active rule requires immediate package adoption, mono metrics, remote CSS persistence, or a second typography-global owner.

- [x] **Step 4: Commit.**

```bash
git add .agents/specs/0011-editor-property-model.md .agents/architecture.md THIRD-PARTY-NOTICES.md
git commit -m "docs(theme): define font trio contract"
```

### Task 2: Validate declared faces and starter presets

**Files:**
- Modify: `src/web/packages/renderer-core/src/theme/document.ts`
- Modify: `src/web/packages/renderer-core/src/theme/validate.ts`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts`
- Modify: `schema/theme-document.schema.json`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts`

**Interfaces:** Produce `FontAssetReference` with `family`, `weight`, `style`, `format`, source and license metadata. `TypePreset` gains `face: { assetId: string }` and optional `trioRole`. `validateFabricThemeEnvelope(input, { requireTrioRoles?: boolean })` remains tolerant by default for existing v2 Open and becomes strict only for New/Save.

- [x] **Step 1: Write failing validation tests.**

```ts
expect(validateFabricThemeEnvelope(withStarterPresetsAndExactFaces())).toMatchObject({ ok: true });
expect(validateFabricThemeEnvelope(withStarterPresetsAndWrongWeight())).toMatchObject({ ok: false });
expect(validateFabricThemeEnvelope(withoutStarterPreset('mono'), { requireTrioRoles: true })).toMatchObject({ ok: false });
```

Cover malformed metadata, extension/format mismatch, non-font face IDs, duplicate IDs, absent required role, valid shared roles, unknown keys, and schema parity.

- [x] **Step 2: Confirm failure.**

```bash
npm test -- --run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts
```

Expected: FAIL because font faces and starter presets are absent.

- [x] **Step 3: Implement the smallest contract.** Discriminate asset declarations by kind and validate exact face family/weight/style. Allow zero or more presets to share a role. Require the three roles only through `requireTrioRoles` at New/Save, never while opening an existing v2 package.

- [x] **Step 4: Verify and commit.**

```bash
npm run typecheck -w @vigilia/renderer-core
npm test -- --run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts
git add src/web/packages/renderer-core/src/theme/document.ts src/web/packages/renderer-core/src/theme/validate.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts schema/theme-document.schema.json src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts
git commit -m "feat(theme): validate packaged font presets"
```

### Task 3: Add curated trios and transient preview

**Files:**
- Create: `src/web/packages/editor/src/font-catalog.ts`
- Create: `src/web/packages/editor/src/font-catalog.test.ts`
- Create: `src/web/packages/editor/src/font-preview.ts`
- Create: `src/web/packages/editor/src/font-preview.dom.test.ts`

**Interfaces:** `FontTrio` contains identifier, display name, three pinned Fontsource faces, subset, source and license. `previewFontFace(face): Promise<PreviewHandle>` loads a releasable, non-persisted face.

- [x] **Step 1: Write failing catalog and preview tests.**

```ts
expect(fontTrio('minimal')?.faces).toHaveLength(3);
await previewFontFace(fontTrio('minimal')!.faces[0]);
expect(assetManager.assets).toEqual({});
```

Cover exact-version URLs, no `latest`, duplicate identity, aborting a prior preview, rejected fetch/load, and scoped cleanup.

- [x] **Step 2: Confirm failure.**

```bash
npm test -- --run packages/editor/src/font-catalog.test.ts packages/editor/src/font-preview.dom.test.ts
```

Expected: FAIL because no catalog or preview owner exists.

- [x] **Step 3: Implement the preview boundary.** Vendor approved Fonttrio trio metadata only when all faces resolve through Fontsource. Fetch/preview one face with abort/release. Never add declarations, bytes, hashes, history, or dirty state.

- [x] **Step 4: Verify and commit.**

```bash
npm run typecheck -w @vigilia/editor
npm test -- --run packages/editor/src/font-catalog.test.ts packages/editor/src/font-preview.dom.test.ts
git add src/web/packages/editor/src/font-catalog.ts src/web/packages/editor/src/font-catalog.test.ts src/web/packages/editor/src/font-preview.ts src/web/packages/editor/src/font-preview.dom.test.ts
git commit -m "feat(editor): preview curated font trios"
```

### Task 4: Apply a trio and load packaged faces

**Files:**
- Create: `src/web/packages/scene-fabric/src/font-assets.ts`
- Create: `src/web/packages/scene-fabric/src/font-assets.dom.test.ts`
- Modify: `src/web/packages/scene-fabric/src/index.ts`
- Modify: `src/web/packages/editor/src/asset-manager/index.ts`
- Modify: `src/web/packages/editor/src/asset-manager/index.dom.test.ts`
- Modify: `src/web/packages/editor/src/type-preset-panel.ts`
- Modify: `src/web/packages/editor/src/type-preset-panel.dom.test.ts`
- Modify: `src/web/packages/editor/src/fork-extensions/index.ts`
- Modify: `src/web/packages/editor/src/new-fabric-theme.ts`
- Modify: `src/web/packages/player/src/main.ts`
- Modify: `src/web/tests/e2e/editor-fork.spec.ts`
- Modify: `.agents/status.md`

**Interfaces:** `AssetManager.adoptFont(face, bytes)` copies/hashs an exact face. `applyFontTrio(presets, trio, assets)` replaces face references on all presets assigned to matching roles. `applyPresetFace(presetId, face)` adopts one face and preserves the complete treatment and its `trioRole`. `loadFontAssets({ assets, bytes, onError }): Promise<() => void>` loads packaged faces before revival.

- [ ] **Step 1: Write failing integration tests.**

```ts
const result = await extensions.applyFontTrio('minimal');
expect(result.typePresets.heading.value).toMatchObject({ size: prior.size, face: { assetId: 'inter-700' } });
expect(result.typePresets.metric.value).toMatchObject({ size: metricPrior.size, face: { assetId: 'inter-700' } });
expect(result.typePresets.custom).toEqual(priorCustom);
expect(result.assets['assets/inter-700.woff2']).toBeDefined();
const single = await extensions.applyPresetFace('heading', fontTrio('minimal')!.faces[1]);
expect(single.typePresets.heading.value).toMatchObject({ size: prior.size, face: { assetId: 'inter-400' } });
expect(single.typePresets.heading.value.trioRole).toBe('heading');
```

Cover three required new-theme roles, existing multi-size starter presets sharing a role, face-only trio and single-preset changes, picker preview with no asset mutation, failed adoption with no document mutation, referenced asset deletion refusal, Open/Save retention, and FontFace release isolation.

- [ ] **Step 2: Confirm failure.**

```bash
npm test -- --run packages/scene-fabric/src/font-assets.dom.test.ts packages/editor/src/asset-manager/index.dom.test.ts packages/editor/src/type-preset-panel.dom.test.ts packages/editor/src/fork-extensions/index.dom.test.ts
```

Expected: FAIL because adoption, pairing, and runtime loading do not exist.

- [ ] **Step 3: Implement the smallest UI and lifecycle.** Add a trio selector with Preview and Apply, plus a Font button in every type-preset editor that opens the same searchable curated catalog and previews the chosen candidate. Trio Apply fetches three pinned WOFF2 faces, adds declarations/bytes, updates every matching role-preset face in one history entry, reapplies Fabric styles, and marks dirty once. Single-face Apply fetches/adopts only that face, preserves the selected preset's scale and role, and marks dirty once; the next trio Apply replaces it again. Mark the existing dashboard's metric/clock/wordmark presets as heading role and its supporting presets as body role; add an unused mono starter preset. Await package-face registration before editor/player revival; display errors and release only loaded faces on replacement/unmount.

- [ ] **Step 4: Add rendered proof, run the full gate, update handoff, commit, and push.**

```powershell
npm run typecheck
npm test
npm run build
$env:VIGILIA_CAPTURE='1'; npx playwright test -g 'font trio|visual review' --workers=1
npm run size
npm run test:e2e
git add src/web/packages/scene-fabric/src/font-assets.ts src/web/packages/scene-fabric/src/font-assets.dom.test.ts src/web/packages/scene-fabric/src/index.ts src/web/packages/editor/src/asset-manager/index.ts src/web/packages/editor/src/asset-manager/index.dom.test.ts src/web/packages/editor/src/type-preset-panel.ts src/web/packages/editor/src/type-preset-panel.dom.test.ts src/web/packages/editor/src/fork-extensions/index.ts src/web/packages/editor/src/new-fabric-theme.ts src/web/packages/player/src/main.ts src/web/tests/e2e/editor-fork.spec.ts .agents/status.md
git commit -m "feat(editor): apply packaged font trios"
git push
```

Inspect every capture before size and browser checks. Record exact outputs and incomplete commands in `status.md`.

## Plan Self-Review

- Task 1 defines ownership and licensed data use; Task 2 validates new persisted state; Task 3 keeps browsing transient; Task 4 adopts, renders, persists, and disposes exact faces.
- Tasks 2, 3, and 4 cover invalid declarations, rapid preview, and adoption/load failure.
- Scope excludes variable fonts, axes, automatic scale replacement, Fonttrio runtime tooling, arbitrary URLs, shadcn/Base UI adoption, and fork changes.

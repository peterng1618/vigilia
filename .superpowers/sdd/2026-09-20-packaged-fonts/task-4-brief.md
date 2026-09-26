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

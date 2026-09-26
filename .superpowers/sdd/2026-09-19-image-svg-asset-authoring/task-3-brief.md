### Task 3: Integrate asset controls and package persistence

**Files:**
- Create: `src/web/packages/editor/src/asset-manager/panel.dom.test.ts`
- Modify: `src/web/packages/editor/src/persist.ts`
- Modify: `src/web/packages/editor/src/persist.test.ts`
- Modify: `src/web/packages/editor/src/persistence-manager/index.ts`
- Modify: `src/web/packages/editor/src/persistence-manager/index.test.ts`
- Modify: `src/web/packages/editor/src/fork-extensions/index.ts`
- Modify: `src/web/packages/editor/src/fork-main.ts`

**Interfaces:** `parseThemePackage(bytes)` returns `{ envelope, assets }`; `serializeThemePackage(envelope, assets)` writes exact bytes. Asset controls expose `data-vigilia-asset-import`, `data-vigilia-asset-replace` and `data-vigilia-asset-remove`.

- [ ] **Step 1: Replace the obsolete empty-assets rejection tests.**

```ts
const parsed = parseThemePackage(writeThemePackage({ envelope, assets }).bytes);
expect(parsed).toMatchObject({ ok: true, envelope });
if (parsed.ok) expect(parsed.assets['assets/logo.png']).toEqual(assets['assets/logo.png']);
```

Add a dirty-tracking test where only a byte changes, plus selected replacement and referenced-delete refusal panel tests.

- [ ] **Step 2: Confirm failure.** Run `npm test -- --run packages/editor/src/persist.test.ts packages/editor/src/persistence-manager/index.test.ts`; expect current empty-assets guard failure.

- [ ] **Step 3: Thread the exact asset map through each boundary.** Change persistence keys to include envelope plus bytes. On package/library Open, validate first, then pass parsed assets into `mount`; do not destroy the active editor before mount/hydration succeeds. New starts `{}`. On save, snapshot Fabric plus manager declarations, then write its exact map. Build an `Assets` panel with hidden local-file controls: Import creates a centered selectable `FabricImage`, stores `vigiliaAsset`, saves fork history and refreshes layers. Replace requires exactly one selected asset image and changes only it. Remove scans every canvas object and refuses referenced assets; successful removal revokes its preview URL.

- [ ] **Step 4: Verify.** Run `npm run typecheck -w @vigilia/editor && npm test -- --run packages/editor/src/persist.test.ts packages/editor/src/persistence-manager/index.test.ts packages/editor/src/asset-manager/index.dom.test.ts packages/editor/src/asset-manager/panel.dom.test.ts`; expect PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/web/packages/editor/src/asset-manager/panel.dom.test.ts src/web/packages/editor/src/persist.ts src/web/packages/editor/src/persist.test.ts src/web/packages/editor/src/persistence-manager/index.ts src/web/packages/editor/src/persistence-manager/index.test.ts src/web/packages/editor/src/fork-extensions/index.ts src/web/packages/editor/src/fork-main.ts
git commit -m "feat(editor): import and replace packaged images"
```


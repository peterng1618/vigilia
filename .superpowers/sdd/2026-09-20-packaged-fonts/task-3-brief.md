### Task 3: Add curated trios and transient preview

**Files:**
- Create: `src/web/packages/editor/src/font-catalog.ts`
- Create: `src/web/packages/editor/src/font-catalog.test.ts`
- Create: `src/web/packages/editor/src/font-preview.ts`
- Create: `src/web/packages/editor/src/font-preview.dom.test.ts`

**Interfaces:** `FontTrio` contains identifier, display name, three pinned Fontsource faces, subset, source and license. `previewFontFace(face): Promise<PreviewHandle>` loads a releasable, non-persisted face.

- [ ] **Step 1: Write failing catalog and preview tests.**

```ts
expect(fontTrio('minimal')?.faces).toHaveLength(3);
await previewFontFace(fontTrio('minimal')!.faces[0]);
expect(assetManager.assets).toEqual({});
```

Cover exact-version URLs, no `latest`, duplicate identity, aborting a prior preview, rejected fetch/load, and scoped cleanup.

- [ ] **Step 2: Confirm failure.**

```bash
npm test -- --run packages/editor/src/font-catalog.test.ts packages/editor/src/font-preview.dom.test.ts
```

Expected: FAIL because no catalog or preview owner exists.

- [ ] **Step 3: Implement the preview boundary.** Vendor approved Fonttrio trio metadata only when all faces resolve through Fontsource. Fetch/preview one face with abort/release. Never add declarations, bytes, hashes, history, or dirty state.

- [ ] **Step 4: Verify and commit.**

```bash
npm run typecheck -w @vigilia/editor
npm test -- --run packages/editor/src/font-catalog.test.ts packages/editor/src/font-preview.dom.test.ts
git add src/web/packages/editor/src/font-catalog.ts src/web/packages/editor/src/font-catalog.test.ts src/web/packages/editor/src/font-preview.ts src/web/packages/editor/src/font-preview.dom.test.ts
git commit -m "feat(editor): preview curated font trios"
```


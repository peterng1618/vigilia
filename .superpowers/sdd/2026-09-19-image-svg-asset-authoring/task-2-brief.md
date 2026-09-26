### Task 2: Build the open-package asset manager

**Files:**
- Create: `src/web/packages/editor/src/asset-manager/index.ts`
- Create: `src/web/packages/editor/src/asset-manager/index.dom.test.ts`

**Interfaces:** Produces `AssetManager` with `assets`, `import(file)`, `remove(assetId)`, `load(envelope, assets)`, `hydrate(canvas)` and `destroy()`. It consumes `File`, `FabricImage` and `VIGILIA_ASSET_PROPERTY`.

- [ ] **Step 1: Write failing import/lifecycle tests.**

```ts
const imported = await manager.import(new File([pngBytes], 'logo.png', { type: 'image/png' }));
expect(imported).toMatchObject({ id: 'logo', kind: 'image', path: 'assets/logo.png' });
expect(manager.assets['assets/logo.png']).toEqual(pngBytes);
await expect(manager.import(unsafeSvg)).rejects.toThrow('unsafe SVG');
```

Cover MIME/extension allowlists, collision suffixes, no mutation on rejection, preview URL revocation, and asset hydration from byte maps.

- [ ] **Step 2: Confirm failure.** Run `npm test -- --run packages/editor/src/asset-manager/index.dom.test.ts`; expect missing module failure.

- [ ] **Step 3: Implement with native browser APIs.** Use `File.arrayBuffer()`, `URL.createObjectURL`, `DOMParser`, `XMLSerializer` and `crypto.subtle.digest('SHA-256', bytes)`; add no dependency. Keep original SVG bytes, but only preview a sanitized Blob after rejecting `script`, `foreignObject`, event handlers, external `href`/`src`, CSS URLs and unsafe elements. Allocate `assets/<safe-name>.<extension>` plus numeric suffixes, derive stable non-colliding IDs, emit `sha256`, and hydrate carrying Fabric images with a preview URL.

- [ ] **Step 4: Verify.** Run `npm test -- --run packages/editor/src/asset-manager/index.dom.test.ts && npm run typecheck -w @vigilia/editor`; expect PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/web/packages/editor/src/asset-manager/index.ts src/web/packages/editor/src/asset-manager/index.dom.test.ts
git commit -m "feat(editor): manage packaged image assets"
```


# Image/SVG Asset Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import local PNG, JPEG, WebP and SVG files into portable theme packages, insert or replace Fabric images, and retain bytes through open/save/library flows.

**Architecture:** `editor/src/asset-manager/` owns declared bytes and preview URLs. `scene-fabric` persists the stable `vigiliaAsset` reference in Fabric JSON. `ForkExtensions` composes the manager and passes its exact byte map through `persist.ts` and `PersistenceManager`.

**Tech Stack:** TypeScript, Fabric 7.4.0 via `fabric/es`, Vitest/jsdom, Playwright and `@vigilia/theme-package`.

**Spec:** `.agents/specs/0011-editor-property-model.md`

## Global Constraints

- Accept only local PNG, JPEG, WebP and SVG files. GIF, video, font and URL import are out of scope.
- Copy bytes only to the open package's `assets/` map; never write or modify the source file.
- Preserve original SVG bytes but sanitize a separate preview; reject external SVG resources.
- Persist `assetId`, never object URLs. Revoke object URLs on replacement or destroy.
- Package/library open and save carry the exact declared byte map. Invalid input leaves the active document unchanged.
- Use the fork's canvas/history mechanics; do not replace generic image-editor behavior.

## Review Focus

- Script, event handler or external-resource SVG input has no executable/network preview path.
- Extension/MIME mismatch and unsupported files do not mutate the canvas or byte map.
- Reopened assets hydrate from package bytes rather than serialized blob URLs.
- Replacement updates only the selected image; removing a referenced asset is refused.
- Byte-only changes mark the document dirty and the saved ZIP exactly matches declarations.

---

### Task 1: Persist Fabric asset references

**Files:**
- Create: `src/web/packages/scene-fabric/src/object-asset.ts`
- Create: `src/web/packages/scene-fabric/src/object-asset.test.ts`
- Modify: `src/web/packages/scene-fabric/src/persist.ts`
- Modify: `src/web/packages/scene-fabric/src/index.ts`
- Modify: `src/web/packages/scene-fabric/src/persist.dom.test.ts`

**Interfaces:** Produces `VIGILIA_ASSET_PROPERTY = 'vigiliaAsset'`, `FabricAssetReference`, `setObjectAssetReference()` and `objectAssetReference()`. Fabric JSON must contain only `{ assetId, kind: 'image' | 'svg' }`.

- [ ] **Step 1: Write failing pure and revival tests.**

```ts
expect(objectAssetReference(object)).toEqual({ assetId: 'logo', kind: 'svg' });
expect(objectAssetReference(invalidObject)).toBeUndefined();
expect(serialiseScene(canvas).objects[0]).toMatchObject({ vigiliaAsset: { assetId: 'logo' } });
```

- [ ] **Step 2: Confirm failure.** Run `npm test -- --run packages/scene-fabric/src/object-asset.test.ts`; expect missing module failure.

- [ ] **Step 3: Implement the one custom-property owner.** Validate non-empty stable IDs and allowed kinds, add the property to `SCENE_PERSISTED_PROPERTIES`, export it, and prove `serialiseScene`/`reviveScene` retain it on a `FabricImage` fixture.

- [ ] **Step 4: Verify.** Run `npm test -- --run packages/scene-fabric/src/object-asset.test.ts packages/scene-fabric/src/persist.dom.test.ts && npm run typecheck -w @vigilia/scene-fabric`; expect PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/web/packages/scene-fabric/src/object-asset.ts src/web/packages/scene-fabric/src/object-asset.test.ts src/web/packages/scene-fabric/src/persist.ts src/web/packages/scene-fabric/src/index.ts src/web/packages/scene-fabric/src/persist.dom.test.ts
git commit -m "feat(scene): persist image asset references"
```

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

### Task 4: Prove visual import and package round-trip

**Files:**
- Modify: `src/web/tests/e2e/editor-fork.spec.ts`
- Modify: `.agents/screenshots/README.md`
- Create: `.agents/screenshots/editor-fork-assets-desktop-chromium.png`
- Modify: `.agents/status.md`

**Interfaces:** Browser test imports a local PNG/SVG via the visible panel, replaces the selected image, saves, reopens and observes a visible Fabric image. Capture name is `editor-fork-assets-desktop-chromium.png`.

- [ ] **Step 1: Add the browser test and a capture.**

```ts
await page.locator('[data-vigilia-asset-import]').setInputFiles(pngFixture);
await page.locator('[data-vigilia-asset-replace]').setInputFiles(svgFixture);
expect((await savePackage(page)).assets['assets/logo.svg']).toBeDefined();
```

Use Playwright buffers for valid fixtures, inspect the downloaded ZIP with `readThemePackage`, reopen it, assert the Fabric image remains visible, and capture the selected asset and controls.

- [ ] **Step 2: Prove the regression test.** Temporarily omit `vigiliaAsset` persistence or the replacement update, rerun the focused test, observe failure, then restore production code.

- [ ] **Step 3: Build, capture and inspect.** Run `npm run build -w @vigilia/editor; $env:VIGILIA_CAPTURE='1'; npx playwright test tests/e2e/editor-fork.spec.ts --project=desktop-chromium --grep 'imports and round-trips packaged images' --workers=1`; expect PASS and inspect the created screenshot for an unstretched artboard and selected image.

- [ ] **Step 4: Run the full verification tier.** Run `npm run typecheck; npm test; npm run build; $env:VIGILIA_CAPTURE='1'; npx playwright test -g 'visual review|imports and round-trips packaged images' --workers=1; npm run size; npm run test:e2e`. Inspect every generated screenshot before size and browser suite; stop at the first failure.

- [ ] **Step 5: Record evidence, commit and push.** Update status only with this session's results, then:

```bash
git add src/web/tests/e2e/editor-fork.spec.ts .agents/screenshots/README.md .agents/screenshots/editor-fork-assets-desktop-chromium.png .agents/status.md
git commit -m "test(editor): cover packaged asset authoring"
git push origin feat/fabric-editor-migration
```

## Plan Self-Review

- Spec coverage: allowlist, copied bytes, stable references, selected replacement, protected deletion, SVG preview safety, package/library persistence and browser evidence map to Tasks 1-4.
- Boundary coverage: `scene-fabric` owns custom-property persistence; editor owns URLs, file UI and bytes; `theme-package` remains validator/writer.
- Scope: no dependency, remote URL fetch, GIF/video/font support, host-storage redesign or generic fork replacement.
- Review focus: Tasks 1-4 each contain the indicated regression test.

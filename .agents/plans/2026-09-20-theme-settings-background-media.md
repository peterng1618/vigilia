# Theme Settings and Background Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Author portable Theme settings, palette-backed background paint, one fitted image or video background, and explicit SemVer releases.

**Architecture:** renderer-core owns envelope types, validation and SemVer math. scene-fabric owns DOM media layering below Fabric. The editor extends its existing asset manager/artboard panel, while player reuses the scene-fabric media mount. theme-package remains an exact byte container.

**Tech Stack:** TypeScript, browser DOM media APIs, Fabric 7.4.0 via fabric/es, Vitest/jsdom, Playwright and @vigilia/theme-package.

**Spec:** .agents/specs/0011-editor-property-model.md; .agents/specs/0013-fabric-scene-migration.md

## Global Constraints

- The v2 envelope adds metadata.version?: string and artboard.backgroundMedia?: { assetId: string; fit: 'contain' | 'cover' }.
- Only local PNG, JPEG, WebP, SVG, MP4 and WebM are accepted. GIF, fonts and URLs are rejected here.
- Paint remains palette-referenced. One optional declared image/SVG/video is DOM-only, never a Fabric object/history entry.
- Viewport fit places the artboard; media fit places media inside it. Contain exposes paint; cover crops.
- Video uses autoplay, muted, loop and playsInline. No playback controls, timeline, rotation or grouping.
- Save does not change version. Release validates, explicitly selects major/minor/patch, then initializes 0.1.0 or bumps SemVer and writes the normal package path.
- Reuse AssetManager, ForkShell, mountFabricScene and package boundaries. Add no dependency.

## Review Focus

- Undeclared, missing-byte, or wrong-kind background asset fails before Open/Save/Release changes the active theme.
- Bad MIME/extension or unsafe SVG leaves declarations, bytes, URLs and active media unchanged.
- Contain media retains aspect ratio and exposes palette paint after resize.
- Replace, clear, New, Open and unmount leave no stale media element or dedicated background blob URL.
- Malformed versions are refused; only Release changes a valid version.

---

### Task 1: Define and validate the envelope contract

**Files:**
- Modify: src/web/packages/renderer-core/src/theme/document.ts
- Modify: src/web/packages/renderer-core/src/theme/validate.ts
- Modify: src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts
- Modify: src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts
- Modify: schema/theme-document.schema.json
- Modify: src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts

**Interfaces:**
- Produces BackgroundMedia, Artboard.backgroundMedia, ThemeMetadata.version, isSemanticVersion(value), and bumpSemanticVersion(version, level).
- Later tasks receive validated image/svg/video asset IDs and a SemVer bump result.

- [ ] **Step 1: Write failing validator and schema-sync tests.**

~~~ts
expect(validateFabricThemeEnvelope({ ...envelope(), metadata: { version: '1.2.3' } })).toMatchObject({ ok: true });
expect(validateFabricThemeEnvelope({ ...envelope(), metadata: { version: 'v1.2.3' } })).toMatchObject({ ok: false });
expect(validateFabricThemeEnvelope({ ...envelope(), artboard: { width: 100, height: 100, backgroundMedia: { assetId: 'clip', fit: 'cover' } }, assets: [{ id: 'clip', kind: 'video', path: 'assets/clip.mp4' }] })).toMatchObject({ ok: true });
expect(schema.$defs.artboard.properties.backgroundMedia).toEqual({ $ref: '#/$defs/backgroundMedia' });
~~~

Cover undeclared IDs, font assets, invalid fit, unknown keys and package bytes that do not exactly match declarations.

- [ ] **Step 2: Confirm failure.**

Run: npm test -- --run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts

Expected: FAIL because version/backgroundMedia are not part of the v2 contract.

- [ ] **Step 3: Implement the minimal shared contract.**

Define exact major.minor.patch SemVer without prerelease/build metadata. Validate metadata fields, background-media object keys, fit, declared asset ID and allowed declared kind. Extend the schema identically. Keep paint optional in the type validator so unreleased v2 documents remain readable; edited/new themes must select an existing palette entry.

- [ ] **Step 4: Verify.**

Run: npm run typecheck -w @vigilia/renderer-core; npm test -- --run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~bash
git add src/web/packages/renderer-core/src/theme/document.ts src/web/packages/renderer-core/src/theme/validate.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts schema/theme-document.schema.json src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts
git commit -m "feat(theme): define background media envelope"
~~~

### Task 2: Mount fitted DOM media beneath Fabric

**Files:**
- Create: src/web/packages/scene-fabric/src/background-media.ts
- Create: src/web/packages/scene-fabric/src/background-media.dom.test.ts
- Modify: src/web/packages/scene-fabric/src/index.ts
- Modify: src/web/packages/scene-fabric/src/scene.ts
- Modify: src/web/packages/editor/src/fork-shell.ts
- Modify: src/web/packages/editor/src/fork-shell.dom.test.ts

**Interfaces:**
- Produces mountBackgroundMedia({ host, artboard, assets, resolveAsset }): BackgroundMediaHandle, where resolveAsset returns { url, dispose? }.
- BackgroundMediaHandle exposes update(options) and destroy().
- ForkShell updates the handle whenever artboard/media declarations change.

- [ ] **Step 1: Write failing DOM tests.**

~~~ts
const handle = mountBackgroundMedia({ host, artboard: { width: 400, height: 200, backgroundMedia: { assetId: 'hero', fit: 'contain' } }, assets: [image], resolveAsset: () => 'blob:hero' });
expect(host.querySelector('img')?.style.objectFit).toBe('contain');
expect(host.querySelector('video')).toBeNull();
handle.destroy();
expect(host.querySelector('[data-vigilia-background-media]')).toBeNull();
~~~

Cover tag selection, cover/contain, video autoplay/muted/loop/playsInline, missing URL, replacement, cleanup and canvas-above-media ordering.

- [ ] **Step 2: Confirm failure.**

Run: npm test -- --run packages/scene-fabric/src/background-media.dom.test.ts packages/editor/src/fork-shell.dom.test.ts

Expected: FAIL because the mount module and fork hook do not exist.

- [ ] **Step 3: Implement one DOM media owner.**

Create an absolute overflow-hidden artboard media layer. Its child uses object-fit and full logical bounds; call the supplied dispose callback on replacement/destroy but never revoke hosted HTTP URLs. Insert it before the Fabric canvas in mountFabricScene. ForkShell creates, updates and destroys it with the editor; do not add media to Fabric JSON, SceneAdapter, history or fork source.

- [ ] **Step 4: Verify and commit.**

~~~bash
npm run typecheck -w @vigilia/scene-fabric
npm run typecheck -w @vigilia/editor
npm test -- --run packages/scene-fabric/src/background-media.dom.test.ts packages/editor/src/fork-shell.dom.test.ts
git add src/web/packages/scene-fabric/src/background-media.ts src/web/packages/scene-fabric/src/background-media.dom.test.ts src/web/packages/scene-fabric/src/index.ts src/web/packages/scene-fabric/src/scene.ts src/web/packages/editor/src/fork-shell.ts src/web/packages/editor/src/fork-shell.dom.test.ts
git commit -m "feat(scene): mount fitted background media"
~~~

### Task 3: Extend packaged assets for video backgrounds

**Files:**
- Modify: src/web/packages/editor/src/asset-manager/index.ts
- Modify: src/web/packages/editor/src/asset-manager/index.dom.test.ts
- Modify: src/web/packages/editor/src/asset-manager/panel.dom.test.ts
- Modify: src/web/packages/editor/src/fork-extensions/index.ts
- Modify: src/web/packages/editor/src/fork-extensions/index.dom.test.ts

**Interfaces:**
- AssetManager.import(file) accepts approved video files; backgroundSource(assetId) returns { url, dispose } with a dedicated revocable URL.
- AssetManager removal receives background-reference information from ForkExtensions.
- The generic Assets panel lists video but never sends it to FabricImage insertion/replacement.

- [ ] **Step 1: Write failing lifecycle tests.**

~~~ts
await expect(manager.import(new File([mp4], 'loop.mp4', { type: 'video/mp4' }))).resolves.toMatchObject({ kind: 'video', path: 'assets/loop.mp4' });
await expect(manager.import(new File([mp4], 'loop.webm', { type: 'video/mp4' }))).rejects.toThrow('MIME type');
expect(removeReferencedBackground()).toBe(false);
~~~

Cover WebM, MIME/extension mismatch, retained bytes after load, no media insertion into Fabric, and clear/remove/destroy dedicated-background URL lifecycle.

- [ ] **Step 2: Confirm failure.**

Run: npm test -- --run packages/editor/src/asset-manager/index.dom.test.ts packages/editor/src/asset-manager/panel.dom.test.ts packages/editor/src/fork-extensions/index.dom.test.ts

Expected: FAIL because video is unsupported and background references are not protected.

- [ ] **Step 3: Implement the existing manager extension.**

Add MP4 and WebM MIME pairs and kind video. Keep path/id/hash allocation and exact package bytes. Keep SVG sanitation exclusive to SVG. Add backgroundSource() to create a fresh sanitized preview Blob URL and revoke it through its returned dispose callback. The existing asset panel may display video but refuses FabricImage actions. Before remove, ForkExtensions checks Fabric references and artboard.backgroundMedia.

- [ ] **Step 4: Verify and commit.**

~~~bash
npm run typecheck -w @vigilia/editor
npm test -- --run packages/editor/src/asset-manager/index.dom.test.ts packages/editor/src/asset-manager/panel.dom.test.ts packages/editor/src/fork-extensions/index.dom.test.ts
git add src/web/packages/editor/src/asset-manager/index.ts src/web/packages/editor/src/asset-manager/index.dom.test.ts src/web/packages/editor/src/asset-manager/panel.dom.test.ts src/web/packages/editor/src/fork-extensions/index.ts src/web/packages/editor/src/fork-extensions/index.dom.test.ts
git commit -m "feat(editor): retain background media assets"
~~~

### Task 4: Compose Theme settings and explicit releases

**Files:**
- Modify: src/web/packages/editor/src/artboard-panel.ts
- Modify: src/web/packages/editor/src/artboard-panel.dom.test.ts
- Modify: src/web/packages/editor/src/fork-extensions/index.ts
- Modify: src/web/packages/editor/src/fork-extensions/index.dom.test.ts
- Modify: src/web/packages/editor/src/persist.ts
- Modify: src/web/packages/editor/src/persist.test.ts

**Interfaces:**
- The rendered panel is Theme settings and emits metadata/artboard state to ForkExtensions.
- Controls expose data-vigilia-theme-name, data-vigilia-theme-author, data-vigilia-theme-description, data-vigilia-theme-version, data-vigilia-background-asset, data-vigilia-background-media-fit and data-vigilia-theme-release.
- Release reuses the existing validated save/package path after a chosen bump.

- [ ] **Step 1: Write failing UI and release tests.**

~~~ts
name.value = 'Living Room'; name.dispatchEvent(new Event('change'));
expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ metadata: { name: 'Living Room' } }));
backgroundAsset.value = 'clip'; backgroundAsset.dispatchEvent(new Event('change'));
expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ artboard: { backgroundMedia: { assetId: 'clip', fit: 'cover' } } }));
release.click(); expect(confirm).toHaveBeenCalled();
~~~

Cover clearing, unavailable declarations, metadata length/blank handling, malformed version refusal, initial version, each bump and ordinary Save preserving version.

- [ ] **Step 2: Confirm failure.**

Run: npm test -- --run packages/editor/src/artboard-panel.dom.test.ts packages/editor/src/fork-extensions/index.dom.test.ts packages/editor/src/persist.test.ts

Expected: FAIL because Theme settings and Release controls do not exist.

- [ ] **Step 3: Implement the one product settings panel.**

Retain dimensions, viewport fit and palette selects; add metadata, media source/fit and clear-media option. Source options derive from declarations, not filename guesses. Input rejection restores current state. ForkExtensions remains the one envelope owner and refreshes paint/media/dirty snapshots after change. Release validates package first, asks exactly major/minor/patch through the existing browser UI convention, bumps only then calls the normal save writer.

- [ ] **Step 4: Verify and commit.**

~~~bash
npm run typecheck -w @vigilia/editor
npm test -- --run packages/editor/src/artboard-panel.dom.test.ts packages/editor/src/fork-extensions/index.dom.test.ts packages/editor/src/persist.test.ts
git add src/web/packages/editor/src/artboard-panel.ts src/web/packages/editor/src/artboard-panel.dom.test.ts src/web/packages/editor/src/fork-extensions/index.ts src/web/packages/editor/src/fork-extensions/index.dom.test.ts src/web/packages/editor/src/persist.ts src/web/packages/editor/src/persist.test.ts
git commit -m "feat(editor): author theme backgrounds and releases"
~~~

### Task 5: Resolve player media and record rendered evidence

**Files:**
- Modify: src/web/packages/player/src/main.ts
- Create: src/web/packages/player/src/background-media.dom.test.ts
- Modify: src/web/tests/e2e/editor-fork.spec.ts
- Modify: src/web/tests/e2e/player.spec.ts
- Modify: .agents/screenshots/README.md
- Create: .agents/screenshots/theme-background-media-desktop-chromium.png
- Modify: .agents/status.md

**Interfaces:**
- Fixture and hosted-player paths pass media declarations and an asset resolver into mountFabricScene.
- The browser test observes a DOM media element below the Fabric canvas and package round-trip asset bytes.

- [ ] **Step 1: Write focused player/editor browser tests.**

~~~ts
await page.locator('[data-vigilia-background-asset]').selectOption('background-video');
await expect(page.locator('#artboard video[autoplay][muted][loop][playsinline]')).toHaveCount(1);
await expect(page.locator('#artboard canvas')).toBeVisible();
~~~

Use tiny valid checked-in MP4/WebM and image fixtures. Assert fit mode, paint exposed by contain, no Fabric-object count change, save/open byte retention and alignment after resize.

- [ ] **Step 2: Prove the regression test.**

Temporarily omit editor/player media mounting, run the focused test and observe failure, then restore production code before any build.

- [ ] **Step 3: Build, capture and inspect.**

Run: npm run build -w @vigilia/editor; npm run build -w @vigilia/player; $env:VIGILIA_CAPTURE='1'; npx playwright test tests/e2e/editor-fork.spec.ts tests/e2e/player.spec.ts --project=desktop-chromium --grep 'background media|theme settings' --workers=1

Expected: PASS. Inspect the screenshot for artboard ratio, canvas-above-media layering and paint-filled contain bars.

- [ ] **Step 4: Run the full verification tier.**

Run: npm run typecheck; npm test; npm run build; $env:VIGILIA_CAPTURE='1'; npx playwright test -g 'visual review|background media|theme settings' --workers=1; npm run size; npm run test:e2e

Expected: PASS. Inspect all generated screenshots before size/browser checks and stop at the first failure.

- [ ] **Step 5: Record evidence, commit and push.**

~~~bash
git add src/web/packages/player/src/main.ts src/web/packages/player/src/background-media.dom.test.ts src/web/tests/e2e/editor-fork.spec.ts src/web/tests/e2e/player.spec.ts .agents/screenshots/README.md .agents/screenshots/theme-background-media-desktop-chromium.png .agents/status.md
git commit -m "test(theme): cover background media authoring"
git push origin feat/fabric-editor-migration
~~~

## Plan Self-Review

- Spec coverage: shape/schema/reference checks are Task 1; artboard-aligned lifecycle is Task 2; package assets/deletion guard are Task 3; Theme settings/release flow are Task 4; rendered player/editor behavior is Task 5.
- Boundary coverage: renderer-core validates semantics, scene-fabric owns DOM layering, editor owns local bytes/control state, theme-package carries exact bytes, and player does not import editor UI.
- Scope: no remote imports, GIF, font authoring, media timeline, Fabric media objects, generic fork changes, host-storage redesign or dependencies.
- Review focus: Tasks 1-5 each include tests for the listed user-visible failure mode.

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


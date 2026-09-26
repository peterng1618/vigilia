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


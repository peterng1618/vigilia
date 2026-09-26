### Task 3: Register and release hosted player faces

**Files:**
- Modify: `src/web/packages/player/src/main.ts`
- Modify: `src/web/packages/scene-fabric/src/font-assets.dom.test.ts`
- Modify: `.agents/status.md`

**Interfaces:** Consumes `loadHostedFontAssets` and `loadFontAssets`. The hosted player awaits `loadFontAssets({ assets: theme.assets ?? [], bytes, onError })` before `reviveThemeEnvelope`, and calls its returned release function from the one-shot `pagehide` handler.

- [ ] **Step 1: Write the failing lifecycle tests.**

```ts
it('reports a missing hosted font byte and releases only successfully loaded faces', async () => {
  const release = await loadFontAssets({ assets: [first, missing], bytes: { [first.path]: new Uint8Array([1]) }, fonts, createFontFace, onError });
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('missing'));
  release();
  expect(fonts.delete).toHaveBeenCalledWith(loadedFace);
  expect(fonts.delete).not.toHaveBeenCalledWith(missingFace);
});
```

- [ ] **Step 2: Run the lifecycle tests to verify failure.**

Run: `npm test -- --run packages/scene-fabric/src/font-assets.dom.test.ts`

Expected: FAIL because hosted player startup does not register/release loaded package faces.

- [ ] **Step 3: Register faces before revival and release them on player unload.**

```ts
const bytes = await loadHostedFontAssets(theme.id, theme, window.fetch.bind(window));
const releaseFonts = await loadFontAssets({ assets: theme.assets ?? [], bytes, onError: (message) => showFailure(host, message) });
await reviveThemeEnvelope(handle.canvas, theme);
window.addEventListener('pagehide', () => {
  releaseFonts();
  window.clearInterval(timer);
  observer.disconnect();
  liveHandle.close();
}, { once: true });
```

- [ ] **Step 4: Run focused regression checks.**

Run: `npm test -- --run packages/scene-fabric/src/font-assets.dom.test.ts packages/player/src/theme-loader.test.ts packages/host/src/server.test.ts && npm run typecheck && npm run build -w @vigilia/player`

Expected: PASS.

- [ ] **Step 5: Update handoff and commit.**

```powershell
git add src/web/packages/player/src/main.ts src/web/packages/scene-fabric/src/font-assets.dom.test.ts .agents/status.md
git commit -m "feat(player): load hosted package fonts"
```

Record the hosted browser runtime as unverified: Playwright previews Vite bundles and does not run the Node host.


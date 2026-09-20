# Hosted Font Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load exact hosted package font bytes before the player revives its Fabric scene.

**Architecture:** `host/src/server.ts` serves bytes only when a validated package declares the requested asset path. `player/src/theme-loader.ts` fetches only declared `font` assets; `player/src/main.ts` registers them through `scene-fabric` before revival and releases that player instance's faces on page unload. The player neither reads ZIP files nor imports `theme-package`.

**Tech Stack:** TypeScript, Node HTTP, Vitest, `FontFace`, Fabric 7.4.0.

**Spec:** `.agents/specs/0011-editor-property-model.md`

## Global Constraints

- The route is read-only and permits only assets declared by the stored validated package.
- Invalid theme IDs and malformed/undeclared asset paths must not expose bytes.
- The player fetches declared font assets only; image/video asset delivery remains unchanged.
- Player FontFace registration completes before `reviveThemeEnvelope`; runtime failure is visible and releases no unrelated face.
- `@vigilia/player` must not import `@vigilia/theme-package` or editor code.

## Review Focus

- A traversal-like encoded asset path receives no stored bytes; cover it in Task 1.
- A declared non-font asset is not downloaded by the player; cover it in Task 2.
- One failed font request reports a visible error while successfully loaded faces remain releasable; cover it in Task 3.
- Page unload releases the current player faces exactly once; cover it in Task 3.
- Host asset reads remain available to LAN display clients but cannot mutate packages; cover it in Task 1.

---

### Task 1: Serve declared package assets

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/host/src/server.test.ts`

**Interfaces:** Consumes `ThemeStore.read(id): Promise<ThemeStoreRecord | undefined>`. Produces `GET /api/themes/:id/assets/:assetPath`, returning the exact declared bytes with `application/octet-stream` or 404; it never writes.

- [ ] **Step 1: Write the failing route tests.**

```ts
it('serves only declared package asset bytes', async () => {
  await request(hosted.server, 'PUT', '/api/themes/living-room', packageWithAsset('assets/inter-400.woff2', [1, 2]));
  const response = await request(hosted.server, 'GET', '/api/themes/living-room/assets/assets%2Finter-400.woff2');
  expect(response.status).toBe(200);
  expect([...response.body]).toEqual([1, 2]);
});

it('refuses undeclared and traversal-like asset paths', async () => {
  expect((await request(hosted.server, 'GET', '/api/themes/living-room/assets/assets%2Fmissing.woff2')).status).toBe(404);
  expect((await request(hosted.server, 'GET', '/api/themes/living-room/assets/%2e%2e%2Fsecret')).status).toBe(404);
});
```

- [ ] **Step 2: Run the route tests to verify failure.**

Run: `npm test -- --run packages/host/src/server.test.ts`

Expected: FAIL because the host has no declared-asset route.

- [ ] **Step 3: Implement the narrow route.**

```ts
const assetMatch = url.pathname.match(/^\/api\/themes\/([^/]+)\/assets\/(.+)$/);
if (assetMatch && request.method === 'GET') {
  const id = decodeURIComponent(assetMatch[1] ?? '');
  const assetPath = decodeURIComponent(assetMatch[2] ?? '');
  const record = isValidThemeId(id) ? await themeStore.read(id) : undefined;
  const declared = record?.envelope.assets?.find((asset) => asset.path === assetPath);
  const bytes = declared === undefined ? undefined : record?.assets[declared.path];
  if (bytes === undefined) { sendText(response, 404, 'Theme asset not found.'); return; }
  response.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' });
  response.end(Buffer.from(bytes));
  return;
}
```

- [ ] **Step 4: Run the host test and typecheck.**

Run: `npm test -- --run packages/host/src/server.test.ts && npm run typecheck -w @vigilia/host`

Expected: PASS.

- [ ] **Step 5: Commit the route.**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(host): serve declared theme assets"
```

### Task 2: Fetch hosted font bytes in the player

**Files:**
- Modify: `src/web/packages/player/src/theme-loader.ts`
- Modify: `src/web/packages/player/src/theme-loader.test.ts`
- Modify: `src/web/packages/player/src/boundaries.test.ts`

**Interfaces:** Consumes a validated `FabricThemeEnvelope`, theme ID and `fetch`. Produces `loadHostedFontAssets(id, envelope, fetcher): Promise<Readonly<Record<string, Uint8Array>>>`; it fetches `/api/themes/${id}/assets/${encodeURIComponent(asset.path)}` only for `asset.kind === 'font'`.

- [ ] **Step 1: Write the failing loader tests.**

```ts
it('fetches exact bytes for declared font assets only', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2])));
  await expect(loadHostedFontAssets('living-room', fontEnvelope, fetcher))
    .resolves.toEqual({ 'assets/inter-400.woff2': new Uint8Array([1, 2]) });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith('/api/themes/living-room/assets/assets%2Finter-400.woff2');
});

it('rejects a failed declared font fetch', async () => {
  await expect(loadHostedFontAssets('living-room', fontEnvelope, async () => new Response('', { status: 404 })))
    .rejects.toThrow('font asset');
});
```

- [ ] **Step 2: Run the loader tests to verify failure.**

Run: `npm test -- --run packages/player/src/theme-loader.test.ts`

Expected: FAIL because `loadHostedFontAssets` does not exist.

- [ ] **Step 3: Implement exact declared-font fetching and retain the import boundary.**

```ts
export async function loadHostedFontAssets(id: string, theme: FabricThemeEnvelope, fetcher: typeof fetch): Promise<Readonly<Record<string, Uint8Array>>> {
  const fonts = (theme.assets ?? []).filter((asset) => asset.kind === 'font');
  const entries = await Promise.all(fonts.map(async (asset) => {
    const response = await fetcher(`/api/themes/${encodeURIComponent(id)}/assets/${encodeURIComponent(asset.path)}`);
    if (!response.ok) throw new Error(`Could not load font asset "${asset.id}" (${response.status}).`);
    return [asset.path, new Uint8Array(await response.arrayBuffer())] as const;
  }));
  return Object.fromEntries(entries);
}
```

- [ ] **Step 4: Run player tests, typecheck, and boundary gate.**

Run: `npm test -- --run packages/player/src/theme-loader.test.ts packages/player/src/boundaries.test.ts && npm run typecheck -w @vigilia/player`

Expected: PASS.

- [ ] **Step 5: Commit the player loader.**

```bash
git add src/web/packages/player/src/theme-loader.ts src/web/packages/player/src/theme-loader.test.ts src/web/packages/player/src/boundaries.test.ts
git commit -m "feat(player): fetch hosted font assets"
```

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

### Task 4: Verify the full hosted-font path

**Files:**
- Modify: `.agents/status.md`

**Interfaces:** Consumes the complete host route, player loader, and runtime lifecycle. Produces current verification evidence only.

- [ ] **Step 1: Run full workspace verification.**

```powershell
npm run typecheck
npm test
npm run build
npm run size
npm run test:e2e
```

- [ ] **Step 2: Record only observed results and limitations.**

Update `.agents/status.md` with exact check outcomes, the inspected hosted-font capture, and any command without a completion summary.

- [ ] **Step 3: Commit verification evidence.**

```bash
git add .agents/status.md
git commit -m "docs(status): record hosted font verification"
```

## Plan Self-Review

- Spec coverage: Task 1 provides validated read-only bytes; Task 2 keeps ZIP parsing out of player; Task 3 loads/reports/releases faces; Task 4 records evidence.
- No placeholders: every behavior has a named owner, test command, and route/function shape.
- Interfaces: Task 1 route matches Task 2 fetch URL; Task 2 byte map matches Task 3 `loadFontAssets` input.
- Review focus: traversal/LAN reads (Task 1), non-font exclusion and failed font retrieval (Task 2), and partial load/release (Task 3) are covered; the status records the Vite-only browser limitation.

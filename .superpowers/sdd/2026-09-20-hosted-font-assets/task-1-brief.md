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


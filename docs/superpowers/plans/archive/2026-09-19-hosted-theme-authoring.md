# Hosted Existing-Feature Theme Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an author use the currently implemented editor features, save the v2 theme to the local host, reopen it, and view it in the player with real host telemetry.

**Architecture:** The editor owns the authored envelope and package file/library interaction. The host validates whole packages before atomic storage and supplies validated envelopes to the player. The player continues using Fabric `StaticCanvas`; live samples remain runtime-only through `SampleSource`.

**Tech Stack:** TypeScript, browser File/Blob/fetch, Node `fs/promises`/`http`, existing `fflate` package reader/writer, Fabric 7.4.0, Vitest/jsdom and Playwright.

**Spec:** `.agents/specs/0010-host-cli-and-live-telemetry.md`, `.agents/specs/0011-editor-property-model.md`, `.agents/specs/0013-fabric-scene-migration.md`, `.agents/specs/0015-theme-package.md`; product §§47, 67, 93, 105, 116, 134, 139 and 141.

## Global Constraints

- Active editor files are validated v2 `.vigilia-theme` packages, including valid empty asset sets; JSON is not an active save/open route.
- Scope is existing authoring only: artboard/fit/paint, palette, type presets, semantic text, charts/settings/bindings/paint, layers and arrange.
- Images/SVG, fonts, video, widgets, new shape creation and broader text editing are explicitly out of scope; themes will not use them yet.
- Host storage validates the complete package before atomic replacement; mutation is loopback-only while player reads may reach displays.
- Player does not import `@vigilia/theme-package`, editor code, or interactive `Canvas`.
- Runtime samples, connection state and preview data never enter envelope/package/history/dirty state. Editor defaults to a deterministic fluctuating `PreviewSource`; Live host telemetry is an explicit switch. Player routes default to live data.
- Preserve `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `fabric/es`, v2 validation and player size/import gates.

## Review Focus

- Invalid/hostile upload preserves the prior package and current editor; Tasks 1–2 test both boundaries.
- LAN peers can read a selected theme but cannot mutate storage; Task 1 tests the two paths.
- Empty-asset packages package, save, load and render; Tasks 1–4 test the supported no-asset case.
- Artboard values, token/type references, chart settings/bindings and Fabric geometry survive save/open; Tasks 2 and 4 test this.
- Preview values fluctuate reproducibly without per-sensor controls, and a live disconnect stays missing/stale without changing bytes or history; Task 3 tests both.

---

### Task 1: Store complete theme packages in the host

**Files:**
- Create: `src/web/packages/host/src/themes/store.ts`
- Create: `src/web/packages/host/src/themes/store.test.ts`
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/host/src/server.test.ts`
- Modify: `src/web/packages/host/src/cli/args.ts`
- Modify: `src/web/packages/host/src/cli/args.test.ts`
- Modify: `src/web/packages/host/src/main.ts`

**Interfaces:** Produces `ThemeStore.list/read/write`, `GET /api/themes`, `GET /api/themes/:id/document` and loopback-only `PUT /api/themes/:id`. Consumes existing package validation.

- [ ] **Step 1: Write failing store and route tests**

```ts
const entry = await store.write('living-room', validEmptyAssetPackage);
expect(entry.id).toBe('living-room');
expect((await store.read('living-room'))?.envelope.id).toBe('living-room');
expect((await request(server, 'GET', '/api/themes/living-room/document')).status).toBe(200);
expect((await request(server, 'PUT', '/api/themes/living-room', validEmptyAssetPackage, {
  remoteAddress: '10.0.0.2',
})).status).toBe(403);
```

Cover malformed/oversized replacement preserving old bytes, invalid/traversal ids, metadata-only list output and document responses without raw archive bytes.

- [ ] **Step 2: Run tests to verify failure**

Run: `cmd.exe /d /s /c "npm test -- --run packages/host/src/themes/store.test.ts packages/host/src/server.test.ts packages/host/src/cli/args.test.ts"`

Expected: FAIL because no theme store or routes exist.

- [ ] **Step 3: Implement atomic package storage**

```ts
export interface ThemeStore {
  list(): Promise<readonly { readonly id: string; readonly name: string; readonly updatedAt: string }[]>;
  read(id: string): Promise<ThemePackageResult | undefined>;
  write(id: string, bytes: Uint8Array): Promise<{ readonly id: string; readonly name: string; readonly updatedAt: string }>;
}
```

Add `--themes-dir` with a stable Vigilia-data default. Parse/validate before writing `<id>.vigilia-theme.tmp`, then rename over the sibling package. Reuse existing method and loopback guards; only `PUT` mutates.

- [ ] **Step 4: Run focused proof**

Run: `cmd.exe /d /s /c "npm run typecheck -w @vigilia/host && npm test -- --run packages/host/src/themes/store.test.ts packages/host/src/server.test.ts packages/host/src/cli/args.test.ts"`

Expected: empty package read/write succeeds, bad replacement preserves content, display reads succeed and remote writes fail.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/themes/store.ts src/web/packages/host/src/themes/store.test.ts src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts src/web/packages/host/src/cli/args.ts src/web/packages/host/src/cli/args.test.ts src/web/packages/host/src/main.ts
git commit -m "feat(host): store validated theme packages"
```

### Task 2: Make editor Open/Save package-only and host-library aware

**Files:**
- Create: `src/web/packages/editor/src/theme-library-client.ts`
- Create: `src/web/packages/editor/src/theme-library-client.test.ts`
- Modify: `src/web/packages/editor/src/persistence-manager/index.ts`
- Modify: `src/web/packages/editor/src/persistence-manager/index.test.ts`
- Modify: `src/web/packages/editor/src/fork-main.ts`
- Modify: `src/web/packages/editor/src/fork-extensions/index.ts`
- Modify: `src/web/packages/editor/src/fork-extensions/index.dom.test.ts`
- Modify: `src/web/packages/editor/src/persist.ts`
- Modify: `src/web/packages/editor/src/persist.test.ts`

**Interfaces:** Consumes Task 1 routes. Produces `ThemeLibraryClient`, package-only picker/download and `PersistenceManager.save(envelope): Promise<void>` for supported empty-asset envelopes.

- [ ] **Step 1: Write failing persistence/client tests**

```ts
await client.save('living-room', packageBytes);
expect(fetch).toHaveBeenCalledWith('/api/themes/living-room', expect.objectContaining({ method: 'PUT' }));
await expect(client.open('living-room')).resolves.toEqual(packageBytes);
await manager.save(changedEnvelope);
expect(downloaded.name).toBe('living-room.vigilia-theme');
expect(readThemePackage(downloaded.bytes)).toMatchObject({ ok: true, envelope: changedEnvelope });
```

Cover empty assets, malformed picker input, library failure and dirty Save/Discard/Cancel. Assert failed opening preserves geometry, palette/types and chart bindings.

- [ ] **Step 2: Run tests to verify failure**

Run: `cmd.exe /d /s /c "npm test -- --run packages/editor/src/theme-library-client.test.ts packages/editor/src/persistence-manager/index.test.ts packages/editor/src/persist.test.ts packages/editor/src/fork-extensions/index.dom.test.ts"`

Expected: FAIL because editor downloads/parses JSON and has no library client.

- [ ] **Step 3: Implement the real package file flow**

```ts
export interface ThemeLibraryClient {
  list(): Promise<readonly { readonly id: string; readonly name: string; readonly updatedAt: string }[]>;
  open(id: string): Promise<Uint8Array>;
  save(id: string, bytes: Uint8Array): Promise<void>;
}
```

Make `.vigilia-theme` the sole picker/download type and save with `writeThemePackage({ envelope, assets: {} })`. Reject asset-bearing packages with clear copy until asset authoring exists. Add labelled **Open package**, **Save package**, **Open library** and **Save to library** controls/shortcuts. Stage parse/revival before replacing the shell and retain dirty replacement protection.

- [ ] **Step 4: Run focused proof**

Run: `cmd.exe /d /s /c "npm run typecheck -w @vigilia/editor && npm test -- --run packages/editor/src/theme-library-client.test.ts packages/editor/src/persistence-manager/index.test.ts packages/editor/src/persist.test.ts packages/editor/src/fork-extensions/index.dom.test.ts"`

Expected: current authored properties survive package download, upload, library open and local reopen; no raw JSON route remains.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/theme-library-client.ts src/web/packages/editor/src/theme-library-client.test.ts src/web/packages/editor/src/persistence-manager/index.ts src/web/packages/editor/src/persistence-manager/index.test.ts src/web/packages/editor/src/fork-main.ts src/web/packages/editor/src/fork-extensions/index.ts src/web/packages/editor/src/fork-extensions/index.dom.test.ts src/web/packages/editor/src/persist.ts src/web/packages/editor/src/persist.test.ts
git commit -m "feat(editor): save complete theme packages"
```

### Task 3: Add fluctuating editor preview data with an explicit live switch

**Files:**
- Create: `src/web/packages/editor/src/live-source.ts`
- Create: `src/web/packages/editor/src/live-source.test.ts`
- Create: `src/web/packages/editor/src/preview-source.ts`
- Create: `src/web/packages/editor/src/preview-source.test.ts`
- Modify: `src/web/packages/editor/src/fork-main.ts`
- Modify: `src/web/packages/editor/src/chart-manager/index.ts`
- Modify: `src/web/packages/editor/src/chart-manager/index.dom.test.ts`
- Modify: `src/web/packages/editor/src/fork-shell.dom.test.ts`
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/host/src/server.test.ts`

**Interfaces:** Consumes `createLiveSource`, the existing fake-source waveform utilities, bindings and SSE. Produces `createPreviewSource`, `createEditorSource({ mode, keys, onStatus })` and a ChartManager source update path.

- [ ] **Step 1: Write failing live-editor tests**

```ts
const preview = createPreviewSource({ keys: ['cpu.load'], now: () => clock.now });
const first = preview.source.sample('cpu.load');
clock.now += 1_000;
const next = preview.source.sample('cpu.load');
expect(next.value).not.toBe(first.value);
expect(snapshotAfterLiveUpdate()).toEqual(snapshotBeforeLiveUpdate());
```

Test deterministic fluctuation for every requested key, bounded preview history, an explicit Preview/Live control, honest live disconnect state and no `historyManager.saveState` from preview or incoming samples.

- [ ] **Step 2: Run tests to verify failure**

Run: `cmd.exe /d /s /c "npm test -- --run packages/editor/src/preview-source.test.ts packages/editor/src/live-source.test.ts packages/editor/src/chart-manager/index.dom.test.ts packages/editor/src/fork-shell.dom.test.ts packages/host/src/server.test.ts"`

Expected: FAIL because editor has no first-class preview source or source-mode control.

- [ ] **Step 3: Implement preview/live source selection**

```ts
export function createPreviewSource(options: {
  readonly keys: readonly string[];
  readonly now: () => number;
}): { readonly source: SampleSource };

export function createEditorSource(options: {
  readonly mode: 'preview' | 'live';
  readonly keys: readonly string[];
  readonly onStatus: (status: LiveSourceStatus, detail?: string) => void;
}): { readonly source: SampleSource; close(): void };
```

Derive the key union from current envelope bindings and reconnect live telemetry after authored binding changes. `PreviewSource` uses a seeded, time-based waveform per semantic key and the existing bounded history rules, so a reopened document renders the same animation at the same test clock without knowing any chart family. It has no value fields, scenarios or persisted settings. Add one labelled Preview/Live source control; Preview is the initial editor mode and Live is an explicit author choice. Redraw through runtime chart paths only; callbacks must not call persistence, dirty tracking or history.

- [ ] **Step 4: Run focused proof**

Run: `cmd.exe /d /s /c "npm run typecheck -w @vigilia/editor && npm run typecheck -w @vigilia/host && npm test -- --run packages/editor/src/preview-source.test.ts packages/editor/src/live-source.test.ts packages/editor/src/chart-manager/index.dom.test.ts packages/editor/src/fork-shell.dom.test.ts packages/host/src/server.test.ts"`

Expected: preview updates animate charts, live batches repaint charts, disconnect is honest and envelope/package/history do not change.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/live-source.ts src/web/packages/editor/src/live-source.test.ts src/web/packages/editor/src/preview-source.ts src/web/packages/editor/src/preview-source.test.ts src/web/packages/editor/src/fork-main.ts src/web/packages/editor/src/chart-manager/index.ts src/web/packages/editor/src/chart-manager/index.dom.test.ts src/web/packages/editor/src/fork-shell.dom.test.ts src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(editor): add animated preview source"
```

### Task 4: Load hosted themes in player and prove the author-to-display workflow

**Files:**
- Create: `src/web/packages/player/src/theme-loader.ts`
- Create: `src/web/packages/player/src/theme-loader.test.ts`
- Modify: `src/web/packages/player/src/main.ts`
- Modify: `src/web/packages/player/src/boundaries.test.ts`
- Create: `src/web/tests/e2e/theme-authoring-workflow.spec.ts`
- Modify: `src/web/tests/e2e/editor-fork.spec.ts`
- Create: `.agents/screenshots/theme-authoring-workflow-desktop-chromium.png`
- Modify: `.agents/screenshots/README.md`

**Interfaces:** Consumes Tasks 1–3 and produces `loadHostedTheme(id, fetch)` plus observed editor → host → player evidence.

- [ ] **Step 1: Write failing loader/workflow tests**

```ts
const theme = await loadHostedTheme('living-room', fetch);
expect(theme.id).toBe('living-room');
await expect(loadHostedTheme('../escape', fetch)).rejects.toThrow('theme id');

test('authors, saves and displays an existing-feature theme', async ({ page, context }) => {
  await page.goto(`${hostUrl}/editor/?data=live`);
  await editPaletteTypeAndChartBinding(page);
  await page.getByRole('button', { name: 'Save to library' }).click();
  const display = await context.newPage();
  await display.goto(`${hostUrl}/?theme=authoring-proof`);
  await expect(display.locator('canvas')).toBeVisible();
});
```

Use a built host, test-local theme directory and deterministic real provider registry. Assert artboard token, type-preset value, chart binding/settings and Fabric text geometry survive editor reopen and appear in player; a live sample repaints player without stored-byte change.

- [ ] **Step 2: Run tests to verify failure**

Run: `cmd.exe /d /s /c "npm test -- --run packages/player/src/theme-loader.test.ts packages/player/src/boundaries.test.ts"`

Expected: FAIL because player only loads fixture themes.

- [ ] **Step 3: Implement hosted player load**

```ts
export async function loadHostedTheme(id: string, fetcher: typeof fetch): Promise<FabricThemeEnvelope> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid theme id.');
  const response = await fetcher(`/api/themes/${encodeURIComponent(id)}/document`);
  if (!response.ok) throw new Error(`Could not load theme (${response.status}).`);
  const result = validateFabricThemeEnvelope(await response.json());
  if (!result.ok) throw new Error(result.issues[0]?.message ?? 'Invalid hosted theme.');
  return result.envelope;
}
```

Host redirects `/` to a saved default only when one exists; otherwise player shows a clear no-theme failure. Keep `?theme=demo` only as a Vite/test fixture; the player itself remains live-only. Preserve the player import boundary.

- [ ] **Step 4: Run full verification and inspect evidence**

Run:

```bash
npm run typecheck
npm test
npm run build
VIGILIA_CAPTURE=1 npx playwright test -g "visual review|authors, saves and displays an existing-feature theme" --workers=1
npm run size
npm run test:e2e
```

Expected: typechecks, units, builds and size pass; inspect generated captures before browser suite. If browser launch reports `spawn EPERM`, record visual/browser evidence as unverified.

- [ ] **Step 5: Update observed docs and commit**

Record host storage, package-only editor persistence, player loading and editor Preview/Live telemetry only after observed tests. Leave image/SVG, font and video authoring explicitly not implemented.

```bash
git add src/web/packages/player/src/theme-loader.ts src/web/packages/player/src/theme-loader.test.ts src/web/packages/player/src/main.ts src/web/packages/player/src/boundaries.test.ts src/web/tests/e2e/theme-authoring-workflow.spec.ts src/web/tests/e2e/editor-fork.spec.ts .agents/screenshots/theme-authoring-workflow-desktop-chromium.png .agents/screenshots/README.md .agents/specs/0010-host-cli-and-live-telemetry.md .agents/specs/0011-editor-property-model.md .agents/specs/0013-fabric-scene-migration.md .agents/architecture.md .agents/status.md
git commit -m "test(theme): verify hosted authoring workflow"
```

## Self-review

- Task 1 makes packages durable/safe; Task 2 gives existing authoring package-only save/open; Task 3 provides animated preview plus honest optional live telemetry; Task 4 proves saved authored state in player.
- There are no raw JSON, demo-substitution or browser-only bridges in the host workflow.
- `ThemeStore` owns host bytes, `ThemeLibraryClient` transports full bytes, envelope validation stays at each boundary, `PreviewSource` owns generated animation and `createEditorSource` owns runtime lifecycle.
- Stored replacement/LAN mutation are Task 1; empty package/editor preservation Task 2; preview determinism and runtime honesty Task 3; player fidelity Task 4.

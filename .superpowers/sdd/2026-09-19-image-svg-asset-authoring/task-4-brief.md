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

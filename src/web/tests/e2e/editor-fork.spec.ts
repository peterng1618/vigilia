import { expect, test } from '@playwright/test';

const EDITOR = 'http://127.0.0.1:4174/';

test.describe('Fabric editor route', () => {
  test('mounts the adopted editor shell on the editor stage', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);

    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();
    await expect(page.locator('#status')).toHaveText('Fabric editor ready');
  });

  test('captures the mounted editor for visual review', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();

    const directory = process.env['VIGILIA_CAPTURE'] === undefined
      ? 'test-results/screenshots'
      : '../../.agents/screenshots';
    const screenshot = await page.screenshot({ path: `${directory}/editor-fork-${testInfo.project.name}.png` });

    await testInfo.attach(`editor-fork-${testInfo.project.name}.png`, {
      body: screenshot,
      contentType: 'image/png',
    });
    expect(screenshot.byteLength).toBeGreaterThan(1000);
  });

  test('opens a v2 theme and keeps the active editor when its Fabric runtime is incompatible', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    const picker = page.locator('input[type="file"]');
    const envelope = {
      schemaVersion: 2,
      fabricVersion: '7.4.0',
      id: 'opened',
      artboard: { width: 320, height: 180 },
      scene: { version: '7.4.0', objects: [{ type: 'Rect', id: 'panel', width: 100, height: 50 }] },
    };

    await picker.setInputFiles({
      name: 'opened.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(envelope)),
    });
    await expect(page.locator('#status')).toHaveText('Opened opened.json');
    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();

    await picker.setInputFiles({
      name: 'incompatible.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ ...envelope, fabricVersion: '7.5.0' })),
    });
    await expect(page.locator('#status')).toContainText('incompatible');
    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();
  });

  test('round-trips an opened v2 Fabric scene through the fork save path', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    const picker = page.locator('input[type="file"]');
    await picker.setInputFiles({
      name: 'source.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        schemaVersion: 2,
        fabricVersion: '7.4.0',
        id: 'source',
        artboard: { width: 320, height: 180 },
        scene: { version: '7.4.0', objects: [{ type: 'Rect', id: 'panel', width: 100, height: 50 }] },
      })),
    });
    await expect(page.locator('#status')).toHaveText('Opened source.json');

    const download = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    const stream = await (await download).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const saved = Buffer.concat(chunks);
    const envelope = JSON.parse(saved.toString('utf8')) as { id: string; scene: { objects: Array<{ id?: string }> } };

    expect(envelope.id).toBe('source');
    expect(envelope.scene.objects).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'panel' })]));

    await picker.setInputFiles({ name: 'roundtrip.json', mimeType: 'application/json', buffer: saved });
    await expect(page.locator('#status')).toHaveText('Opened roundtrip.json');
  });

  test('keeps the active document when Fabric cannot revive a schema-valid scene', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'unrevivable.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        schemaVersion: 2,
        fabricVersion: '7.4.0',
        id: 'unrevivable',
        artboard: { width: 320, height: 180 },
        scene: { version: '7.4.0', objects: [{ type: 'UnknownFabricObject' }] },
      })),
    });

    await expect(page.locator('#status')).toContainText('Could not open');
    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();
  });

  test('asks before Open discards a changed Fabric scene', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.evaluate(() => {
      const editor = Object.entries(window as unknown as Record<string, unknown>)
        .find(([key]) => key.startsWith('vigilia-fabric-editor-'))?.[1] as { canvas: { item(index: number): { set(key: string, value: number): void } | undefined; requestRenderAll(): void } } | undefined;
      editor?.canvas.item(1)?.set('left', 64);
      editor?.canvas.requestRenderAll();
    });
    await page.keyboard.press('Control+o');

    const dialog = page.locator('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Save changes before opening another theme?');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();
  });

  test('asks before New discards a changed Fabric scene', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.evaluate(() => {
      const editor = Object.entries(window as unknown as Record<string, unknown>)
        .find(([key]) => key.startsWith('vigilia-fabric-editor-'))?.[1] as { canvas: { item(index: number): { set(key: string, value: number): void } | undefined; requestRenderAll(): void } } | undefined;
      editor?.canvas.item(1)?.set('left', 64);
      editor?.canvas.requestRenderAll();
    });
    await page.keyboard.press('Control+n');

    const dialog = page.locator('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#status')).toHaveText('Fabric editor ready');
  });
});

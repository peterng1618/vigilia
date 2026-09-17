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
});

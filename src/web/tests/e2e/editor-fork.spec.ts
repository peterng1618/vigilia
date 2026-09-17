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
});

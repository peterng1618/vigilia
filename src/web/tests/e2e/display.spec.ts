import { expect, test, type Page } from '@playwright/test';

/**
 * What only a browser can answer about the display path.
 *
 * The unit suite already proves the plan is correct. These tests prove the plan
 * reaches the screen: the elements exist, the artboard transform places them,
 * the chart canvases actually painted pixels, and a missing sample shows a
 * placeholder rather than a number.
 *
 * Every assertion is structural, for the reason given in `playwright.config.ts`:
 * CI is Linux, development is Windows, and glyph rasterisation differs.
 */

/** Pinned so the fake source is frozen and every frame is identical. */
const FIXED_TIME = new Date('2026-01-01T12:00:00Z');

/**
 * Opens the player on a controlled clock.
 *
 * `install` rather than `setFixedTime`, and then advanced rather than frozen,
 * for a reason worth recording: a chart whose content is **entirely** animated
 * draws nothing until its animation progresses. A frozen clock leaves the line
 * chart and the donut blank, while the gauge and the bars still show because
 * their tracks are static. That is real player behaviour, not a test artefact —
 * a screenshot taken in the same tick as the mount would catch a dashboard
 * mid-appearance.
 *
 * Advancing a fake clock keeps every value a pure function of a fixed start
 * time, so determinism survives.
 */
async function openPlayer(page: Page): Promise<void> {
  // Install before navigation, or the first frame is built from the real clock.
  await page.clock.install({ time: FIXED_TIME });
  await page.goto('/');
  await page.waitForSelector('[data-vigilia="artboard"]');
  // ECharts draws on an animation frame, so wait for a canvas to exist rather
  // than assuming setOption painted synchronously.
  await page.locator('[data-node-id="cpu-gauge"] canvas').first().waitFor();
  // Past the default 1 s ECharts animation, so everything has settled.
  await page.clock.runFor(1500);
}

test.describe('the demo dashboard renders', () => {
  test('mounts every node the fixture declares', async ({ page }) => {
    await openPlayer(page);

    for (const id of [
      'title',
      'cpu-panel',
      'cpu-panel-bg',
      'cpu-gauge',
      'cpu-readout',
      'cpu-label',
      'gpu-gauge',
      'history-chart',
      'thermals-bars',
      'memory-donut',
      'memory-readout',
      'memory-unmapped',
    ]) {
      await expect(page.locator(`[data-node-id="${id}"]`), `node ${id} is missing`).toHaveCount(1);
    }
  });

  test('nests group children inside their group element', async ({ page }) => {
    await openPlayer(page);

    // §57: transforms compose. A child rendered as a sibling would still look
    // right in this fixture — its coordinates happen to be small — so assert
    // the structure rather than the position.
    await expect(
      page.locator('[data-node-id="cpu-panel"] > [data-node-id="cpu-gauge"]'),
    ).toHaveCount(1);
  });

  test('paints a canvas for all four chart families', async ({ page }) => {
    await openPlayer(page);

    for (const id of ['cpu-gauge', 'history-chart', 'thermals-bars', 'memory-donut']) {
      const canvas = page.locator(`[data-node-id="${id}"] canvas`).first();
      await expect(canvas, `chart ${id} has no canvas`).toBeVisible();

      // A canvas that exists but painted nothing is the failure mode worth
      // catching: every chart adapter is unit-tested on its option object, and
      // an option the engine silently rejects would still produce this element.
      const painted = await canvas.evaluate((element) => {
        const source = element as HTMLCanvasElement;
        const context = source.getContext('2d');
        if (context === null) {
          return false;
        }
        const { data } = context.getImageData(0, 0, source.width, source.height);
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 0) {
            return true;
          }
        }
        return false;
      });

      expect(painted, `chart ${id} drew no pixels`).toBe(true);
    }
  });

  test('shows a formatted live value with its unit', async ({ page }) => {
    await openPlayer(page);

    // The readout is a value run plus a literal unit run, styled differently.
    const readout = page.locator('[data-node-id="cpu-readout"]');
    await expect(readout).toHaveText(/^\d+%$/);

    const spans = readout.locator('span');
    await expect(spans).toHaveCount(2);
  });

  test('shows a placeholder for an unmapped key, never a zero', async ({ page }) => {
    await openPlayer(page);

    // §83, end to end: the one deliberately unmapped binding in the fixture.
    const node = page.locator('[data-node-id="memory-unmapped"]');
    await expect(node).toContainText('—');
    await expect(node).not.toContainText('0');
  });

  test('marks a non-ok sample with its status for styling', async ({ page }) => {
    // The fixture's GPU temperature goes out for 6 of every 24 seconds. Rather
    // than hunting for a frozen instant inside that window, step the clock in
    // one-second increments until the outage appears.
    await page.clock.install({ time: FIXED_TIME });
    await page.goto('/');
    await page.waitForSelector('[data-vigilia="artboard"]');

    const statusSpan = page.locator('[data-node-id="thermals-gpu-label"] span[data-status]');

    let seen = false;
    for (let second = 0; second < 26 && !seen; second++) {
      await page.clock.runFor(1000);
      seen = (await statusSpan.count()) > 0;
    }

    expect(seen, 'the simulated outage never produced a status-marked span').toBe(true);
    await expect(statusSpan.first()).toHaveAttribute('data-status', 'error');
    await expect(statusSpan.first()).toHaveText('—');
  });

  test('states on screen that the data is synthetic', async ({ page }) => {
    await openPlayer(page);

    // §97: a fabricated reading must never be presentable as a real one, and a
    // convincing screenshot is the likeliest way that happens by accident.
    await expect(page.getByText(/SYNTHETIC DATA/)).toBeVisible();
  });
});

test.describe('the artboard transform', () => {
  test('scales uniformly and fills an exactly matching viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'viewport is fixed at 1280x720 here');

    await openPlayer(page);

    const artboard = page.locator('[data-vigilia="artboard"]');
    const transform = await artboard.evaluate((el) => getComputedStyle(el).transform);

    // The artboard is 1280x720 and so is the viewport, so scale is exactly 1
    // and there is no translation. matrix(1, 0, 0, 1, 0, 0) is the identity.
    expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
  });

  test('letterboxes a 16:9 design on a taller phone (§53)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-chromium', 'needs the phone viewport');

    await openPlayer(page);

    const box = await page.locator('[data-vigilia="artboard"]').boundingBox();
    const viewport = page.viewportSize();

    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();

    if (box === null || viewport === null) {
      return;
    }

    // Contain fits the whole design, so the scaled artboard must be no larger
    // than the viewport in either axis — and strictly smaller in the axis the
    // aspect ratio does not match.
    expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.height).toBeLessThan(viewport.height);

    // Uniform scale: the rendered aspect ratio still matches the artboard's.
    expect(box.width / box.height).toBeCloseTo(1280 / 720, 2);
  });

  test('keeps the design inside the viewport after a resize', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'resizes the desktop viewport');

    await openPlayer(page);
    await page.setViewportSize({ width: 900, height: 900 });

    const box = await page.locator('[data-vigilia="artboard"]').boundingBox();
    expect(box).not.toBeNull();

    if (box !== null) {
      // §57: scaled, not re-laid-out. A reflow would change the aspect ratio.
      expect(box.width / box.height).toBeCloseTo(1280 / 720, 2);
      expect(box.width).toBeLessThanOrEqual(901);
    }
  });
});

test.describe('update behaviour', () => {
  test('updates values without recreating chart canvases', async ({ page }) => {
    // "Update charts without recreating the scene." A recreated canvas would
    // restart every animation and throw away the engine's state each second.
    await page.clock.install({ time: FIXED_TIME });
    await page.goto('/');
    await page.locator('[data-node-id="cpu-gauge"] canvas').first().waitFor();

    const canvas = page.locator('[data-node-id="cpu-gauge"] canvas').first();
    await canvas.evaluate((el) => {
      (el as HTMLCanvasElement).dataset['marked'] = 'yes';
    });

    await page.clock.runFor(3000);

    // The same element is still there: it was updated, not replaced.
    await expect(canvas).toHaveAttribute('data-marked', 'yes');
  });

  test('captures a screenshot for human review', async ({ page }, testInfo) => {
    await openPlayer(page);

    // Not a baseline comparison — see playwright.config.ts. This is evidence
    // for Gate 0 and for eyeballing a theming change. Written to a path as well
    // as attached, because the list reporter does not persist attachments and
    // the whole point is that a person can open the file.
    const screenshot = await page.screenshot({
      fullPage: false,
      path: `test-results/screenshots/dashboard-${testInfo.project.name}.png`,
    });
    await testInfo.attach(`dashboard-${testInfo.project.name}.png`, {
      body: screenshot,
      contentType: 'image/png',
    });

    expect(screenshot.byteLength).toBeGreaterThan(1000);
  });
});

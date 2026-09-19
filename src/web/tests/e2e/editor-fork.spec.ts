import { expect, test, type Page, type TestInfo } from '@playwright/test';

const EDITOR = 'http://127.0.0.1:4174/';

test.describe('Fabric editor route', () => {
  test('mounts the adopted editor shell on the editor stage', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);

    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();
    await expect(page.locator('#status')).toHaveText('Fabric editor ready');
  });

  test('creates and saves text with derived v2 references', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('#properties section').first().getByRole('button', { name: 'Text' }).click();

    const envelope = await saveEnvelope(page) as {
      scene: { objects: Array<{ vigiliaPaint?: { fill?: string }; vigiliaText?: { runs: Array<{ text?: string; typePreset?: string; style?: { color?: { ref?: string } } }> } }> };
    };
    const text = envelope.scene.objects.find((object) => object.vigiliaText?.runs[0]?.text === 'New text');
    expect(text).toMatchObject({
      vigiliaPaint: { fill: 'palette.background' },
      vigiliaText: { runs: [{ typePreset: 'typePresets.11-400', style: { color: { ref: 'palette.background' } } }] },
    });
  });

  test('captures the mounted editor for visual review', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();

    await captureVisualReview(page, testInfo, 'editor-fork');
  });

  test('captures selected chart binding controls for visual review', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page.locator('[data-vigilia-binding="cpu-load"]').selectOption('ram.used');
    const precision = page.locator('[data-vigilia-binding-field="cpu-load.precision"]');
    await precision.fill('2');
    await precision.press('Tab');
    await expect(precision).toHaveValue('2');
    const progressPaint = page.locator('[data-vigilia-chart-paint="progress"]');
    await progressPaint.scrollIntoViewIfNeeded();
    await expect(progressPaint).toBeVisible();

    await captureVisualReview(page, testInfo, 'editor-fork-chart-binding');
  });

  test('captures changed artboard controls for visual review', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('[data-vigilia-artboard-fit-mode]').selectOption('cover');
    await page.locator('[data-vigilia-artboard-width]').fill('1000');
    await page.locator('[data-vigilia-artboard-width]').press('Tab');
    await page.locator('[data-vigilia-artboard-background]').selectOption('palette.bars');
    await expect(page.locator('[data-vigilia-artboard-fit-mode]')).toHaveValue('cover');
    await expect(page.locator('[data-vigilia-artboard-background]')).toHaveValue('palette.bars');

    await captureVisualReview(page, testInfo, 'editor-fork-artboard');
  });

  test('rejects literal artboard paint in a v2 document', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'literal-bars.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        schemaVersion: 2,
        fabricVersion: '7.4.0',
        id: 'literal-bars',
        artboard: {
          width: 1000,
          height: 720,
          background: { value: '#101216' },
          barColor: { value: '#e20074' },
        },
        scene: { version: '7.4.0', objects: [] },
      })),
    });
    await expect(page.locator('#status')).toContainText('Could not open');
    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();
  });

  test('renders palette gradients on the native Fabric artboard', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'gradient-artboard.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        schemaVersion: 2,
        fabricVersion: '7.4.0',
        id: 'gradient-artboard',
        artboard: {
          width: 1000,
          height: 720,
          background: { ref: 'palette.background' },
          barColor: { ref: 'palette.bars' },
        },
        globals: {
          palette: {
            none: { name: 'None', value: { kind: 'solid', color: 'transparent' } },
            background: { name: 'Background', value: { kind: 'gradient', angle: 0, stops: [{ offset: 0, color: '#102030' }, { offset: 1, color: '#d0e0f0' }] } },
            bars: { name: 'Bars', value: { kind: 'gradient', angle: 90, stops: [{ offset: 0, color: '#001122' }, { offset: 1, color: '#334455' }] } },
          },
        },
        scene: { version: '7.4.0', objects: [] },
      })),
    });
    await expect(page.locator('#status')).toHaveText('Opened gradient-artboard.json');
    await expect(page.locator('#vigilia-fabric-editor canvas.upper-canvas')).toBeVisible();

    await captureVisualReview(page, testInfo, 'editor-fork-artboard-gradient');
  });

  test('edits an artboard palette token through the fork property surface', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('[data-vigilia-palette-token]').selectOption('background');
    const color = page.locator('[data-vigilia-palette-color]');
    await color.fill('rgb(16 32 48)');
    await color.press('Tab');
    await expect(color).toHaveValue('rgb(16 32 48)');

    const envelope = await saveEnvelope(page) as { globals: { palette: { background: { value: unknown } } } };
    expect(envelope.globals.palette.background.value).toEqual({ kind: 'solid', color: 'rgb(16 32 48)' });

    await captureVisualReview(page, testInfo, 'editor-fork-palette-solid');
  });

  test('reassigns palette references before deleting a token', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('[data-vigilia-palette-token]').selectOption('background');
    await page.locator('[data-vigilia-palette-replacement]').selectOption('bars');
    await captureVisualReview(page, testInfo, 'editor-fork-palette-reassignment');
    await page.locator('[data-vigilia-palette-delete]').click();
    await expect(page.locator('[data-vigilia-palette-token] option[value="background"]')).toHaveCount(0);

    const envelope = await saveEnvelope(page) as {
      artboard: { background?: { ref: string } };
      globals: { palette: Record<string, unknown> };
    };
    expect(envelope.artboard.background).toEqual({ ref: 'palette.bars' });
    expect(envelope.globals.palette.background).toBeUndefined();
  });

  test('reassigns chart paint before deleting its palette token', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('[data-vigilia-palette-token]').selectOption('chartTrack');
    await page.locator('[data-vigilia-palette-replacement]').selectOption('bars');
    await page.locator('[data-vigilia-palette-delete]').click();

    const envelope = await saveEnvelope(page) as {
      globals: { palette: Record<string, unknown> };
      scene: { objects: Array<{ id?: string; settings?: { track?: { ref?: string } } }> };
    };
    expect(envelope.globals.palette.chartTrack).toBeUndefined();
    expect(envelope.scene.objects.find((object) => object.id === 'load-gauge')?.settings?.track).toEqual({ ref: 'palette.bars' });
  });

  test('edits a global type preset through the fork property surface', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('[data-vigilia-type-preset]').selectOption('32-500');
    const size = page.locator('[data-vigilia-type-size]');
    await size.fill('34');
    await size.press('Tab');
    await expect(size).toHaveValue('34');

    const envelope = await saveEnvelope(page) as { globals: { typePresets: { '32-500': { value: { size: number } } } } };
    expect(envelope.globals.typePresets['32-500'].value.size).toBe(34);
    await captureVisualReview(page, testInfo, 'editor-fork-type-preset');
  });

  test('reassigns text type presets before deleting one', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('[data-vigilia-type-preset]').selectOption('11-400');
    await page.locator('[data-vigilia-type-replacement]').selectOption('11-500');
    await page.locator('[data-vigilia-type-delete]').scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, 'editor-fork-type-reassignment');
    await page.locator('[data-vigilia-type-delete]').click();
    await expect(page.locator('[data-vigilia-type-preset] option[value="11-400"]')).toHaveCount(0);

    const envelope = await saveEnvelope(page) as {
      globals: { typePresets: Record<string, unknown> };
      scene: { objects: Array<{ id?: string; vigiliaText?: { runs: Array<{ typePreset?: string }> } }> };
    };
    expect(envelope.globals.typePresets['11-400']).toBeUndefined();
    expect(envelope.scene.objects.find((object) => object.id === 'trend-legend')?.vigiliaText?.runs[0]?.typePreset).toBe('typePresets.11-500');
  });

  test('captures dirty document replacement confirmation for visual review', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.evaluate(() => {
      const editor = Object.entries(window as unknown as Record<string, unknown>)
        .find(([key]) => key.startsWith('vigilia-fabric-editor-'))?.[1] as { canvas: { item(index: number): { set(key: string, value: number): void } | undefined; requestRenderAll(): void } } | undefined;
      editor?.canvas.item(1)?.set('left', 64);
      editor?.canvas.requestRenderAll();
    });
    await page.keyboard.press('Control+n');
    await expect(page.locator('dialog')).toBeVisible();

    await captureVisualReview(page, testInfo, 'editor-fork-dirty-replacement');
  });

  test('selects a chart in the starter theme through the visible Fabric canvas', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await expect(page.locator('[data-vigilia-chart-setting="thickness"]')).toBeVisible();
  });

  test('persists artboard properties without rescaling Fabric objects', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('[data-vigilia-artboard-fit-mode]').selectOption('cover');
    await page.locator('[data-vigilia-artboard-width]').fill('1000');
    await page.locator('[data-vigilia-artboard-width]').press('Tab');
    await page.locator('[data-vigilia-artboard-background]').selectOption('palette.bars');

    const envelope = await saveEnvelope(page) as { artboard: { fitMode?: string; width: number; background?: { ref: string } }; scene: { objects: Array<{ id?: string; left?: number }> } };
    expect(envelope.artboard.fitMode).toBe('cover');
    expect(envelope.artboard.width).toBe(1000);
    expect(envelope.artboard.background).toEqual({ ref: 'palette.bars' });
    expect(leftFor(envelope, 'wordmark')).toBe(54);
  });

  test('persists a selected chart binding', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page.locator('[data-vigilia-binding="cpu-load"]').selectOption('ram.used');
    const precision = page.locator('[data-vigilia-binding-field="cpu-load.precision"]');
    await precision.fill('2');
    await precision.press('Tab');

    const envelope = await saveEnvelope(page) as { bindings: Record<string, Array<{ id: string; semanticKey: string }>> };
    expect(envelope.bindings['load-gauge']).toContainEqual({ id: 'cpu-load', semanticKey: 'ram.used', precision: 2 });
  });

  test('persists selected chart paint as a palette reference', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page.locator('[data-vigilia-chart-paint="progress"]').selectOption('palette.chartTrack');

    const envelope = await saveEnvelope(page) as {
      scene: { objects: Array<{ id?: string; settings?: { progress?: { ref?: string } } }> };
    };
    expect(envelope.scene.objects.find((object) => object.id === 'load-gauge')?.settings?.progress).toEqual({ ref: 'palette.chartTrack' });
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

  test('persists an ordinary fork drag and restores it through undo', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');

    await page.goto(EDITOR);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'movable.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        schemaVersion: 2,
        fabricVersion: '7.4.0',
        id: 'movable',
        artboard: { width: 320, height: 180 },
        globals: { palette: { none: { name: 'None', value: { kind: 'solid', color: 'transparent' } }, accent: { name: 'Accent', value: { kind: 'solid', color: '#00b8d9' } } } },
        scene: {
          version: '7.4.0',
          objects: [{ type: 'Rect', id: 'panel', left: 40, top: 50, width: 60, height: 40, fill: '#00b8d9', vigiliaPaint: { fill: 'palette.accent' }, originX: 'left', originY: 'top' }],
        },
      })),
    });
    await expect(page.locator('#status')).toHaveText('Opened movable.json');

    const canvas = page.locator('#vigilia-fabric-editor canvas.upper-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    const point = (x: number, y: number) => ({ x: box.x + (x / 320) * box.width, y: box.y + (y / 180) * box.height });
    const start = point(70, 70);
    const end = point(150, 70);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();

    const savedAfterDrag = await saveEnvelope(page);
    expect(leftFor(savedAfterDrag, 'panel')).toBeGreaterThan(100);

    await page.keyboard.press('Control+z');
    const savedAfterUndo = await saveEnvelope(page);
    expect(leftFor(savedAfterUndo, 'panel')).toBeCloseTo(40, 3);
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

async function saveEnvelope(page: Page): Promise<unknown> {
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function selectStarterChart(page: Page): Promise<void> {
  const box = await page.locator('#vigilia-fabric-editor canvas.upper-canvas').boundingBox();
  expect(box).not.toBeNull();
  if (box === null) throw new Error('The editor canvas has no visible bounds.');
  await page.mouse.click(box.x + (432 / 1280) * box.width, box.y + (418 / 720) * box.height);
  await expect(page.locator('[data-vigilia-chart-setting="thickness"]')).toBeVisible();
}

async function captureVisualReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const directory = process.env['VIGILIA_CAPTURE'] === undefined
    ? 'test-results/screenshots'
    : '../../.agents/screenshots';
  const filename = `${name}-${testInfo.project.name}.png`;
  const screenshot = await page.screenshot({ path: `${directory}/${filename}` });

  await testInfo.attach(filename, { body: screenshot, contentType: 'image/png' });
  expect(screenshot.byteLength).toBeGreaterThan(1000);
}

function leftFor(envelope: unknown, id: string): number {
  const objects = (envelope as { scene: { objects: Array<{ id?: string; left?: number }> } }).scene.objects;
  const left = objects.find((object) => object.id === id)?.left;
  expect(left).toEqual(expect.any(Number));
  return left!;
}

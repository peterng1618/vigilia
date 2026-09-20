import { expect, test, type Page } from '@playwright/test';
import { openPaused } from './clock.js';
import {
  canvasChildOf,
  canvasHas,
  canvasProp,
  canvasText,
  drawnFractionIn,
  drawnFractionOf,
  hasRunStyles,
  keepsObjectIdentity,
  openCanvasPlayer,
  probe,
  sourceColorFraction,
} from './canvas-probe.js';

const FIXTURES = [
  { name: 'demo', charts: true },
  { name: 'stress', charts: true },
  { name: 'portrait-cover', charts: true },
  { name: 'assets', charts: false },
] as const;

/**
 * The Fabric scene graph, in a real browser.
 *
 * ## Why these assertions and not DOM assertions
 *
 * The retired DOM suite asked questions about elements, spans and computed
 * style. A canvas has none of that, so the equivalent questions are:
 * did an object get built for each node, did the transform reach the canvas,
 * and **did ink actually land**. The last one is the reason this file exists at
 * all — `adapter.dom.test.ts` already asserts the arithmetic under jsdom, and
 * everything it cannot see is exactly what needs a real browser: fonts, GPU
 * rasterisation, `devicePixelRatio`, and whether ECharts draws through a Fabric
 * object when nothing is a mock.
 *
 * Structural rather than pixel baselines, for `playwright.config.ts`'s reason:
 * CI is Linux, development is Windows, glyphs differ. "Some ink, in this box"
 * survives that; a PNG does not.
 */

/**
 * The grid measure, installed into the page.
 *
 * Shared by the two profile helpers, which both run in the browser — so it is
 * declared once here and injected, rather than written out inside each
 * `evaluate` where the two copies could drift apart and quietly compare
 * different things.
 */
const GRID_PROFILE = `
window.gridProfile = (data, width, height) => {
  const counts = new Map();
  const key = (i) => ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]);

  for (let i = 0; i < data.length; i += 4) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1);

  let background = 0;
  let commonest = 0;

  for (const [k, c] of counts) if (c > commonest) { commonest = c; background = k; }

  const cells = new Array(16).fill(0);
  const areas = new Array(16).fill(0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = Math.min(3, Math.floor((y / height) * 4)) * 4 + Math.min(3, Math.floor((x / width) * 4));

      areas[cell] += 1;

      if (key((y * width + x) * 4) !== background) cells[cell] += 1;
    }
  }

  return cells.map((drawn, i) => (areas[i] === 0 ? 0 : drawn / areas[i]));
};
`;

/** The injected measure, as the page exposes it. */
type ProfileWindow = typeof window & {
  gridProfile: (data: Uint8ClampedArray, width: number, height: number) => number[];
};

/**
 * A coarse spatial profile of what is drawn in a region: the drawn fraction of
 * each cell of a 4x4 grid over it.
 *
 * Coverage alone cannot tell a *correct* drawing from a *mangled* one — an SVG
 * drawn through the wrong `drawImage` form scored 0.2344 against the correct
 * 0.2126, which no threshold separates. Where the ink sits does separate them,
 * and 16 numbers is enough to say so without becoming a pixel baseline: it is
 * computed fresh on both sides in the same browser, so nothing is committed and
 * platform rasterisation differences cancel.
 */
async function profileIn(
  page: Page,
  region: { x: number; y: number; width: number; height: number },
): Promise<readonly number[]> {
  return page.evaluate((box) => {
    const element = document.querySelector<HTMLCanvasElement>('canvas[data-vigilia="artboard"]');
    const context = element?.getContext('2d');

    if (element === null || context === null || context === undefined) {
      return [];
    }

    const ratio = element.width / element.getBoundingClientRect().width;
    const width = Math.max(4, Math.round(box.width * ratio));
    const height = Math.max(4, Math.round(box.height * ratio));
    const data = context.getImageData(
      Math.round(box.x * ratio),
      Math.round(box.y * ratio),
      width,
      height,
    ).data;

    return (window as ProfileWindow).gridProfile(data, width, height);
  }, region);
}

/**
 * The same profile for an asset drawn straight into a scratch canvas.
 *
 * The reference side: the artwork as the browser itself renders it, at the size
 * the node asks for, using the `drawImage` form that works for a vector source.
 * If the scene's version does not look like this, something in the renderer is
 * mangling it.
 */
async function profileOfAsset(
  page: Page,
  src: string,
  size: { width: number; height: number },
): Promise<readonly number[]> {
  return page.evaluate(
    ({ url, box }) =>
      new Promise<readonly number[]>((resolve) => {
        const image = document.createElement('img');

        image.addEventListener('load', () => {
          const canvas = document.createElement('canvas');

          canvas.width = Math.max(4, Math.round(box.width));
          canvas.height = Math.max(4, Math.round(box.height));

          const context = canvas.getContext('2d');

          if (context === null) {
            resolve([]);

            return;
          }

          // Five arguments, no source rect: the form Chrome honours for an SVG
          // with no intrinsic size.
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(
            (window as ProfileWindow).gridProfile(
              context.getImageData(0, 0, canvas.width, canvas.height).data,
              canvas.width,
              canvas.height,
            ),
          );
        });

        image.addEventListener('error', () => resolve([]));
        image.src = url;
      }),
    { url: src, box: size },
  );
}

test.describe('the scene reaches the canvas', () => {
  test('builds one object per top-level node', async ({ page }) => {
    await openCanvasPlayer(page);

    const scene = await probe(page);

    // The demo fixture's top level: whatever it is, every object must have an
    // id, because that is what a plan node is matched by — and from stage 3,
    // what a binding resolves against.
    expect(scene.objectCount).toBeGreaterThan(0);
    expect(scene.ids).not.toContain('undefined');
    expect(new Set(scene.ids).size).toBe(scene.ids.length);

    for (const id of [
      'title',
      'cpu-panel',
      'cpu-panel-bg',
      'cpu-gauge',
      'cpu-readout',
      'gpu-gauge',
      'history-chart',
      'thermals-bars',
      'memory-donut',
      'memory-unmapped',
    ]) {
      expect(scene.allIds, `node ${id} is missing`).toContain(id);
    }
  });

  test('keeps group children inside their authored group (§57)', async ({ page }) => {
    await openCanvasPlayer(page);

    expect(await canvasChildOf(page, 'cpu-gauge', 'cpu-panel')).toBe(true);
  });

  test('shows measured text, styled runs and missing-data placeholders', async ({ page }) => {
    await openCanvasPlayer(page);

    expect(await canvasText(page, 'cpu-readout')).toMatch(/^\d+%$/);
    expect(await hasRunStyles(page, 'cpu-readout')).toBe(true);
    expect(await canvasText(page, 'memory-unmapped')).toContain('—');
    await expect(page.getByText(/SYNTHETIC DATA/)).toBeVisible();
  });

  test('paints something, which is the whole point', async ({ page }) => {
    await openCanvasPlayer(page);

    const size = page.viewportSize() ?? { width: 1280, height: 720 };
    const drawn = await drawnFractionIn(page, { x: 0, y: 0, width: size.width, height: size.height });

    // A canvas that mounted, sized and transformed correctly and drew nothing
    // would pass every other assertion in this file. The fraction is of the
    // whole viewport, so a dashboard of panels and charts is well over 10%.
    expect(drawn).toBeGreaterThan(0.1);
  });

  test('carries the artboard transform in the canvas, not in CSS', async ({ page }) => {
    await openCanvasPlayer(page);

    const scene = await probe(page);
    const [scaleX, skewY, skewX, scaleY] = scene.viewportTransform;

    // §51: one *uniform* scale, and no skew. A split scale would distort
    // strokes, glyphs and shadows, which is the thing that rule exists for.
    expect(scaleX).toBe(scaleY);
    expect(skewX).toBe(0);
    expect(skewY).toBe(0);
    expect(scaleX).toBeGreaterThan(0);

    // And the canvas itself is viewport-sized rather than artboard-sized: the
    // scale is in the matrix, so the element must not also be scaled.
    const size = page.viewportSize() ?? { width: 1280, height: 720 };

    expect(scene.canvasSize.width).toBe(size.width);
    expect(scene.canvasSize.height).toBe(size.height);
  });

  test('letterboxes a 16:9 design on a taller phone (§53)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-chromium', 'The bars only exist on a phone.');

    await openCanvasPlayer(page);

    const scene = await probe(page);
    const size = page.viewportSize() ?? { width: 412, height: 915 };
    const [scale, , , , offsetX, offsetY] = scene.viewportTransform;

    // Contain fits the whole design, so the leftover space is the bars — and at
    // least one offset has to be positive for them to exist at all.
    expect(scale).toBeLessThan(1);
    expect(Math.max(offsetX ?? 0, offsetY ?? 0)).toBeGreaterThan(0);

    // The bars themselves: no ink above the design's top edge.
    if ((offsetY ?? 0) > 4) {
      expect(
        await drawnFractionIn(page, {
          x: 0,
          y: 0,
          width: size.width,
          height: (offsetY ?? 0) - 2,
        }),
      ).toBe(0);
    }
  });

  test('refits after the viewport changes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'resizes the desktop viewport');

    await openCanvasPlayer(page);
    await page.setViewportSize({ width: 900, height: 900 });

    await expect
      .poll(async () => (await probe(page)).viewportTransform[0])
      .toBeCloseTo(900 / 1280, 5);

    const scene = await probe(page);
    expect(scene.canvasSize).toEqual({ width: 900, height: 900 });
  });

  test('cover mode fills and crops the viewport (§53)', async ({ page }) => {
    await openCanvasPlayer(page, '/?theme=portrait-cover');

    const scene = await probe(page);
    const viewport = page.viewportSize()!;
    const [scale = 0, , , , offsetX = 0, offsetY = 0] = scene.viewportTransform;

    expect(440 * scale).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(956 * scale).toBeGreaterThanOrEqual(viewport.height - 1);
    expect(Math.min(offsetX, offsetY)).toBeLessThanOrEqual(0);
  });
});

test.describe('charts draw through a Fabric object', () => {
  test('every family in the stress fixture puts ink on the canvas', async ({ page }) => {
    // The claim this whole migration rests on, asserted on the shipped path
    // rather than on the prototype: ECharts draws into a detached canvas and
    // `VigiliaChart._render` blits it. If the invalidation hook were missing,
    // the first frame might still appear and later ones would not — which is
    // what the next test is for.
    await openCanvasPlayer(page, '/?theme=stress');

    const scene = await probe(page);

    expect(scene.objectCount).toBeGreaterThan(0);

    const size = page.viewportSize() ?? { width: 1280, height: 720 };

    expect(
      await drawnFractionIn(page, { x: 0, y: 0, width: size.width, height: size.height }),
    ).toBeGreaterThan(0.1);

    for (const id of ['half-gauge', 'step-line', 'many-bars', 'sum-pie']) {
      expect(await drawnFractionOf(page, id), `${id} drew nothing`).toBeGreaterThan(0.01);
    }
  });

  test('keeps repainting as samples arrive', async ({ page }) => {
    // What this catches, verified by sabotage: the update loop not reaching the
    // canvas. Cutting `handle.update(plan())` fails it.
    //
    // What it does **not** catch, also verified: removing the chart object's
    // `zr.on('rendered')` invalidation hook. Two things mask it on this path —
    // the adapter calls `requestRenderAll` at the end of every `apply`, and the
    // engine's own animation is off, so the only engine repaint happens
    // synchronously inside `setOption` during that same apply. The hook is
    // still load-bearing for a *grouped* chart whose siblings do not change,
    // and `chart-object.dom.test.ts` is where that is asserted. A still frame
    // cannot tell any of this apart, which is why this compares two.
    await openCanvasPlayer(page);

    const before = await page.evaluate(() => {
      const element = document.querySelector<HTMLCanvasElement>('canvas[data-vigilia="artboard"]');

      return element?.toDataURL() ?? '';
    });

    // Several data ticks — the player rebuilds the plan once a second.
    await page.clock.runFor(4000);

    const after = await page.evaluate(() => {
      const element = document.querySelector<HTMLCanvasElement>('canvas[data-vigilia="artboard"]');

      return element?.toDataURL() ?? '';
    });

    expect(before).not.toBe('');
    expect(after).not.toBe(before);
  });

  test('updates live objects without recreating them', async ({ page }) => {
    await openCanvasPlayer(page);

    expect(await keepsObjectIdentity(page, 'cpu-gauge', 3000)).toBe(true);
    expect(await keepsObjectIdentity(page, 'cpu-readout', 1000)).toBe(true);
  });
});

test.describe('device pixels reach the charts', () => {
  test('sizes each chart’s detached canvas from the device and the artboard scale', async ({
    page,
  }) => {
    // Fabric's `enableRetinaScaling` sizes its *own* backing store. A chart
    // draws into a detached canvas Fabric knows nothing about, so its
    // resolution has to be set deliberately — and a chart rasterised at 1x on a
    // 2.6x phone is the bitmap label §91 forbids.
    await openCanvasPlayer(page);

    const scene = await probe(page);
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const scale = scene.viewportTransform[0] ?? 0;

    expect(scene.chartRenderScales.length).toBeGreaterThan(0);
    expect(scene.retinaScaling).toBe(dpr);

    // The factor the adapter asked for, subject to each chart's own area cap —
    // which is why this is a ceiling rather than an equality: a large chart is
    // clamped on backing pixels, deliberately.
    for (const chartScale of scene.chartRenderScales) {
      expect(chartScale).toBeGreaterThan(0);
      expect(chartScale).toBeLessThanOrEqual(scale * dpr + 0.001);
    }
  });
});

/**
 * How far apart two profiles are: the mean absolute difference per cell.
 *
 * Measured 2026-09-15 across both projects, one 24x24 vector icon against the
 * browser's own rendering of it at the same pixel size:
 *
 * | | distance |
 * |---|---|
 * | correct | 0.0187 and 0.0285 |
 * | with the vector raster removed | 0.2504 and 0.2780 |
 *
 * Roughly ten times apart, so the threshold is not finely balanced.
 */
function profileDistance(drawn: readonly number[], reference: readonly number[]): number {
  if (drawn.length !== reference.length || drawn.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const total = drawn.reduce(
    (sum, value, index) => sum + Math.abs(value - (reference[index] ?? 0)),
    0,
  );

  return total / drawn.length;
}

/** Twice the worst correct render measured, and a quarter of the mangled one. */
const PROFILE_TOLERANCE = 0.06;

test.describe('image assets', () => {
  test('draws each fit mode, and every icon, in its own box', async ({ page }) => {
    // The test the whole-frame count could not be: every SVG icon in this
    // fixture was **absent** while that one passed. Chrome draws nothing for an
    // SVG with no intrinsic size through `drawImage`'s source-rect form, which
    // is the only form Fabric uses — and the symptom was device-dependent,
    // mangled fragments at 1x and nothing at 4x. `fabric-image.ts` rasterises a
    // vector asset first; this is what says so.
    await openCanvasPlayer(page, '/?theme=assets');

    // Three rings, one PNG, at the three fit modes; then the icon row.
    for (const nodeId of [
      'fit-contain',
      'fit-cover',
      'fit-stretch',
      'svg-original',
      'svg-mono',
      'png-mono',
    ]) {
      const drawn = await drawnFractionOf(page, nodeId);

      // A lower bound per node rather than a baseline: a ring covers about a
      // third of its box and a thermometer glyph rather less, and both are
      // nowhere near zero. Absent scores exactly 0.
      expect(drawn, `"${nodeId}" drew nothing inside its own box`).toBeGreaterThan(0.05);
    }
  });

  test('applies contain, cover and stretch geometry', async ({ page }) => {
    await openCanvasPlayer(page, '/?theme=assets');

    const containX = await canvasProp(page, 'fit-contain', 'scaleX');
    const containY = await canvasProp(page, 'fit-contain', 'scaleY');
    const coverX = await canvasProp(page, 'fit-cover', 'scaleX');
    const coverY = await canvasProp(page, 'fit-cover', 'scaleY');
    const stretchX = await canvasProp(page, 'fit-stretch', 'scaleX');
    const stretchY = await canvasProp(page, 'fit-stretch', 'scaleY');

    expect(containX).toBeCloseTo(containY as number, 5);
    expect(coverX).toBeCloseTo(coverY as number, 5);
    expect(coverX as number).toBeGreaterThan(containX as number);
    expect(stretchX).not.toBeCloseTo(stretchY as number, 5);
    expect(await canvasHas(page, 'fit-cover', 'clipPath')).toBe(true);
  });

  test('recolours bitmap and SVG artwork from source alpha (§132)', async ({ page }) => {
    await openCanvasPlayer(page, '/?theme=assets');

    expect(await sourceColorFraction(page, 'svg-mono', [255, 171, 0])).toBeGreaterThan(0.8);
    expect(await sourceColorFraction(page, 'png-mono', [54, 179, 126])).toBeGreaterThan(0.8);
  });

  test('draws a vector icon the shape the asset actually is', async ({ page }) => {
    // Coverage is not enough here, and that is measured: with the vector
    // raster removed, the same icon drew a *mangled* fragment scoring 0.2344
    // against the correct 0.2126. What separates them is where the ink sits, so
    // this compares the scene's 4x4 profile against the browser's own rendering
    // of the same asset at the same size.
    //
    // Chrome draws nothing for an SVG with no intrinsic size through
    // `drawImage`'s source-rect form, which is the only form Fabric uses. The
    // symptom was device-dependent — fragments at 1x, nothing at 4x — so this
    // is the assertion that holds at every ratio.
    await page.addInitScript(GRID_PROFILE);
    await openCanvasPlayer(page, '/?theme=assets');

    const region = await page.evaluate(() => {
      const { handle } = (window as unknown as { vigilia: { handle: Record<string, unknown> } })
        .vigilia;
      const adapter = handle['adapter'] as {
        objectFor(nodeId: string):
          | { getBoundingRect(): { left: number; top: number; width: number; height: number } }
          | undefined;
      };
      const object = adapter.objectFor('svg-original');

      if (object === undefined) {
        return undefined;
      }

      const canvas = handle['canvas'] as { viewportTransform: number[] };
      const rect = object.getBoundingRect();
      const [scale = 1, , , , offsetX = 0, offsetY = 0] = canvas.viewportTransform;

      return {
        x: rect.left * scale + offsetX,
        y: rect.top * scale + offsetY,
        width: rect.width * scale,
        height: rect.height * scale,
      };
    });

    expect(region, 'the icon has no object at all').toBeDefined();

    const drawn = await profileIn(page, region!);
    const ratio = await page.evaluate(() => window.devicePixelRatio);
    // The reference is rasterised at the *same* pixel size the scene drew at,
    // so the two antialias comparably. Drawn at a different size it differs by
    // up to 0.089 in a single edge-heavy cell even when perfectly correct,
    // which is most of the budget a mangled draw needs to be caught in.
    const reference = await profileOfAsset(page, '/assets/thermometer.svg', {
      width: region!.width * ratio,
      height: region!.height * ratio,
    });

    expect(drawn).toHaveLength(16);
    expect(reference).toHaveLength(16);

    // The whole profile at once, as a mean absolute difference, rather than a
    // per-cell tolerance: one edge cell can legitimately differ by a lot, and
    // what says "wrong shape" is the ink having *moved*. Measured below.
    expect(profileDistance(drawn, reference)).toBeLessThan(PROFILE_TOLERANCE);
  });

  test('draws nothing at all for an asset the server does not have', async ({ page }) => {
    // §111: a declared-but-absent file must not become a broken-image glyph,
    // which reads as a rendering failure rather than a missing file. The node
    // has no object at all, so the helper reports -1.
    await openCanvasPlayer(page, '/?theme=assets');

    expect(await drawnFractionOf(page, 'absent-image')).toBeLessThanOrEqual(0);
  });
});

test.describe('what it cannot draw, it says', () => {
  test('warns about tabular numerals rather than silently approximating them (§85)', async ({
    page,
  }) => {
    const warnings: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });

    await openCanvasPlayer(page);

    expect(warnings.some((text) => text.includes('tabularNumerals'))).toBe(true);
  });
});

test.describe('every fixture renders', () => {
  for (const fixture of FIXTURES) {
    test(`${fixture.name}: mounts, paints and reports no page error`, async ({ page }) => {
      const errors: string[] = [];

      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().includes('not-shipped.png')) {
          errors.push(message.text());
        }
      });

      await openCanvasPlayer(page, `/?theme=${fixture.name}`);

      const scene = await probe(page);
      const size = page.viewportSize()!;

      expect(scene.objectCount).toBeGreaterThan(0);
      expect(await drawnFractionIn(page, { x: 0, y: 0, ...size }), fixture.name).toBeGreaterThan(0.01);
      expect(scene.chartRenderScales.length > 0).toBe(fixture.charts);
      expect(errors).toEqual([]);
    });
  }

  test('unknown hosted themes show a clear load failure', async ({ page }) => {
    await page.goto('/?theme=does-not-exist');

    await expect(page.locator('#artboard')).toHaveText(/Vigilia could not load this theme/);
  });

  test('keeps invisible nodes in the scene without painting them', async ({ page }) => {
    await openCanvasPlayer(page, '/?theme=stress');

    expect(await canvasProp(page, 'hidden-node', 'visible')).toBe(false);
  });

  for (const fixture of FIXTURES) {
    test(`captures ${fixture.name} for visual review`, async ({ page }, testInfo) => {
      const directory =
        process.env['VIGILIA_CAPTURE'] === undefined
          ? 'test-results/screenshots'
          : '../../.agents/screenshots';

      await openCanvasPlayer(page, `/?theme=${fixture.name}`);
      const size = page.viewportSize()!;
      expect(await drawnFractionIn(page, { x: 0, y: 0, ...size })).toBeGreaterThan(0.01);
      const name = `${fixture.name}-${testInfo.project.name}.png`;
      const screenshot = await page.screenshot({
        fullPage: false,
        path: `${directory}/${name}`,
      });

      await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
      expect(screenshot.byteLength).toBeGreaterThan(1000);
    });
  }

  test('is byte-stable at a fixed clock on one platform', async ({ browser }) => {
    const capture = async (): Promise<Buffer> => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await openPaused(page, '/?theme=demo&static=1', 'canvas[data-vigilia="artboard"]');
      await page.clock.runFor(1500);
      await page.evaluate(() => document.fonts.ready);
      const shot = await page.locator('canvas[data-vigilia="artboard"]').screenshot();
      await page.close();
      return shot;
    };

    await capture();
    expect(Buffer.compare(await capture(), await capture())).toBe(0);
  });
});

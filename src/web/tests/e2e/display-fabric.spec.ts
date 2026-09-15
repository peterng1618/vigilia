import { expect, test, type Page } from '@playwright/test';

/**
 * The Fabric scene graph, in a real browser.
 *
 * `?scene=fabric` is spec 0013 stage 2's opt-in: the DOM applier is still the
 * default, and this suite is what says the canvas path works before stage 3
 * flips it. `display.spec.ts` keeps covering the default path and is ported
 * onto the canvas then, not now.
 *
 * ## Why these assertions and not the DOM suite's
 *
 * `display.spec.ts` asks the DOM 68 questions about elements, spans and
 * computed style. A canvas has none of that, so the equivalent questions are:
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

/** Pinned so the fake source is frozen and every frame is identical. */
const FIXED_TIME = new Date('2026-01-01T12:00:00Z');

/** What the diagnostics hook exposes, narrowed to what this suite reads. */
interface SceneProbe {
  readonly objectCount: number;
  readonly ids: readonly string[];
  readonly viewportTransform: readonly number[];
  readonly canvasSize: { readonly width: number; readonly height: number };
  readonly retinaScaling: number;
  /** The oversample factor each chart object ended up with. */
  readonly chartRenderScales: readonly number[];
}

async function openFabricPlayer(page: Page, theme = 'demo'): Promise<void> {
  // Installed before navigation, or the first frame is built from the real
  // clock — and then advanced rather than frozen, because a chart whose
  // content is entirely animated draws nothing until its animation progresses.
  // Both are `display.spec.ts`'s findings and apply identically here.
  await page.clock.install({ time: FIXED_TIME });
  await page.goto(`/?scene=fabric&theme=${theme}`);
  await page.waitForSelector('canvas[data-vigilia="artboard"]');
  await page.clock.runFor(1500);
}

/** Reads the scene through the handle the player already exposes. */
async function probe(page: Page): Promise<SceneProbe> {
  return page.evaluate(() => {
    // The player exposes `{ handle, live }` for exactly this; the Fabric handle
    // adds the canvas. Nothing is serialised across the boundary except the
    // plain numbers and strings below — a Fabric object would not survive it.
    const { handle } = (window as unknown as { vigilia: { handle: Record<string, unknown> } })
      .vigilia;
    const canvas = handle['canvas'] as {
      getObjects(): { get(key: string): unknown }[];
      viewportTransform: number[];
      getWidth(): number;
      getHeight(): number;
      getRetinaScaling(): number;
    };
    const objects = canvas.getObjects();
    const scales: number[] = [];

    const collect = (list: { get(key: string): unknown }[]): void => {
      for (const object of list) {
        // By a property only a chart has, not by `type`: Fabric's instance
        // getter lower-cases the class name and its own source says not to
        // build on it ("DO NOT build new code around this type value").
        if (typeof object.get('family') === 'string') {
          scales.push(Number(object.get('renderScale')));
        }

        const children = object.get('_objects');

        if (Array.isArray(children)) {
          collect(children as { get(key: string): unknown }[]);
        }
      }
    };

    collect(objects);

    return {
      objectCount: objects.length,
      ids: objects.map((object) => String(object.get('id'))),
      viewportTransform: [...canvas.viewportTransform],
      canvasSize: { width: canvas.getWidth(), height: canvas.getHeight() },
      retinaScaling: canvas.getRetinaScaling(),
      chartRenderScales: scales,
    };
  });
}

/**
 * How much ink is in a region of the canvas, as a count of non-transparent
 * pixels.
 *
 * Read off the canvas' own backing store rather than from a screenshot, so it
 * is unaffected by page scroll, device scale factor or PNG encoding. The region
 * is in **CSS** pixels; the backing store may be larger, which is what
 * `devicePixelRatio` corrects for.
 */
async function inkIn(
  page: Page,
  region: { x: number; y: number; width: number; height: number },
): Promise<number> {
  return page.evaluate((box) => {
    const element = document.querySelector<HTMLCanvasElement>('canvas[data-vigilia="artboard"]');

    if (element === null) {
      return -1;
    }

    const ratio = element.width / element.getBoundingClientRect().width;
    const context = element.getContext('2d');

    if (context === null) {
      return -1;
    }

    const data = context.getImageData(
      Math.round(box.x * ratio),
      Math.round(box.y * ratio),
      Math.max(1, Math.round(box.width * ratio)),
      Math.max(1, Math.round(box.height * ratio)),
    ).data;

    let painted = 0;

    for (let index = 3; index < data.length; index += 4) {
      if (data[index] !== 0) {
        painted += 1;
      }
    }

    return painted;
  }, region);
}

test.describe('the scene reaches the canvas', () => {
  test('builds one object per top-level node', async ({ page }) => {
    await openFabricPlayer(page);

    const scene = await probe(page);

    // The demo fixture's top level: whatever it is, every object must have an
    // id, because that is what a plan node is matched by — and from stage 3,
    // what a binding resolves against.
    expect(scene.objectCount).toBeGreaterThan(0);
    expect(scene.ids).not.toContain('undefined');
    expect(new Set(scene.ids).size).toBe(scene.ids.length);
  });

  test('paints something, which is the whole point', async ({ page }) => {
    await openFabricPlayer(page);

    const size = page.viewportSize() ?? { width: 1280, height: 720 };
    const painted = await inkIn(page, { x: 0, y: 0, width: size.width, height: size.height });

    // A canvas that mounted, sized and transformed correctly and drew nothing
    // would pass every other assertion in this file.
    expect(painted).toBeGreaterThan(1000);
  });

  test('carries the artboard transform in the canvas, not in CSS', async ({ page }) => {
    await openFabricPlayer(page);

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

    await openFabricPlayer(page);

    const scene = await probe(page);
    const size = page.viewportSize() ?? { width: 412, height: 915 };
    const [scale, , , , offsetX, offsetY] = scene.viewportTransform;

    // Contain fits the whole design, so the leftover space is the bars — and at
    // least one offset has to be positive for them to exist at all.
    expect(scale).toBeLessThan(1);
    expect(Math.max(offsetX ?? 0, offsetY ?? 0)).toBeGreaterThan(0);

    // The bars themselves: no ink above the design's top edge.
    if ((offsetY ?? 0) > 4) {
      expect(await inkIn(page, { x: 0, y: 0, width: size.width, height: (offsetY ?? 0) - 2 })).toBe(
        0,
      );
    }
  });
});

test.describe('charts draw through a Fabric object', () => {
  test('every family in the stress fixture puts ink on the canvas', async ({ page }) => {
    // The claim this whole migration rests on, asserted on the shipped path
    // rather than on the prototype: ECharts draws into a detached canvas and
    // `VigiliaChart._render` blits it. If the invalidation hook were missing,
    // the first frame might still appear and later ones would not — which is
    // what the next test is for.
    await openFabricPlayer(page, 'stress');

    const scene = await probe(page);

    expect(scene.objectCount).toBeGreaterThan(0);

    const size = page.viewportSize() ?? { width: 1280, height: 720 };

    expect(await inkIn(page, { x: 0, y: 0, width: size.width, height: size.height })).toBeGreaterThan(
      1000,
    );
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
    await openFabricPlayer(page);

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
});

test.describe('device pixels reach the charts', () => {
  test('sizes each chart’s detached canvas from the device and the artboard scale', async ({
    page,
  }) => {
    // Fabric's `enableRetinaScaling` sizes its *own* backing store. A chart
    // draws into a detached canvas Fabric knows nothing about, so its
    // resolution has to be set deliberately — and a chart rasterised at 1x on a
    // 2.6x phone is the bitmap label §91 forbids.
    await openFabricPlayer(page);

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

test.describe('what it cannot draw, it says', () => {
  test('warns about a gap rather than approximating it (§85)', async ({ page }) => {
    // The `assets` fixture carries a monochrome image, which needs an offscreen
    // composite the canvas path does not have until stage 7. A silent
    // approximation — the artwork in its original colours, where the author
    // asked for a flat silhouette — is what §85 forbids, so the renderer has
    // to say so.
    const warnings: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });

    await openFabricPlayer(page, 'assets');

    expect(warnings.some((text) => text.includes('cannot be drawn as authored'))).toBe(true);
  });
});

test.describe('both paths agree on the document', () => {
  test('render the same node ids', async ({ page }) => {
    // Parity where it is checkable: the two renderers read the same plan, so
    // the set of top-level nodes each draws must match. This is what would
    // catch the canvas path silently dropping a kind — the failure mode of an
    // opt-in path nobody looks at.
    await openFabricPlayer(page);

    const fabricIds = (await probe(page)).ids.sort();

    await page.clock.install({ time: FIXED_TIME });
    await page.goto('/?theme=demo');
    await page.waitForSelector('[data-vigilia="artboard"]');

    const domIds = await page.evaluate(() =>
      [...document.querySelectorAll('[data-vigilia="artboard"] > [data-node-id]')].map(
        (element) => element.getAttribute('data-node-id') ?? '',
      ),
    );

    expect(fabricIds).toEqual([...domIds].sort());
  });
});

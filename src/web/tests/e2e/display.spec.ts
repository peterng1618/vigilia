import { expect, test, type Page } from '@playwright/test';
import { openPaused } from './clock.js';

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

/**
 * Every valid theme fixture, by name.
 *
 * The showcase theme proves the renderer works on the layout it was designed
 * against — the weakest possible evidence. The others are deliberately
 * different shapes: `stress` is hostile but valid, and `portrait-cover` is a
 * tall artboard in cover mode.
 */
const FIXTURES = [
  { name: 'demo', charts: true },
  { name: 'stress', charts: true },
  { name: 'portrait-cover', charts: true },
  // Static artwork only. Declared rather than inferred, so a regression that
  // dropped every chart from a data fixture still fails.
  { name: 'assets', charts: false },
] as const;

/**
 * Opens the player, paused, and then advances it deliberately.
 *
 * Paused rather than merely pinned — see `clock.ts`, which measured that
 * `install` alone lets the clock run at wall speed and explains the three
 * flakes that came of it.
 *
 * Advanced rather than left at zero, for a reason worth recording: a chart
 * whose content is **entirely** animated draws nothing until its animation
 * progresses. A frozen clock leaves the line chart and the donut blank, while
 * the gauge and the bars still show because their tracks are static. That is
 * real player behaviour, not a test artefact — a screenshot taken in the same
 * tick as the mount would catch a dashboard mid-appearance.
 *
 * The readiness selector is a chart canvas rather than the artboard, because
 * ECharts draws on an animation frame and the clock stops firing those the
 * moment it pauses. Waiting for the artboard and *then* pausing would leave
 * this waiting forever for a frame that can no longer arrive.
 */
async function openPlayer(page: Page): Promise<void> {
  await openPaused(page, '/', '[data-node-id="cpu-gauge"] canvas');
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
    await openPaused(page, '/');

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

    // Polled, not read once. `setViewportSize` resolves as soon as the viewport
    // has changed, which is before the page has been told about it — so a
    // single read here caught the artboard at its old 1280 px scale and this
    // test failed against a player that re-fits correctly. The product does
    // re-fit before the next paint (a ResizeObserver, not the resize event);
    // Playwright simply gets to look first.
    await expect
      .poll(async () => {
        const box = await page.locator('[data-vigilia="artboard"]').boundingBox();

        return box === null ? undefined : Math.round(box.width);
      })
      // min(900/1280, 900/720) = 0.703125, so 1280 × 0.703125 = 900.
      .toBe(900);

    const box = await page.locator('[data-vigilia="artboard"]').boundingBox();

    // §57: scaled, not re-laid-out. A reflow would change the aspect ratio.
    expect(box?.height).toBeCloseTo(900 * (720 / 1280), 0);
  });
});

test.describe('update behaviour', () => {
  test('updates values without recreating chart canvases', async ({ page }) => {
    // "Update charts without recreating the scene." A recreated canvas would
    // restart every animation and throw away the engine's state each second.
    await openPaused(page, '/', '[data-node-id="cpu-gauge"] canvas');

    const canvas = page.locator('[data-node-id="cpu-gauge"] canvas').first();
    await canvas.evaluate((el) => {
      (el as HTMLCanvasElement).dataset['marked'] = 'yes';
    });

    await page.clock.runFor(3000);

    // The same element is still there: it was updated, not replaced.
    await expect(canvas).toHaveAttribute('data-marked', 'yes');
  });

  test('captures a screenshot of every fixture for human review', async ({ page }, testInfo) => {
    // Not a baseline comparison — see playwright.config.ts. This is evidence
    // for Gate 0 and for eyeballing a theming change.
    //
    // Ordinary runs write to the ignored test output. `VIGILIA_CAPTURE=1`
    // writes into the TRACKED .agents/screenshots/ instead, so refreshing
    // committed evidence is a deliberate act.
    //
    // Captured with `?static=1` and a frozen clock, which together make the
    // frame a pure function of the clock: no animation means no dependence on
    // how many frames the engine happened to get. The images are therefore
    // byte-reproducible on one platform — see the determinism test below.
    //
    // Capture with `--workers=1`: the two projects otherwise write here
    // concurrently and Windows intermittently fails the open with UNKNOWN.
    const directory =
      process.env['VIGILIA_CAPTURE'] === undefined
        ? 'test-results/screenshots'
        : '../../.agents/screenshots';

    // Warm-up load, discarded. The first render after a cold browser start
    // differs from every render after it — see the determinism test below — so
    // without this the first fixture captured would never reproduce.
    await page.goto('/?theme=demo&static=1');
    await page.locator('[data-node-id="cpu-gauge"] canvas').first().waitFor();

    for (const fixture of FIXTURES) {
      await openPaused(page, `/?theme=${fixture.name}&static=1`);
      await page.clock.runFor(1500);

      const screenshot = await page.screenshot({
        fullPage: false,
        path: `${directory}/${fixture.name}-${testInfo.project.name}.png`,
      });

      await testInfo.attach(`${fixture.name}-${testInfo.project.name}.png`, {
        body: screenshot,
        contentType: 'image/png',
      });

      expect(screenshot.byteLength).toBeGreaterThan(1000);
    }
  });
});

test.describe('typography (§89)', () => {
  test('clamps wrapped, ellipsised text to the lines that fit', async ({ page }) => {
    await openPlayer(page);

    const node = page.locator('[data-node-id="memory-overflow-demo"]');
    const inner = node.locator('[data-vigilia-text="runs"]');

    // The plan computed the clamp from the box height and the resolved type
    // size; this asserts the DOM layer actually applied it.
    await expect(inner).toHaveCSS('-webkit-line-clamp', '2');

    // The text must be cut, not spilling out of the authored box.
    const box = await node.boundingBox();
    const scroll = await inner.evaluate((el) => el.scrollHeight);
    expect(box).not.toBeNull();
    if (box !== null) {
      expect(scroll).toBeGreaterThan(box.height);
    }
  });

  test('keeps overflowing text inside its authored box', async ({ page }) => {
    await openPlayer(page);

    // §57: text must not reflow the scene. An element that grew to fit its
    // content would push nothing — everything is absolutely positioned — but it
    // would overlap its neighbours, which is just as wrong and harder to see.
    const node = page.locator('[data-node-id="memory-overflow-demo"]');
    const rendered = await node.boundingBox();

    expect(rendered).not.toBeNull();
    if (rendered !== null) {
      // 44 authored pixels, and the desktop viewport renders the artboard 1:1.
      expect(rendered.height).toBeLessThanOrEqual(45);
    }
  });

  test('applies alignment from the document, not from the style map', async ({ page }) => {
    await openPlayer(page);

    // The readout is centred both ways via TextContent. If alignment were still
    // read from the style map, two code paths would be writing justifyContent.
    const readout = page.locator('[data-node-id="cpu-readout"]');
    await expect(readout).toHaveCSS('justify-content', 'center');
    await expect(readout).toHaveCSS('align-items', 'center');
  });

  test('detects a missing font family by metrics, not by fonts.check', async ({ page }) => {
    await openPlayer(page);

    // §89 requires missing-font diagnostics, and this is the test that proved
    // the obvious API cannot provide them: FontFaceSet.check reports whether
    // DECLARED faces have loaded, so a family that was never declared has no
    // matching faces and the answer is vacuously true. Chromium returns true
    // for a font nobody has ever installed.
    const viaCheck = await page.evaluate(() =>
      document.fonts.check('16px "Vigilia No Such Font"'),
    );
    expect(viaCheck, 'fonts.check is unsound for this question — see fonts.ts').toBe(true);

    // Metric comparison gives the real answer.
    const probe = await page.evaluate(() => {
      const context = document.createElement('canvas').getContext('2d');
      if (context === null) {
        return null;
      }
      const width = (font: string): number => {
        context.font = `72px ${font}`;
        return context.measureText('mmmmmmmmmmlliWWWW@').width;
      };
      return {
        invented: width('"Vigilia No Such Font", monospace') === width('monospace'),
        real: width('serif, monospace') === width('monospace'),
      };
    });

    expect(probe).not.toBeNull();
    if (probe !== null) {
      // The invented family contributes nothing, so its metrics equal the
      // fallback's. A family that does resolve changes them.
      expect(probe.invented).toBe(true);
      expect(probe.real).toBe(false);
    }
  });

  test('renders each styled run as its own span', async ({ page }) => {
    await openPlayer(page);

    // §91: native text, never a bitmap label. Separate spans are what lets a
    // label, a value and a unit differ inside one element.
    const spans = page.locator('[data-node-id="cpu-label"] span');
    await expect(spans).toHaveCount(4);

    const sizes = await spans.evaluateAll((elements) =>
      elements.map((el) => getComputedStyle(el).fontSize),
    );
    expect(sizes.every((size) => size !== '')).toBe(true);
  });

  test('applies tabular numerals where the theme asks for them', async ({ page }) => {
    await openPlayer(page);

    // A font without tabular figures ignores this, which is the correct
    // degradation — nothing is substituted.
    await expect(page.locator('[data-node-id="cpu-readout"]')).toHaveCSS(
      'font-variant-numeric',
      'tabular-nums',
    );
  });
});

test.describe('outlines, dashes and shadows (§81)', () => {
  test('applies a box shadow to a shape and a text shadow to a run', async ({ page }) => {
    await openPlayer(page);

    // Two different CSS properties for one authored concept. Applying the wrong
    // one produces nothing rather than an error, which is precisely the silent
    // miss a rendered check catches.
    const panel = page.locator('[data-node-id="cpu-panel-bg"]');
    await expect(panel).not.toHaveCSS('box-shadow', 'none');
    await expect(panel).toHaveCSS('box-shadow', /rgba\(0, 0, 0, 0\.4\)/);

    const title = page.locator('[data-node-id="title"] span').first();
    await expect(title).not.toHaveCSS('text-shadow', 'none');
  });

  test('does not put a box shadow on a text run, or a text shadow on a box', async ({ page }) => {
    await openPlayer(page);

    await expect(page.locator('[data-node-id="title"] span').first()).toHaveCSS(
      'box-shadow',
      'none',
    );
    await expect(page.locator('[data-node-id="cpu-panel-bg"]')).toHaveCSS('text-shadow', 'none');
  });

  test('draws a dashed outline without growing the authored box', async ({ page }, testInfo) => {
    await openPlayer(page);

    const outlined = page.locator('[data-node-id="memory-outline-demo"]');
    await expect(outlined).toHaveCSS('border-style', 'dashed');

    // box-sizing is what keeps the authored rectangle the OUTER rectangle. With
    // content-box, a 1 px border would render this 2 px larger and shift
    // everything inside it.
    await expect(outlined).toHaveCSS('box-sizing', 'border-box');

    // The measured check only holds where the artboard renders 1:1. On the
    // phone the whole design is scaled down, so authored pixels are not CSS
    // pixels — which is the artboard transform working, not a failure.
    test.skip(testInfo.project.name !== 'desktop-chromium', 'needs a 1:1 artboard');

    const box = await outlined.boundingBox();
    expect(box).not.toBeNull();
    if (box !== null) {
      expect(box.width).toBeCloseTo(306, 0);
      expect(box.height).toBeCloseTo(60, 0);
    }
  });
});

test.describe('every fixture renders', () => {
  for (const fixture of FIXTURES) {
    test(`${fixture.name}: mounts, paints and reports no console error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      await openPaused(page, `/?theme=${fixture.name}`);
      await page.clock.runFor(1500);

      // An artboard with no children means the document loaded and nothing
      // rendered, which is the failure a "did it load" check would miss.
      const nodes = await page.locator('[data-vigilia="artboard"] [data-node-id]').count();
      expect(nodes, `${fixture.name} mounted no nodes`).toBeGreaterThan(0);

      // Every chart must have painted. A blank canvas is how an option the
      // engine silently rejects shows up.
      const charts = page.locator('[data-node-id] canvas');
      const chartCount = await charts.count();

      if (fixture.charts) {
        expect(chartCount, `${fixture.name} has no charts`).toBeGreaterThan(0);
      } else {
        expect(chartCount, `${fixture.name} is declared chart-free`).toBe(0);
      }

      for (let index = 0; index < chartCount; index++) {
        const painted = await charts.nth(index).evaluate((element) => {
          const source = element as HTMLCanvasElement;
          const context = source.getContext('2d');
          if (context === null || source.width === 0 || source.height === 0) {
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

        expect(painted, `${fixture.name}: chart ${index} drew no pixels`).toBe(true);
      }

      // Warnings are expected — the demo theme has a deliberately unmapped key,
      // and the assets theme has a deliberately absent file. Errors are not.
      //
      // A failed image request DOES log a browser network error, which is not
      // ours and not something the page can suppress, so it is excluded by name
      // rather than by widening the assertion.
      const ours = errors.filter((message) => !message.includes('not-shipped.png'));
      expect(ours, `${fixture.name} logged errors`).toEqual([]);
    });

    test(`${fixture.name}: keeps the design inside the viewport`, async ({ page }) => {
      await openPaused(page, `/?theme=${fixture.name}`);

      const box = await page.locator('[data-vigilia="artboard"]').boundingBox();
      const viewport = page.viewportSize();

      expect(box).not.toBeNull();
      expect(viewport).not.toBeNull();

      if (box === null || viewport === null) {
        return;
      }

      // §51: one uniform scale, so the rendered aspect ratio always matches the
      // artboard's. A non-uniform scale would distort strokes and glyphs.
      const artboard = await page.evaluate(() => {
        const element = document.querySelector<HTMLElement>('[data-vigilia="artboard"]');
        return element === null
          ? null
          : { width: parseFloat(element.style.width), height: parseFloat(element.style.height) };
      });

      expect(artboard).not.toBeNull();
      if (artboard !== null) {
        expect(box.width / box.height).toBeCloseTo(artboard.width / artboard.height, 1);
      }
    });
  }

  test('cover mode fills the viewport rather than letterboxing (§55)', async ({ page }) => {
    await openPaused(page, '/?theme=portrait-cover');

    const box = await page.locator('[data-vigilia="artboard"]').boundingBox();
    const viewport = page.viewportSize();

    if (box === null || viewport === null) {
      return;
    }

    // Cover fills and crops: the scaled design must cover the viewport in BOTH
    // axes. The fixture's bar colour is magenta precisely so a letterbox here
    // would be unmissable in a screenshot.
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);
  });

  test('an unknown theme name falls back instead of failing', async ({ page }) => {
    // The selector is usually a URL a person typed.
    await page.goto('/?theme=does-not-exist');
    await expect(page.locator('[data-node-id="title"]')).toHaveCount(1);
  });
});

test.describe('visibility', () => {
  test('does not render a node marked invisible, text included', async ({ page }) => {
    // Regression. Visibility was applied before the content switch, and a text
    // node's box is laid out with `display: flex` — so the flex overwrote
    // `display: none` and a node marked `"visible": false` rendered anyway. A
    // stress fixture carrying a hidden element that says so is what caught it.
    await openPaused(page, '/?theme=stress');

    const hidden = page.locator('[data-node-id="hidden-node"]');

    await expect(hidden).toHaveCount(1);
    await expect(hidden).toBeHidden();
    await expect(hidden).toHaveCSS('display', 'none');
    await expect(page.getByText('must not be visible')).toBeHidden();
  });

  test('renders a visible text node as a flex box', async ({ page }) => {
    // The other half of the same rule: the visible value has to depend on the
    // content kind, or alignment stops working.
    await openPlayer(page);
    await expect(page.locator('[data-node-id="cpu-readout"]')).toHaveCSS('display', 'flex');
  });
});

test.describe('image assets (§111)', () => {
  test('loads a declared asset and reports the one that is missing', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });

    await openPaused(page, '/?theme=assets');

    // A loaded image has non-zero natural dimensions; a broken one does not.
    // This is what distinguishes "the element exists" from "the bytes arrived".
    const loaded = await page
      .locator('[data-node-id="fit-contain"] img')
      .evaluate((element) => {
        const image = element as HTMLImageElement;
        return { complete: image.complete, width: image.naturalWidth };
      });

    expect(loaded.complete).toBe(true);
    expect(loaded.width).toBe(128);

    // The deliberately unshipped asset RESOLVES — a declared asset with a valid
    // path always does — so the miss surfaces as a load failure, which the
    // mount layer reports. `unresolved-asset` is for an undeclared id or an
    // unsafe path, and a validated document can contain neither.
    await expect.poll(() => warnings.join('\n'), { timeout: 5000 }).toContain('failed to load');
  });

  test('applies each fit mode to the same artwork', async ({ page }) => {
    await openPaused(page, '/?theme=assets');

    await expect(page.locator('[data-node-id="fit-contain"] img')).toHaveCSS(
      'object-fit',
      'contain',
    );
    await expect(page.locator('[data-node-id="fit-cover"] img')).toHaveCSS('object-fit', 'cover');
    // `stretch` is the document's word; `fill` is CSS's for the same thing.
    await expect(page.locator('[data-node-id="fit-stretch"] img')).toHaveCSS('object-fit', 'fill');
  });

  test('recolours a monochrome image with a mask, not a filter', async ({ page }) => {
    await openPaused(page, '/?theme=assets');

    const mono = page.locator('[data-node-id="svg-mono"]');

    // A mask uses only the artwork's alpha, so the result is one flat colour
    // whatever the source contained. A filter would tint the existing colours.
    await expect(mono).toHaveCSS('background-color', 'rgb(255, 171, 0)');
    const mask = await mono.evaluate((element) => getComputedStyle(element).maskImage);
    expect(mask).toContain('thermometer.svg');

    // And it is NOT an <img>: the mask is on the element itself.
    await expect(mono.locator('img')).toHaveCount(0);
  });

  test('leaves a non-monochrome image as real artwork', async ({ page }) => {
    // §111 requires multicolour originals to be preserved unless the author
    // explicitly recolours, so the default path must stay an <img>.
    await openPaused(page, '/?theme=assets');

    await expect(page.locator('[data-node-id="svg-original"] img')).toHaveCount(1);
    await expect(page.locator('[data-node-id="svg-original"]')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
  });

  test('draws nothing for an unresolvable asset instead of a broken-image icon', async ({
    page,
  }) => {
    await openPaused(page, '/?theme=assets');

    const node = page.locator('[data-node-id="absent-image"]');
    const img = node.locator('img');

    await expect(img).toHaveCount(1);
    // The element stays — the document says something belongs here — but the
    // failed image is hidden rather than left to draw the browser's
    // broken-image glyph, which reads as a rendering failure instead of a
    // missing package file. The node records what failed.
    await expect(img).toBeHidden();
    await expect(node).toHaveAttribute('data-asset-error', /not-shipped\.png/);
  });
});

test.describe('deterministic rendering', () => {
  test('renders our own elements byte-identically at a fixed clock', async ({ browser }) => {
    // Gate 1 asks for deterministic screenshot tests. This is the part that is
    // achievable, and the boundary was measured rather than guessed.
    //
    // DETERMINISTIC: shapes, text, images — everything this renderer draws
    // itself. Three fresh pages of the chart-free `assets` fixture at a fixed
    // clock produce byte-identical images, every time.
    //
    // NOT DETERMINISTIC: any frame containing an ECharts chart. The line chart
    // differs on every page load, on BOTH the canvas and SVG renderers, with
    // animation disabled and the clock frozen. That is an engine property we do
    // not control, and it is recorded in .agents/decisions.md because it decides
    // whether pixel baselines can ever cover charts.
    //
    // Three conditions are still needed for the part that does work: a frozen
    // clock, `static=1`, and a FRESH PAGE per capture — reloading one page never
    // reproduces, which four successive captures confirmed.
    const capture = async (): Promise<Buffer> => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await openPaused(page, '/?theme=assets&static=1');
      // Fonts before pixels: a face that realises after the shutter changes
      // glyph rasterisation, which is a second source of drift and one the page
      // CAN wait for.
      await page.evaluate(() => document.fonts.ready);
      await page.locator('[data-node-id="fit-contain"] img').waitFor();
      const shot = await page.screenshot();
      await page.close();
      return shot;
    };

    await capture(); // warm-up, deliberately discarded

    const first = await capture();
    const second = await capture();

    expect(Buffer.compare(first, second)).toBe(0);
  });

  test('a chart frame IS byte-reproducible, once the clock is genuinely stopped', async ({
    browser,
  }) => {
    // **This assertion inverted on 2026-09-15**, and the inversion is the
    // point. It used to assert the opposite, as a pinned limitation — "any
    // frame with a chart in it is not byte-reproducible", measured on both
    // ECharts renderers and recorded in three places.
    //
    // It was measuring the test harness. `page.clock.install()` does not stop
    // time (see `clock.ts`), so every capture below happened at a different
    // instant and ECharts drew a different frame — correctly. With the clock
    // actually paused, three captures are byte-identical.
    //
    // So it is kept, inverted, because it is now the regression guard for the
    // clock itself: delete the `pauseAt` in `clock.ts` and this is what fails,
    // loudly and for the right reason, instead of three unrelated tests
    // failing intermittently somewhere else.
    //
    // It does **not** put committed pixel baselines back on the table. That is
    // blocked by platform, not by the engine: CI renders on Linux, development
    // happens on Windows, and glyph rasterisation differs.
    const capture = async (): Promise<Buffer> => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await openPaused(page, '/?theme=demo&static=1', '[data-node-id="history-chart"] canvas');
      await page.evaluate(() => document.fonts.ready);
      await page.clock.runFor(1200);
      const shot = await page.locator('[data-node-id="history-chart"]').screenshot();
      await page.close();
      return shot;
    };

    // Warm-up discarded: the first render after a cold browser start differs
    // from every render after it, which is a browser-startup effect rather
    // than an engine one.
    await capture();

    const first = await capture();
    const second = await capture();

    expect(
      Buffer.compare(first, second),
      'a chart frame stopped reproducing — the clock is probably running again',
    ).toBe(0);
  });

  test('animates by default, and not when static is asked for', async ({ context }) => {
    // The flag has to actually reach the chart engine, or the determinism above
    // would be an accident of timing rather than a property.
    //
    // A page per half, from the context so the project's viewport is kept.
    // Both halves used to share one, which meant installing the clock twice
    // over a page that had already run — so the two were not comparable by
    // construction, and this was one of the three recorded flakes.
    const animationOf = async (query: string): Promise<boolean> => {
      const page = await context.newPage();

      await openPaused(page, `/?theme=demo${query}`, '[data-node-id="cpu-gauge"] canvas');

      // Two captures a short way apart: an animating chart is still moving.
      const before = await page.locator('[data-node-id="cpu-gauge"]').screenshot();
      await page.clock.runFor(120);
      const after = await page.locator('[data-node-id="cpu-gauge"]').screenshot();

      await page.close();

      return Buffer.compare(before, after) !== 0;
    };

    expect(await animationOf(''), 'default should animate').toBe(true);
    expect(await animationOf('&static=1'), 'static should not animate').toBe(false);
  });

  test('honours prefers-reduced-motion', async ({ page }) => {
    // An accessibility preference, not a test hook: a dashboard that ignores it
    // animates in someone's peripheral vision all day.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPaused(page, '/?theme=demo', '[data-node-id="cpu-gauge"] canvas');

    const before = await page.locator('[data-node-id="cpu-gauge"]').screenshot();
    await page.clock.runFor(120);
    const after = await page.locator('[data-node-id="cpu-gauge"]').screenshot();

    expect(Buffer.compare(before, after)).toBe(0);
  });
});

test.describe('smooth animation', () => {
  test('moves continuously between samples rather than jumping and resting', async ({ page }) => {
    // The point of matching the transition duration to the sampling interval.
    // ECharts' own default is a 300 ms ease-out, which on a 1 Hz feed produces
    // one lunge and then two thirds of a second of stillness — a visible
    // stutter. Continuous motion means the arc differs at EVERY sampled instant
    // across the interval, not just at the start of it.
    await openPaused(page, '/?theme=demo', '[data-node-id="cpu-gauge"] canvas');

    // Settle the entrance animation, then let one data tick land so an update
    // transition is in flight.
    await page.clock.runFor(2000);

    const gauge = page.locator('[data-node-id="cpu-gauge"]');
    const frames: Buffer[] = [];

    // Six samples across one second. If the value moved only at the start,
    // later frames would be identical to each other.
    for (let step = 0; step < 6; step++) {
      frames.push(await gauge.screenshot());
      await page.clock.runFor(160);
    }

    let moved = 0;
    for (let index = 1; index < frames.length; index++) {
      if (Buffer.compare(frames[index - 1]!, frames[index]!) !== 0) {
        moved += 1;
      }
    }

    // Every step should differ. Allowing one identical pair tolerates a frame
    // landing exactly as a transition completes; requiring most of them is what
    // distinguishes a glide from a jump.
    expect(moved, `only ${moved} of 5 steps showed movement`).toBeGreaterThanOrEqual(4);
  });

  test('keeps the numeric readout stepping at the sample rate, not interpolated', async ({
    page,
  }) => {
    // §122 permits local interpolation of animations; §97 forbids presenting a
    // value that was never measured. Geometry may glide because nobody reads a
    // number off an arc's position. Digits may not, because that is exactly how
    // they are read — so the readout changes once per sample and holds.
    await openPaused(page, '/?theme=demo', '[data-node-id="cpu-gauge"] canvas');
    await page.clock.runFor(2000);

    const readout = page.locator('[data-node-id="cpu-readout"]');
    const values: string[] = [];

    for (let step = 0; step < 5; step++) {
      values.push((await readout.textContent()) ?? '');
      await page.clock.runFor(150);
    }

    // Five samples inside one second: the text must be constant across them,
    // even though the arc behind it is moving the whole time.
    expect(new Set(values).size, `readout changed mid-interval: ${values.join(' → ')}`).toBe(1);
  });
});

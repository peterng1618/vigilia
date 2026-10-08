import { expect, type Page, test } from "@playwright/test";
import {
  HOST_BLEED_THEME_ID,
  HOST_MISSING_THEME_ID,
  HOST_PORT,
  HOST_THEME_ID,
} from "./host-theme.js";

/**
 * The display's own chrome, on the real host.
 *
 * `player-chrome.spec.ts` measures the same property against the preview
 * bundle. This file measures it against the surface a reader actually gets:
 * a theme package the host served, a real transport that can be broken, and
 * the mount path `vite preview` cannot exercise.
 *
 * The three tests are the shapes the preview spec cannot speak for — a strip
 * raised *after* the first fit, two strips on one display at once, and a
 * healthy stream that should say nothing at all.
 */

// Copied from `player-chrome.spec.ts` rather than imported — importing a spec
// file registers its own `test()` calls a second time (see the plan's
// Interfaces block), and this is only the second copy.
const PHONE = {
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
} as const;

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface ChromeGeometry {
  readonly host: Box;
  readonly strips: readonly { readonly id: string; readonly box: Box }[];
  readonly painted: Box;
  readonly degenerate: boolean;
}

async function chromeGeometry(
  page: Page,
  artboard: { readonly width: number; readonly height: number },
): Promise<ChromeGeometry> {
  return page.evaluate((size) => {
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    };
    const host = document.querySelector<HTMLElement>("#artboard");
    if (host === null) throw new Error("the display has no artboard host");
    const handle = (
      window as unknown as {
        vigilia?: {
          handle?: {
            transform(): {
              scale: number;
              offsetX: number;
              offsetY: number;
              isDegenerate: boolean;
            };
          };
        };
      }
    ).vigilia?.handle;
    const transform = handle?.transform();
    if (transform === undefined) throw new Error("the display has no scene");

    const hostBox = box(host);
    return {
      host: hostBox,
      strips: [
        ...document.querySelectorAll<HTMLElement>(
          "[data-vigilia-chrome-strip]",
        ),
      ].map((strip) => ({ id: strip.id, box: box(strip) })),
      // The transform's offsets are relative to the host, the rects are not.
      painted: {
        x: hostBox.x + transform.offsetX,
        y: hostBox.y + transform.offsetY,
        w: size.width * transform.scale,
        h: size.height * transform.scale,
      },
      degenerate: transform.isDegenerate,
    };
  }, artboard);
}

/** Area shared by two boxes, in square CSS pixels. */
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}

const HOST = `http://127.0.0.1:${HOST_PORT}`;

test("a strip that arrives after the fit takes its room then", async ({
  page,
}) => {
  // The availability strip is raised from the refresh cadence, not at mount
  // (`main.ts:220-222`), so on a real display the first fit happens with no
  // chrome. This is that display: its only binding is a key no provider on this
  // PC reports.
  //
  // `&data=live` is load-bearing: the demo source fabricates a reading for
  // every key it is asked for, and the availability notice is raised on the
  // live path only.
  await page.setViewportSize(PHONE.landscape);
  await page.goto(`${HOST}/?theme=${HOST_MISSING_THEME_ID}&data=live`);
  await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();

  await expect(page.locator("[data-vigilia-availability]")).toBeVisible({
    timeout: 30_000,
  });

  const geometry = await chromeGeometry(page, { width: 640, height: 360 });
  for (const strip of geometry.strips) {
    expect(
      overlap(strip.box, geometry.painted),
      `${strip.id} over the artboard`,
    ).toBe(0);
  }
  // The artboard took the room the strip needed rather than being covered: it
  // no longer fills the viewport's height, and still fills its host.
  await expect
    .poll(
      async () =>
        (await chromeGeometry(page, { width: 640, height: 360 })).painted.h,
      {
        timeout: 10_000,
      },
    )
    .toBeLessThan(PHONE.landscape.height);
});

test("two strips at once leave the artboard more than half the phone", async ({
  page,
}) => {
  // Two strips on one display, which is what makes this the ceiling's case
  // rather than one notice's.
  //
  // **The pair is a composition gap and a transport gap, not a data gap and a
  // transport gap as the plan's note expected — measured, 2026-10-08.** A strip
  // needs a *sample* to name a gap: `showAvailabilityNotice` runs on the refresh
  // cadence, before which every key is `undefined` and the notice is silent by
  // design (`availability-notice.ts`). So on a display whose socket is refused
  // there is never a batch, and the data-gap strip can never be raised beside
  // the transport one — the two are mutually exclusive on the real host, which
  // was confirmed by driving it: refused stream, `batchCount` 0, connection
  // strip alone. `e2e-bleed`'s unmarked overhang is the gap that needs no
  // sample, so it is the one that can sit beside a refused transport.
  //
  // At 390px that is a 3-line sentence and a 2-line one; the display must still
  // be a display. (Whole sentences measured: crop 46px, connection 46px, host
  // 753px of 844.)
  await page.route(/\/ws(\?|$)/, (route) => route.abort());
  await page.setViewportSize(PHONE.portrait);
  await page.goto(`${HOST}/?theme=${HOST_BLEED_THEME_ID}&data=live`);

  await expect(page.locator("[data-vigilia-crop]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("#vigilia-connection")).toBeVisible({
    timeout: 30_000,
  });

  const geometry = await chromeGeometry(page, { width: 640, height: 360 });
  const chrome = geometry.strips.reduce(
    (total, strip) => total + strip.box.h,
    0,
  );

  expect(geometry.strips.length).toBe(2);
  expect(geometry.degenerate).toBe(false);
  // The host keeps more than half the phone, not the artboard: a 16:9 artboard
  // on a 390x844 portrait display is letterboxed down to ~219px before any
  // chrome exists. What the chrome is being asked not to do is eat the display,
  // and that is the host's share.
  expect(geometry.host.h).toBeGreaterThan(PHONE.portrait.height / 2);
  // And the artboard was refitted to what is left, not merely drawn smaller:
  // `contain` fills the host on one axis.
  expect(
    Math.abs(geometry.painted.w - geometry.host.w) < 0.5 ||
      Math.abs(geometry.painted.h - geometry.host.h) < 0.5,
    "the artboard was not refitted to the box the chrome left it",
  ).toBe(true);
  // The ceiling's own number, said once: past half the screen the conversation
  // is about the design, not about this test.
  expect(chrome).toBeLessThan(PHONE.portrait.height / 2);
  for (const strip of geometry.strips) {
    expect(
      overlap(strip.box, geometry.painted),
      `${strip.id} over the artboard`,
    ).toBe(0);
  }
});

test("a display with nothing to say is a display unchanged", async ({
  page,
}) => {
  // The compatibility claim, on the surface that matters: a healthy stream and
  // a theme whose objects are inside its artboard. The connection strip is
  // drawn at mount and removed when the stream goes live, so this waits for it
  // — and then reads the fit, because the artboard has to grow back into the
  // room the strip was holding.
  for (const viewport of [PHONE.portrait, PHONE.landscape]) {
    await page.setViewportSize(viewport);
    await page.goto(`${HOST}/?theme=${HOST_THEME_ID}&data=live`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
    await expect(page.locator("#vigilia-connection")).toHaveCount(0, {
      timeout: 20_000,
    });

    await expect
      .poll(
        async () => {
          const geometry = await chromeGeometry(page, {
            width: 640,
            height: 360,
          });
          return [geometry.host.w, geometry.host.h, geometry.strips.length];
        },
        { timeout: 10_000 },
      )
      .toEqual([viewport.width, viewport.height, 0]);
  }
});

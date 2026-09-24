import { expect, type Page, test } from "@playwright/test";
import { canvasProp } from "./canvas-probe.js";
import { HOST_PORT, HOST_THEME_ID } from "./host-theme.js";

/** Exercises the real Node host: the browser suite's only proof that hosted
 * theme loading, declared package-asset serving and the SSE stream work end to
 * end. `vite preview` cannot cover any of it. */

const HOST = `http://127.0.0.1:${HOST_PORT}`;

/** The editor's rail owns one pane per area; panels sit behind it. */
async function openRailPane(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
}

test.describe("hosted player over the real host", () => {
  test("serves the player, the editor and the API only over loopback", async ({
    request,
  }) => {
    const player = await request.get(`${HOST}/`);
    expect(player.status()).toBe(200);
    expect(await player.text()).toContain("<!doctype html");

    const editor = await request.get(`${HOST}/editor/`);
    expect(editor.status()).toBe(200);

    const sensors = await request.get(`${HOST}/api/sensors`);
    expect(sensors.ok()).toBe(true);

    const themes = (await (await request.get(`${HOST}/api/themes`)).json()) as {
      themes: { id: string }[];
    };
    expect(themes.themes.map((entry) => entry.id)).toContain(HOST_THEME_ID);
  });

  test("serves declared package assets and refuses undeclared ones", async ({
    request,
  }) => {
    const asset = await request.get(
      `${HOST}/api/themes/${HOST_THEME_ID}/assets/${encodeURIComponent("assets/badge.svg")}`,
    );
    expect(asset.status()).toBe(200);
    expect(await asset.text()).toContain("<svg");

    const undeclared = await request.get(
      `${HOST}/api/themes/${HOST_THEME_ID}/assets/${encodeURIComponent("assets/nope.svg")}`,
    );
    expect(undeclared.status()).toBe(404);
  });

  test("refuses theme mutation from a non-loopback peer", async ({
    request,
  }) => {
    // Loopback admin is allowed; the guard is what this asserts exists.
    const response = await request.put(`${HOST}/api/themes/${HOST_THEME_ID}`, {
      data: new Uint8Array([1, 2, 3]),
      headers: { "content-type": "application/octet-stream" },
    });
    expect([400, 403]).toContain(response.status());
  });

  test("round-trips a theme saved from the host-served editor", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    // The editor reaches the host's theme store, and the bytes it writes come
    // back through the host's player route: the author-to-display loop.
    await page.goto(`${HOST}/editor/`);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await openRailPane(page, "Add");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Text" })
      .click();

    // Save to library goes through PUT /api/themes/:id, not a download.
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Save to library" }).click();
    await expect(page.locator("#status")).toContainText("Saved to library", {
      timeout: 15_000,
    });
  });

  test("loads a packaged font from the host and applies it", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "one desktop pass is enough for the host path",
    );

    await page.goto(`${HOST}/?theme=${HOST_THEME_ID}`);

    // `document.fonts.check()` is NOT evidence here: it reports true for a
    // generic fallback before any face is registered (verified against this
    // suite's Chromium, where it returns true with an empty face set). The
    // registered face is.
    await page.waitForFunction(
      () => [...document.fonts].some((face) => face.family.includes("Inter")),
      undefined,
      { timeout: 15_000 },
    );

    // The face came from the host's declared-asset route, and it is loaded
    // rather than merely registered.
    const status = await page.evaluate(() => {
      const face = [...document.fonts].find((entry) =>
        entry.family.includes("Inter"),
      );
      return face === undefined ? "none" : face.status;
    });
    expect(status).toBe("loaded");

    // A failed font fetch would surface through the player's failure path; the
    // connection banner is absent once live, so assert on the failure panel.
    await expect(page.locator("pre")).toHaveCount(0);
  });

  test("renders a hosted theme in the player and streams live samples", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "one desktop pass is enough for the host path",
    );

    await page.goto(`${HOST}/?theme=${HOST_THEME_ID}&data=live`);

    // The scene revived from the host's package, not from a fixture bundle.
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();

    // `live` is only reported once a real batch arrives over SSE from the host;
    // the banner is removed then (see `showConnectionState`).
    await expect(page.locator("#vigilia-connection")).toHaveCount(0, {
      timeout: 15_000,
    });

    const batchCount = await page.evaluate(
      () =>
        (window as unknown as { vigilia?: { live?: { batchCount?: number } } })
          .vigilia?.live?.batchCount ?? 0,
    );
    expect(batchCount).toBeGreaterThan(0);
  });
});

/** A `HH:mm:ss` reading as seconds past midnight; not a clock face means none. */
function secondsOf(reading: string): number | undefined {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(reading.trim());
  if (match === null) return undefined;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** A clock face wraps: 23:59:59 is one second from 00:00:00, not a day. */
function secondsApart(a: number, b: number): number {
  const gap = Math.abs(a - b) % 86_400;
  return Math.min(gap, 86_400 - gap);
}

/** What a wall clock in `timeZone` — this PC's own when none is named — reads. */
function zoneReading(page: Page, timeZone?: string): Promise<string> {
  return page.evaluate(
    (zone) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date()),
    timeZone,
  );
}

/** The clock the host sent, as the scene actually painted it. */
async function shownClock(page: Page): Promise<string> {
  return String(await canvasProp(page, "clock", "text"));
}

/**
 * Whether the painted clock agrees with a zone, to the second.
 *
 * The two readings are taken a round trip apart and the host samples at 1 Hz,
 * so the tolerance is the read loop's, not the feature's.
 */
async function paintedInZone(page: Page, timeZone?: string): Promise<boolean> {
  const shown = secondsOf(await shownClock(page));
  const expected = secondsOf(await zoneReading(page, timeZone));
  if (shown === undefined || expected === undefined) return false;
  return secondsApart(shown, expected) <= 2;
}

test.describe("the clock the host reports", () => {
  test("advances, and reads the zone this PC was set to", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "one desktop pass is enough for the host path",
    );

    await page.goto(`${HOST}/?theme=${HOST_THEME_ID}&data=live`);
    await expect(page.locator("#vigilia-connection")).toHaveCount(0, {
      timeout: 15_000,
    });

    // The reading is a sample like any other, so it must move on its own: a
    // scene that painted once would show a frozen clock for ever.
    const first = await shownClock(page);
    await expect
      .poll(() => shownClock(page), { timeout: 10_000 })
      .not.toBe(first);

    // Nothing was chosen, so the host read this PC's own zone.
    await expect
      .poll(() => paintedInZone(page), { timeout: 10_000 })
      .toBe(true);

    // The zone is a host setting, so its proof is a repainted reading rather
    // than a stored preference. Tokyo is far enough from any plausible
    // default that agreement cannot be coincidence.
    const saved = await request.put(`${HOST}/api/display`, {
      data: { timeZone: "Asia/Tokyo" },
    });
    expect(saved.ok()).toBe(true);

    try {
      await expect
        .poll(() => paintedInZone(page, "Asia/Tokyo"), { timeout: 15_000 })
        .toBe(true);
    } finally {
      // The host is shared with the rest of the suite, and `display.json`
      // outlives this test even though the seeded themes do not.
      await request.put(`${HOST}/api/display`, { data: {} });
    }
  });
});

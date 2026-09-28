import { expect, type Page, test } from "@playwright/test";
import { canvasProp } from "./canvas-probe.js";
import { captureVisualReview } from "./editor-canvas.js";
import {
  CLOCK_NODE_ID,
  HOST_ENGLISH_THEME_ID,
  HOST_JAPANESE_THEME_ID,
  HOST_MISSING_THEME_ID,
  HOST_PORT,
  HOST_TEMP_THEME_ID,
  HOST_THEME_ID,
  TEMPERATURE_NODE_ID,
} from "./host-theme.js";
import { isDesktopSurface } from "./surface.js";

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
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

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
      !isDesktopSurface(testInfo),
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

  // Where the defect became visible, and where the witness belongs. It was
  // **produced in the editor** — the editor measured 566.9365234375 for the same
  // object — but the editor revives from `createNewFabricTheme()` on every load, so
  // only a document that has been *saved* carried the inflated width. The player
  // is where a saved document is read back, so that is where the assertion lives.
  //
  // The number in the comment used to be the failing value. It is now the
  // authored one: `vigiliaText.box` is the owner, and Fabric's own width is a
  // cache it re-asserts. See `docs/decisions/0003`.
  //
  // The starter is saved through the host's own store rather than a fixture,
  // because the three objects are the starter's own and no fixture has them.
  test("holds each aligned reading inside its authored box in the player", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "one desktop pass is enough");

    await page.goto(`${HOST}/editor/`);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Save to library" }).click();
    await expect(page.locator("#status")).toContainText("Saved to library", {
      timeout: 20_000,
    });

    await page.goto(`${HOST}/?theme=vigilia-demo-dashboard`);
    await page.waitForSelector('canvas[data-vigilia="artboard"]');
    await page.waitForTimeout(8000);
    const measured = await page.evaluate(() => {
      const canvas = (
        window as unknown as {
          vigilia?: {
            handle: {
              canvas: {
                getObjects(): Array<{ get(name: string): unknown }>;
              };
            };
          };
        }
      ).vigilia?.handle.canvas;
      return ["ram-value", "vram-value", "storage-card-value"].map((id) => {
        const object = canvas
          ?.getObjects()
          .find((candidate) => candidate.get("id") === id);
        const rect = (
          object as { getBoundingRect?: () => { right: number } } | undefined
        )?.getBoundingRect?.();
        return {
          id,
          width: Number(object?.get("width") ?? 0),
          right: Number(rect?.right ?? 0),
        };
      });
    });
    // The authored boxes, per object. The two ring readings are 180 wide and
    // the storage share is 200; asserting one number for all three is a test
    // that can never pass, which is what round one's witness did.
    const authored: Readonly<Record<string, number>> = {
      "ram-value": 180,
      "vram-value": 180,
      "storage-card-value": 200,
    };
    for (const object of measured) {
      expect(object.width, object.id).toBeCloseTo(authored[object.id] ?? 0, 3);
      // And the ink lands inside the artboard: the RAM reading used to end at
      // 1645.9, which is 327.9 units into the VRAM card beside it.
      expect(object.right, object.id).toBeLessThanOrEqual(1672);
    }
  });

  test("a theme's language decides the words its clock shows", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass is enough for the host path",
    );

    await page.goto(`${HOST}/?theme=${HOST_JAPANESE_THEME_ID}&data=live`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
    await expect(page.locator("#vigilia-connection")).toHaveCount(0, {
      timeout: 15_000,
    });
    const japanese = String(await canvasProp(page, CLOCK_NODE_ID, "text"));

    await page.goto(`${HOST}/?theme=${HOST_ENGLISH_THEME_ID}&data=live`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
    await expect(page.locator("#vigilia-connection")).toHaveCount(0, {
      timeout: 15_000,
    });
    const english = String(await canvasProp(page, CLOCK_NODE_ID, "text"));

    // Same theme shape, binding, instant and literal. Only declared language differs.
    expect(japanese).toMatch(/^日付 .*月 /);
    expect(english).toMatch(/^日付 [A-Z][a-z]{2,3} /);
    expect(japanese).not.toBe(english);
  });

  test("plays the saved starter, frosted CPU card and all", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass is enough for the host path",
    );

    // The starter as the editor actually holds it, saved through the host's
    // own route — the author-to-display loop, with no fixture in between.
    await page.goto(`${HOST}/editor/`);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await openRailPane(page, "Add");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Panel", exact: true })
      .click();
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Save to library" }).click();
    await expect(page.locator("#status")).toContainText("Saved to library", {
      timeout: 15_000,
    });

    // And the player renders the same document, with the card's reading live.
    await page.goto(`${HOST}/?theme=vigilia-demo-dashboard&data=live`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
    // The banner is **absent** only once a batch has arrived, so its absence is
    // asserted alongside a positive batch count: a selector that never matches
    // would make the first assertion pass without a single sample.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as {
                  vigilia?: { live?: { batchCount?: number } };
                }
              ).vigilia?.live?.batchCount ?? 0,
          ),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
    await expect(page.locator("#vigilia-connection")).toHaveCount(0);

    const readCard = (): Promise<{
      treatment: unknown;
      reading: string;
    }> =>
      page.evaluate(() => {
        const canvas = (
          window as unknown as {
            vigilia?: {
              handle: {
                canvas: {
                  getObjects(): Array<{ get(name: string): unknown }>;
                };
              };
            };
          }
        ).vigilia?.handle.canvas;
        const object = canvas
          ?.getObjects()
          .find((candidate) => candidate.get("id") === "cpu-card");
        return {
          treatment: object?.get("vigiliaGlass"),
          reading: String(
            canvas
              ?.getObjects()
              .find((candidate) => candidate.get("id") === "cpu-card-value")
              ?.get("text"),
          ),
        };
      });

    // The treatment survived the host's own save, so the player composites it
    // from authored state rather than from a cache the route dropped.
    expect((await readCard()).treatment).toEqual({ blurRadius: 16 });

    // And the reading is **live**, which is the claim this card was added for.
    // A chart in this starter still throws inside ECharts here, and it is
    // isolated to that chart: the throw no longer reaches the text repaint in
    // the same callback, so the reading repaints with it. Polled because a
    // reading arrives over SSE; a single read would be asserting the cadence
    // rather than the card.
    await expect
      .poll(async () => (await readCard()).reading, { timeout: 20_000 })
      .toMatch(/^\d+%$/);

    // The player's failure path is a `<pre>`; an absent one is the claim. The
    // throwing chart is reported, not surfaced, because the scene still works.
    await expect(page.locator("pre")).toHaveCount(0);
  });

  test("paints each caption from the host's own reading of that key", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass is enough for the host path",
    );

    // Self-contained: the starter reaches the host's library only when a
    // browser saves it, so this does that itself rather than leaning on
    // whichever test happened to run first.
    await page.goto(`${HOST}/editor/`);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Save to library" }).click();
    await expect(page.locator("#status")).toContainText("Saved to library", {
      timeout: 20_000,
    });

    await page.goto(`${HOST}/?theme=vigilia-demo-dashboard&data=live`);
    await page.waitForSelector('canvas[data-vigilia="artboard"]');
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as {
                  vigilia?: { live?: { batchCount?: number } };
                }
              ).vigilia?.live?.batchCount ?? 0,
          ),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);

    // The rendered text and the host's own sample for the same key, read in
    // one pass so a repaint between them cannot make this vacuously true.
    const read = (): Promise<{
      caption: string;
      reported: string;
      status: string;
      temperature: string;
    }> =>
      page.evaluate(() => {
        const w = window as unknown as {
          vigilia?: {
            handle: {
              canvas: { getObjects(): Array<{ get(name: string): unknown }> };
            };
            live?: { source?: { latest(key: string): unknown } };
          };
        };
        const objects = w.vigilia?.handle.canvas.getObjects() ?? [];
        const text = (id: string): string =>
          String(objects.find((o) => o.get("id") === id)?.get("text") ?? "");
        const sample = w.vigilia?.live?.source?.latest("gpu.name") as
          | { textValue?: string; status?: string }
          | undefined;

        return {
          caption: text("gpu-card-caption"),
          reported: String(sample?.textValue ?? ""),
          status: String(sample?.status ?? ""),
          temperature: text("gpu-card-temp"),
        };
      });

    // The card shows what the host said about the card, verbatim: a caption
    // painted from anything else is the misattribution this key exists to stop.
    await expect
      .poll(
        async () => {
          const { caption, reported } = await read();
          return caption === reported && reported.length > 0;
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    // And it is a real name rather than the gap a missing reading would show,
    // with a live figure beside it from the same card.
    const settled = await read();
    expect(settled.status).toBe("ok");
    expect(settled.caption).not.toBe("—");
    expect(settled.temperature).toMatch(/\d+°C$/);
  });

  test("renders a hosted theme in the player and streams live samples", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
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
  return String(await canvasProp(page, CLOCK_NODE_ID, "text"));
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
      !isDesktopSurface(testInfo),
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

/** The live temperature sample the display consumed, as the display holds it. */
async function temperatureSample(page: Page): Promise<string> {
  return page.evaluate(() => {
    const source = (
      window as unknown as {
        vigilia?: { live?: { source?: { latest(key: string): unknown } } };
      }
    ).vigilia?.live?.source;
    const sample = source?.latest("gpu.temp") as
      | { status?: string; value?: number; unit?: string }
      | undefined;

    return sample?.value === undefined
      ? "no reading"
      : `${sample.value}${sample.unit ?? ""}`;
  });
}

/**
 * Whether the painted temperature is the sample the display consumed, in the
 * units this PC chose — or, when it is not, what was painted instead.
 *
 * Both sides are read in one `evaluate`, from the sample source the refresh
 * cycle reads, so the comparison is against the reading the paint came from and
 * not a later one that arrived over the stream in between. The sample's own
 * unit is checked first: a display that converted the reading rather than what
 * it shows would be changing what every other reader of that key sees (§97).
 */
async function paintsIn(
  page: Page,
  system: "metric" | "imperial",
): Promise<true | string> {
  return page.evaluate(
    ([chosen, nodeId]) => {
      const bridge = (
        window as unknown as {
          vigilia?: {
            handle?: {
              canvas?: { getObjects(): { get(key: string): unknown }[] };
            };
            live?: { source?: { latest(key: string): unknown } };
          };
        }
      ).vigilia;
      const sample = bridge?.live?.source?.latest("gpu.temp") as
        | { value?: number; unit?: string }
        | undefined;
      const object = bridge?.handle?.canvas
        ?.getObjects()
        .find((entry) => entry.get("id") === nodeId);

      if (sample?.value === undefined || object === undefined) {
        return "no reading to compare";
      }

      if (sample.unit !== "°C") {
        return `the sample's own unit became ${sample.unit}`;
      }

      const expected =
        chosen === "imperial"
          ? `${Math.round((sample.value * 9) / 5 + 32)}°F`
          : `${Math.round(sample.value)}°C`;
      const painted = String(object.get("text"));

      return painted === expected
        ? true
        : `painted ${painted}, expected ${expected}`;
    },
    [system, TEMPERATURE_NODE_ID] as const,
  );
}

test.describe("the units this PC reads in", () => {
  test("shows a temperature in the units this PC chose, converting nothing else", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass is enough for the host path",
    );

    await page.goto(`${HOST}/?theme=${HOST_TEMP_THEME_ID}&data=live`);
    await expect(page.locator("#vigilia-connection")).toHaveCount(0, {
      timeout: 15_000,
    });

    // A GPU temperature is hardware this host may simply not have. A display
    // showing nothing is then the correct behaviour, not a failure of the
    // preference, so say which of the two this run is.
    test.skip(
      (await temperatureSample(page)) === "no reading",
      "this host reports no GPU temperature",
    );

    // Nothing was chosen, so the reading is what the provider measured.
    await expect
      .poll(() => paintsIn(page, "metric"), { timeout: 15_000 })
      .toBe(true);

    const saved = await request.put(`${HOST}/api/display`, {
      data: { measurement: "imperial" },
    });
    expect(saved.ok()).toBe(true);

    try {
      // The preference is read when a display loads, so the screen that is
      // already up is not what shows it.
      await page.reload();
      await expect(page.locator("#vigilia-connection")).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect
        .poll(() => paintsIn(page, "imperial"), { timeout: 15_000 })
        .toBe(true);
    } finally {
      await request.put(`${HOST}/api/display`, { data: {} });
    }
  });
});

/**
 * The display half of Task 11's checklist, and the only surface on which a
 * *missing* reading is a real state: the editor's preview source samples every
 * key it is asked for, so only a display fed by a provider that reports nothing
 * can show a gap.
 */
test.describe("a display fed by the real host", () => {
  test("paints a gap for a key nothing reports, never a zero", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass is enough for the host path",
    );

    await page.goto(`${HOST}/?theme=${HOST_MISSING_THEME_ID}&data=live`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as {
                  vigilia?: { live?: { batchCount?: number } };
                }
              ).vigilia?.live?.batchCount ?? 0,
          ),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);

    // A display must never invent a reading. The whole host has answered with
    // a batch and the node is still a gap, so the gap is the host's answer and
    // not a slow first frame.
    //
    // The host does report the key — as `status: "missing"` with a message
    // naming the cause and **no value at all**, which is the point: the gap is
    // declared, not absent. A fabricated `0` or an absent sample would both
    // look identical on screen, and this is the assertion that separates the
    // three.
    // `expect.poll` takes no argument in this Playwright, so the node id
    // travels into the page through `page.evaluate`, which does.
    const readGap = async (): Promise<{
      readonly text: string;
      readonly status: string;
      readonly hasValue: boolean;
    }> =>
      page.evaluate((nodeId) => {
        const handle = (
          window as unknown as {
            vigilia?: {
              handle: {
                canvas: {
                  getObjects?(): Array<{ get(n: string): unknown }>;
                };
              };
              live?: { source?: { latest(k: string): unknown } };
            };
          }
        ).vigilia;
        // The scene is revived asynchronously, so an unmounted canvas is "not
        // yet" rather than a reading — otherwise the poll would reject instead
        // of retrying.
        const getObjects = handle?.handle.canvas.getObjects;
        if (typeof getObjects !== "function")
          return { text: "", status: "", hasValue: false };
        const object = getObjects
          .call(handle!.handle.canvas)
          .find((candidate) => candidate.get("id") === nodeId);
        const sample = handle?.live?.source?.latest("quantum.entanglement") as
          | { status?: string; value?: unknown }
          | undefined;
        return {
          text: String(object?.get("text") ?? ""),
          status: String(sample?.status ?? ""),
          hasValue: sample !== undefined && "value" in sample,
        };
      }, CLOCK_NODE_ID);

    await expect
      .poll(readGap, { timeout: 20_000 })
      .toEqual({ text: "—", status: "missing", hasValue: false });
  });

  test("stores the picture the editor captured, and serves it back", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(`${HOST}/editor/`);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Save to library" }).click();
    await expect(page.locator("#status")).toContainText("Saved to library", {
      timeout: 20_000,
    });

    // **The picture came back through the host's own route**, which is the only
    // place the capture path is exercised end to end: `vite preview` has no
    // thumbnail store.
    const response = await request.get(
      `${HOST}/api/themes/vigilia-demo-dashboard/thumbnail`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    const bytes = await response.body();
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // PNG magic, so a JSON error body served as a picture cannot pass.
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

    // **And it is a picture of the theme, not a blank card.** The starter's
    // background plate is an opaque gradient, so a capture that carried the
    // composition has opaque pixels; one that captured nothing would not.
    const dataUrl = `data:image/png;base64,${bytes.toString("base64")}`;
    const census = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const surface = document.createElement("canvas");
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const context = surface.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        surface.width,
        surface.height,
      ).data;
      let opaque = 0;
      let clear = 0;
      let coloured = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3]! > 240) opaque += 1;
        if (pixels[i + 3]! === 0) clear += 1;
        const [r, g, b] = [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!];
        if (pixels[i + 3]! > 240 && Math.max(r, g, b) - Math.min(r, g, b) > 24)
          coloured += 1;
      }
      const total = pixels.length / 4;
      return {
        width: surface.width,
        height: surface.height,
        opaque: opaque / total,
        clear: clear / total,
        coloured: coloured / total,
      };
    }, dataUrl);
    // Not blank, and not a transparent card: the composition is in it.
    expect(census.width).toBeGreaterThan(100);
    expect(census.opaque, "the picture carries the theme").toBeGreaterThan(0.3);
    expect(
      census.coloured,
      "the picture is not one flat colour",
    ).toBeGreaterThan(0.001);

    // Kept as evidence, and looked at before it is kept.
    await page.setContent(
      `<body style="margin:0;background:#0c0e13"><img src="${dataUrl}" style="display:block;width:${census.width * 2}px;image-rendering:pixelated"></body>`,
    );
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "../../docs/evidence/screenshots/host-theme-thumbnail-desktop-chromium.png",
      fullPage: true,
    });
  });

  test("reconnects after the stream fails, and the reading resumes", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass is enough for the host path",
    );
    test.slow();

    // **The stream is refused, then allowed.** `page.context().setOffline` was
    // tried first and does not work here: with the context offline this
    // Chromium kept delivering batches over the open `EventSource` — 11 batches
    // across 20 s, no banner — so it tears down neither the connection nor the
    // reader. Blocking the route is the platform's own network layer and does
    // fail the connection, which is the state this exercises.
    //
    // What is **not** covered: an established connection dying mid-stream. The
    // state machine under test (`live-source.ts`) is the same either way — the
    // `error` listener sets `reconnecting` and the browser's own retry brings
    // it back — but the drop here happens at connect time.
    await page.route("**/ws", (route) => route.abort());
    await page.goto(`${HOST}/?theme=${HOST_THEME_ID}&data=live`);
    await expect(page.locator("#vigilia-connection")).toBeVisible({
      timeout: 30_000,
    });
    // The banner names the state, so a page that merely failed to load cannot
    // pass it.
    await expect(page.locator("#vigilia-connection")).toHaveText(
      /reconnect|connect/i,
    );

    // **And it recovers by itself.** The retry is the browser's, not a reload:
    // the page is never navigated again, so a passing banner only means the
    // stream came back.
    await page.unroute("**/ws");
    await expect(page.locator("#vigilia-connection")).toHaveCount(0, {
      timeout: 60_000,
    });
    const batches = await page.evaluate(
      () =>
        (
          window as unknown as {
            vigilia?: { live?: { batchCount?: number } };
          }
        ).vigilia?.live?.batchCount ?? 0,
    );
    expect(batches, "samples arrived after the reconnect").toBeGreaterThan(0);
    // And a real reading is on the canvas, not just an open socket.
    await expect
      .poll(async () => await shownClock(page), { timeout: 30_000 })
      .toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  test("plays the reference composition on the real host, for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "the reference composition is a desktop read",
    );
    test.slow();

    // **The display surface, not the editor's preview.** The editor's preview
    // source attaches no units, so a screenshot of the editor shows "29" where
    // the display shows "47%", and the reference image is a display. Saving
    // through the host's own route keeps this the same document a consumer
    // would load.
    await page.goto(`${HOST}/editor/`);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Save to library" }).click();
    await expect(page.locator("#status")).toContainText("Saved to library", {
      timeout: 20_000,
    });

    await page.setViewportSize({ width: 1672, height: 941 });
    await page.goto(`${HOST}/?theme=vigilia-demo-dashboard&data=live`);
    await page.waitForSelector('canvas[data-vigilia="artboard"]');
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as {
                  vigilia?: { live?: { batchCount?: number } };
                }
              ).vigilia?.live?.batchCount ?? 0,
          ),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
    // Until the readings arrive every card shows a gap, which is a truthful
    // picture of nothing and not the one being compared.
    await expect
      .poll(
        async () => {
          const painted = await page.evaluate(() => {
            const handle = (
              window as unknown as {
                vigilia?: {
                  handle: {
                    canvas: {
                      getObjects?(): Array<{ get(n: string): unknown }>;
                    };
                  };
                };
              }
            ).vigilia;
            // The scene revives asynchronously, so an unmounted canvas is "not
            // yet" rather than a reading.
            const getObjects = handle?.handle.canvas.getObjects;
            if (typeof getObjects !== "function") return "";
            return String(
              getObjects
                .call(handle!.handle.canvas)
                .find((object) => object.get("id") === "storage-card-value")
                ?.get("text") ?? "",
            );
          });
          return painted;
        },
        { timeout: 30_000 },
      )
      .not.toBe("—");

    await expect(page.locator("#vigilia-connection")).toHaveCount(0);
    // **Charts, waited on rather than slept through.** The stream can take
    // several seconds to connect, and a chart's line chart is a rolling
    // window — so the condition to wait for is the one being captured: a
    // trends series that actually has points. A sleep would produce a picture
    // of an empty scene and call it evidence.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const handle = (
              window as unknown as {
                vigilia?: {
                  handle: {
                    canvas: {
                      getObjects?(): Array<Record<string, unknown>>;
                    };
                  };
                };
              }
            ).vigilia;
            const getObjects = handle?.handle.canvas.getObjects;
            if (typeof getObjects !== "function") return 0;
            const chart = getObjects
              .call(handle!.handle.canvas)
              .find(
                (object) => object.get("id") === "trends-chart",
              ) as unknown as
              | {
                  _chart?: {
                    getOption(): { series?: Array<{ data?: unknown[] }> };
                  };
                }
              | undefined;
            const series = chart?._chart?.getOption().series ?? [];
            return series.reduce(
              (total, entry) => total + (entry.data?.length ?? 0),
              0,
            );
          }),
        { timeout: 60_000 },
      )
      .toBeGreaterThan(10);
    await captureVisualReview(page, testInfo, "player-reference");
  });
});

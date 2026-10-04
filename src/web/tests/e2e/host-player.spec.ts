import { expect, type Page, test } from "@playwright/test";
import { canvasProp, sceneBounds, sceneProperty } from "./canvas-probe.js";
import { captureVisualReview } from "./editor-canvas.js";
import { openPane } from "./editor-pane-bar.js";
import {
  BADGE_INK,
  CLOCK_NODE_ID,
  GROUPED_GROUP_ANGLE,
  GROUPED_GROUP_ID,
  GROUPED_PANEL_IDS,
  HOST_ENGLISH_THEME_ID,
  HOST_GROUPED_THEME_ID,
  HOST_JAPANESE_THEME_ID,
  HOST_MEDIA_THEME_ID,
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
/** The starter envelope's own id, which is what the host library calls it. */
const STARTER_THEME_ID = "vigilia-demo-dashboard";

/**
 * Save the starter through the host's own library route, as an author would.
 *
 * **`New from starter` first, and that is the whole fix.** `boot-theme.ts` opens
 * the author's most recent save when the URL names no theme — which, against the
 * host project's shared `--app-dir`, is whichever *fixture* ran last, not the
 * starter. The save that followed therefore wrote somebody else's document, and
 * the display then asked the host for `vigilia-demo-dashboard`, which no run had
 * ever put there. Measured: booting the seeded store opened `bar-0…bar-4` (a
 * fixture), and after `Save to library` the library still had no
 * `vigilia-demo-dashboard`.
 *
 * Naming the document is the point, so it is asserted rather than assumed: the
 * ids below are the reference composition's own, and a save that stored anything
 * else has not saved the starter.
 */
async function saveStarterThroughTheHost(page: Page): Promise<void> {
  await page.goto(`${HOST}/editor/`);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "New from starter" }).click();
  await expect(page.locator("#status")).toContainText(
    "New theme from the starter",
  );
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Save to library" }).click();
  await expect(page.locator("#status")).toContainText("Saved to library", {
    timeout: 20_000,
  });
}

/**
 * The starter, saved through the host and then shown on the display.
 *
 * **This used to be a bare `goto`, and that made every display spec in this file
 * depend on a theme left in the host's on-disk library by an earlier *run*.**
 * The host project's `--app-dir` is a directory, not a fixture, so on a machine
 * that had not run these specs before each of them asked the host for a theme it
 * did not have — a symptom that names the artboard and never mentions the
 * missing document. Saving it here is idempotent, so a spec that already did is
 * unaffected.
 */
async function openStarterDisplay(page: Page, query = ""): Promise<void> {
  await saveStarterThroughTheHost(page);
  await page.goto(`${HOST}/?theme=${STARTER_THEME_ID}${query}`);
}

/** The saved document on the display, with at least one live batch arrived. */
async function openDisplayWithLiveData(page: Page): Promise<void> {
  await openStarterDisplay(page, "&data=live");
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
}

/**
 * Every chart on the display, counted off its own ECharts canvas.
 *
 * `chroma` is saturation, not brightness, and it is the half that matters: a
 * gauge's track is a dark grey ring with plenty of ink and no colour, so an
 * ink count alone passes on a chart that shows nothing the author asked for.
 *
 * **Groups descended, for the reason `canvas-probe.ts`'s reader descends.** The
 * starter's cards are groups, so `storage-bar` and every other chart is inside
 * one; a root-only pass saw no charts at all and the assertion failed as
 * `storage-bar is on the display` — a missing object where the author sees a
 * bar on the wall.
 */
function chartPixels(page: Page): Promise<
  {
    readonly id: string;
    readonly ink: number;
    readonly chroma: number;
    readonly w: number;
    readonly h: number;
  }[]
> {
  return page.evaluate(() => {
    type Obj = {
      get(name: string): unknown;
      getObjects?(): readonly Obj[];
      _element?: HTMLCanvasElement;
    };
    const canvas = (
      window as unknown as {
        vigilia?: { handle: { canvas: { getObjects(): readonly Obj[] } } };
      }
    ).vigilia?.handle.canvas;
    const charts: Obj[] = [];
    const visit = (objects: readonly Obj[] | undefined): void => {
      for (const object of objects ?? []) {
        if (object._element !== undefined) charts.push(object);
        visit(object.getObjects?.());
      }
    };
    visit(canvas?.getObjects());
    return charts.map((object) => {
      const element = object._element!;
      const context = element.getContext("2d");
      if (context === null) {
        return {
          id: String(object.get("id")),
          ink: -1,
          chroma: -1,
          w: 0,
          h: 0,
        };
      }
      const data = context.getImageData(
        0,
        0,
        element.width,
        element.height,
      ).data;
      let ink = 0;
      let chroma = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]! === 0) continue;
        ink += 1;
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        if (Math.max(r, g, b) - Math.min(r, g, b) > 40) chroma += 1;
      }
      return {
        id: String(object.get("id")),
        ink,
        chroma,
        w: element.width,
        h: element.height,
      };
    });
  });
}

/**
 * Pixels of the badge's own colour in the bytes the display actually decoded.
 * Zero until it decodes, and zero forever if the host never served them — which
 * a bare status check on the URL cannot tell apart from a 200 that is not an
 * image.
 */
async function decodedBadgeInk(page: Page): Promise<number> {
  return page.evaluate(({ r, g, b }) => {
    const image = document.querySelector<HTMLImageElement>(
      "[data-vigilia-background-media] img",
    );
    if (image === null || !image.complete || image.naturalWidth === 0) {
      return 0;
    }
    const probe = document.createElement("canvas");
    probe.width = image.naturalWidth;
    probe.height = image.naturalHeight;
    const context = probe.getContext("2d");
    if (context === null) return -1;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, probe.width, probe.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (
        data[i + 3]! > 200 &&
        Math.abs(data[i]! - r) <= 12 &&
        Math.abs(data[i + 1]! - g) <= 12 &&
        Math.abs(data[i + 2]! - b) <= 12
      ) {
        ink += 1;
      }
    }
    return ink;
  }, BADGE_INK);
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

  /**
   * **The marker every "this display is up" assertion in this file names**, and
   * the only place the failure page is itself the subject.
   *
   * A `?theme=` the host cannot serve replaces the display with a page saying so.
   * Four assertions here, and one in `host-media.spec.ts`, check that a display
   * *is* up by asking that this page is absent — which was the same thing as
   * asking for no `<pre>` while the page was built from one. `b01b301` gave the
   * page real markup and nothing noticed, because a `<pre>` is now absent from a
   * display showing nothing but the failure: measured on this host,
   * `preCount 0, failureCount 1`. The old assertion passed on a dead screen.
   */
  test("a theme it cannot serve says so as a page, and not as a bare error", async ({
    page,
  }) => {
    await page.goto(`${HOST}/?theme=e2e-no-such-theme`);

    await expect(page.locator("[data-vigilia-load-failure]")).toBeVisible();
    // The host's own reason, kept and labelled, because the person who fixes
    // this is not the one looking at the display.
    await expect(
      page.locator("[data-vigilia-load-failure-reason]"),
    ).not.toBeEmpty();
    // A reader with several displays open can tell which one broke.
    await expect(page).toHaveTitle(/nothing to display/);
    // And there is no artboard behind it — the page replaced the display rather
    // than drawing over one, which is what keeps it from reading as a gap.
    await expect(page.locator("#artboard canvas.lower-canvas")).toHaveCount(0);

    // **The fact the old assertions rested on and no longer do.** Stated here so
    // the next reader of `pre` learns it from a test rather than from a
    // screenshot: this page contains no `<pre>`, so "no `<pre>`" is satisfied by
    // a display that is showing nothing else.
    await expect(page.locator("pre")).toHaveCount(0);
  });

  test("serves declared package assets and refuses undeclared ones", async ({
    request,
  }) => {
    const asset = await request.get(
      `${HOST}/api/themes/${HOST_THEME_ID}/assets/badge.svg`,
    );
    expect(asset.status()).toBe(200);
    expect(await asset.text()).toContain("<svg");

    const undeclared = await request.get(
      `${HOST}/api/themes/${HOST_THEME_ID}/assets/nope.svg`,
    );
    expect(undeclared.status()).toBe(404);
  });

  test("a hosted theme's packaged media decodes on the display", async ({
    page,
  }) => {
    await page.goto(`${HOST}/?theme=${HOST_MEDIA_THEME_ID}`);

    // The media layer is a DOM sibling under the artboard, so the proof is the
    // element itself: the URL the resolver built, the decoded size, and the
    // pixels the served bytes actually paint. A 200 on its own would pass on an
    // app shell served for an unknown path.
    await expect
      .poll(() => decodedBadgeInk(page), { timeout: 20_000 })
      .toBeGreaterThan(200);

    const media = await page
      .locator("[data-vigilia-background-media] img")
      .evaluate((element) => ({
        src: (element as HTMLImageElement).src,
        naturalWidth: (element as HTMLImageElement).naturalWidth,
      }));
    expect(media.src).toBe(
      `${HOST}/api/themes/${HOST_MEDIA_THEME_ID}/assets/badge.svg`,
    );
    expect(media.naturalWidth).toBe(24);
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

    await openPane(page, "Insert");
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
    // connection banner is absent once live, so assert on the failure page —
    // the marker that page actually carries, named once above.
    await expect(page.locator("[data-vigilia-load-failure]")).toHaveCount(0);
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

    await openStarterDisplay(page);
    await page.waitForSelector('canvas[data-vigilia="artboard"]');
    await page.waitForTimeout(8000);
    // **Groups descended, and world.** All three are parts of a card, so the
    // root-only search this replaced read nothing for them; and `right` is
    // composed through the ancestor transform, because a part's own `left` is
    // its position *inside* its card and says nothing about where it lands.
    const measured = await Promise.all(
      ["ram-value", "vram-value", "storage-card-value"].map(async (id) => ({
        id,
        width: Number((await sceneProperty(page, id, "width")) ?? 0),
        right: (await sceneBounds(page, id))?.right ?? 0,
      })),
    );
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
    // Waited on, not read once: the banner clears when the stream connects, which
    // is before the first sample reaches the canvas, and until it does the clock
    // correctly shows the no-reading gap. Reading it there is how this test went
    // red under load while passing 24/24 in its own project.
    await expect
      .poll(() => shownClock(page), { timeout: 15_000 })
      .not.toBe("—");
    const japanese = String(await canvasProp(page, CLOCK_NODE_ID, "text"));

    await page.goto(`${HOST}/?theme=${HOST_ENGLISH_THEME_ID}&data=live`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
    await expect(page.locator("#vigilia-connection")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect
      .poll(() => shownClock(page), { timeout: 15_000 })
      .not.toBe("—");
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
    await openPane(page, "Insert");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Rectangle", exact: true })
      .click();
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Save to library" }).click();
    await expect(page.locator("#status")).toContainText("Saved to library", {
      timeout: 15_000,
    });

    // And the player renders the same document, with the card's reading live.
    await openStarterDisplay(page, "&data=live");
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

    /** Read through `sceneProperty`, which descends into groups — the CPU
     *  card's plate and its value are both parts of `group-cpu-card`, so the
     *  root-only search this replaced read `undefined` for objects the display
     *  was showing. */
    const readCard = async (): Promise<{
      treatment: unknown;
      reading: string;
    }> => ({
      treatment: await sceneProperty(page, "cpu-card", "vigiliaGlass"),
      reading: String(
        (await sceneProperty(page, "cpu-card-value", "text")) ?? "—",
      ),
    });

    // The treatment survived the host's own save, so the player composites it
    // from authored state rather than from a cache the route dropped — and it
    // is the card's own authored radius, 40, not a default the route supplied.
    expect((await readCard()).treatment).toEqual({ blurRadius: 40 });

    // And the reading is **live**, which is the claim this card was added for.
    // Polled because a reading arrives over SSE; a single read would be
    // asserting the cadence rather than the card.
    await expect
      .poll(async () => (await readCard()).reading, { timeout: 20_000 })
      .toMatch(/^\d+%$/);

    // The player's failure path is that page; an absent one is the claim.
    await expect(page.locator("[data-vigilia-load-failure]")).toHaveCount(0);
  });

  test("the display paints its charts in the theme's own palette", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass is enough for the host path",
    );
    // A host save, a player boot, a live batch and a settling window is well
    // over the 30 s default on this machine; the same reason the long journey
    // test carries one.
    test.slow();

    // **Counted, not read off an option string.** The player used to call
    // `buildChartPlan` with no palette, so every `palette.` reference in a
    // theme resolved to nothing and the bar carried `value: 46.8` with
    // `itemStyle.color: "transparent"` — a plausible-looking string and zero
    // ink on the display. The claim is pixels.
    await saveStarterThroughTheHost(page);
    await openDisplayWithLiveData(page);
    // The trends series needs points before its stroke exists, so a single
    // early read would measure an empty chart rather than a broken one.
    await page.waitForTimeout(8000);

    const charts = await chartPixels(page);

    for (const id of ["storage-bar", "cpu-card-sparkline"]) {
      const chart = charts.find((candidate) => candidate.id === id);
      expect(chart, `${id} is on the display`).toBeDefined();
      expect(chart!.w, `${id} has a real backing canvas`).toBeGreaterThan(50);
      expect(chart!.ink, `${id} has ink on its own canvas`).toBeGreaterThan(
        500,
      );
      expect(
        chart!.chroma,
        `${id} paints its value in a colour, not a grey track`,
      ).toBeGreaterThan(500);
    }
    // And the whole display is not one chart quietly carrying the claim.
    expect(charts.length, "the display's charts").toBeGreaterThan(2);
  });

  test("a gauge draws the progress arc the reference shows", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass is enough for the host path",
    );
    test.slow();

    // **Was pinned as a known gap, and the gap is closed.** The ring and its
    // reading are separate objects, so a gauge could look complete while its
    // coloured arc was missing: the track is grey ink and the reading is
    // ordinary text. The player's console said why, and the per-chart guard in
    // `hydrateCharts` turned it into a warning rather than a `pageerror`, so a
    // run watching for uncaught errors saw none:
    //
    //   Vigilia: Chart "ram-gauge" failed to draw and was left as it was.
    //   Cannot read properties of undefined (reading '0')
    //
    // The cause is ECharts 6.1.0's, and it is in the data, not the paint.
    // `GaugeView._renderPointer` reads its own `_progressEls` inside the
    // data-diff `update` callback and only assigns it after a render that drew
    // an arc. The display's first render happens before telemetry arrives, so
    // the first sample crossed that read with the flag flipping under a datum
    // that had been there all along. A gauge with no arc now carries no datum
    // (`0008`), which turns the crossing into an `add` — and the editor, which
    // mounts with a sample in hand, never took that path at all.
    await saveStarterThroughTheHost(page);
    await openDisplayWithLiveData(page);
    await page.waitForTimeout(8000);

    const gauge = (await chartPixels(page)).find(
      (candidate) => candidate.id === "ram-gauge",
    );
    expect(gauge, "the ring is on the display").toBeDefined();
    expect(gauge!.ink, "the ring has a track").toBeGreaterThan(500);
    // The floor is the *no arc* baseline, not a share of memory. Measured on
    // this option at the starter's 218x218 @ renderScale 2, chroma is
    // `553 + 207 x value` px: 216 with no datum at all, 553 at value 0, 2,620 at
    // 10%. A 2000 floor therefore read "RAM above ~7%", which is a statement
    // about the host's memory rather than about the ring — and it went red on an
    // idle machine that the fix had fixed. 500 is the floor this file already
    // uses for the other charts, and it is 2.3x the arc-less baseline this test
    // has to tell apart (219 on `ram-gauge`, 307 on `vram-gauge`).
    expect(
      gauge!.chroma,
      "the ring paints its progress arc in the theme's colour",
    ).toBeGreaterThan(500);
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
    await openStarterDisplay(page, "&data=live");
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
    // **Through `sceneProperty`, which descends into groups**: both captions
    // are parts of `group-gpu-card`, and the root-only search this replaced
    // read `""` for them — a caption the display was painting, read as blank.
    const read = async (): Promise<{
      caption: string;
      reported: string;
      status: string;
      temperature: string;
    }> => {
      const sample = await page.evaluate(
        () =>
          (
            window as unknown as {
              vigilia?: {
                live?: { source?: { latest(key: string): unknown } };
              };
            }
          ).vigilia?.live?.source?.latest("gpu.name") as
            | { textValue?: string; status?: string }
            | undefined,
      );
      return {
        caption: String(
          (await sceneProperty(page, "gpu-card-caption", "text")) ?? "",
        ),
        reported: String(sample?.textValue ?? ""),
        status: String(sample?.status ?? ""),
        temperature: String(
          (await sceneProperty(page, "gpu-card-temp", "text")) ?? "",
        ),
      };
    };

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
      const object = bridge?.handle.canvas
        .getObjects()
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
      `${HOST}/api/themes/${STARTER_THEME_ID}/thumbnail`,
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

    // Kept as evidence, and looked at before it is kept. Gated like its two
    // siblings: this file is tracked, and rewriting it on every desktop-host
    // run left the working tree dirty with a picture nobody inspected.
    if (process.env["VIGILIA_CAPTURE"] !== undefined) {
      await page.setContent(
        `<body style="margin:0;background:#0c0e13"><img src="${dataUrl}" style="display:block;width:${census.width * 2}px;image-rendering:pixelated"></body>`,
      );
      await page.waitForTimeout(400);
      await page.screenshot({
        path: "../../docs/evidence/screenshots/host-theme-thumbnail-desktop-chromium.png",
        fullPage: true,
      });
    }
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

  test("the starter's frosted card shows its packaged photograph on the display, untainted", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "one desktop pass is enough");
    test.slow();

    // **The whole route, end to end.** The editor packages the photograph, the
    // host stores it and answers `/api/themes/<id>/assets/<path>`, and the
    // player decodes that response. This is the mount where a cross-origin
    // backdrop would have bitten: the display is the surface that captures
    // thumbnails and that every pixel-reading guard measures.
    await saveStarterThroughTheHost(page);
    // **The artboard's own size, which is the reference read.** The host
    // project's viewport is 1280x720, and at that size the same band reads
    // 0.70 rather than 1.38 — the display's glass sampler loses contrast as
    // the artboard is scaled down (see the editor-side probe, which reads
    // 4.46 at its own 0.37 camera scale). 1672x941 is where the starter is
    // designed to be read, and where the registered capture is taken.
    await page.setViewportSize({ width: 1672, height: 941 });
    await openStarterDisplay(page);
    await page.waitForSelector('canvas[data-vigilia="artboard"]');
    await page.waitForFunction(
      () => {
        const image = document.querySelector<HTMLImageElement>(
          "[data-vigilia-background-media] img",
        );
        return (
          image !== null &&
          image.complete &&
          image.naturalWidth > 0 &&
          image.naturalHeight > 0
        );
      },
      undefined,
      { timeout: 30_000 },
    );
    // The photograph came off the host's own route, at the size it declared.
    const delivered = await page.evaluate(
      () =>
        document
          .querySelector<HTMLImageElement>(
            "[data-vigilia-background-media] img",
          )
          ?.getAttribute("src") ?? "",
    );
    expect(delivered).toBe(
      `/api/themes/${STARTER_THEME_ID}/assets/starter-backdrop.jpg`,
    );

    // The card's own contents are hidden while the band is read: `cpu-card` has
    // no empty region, and a band crossing a glyph measures the glyph —
    // identically with and without the blur, which is what the first version
    // of the editor-side probe reported (peak 27.82 -> 27.82).
    const bands = await starterCardBands(page, "cpu-card", {
      left: 70,
      top: 70,
      width: 140,
      height: 167,
    });
    const { blurred, sharp, clearBlurred, clearSharp, photo } = bands;

    // **The panel blurs the photograph, at this mount's scale.** The band is a
    // rectangle in artboard units and `object-fit: cover` puts the whole file
    // over the artboard, so the backdrop under the panel must measure what
    // that rectangle of the photograph measures. Before 0012 the sampler took
    // a pixel-for-pixel crop of the middle of the file sized by the device
    // rect — the middle 71.8 % here where the element shows all of it — and
    // this read 5.08 against the 7.45 below. The editor, at its 0.3744
    // camera, read 16.54 against the same control. That was the
    // 4.46-against-1.38 divergence the plan carried as an open question: the
    // editor was the mount sampling elsewhere, and both mounts now read the
    // same value off the same photograph.
    expect(photo, "the photograph was read as a control").not.toBeNull();
    expect(
      Math.abs(clearSharp.contrast - photo!.contrast),
      `the display's backdrop is the photograph (panel ${clearSharp.contrast} vs photo ${photo!.contrast})`,
    ).toBeLessThan(photo!.contrast * 0.15);
    expect(
      Math.abs(clearSharp.meanLuma - photo!.meanLuma),
      "and it is the same part of the photograph, not merely a similar range",
    ).toBeLessThan(photo!.meanLuma * 0.08);

    // Measured on this machine, 2026-10-04, at 1672x941 with this card's 40-unit
    // radius and its `#0815234d` (30 %-opaque) fill: the same backdrop under a
    // clear fill reads 7.51 sharp against 1.76 diffused, the authored panel
    // reads 1.24, and the authored panel at radius 0 reads 5.26. The gradient
    // this replaced has a mean luma step between adjacent columns of **0.00**
    // at every scale, so a panel over it could not read above zero however wide
    // the radius was.
    //
    // **The card's own group was being hidden along with its parts**, which is
    // the whole reason this used to read as the picture showing through the
    // panel when the panel was not there at all — see `starterCardBands`.
    expect(blurred.rows, "the band covers rows").toBeGreaterThan(20);

    // **And it is the glass that did it.** The blur-off control is the same
    // authored panel through the same code path with `blurRadius: 0`, so the
    // only difference is the radius: 6.17 against 1.46, a **4.2x** drop. A
    // panel that merely tinted its backdrop would move this number not at all.
    expect(
      sharp.contrast / blurred.contrast,
      `the display's frosted panel is diffused by its own treatment (${sharp.contrast} at radius 0 against ${blurred.contrast} authored)`,
    ).toBeGreaterThan(3);
    // Diffused, not erased: 23 % of the range survives.
    expect(
      clearBlurred.contrast,
      "the blur diffuses the backdrop rather than erasing it",
    ).toBeGreaterThan(clearSharp.contrast * 0.15);

    // **The floor that separates "a photograph is behind this" from "an even
    // fill"**: about 1.28 here against 1.08 in the editor's mount, and 0.00 for
    // the even gradient at every radius.
    expect(
      blurred.contrast,
      "the display's frosted panel carries backdrop structure",
    ).toBeGreaterThan(0.6);

    // **Taint.** The bytes are same-origin, so the display's canvas is not
    // tainted, and the capture path that reads it back works. A CDN URL would
    // have rendered the same picture and failed exactly here.
    const taint = await page.evaluate(() => {
      const element = document.querySelector<HTMLCanvasElement>(
        'canvas[data-vigilia="artboard"]',
      );
      if (element === null) throw new Error("the display canvas is missing");
      try {
        element.getContext("2d")!.getImageData(0, 0, 1, 1);
        return { read: "pixels", dataUrl: element.toDataURL().length };
      } catch (error) {
        return { read: `threw: ${String(error)}`, dataUrl: 0 };
      }
    });
    expect(taint.read, "the display canvas is not tainted").toBe("pixels");
    expect(taint.dataUrl, "and it encodes").toBeGreaterThan(10_000);
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
    await openStarterDisplay(page, "&data=live");
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
    //
    // **Groups descended**, for the reason every other reader here says it:
    // `trends-chart` is a part of `group-trends-card`, and the root-only
    // search this replaced found no chart at all, so the wait ran out its full
    // 60 s on a series of zero points that was never going to arrive.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            type Obj = {
              get(id: string): unknown;
              getObjects?(): readonly Obj[];
            };
            const canvas = (
              window as unknown as {
                vigilia?: {
                  handle: { canvas?: { getObjects(): readonly Obj[] } };
                };
              }
            ).vigilia?.handle.canvas;
            const find = (objects: readonly Obj[]): Obj | undefined => {
              for (const candidate of objects) {
                if (candidate.get("id") === "trends-chart") return candidate;
                const found = find(candidate.getObjects?.() ?? []);
                if (found !== undefined) return found;
              }
              return undefined;
            };
            const chart =
              canvas === undefined ? undefined : find(canvas.getObjects());
            const series =
              (
                chart as
                  | {
                      _chart?: {
                        getOption(): { series?: Array<{ data?: unknown[] }> };
                      };
                    }
                  | undefined
              )?._chart?.getOption().series ?? [];
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

/* ------------------------------------------------------------------------ *
 * The player's own acceptance surface: a second viewport, a second device
 * pixel ratio, and glass under a group, a rotation and an intersection.
 *
 * These live here and not in `reference-theme.spec.ts` because this file is
 * the one the config pins to `workers: 1` under the `desktop-host` project:
 * every test below boots a real host whose stores are a directory on disk, and
 * a spec outside that project would run beside `host-settings.spec.ts` in
 * parallel. The editor's half of the same clause stays where it is.
 * ------------------------------------------------------------------------ */

/** The starter's own artboard, which both mounts below letterbox into a
 *  viewport that is not its size. */
const STARTER = { width: 1672, height: 941 } as const;

/** `contain` fit of the starter into a viewport, to the pixel. */
function expectContainFit(
  actual: { scale: number; offsetX: number; offsetY: number },
  viewport: { width: number; height: number },
): void {
  const scale = Math.min(
    viewport.width / STARTER.width,
    viewport.height / STARTER.height,
  );
  expect(actual.scale, "the artboard is fitted, not drawn at 1:1").toBeCloseTo(
    scale,
    2,
  );
  // A 1:1 view would carry no offset at all; these are the letterbox bars.
  expect(
    Math.abs(actual.offsetX) + Math.abs(actual.offsetY),
    "the fitted view letterboxes on at least one axis",
  ).toBeGreaterThan(0.5);
}

/** The player's own `StaticCanvas`, its fit and its backing store. */
function playerSurface(page: Page): Promise<{
  scale: number;
  offsetX: number;
  offsetY: number;
  cssWidth: number;
  backingWidth: number;
  dpr: number;
}> {
  return page.evaluate(() => {
    const canvas = (
      window as unknown as {
        vigilia?: {
          handle: {
            canvas: {
              viewportTransform: number[];
              lowerCanvasEl: HTMLCanvasElement;
              renderAll(): void;
            };
          };
        };
      }
    ).vigilia?.handle.canvas;
    if (canvas === undefined) throw new Error("the player has not mounted");
    canvas.renderAll();
    const vp = canvas.viewportTransform;
    return {
      scale: vp[0] ?? 0,
      offsetX: vp[4] ?? 0,
      offsetY: vp[5] ?? 0,
      cssWidth: canvas.lowerCanvasEl.getBoundingClientRect().width,
      backingWidth: canvas.lowerCanvasEl.width,
      dpr: window.devicePixelRatio,
    };
  });
}

/** A text object's own glyph coverage, with the box minus the text as the
 *  control. A count of "non-background pixels" alone would pass on any lit
 *  card, so the difference is what the glyphs contributed. */
function glyphCoverage(
  page: Page,
  id: string,
): Promise<{ covered: number; area: number; width: number; height: number }> {
  return page.evaluate((objectId) => {
    type Obj = {
      get(n: string): unknown;
      calcTransformMatrix(): number[];
      visible: boolean;
    };
    const canvas = (
      window as unknown as {
        vigilia?: {
          handle: {
            canvas: {
              getObjects(): Obj[];
              viewportTransform: number[];
              lowerCanvasEl: HTMLCanvasElement;
              renderAll(): void;
              getRetinaScaling(): number;
            };
          };
        };
      }
    ).vigilia?.handle.canvas;
    if (canvas === undefined) throw new Error("the player has not mounted");
    const object = canvas
      .getObjects()
      .find((candidate) => candidate.get("id") === objectId);
    if (object === undefined) throw new Error(`no object ${objectId}`);
    const vp = canvas.viewportTransform;
    const retina = canvas.getRetinaScaling();
    const m = object.calcTransformMatrix();
    // The object's own local units to the painted surface, so the band is the
    // glyph's own box rather than an artboard rectangle that happens to be near
    // it — the same composition `glass.ts` samples through.
    const toDevice = (x: number, y: number): readonly [number, number] => [
      (m[0]! * x + m[2]! * y + m[4]!) * (vp[0]! * retina) +
        (m[1]! * x + m[3]! * y + m[5]!) * (vp[2]! * retina) +
        vp[4]! * retina,
      (m[0]! * x + m[2]! * y + m[4]!) * (vp[1]! * retina) +
        (m[1]! * x + m[3]! * y + m[5]!) * (vp[3]! * retina) +
        vp[5]! * retina,
    ];
    const halfWidth = Number(
      (object as unknown as Record<string, unknown>)["width"],
    );
    const halfHeight = Number(
      (object as unknown as Record<string, unknown>)["height"],
    );
    const corners = [
      [-halfWidth / 2, -halfHeight / 2],
      [halfWidth / 2, -halfHeight / 2],
      [halfWidth / 2, halfHeight / 2],
      [-halfWidth / 2, halfHeight / 2],
    ].map(([x, y]) => toDevice(x!, y!));
    const xs = corners.map((point) => point[0]);
    const ys = corners.map((point) => point[1]);
    const left = Math.max(0, Math.round(Math.min(...xs)));
    const top = Math.max(0, Math.round(Math.min(...ys)));
    const width = Math.max(
      1,
      Math.min(canvas.lowerCanvasEl.width, Math.round(Math.max(...xs))) - left,
    );
    const height = Math.max(
      1,
      Math.min(canvas.lowerCanvasEl.height, Math.round(Math.max(...ys))) - top,
    );
    const context = canvas.lowerCanvasEl.getContext("2d")!;
    /** Pixels that are not the box's own fill. */
    const inked = (): number => {
      const data = context.getImageData(left, top, width, height).data;
      const luma = (i: number): number =>
        0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
      const every: number[] = [];
      for (let i = 0; i < data.length; i += 4) every.push(luma(i));
      const sorted = [...every].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      let ink = 0;
      for (const value of every) if (Math.abs(value - median) > 40) ink += 1;
      return ink;
    };
    canvas.renderAll();
    const withText = inked();
    const was = object.visible;
    object.visible = false;
    canvas.renderAll();
    const without = inked();
    object.visible = was;
    canvas.renderAll();
    return { covered: withText - without, area: width * height, width, height };
  }, id);
}

/**
 * Band statistics inside a panel, on the player's own canvas.
 *
 * The band is the object's **own rotated box**, inset to stay inside a turned
 * or grouped panel: the editor's helper offsets from the axis-aligned bounding
 * rect, which for a 30° panel is mostly panel-free space. The blur radius can
 * be overridden in place, which is the control — the same code path with the
 * blur off, so a reading of "soft" is a reading of the blur and not of a dark
 * panel.
 */
/**
 * A starter card read twice, with its own contents taken out of the picture.
 *
 * `panelBand` above addresses a panel through `calcTransformMatrix` and
 * ±width/2, which is a **centre** origin. Every starter card is authored
 * top-left (`rect()` in `new-fabric-theme-objects.ts`), so that arithmetic
 * would read a region half a card away. `getBoundingRect` carries the origin
 * with it, which is why this is a second helper rather than a call to the
 * first.
 *
 * The contents are hidden for both readings and restored after, and both
 * radii are read here in one call so the second cannot inherit the first's —
 * which is how the editor-side probe's first version reported the same number
 * twice. The control is the blur, not the card: `blurRadius: 0` leaves the
 * treatment present, so the panel still composites and only the radius differs.
 */
function starterCardBands(
  page: Page,
  id: string,
  inset: { left: number; top: number; width: number; height: number },
): Promise<{
  blurred: { peak: number; contrast: number; rows: number; meanLuma: number };
  sharp: { peak: number; contrast: number; rows: number; meanLuma: number };
  clearBlurred: {
    peak: number;
    contrast: number;
    rows: number;
    meanLuma: number;
  };
  clearSharp: {
    peak: number;
    contrast: number;
    rows: number;
    meanLuma: number;
  };
  photo: {
    columns: number;
    peak: number;
    contrast: number;
    meanLuma: number;
  } | null;
}> {
  return page.evaluate(
    ([objectId, box]) => {
      type Obj = {
        get(n: string): unknown;
        set(n: string, v: unknown): void;
        getObjects?(): Obj[];
        getBoundingRect(): {
          left: number;
          top: number;
          width: number;
          height: number;
        };
      };
      const canvas = (
        window as unknown as {
          vigilia?: {
            handle: {
              canvas: {
                getObjects(): Obj[];
                viewportTransform: number[];
                lowerCanvasEl: HTMLCanvasElement;
                renderAll(): void;
                getRetinaScaling(): number;
              };
            };
          };
        }
      ).vigilia?.handle.canvas;
      if (canvas === undefined) throw new Error("the player has not mounted");
      const find = (objects: Obj[]): Obj | undefined => {
        for (const candidate of objects) {
          if (candidate.get("id") === objectId) return candidate;
          const child = find(candidate.getObjects?.() ?? []);
          if (child !== undefined) return child;
        }
        return undefined;
      };
      const objects = canvas.getObjects();
      const card = find(objects);
      if (card === undefined) throw new Error(`no object ${objectId}`);
      const cardBox = card.getBoundingRect();
      const inside = (object: Obj): boolean => {
        const rect = object.getBoundingRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return (
          cx > cardBox.left &&
          cx < cardBox.left + cardBox.width &&
          cy > cardBox.top &&
          cy < cardBox.top + cardBox.height
        );
      };
      // **The whole document, and never the card's own ancestors.** This walked
      // the roots only, which fails twice over: `cpu-card` is a *part* of
      // `group-cpu-card`, so the one root whose box covers the card was hidden
      // and took the panel off the canvas with it, and the card's own icon,
      // title, reading and sparkline — the things a band must not cross — were
      // never hidden at all because they are not roots. The same substitution
      // `reference-theme.spec.ts` carries.
      const every: { object: Obj; parents: Obj[] }[] = [];
      const collect = (list: Obj[], parents: Obj[]): void => {
        for (const entry of list) {
          every.push({ object: entry, parents });
          collect(entry.getObjects?.() ?? [], [...parents, entry]);
        }
      };
      collect(objects, []);
      const ancestors = new Set<Obj>();
      for (const entry of every)
        if (entry.object === card) for (const parent of entry.parents)
          ancestors.add(parent);
      const restore = every
        .filter(
          (entry) =>
            entry.object !== card &&
            !ancestors.has(entry.object) &&
            inside(entry.object),
        )
        .map(
          (entry) => [entry.object, entry.object.get("visible")] as const,
        );
      for (const [object] of restore) object.set("visible", false);

      const vp = canvas.viewportTransform;
      const retina = canvas.getRetinaScaling();
      const toDevice = (x: number, y: number): readonly [number, number] => [
        (x * vp[0]! + y * vp[2]! + vp[4]!) * retina,
        (x * vp[1]! + y * vp[3]! + vp[5]!) * retina,
      ];
      const [x0, y0] = toDevice(cardBox.left + box.left, cardBox.top + box.top);
      const [x1, y1] = toDevice(
        cardBox.left + box.left + box.width,
        cardBox.top + box.top + box.height,
      );
      const left = Math.max(0, Math.round(x0));
      const top = Math.max(0, Math.round(y0));
      const width = Math.max(
        1,
        Math.min(canvas.lowerCanvasEl.width, Math.round(x1)) - left,
      );
      const height = Math.max(
        1,
        Math.min(canvas.lowerCanvasEl.height, Math.round(y1)) - top,
      );
      const measure = (): {
        peak: number;
        contrast: number;
        rows: number;
        meanLuma: number;
      } => {
        canvas.renderAll();
        const data = canvas.lowerCanvasEl
          .getContext("2d")!
          .getImageData(left, top, width, height).data;
        const means = new Array<number>(width).fill(0);
        for (let y = 0; y < height; y += 1)
          for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            means[x]! +=
              0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
          }
        for (let x = 0; x < width; x += 1) means[x]! /= height;
        let peak = 0;
        for (let x = 1; x < width; x += 1)
          peak = Math.max(peak, Math.abs(means[x]! - means[x - 1]!));
        return {
          peak: Math.round(peak * 100) / 100,
          contrast:
            Math.round((Math.max(...means) - Math.min(...means)) * 100) / 100,
          rows: height,
          meanLuma:
            Math.round((means.reduce((a, b) => a + b, 0) / width) * 100) / 100,
        };
      };

      const authored = card.get("vigiliaGlass") as { blurRadius: number };
      const authoredFill = card.get("fill") as string;
      card.set("vigiliaGlass", authored);
      const blurred = measure();
      card.set("vigiliaGlass", { blurRadius: 0 });
      const sharp = measure();
      card.set("vigiliaGlass", authored);
      card.set("fill", "rgba(8, 21, 35, 0)");
      const clearBlurred = measure();
      card.set("vigiliaGlass", { blurRadius: 0 });
      const clearSharp = measure();
      card.set("fill", authoredFill);
      card.set("vigiliaGlass", authored);
      for (const [object, visible] of restore) object.set("visible", visible);
      canvas.renderAll();

      // **The photograph itself, with no product code in the path.** The band
      // is a rectangle in artboard units and `object-fit: cover` puts the
      // whole file over the artboard, so the band's source rectangle is its
      // own scene fraction of the file. Read at this mount's own column
      // count, because the count is what decides how much of the file each
      // column averages.
      const photo = (() => {
        const image = document.querySelector<HTMLImageElement>(
          "[data-vigilia-background-media] img",
        );
        if (image === null || !image.complete || image.naturalWidth === 0) {
          return null;
        }
        const artboardWidth = 1672;
        const artboardHeight = 941;
        const u0 = (cardBox.left + box.left) / artboardWidth;
        const u1 = (cardBox.left + box.left + box.width) / artboardWidth;
        const v0 = (cardBox.top + box.top) / artboardHeight;
        const v1 = (cardBox.top + box.top + box.height) / artboardHeight;
        const columns = width;
        const rows = Math.max(
          2,
          Math.round(
            (columns * (v1 - v0) * artboardHeight) /
              ((u1 - u0) * artboardWidth),
          ),
        );
        const probe = document.createElement("canvas");
        probe.width = columns;
        probe.height = rows;
        const context = probe.getContext("2d");
        if (context === null) return null;
        context.drawImage(
          image,
          u0 * image.naturalWidth,
          v0 * image.naturalHeight,
          (u1 - u0) * image.naturalWidth,
          (v1 - v0) * image.naturalHeight,
          0,
          0,
          columns,
          rows,
        );
        const data = context.getImageData(0, 0, columns, rows).data;
        const means = new Array<number>(columns).fill(0);
        for (let y = 0; y < rows; y += 1)
          for (let x = 0; x < columns; x += 1) {
            const i = (y * columns + x) * 4;
            means[x]! +=
              0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
          }
        for (let x = 0; x < columns; x += 1) means[x]! /= rows;
        let peak = 0;
        for (let x = 1; x < width; x += 1)
          peak = Math.max(peak, Math.abs(means[x]! - means[x - 1]!));
        return {
          columns,
          peak: Math.round(peak * 100) / 100,
          contrast:
            Math.round((Math.max(...means) - Math.min(...means)) * 100) / 100,
          meanLuma:
            Math.round((means.reduce((a, b) => a + b, 0) / columns) * 100) /
            100,
        };
      })();
      return { blurred, sharp, clearBlurred, clearSharp, photo };
    },
    [id, inset] as const,
  );
}

function panelBand(
  page: Page,
  id: string,
  blurRadius?: number,
): Promise<{ peak: number; contrast: number; width: number; height: number }> {
  return page.evaluate(
    ([objectId, radius]) => {
      type Obj = {
        get(n: string): unknown;
        set(n: string, v: unknown): void;
        getObjects?(): Obj[];
        calcTransformMatrix(): number[];
      };
      const canvas = (
        window as unknown as {
          vigilia?: {
            handle: {
              canvas: {
                getObjects(): Obj[];
                viewportTransform: number[];
                lowerCanvasEl: HTMLCanvasElement;
                renderAll(): void;
                getRetinaScaling(): number;
              };
            };
          };
        }
      ).vigilia?.handle.canvas;
      if (canvas === undefined) throw new Error("the player has not mounted");
      // Groups walked: the panel this measures may be a group child, which is
      // the whole point of the grouped case.
      const find = (objects: Obj[]): Obj | undefined => {
        for (const candidate of objects) {
          if (candidate.get("id") === objectId) return candidate;
          const child = find(candidate.getObjects?.() ?? []);
          if (child !== undefined) return child;
        }
        return undefined;
      };
      const object = find(canvas.getObjects());
      if (object === undefined) throw new Error(`no object ${objectId}`);
      if (typeof radius === "number")
        object.set("vigiliaGlass", { blurRadius: radius });
      const vp = canvas.viewportTransform;
      const retina = canvas.getRetinaScaling();
      // Local (centre-origin) -> scene -> device, in that order, which is the
      // composition `sampleRegion` uses for the region it copies. Folding the
      // viewport into the local step instead puts the band at a different
      // address from the one the panel sampled, and the measurement then reads
      // empty canvas. `calcTransformMatrix` already carries group ancestry, so
      // a turned or grouped child needs no special case here.
      const m = object.calcTransformMatrix();
      const toDevice = (x: number, y: number): readonly [number, number] => {
        const sceneX = m[0]! * x + m[2]! * y + m[4]!;
        const sceneY = m[1]! * x + m[3]! * y + m[5]!;
        return [
          (vp[0]! * sceneX + vp[2]! * sceneY + vp[4]!) * retina,
          (vp[1]! * sceneX + vp[3]! * sceneY + vp[5]!) * retina,
        ];
      };
      const halfWidth = Number(
        (object as unknown as Record<string, unknown>)["width"],
      );
      const halfHeight = Number(
        (object as unknown as Record<string, unknown>)["height"],
      );
      // The panel's own untransformed corners, exactly the box `localPath`
      // clips to inside `glass.ts`.
      const corners = [
        [-halfWidth / 2, -halfHeight / 2],
        [halfWidth / 2, -halfHeight / 2],
        [halfWidth / 2, halfHeight / 2],
        [-halfWidth / 2, halfHeight / 2],
      ].map(([x, y]) => toDevice(x!, y!));
      const xs = corners.map((point) => point[0]);
      const ys = corners.map((point) => point[1]);
      const rawLeft = Math.min(...xs);
      const rawTop = Math.min(...ys);
      const rawRight = Math.max(...xs);
      const rawBottom = Math.max(...ys);
      // A quarter of the shorter side in, so the band is inside the panel even
      // turned 30°; the rounded corners are further out still.
      const inset = Math.round(
        Math.min(rawRight - rawLeft, rawBottom - rawTop) / 4,
      );
      const left = Math.max(0, Math.round(rawLeft) + inset);
      const top = Math.max(0, Math.round(rawTop) + inset);
      const width = Math.max(
        1,
        Math.min(canvas.lowerCanvasEl.width, Math.round(rawRight) - inset) -
          left,
      );
      const height = Math.max(
        1,
        Math.min(canvas.lowerCanvasEl.height, Math.round(rawBottom) - inset) -
          top,
      );
      canvas.renderAll();
      const data = canvas.lowerCanvasEl
        .getContext("2d")!
        .getImageData(left, top, width, height).data;
      const means = new Array<number>(width).fill(0);
      for (let y = 0; y < height; y += 1)
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          means[x] +=
            0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
        }
      for (let x = 0; x < width; x += 1) means[x]! /= height;
      let peak = 0;
      for (let x = 1; x < width; x += 1)
        peak = Math.max(peak, Math.abs(means[x]! - means[x - 1]!));
      return {
        peak: Math.round(peak * 100) / 100,
        contrast:
          Math.round((Math.max(...means) - Math.min(...means)) * 100) / 100,
        width,
        height,
      };
    },
    [id, blurRadius] as const,
  );
}

test.describe("the real player at the sizes and shapes it is read at", () => {
  test("renders the reference composition at a fitted viewport and a second device pixel ratio", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "the reference composition is a desktop read",
    );
    test.slow();

    // **The claim is pixels at two sizes the mount had never been read at.**
    // The reference capture ran at 1672x941 and nothing else, so a fitted view
    // and a retina view were both unmeasured on the player's own canvas.
    await saveStarterThroughTheHost(page);

    /**
     * A ring that drew its arc, a bar that drew its fill, and a text run that
     * drew its glyphs — read as fractions of their own areas, so one floor
     * holds at whatever render scale the mount resolved.
     *
     * The gauge floor is the arc-less baseline of the reference measurement
     * rescaled: `ram-gauge` read 219 coloured pixels with no arc and 553 with
     * a datum of 0, on 436x436, and both scale with the chart's own area. 0.2 %
     * of the area sits 1.7x above the first and 1.4x below the second, so an
     * arc that vanished fails and a legitimately empty gauge still passes.
     */
    const readTheDisplay = async (
      where: string,
    ): Promise<{
      surface: Awaited<ReturnType<typeof playerSurface>>;
      arcs: Record<string, number>;
      barInk: number;
      barChroma: number;
      wordmark: Awaited<ReturnType<typeof glyphCoverage>>;
    }> => {
      await openStarterDisplay(page, "&data=live");
      await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
      await expect(page.locator("[data-vigilia-load-failure]")).toHaveCount(0);
      // A gauge with no reading has no datum, and a datum is what the arc is
      // made of; the reading is read before the ring is counted.
      await expect
        .poll(() => canvasProp(page, "ram-value", "text"), { timeout: 30_000 })
        .toMatch(/^\d+%$/);
      const surface = await playerSurface(page);
      const charts = await chartPixels(page);
      const ratio = (id: string, field: "chroma" | "ink"): number => {
        const chart = charts.find((candidate) => candidate.id === id);
        expect(chart, `${id} is on the display at ${where}`).toBeDefined();
        return chart![field] / (chart!.w * chart!.h);
      };
      return {
        surface,
        arcs: {
          "ram-gauge": ratio("ram-gauge", "chroma"),
          "vram-gauge": ratio("vram-gauge", "chroma"),
        },
        barInk: ratio("storage-bar", "ink"),
        barChroma: ratio("storage-bar", "chroma"),
        wordmark: await glyphCoverage(page, "wordmark"),
      };
    };

    // **A fitted viewport**, letterboxed on the horizontal axis, and not 1:1.
    await page.setViewportSize({ width: 1600, height: 760 });
    const fitted = await readTheDisplay("1600x760 @1x");
    expectContainFit(fitted.surface, { width: 1600, height: 760 });
    expect(fitted.surface.dpr, "the first read is at one device pixel").toBe(1);
    for (const [id, share] of Object.entries(fitted.arcs))
      expect(share, `${id} draws its arc at a fitted viewport`).toBeGreaterThan(
        0.002,
      );
    expect(
      fitted.barInk,
      "the storage bar has fill at a fitted viewport",
    ).toBeGreaterThan(0.01);
    expect(
      fitted.barChroma,
      "the storage bar's fill is coloured, not a grey track",
    ).toBeGreaterThan(0.005);
    expect(
      fitted.wordmark.covered / fitted.wordmark.area,
      "the wordmark draws glyphs at a fitted viewport",
    ).toBeGreaterThan(0.02);

    // **A second device pixel ratio**, through the browser's own emulation, and
    // a different viewport so the fit is re-derived rather than remembered.
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: 1180,
      height: 820,
      deviceScaleFactor: 2,
      mobile: false,
    });
    const retina = await readTheDisplay("1180x820 @2x");
    expectContainFit(retina.surface, { width: 1180, height: 820 });
    expect(
      retina.surface.dpr,
      "the browser really is at two device pixels",
    ).toBe(2);
    // The backing store followed the ratio, which is what makes the render at
    // this DPR a different picture and not the same one labelled differently.
    expect(
      retina.surface.backingWidth / retina.surface.cssWidth,
      "the artboard canvas is allocated at two device pixels per CSS pixel",
    ).toBeCloseTo(2, 1);
    for (const [id, share] of Object.entries(retina.arcs))
      expect(share, `${id} draws its arc at two device pixels`).toBeGreaterThan(
        0.002,
      );
    expect(
      retina.barInk,
      "the storage bar has fill at two device pixels",
    ).toBeGreaterThan(0.01);
    expect(
      retina.barChroma,
      "the bar's fill stays coloured at two device pixels",
    ).toBeGreaterThan(0.005);
    expect(
      retina.wordmark.covered / retina.wordmark.area,
      "the wordmark draws glyphs at two device pixels",
    ).toBeGreaterThan(0.02);
    await session.send("Emulation.clearDeviceMetricsOverride");
  });

  test("composites glass under a group, a rotation and an intersection on the real player", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "the grouped composition is a desktop read",
    );

    await page.setViewportSize({ width: 1280, height: 960 });
    await page.goto(`${HOST}/?theme=${HOST_GROUPED_THEME_ID}`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
    await expect(page.locator("[data-vigilia-load-failure]")).toHaveCount(0);

    // **The composition is the one the fixture claims.** A panel that revived
    // somewhere else would still produce a plausible band, so the shapes are
    // read back before any pixel is counted.
    const shape = await page.evaluate(
      ([groupId]) => {
        type Obj = {
          get(n: string): unknown;
          getObjects?(): Obj[];
          getBoundingRect(): {
            left: number;
            top: number;
            width: number;
            height: number;
          };
          objectCaching: boolean;
          angle: number;
        };
        const canvas = (
          window as unknown as {
            vigilia?: { handle: { canvas: { getObjects(): Obj[] } } };
          }
        ).vigilia?.handle.canvas;
        const found: Record<
          string,
          { left: number; right: number; top: number; angle: number }
        > = {};
        const walk = (objects: Obj[] | undefined): void => {
          for (const object of objects ?? []) {
            const id = object.get("id");
            if (typeof id === "string") {
              const box = object.getBoundingRect();
              found[id] = {
                left: Math.round(box.left),
                right: Math.round(box.left + box.width),
                top: Math.round(box.top),
                angle: Number(object.angle ?? 0),
              };
            }
            walk(object.getObjects?.());
          }
        };
        walk(canvas?.getObjects());
        const group = canvas
          ?.getObjects()
          .find((object) => object.get("id") === groupId);
        return {
          found,
          groupAngle: Number(group?.angle ?? 0),
          groupCaching: group?.objectCaching ?? null,
        };
      },
      [GROUPED_GROUP_ID] as const,
    );

    // The rotation is on the group, so the treated child's own angle is 0 and
    // the turn comes from its ancestry — which is the case the glass handle's
    // ancestor walk exists for.
    expect(shape.groupAngle, "the fixture's group is turned").toBe(
      GROUPED_GROUP_ANGLE,
    );
    expect(
      shape.found[GROUPED_PANEL_IDS.grouped]?.angle,
      "the turn is the group's, not the child's",
    ).toBe(0);
    // An upright 200x140 child is 200x140; turned 20° with its group its
    // bounding box is 236x200. If the group had not taken, the rotation this
    // test claims to cover would quietly be a flat panel.
    expect(
      (shape.found[GROUPED_PANEL_IDS.grouped]?.right ?? 0) -
        (shape.found[GROUPED_PANEL_IDS.grouped]?.left ?? 0),
      "the grouped panel is really turned on the display",
    ).toBeGreaterThan(220);
    // Fabric 7 leaves a group's caching off, so the guard in `glass.ts` is a
    // backstop rather than the normal path. Recorded, not required.
    expect(shape.groupCaching, "the mounted group does not cache").toBe(false);

    const under = shape.found[GROUPED_PANEL_IDS.overlapUnder];
    const over = shape.found[GROUPED_PANEL_IDS.overlapOver];
    expect(
      over?.left ?? 0,
      "the two panels intersect rather than merely sitting near each other",
    ).toBeLessThan(under?.right ?? 0);

    /** A panel whose blur is real, and the same panel with the blur off. */
    for (const id of [
      GROUPED_PANEL_IDS.grouped,
      GROUPED_PANEL_IDS.flat,
      GROUPED_PANEL_IDS.overlapUnder,
      GROUPED_PANEL_IDS.overlapOver,
    ]) {
      const blurred = await panelBand(page, id);
      const control = await panelBand(page, id, 0);
      // Back to the authored radius, so the next panel is not measured through
      // the previous one's control.
      await panelBand(page, id, 16);
      expect(blurred.height, `${id} is big enough to measure`).toBeGreaterThan(
        8,
      );
      // The backdrop reaches the panel at all: a flat wash would have neither
      // detail nor a step to soften.
      expect(
        control.contrast,
        `${id} has backdrop detail behind it`,
      ).toBeGreaterThan(8);
      expect(
        control.peak,
        `${id}'s unblurred backdrop is a real edge`,
      ).toBeGreaterThan(40);
      expect(
        blurred.peak,
        `${id} softens the backdrop it samples`,
      ).toBeLessThan(control.peak * 0.5);
      // And the detail survives the blur, so this is not a flat tint either.
      expect(
        blurred.contrast,
        `${id} still carries the backdrop after blurring`,
      ).toBeGreaterThan(8);
    }

    // **The panel behind the intersection is still compositing**, not covered.
    const behind = await panelBand(page, GROUPED_PANEL_IDS.overlapUnder);
    expect(
      behind.peak,
      "the panel under the intersection still composites",
    ).toBeLessThan(40);

    // **The ancestor-group guard, forced.** Fabric 7 leaves a group's
    // `objectCaching` false, so the guard is a backstop rather than the normal
    // path; turning caching on is what reaches it, and the panel must then
    // report and leave its backdrop alone rather than sample its own cache.
    // The player reports a skipped panel to the console, not to the DOM.
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    expect(
      await setGroupCaching(page, true),
      "the control really did turn the group's caching on",
    ).toBe(true);
    const cached = await panelBand(page, GROUPED_PANEL_IDS.grouped);
    expect(
      cached.peak,
      "a cached ancestor stops the panel from sampling its own cache",
    ).toBeGreaterThan(40);
    await expect
      .poll(
        () => warnings.some((text) => text.includes("caches its children")),
        { timeout: 5_000 },
      )
      .toBe(true);

    // Back to the authored state, and the real claim re-measured last so the
    // test ends on the product's behaviour rather than on its control.
    await setGroupCaching(page, false);
    const restored = await panelBand(page, GROUPED_PANEL_IDS.grouped);
    expect(
      restored.peak,
      "the grouped panel composites once its group caches again",
    ).toBeLessThan(40);
  });
});

/** The fixture's group's own caching, read back after the repaint that used it. */
function setGroupCaching(page: Page, caching: boolean): Promise<boolean> {
  return page.evaluate(
    ([groupId, on]) => {
      type Obj = { get(n: string): unknown; objectCaching: boolean };
      const canvas = (
        window as unknown as {
          vigilia?: {
            handle: {
              canvas: {
                getObjects(): Obj[];
                lowerCanvasEl: HTMLCanvasElement;
                renderAll(): void;
              };
            };
          };
        }
      ).vigilia?.handle.canvas;
      const group = canvas
        ?.getObjects()
        .find((object) => object.get("id") === groupId);
      if (group === undefined) throw new Error("the fixture lost its group");
      group.objectCaching = on as boolean;
      canvas!.renderAll();
      return group.objectCaching;
    },
    [GROUPED_GROUP_ID, caching] as const,
  );
}

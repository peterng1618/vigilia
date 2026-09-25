import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
import { readThemePackage, writeThemePackage } from "@vigilia/theme-package";
import { strToU8, zipSync } from "fflate";

const EDITOR = "http://127.0.0.1:4174/";

type ArtboardRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** The artboard's rect, CANVAS-element relative — `artboardScreenRect()` reads
 * `viewportTransform`, whose `e`/`f` are offsets inside the canvas element, not
 * in the page. So this is deliberately not client space: the helper below adds
 * the canvas box once. The canvas is host-sized and the artboard is
 * contain-fitted inside it, so the canvas box is NOT the artboard's rendered
 * extent — `rect.height` is `720 * zoom`, not the canvas height, and the rect
 * carries the `ty` the old box-relative maths dropped. */
async function artboardRect(page: Page): Promise<ArtboardRect> {
  return page.evaluate(() =>
    (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: { viewport: { artboardScreenRect(): ArtboardRect } };
        };
      }
    ).vigiliaEditorBridge.editor.viewport.artboardScreenRect(),
  );
}

/** A scene point in CLIENT coordinates. `sceneWidth` is the fixture's artboard
 * width; the scale is uniform, so one axis suffices. The canvas box offset is
 * this helper's whole reason to exist: without it every returned point is a
 * canvas-space coordinate used as a page coordinate, landing ~357px left and
 * ~72px above the intended object — off the canvas, where a drag selects
 * nothing and the test passes without exercising anything. */
async function sceneToClient(
  page: Page,
  sceneWidth: number,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const rect = await artboardRect(page);
  const box = (await page
    .locator("#vigilia-fabric-editor canvas.upper-canvas")
    .boundingBox())!;
  const scale = rect.width / sceneWidth;
  return { x: box.x + rect.left + x * scale, y: box.y + rect.top + y * scale };
}

/** The client point at an object's centre, by id. Reads the object's own
 * geometry through the bridge rather than restating fixture coordinates, so a
 * fixture tweak cannot leave this test dragging at a stale point.
 *
 * Use `getCenterPoint()`, NOT `left + getScaledWidth() / 2`. The manual form
 * silently assumes the origin is `left`/`top`, which is false here: the starter
 * scene's `chart()` helper sets `originX: "center"` / `originY: "center"`, so
 * the manual form aims at the shape's bottom-right corner instead of its
 * centre. `getCenterPoint()` converts from whatever origin the object has. */
async function clientOfScene(
  page: Page,
  id: string,
  sceneWidth = 1280,
): Promise<{ x: number; y: number }> {
  const centre = await page.evaluate((objectId) => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: {
            canvas: {
              getObjects(): Array<{
                id?: string;
                getCenterPoint(): { x: number; y: number };
              }>;
            };
          };
        };
      }
    ).vigiliaEditorBridge;
    const object = bridge.editor.canvas
      .getObjects()
      .find((candidate) => candidate.id === objectId);
    if (object === undefined) throw new Error(`no object with id ${objectId}`);
    const point = object.getCenterPoint();
    return { x: point.x, y: point.y };
  }, id);
  return sceneToClient(page, sceneWidth, centre.x, centre.y);
}

test.describe("Fabric editor route", () => {
  test("mounts the adopted editor shell on the editor stage", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);

    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await expect(page.locator("#status")).toHaveText("Fabric editor ready");
  });

  test("switches chart refresh between 30 and 1 FPS", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    // The View menu owns chart refresh; the panel select is gone.
    await page.getByRole("button", { name: "View", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: /Chart refresh: 30 FPS/ }).first(),
    ).toBeVisible();
    await page
      .getByRole("menuitem", { name: /Chart refresh: 30 FPS/ })
      .first()
      .click();
    await page.getByRole("button", { name: "View", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: /Chart refresh: 1 FPS/ }).first(),
    ).toBeVisible();
  });

  test("creates and saves text with derived v2 references", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await openRailPane(page, "Add");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Text" })
      .click();

    const envelope = (await saveEnvelope(page)) as {
      scene: {
        objects: Array<{
          vigiliaPaint?: { fill?: string };
          vigiliaText?: {
            runs: Array<{
              text?: string;
              typePreset?: string;
              style?: { color?: { ref?: string } };
            }>;
          };
        }>;
      };
    };
    const text = envelope.scene.objects.find(
      (object) => object.vigiliaText?.runs[0]?.text === "New text",
    );
    // New content takes a token named for content, not the palette's first
    // entry, which is the artboard background and would paint the text
    // invisible.
    expect(text).toMatchObject({
      vigiliaPaint: { fill: "palette.text" },
      vigiliaText: {
        runs: [
          {
            // A body-role preset, not the first (a caption too small to
            // inspect comfortably).
            typePreset: "typePresets.17-500",
            style: { color: { ref: "palette.text" } },
          },
        ],
      },
    });
  });

  test("creates a chart with palette-backed settings that save and reopen", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await openRailPane(page, "Add");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Gauge" })
      .click();
    await openInspectorTab(page, "Data");
    await expect(
      page.locator('[data-vigilia-chart-setting="thickness"]'),
    ).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-chart-creation");

    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    const chart = saved.parsed.envelope.scene.objects
      .filter((object) => object["type"] === "VigiliaChart")
      .at(-1);
    // A chart takes a content token for its data and a surface token for its
    // track; one token cannot serve both.
    expect(chart).toMatchObject({
      family: "gauge",
      settings: {
        track: { ref: "palette.background" },
        progress: { ref: "palette.text" },
      },
    });
    expect(chart).not.toHaveProperty("option");

    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "created-chart.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened created-chart.vigilia-theme",
    );
  });

  test("captures the mounted editor for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await captureVisualReview(page, testInfo, "editor");
  });

  test("suppresses motion when the user asks for reduced motion", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(EDITOR);
    const duration = await page
      .locator(".editor-shell-panel")
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe("0s");

    // The media block suppresses transitions as well as animations, so read a
    // control too: the animation assertion alone cannot see that half.
    const controlTransition = await page
      .locator(".editor-shell button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(controlTransition).toBe("0s");

    // With the guard absent the reveal must be a real animation. Duration alone
    // stays 0.16s when the @keyframes block is deleted, so read the effect.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const reveal = await page.locator(".editor-shell-panel").evaluate((el) => {
      // The reveal runs once on mount and leaves getAnimations() when it ends,
      // so restart it before sampling.
      el.style.animation = "none";
      el.getBoundingClientRect();
      el.style.animation = "";
      const effect = el.getAnimations()[0]?.effect;
      return {
        duration: getComputedStyle(el).animationDuration,
        keyframes:
          effect instanceof KeyframeEffect ? effect.getKeyframes().length : 0,
      };
    });
    expect(reveal.duration).not.toBe("0s");
    expect(reveal.keyframes).toBeGreaterThanOrEqual(2);

    // The suppression assertion above reads 0s whether or not the shorthand
    // exists, so pin the shorthand itself: five compositor-owned properties,
    // never a layout one.
    const motion = await page
      .locator(".editor-shell button")
      .first()
      .evaluate((el) => ({
        properties: getComputedStyle(el).transitionProperty,
        duration: getComputedStyle(el).transitionDuration,
      }));
    expect(motion.properties).toBe(
      "background-color, border-color, color, transform, opacity",
    );
    expect(motion.duration).toBe("0.14s, 0.14s, 0.14s, 0.14s, 0.14s");

    const injectedTransition = (locator: Locator) =>
      locator.evaluate((el) => {
        el.style.transition = "opacity 200ms ease";
        return getComputedStyle(el).transitionDuration;
      });

    // Base UI portals the popup to `body`, where `.editor-shell *` cannot reach
    // it, so the media block names the popup's own class. Without the injection
    // this reads 0s either way and would pass with that selector deleted; with
    // it, only the media block can produce the 0s below.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "View", exact: true }).click();
    // The zoom readout's popup stays mounted (`keepMounted`), so two popups are
    // in the DOM; only the open View menu's is visible.
    const popup = page.locator(".editor-shell-menu-popup:visible");
    await expect(popup).toBeVisible();
    // Anchored to the View popup's own item, not merely to "a visible popup": the
    // zoom menu also satisfies `:visible`, so a popup-agnostic locator would let
    // the positive control pass while measuring the wrong menu.
    await expect(
      popup.getByRole("menuitem", { name: /Value runs/ }),
    ).toBeVisible();
    await expect.poll(() => injectedTransition(popup)).toBe("0.2s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => injectedTransition(popup)).toBe("0s");

    // The menu item is the element a hover transition would land on, and it is
    // outside `.editor-shell`, so the in-shell shorthand
    // `.editor-shell [role="menuitem"]` cannot reach it — the popup's own `*`
    // line is its only suppression. Without this assertion, adding a transition
    // to a menu row and deleting the `*` lines leaves the suite green under
    // `reduce`.
    const menuItem = popup.getByRole("menuitem", { name: /Value runs/ });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(() => injectedTransition(menuItem)).toBe("0.2s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => injectedTransition(menuItem)).toBe("0s");

    // The positioner is a separate portalled element, styled in its own right
    // (`z-index: 60`), and it is NOT covered by the popup's selectors — the popup
    // nests inside it, not the reverse. A popup-position animation lands here.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const positioner = page.locator(".editor-shell-positioner:visible");
    await expect(positioner).toBeVisible();
    await expect.poll(() => injectedTransition(positioner)).toBe("0.2s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => injectedTransition(positioner)).toBe("0s");

    // The dock tooltip is portalled under its own class, and its positioner carries
    // no class at all — so `.editor-shell-tooltip` is the whole of its coverage. The
    // dock renders no triggers until something is selected.
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await selectStarterChart(page);
    const dock = page.locator('[aria-label="Selected object actions"]');
    await dock.getByRole("button", { name: "Duplicate" }).hover();
    const tooltip = page.locator(".editor-shell-tooltip");
    await expect(tooltip).toBeVisible();
    await expect.poll(() => injectedTransition(tooltip)).toBe("0.2s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => injectedTransition(tooltip)).toBe("0s");
  });

  test("captures selected chart binding controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page
      .locator('[data-vigilia-binding="cpu-load"]')
      .selectOption("ram.used");
    const precision = page.locator(
      '[data-vigilia-binding-field="cpu-load.precision"]',
    );
    await precision.fill("2");
    await precision.press("Tab");
    await expect(precision).toHaveValue("2");
    const progressPaint = page.locator('[data-vigilia-chart-paint="progress"]');
    await progressPaint.scrollIntoViewIfNeeded();
    await expect(progressPaint).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-chart-binding");
  });

  test("captures the controls that give a text run its reading", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    // The starter theme's clock is authored as a value run, so selecting it
    // shows what an author chooses to read and how it should read.
    await page.locator('[data-vigilia-layer="time"]').click();
    const source = page.locator('[data-vigilia-run-source="0"]');
    await expect(source).toBeVisible();
    await expect(source).toHaveValue("time.now");
    const format = page.locator('[data-vigilia-run-format="0"]');
    await expect(format).toBeVisible();
    // The starter clock's own tokens, so the reading below is one this test can
    // compute rather than one it wrote.
    await expect(format).toHaveValue("hh:mm");

    // A clock pinned to another city is the point of a world clock, so the zone
    // has to change the reading rather than only the envelope: the control is
    // rebuilt from what was written, and the preview follows it.
    const zone = page.locator('[data-vigilia-run-zone="0"]');
    await expect(zone).toHaveValue("");
    await zone.selectOption("Asia/Tokyo");
    await expect(zone).toHaveValue("Asia/Tokyo");
    await expect
      .poll(
        async () => {
          const shown = (
            await page
              .locator('[data-vigilia-run-format-preview="0"]')
              .textContent()
          )?.trim();
          const tokyo = await page.evaluate(() => {
            const parts = new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Tokyo",
              hour12: true,
              hour: "2-digit",
              minute: "2-digit",
            }).formatToParts(new Date());
            const part = (type: string): string =>
              parts.find((entry) => entry.type === type)?.value ?? "";
            return `${part("hour")}:${part("minute")}`;
          });
          return shown === tokyo;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    await zone.scrollIntoViewIfNeeded();

    await captureVisualReview(page, testInfo, "editor-text-reads");
  });

  test("captures semantic layer controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const layer = page.locator('[data-vigilia-layer="load-gauge"]');
    await expect(layer).toBeVisible();
    await layer.click();
    await expect(layer).toHaveAttribute("aria-selected", "true");
    // One dense line per layer: the state icons, not the old six text buttons.
    await expect(layer.locator("button")).toHaveCount(2);
    await expect(layer.locator('[aria-label="Hide"]')).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-layer-arrange");
  });

  test("captures changed artboard controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-artboard-fit-mode]")
      .selectOption("cover");
    await page.locator("[data-vigilia-artboard-width]").fill("1000");
    await page.locator("[data-vigilia-artboard-width]").press("Tab");
    await page
      .locator("[data-vigilia-artboard-background]")
      .selectOption("palette.bars");
    await expect(page.locator("[data-vigilia-artboard-fit-mode]")).toHaveValue(
      "cover",
    );
    await expect(
      page.locator("[data-vigilia-artboard-background]"),
    ).toHaveValue("palette.bars");

    await captureVisualReview(page, testInfo, "editor-artboard");
  });

  test("rejects literal artboard paint in a v2 document", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setUncheckedThemePackage(page, "literal-bars.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "literal-bars",
      artboard: {
        width: 1000,
        height: 720,
        background: { value: "#101216" },
        barColor: { value: "#e20074" },
      },
      scene: { version: "7.4.0", objects: [] },
    });
    await expect(page.locator("#status")).toContainText("Could not open");
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
  });

  test("renders palette gradients on the native Fabric artboard", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setThemePackage(page, "gradient-artboard.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "gradient-artboard",
      artboard: {
        width: 1000,
        height: 720,
        background: { ref: "palette.background" },
        barColor: { ref: "palette.bars" },
      },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          background: {
            name: "Background",
            value: {
              kind: "gradient",
              angle: 0,
              stops: [
                { offset: 0, color: "#102030" },
                { offset: 1, color: "#d0e0f0" },
              ],
            },
          },
          bars: {
            name: "Bars",
            value: {
              kind: "gradient",
              angle: 90,
              stops: [
                { offset: 0, color: "#001122" },
                { offset: 1, color: "#334455" },
              ],
            },
          },
        },
      },
      scene: { version: "7.4.0", objects: [] },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened gradient-artboard.vigilia-theme",
    );
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-artboard-gradient");
  });

  test("edits an artboard palette token through the property surface", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-palette-token]")
      .selectOption("background");
    const color = page.locator("[data-vigilia-palette-color]");
    await color.fill("rgb(16 32 48)");
    await color.press("Tab");
    await expect(color).toHaveValue("rgb(16 32 48)");

    const envelope = (await saveEnvelope(page)) as {
      globals: { palette: { background: { value: unknown } } };
    };
    expect(envelope.globals.palette.background.value).toEqual({
      kind: "solid",
      color: "rgb(16 32 48)",
    });

    await captureVisualReview(page, testInfo, "editor-palette-solid");
  });

  test("reassigns palette references before deleting a token", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-palette-token]")
      .selectOption("background");
    await page
      .locator("[data-vigilia-palette-replacement]")
      .selectOption("bars");
    await captureVisualReview(page, testInfo, "editor-palette-reassignment");
    await page.locator("[data-vigilia-palette-delete]").click();
    await expect(
      page.locator('[data-vigilia-palette-token] option[value="background"]'),
    ).toHaveCount(0);

    const envelope = (await saveEnvelope(page)) as {
      artboard: { background?: { ref: string } };
      globals: { palette: Record<string, unknown> };
    };
    expect(envelope.artboard.background).toEqual({ ref: "palette.bars" });
    expect(envelope.globals.palette.background).toBeUndefined();
  });

  test("reassigns chart paint before deleting its palette token", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-palette-token]")
      .selectOption("chartTrack");
    await page
      .locator("[data-vigilia-palette-replacement]")
      .selectOption("bars");
    await page.locator("[data-vigilia-palette-delete]").click();

    const envelope = (await saveEnvelope(page)) as {
      globals: { palette: Record<string, unknown> };
      scene: {
        objects: Array<{
          id?: string;
          settings?: { track?: { ref?: string } };
        }>;
      };
    };
    expect(envelope.globals.palette.chartTrack).toBeUndefined();
    expect(
      envelope.scene.objects.find((object) => object.id === "load-gauge")
        ?.settings?.track,
    ).toEqual({ ref: "palette.bars" });
  });

  test("edits a global type preset through the property surface", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.route("https://cdn.jsdelivr.net/fontsource/fonts/**", (route) =>
      route.fulfill({ body: Buffer.from([0, 1, 2]) }),
    );
    await page.locator("[data-vigilia-type-preset]").selectOption("32-500");
    await page.locator("[data-vigilia-font-face]").selectOption("inter-700");
    await page.locator("[data-vigilia-font-apply]").click();
    const size = page.locator("[data-vigilia-type-size]");
    await size.fill("34");
    await size.press("Tab");
    await expect(size).toHaveValue("34");
    const letterSpacing = page.locator("[data-vigilia-type-letter-spacing]");
    await letterSpacing.fill("0.25");
    await letterSpacing.press("Tab");

    const saved = await savePackage(page);
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "type-preset.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened type-preset.vigilia-theme",
    );
    await page.locator("[data-vigilia-type-preset]").selectOption("32-500");
    const reopened = (await saveEnvelope(page)) as {
      globals: {
        typePresets: {
          "32-500": {
            value: {
              size: number;
              letterSpacing: number;
              face: { assetId: string };
              trioRole: string;
            };
          };
        };
      };
    };
    expect(reopened.globals.typePresets["32-500"].value).toMatchObject({
      size: 34,
      letterSpacing: 0.25,
      face: { assetId: "inter-700" },
      trioRole: "heading",
    });
    await page
      .locator("[data-vigilia-type-letter-spacing]")
      .scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-type-preset");
  });

  test("captures curated font trio controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.locator("[data-vigilia-type-preset]").selectOption("32-500");
    const face = page.locator("[data-vigilia-font-face]");
    await face.scrollIntoViewIfNeeded();
    await expect(face).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apply trio" }),
    ).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-font-trio");
  });

  test("reassigns text type presets before deleting one", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.locator("[data-vigilia-type-preset]").selectOption("11-400");
    await page
      .locator("[data-vigilia-type-replacement]")
      .selectOption("11-500");
    await page.locator("[data-vigilia-type-delete]").scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-type-reassignment");
    await page.locator("[data-vigilia-type-delete]").click();
    await expect(
      page.locator('[data-vigilia-type-preset] option[value="11-400"]'),
    ).toHaveCount(0);

    const envelope = (await saveEnvelope(page)) as {
      globals: { typePresets: Record<string, unknown> };
      scene: {
        objects: Array<{
          id?: string;
          vigiliaText?: { runs: Array<{ typePreset?: string }> };
        }>;
      };
    };
    expect(envelope.globals.typePresets["11-400"]).toBeUndefined();
    expect(
      envelope.scene.objects.find((object) => object.id === "trend-legend")
        ?.vigiliaText?.runs[0]?.typePreset,
    ).toBe("typePresets.11-500");
  });

  test("captures dirty document replacement confirmation for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.evaluate(() => {
      const editor = Object.entries(
        window as unknown as Record<string, unknown>,
      ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
        | {
            canvas: {
              item(
                index: number,
              ): { set(key: string, value: number): void } | undefined;
              requestRenderAll(): void;
            };
          }
        | undefined;
      editor?.canvas.item(1)?.set("left", 64);
      editor?.canvas.requestRenderAll();
    });
    await page.keyboard.press("Control+n");
    await expect(page.locator("dialog")).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-dirty-replacement");
  });

  test("selects a chart in the starter theme through the visible Fabric canvas", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await expect(
      page.locator('[data-vigilia-chart-setting="thickness"]'),
    ).toBeVisible();
  });

  test("persists artboard properties without rescaling Fabric objects", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-artboard-fit-mode]")
      .selectOption("cover");
    await page.locator("[data-vigilia-artboard-width]").fill("1000");
    await page.locator("[data-vigilia-artboard-width]").press("Tab");
    await page
      .locator("[data-vigilia-artboard-background]")
      .selectOption("palette.bars");

    const envelope = (await saveEnvelope(page)) as {
      artboard: {
        fitMode?: string;
        width: number;
        background?: { ref: string };
      };
      scene: { objects: Array<{ id?: string; left?: number }> };
    };
    expect(envelope.artboard.fitMode).toBe("cover");
    expect(envelope.artboard.width).toBe(1000);
    expect(envelope.artboard.background).toEqual({ ref: "palette.bars" });
    expect(leftFor(envelope, "wordmark")).toBe(54);
  });

  test("shows the Style tab's resolved appearance for a selection", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setThemePackage(page, "style-tab.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "style-tab",
      artboard: {
        width: 320,
        height: 180,
        background: { ref: "palette.background" },
        barColor: { ref: "palette.none" },
      },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          background: {
            name: "Background",
            value: { kind: "solid", color: "#102030" },
          },
          ink: { name: "Ink", value: { kind: "solid", color: "#00b8d9" } },
        },
        typePresets: {
          body: { name: "Body", value: { family: "sans-serif", size: 16 } },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Textbox",
            id: "cpu-label",
            left: 20,
            top: 20,
            width: 200,
            text: "CPU",
            originX: "left",
            originY: "top",
            fill: "#00b8d9",
            vigiliaPaint: { fill: "palette.ink" },
            vigiliaText: {
              runs: [
                {
                  kind: "literal",
                  text: "CPU",
                  typePreset: "typePresets.body",
                  style: { color: { ref: "palette.ink" } },
                },
              ],
            },
          },
        ],
      },
    });

    // With nothing selected the tab lists what the document offers, which is
    // what an author needs before they have picked anything.
    await openInspectorTab(page, "Style");
    const style = page.locator('[data-vigilia-panel="style"]');
    await expect(style).toContainText("palette.ink");
    await expect(style).toContainText("#00b8d9");
    await expect(style).toContainText("Body");

    // Selecting the text replaces the document's list with its own resolution.
    // Select through the layer row: the canvas origin is not a stable coordinate
    // to click, because the stage letterboxes the artboard inside its host.
    await page.locator('[data-vigilia-layer="cpu-label"]').click();
    await openInspectorTab(page, "Style");
    await expect(style).toContainText("palette.ink");
    await expect(style).toContainText("typePresets.body");
    await expect(style.locator("[data-vigilia-globals]")).toHaveCount(0);

    await captureVisualReview(page, testInfo, "editor-style-tab");
  });

  test("persists a selected chart binding", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page
      .locator('[data-vigilia-binding="cpu-load"]')
      .selectOption("ram.used");
    const precision = page.locator(
      '[data-vigilia-binding-field="cpu-load.precision"]',
    );
    await precision.fill("2");
    await precision.press("Tab");

    const envelope = (await saveEnvelope(page)) as {
      bindings: Record<string, Array<{ id: string; semanticKey: string }>>;
    };
    expect(envelope.bindings["load-gauge"]).toContainEqual({
      id: "cpu-load",
      semanticKey: "ram.used",
      precision: 2,
    });
  });

  test("persists selected chart paint as a palette reference", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page
      .locator('[data-vigilia-chart-paint="progress"]')
      .selectOption("palette.chartTrack");

    const envelope = (await saveEnvelope(page)) as {
      scene: {
        objects: Array<{
          id?: string;
          settings?: { progress?: { ref?: string } };
        }>;
      };
    };
    expect(
      envelope.scene.objects.find((object) => object.id === "load-gauge")
        ?.settings?.progress,
    ).toEqual({ ref: "palette.chartTrack" });
  });

  test("refreshes bound text without saving its sampled value", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setThemePackage(page, "live-text.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "live-text",
      artboard: {
        width: 320,
        height: 180,
        background: { ref: "palette.background" },
        barColor: { ref: "palette.none" },
      },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          background: {
            name: "Background",
            value: { kind: "solid", color: "#102030" },
          },
          ink: { name: "Ink", value: { kind: "solid", color: "#00b8d9" } },
        },
        typePresets: {
          body: { name: "Body", value: { family: "sans-serif", size: 16 } },
        },
      },
      bindings: {
        "cpu-label": [{ id: "load", semanticKey: "cpu.load", precision: 0 }],
      },
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Textbox",
            id: "cpu-label",
            left: 20,
            top: 20,
            width: 200,
            text: "CPU --",
            originX: "left",
            originY: "top",
            fill: "#00b8d9",
            vigiliaPaint: { fill: "palette.ink" },
            vigiliaText: {
              runs: [
                {
                  kind: "literal",
                  text: "CPU ",
                  typePreset: "typePresets.body",
                  style: { color: { ref: "palette.ink" } },
                },
                {
                  kind: "value",
                  bindingId: "load",
                  typePreset: "typePresets.body",
                  style: { color: { ref: "palette.ink" } },
                },
              ],
            },
          },
        ],
      },
    });
    // Value runs read as tokens while authoring, which is the default, and
    // loading a package remounts the editor. This test is about a sampled value
    // reaching the canvas, so ask for values after the theme is loaded.
    await page.getByRole("button", { name: "View", exact: true }).click();
    await page.getByRole("menuitem", { name: /Value runs/ }).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const editor = Object.entries(
            window as unknown as Record<string, unknown>,
          ).find(
            ([key, value]) =>
              key.startsWith("vigilia-fabric-editor-") &&
              (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } })
                .canvas.upperCanvasEl?.isConnected,
          )?.[1] as
            | {
                canvas: { getObjects(): Array<{ get(name: string): unknown }> };
              }
            | undefined;
          return editor?.canvas
            .getObjects()
            .find((object) => object.get("id") === "cpu-label")
            ?.get("text");
        }),
      )
      .toMatch(/^CPU \d/);
    await expect(
      page.evaluate(() => {
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(
          ([key, value]) =>
            key.startsWith("vigilia-fabric-editor-") &&
            (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } }).canvas
              .upperCanvasEl?.isConnected,
        )?.[1] as
          | {
              canvas: { getObjects(): Array<{ get(name: string): unknown }> };
            }
          | undefined;
        const text = editor?.canvas
          .getObjects()
          .find((object) => object.get("id") === "cpu-label");
        return {
          fill: text?.get("fill"),
          height: text?.get("height"),
          opacity: text?.get("opacity"),
          styles: text?.get("styles"),
          visible: text?.get("visible"),
          width: text?.get("width"),
        };
      }),
    ).resolves.toMatchObject({
      fill: "#00b8d9",
      height: expect.any(Number),
      opacity: 1,
      styles: { 0: { 0: { fill: "#00b8d9" } } },
      visible: true,
      width: 200,
    });
    await expect(
      page.evaluate(() => {
        const coverage = [
          ...document.querySelectorAll<HTMLCanvasElement>(
            "#vigilia-fabric-editor canvas",
          ),
        ].map((canvas) => {
          const pixels = canvas
            .getContext("2d")
            ?.getImageData(0, 0, canvas.width, canvas.height).data;
          let ink = 0;
          for (
            let index = 0;
            pixels !== undefined && index < pixels.length;
            index += 4
          ) {
            if (
              pixels[index] < 32 &&
              pixels[index + 1] > 100 &&
              pixels[index + 2] > 100
            )
              ink += 1;
          }
          return `${canvas.className}:${canvas.width}x${canvas.height}; ink=${ink}`;
        });
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(
          ([key, value]) =>
            key.startsWith("vigilia-fabric-editor-") &&
            (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } }).canvas
              .upperCanvasEl?.isConnected,
        )?.[1] as
          | {
              canvas: { getObjects(): Array<{ get(name: string): unknown }> };
            }
          | undefined;
        const text = editor?.canvas
          .getObjects()
          .find((object) => object.get("id") === "cpu-label") as
          | {
              getBoundingRect(): {
                left: number;
                top: number;
                width: number;
                height: number;
              };
            }
          | undefined;
        return { coverage, bounds: text?.getBoundingRect() };
      }),
    ).resolves.toMatchObject({
      coverage: expect.arrayContaining([expect.stringMatching(/ink=[1-9]\d*/)]),
      bounds: expect.objectContaining({
        left: expect.any(Number),
        top: expect.any(Number),
      }),
    });
    await captureVisualReview(page, testInfo, "editor-live-text");

    const envelope = (await saveEnvelope(page)) as {
      scene: {
        objects: Array<{ id?: string; text?: string; vigiliaText?: unknown }>;
      };
    };
    const text = envelope.scene.objects.find(
      (object) => object.id === "cpu-label",
    );
    expect(text?.text).toBe("CPU —");
    expect(text?.vigiliaText).toEqual(
      expect.objectContaining({
        runs: expect.arrayContaining([
          expect.objectContaining({ bindingId: "load" }),
        ]),
      }),
    );
  });

  test("opens a v2 theme and keeps the active editor when its Fabric runtime is incompatible", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const envelope = {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "opened",
      artboard: { width: 320, height: 180 },
      scene: {
        version: "7.4.0",
        objects: [{ type: "Rect", id: "panel", width: 100, height: 50 }],
      },
    };

    await setThemePackage(page, "opened.vigilia-theme", envelope);
    await expect(page.locator("#status")).toHaveText(
      "Opened opened.vigilia-theme",
    );
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await setThemePackage(page, "incompatible.vigilia-theme", {
      ...envelope,
      fabricVersion: "7.5.0",
    });
    await expect(page.locator("#status")).toContainText("incompatible");
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
  });

  test("keeps a layer's display name across save and reopen", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.locator('[data-vigilia-layer="wordmark"]').click();
    await renameLayer(page, "wordmark", "Brand mark");

    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    const names = saved.parsed.envelope as {
      editorMetadata?: { layerNames?: Record<string, string> };
    };
    expect(names.editorMetadata).toEqual({
      layerNames: { wordmark: "Brand mark" },
    });

    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "renamed.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened renamed.vigilia-theme",
    );

    // The reopened document's own projection must carry the name, not just the
    // bytes: a reader that never loads the key would pass the assertion above.
    await expect
      .poll(() => layerNamesInPage(page))
      .toMatchObject({ wordmark: "Brand mark" });
  });

  test("round-trips an opened v2 Fabric scene through the save path", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const picker = page.locator('input[accept=".vigilia-theme"]');
    await setThemePackage(page, "source.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "source",
      artboard: { width: 320, height: 180 },
      scene: {
        version: "7.4.0",
        objects: [{ type: "Rect", id: "panel", width: 100, height: 50 }],
      },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened source.vigilia-theme",
    );

    const download = page.waitForEvent("download");
    await page.keyboard.press("Control+s");
    const stream = await (await download).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const saved = Buffer.concat(chunks);
    const parsed = readThemePackage(saved);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = parsed.envelope as {
      id: string;
      scene: { objects: Array<{ id?: string }> };
    };

    expect(envelope.id).toBe("source");
    expect(envelope.scene.objects).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "panel" })]),
    );

    await picker.setInputFiles({
      name: "roundtrip.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened roundtrip.vigilia-theme",
    );
  });

  test("imports and round-trips packaged images", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );
    await page.goto(EDITOR);
    await page.locator("[data-vigilia-asset-import]").setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAIklEQVQ4jWNk2HHzPwMVARM1DRs1cNTAUQNHDRw1cCgZCAC1HQK4IWYK+QAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await expect(
      page
        .locator("[data-vigilia-asset-import]")
        .locator("xpath=..")
        .locator("option"),
    ).toHaveCount(1);
    await page.locator("[data-vigilia-asset-replace]").setInputFiles({
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#00b8d9"/></svg>',
      ),
    });
    await expect(
      page
        .locator("[data-vigilia-asset-import]")
        .locator("xpath=..")
        .locator("option"),
    ).toHaveCount(2);
    await expect(
      page
        .locator("[data-vigilia-asset-import]")
        .locator("xpath=..")
        .locator("select"),
    ).toHaveValue("logo");
    await expect(assetReferences(page)).resolves.toContainEqual({
      assetId: "logo-2",
      kind: "svg",
    });
    await expect(
      page.evaluate(() => {
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(
          ([key, value]) =>
            key.startsWith("vigilia-fabric-editor-") &&
            (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } }).canvas
              .upperCanvasEl?.isConnected,
        )?.[1] as {
          canvas: {
            getActiveObject():
              | {
                  hasBorders: boolean;
                  hasControls: boolean;
                  controls: Record<string, { visible?: boolean }>;
                  get(name: string): unknown;
                  getCoords(): Array<{ x: number; y: number }>;
                }
              | undefined;
          };
        };
        const image = editor.canvas.getActiveObject();
        return image === undefined
          ? undefined
          : {
              hasBorders: image.hasBorders,
              hasControls: image.hasControls,
              format: image.get("format"),
              controls: Object.fromEntries(
                Object.entries(image.controls).map(([key, control]) => [
                  key,
                  control.visible,
                ]),
              ),
              hasSelectionGeometry: (() => {
                const [topLeft, topRight, bottomRight] = image.getCoords();
                return (
                  topLeft !== undefined &&
                  topRight !== undefined &&
                  bottomRight !== undefined &&
                  topRight.x - topLeft.x > 50 &&
                  bottomRight.y - topRight.y > 50
                );
              })(),
            };
      }),
    ).resolves.toMatchObject({
      hasBorders: true,
      hasControls: true,
      format: "png",
      controls: { tl: true, tr: true, bl: true, br: true },
      hasSelectionGeometry: true,
    });
    await openRailPane(page, "Assets");
    await page
      .getByRole("heading", { name: "Assets" })
      .scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-assets");
    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    expect(saved.parsed.assets["assets/logo.svg"]).toBeDefined();
    expect(saved.parsed.envelope.scene.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vigiliaAsset: { assetId: "logo-2", kind: "svg" },
        }),
      ]),
    );
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "assets.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened assets.vigilia-theme",
    );
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await expect(assetReferences(page)).resolves.toContainEqual({
      assetId: "logo-2",
      kind: "svg",
    });
  });

  test("authors a packaged background image through Theme settings", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );
    await page.goto(EDITOR);
    await openRailPane(page, "Assets");
    await page.locator("[data-vigilia-asset-import]").setInputFiles({
      name: "hero.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAIklEQVQ4jWNk2HHzPwMVARM1DRs1cNTAUQNHDRw1cCgZCAC1HQK4IWYK+QAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await page.locator("[data-vigilia-background-asset]").selectOption("hero");
    await page
      .locator("[data-vigilia-background-media-fit]")
      .selectOption("contain");
    await expect(page.locator("[data-vigilia-background-asset]")).toHaveValue(
      "hero",
    );
    await page
      .locator("[data-vigilia-background-asset]")
      .scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-background-media");

    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    expect(saved.parsed.envelope.artboard.backgroundMedia).toEqual({
      assetId: "hero",
      fit: "contain",
    });
    expect(saved.parsed.assets["assets/hero.png"]).toBeDefined();
  });

  test("persists an ordinary drag and restores it through undo", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setThemePackage(page, "movable.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "movable",
      artboard: { width: 320, height: 180 },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          accent: {
            name: "Accent",
            value: { kind: "solid", color: "#00b8d9" },
          },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Rect",
            id: "panel",
            left: 40,
            top: 50,
            width: 60,
            height: 40,
            scaleX: 1.2,
            scaleY: 0.8,
            angle: 30,
            fill: "#00b8d9",
            vigiliaPaint: { fill: "palette.accent" },
            originX: "left",
            originY: "top",
          },
        ],
      },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened movable.vigilia-theme",
    );

    // Scene points go through the camera (`artboardScreenRect`), never the canvas
    // box: the canvas is host-sized, so its box says nothing about the artboard.
    const center = await sceneToClient(page, 320, 76, 66);
    await page.mouse.dblclick(center.x, center.y);
    expect(await saveEnvelope(page)).toMatchObject({
      scene: {
        objects: [
          expect.objectContaining({
            id: "panel",
            left: 40,
            top: 50,
            scaleX: 1.2,
            scaleY: 0.8,
            angle: 30,
          }),
        ],
      },
    });

    await page.keyboard.press("Control+z");
    expect(leftFor(await saveEnvelope(page), "panel")).toBeCloseTo(40, 3);

    const start = await sceneToClient(page, 320, 70, 70);
    const end = await sceneToClient(page, 320, 150, 70);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();

    const savedAfterDrag = await saveEnvelope(page);
    expect(leftFor(savedAfterDrag, "panel")).toBeGreaterThan(100);

    await page.keyboard.press("Control+z");
    const savedAfterUndo = await saveEnvelope(page);
    expect(leftFor(savedAfterUndo, "panel")).toBeCloseTo(40, 3);
  });

  test("enters a group, steps back out, and survives an undo", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
    await page.goto(EDITOR);
    await setThemePackage(page, "grouping.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "grouping",
      artboard: { width: 320, height: 180 },
      // The brief's fixture wrote a raw `fill`; this validator rejects one
      // without a palette reference, so the paint is declared the way every
      // other fixture here declares it.
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          accent: {
            name: "Accent",
            value: { kind: "solid", color: "#00b8d9" },
          },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Group",
            id: "grp",
            left: 40,
            top: 40,
            // Without these the group revives 0x0 and its `aCoords` collapse to a
            // point, so the pointer finds no target at all and entry never starts.
            width: 30,
            height: 30,
            objects: [
              {
                type: "Rect",
                id: "child",
                left: 0,
                top: 0,
                width: 30,
                height: 30,
                fill: "#00b8d9",
                vigiliaPaint: { fill: "palette.accent" },
                originX: "left",
                originY: "top",
              },
            ],
          },
          {
            type: "Rect",
            id: "outside",
            left: 240,
            top: 40,
            width: 30,
            height: 30,
            fill: "#00b8d9",
            vigiliaPaint: { fill: "palette.accent" },
            originX: "left",
            originY: "top",
          },
        ],
      },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened grouping.vigilia-theme",
    );

    // Points are derived from the camera, never from the canvas box: the canvas is
    // host-sized, so its box says nothing about where the artboard is.
    const rect = await page.evaluate(() => {
      const b = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              viewport: {
                artboardScreenRect(): {
                  left: number;
                  top: number;
                  width: number;
                  height: number;
                };
              };
            };
          };
        }
      ).vigiliaEditorBridge;
      return b.editor.viewport.artboardScreenRect();
    });
    // `rect` is canvas-relative, so the canvas box offset is added here. The file
    // now has `sceneToClient` for this; the local form stays because the test
    // needs a tuple and its own guard compares against `rect` directly.
    const canvasBox = (await page
      .locator("#vigilia-fabric-editor canvas.upper-canvas")
      .boundingBox())!;
    const at = (x: number, y: number): [number, number] => [
      canvasBox.x + rect.left + (x / 320) * rect.width,
      canvasBox.y + rect.top + (y / 180) * rect.height,
    ];

    const state = (): Promise<{
      active: string | undefined;
      childLeft: number | undefined;
      groupPresent: boolean;
    }> =>
      page.evaluate(() => {
        const b = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  getActiveObject(): { id?: string } | undefined;
                  getObjects(): Array<{
                    id?: string;
                    getObjects?(): Array<{ id?: string; left?: number }>;
                  }>;
                };
              };
            };
          }
        ).vigiliaEditorBridge;
        const canvas = b.editor.canvas;
        const group = canvas.getObjects().find((object) => object.id === "grp");
        return {
          active: canvas.getActiveObject()?.id,
          childLeft: group
            ?.getObjects?.()
            .find((object) => object.id === "child")?.left,
          groupPresent: group !== undefined,
        };
      });

    // Double-click inside the child: the pointer's target resolves to the child,
    // which becomes the active object while the group stays in the context.
    const [cx, cy] = at(55, 55);
    await page.mouse.dblclick(cx, cy);
    await expect.poll(async () => (await state()).active).toBe("child");

    // The entered group and its child are reachable; the row outside the context is
    // not. `data-context` is the attribute the stylesheet keys on, and the computed
    // opacity is the only thing that shows the rule matches the row it should.
    const rowStyle = (id: string) =>
      page.locator(`[data-vigilia-layer="${id}"]`).evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          context: node.getAttribute("data-context"),
          opacity: style.opacity,
        };
      });

    await expect.poll(async () => (await rowStyle("grp")).context).toBe("true");
    await expect
      .poll(async () => (await rowStyle("child")).context)
      .toBe("true");
    await expect
      .poll(async () => (await rowStyle("outside")).context)
      .toBe("false");
    await expect
      .poll(async () => (await rowStyle("outside")).opacity)
      .toBe("0.45");
    // The positive half of the same rule: the child is inside the context and must
    // not be dimmed. Without this, a rule that dimmed every row would pass.
    await expect.poll(async () => (await rowStyle("child")).opacity).toBe("1");

    const before = (await state()).childLeft;
    // `toBeTypeOf` is Vitest's; Playwright's `expect` has no such matcher.
    expect(typeof before).toBe("number");

    // Nudge (Task 6's binding), then undo it. The undo must not leave the context
    // pointing at a destroyed object.
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await state()).childLeft)
      .toBe((before ?? 0) + 1);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await state()).childLeft).toBe(before);

    // Escape is the assertion that survives the undo — but only if it reads
    // identity rather than id. Every read above is by `id`, and a revived object
    // keeps its `id`: a context still holding the *pre-undo* instance satisfies
    // `active === "grp"` just as well as a re-resolved one, and `groupPresent`
    // reads the revived canvas either way. Neither can tell the two apart.
    const inCanvas = (): Promise<boolean> =>
      page.evaluate(() => {
        const b = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: { getActiveObject(): unknown; getObjects(): unknown[] };
              };
            };
          }
        ).vigiliaEditorBridge;
        return b.editor.canvas
          .getObjects()
          .includes(b.editor.canvas.getActiveObject());
      });

    await page.keyboard.press("Escape");
    // For a one-object selection Fabric sets `activeObject` to that object, so
    // `setActiveObject(target)` makes `getActiveObject() === target`. Identity is
    // therefore readable here, and is the only thing that separates a live group
    // from the destroyed instance.
    await expect.poll(inCanvas).toBe(true);
    await expect.poll(async () => (await state()).active).toBe("grp");
    expect((await state()).groupPresent).toBe(true);
  });

  test("rehydrates a chart runtime after undo", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await selectStarterChart(page);
    // The grab point comes from the object's own geometry, through the camera.
    const start = await clientOfScene(page, "load-gauge");
    const left = leftFor(await saveEnvelope(page), "load-gauge");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y);
    await page.mouse.up();
    expect(leftFor(await saveEnvelope(page), "load-gauge")).toBeGreaterThan(
      left,
    );

    await page.keyboard.press("Control+z");
    expect(leftFor(await saveEnvelope(page), "load-gauge")).toBeCloseTo(
      left,
      3,
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const editor = Object.entries(
            window as unknown as Record<string, unknown>,
          ).find(
            ([key, value]) =>
              key.startsWith("vigilia-fabric-editor-") &&
              (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } })
                .canvas.upperCanvasEl?.isConnected,
          )?.[1] as
            | {
                canvas: { getObjects(): Array<{ get(name: string): unknown }> };
              }
            | undefined;
          const chart = editor?.canvas
            .getObjects()
            .find((object) => object.get("id") === "load-gauge") as
            | { option?: { series?: unknown[] } }
            | undefined;
          const option = chart?.option;
          return option?.series?.length ?? 0;
        }),
      )
      .toBeGreaterThan(0);
  });

  test("keeps the starter background unselectable after an undo", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    // The reported bug: the starter background is authored `selectable: false`,
    // so it resists a click on first open — but undo revives the scene through
    // serialisation, and Fabric omits `selectable`/`evented` from `toObject`,
    // so it came back an ordinary draggable object.
    //
    // This clicks bare artboard, because the plate is not what the author sees:
    // the starter scene's own full-artboard `background` rect is the topmost
    // object at that point, and it must decline the click on its own. A test
    // aimed at the plate would pass even while that rect stayed selectable.
    await page.goto(EDITOR);

    /** Artboard coordinates to page pixels, through the live camera. */
    const at = (x: number, y: number): Promise<{ x: number; y: number }> =>
      sceneToClient(page, 1280, x, y);

    /** The authored background object, by id, as the page's own instance. */
    const background = async (): Promise<unknown> =>
      page.evaluate(() => {
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
          | { canvas: { getObjects(): Array<{ get(n: string): unknown }> } }
          | undefined;
        const object = editor?.canvas
          .getObjects()
          .find((candidate) => candidate.get("id") === "background");
        return object === undefined
          ? null
          : {
              selectable: object.get("selectable"),
              evented: object.get("evented"),
            };
      });

    /** Whether the background geometrically covers a point, page coordinates. */
    const covers = async (point: { x: number; y: number }): Promise<boolean> =>
      page.evaluate(
        ([clientX, clientY]) => {
          const editor = Object.entries(
            window as unknown as Record<string, unknown>,
          ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
            | {
                canvas: {
                  getScenePoint(e: {
                    clientX: number;
                    clientY: number;
                  }): unknown;
                  getObjects(): Array<{
                    get(n: string): unknown;
                    containsPoint(p: unknown): boolean;
                  }>;
                };
              }
            | undefined;
          const object = editor?.canvas
            .getObjects()
            .find((candidate) => candidate.get("id") === "background");
          if (editor === undefined || object === undefined) return false;
          return object.containsPoint(
            editor.canvas.getScenePoint({ clientX: clientX, clientY: clientY }),
          );
        },
        [point.x, point.y],
      );

    const selected = async (): Promise<unknown> =>
      page.evaluate(() => {
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
          | {
              canvas: {
                getActiveObject(): { get(name: string): unknown } | undefined;
              };
            }
          | undefined;
        return editor?.canvas.getActiveObject()?.get("id") ?? null;
      });

    // A point in bare artboard, clear of every authored card and label.
    const spot = await at(640, 690);

    // The guard is geometric, not a hit test: `findTarget` skips an object with
    // `evented: false`, so it reports nothing here whether or not the background
    // is still armed — it cannot witness the bug. `containsPoint` asks the
    // object's own bounds, which is true either way, so a pass below means the
    // background declined the click rather than that no object was there.
    expect(await covers(spot)).toBe(true);
    expect(await background()).toEqual({ selectable: false, evented: false });

    await page.mouse.click(spot.x, spot.y);
    expect(await selected()).toBeNull();

    // One authored change, so undo has entries either side of the revive.
    const marker = await at(432, 418);
    await page.mouse.move(marker.x, marker.y);
    await page.mouse.down();
    await page.mouse.move(marker.x + 40, marker.y);
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(400);

    expect(await covers(spot)).toBe(true);
    expect(await background()).toEqual({ selectable: false, evented: false });

    await page.mouse.click(spot.x, spot.y);
    expect(await selected()).toBeNull();
  });

  test("keeps the active document when Fabric cannot revive a schema-valid scene", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setUncheckedThemePackage(page, "unrevivable.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "unrevivable",
      artboard: { width: 320, height: 180 },
      scene: { version: "7.4.0", objects: [{ type: "UnknownFabricObject" }] },
    });

    await expect(page.locator("#status")).toContainText("Could not open");
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
  });

  test("asks before Open discards a changed Fabric scene", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.evaluate(() => {
      const editor = Object.entries(
        window as unknown as Record<string, unknown>,
      ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
        | {
            canvas: {
              item(
                index: number,
              ): { set(key: string, value: number): void } | undefined;
              requestRenderAll(): void;
            };
          }
        | undefined;
      editor?.canvas.item(1)?.set("left", 64);
      editor?.canvas.requestRenderAll();
    });
    await page.keyboard.press("Control+o");

    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "Save changes before opening another theme?",
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
  });

  test("asks before New discards a changed Fabric scene", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.evaluate(() => {
      const editor = Object.entries(
        window as unknown as Record<string, unknown>,
      ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
        | {
            canvas: {
              item(
                index: number,
              ): { set(key: string, value: number): void } | undefined;
              requestRenderAll(): void;
            };
          }
        | undefined;
      editor?.canvas.item(1)?.set("left", 64);
      editor?.canvas.requestRenderAll();
    });
    await page.keyboard.press("Control+n");

    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("#status")).toHaveText("Fabric editor ready");
  });

  test("snaps a dragged object to a neighbour and shows a guide", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();

    // Drag the "SYSTEM STATUS" label (starter scene: left 1074, top 538,
    // originX left) horizontally until its left edge lands on the status
    // card's left edge (1018) — a vertical alignment inside the 5-px threshold.
    const grab = await sceneToClient(page, 1280, 1104, 546);
    const drop = await sceneToClient(page, 1280, 1048, 546);
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(drop.x, drop.y, { steps: 12 });

    await captureVisualReview(page, testInfo, "editor-snap-guides");
    await page.mouse.up();
  });

  test("shows the rotation-angle indicator beside the pointer mid-rotation", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();

    // Select the "time" label (scene 78,189, size ~210x70) via the canvas,
    // then sweep its rotation handle above the top edge: the degree readout
    // must appear beside the pointer mid-gesture.
    const centre = await sceneToClient(page, 1280, 180, 220);
    await page.mouse.click(centre.x, centre.y);
    // Fabric's mtr sits above the top edge at the object's centre X, roughly
    // 45px above the bounding top plus the handle radius.
    const handle = await sceneToClient(page, 1280, 180, 132);
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + 30, handle.y + 30, { steps: 12 });

    await captureVisualReview(page, testInfo, "editor-rotation-indicator");
    await page.mouse.up();
  });

  test("captures the canvas dock over a selected object", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();

    // Select the "time" label; the dock anchors to the canvas bottom and
    // shows only the actions this selection can run.
    const centre = await sceneToClient(page, 1280, 180, 220);
    await page.mouse.click(centre.x, centre.y);
    const dock = page.locator('[aria-label="Selected object actions"]');
    await expect(dock).toHaveAttribute("data-visible", "true");
    await expect(dock.getByRole("button", { name: "Duplicate" })).toBeVisible();
    // A single object cannot be ungrouped.
    await expect(dock.getByRole("button", { name: "Ungroup" })).toHaveCount(0);

    // The toolbar is the arrange surface: it stays visible for one object, so
    // the capture shows the discoverable-but-greyed state.
    const toolbar = page.locator("[data-vigilia-arrange-toolbar]");
    await expect(toolbar).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: "Align left" }),
    ).toBeDisabled();

    await captureVisualReview(page, testInfo, "editor-toolbar");
  });

  test("zooms and pans the canvas, and cannot lose the artboard", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    // Read the camera through its own accessor: `viewport.zoom()` is the owner
    // of zoom (Task 1), and `window.vigiliaEditorBridge` is the page handle
    // Plan B Task 4 established. Reaching into `canvas.getZoom()` through a
    // debug-key scan reads a different owner and breaks when the handle moves.
    const readZoom = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { viewport: { zoom(): number } };
            };
          }
        ).vigiliaEditorBridge.editor.viewport.zoom(),
      );
    // Clamping is the camera's own contract, so the transform is read through
    // the same bridge the zoom is: a debug-key scan would read whichever
    // editor mounted first and could assert a stale canvas entirely.
    const translate = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { canvas: { viewportTransform: number[] } };
            };
          }
        ).vigiliaEditorBridge.editor.canvas.viewportTransform.slice(4, 6),
      );

    const fitted = await readZoom();
    await page
      .locator("#vigilia-fabric-editor canvas.upper-canvas")
      .hover({ position: { x: 200, y: 200 } });
    // Control is required: a plain wheel pans (Step 1 pins that), so wheeling
    // without it asserts the opposite of the unit contract and can only pass by
    // breaking it. Hold the modifier, then confirm the assertion fails with it
    // released — that is the teeth check for the modifier branch.
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -400);
    await page.keyboard.up("Control");
    expect(await readZoom()).toBeGreaterThan(fitted);
    // Pan a long way and confirm the artboard is still on screen: the clamped
    // transform keeps its edge inside the viewport.
    await page.keyboard.down("Space");
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(4000, 4000, { steps: 20 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    const transform = await page.evaluate(
      () =>
        (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { canvas: { viewportTransform: number[] } };
            };
          }
        ).vigiliaEditorBridge.editor.canvas.viewportTransform,
    );
    // The pan is clamped, so the transform saturates rather than running away.
    // Asserting only finiteness would pass for an unclamped transform — which is
    // exactly the regression this pins. Saturating is sign-agnostic and does not
    // depend on how viewportTransform[4] relates to clampPan's `offset`: drag
    // the same way again and the translate must not move.
    expect(Number.isFinite(transform[4])).toBe(true);
    expect(Number.isFinite(transform[5])).toBe(true);
    const atLimit = await translate();
    expect(atLimit.length).toBe(2);
    await page.keyboard.down("Space");
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(4000, 4000, { steps: 20 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    expect(await translate()).toEqual(atLimit);
  });

  test("tracks the camera's zoom in the stage readout", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");

    await page.goto(EDITOR);
    const readout = page.locator("[data-vigilia-zoom]");
    await expect(readout).toBeVisible();
    // Read the camera, not the canvas: `ViewportManager` owns zoom, so only the
    // camera can tell a readout that stopped following it from one that works.
    const cameraZoom = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { viewport: { zoom(): number } };
            };
          }
        ).vigiliaEditorBridge.editor.viewport.zoom(),
      );
    const percent = async (): Promise<number> =>
      Number((await readout.textContent())?.replace("%", ""));
    const fitted = await percent();
    expect(fitted).toBe(Math.round((await cameraZoom()) * 100));

    // A pan moves the canvas without changing the zoom: this is what separates a
    // readout that tracks the camera from one rendered once at mount.
    await page.keyboard.down("Space");
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(500, 470, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    expect(await percent()).toBe(fitted);

    // A wheel without the modifier pans too — only ctrl-wheel zooms.
    await page
      .locator("#vigilia-fabric-editor canvas.upper-canvas")
      .hover({ position: { x: 200, y: 200 } });
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -400);
    await page.keyboard.up("Control");
    expect(await percent()).toBe(Math.round((await cameraZoom()) * 100));
    expect(await percent()).toBeGreaterThan(fitted);

    await captureVisualReview(page, testInfo, "editor-zoom-readout");
  });

  test("a pasteboard drag marquees instead of moving an object", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
    await page.goto(EDITOR);

    // Scene-space document geometry, NOT object `left`. A marquee press puts the
    // hit objects inside an ActiveSelection, whose `enterGroup` rebases every
    // child's `left` to be relative to the selection — so comparing raw `left`
    // across a selection boundary reports a move for an object that never moved,
    // and cannot tell a marquee from a drag. `getBoundingRect` is the world-space
    // rect either way. `selected` is read as well because "nothing moved" alone
    // is satisfied by a drag that reached nothing at all.
    const read = (): Promise<{
      selected: number;
      rects: Array<[string, number, number]>;
    }> =>
      page.evaluate(() => {
        const bridge = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  getActiveObject(): { getObjects?(): unknown[] } | undefined;
                  getObjects(): Array<{
                    id?: string;
                    getBoundingRect(): { left: number; top: number };
                  }>;
                };
              };
            };
          }
        ).vigiliaEditorBridge;
        const active = bridge.editor.canvas.getActiveObject();
        return {
          selected:
            active?.getObjects?.().length ?? (active === undefined ? 0 : 1),
          rects: bridge.editor.canvas
            .getObjects()
            .map((object) => {
              const bounds = object.getBoundingRect();
              return [
                String(object.id),
                Math.round(bounds.left),
                Math.round(bounds.top),
              ] as [string, number, number];
            })
            .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
        };
      });

    // The artboard's rect from the camera, in CANVAS-element coordinates — not the
    // canvas box (the canvas is host-sized and much larger than the artboard now)
    // and not client space either. `vpt[4]`/`vpt[5]` are relative to the canvas
    // element, and the canvas sits at x~357 in the page, so the offset is added
    // below rather than assumed away.
    const rect = await page.evaluate(() => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              viewport: {
                artboardScreenRect(): {
                  left: number;
                  top: number;
                  width: number;
                  height: number;
                };
              };
            };
          };
        }
      ).vigiliaEditorBridge;
      return bridge.editor.viewport.artboardScreenRect();
    });
    const canvasBox = (await page
      .locator("#vigilia-fabric-editor canvas.upper-canvas")
      .boundingBox())!;
    // Artboard point -> client point. The scale is uniform and derived from the
    // rect, so this mapping is correct whether or not the artboard's aspect
    // happens to match 1280x720 — which it does NOT: `fitScale()` is
    // `Math.min(vw/1280, vh/720)` (`viewport-manager/index.ts:97-100`), a
    // contain-fit, so at the measured 626x594 host the artboard draws 626x352 and
    // every point below y=720 in artboard space is BELOW the canvas.
    //
    // The `canvasBox.x/y` terms are the whole difference between this and a
    // vacuous test: without them every point below lands ~357px left and ~72px
    // above where it belongs, off the canvas, where the drag selects nothing and
    // the assertion passes while proving nothing.
    const scale = rect.width / 1280;
    const at = (x: number, y: number): [number, number] => [
      canvasBox.x + rect.left + x * scale,
      canvasBox.y + rect.top + y * scale,
    ];

    const before = await read();

    // The pasteboard is the vertical band BELOW the artboard, and it is the only
    // one there is. `fitScale()` is a contain-fit, so at the 626x594 host the
    // scale is `min(626/1280, 594/720) = 0.489` and the artboard draws 626x352 —
    // full canvas width, centred vertically, leaving 121px bands above and below.
    // An earlier revision of this step claimed "about 240px of pasteboard below
    // the artboard and 350px to its right"; there is no pasteboard to its right,
    // and a pick point that assumed one would land off-canvas and pass vacuously.
    // So the press is placed by Y only, at the horizontal centre; X inside the
    // canvas is free because every X is pasteboard in that band.
    const [sx, sy] = [
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height - 16,
    ];
    // Both sides in client space: `rect` is canvas-relative, so its client
    // position is `canvasBox` + `rect`. Without the offsets these guards compare a
    // client point against a canvas-space edge and pass on a drag that is nowhere
    // near the pasteboard — the vacuity this test exists to remove, reintroduced
    // in the guard itself. The Y guard is the load-bearing one; the X guard only
    // records that the canvas is wider than the artboard's left edge, which is
    // trivially true and kept to document that X is unconstrained here.
    expect(sy).toBeGreaterThan(canvasBox.y + rect.top + rect.height);
    expect(sy).toBeLessThan(canvasBox.y + canvasBox.height);
    expect(sx).toBeGreaterThan(canvasBox.x + rect.left);
    const [ex, ey] = at(100, 200);

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // Past Fabric's marquee threshold before releasing: a zero-distance drag would
    // select nothing and pass without exercising the marquee at all.
    await page.mouse.move(ex, ey, { steps: 15 });
    await page.mouse.up();

    // A marquee selects, so the assertion is that no object MOVED — compared in
    // world space, because a selection rebases its members' `left`.
    expect((await read()).rects).toEqual(before.rects);
    // ...and that the marquee did reach the canvas at all: a drag whose press
    // landed off-canvas selects nothing, moves nothing, and would satisfy the
    // call above while exercising nothing.
    expect(before.selected).toBe(0);
    expect((await read()).selected).toBeGreaterThan(0);

    // The vacuity guard: the same gesture started INSIDE an object must move it.
    // Without this, a canvas that ignores pointer input entirely would pass the
    // assertions above.
    // The target is `time-card` (52,150 260x330), deliberately NOT the header band:
    // Step 3 offers disarming `header-wash` as a fix, and a guard that drags inside
    // its 0..142 band would stop being interactive the moment that fix is taken,
    // failing for a reason unrelated to the marquee. (70,450) is inside the card
    // and outside every child it contains.
    const [ox, oy] = at(70, 450);
    await page.mouse.move(ox, oy);
    await page.mouse.down();
    await page.mouse.move(ox + 40, oy + 30, { steps: 10 });
    await page.mouse.up();
    expect((await read()).rects).not.toEqual(before.rects);
  });

  test("reorders a layer and refuses a cross-group drop", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");

    await page.goto(EDITOR);
    // A fixture with both shapes the rule distinguishes: two plain siblings, and a
    // group whose child must not be movable across the boundary.
    // `vigiliaPaint` and `globals.palette` are not decoration: a literal `fill`
    // with no paint ref is `unresolved-global-ref` and `setThemePackage` asserts
    // `writeThemePackage` returned ok, so a fixture without them fails before the
    // editor opens. Copied from the `movable.vigilia-theme` fixture at `:1322`.
    const paint = {
      palette: {
        none: { name: "None", value: { kind: "solid", color: "transparent" } },
        accent: { name: "Accent", value: { kind: "solid", color: "#00b8d9" } },
      },
    };
    const rect = (id: string, left: number, top: number) => ({
      type: "Rect",
      id,
      left,
      top,
      width: 40,
      height: 40,
      fill: "#00b8d9",
      vigiliaPaint: { fill: "palette.accent" },
      originX: "left",
      originY: "top",
    });
    await setThemePackage(page, "reorder.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "reorder",
      artboard: { width: 320, height: 180 },
      globals: paint,
      scene: {
        version: "7.4.0",
        objects: [
          rect("alpha", 20, 20),
          rect("beta", 80, 20),
          {
            type: "Group",
            id: "grp",
            left: 20,
            top: 90,
            objects: [{ ...rect("child", 0, 0), width: 30, height: 30 }],
          },
        ],
      },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened reorder.vigilia-theme",
    );

    const panelOrder = (): Promise<(string | null)[]> =>
      page
        .locator("[data-vigilia-layer]")
        .evaluateAll((rows) =>
          rows.map((row) => row.getAttribute("data-vigilia-layer")),
        );
    // The panel paints topmost-first, so its row order is the reverse of the
    // serialized paint order. Compare the pair's *relative* order, never an
    // absolute index, so this holds whichever direction the projection uses.
    const idsIn = (envelope: unknown): string[] =>
      (
        envelope as { scene: { objects: Array<{ id?: string }> } }
      ).scene.objects.map((object) => object.id ?? "");
    const pairRelativeTo = (ids: string[]): boolean =>
      ids.indexOf("alpha") < ids.indexOf("beta");

    const beforeIds = idsIn(await saveEnvelope(page));
    const beforePanel = await panelOrder();
    expect(beforeIds).toContain("alpha");
    expect(beforeIds).toContain("beta");

    // Same parent: drop alpha on beta's row.
    await page
      .locator('[data-vigilia-layer="alpha"]')
      .dragTo(page.locator('[data-vigilia-layer="beta"]'));
    const afterPanel = await panelOrder();
    expect(afterPanel).not.toEqual(beforePanel);

    // Reordering is authored state (Step 4 calls `saveState`), so it must reach
    // the saved envelope — a panel-only change would be a projection bug.
    const afterIds = idsIn(await saveEnvelope(page));
    expect(pairRelativeTo(afterIds)).toBe(!pairRelativeTo(beforeIds));

    // Cross-group: a child dropped on a top-level sibling changes membership,
    // which this operation must refuse outright.
    await page
      .locator('[data-vigilia-layer="child"]')
      .dragTo(page.locator('[data-vigilia-layer="alpha"]'));
    expect(await panelOrder()).toEqual(afterPanel);
    expect(idsIn(await saveEnvelope(page))).toEqual(afterIds);
  });

  test("nudges the selection and records one history entry", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
    await page.goto(EDITOR);
    // Select through the bridge, not the layer row: a focused panel row is a
    // different starting state, and this test is about the nudge binding.
    await page.evaluate(() => {
      (
        window as unknown as {
          vigiliaEditorBridge: { selectLayer(id: string): void };
        }
      ).vigiliaEditorBridge.selectLayer("header-wash");
    });
    const left = (): Promise<number | undefined> =>
      page.evaluate(() => {
        const b = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  getObjects(): Array<{ id?: string; left?: number }>;
                };
              };
            };
          }
        ).vigiliaEditorBridge;
        return b.editor.canvas
          .getObjects()
          .find((object) => object.id === "header-wash")?.left;
      });
    const before = await left();
    if (typeof before !== "number")
      throw new Error("header-wash is missing from the canvas");
    await page.keyboard.press("ArrowRight");
    expect(await left()).toBe(before + 1);
    await page.keyboard.press("Shift+ArrowRight");
    expect(await left()).toBe(before + 11);

    // Control+z immediately after the burst's last press: the burst's entry is
    // not recorded until it closes, so the undo binding must close it first.
    await page.keyboard.press("Control+z");
    expect(await left()).toBe(before);
    // Both presses are one entry, so one redo must restore the *whole* burst. A
    // mechanism that recorded two entries would land at `before + 1` here.
    await page.keyboard.press("Control+y");
    expect(await left()).toBe(before + 11);

    const selectedIds = (): Promise<Array<string | undefined>> =>
      page.evaluate(() => {
        const b = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: { getActiveObjects(): Array<{ id?: string }> };
              };
            };
          }
        ).vigiliaEditorBridge;
        return b.editor.canvas.getActiveObjects().map((object) => object.id);
      });

    // Ctrl+A inside a text field belongs to the field, not to select-all. Focus
    // the layer rename input (Plan B Task 5) and confirm the selection is
    // untouched; without this the binding silently steals the field's own
    // select-all and the author's typed text is never selected.
    await page.locator('[data-vigilia-layer="header-wash"]').dblclick();
    const rename = page.locator('input[aria-label^="Rename"]');
    await expect(rename).toBeFocused();
    await rename.press("Control+a");
    expect(await selectedIds()).toEqual(["header-wash"]);

    // ...and the same key with focus on the document does select everything.
    // Without this the test only ever proves the binding stays silent.
    await rename.blur();
    await page.keyboard.press("Control+a");
    const ids = await selectedIds();
    expect(ids.length).toBeGreaterThan(1);
    // The theme's full-artboard `background` rect is `selectable: false` but IS
    // returned by `getObjects()`; selecting it would let the next nudge drag the
    // background off the artboard.
    expect(ids).not.toContain("background");
  });
});

async function saveEnvelope(page: Page): Promise<unknown> {
  const { parsed } = await savePackage(page);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.envelope;
}

async function savePackage(page: Page): Promise<{
  readonly parsed: ReturnType<typeof readThemePackage>;
  readonly bytes: Buffer;
}> {
  const download = page.waitForEvent("download");
  // The File menu owns Save; the old panel section is gone.
  await page.locator("[data-vigilia-save-package]").click();
  await expect(page.locator("#status")).toHaveText("Theme package saved");
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  return { parsed: readThemePackage(bytes), bytes };
}

async function setThemePackage(
  page: Page,
  name: string,
  envelope: Parameters<typeof writeThemePackage>[0]["envelope"],
): Promise<void> {
  const result = writeThemePackage({ envelope, assets: {} });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(result.bytes),
  });
}

async function setUncheckedThemePackage(
  page: Page,
  name: string,
  envelope: unknown,
): Promise<void> {
  const buffer = zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        format: "vigilia-theme-package",
        version: 1,
        theme: "theme.json",
      }),
    ),
    "theme.json": strToU8(JSON.stringify(envelope)),
  });
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(buffer),
  });
}

/** Shell navigation the inspector/rail now mediates; panels moved behind it. */
async function openRailPane(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
}

async function openInspectorTab(page: Page, name: string): Promise<void> {
  await page.getByRole("tab", { name, exact: true }).click();
}

async function selectStarterChart(page: Page): Promise<void> {
  // The chart's own centre, through the camera. A box-relative constant used to
  // land only 4px inside the object's bottom edge, which is why a drag meant for
  // the chart grabbed its parent card instead.
  const centre = await clientOfScene(page, "load-gauge");
  await page.mouse.click(centre.x, centre.y);
  // The precondition this helper never had: the tab lookup below turns a wrong
  // selection into a confusing timeout, so name the failure here instead.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              vigiliaEditorBridge: {
                editor: {
                  canvas: {
                    getActiveObject(): { id?: string } | undefined;
                  };
                };
              };
            }
          ).vigiliaEditorBridge.editor.canvas.getActiveObject()?.id ?? null,
      ),
    )
    .toBe("load-gauge");
  // A chart selection routes the inspector to its Data tab.
  await openInspectorTab(page, "Data");
  await expect(
    page.locator('[data-vigilia-chart-setting="thickness"]'),
  ).toBeVisible();
}

/** The shell bridge, the one owner of a rename in the page. */
async function renameLayer(
  page: Page,
  id: string,
  name: string,
): Promise<void> {
  await page.evaluate(
    ([layerId, next]) => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge?: {
            renameLayer(id: string, name: string): void;
          };
        }
      ).vigiliaEditorBridge;
      if (bridge === undefined) throw new Error("No editor bridge is mounted.");
      bridge.renameLayer(layerId, next);
    },
    [id, name] as const,
  );
}

async function layerNamesInPage(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge?: {
          layers(): readonly { id: string; name: string }[];
        };
      }
    ).vigiliaEditorBridge;
    return Object.fromEntries(
      (bridge?.layers() ?? []).map((row) => [row.id, row.name]),
    );
  });
}

async function captureVisualReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  if (process.env["VIGILIA_CAPTURE"] === undefined) return;
  const directory =
    process.env["VIGILIA_CAPTURE_DIR"] ??
    (process.env["VIGILIA_CAPTURE"] === undefined
      ? "test-results/screenshots"
      : "../../docs/evidence/screenshots");
  const filename = `${name}-${testInfo.project.name}.png`;
  const screenshot = await page.screenshot({
    path: `${directory}/${filename}`,
  });

  await testInfo.attach(filename, {
    body: screenshot,
    contentType: "image/png",
  });
  expect(screenshot.byteLength).toBeGreaterThan(1000);
}

async function assetReferences(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const editor = Object.entries(
      window as unknown as Record<string, unknown>,
    ).find(
      ([key, value]) =>
        key.startsWith("vigilia-fabric-editor-") &&
        (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } }).canvas
          .upperCanvasEl?.isConnected,
    )?.[1] as
      | { canvas: { getObjects(): Array<{ get(name: string): unknown }> } }
      | undefined;
    return (
      editor?.canvas
        .getObjects()
        .filter((object) => object.get("type") === "image")
        .map((object) => object.get("vigiliaAsset")) ?? []
    );
  });
}

function leftFor(envelope: unknown, id: string): number {
  const objects = (
    envelope as { scene: { objects: Array<{ id?: string; left?: number }> } }
  ).scene.objects;
  const left = objects.find((object) => object.id === id)?.left;
  expect(left).toEqual(expect.any(Number));
  return left!;
}

import { expect, type Page, test } from "@playwright/test";
import {
  captureVisualReview,
  chooseAssetFile,
  enterLayer,
} from "./editor-canvas.js";
import { openPane } from "./editor-rail.js";
import {
  addChart,
  insert,
  openBlank,
  openPosition,
  readScene,
  type SceneObject,
  selectLayer,
} from "./rebuild-driver.js";
import { isDesktopSurface } from "./surface.js";

/**
 * What an author sees in the per-kind column, in a real browser against the
 * built bundle.
 *
 * Task 10 of the per-kind inspector plan. Every claim here is about a rendered
 * surface, and `AGENTS.md` is explicit that visible behaviour needs browser
 * inspection rather than object counts. The numbers and strings are the
 * assertions; the screenshots are for a human.
 */

const EDITOR = "http://127.0.0.1:4174/";

/** The remainder slice's own ink: the blank document's `palette.chartTrack`,
 * which is what a new pie's `remainderFill` resolves through. */
const REMAINDER_INK = [34, 48, 71] as const;

const EDITOR_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAANUlEQVQ4jWP8////fwYiwAePAmKUMTARpYoEMGrgqIGDwUDG9+75ROUUYsHg9/KogaMGkgEAOzoIbzncHVkAAAAASUVORK5CYII=",
  "base64",
);

/** The section ids the column renders, in document order. */
async function sectionIds(page: Page): Promise<string[]> {
  return page
    .locator("[data-vigilia-section]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-vigilia-section") ?? ""),
    );
}

async function isOpen(page: Page, id: string): Promise<boolean> {
  return page
    .locator(`[data-vigilia-section="${id}"] details`)
    .first()
    .evaluate((node) => (node as HTMLDetailsElement).open);
}

/** Every control inside a section, across the whole column. */
async function controlCount(page: Page): Promise<number> {
  return page
    .locator(
      "[data-vigilia-section] input, [data-vigilia-section] select, [data-vigilia-section] button",
    )
    .count();
}

/** The four Position fields as the author reads them. */
async function positionValues(
  page: Page,
): Promise<Record<string, string | undefined>> {
  return page.evaluate(() => {
    const value = (key: string): string | undefined =>
      document.querySelector<HTMLInputElement>(
        `[data-vigilia-geometry="${key}"]`,
      )?.value;
    return {
      left: value("left"),
      top: value("top"),
      width: value("width"),
      height: value("height"),
    };
  });
}

/**
 * The option the chart object's own builder produced.
 *
 * `_option` is what `buildChartPlan` handed to `setOption`, before
 * `toEngineOption` and ECharts normalise it — the option builder's own output
 * rather than the settings object or the engine's merged view of it.
 */
async function builtOption(page: Page, name: string): Promise<unknown> {
  return page.evaluate((wanted) => {
    type Chart = {
      get(name: string): unknown;
      getObjects?(): readonly Chart[];
      _option?: unknown;
    };
    const roots = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getObjects(): readonly Chart[] } };
        };
      }
    ).vigiliaEditorBridge.editor.canvas.getObjects();
    const find = (objects: readonly Chart[]): Chart | undefined => {
      for (const object of objects) {
        if (object.get("name") === wanted) return object;
        const found = find(object.getObjects?.() ?? []);
        if (found !== undefined) return found;
      }
      return undefined;
    };
    return find(roots)?._option ?? null;
  }, name);
}

/** The persisted settings the object carries, for the claim that a write
    landed rather than only that a field kept its text. */
async function chartSettings(page: Page, name: string): Promise<unknown> {
  return page.evaluate((wanted) => {
    type Chart = {
      get(name: string): unknown;
      getObjects?(): readonly Chart[];
      settings?: unknown;
    };
    const roots = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getObjects(): readonly Chart[] } };
        };
      }
    ).vigiliaEditorBridge.editor.canvas.getObjects();
    const find = (objects: readonly Chart[]): Chart | undefined => {
      for (const object of objects) {
        if (object.get("name") === wanted) return object;
        const found = find(object.getObjects?.() ?? []);
        if (found !== undefined) return found;
      }
      return undefined;
    };
    return find(roots)?.settings ?? null;
  }, name);
}

/**
 * Pixels of one exact colour inside a named object's own screen rect.
 *
 * **Inside the rect, not over the whole canvas.** The editor's stage paints the
 * same `#223047` as the pie's default remainder fill, so a whole-canvas count
 * reports 212,403 of it on a pie with no remainder at all — a measurement that
 * would pass on the wrong scene. The object's world rect is mapped through
 * `artboardScreenRect` and the canvas' own device-pixel ratio, the same
 * projection `sceneToClient` uses for a pointer.
 */
async function colourInsideObject(
  page: Page,
  name: string,
  rgb: readonly [number, number, number],
): Promise<number> {
  return page.evaluate(
    ([objectName, r, g, b]) => {
      type Obj = {
        get(property: string): unknown;
        getObjects?(): readonly Obj[];
        getBoundingRect(): {
          left: number;
          top: number;
          width: number;
          height: number;
        };
      };
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: { getObjects(): readonly Obj[] };
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
      const find = (objects: readonly Obj[]): Obj | undefined => {
        for (const object of objects) {
          if (object.get("name") === objectName) return object;
          const found = find(object.getObjects?.() ?? []);
          if (found !== undefined) return found;
        }
        return undefined;
      };
      const object = find(bridge.editor.canvas.getObjects());
      if (object === undefined)
        throw new Error(`no object named ${objectName}`);

      const canvas = document.querySelector<HTMLCanvasElement>(
        "#vigilia-fabric-editor canvas.lower-canvas",
      );
      const context = canvas?.getContext("2d");
      if (canvas === null || context === null || context === undefined)
        return -1;

      const ratio = canvas.width / canvas.getBoundingClientRect().width;
      const board = bridge.editor.viewport.artboardScreenRect();
      const scale = board.width / 1672;
      const rect = object.getBoundingRect();
      const left = Math.max(
        0,
        Math.round((board.left + rect.left * scale) * ratio),
      );
      const top = Math.max(
        0,
        Math.round((board.top + rect.top * scale) * ratio),
      );
      const width = Math.min(
        canvas.width - left,
        Math.round(rect.width * scale * ratio),
      );
      const height = Math.min(
        canvas.height - top,
        Math.round(rect.height * scale * ratio),
      );
      if (width <= 0 || height <= 0) return 0;

      const { data } = context.getImageData(left, top, width, height);
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index] === r && data[index + 1] === g && data[index + 2] === b)
          count += 1;
      }
      return count;
    },
    [name, rgb[0], rgb[1], rgb[2]] as const,
  );
}

/** One object's own geometry, read through the editor handle. */
function geometryOf(scene: readonly SceneObject[], id: string) {
  const object = scene.find((entry) => entry.id === id);
  if (object === undefined) throw new Error(`no object with id ${id}`);
  return object;
}

/** Saves the open document and hands back the package bytes. */
async function savePackage(page: Page): Promise<Buffer> {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Save package", exact: true })
    .click();
  await expect(page.locator("#status")).toContainText("Theme package saved");
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function openPackage(
  page: Page,
  name: string,
  bytes: Buffer,
): Promise<void> {
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  await expect(page.locator("#status")).toHaveText(`Opened ${name}`);
}

/**
 * Selects the starter's gauge through the layer tree, the way an author does.
 *
 * A layer row reaches a part *through its owning group*: `bridge.selectLayer`
 * takes `owner ?? target`, so with the RAM card merely open a click on
 * `ram-gauge`'s row hands back the card. Entering is what makes the gauge a row
 * a click selects — the canvas double-click this used to borrow entered the
 * same card, by a gesture the row has since grown a control for.
 */
async function selectStarterGauge(page: Page): Promise<void> {
  await enterLayer(page, "group-ram-card");
  await page.locator('[data-vigilia-layer="ram-gauge"]').click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              vigiliaEditorBridge: {
                editor: {
                  canvas: { getActiveObject(): { id?: string } | undefined };
                };
              };
            }
          ).vigiliaEditorBridge.editor.canvas.getActiveObject()?.id ?? null,
      ),
    )
    .toBe("ram-gauge");
}

test.describe("the per-kind inspector column", () => {
  test("asks the starter card's questions in order, with Position closed", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await page.waitForFunction(() => "vigiliaEditorBridge" in window);

    // The starter's own hierarchy, before any panel is touched.
    const rows = await page
      .locator("[data-vigilia-layer]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-vigilia-layer")),
      );
    expect(rows).toHaveLength(10);

    await page.locator('[data-vigilia-layer="group-cpu-card"]').click();
    expect(await sectionIds(page)).toEqual([
      "content",
      "position",
      "layer",
      "paint",
      "spends",
    ]);

    // Geometry is adjusted once and the binding chosen constantly, so the one
    // question an author does not return to is put away rather than hidden.
    expect(await isOpen(page, "position")).toBe(false);
    for (const id of ["content", "layer", "paint", "spends"]) {
      expect(await isOpen(page, id), id).toBe(true);
    }

    // The values, not that inputs exist: what the section holds is the card's
    // own geometry, to the unit the fields show.
    await openPosition(page);
    const card = geometryOf(await readScene(page), "group-cpu-card");
    expect(await positionValues(page)).toEqual({
      left: String(card.left),
      top: String(card.top),
      width: String(card.width),
      height: String(card.height),
    });
  });

  test("draws a remainder slice for a fixed pie total, measured on the canvas", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await page.waitForFunction(() => "vigiliaEditorBridge" in window);
    await openBlank(page);
    // The stage behind a transparent chart is the same `#223047` as the
    // remainder's own ink, so the artboard is given a different ground first:
    // otherwise "no remainder" measures 6,610 pixels of somebody else's paint.
    // The artboard panel is a document panel, so it is in the Document pane.
    await openPane(page, "Document");
    await page
      .locator("[data-vigilia-artboard-background]")
      .selectOption("palette.frost");
    await addChart(page, {
      family: "Pie",
      name: "pie",
      x: 60,
      y: 60,
      w: 300,
      h: 300,
      series: ["cpu.load"],
    });

    const data = async (): Promise<{ name: string; value: number }[]> => {
      const option = (await builtOption(page, "pie")) as {
        series: [{ data: { name: string; value: number }[] }];
      };
      return option.series[0].data;
    };

    // Sum of the parts: one slice, no remainder, and none of the remainder's
    // ink anywhere inside the chart.
    expect((await data()).map((entry) => entry.name)).toEqual(["cpu.load"]);
    expect(await colourInsideObject(page, "pie", REMAINDER_INK)).toBe(0);

    const total = page.locator('[data-vigilia-chart-setting="total"]');
    await total.scrollIntoViewIfNeeded();
    await total.selectOption("fixed");
    const value = page.locator('[data-vigilia-chart-setting="total.value"]');
    await value.fill("400");
    await value.blur();
    await expect(value).toHaveValue("400");
    await expect
      .poll(async () => (await data()).length, { timeout: 10_000 })
      .toBe(2);

    const slices = await data();
    const remainder = slices.find((entry) => entry.name === "remainder");
    const known = slices
      .filter((entry) => entry.name !== "remainder")
      .reduce((sum, entry) => sum + entry.value, 0);
    expect(remainder?.value).toBeCloseTo(400 - known, 6);

    // ...and the slice is on the glass, in the remainder's own ink, where a
    // moment ago there was none of it.
    const drawn = await colourInsideObject(page, "pie", REMAINDER_INK);
    expect(drawn).toBeGreaterThan(1000);

    // Unset again: the remainder goes, and so does its ink.
    await total.selectOption("sum");
    await expect.poll(async () => (await data()).length).toBe(1);
    expect(await colourInsideObject(page, "pie", REMAINDER_INK)).toBe(0);
  });

  test("reaches a line chart's animation, and the reopened document keeps it", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await page.waitForFunction(() => "vigiliaEditorBridge" in window);
    await openBlank(page);
    await addChart(page, {
      family: "Line",
      name: "line",
      x: 100,
      y: 100,
      w: 300,
      h: 200,
      series: ["cpu.load"],
    });

    const duration = page.locator(
      '[data-vigilia-chart-setting="animation.durationMs"]',
    );
    const easing = page.locator(
      '[data-vigilia-chart-setting="animation.easing"]',
    );
    await expect(duration).toBeVisible();
    await expect(easing).toBeVisible();
    // Absence means the defaults apply rather than that the chart is static, so
    // both fields read empty until the author writes one — and the write
    // materialises the whole block from its owner.
    await expect(duration).toHaveValue("");
    await expect(easing).toHaveValue("");

    await duration.fill("2500");
    await duration.blur();
    await expect(duration).toHaveValue("2500");
    await easing.selectOption("cubicInOut");
    await expect(easing).toHaveValue("cubicInOut");
    expect(await chartSettings(page, "line")).toMatchObject({
      animation: {
        durationMs: 2500,
        easing: "cubicInOut",
        appearMs: 650,
        appearEasing: "cubicOut",
      },
    });

    // **What the editor's own option builder emits, measured rather than
    // assumed.** `chart-manager/index.ts` builds every editor chart with
    // `animate: false`, so `toEngineAnimation` zeroes all four values and the
    // authored animation is not observable in the built option at all — it is
    // identical with the defaults and with 2500. The round trip below is
    // therefore read through the column after a reopen, which is the surface
    // where the author's value is visible; the plan's "read through the option
    // builder" cannot be satisfied on the editor and is reported as a finding.
    expect(await builtOption(page, "line")).toMatchObject({
      animation: false,
      animationDurationUpdate: 0,
      animationEasingUpdate: "linear",
    });

    const bytes = await savePackage(page);
    await openPackage(page, "animation.vigilia-theme", bytes);
    // By the name the author gave it: a reopened document's ids are the
    // document's own, so the tree row is the name the panel paints.
    await selectLayer(page, "line");

    // The reopened document shows the author's values — 2500 and cubicInOut —
    // and not the defaults 1000 and linear.
    await expect(
      page.locator('[data-vigilia-chart-setting="animation.durationMs"]'),
    ).toHaveValue("2500");
    await expect(
      page.locator('[data-vigilia-chart-setting="animation.easing"]'),
    ).toHaveValue("cubicInOut");
    expect(await chartSettings(page, "line")).toMatchObject({
      animation: { durationMs: 2500, easing: "cubicInOut" },
    });
  });

  test("gives every kind a column, and shows no kind a property it lacks", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await page.waitForFunction(() => "vigiliaEditorBridge" in window);
    await openBlank(page);

    const report = async (kind: string): Promise<void> => {
      expect(await sectionIds(page), `${kind} sections`).not.toHaveLength(0);
      expect(await controlCount(page), `${kind} controls`).toBeGreaterThan(0);
    };

    // A free shape: its own geometry and ink, at the same density.
    await insert(page, "Rectangle");
    await report("shape");
    await expect(page.locator("[data-vigilia-panel-fill]")).toHaveCount(1);
    await expect(page.locator("[data-vigilia-crop]")).toHaveCount(0);

    // A text box: typography, and no crop — it has no pixels to crop.
    await insert(page, "Text");
    await report("text");
    await expect(page.locator("[data-vigilia-crop]")).toHaveCount(0);
    await expect(page.locator("[data-vigilia-panel-fill]")).toHaveCount(0);

    // An image: the one kind that can crop, and not a panel either.
    await openPane(page, "Add");
    await chooseAssetFile(page, "import", {
      name: "logo.png",
      mimeType: "image/png",
      buffer: EDITOR_PNG,
    });
    await report("image");
    await expect(page.locator("[data-vigilia-crop]")).toHaveCount(1);
    await expect(page.locator("[data-vigilia-panel-fill]")).toHaveCount(0);

    // A chart: its family's own questions, in the column it belongs to.
    await addChart(page, {
      family: "Gauge",
      name: "gauge",
      x: 400,
      y: 100,
      w: 240,
      h: 240,
      series: ["cpu.load"],
    });
    await report("chart");
    await expect(
      page.locator('[data-vigilia-chart-setting="thickness"]'),
    ).toBeVisible();

    // A group: its bounds and its children's effective appearance, never a
    // panel material — a card is not a rectangle.
    await page.goto(EDITOR);
    await page.waitForFunction(() => "vigiliaEditorBridge" in window);
    await page.locator('[data-vigilia-layer="group-cpu-card"]').click();
    await report("group");
    await expect(page.locator("[data-vigilia-panel-fill]")).toHaveCount(0);
    await expect(page.locator("[data-vigilia-crop]")).toHaveCount(0);
  });

  test("names where to choose from when nothing is selected", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await page.waitForFunction(() => "vigiliaEditorBridge" in window);
    await openBlank(page);

    // The provenance of this string is pinned in jsdom, where it is compared
    // against `uiCopy.inspectorFields.nothingSelected` itself
    // (`selection-inspector/index.dom.test.ts`); the browser's job is the one
    // the unit test cannot do — that the line is the one an author reads.
    await expect(page.locator("[data-vigilia-nothing-selected]")).toHaveText(
      "Select an object to inspect it.",
    );
    expect(await sectionIds(page)).toEqual([]);
    await expect(page.locator("[data-vigilia-geometry]")).toHaveCount(0);
  });

  test("withholds a locked object's writing fields and keeps its read-only ones", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await page.waitForFunction(() => "vigiliaEditorBridge" in window);

    // **The re-selection is a workaround, not the claim.** Locking through the
    // layer row's own control fires no event the column listens to, so it keeps
    // offering the writing fields a locked object no longer accepts until the
    // next selection event; measured, and filed as `vg-148`, because product
    // source is outside this task's ownership.
    await page.locator('[data-vigilia-layer="group-cpu-card"]').click();
    await page
      .locator('[data-vigilia-layer="group-cpu-card"] [aria-label="Lock"]')
      .click();
    await page.locator('[data-vigilia-layer="wordmark"]').click();
    await page.locator('[data-vigilia-layer="group-cpu-card"]').click();

    await expect(
      page.locator(".vigilia-resolution").filter({
        hasText: "This object is locked. Unlock it to edit it.",
      }),
    ).toBeVisible();

    // Everything that writes is gone, so a question with nothing under it does
    // not stand a header over nothing: Spends is the only one left.
    expect(await sectionIds(page)).toEqual(["spends"]);
    await expect(page.locator("[data-vigilia-name]")).toHaveCount(0);
    await expect(page.locator("[data-vigilia-geometry]")).toHaveCount(0);
    await expect(page.locator("[data-vigilia-panel-fill]")).toHaveCount(0);

    // Read-only, so the author still sees what the object resolves to.
    await expect(
      page
        .locator('[data-vigilia-section="spends"] .vigilia-resolution')
        .first(),
    ).toBeVisible();
  });

  test("undoes a chart settings edit, in the column and on the canvas", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await page.waitForFunction(() => "vigiliaEditorBridge" in window);
    await selectStarterGauge(page);

    const thickness = page.locator('[data-vigilia-chart-setting="thickness"]');
    await expect(thickness).toBeVisible();
    const drawn = async (): Promise<number | undefined> => {
      const option = (await builtOption(page, "ram-gauge")) as {
        series: [{ progress?: { width?: number } }];
      };
      return option.series[0].progress?.width;
    };

    // The starter's own ring, so the numbers are the document's rather than a
    // value this test wrote.
    await expect(thickness).toHaveValue("20");
    expect(await drawn()).toBe(20);

    await thickness.fill("8");
    await thickness.blur();
    await expect(thickness).toHaveValue("8");
    await expect.poll(drawn).toBe(8);

    // One edit, one history entry: the settings write reaches `history.save()`
    // through the chart manager's own announcement, and nothing else does. Both
    // the canvas and the column have to come back.
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => thickness.inputValue(), { timeout: 10_000 })
      .toBe("20");
    await expect.poll(drawn).toBe(20);
  });

  test("captures the sectioned column a card gets", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await page.locator('[data-vigilia-layer="group-cpu-card"]').click();
    await openPosition(page);
    await expect(page.locator("[data-vigilia-geometry]").first()).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-inspector-card");
  });

  test("captures the sectioned column a shape gets", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await openBlank(page);
    await insert(page, "Rectangle");
    await expect(
      page.locator("[data-vigilia-panel-fill]").first(),
    ).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-inspector-shape");
  });

  test("captures the chart's column", async ({ page }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await selectStarterGauge(page);
    await expect(
      page.locator('[data-vigilia-chart-setting="thickness"]'),
    ).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-inspector-chart");
  });
});

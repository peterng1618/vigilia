import { expect, test } from "@playwright/test";
import {
  addCard,
  addChart,
  addColour,
  addText,
  choose,
  chooseToken,
  fill,
  insert,
  openBlank,
  openTab,
  place,
  readObject,
  readScene,
  selectLayer,
  setName,
} from "./rebuild-driver.js";

/**
 * The reference composition, rebuilt from a blank theme by hand.
 *
 * The target is `docs/superpowers/specs/2026-09-26-reference-theme-target.png`
 * at 1672 × 941. **The image is the reference.** No coordinate or value is taken
 * from the shipped theme: the whole point is to find what the authoring surface
 * cannot express, and copying the answer hides exactly that. Everything below
 * is measured off the picture, the way the original author did it.
 *
 * Every step is a pointer or a keystroke. The driver and the product share no
 * code and the driver writes no scene state — the scene is read through the
 * editor handle, never written — so a pass here is evidence about the surface
 * rather than about the driver.
 */

const SHOT = (name: string) => `test-results/rebuild/${name}.png`;

test.describe("the reference composition, built from blank", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#canvas-host canvas");
  });

  test("a blank theme offers everything the first card needs", async ({
    page,
  }) => {
    // Task 7, step 2: not whether it *works*, but whether an author landing on
    // an empty stage can tell what to do next. That is a finding either way.
    await openBlank(page);

    expect(await readScene(page)).toEqual([]);

    await page.getByRole("button", { name: "Add", exact: true }).click();
    const pane = page.locator('[data-vigilia-panel="add"]');
    await expect(pane.getByRole("button")).toHaveCount(13);
    await expect(pane.getByRole("group", { name: "Shape" })).toBeVisible();
    await expect(pane.getByRole("group", { name: "Chart" })).toBeVisible();

    // The inspector's own read of what the document offers, so "populated" is
    // measured rather than assumed.
    await openTab(page, "Style");
    const offered = await page
      .locator("[data-vigilia-resolution]")
      .allInnerTexts();
    expect(offered.length).toBeGreaterThanOrEqual(20);
    expect(offered.join(" ")).not.toContain("not set");

    await page.screenshot({ path: SHOT("01-blank") });
  });

  test("the wordmark, the strapline and the clock card", async ({ page }) => {
    await openBlank(page);

    // The blank theme's ten tokens carry no device colours, and the composition
    // is painted with four. The palette owns adding one, so that is the route.
    for (const [name, hex] of [
      ["CPU blue", "#3b9dff"],
      ["GPU violet", "#a970ff"],
      ["RAM teal", "#2fd6a8"],
      ["VRAM magenta", "#d24bf0"],
    ])
      await addColour(page, name, hex);

    await page.getByRole("button", { name: "Add", exact: true }).click();

    // V I G I L I A — tracked, light, top-left.
    await addText(page, {
      name: "wordmark",
      text: "V I G I L I A",
      x: 120,
      y: 62,
      w: 320,
      h: 46,
      preset: "typePresets.46-600",
      colour: "text",
    });

    // S Y S T E M   I N S I G H T S — smaller, tracked wider still.
    await addText(page, {
      name: "strapline",
      text: "S Y S T E M   I N S I G H T S",
      x: 122,
      y: 112,
      w: 300,
      h: 20,
      preset: "typePresets.17-400",
      colour: "dim",
    });

    // The clock card: a frosted panel, outlined, with a generous radius.
    await addCard(page, {
      name: "time-card",
      x: 40,
      y: 182,
      w: 368,
      h: 305,
      radius: 14,
      stroke: "Panel outline",
      blur: 40,
    });

    // 07:24 — the largest type in the composition.
    await addText(page, {
      name: "time",
      text: "07:24",
      x: 72,
      y: 244,
      w: 300,
      h: 90,
      preset: "typePresets.108-300",
      colour: "text",
    });

    // The rule under it. A `Path` takes its data as SVG commands, which is the
    // only way a hairline is drawn at all.
    await insert(page, "Path");
    await setName(page, "time-rule");
    await place(page, { x: 72, y: 352, w: 306, h: 2 });
    // A rule is a stroke, not a shape: a path arrives filled, and the Fill
    // picker's own "not set" is the only way to say so.
    await choose(page, "[data-vigilia-panel-fill]", "");
    await chooseToken(page, "[data-vigilia-panel-stroke]", "Rule");
    await fill(page, "[data-vigilia-panel-border]", 1);

    await addText(page, {
      name: "date",
      text: "Tue, Apr 23, 2024",
      x: 72,
      y: 372,
      w: 306,
      h: 34,
      preset: "typePresets.24-400",
      colour: "dim",
    });

    await page.screenshot({ path: SHOT("02-clock-region") });

    // The scene, read rather than asserted field by field: the question is
    // whether the objects landed where the picture says they go.
    const scene = await readScene(page);
    expect(scene.map((object) => object.name)).toEqual([
      "wordmark",
      "strapline",
      "time-card",
      "time",
      "time-rule",
      "date",
    ]);
    expect(await readObject(page, "wordmark")).toMatchObject({
      originX: "left",
      left: 120,
    });
    expect(await readObject(page, "time-card")).toMatchObject({
      left: 40,
      top: 182,
      renderedWidth: 368,
      renderedHeight: 305,
    });
  });

  test("a device card: the reading, its unit, and the sparkline beside it", async ({
    page,
  }) => {
    await openBlank(page);
    for (const [name, hex] of [
      ["CPU blue", "#3b9dff"],
      ["GPU violet", "#a970ff"],
      ["RAM teal", "#2fd6a8"],
      ["VRAM magenta", "#d24bf0"],
    ])
      await addColour(page, name, hex);
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await addCard(page, {
      name: "cpu-card",
      x: 420,
      y: 182,
      w: 280,
      h: 305,
      radius: 14,
      stroke: "Panel outline",
      blur: 40,
    });

    // The chip icon. A `Path` is the only shape that draws a glyph.
    await insert(page, "Path");
    await setName(page, "cpu-card-icon");
    await place(page, { x: 452, y: 218, w: 28, h: 28 });
    await choose(page, "[data-vigilia-panel-fill]", "");
    await chooseToken(page, "[data-vigilia-panel-stroke]", "CPU blue");
    await fill(page, "[data-vigilia-panel-border]", 2);

    await addText(page, {
      name: "cpu-card-title",
      text: "CPU",
      x: 494,
      y: 222,
      w: 120,
      h: 22,
      preset: "typePresets.24-400",
      colour: "dim",
    });

    // **32** and **%** — a reading and a unit on one object. This is the step
    // F2.1 was blocking: before the fix there was no way to add the second.
    await insert(page, "Text");
    await setName(page, "cpu-card-value");
    await place(page, { x: 448, y: 262, w: 220, h: 60 });
    await fill(page, '[data-vigilia-run-text="0"]', "32");
    await page
      .locator('[data-vigilia-run-preset="0"]')
      .selectOption("typePresets.60-600");
    await page
      .locator('[data-vigilia-run-colour="0"]')
      .selectOption("palette.text");
    await page
      .locator('[data-vigilia-run-source="0"]')
      .selectOption("cpu.load");
    await page.locator("[data-vigilia-run-add]").click();
    await fill(page, '[data-vigilia-run-text="1"]', "%");
    await page
      .locator('[data-vigilia-run-preset="1"]')
      .selectOption("typePresets.32-400");
    await page
      .locator('[data-vigilia-run-colour="1"]')
      .selectOption("palette.dim");
    await page.waitForTimeout(200);

    // A reading and a unit on one object, and the reading bound to a key.
    expect(await readObject(page, "cpu-card-value")).toMatchObject({
      vigiliaText: {
        runs: [
          { kind: "value", typePreset: "typePresets.60-600" },
          { kind: "literal", text: "%", typePreset: "typePresets.32-400" },
        ],
      },
    });

    // The sparkline, bound to the same key as the reading beside it — the
    // card must not be able to show a percentage and a waveform for two
    // different moments. F2.2 was blocking this.
    await addChart(page, {
      family: "Line",
      name: "cpu-card-sparkline",
      x: 436,
      y: 386,
      w: 248,
      h: 62,
      series: ["cpu.load"],
      paint: ["CPU blue"],
    });
    await openTab(page, "Design");
    await selectLayer(page, "cpu-card-value");

    await page.screenshot({ path: SHOT("03-cpu-card") });

    const scene = await readScene(page);
    expect(scene.map((object) => object.name)).toContain("cpu-card");
    expect(scene.map((object) => object.name)).toContain("cpu-card-sparkline");
  });
});

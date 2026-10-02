import path from "node:path";
import { expect, type Page } from "@playwright/test";
// `openPane` has one owner and one guard (`editor-pane-bar.js`); the driver
// imports it from there and does not re-export it, so this reaches the same
// place. It is imported from the driver rather than the owner in the import
// list below only because that list is the driver's.
import { openPane } from "./editor-pane-bar.js";
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
  selectLayer,
  setName,
} from "./rebuild-driver.js";

/**
 * The reference composition, as the eight steps that build it.
 *
 * **One owner, two proofs.** The region specs assert each region on its own
 * blank theme — that the surface can express this from nothing — while
 * `author-journey-display.spec.ts` runs all eight in *one* document and shows it
 * on a display. The composition is the same in both, and it lives here so the
 * two cannot drift into testing different things.
 *
 * The target is `docs/superpowers/specs/2026-09-26-reference-theme-target.png`.
 * **The image is the reference.** No coordinate or value is taken from the
 * shipped theme: the whole point is to find what the authoring surface cannot
 * express, and copying the answer hides exactly that. Everything here is
 * measured off the picture, the way the original author did it. Every step is a
 * pointer or a keystroke against a delivered control, and nothing writes scene
 * state.
 */

/**
 * The four device colours the composition is painted with. The blank theme's ten
 * tokens are the minimal set the plan's Product decisions chose — surfaces, a
 * rule and a text, no accents — so an author paints a device-coloured dashboard
 * by adding four tokens through the palette. That is the decision working, not
 * a gap, and these are this rebuild's own choices rather than the reference
 * theme's.
 */
export const DEVICE_COLOURS = [
  ["CPU blue", "#3b9dff"],
  ["GPU violet", "#a970ff"],
  ["RAM teal", "#2fd6a8"],
  ["VRAM magenta", "#d24bf0"],
] as const;

/** A chip or bar glyph, drawn as the path data the Path field takes. */
async function glyph(
  page: Page,
  name: string,
  box: { x: number; y: number; w: number; h: number },
  data: string,
  token: string,
): Promise<void> {
  await insert(page, "Path");
  await setName(page, name);
  await place(page, box);
  await choose(page, "[data-vigilia-panel-fill]", "");
  await chooseToken(page, "[data-vigilia-panel-stroke]", token);
  await fill(page, "[data-vigilia-panel-border]", 2);
  await fill(page, "[data-vigilia-shape-path]", data);
}

/** A chip: a square with pins on all four sides, as every device icon is. */
export function chip(size: number, pins: number): string {
  const edge = size * 0.25;
  const span = size * 0.5;
  const sides = Array.from({ length: pins }, (_, index) => {
    const t = (index + 1) / (pins + 1);
    const x = edge + span * t;
    const y = edge + span * t;
    const pin = size * 0.06;
    return [
      `M ${x - pin} ${edge - size * 0.11} L ${x + pin} ${edge - size * 0.11}`,
      `M ${x - pin} ${edge + span + size * 0.11} L ${x + pin} ${edge + span + size * 0.11}`,
      `M ${edge - size * 0.11} ${y - pin} L ${edge - size * 0.11} ${y + pin}`,
      `M ${edge + span + size * 0.11} ${y - pin} L ${edge + span + size * 0.11} ${y + pin}`,
    ].join(" ");
  });
  return [
    `M ${edge} ${edge} L ${edge + span} ${edge}`,
    `L ${edge + span} ${edge + span} L ${edge} ${edge + span} Z`,
    ...sides,
  ].join(" ");
}

/** The caption a card's reading carries, and the unit that follows it. */
async function reading(
  page: Page,
  name: string,
  box: { x: number; y: number; w: number; h: number },
  key: string,
): Promise<void> {
  await addText(page, {
    name,
    text: "00",
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    preset: "typePresets.60-600",
    colour: "text",
  });
  await selectLayer(page, name);
  // The run editor lives in Design, and a chart's settings live in Data — so
  // coming back from a chart is a tab click, the way an author does it.
  await openTab(page, "Design");
  await page.locator('[data-vigilia-run-source="0"]').selectOption(key);
  await page.locator("[data-vigilia-run-add]").click();
  await fill(page, '[data-vigilia-run-text="1"]', "%");
  await page
    .locator('[data-vigilia-run-preset="1"]')
    .selectOption("typePresets.32-400");
  await page
    .locator('[data-vigilia-run-colour="1"]')
    .selectOption("palette.dim");
}

/**
 * A blank document with the composition's own four colours in it, and the Add
 * pane open — the state every region below is built from.
 */
export async function openBlankComposition(page: Page): Promise<void> {
  await openBlank(page);
  for (const [name, hex] of DEVICE_COLOURS) await addColour(page, name, hex);
  await page.getByRole("button", { name: "Insert", exact: true }).click();
}

/** Wordmark, strapline and the clock card. */
export async function buildWordmarkAndClock(page: Page): Promise<void> {
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
  //
  // The box is **520**, not the 300 first typed here, and the change was found
  // on a display rather than in the editor: the tracked preset sets a glyph
  // advance of about 17.7 units, so 28 characters need roughly 500 and a 300
  // box truncated the line to "S Y S T E M   I N S I G" — the tail silently
  // gone, which no editor assertion would have caught.
  //
  // `text`, not `dim`: this line sits directly on the photograph with no card
  // behind it, and measured there `#a8bed0` reads **2.11:1** against the sky —
  // the same ink-versus-field pricing `0013` did for the frosted cards, on a
  // field the frosted cards were protecting. `text` takes it to 3.53:1, which
  // is the most any token in this palette can do on a saturated mid-cyan and is
  // still short of AA. The remaining gap is the photograph, not the ink.
  await addText(page, {
    name: "strapline",
    text: "S Y S T E M   I N S I G H T S",
    x: 122,
    y: 112,
    w: 520,
    h: 20,
    preset: "typePresets.17-400",
    colour: "text",
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

  // 07:24 — the largest type in the composition, and a reading rather than
  // the words. The run editor is where a run stops being prose: choosing an
  // instant key brings a Format and a Zone with it, which is where the
  // clock's own design lives.
  // **140, not 90.** A text object's overflow defaults to `"clip"`
  // (`renderer-core/src/scene/plan.ts:369`) and `applyClip` builds the clip at
  // exactly the authored box, so 108 px of type in a 90-unit box keeps the
  // middle of every digit — and a row of digits with their middles kept is a
  // solid bar. It rendered as one on the display, and the editor showed a Height
  // of 90 the whole time, which is the number the author typed rather than a
  // warning. See F2.18 in the plan; the product half is issue #9.
  await addText(page, {
    name: "time",
    text: "00:00",
    x: 72,
    y: 244,
    w: 300,
    h: 140,
    preset: "typePresets.108-300",
    colour: "text",
  });
  await selectLayer(page, "time");
  await page.locator('[data-vigilia-run-source="0"]').selectOption("time.now");
  await page.locator('[data-vigilia-run-format="0"]').fill("HH:mm");
  await page.locator('[data-vigilia-run-format="0"]').blur();
  // PM beside it, as its own run — the reason F2.1 was blocking.
  await page.locator("[data-vigilia-run-add]").click();
  await fill(page, '[data-vigilia-run-text="1"]', "PM");
  await page
    .locator('[data-vigilia-run-preset="1"]')
    .selectOption("typePresets.24-400");
  await page
    .locator('[data-vigilia-run-colour="1"]')
    .selectOption("palette.dim");

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
    text: "Mon, Jan 1, 2024",
    x: 72,
    y: 372,
    w: 306,
    h: 34,
    preset: "typePresets.24-400",
    colour: "dim",
  });
  await selectLayer(page, "date");
  await page
    .locator('[data-vigilia-run-source="0"]')
    .selectOption("date.today");
  await page.locator('[data-vigilia-run-format="0"]').fill("ddd, MMM D, YYYY");
  await page.locator('[data-vigilia-run-format="0"]').blur();
}

/** The CPU card: a frosted panel, an icon, a reading with its unit, a sparkline. */
export async function buildCpuCard(page: Page): Promise<void> {
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
  await page.locator('[data-vigilia-run-source="0"]').selectOption("cpu.load");
  await page.locator("[data-vigilia-run-add]").click();
  await fill(page, '[data-vigilia-run-text="1"]', "%");
  await page
    .locator('[data-vigilia-run-preset="1"]')
    .selectOption("typePresets.32-400");
  await page
    .locator('[data-vigilia-run-colour="1"]')
    .selectOption("palette.dim");
  await page.waitForTimeout(200);

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
}

/** The GPU card: the CPU card's shape, a second token and a caption. */
export async function buildGpuCard(page: Page): Promise<void> {
  await addCard(page, {
    name: "gpu-card",
    x: 714,
    y: 182,
    w: 290,
    h: 305,
    radius: 14,
    stroke: "Panel outline",
    blur: 40,
  });
  await glyph(
    page,
    "gpu-card-icon",
    { x: 746, y: 218, w: 28, h: 28 },
    chip(28, 2),
    "GPU violet",
  );
  await addText(page, {
    name: "gpu-card-title",
    text: "GPU",
    x: 788,
    y: 222,
    w: 120,
    h: 22,
    preset: "typePresets.24-400",
    colour: "dim",
  });
  await reading(
    page,
    "gpu-card-value",
    {
      x: 740,
      y: 262,
      w: 230,
      h: 60,
    },
    "gpu.load",
  );
  await addText(page, {
    name: "gpu-card-caption",
    text: "NVIDIA GeForce RTX 4080",
    x: 740,
    y: 344,
    w: 240,
    h: 24,
    preset: "typePresets.20-400",
    colour: "dim",
  });
  await addChart(page, {
    family: "Line",
    name: "gpu-card-sparkline",
    x: 730,
    y: 386,
    w: 258,
    h: 62,
    series: ["gpu.load"],
    paint: ["GPU violet"],
  });
  // A card sparkline has no axes in the target, and the family offers them.
  await openTab(page, "Data");
  await page.locator('[data-vigilia-chart-setting="showAxes"]').uncheck();
}

/** The two memory rings: a partial gauge and a closed one. */
export async function buildMemoryRings(page: Page): Promise<void> {
  await addCard(page, {
    name: "ram-card",
    x: 1018,
    y: 182,
    w: 302,
    h: 305,
    radius: 14,
    stroke: "Panel outline",
    blur: 40,
  });
  await glyph(
    page,
    "ram-card-icon",
    { x: 1050, y: 218, w: 28, h: 28 },
    chip(28, 3),
    "RAM teal",
  );
  await addText(page, {
    name: "ram-card-title",
    text: "RAM",
    x: 1092,
    y: 222,
    w: 120,
    h: 22,
    preset: "typePresets.24-400",
    colour: "dim",
  });
  await addChart(page, {
    family: "Gauge",
    name: "ram-gauge",
    x: 1069,
    y: 258,
    w: 200,
    h: 200,
    series: ["ram.used.percent"],
    paint: [undefined, "RAM teal"],
  });
  await openTab(page, "Data");
  // 270 degrees open at the bottom, which is the target's RAM ring.
  await fill(page, '[data-vigilia-chart-setting="startAngle"]', 135);
  await fill(page, '[data-vigilia-chart-setting="endAngle"]', 405);
  await fill(page, '[data-vigilia-chart-setting="thickness"]', 14);
  await page.locator('[data-vigilia-chart-setting="roundCap"]').check();
  await chooseToken(page, '[data-vigilia-chart-paint="track"]', "Chart track");
  await reading(
    page,
    "ram-value",
    { x: 1099, y: 348, w: 140, h: 56 },
    "ram.used.percent",
  );
  await addText(page, {
    name: "ram-capacity",
    text: "13.4 / 32 GB",
    x: 1058,
    y: 400,
    w: 220,
    h: 24,
    preset: "typePresets.20-400",
    colour: "dim",
  });

  // VRAM: the same card, a closed ring, a different colour.
  await addCard(page, {
    name: "vram-card",
    x: 1332,
    y: 182,
    w: 302,
    h: 305,
    radius: 14,
    stroke: "Panel outline",
    blur: 40,
  });
  await glyph(
    page,
    "vram-card-icon",
    { x: 1364, y: 218, w: 28, h: 28 },
    chip(28, 3),
    "VRAM magenta",
  );
  await addText(page, {
    name: "vram-card-title",
    text: "VRAM",
    x: 1406,
    y: 222,
    w: 120,
    h: 22,
    preset: "typePresets.24-400",
    colour: "dim",
  });
  await addChart(page, {
    family: "Gauge",
    name: "vram-gauge",
    x: 1383,
    y: 258,
    w: 200,
    h: 200,
    series: ["vram.used.percent"],
    paint: [undefined, "VRAM magenta"],
  });
  await fill(page, '[data-vigilia-chart-setting="startAngle"]', 90);
  await fill(page, '[data-vigilia-chart-setting="endAngle"]', -270);
  await fill(page, '[data-vigilia-chart-setting="thickness"]', 14);
  await page.locator('[data-vigilia-chart-setting="roundCap"]').check();
  await chooseToken(page, '[data-vigilia-chart-paint="track"]', "Chart track");
  await reading(
    page,
    "vram-value",
    { x: 1413, y: 348, w: 140, h: 56 },
    "vram.used.percent",
  );
  await addText(page, {
    name: "vram-capacity",
    text: "10.7 / 16 GB",
    x: 1372,
    y: 400,
    w: 220,
    h: 24,
    preset: "typePresets.20-400",
    colour: "dim",
  });
}

/** The trends panel: three series, three sensors, three tokens. */
export async function buildTrends(page: Page): Promise<void> {
  await addCard(page, {
    name: "trends-card",
    x: 296,
    y: 505,
    w: 828,
    h: 338,
    radius: 14,
    stroke: "Panel outline",
    blur: 40,
  });
  await glyph(
    page,
    "trends-card-icon",
    { x: 320, y: 536, w: 22, h: 22 },
    "M 0 20 L 6 20 L 6 8 L 12 8 L 12 14 L 18 14 L 18 2 L 22 2",
    "Chart track",
  );
  await addText(page, {
    name: "trends-card-title",
    text: "Performance Trends",
    x: 352,
    y: 534,
    w: 320,
    h: 26,
    preset: "typePresets.24-400",
    colour: "text",
  });
  // Three series, three sensors, three tokens — the shape the chart panel
  // could not reach at all before F2.2.
  await addChart(page, {
    family: "Line",
    name: "trends-chart",
    x: 350,
    y: 575,
    w: 740,
    h: 240,
    series: ["cpu.load", "gpu.load", "ram.used.percent"],
    paint: ["CPU blue", "GPU violet", "RAM teal"],
  });
  await openTab(page, "Data");
  await page.locator('[data-vigilia-chart-setting="showAxes"]').uncheck();
}

/** The storage bar: a value, its unit, one bound bar and a caption. */
export async function buildStorage(page: Page): Promise<void> {
  await addCard(page, {
    name: "storage-card",
    x: 1138,
    y: 505,
    w: 500,
    h: 168,
    radius: 14,
    stroke: "Panel outline",
    blur: 40,
  });
  await glyph(
    page,
    "storage-card-icon",
    { x: 1166, y: 536, w: 24, h: 24 },
    "M 2 6 L 22 6 L 22 22 L 2 22 Z M 2 11 L 22 11 M 7 17 L 9 17 M 12 17 L 14 17",
    "Chart track",
  );
  await addText(page, {
    name: "storage-card-title",
    text: "Storage",
    x: 1200,
    y: 534,
    w: 180,
    h: 26,
    preset: "typePresets.24-400",
    colour: "text",
  });
  await addText(page, {
    name: "storage-card-value",
    text: "56",
    x: 1490,
    y: 528,
    w: 120,
    h: 38,
    preset: "typePresets.36-500",
    colour: "text",
  });
  await selectLayer(page, "storage-card-value");
  await page.locator("[data-vigilia-run-add]").click();
  await fill(page, '[data-vigilia-run-text="1"]', "%");
  await page
    .locator('[data-vigilia-run-preset="1"]')
    .selectOption("typePresets.24-400");
  await page
    .locator('[data-vigilia-run-colour="1"]')
    .selectOption("palette.dim");
  await addChart(page, {
    family: "Bar",
    name: "storage-bar",
    x: 1160,
    y: 586,
    w: 450,
    h: 22,
    series: ["disk.used.percent"],
    paint: ["CPU blue"],
  });
  await openTab(page, "Data");
  await page.locator('[data-vigilia-chart-setting="showAxes"]').uncheck();
  await page
    .locator('[data-vigilia-chart-setting="showCategoryLabels"]')
    .uncheck();
  await addText(page, {
    name: "storage-card-name",
    text: "Games (D:)",
    x: 1166,
    y: 624,
    w: 260,
    h: 24,
    preset: "typePresets.20-400",
    colour: "dim",
  });
}

/** The network panel: two series, two keys, two tokens. */
export async function buildNetwork(page: Page): Promise<void> {
  await addCard(page, {
    name: "network-card",
    x: 1138,
    y: 688,
    w: 500,
    h: 155,
    radius: 14,
    stroke: "Panel outline",
    blur: 40,
  });
  await addText(page, {
    name: "network-card-title",
    text: "Network",
    x: 1200,
    y: 708,
    w: 180,
    h: 26,
    preset: "typePresets.24-400",
    colour: "text",
  });
  await addText(page, {
    name: "network-down",
    text: "72.4 Mbps",
    x: 1300,
    y: 710,
    w: 160,
    h: 22,
    preset: "typePresets.20-400",
    colour: "text",
  });
  await addText(page, {
    name: "network-up",
    text: "8.6 Mbps",
    x: 1460,
    y: 710,
    w: 160,
    h: 22,
    preset: "typePresets.20-400",
    colour: "dim",
  });
  await addChart(page, {
    family: "Line",
    name: "network-chart",
    x: 1160,
    y: 744,
    w: 450,
    h: 80,
    series: ["network.download", "network.upload"],
    paint: ["CPU blue", "GPU violet"],
  });
  await openTab(page, "Data");
  await page.locator('[data-vigilia-chart-setting="showAxes"]').uncheck();
}

/**
 * The whole composition, in one document, in the order a reader meets it.
 *
 * The regions do not overlap, so one blank theme carries all eight: the claim
 * this makes is not that each region is expressible alone, which the region
 * specs prove, but that the surface carries the finished thing — which is the
 * only claim a display can check.
 */
export async function buildComposition(page: Page): Promise<void> {
  await buildWordmarkAndClock(page);
  await buildCpuCard(page);
  await buildGpuCard(page);
  await buildMemoryRings(page);
  await buildTrends(page);
  await buildStorage(page);
  await buildNetwork(page);
}

/**
 * The backdrop, through the controls an author has.
 *
 * Two of them, in the order an author would: **Import asset** in the Assets
 * pane (F0.4's control, the visible button that opens the file chooser), then
 * **Background media** in the artboard panel. The file is a test input, not a
 * fixture — nothing here writes a declaration, and the id the package keys the
 * asset by is minted by the editor.
 */
export async function importBackdrop(page: Page, file: string): Promise<void> {
  await openPane(page, "Assets");
  const chooser = page.waitForEvent("filechooser");
  await page.locator("[data-vigilia-asset-import]").click();
  await (await chooser).setFiles(file);
  // The pane lists the asset by the file the author chose while the package
  // keys it by an id the editor minted: that is the pair F0.4's fix made
  // readable, and the id is what the artboard panel stores. The label is the
  // file's own name, derived here rather than hardcoded — a helper that
  // guessed the name would pass on one photograph and fail on the next.
  const label = path.basename(file);
  const select = page.locator("[data-vigilia-asset-select]");
  await expect
    .poll(async () => select.locator("option").allInnerTexts())
    .toContain(label);
  const assetId = await select
    .locator("option")
    .filter({ hasText: label })
    .getAttribute("value");

  // **Design**, not Data: the artboard panel is a *document* panel, and the
  // shell mounts it in the Design tab with the comment "a selection must not
  // make the theme's own settings unreachable". Data is the chart host, where
  // the select exists in the DOM but inside a `display: none` tab panel — so
  // the wrong tab is a 10-minute timeout, not a clear failure.
  await openTab(page, "Design");
  const media = page.locator("[data-vigilia-background-asset]");
  await media.scrollIntoViewIfNeeded();
  await media.selectOption(assetId ?? "");
  const fit = page.locator("[data-vigilia-background-media-fit]");
  await fit.scrollIntoViewIfNeeded();
  await fit.selectOption("cover");
}

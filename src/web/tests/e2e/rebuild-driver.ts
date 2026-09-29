import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Driving the editor the way an author does.
 *
 * Every helper here is a pointer or a keystroke against a delivered control.
 * The scene is **read** through the editor handle and never written: if a step
 * needed `page.evaluate` to set a value, that would be a finding about the
 * surface rather than a technique, and the proof of the surface would be void.
 */

export type SceneObject = {
  readonly id: string;
  readonly name: string | undefined;
  readonly type: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type FabricObjectLike = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  type: string;
  get(name: string): unknown;
};

/** What the scene holds, read through the handle. */
export async function readScene(page: Page): Promise<SceneObject[]> {
  return page.evaluate(() => {
    // The global is `vigilia-fabric-editor-N` and **N is per instance**:
    // creating a document tears the editor down and the old name is removed
    // rather than left stale, so a handle cached across a `New` reads as a live
    // document after it is gone. Resolved here, at every use.
    const handle = Object.values(window).find(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        "canvas" in value &&
        "historyManager" in value,
    ) as { canvas: { getObjects(): FabricObjectLike[] } } | undefined;
    if (handle === undefined) return [];
    return handle.canvas.getObjects().map((object) => ({
      id: String(object.get("id") ?? ""),
      name: object.get("name") as string | undefined,
      type: object.type,
      left: Math.round(object.left ?? 0),
      top: Math.round(object.top ?? 0),
      width: Math.round((object.width ?? 0) * (object.scaleX ?? 1)),
      height: Math.round((object.height ?? 0) * (object.scaleY ?? 1)),
    }));
  });
}

/** What one object carries, read through the handle. */
export async function readObject(
  page: Page,
  name: string,
): Promise<Record<string, unknown> | undefined> {
  return page.evaluate((wanted) => {
    const handle = Object.values(window).find(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        "canvas" in value &&
        "historyManager" in value,
    ) as { canvas: { getObjects(): FabricObjectLike[] } } | undefined;
    const object = handle?.canvas
      .getObjects()
      .find((candidate) => candidate.get("name") === wanted);
    if (object === undefined) return undefined;
    return {
      id: object.get("id"),
      name: object.get("name"),
      type: object.type,
      originX: (object as { originX?: string }).originX,
      left: Math.round(object.left ?? 0),
      top: Math.round(object.top ?? 0),
      renderedWidth: Math.round((object.width ?? 0) * (object.scaleX ?? 1)),
      renderedHeight: Math.round((object.height ?? 0) * (object.scaleY ?? 1)),
      text: (object as { text?: string }).text,
      vigiliaText: object.get("vigiliaText"),
      vigiliaPaint: object.get("vigiliaPaint"),
      vigiliaGlass: object.get("vigiliaGlass"),
      settings: object.get("settings"),
    };
  }, name);
}

/**
 * A blank theme at the size the reference composition is drawn at, opened
 * through the real `New` menu and the real chooser.
 */
export async function openBlank(
  page: Page,
  ratio = "16:9",
  resolution = "1080p",
): Promise<void> {
  await page.getByRole("button", { name: "File", exact: true }).click();
  // `role="menuitem"`, never `[role=menu] button`: a closed menu stays in the
  // DOM and that selector matches a stale menu's items.
  await page.getByRole("menuitem", { name: "New theme", exact: true }).click();
  const chooser = page.locator("dialog[open]", {
    hasText: "Choose an artboard size",
  });
  await expect(chooser).toBeVisible();
  await chooser
    .locator("[data-vigilia-new-document-ratio]")
    .selectOption(ratio);
  await chooser
    .locator("[data-vigilia-new-document-resolution]")
    .selectOption(resolution);
  await chooser.locator("[data-vigilia-new-document-create]").click();

  // A document the author has not touched is still dirty — the editor opens on
  // the starter — so replacing it asks. Correct, and it is a second step.
  const discard = page.getByRole("button", { name: "Discard", exact: true });
  if (await discard.isVisible().catch(() => false)) await discard.click();
  await expect.poll(async () => (await readScene(page)).length).toBe(0);
}

/** The rail pane an author opens, clicked only when it is not already showing. */
export async function openRailPane(page: Page, pane: string): Promise<void> {
  const button = page.getByRole("button", { name: pane, exact: true });
  // The active entry closes the panel, so a helper that always clicked would
  // make the pane untestable — the defect F1.28's agent found in the suite.
  if (
    (await button.getAttribute("aria-expanded")) !== "false" &&
    (await button.getAttribute("aria-pressed")) === "true"
  )
    return;
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
}

export async function openTab(page: Page, tab: string): Promise<void> {
  await page.getByRole("tab", { name: tab, exact: true }).click();
}

/** The button in the Add pane that makes an object, by the word on it. */
export function addButton(page: Page, label: string): Locator {
  return page
    .locator('[data-vigilia-panel="add"] button')
    .filter({ hasText: new RegExp(`^${label}$`) });
}

/** Inserts an object from the Add pane, by the word on the control. */
export async function insert(page: Page, label: string): Promise<void> {
  const before = (await readScene(page)).length;
  const button = addButton(page, label);
  // "Line" is a shape and a chart, and the legend above each is what tells them
  // apart — the same distinction F1.17 made the screen.
  await ((await button.count()) > 1 ? button.last() : button).click();
  await expect
    .poll(async () => (await readScene(page)).length)
    .toBeGreaterThan(before);
}

/** Selects an object by clicking its row in the layer list. */
export async function selectLayer(page: Page, name: string): Promise<void> {
  await openRailPane(page, "Layers");
  await page.getByRole("treeitem").filter({ hasText: name }).first().click();
}

/** Types into a control the way an author does, and commits it on blur. */
export async function fill(
  page: Page,
  selector: string,
  value: string | number,
): Promise<void> {
  const control = page.locator(selector).first();
  await control.scrollIntoViewIfNeeded();
  await control.fill(String(value));
  await control.blur();
}

export async function choose(
  page: Page,
  selector: string,
  value: string,
): Promise<void> {
  const control = page.locator(selector).first();
  await control.scrollIntoViewIfNeeded();
  await control.selectOption(value);
}

const GEOMETRY = {
  x: "left",
  y: "top",
  w: "width",
  h: "height",
} as const;

/** Places and sizes the selection, in whole artboard units. */
export async function place(
  page: Page,
  box: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  },
): Promise<void> {
  for (const [key, value] of [
    [GEOMETRY.x, box.x],
    [GEOMETRY.y, box.y],
    [GEOMETRY.w, box.w],
    [GEOMETRY.h, box.h],
  ] as const) {
    await fill(page, `[data-vigilia-geometry="${key}"]`, value);
  }
}

export async function setName(page: Page, value: string): Promise<void> {
  await fill(page, "[data-vigilia-name]", value);
}

/** A frosted card: the material the reference composition is built from. */
export async function frost(page: Page, blur: number): Promise<void> {
  const toggle = page.locator("[data-vigilia-glass-enabled]").first();
  await toggle.scrollIntoViewIfNeeded();
  if (!(await toggle.isChecked())) await toggle.check();
  await fill(page, "[data-vigilia-glass-blur]", blur);
}

/** A palette token: what every colour in the composition resolves through. */
export async function addColour(
  page: Page,
  name: string,
  hex: string,
): Promise<void> {
  await page.getByRole("button", { name: "Add colour", exact: true }).click();
  await fill(page, "[data-vigilia-palette-name]", name);
  await fill(page, "[data-vigilia-palette-color]", hex);
}

/**
 * Picks a token by the name the author gave it.
 *
 * The pickers list tokens by their display name and store `palette.<id>`, and
 * the two are not the same string: a token added through the panel is minted
 * `colour`, `colour-2`, `colour-3`. So the driver resolves the option a person
 * reads and selects the value behind it, exactly as clicking it would.
 */
export async function chooseToken(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  const control = page.locator(selector).first();
  await control.scrollIntoViewIfNeeded();
  const value = await control
    .locator("option")
    .filter({ hasText: label })
    .first()
    .getAttribute("value");
  if (value === null || value === "")
    throw new Error(`no token named "${label}" in ${selector}`);
  await control.selectOption(value);
}

/** A text object, placed, with its first run's words. */
export async function addText(
  page: Page,
  object: {
    readonly name: string;
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly preset?: string;
    readonly colour?: string;
  },
): Promise<void> {
  await insert(page, "Text");
  await setName(page, object.name);
  await place(page, object);
  await fill(page, '[data-vigilia-run-text="0"]', object.text);
  if (object.preset !== undefined)
    await choose(page, '[data-vigilia-run-preset="0"]', object.preset);
  if (object.colour !== undefined)
    await choose(page, '[data-vigilia-run-colour="0"]', object.colour);
}

/** A card: a rectangle, named, placed, frosted and outlined. */
export async function addCard(
  page: Page,
  card: {
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly blur?: number;
    readonly radius?: number;
    readonly stroke?: string;
  },
): Promise<void> {
  await insert(page, "Rectangle");
  await setName(page, card.name);
  await place(page, card);
  if (card.radius !== undefined)
    await fill(page, "[data-vigilia-panel-radius]", card.radius);
  if (card.stroke !== undefined)
    await chooseToken(page, "[data-vigilia-panel-stroke]", card.stroke);
  if (card.blur !== undefined) await frost(page, card.blur);
}

/** A chart, bound to one or more sensors, with its own paint. */
export async function addChart(
  page: Page,
  chart: {
    readonly family: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly series: readonly string[];
    readonly paint?: ReadonlyArray<string | undefined>;
  },
): Promise<void> {
  await insert(page, chart.family);
  await setName(page, chart.name);
  await place(page, chart);
  await openTab(page, "Data");
  for (const key of chart.series) {
    await page.locator("[data-vigilia-chart-binding-add]").selectOption(key);
  }
  for (const [index, token] of (chart.paint ?? []).entries()) {
    if (token === undefined) continue;
    const key = PAINT_KEY[chart.family];
    await chooseToken(
      page,
      `[data-vigilia-chart-paint="${key}${key === "palette" ? `.${index}` : ""}"]`,
      token,
    );
  }
}

/**
 * The paint field each family paints its data through, as
 * `chartPaintFieldsFor` declares it. A family's *series* palette is the one
 * that repeats, so its key is the base and the index is the slot.
 */
const PAINT_KEY: Readonly<Record<string, string>> = {
  Gauge: "progress",
  Line: "stroke",
  Bar: "fill",
  Pie: "palette",
};

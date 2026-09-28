import { expect, type Page, test } from "@playwright/test";

/**
 * Every control the theme-settings, palette and type-preset panels render has
 * the name a screen reader reads, measured by a real accessibility tree.
 *
 * The unit test beside these panels asks the DOM what it can answer. This asks
 * Chromium, which is the only thing that settles whether a control is *named*:
 * a label element that exists, is visible and is associated with nothing
 * satisfies every DOM assertion and announces nothing at all.
 *
 * The panels are audited together for the reason F1.19 was filed: the defect was
 * in all three, and a per-panel test would let the next unnamed control be a new
 * finding rather than a red run.
 */

const EDITOR = "http://127.0.0.1:4174/";

const PANELS = ["Theme settings", "Palette", "Type presets"];

/** Every control these panels can render, in the states that render them all. */
const CONTROLS = [
  // Theme settings
  "[data-vigilia-theme-name]",
  "[data-vigilia-theme-author]",
  "[data-vigilia-theme-description]",
  "[data-vigilia-theme-language]",
  "[data-vigilia-theme-language-sample]",
  "[data-vigilia-theme-version]",
  "[data-vigilia-artboard-fit-mode]",
  "[data-vigilia-artboard-ratio]",
  "[data-vigilia-artboard-orientation]",
  "[data-vigilia-artboard-resolution]",
  "[data-vigilia-artboard-background]",
  "[data-vigilia-artboard-bar-color]",
  "[data-vigilia-background-asset]",
  "[data-vigilia-background-media-fit]",
  "[data-vigilia-artboard-width]",
  "[data-vigilia-artboard-height]",
  // Palette
  "[data-vigilia-palette-token]",
  "[data-vigilia-palette-name]",
  "[data-vigilia-palette-kind]",
  "[data-vigilia-palette-color]",
  "[data-vigilia-palette-angle]",
  "[data-vigilia-palette-stop-offset]",
  "[data-vigilia-palette-stop-color]",
  "[data-vigilia-palette-replacement]",
  "[data-vigilia-palette-delete]",
  // Type presets
  "[data-vigilia-type-preset]",
  "[data-vigilia-type-name]",
  "[data-vigilia-type-family]",
  "[data-vigilia-type-size]",
  "[data-vigilia-type-weight]",
  "[data-vigilia-type-line-height]",
  "[data-vigilia-type-letter-spacing]",
  "[data-vigilia-font-face]",
  "[data-vigilia-font-trio]",
  "[data-vigilia-type-replacement]",
  "[data-vigilia-type-delete]",
];

/** The name Chromium computes for a control, or "" when it computes none.
    `ariaSnapshot` renders Playwright's own accessible-name engine, whose
    output is `- <role> "<name>": <value>`. */
async function accessibleName(page: Page, selector: string): Promise<string> {
  const snapshot = (await page.locator(selector).first().ariaSnapshot()).trim();
  return /^-\s*[a-z]+\s*"([^"]*)"/i.exec(snapshot)?.[1] ?? "";
}

test.describe("the settings panels name every control", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR);
    await page.waitForSelector("[data-vigilia-panel]");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    // The gradient and delete branches render controls a solid token does not,
    // so the audit has to open the same branches an author opens. A token with
    // other tokens to reassign to is what puts the delete row on screen.
    await page.locator("[data-vigilia-palette-token]").selectOption("cpu");
    await page.locator("[data-vigilia-type-preset]").selectOption("20-500");
  });

  test("no control is unnamed", async ({ page }) => {
    const unnamed: string[] = [];
    const measured: string[] = [];
    for (const selector of CONTROLS) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) continue;
      measured.push(selector);
      if ((await accessibleName(page, selector)) === "") unnamed.push(selector);
    }
    // The gradient, the delete controls and every field really rendered: a
    // short list would mean the audit passed by not looking.
    expect(measured.length).toBeGreaterThanOrEqual(30);
    expect(unnamed).toEqual([]);
  });

  test("the release version is a named status, not a label naming nothing", async ({
    page,
  }) => {
    // An `output` is a status region, not a form control: nothing an author
    // types ever reaches it, so it is named rather than wrapped in a field.
    // The role is asserted with it because a name on the wrong role would
    // still be read, and the role is what says it is a value, not a field.
    const snapshot = await page
      .locator("[data-vigilia-theme-version]")
      .ariaSnapshot();
    expect(snapshot.trim()).toMatch(/^- status "Release version"/);
  });

  test("each panel's chooser says what it lists", async ({ page }) => {
    expect(await accessibleName(page, "[data-vigilia-palette-token]")).toBe(
      "Colour token",
    );
    expect(await accessibleName(page, "[data-vigilia-type-preset]")).toBe(
      "Type preset",
    );
  });

  test("the three panels are the ones the audit claims to cover", async ({
    page,
  }) => {
    const headings = await page.locator("section h2").allTextContents();
    expect(headings.filter((text) => PANELS.includes(text.trim()))).toEqual(
      PANELS,
    );
  });
});

import { expect, type Page, test } from "@playwright/test";
import { openPane } from "./editor-rail.js";
import { isDesktopSurface } from "./surface.js";

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

/** The Tokens pane's controls, in the states that render them all. */
const TOKENS_CONTROLS = [
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

/** The Document pane's controls: the artboard panel's theme settings. */
const DOCUMENT_CONTROLS = [
  "[data-vigilia-theme-name]",
  "[data-vigilia-theme-author]",
  "[data-vigilia-theme-description]",
  "[data-vigilia-theme-language]",
  "[data-vigilia-theme-language-sample]",
  "[data-vigilia-theme-version]",
  "[data-vigilia-artboard-ratio]",
  "[data-vigilia-artboard-orientation]",
  "[data-vigilia-artboard-resolution]",
  "[data-vigilia-artboard-background]",
  "[data-vigilia-artboard-bar-color]",
  "[data-vigilia-background-asset]",
  "[data-vigilia-background-media-fit]",
  "[data-vigilia-artboard-width]",
  "[data-vigilia-artboard-height]",
];

/** The header's shell palette, which is not one of the three panels but lost
    its name when the `<select aria-label="Shell palette">` became a menu: the
    trigger announces its own content, and its content is the current value. */
const HEADER_CONTROL = "[data-vigilia-palette]";

/** The name Chromium computes for a control, or "" when it computes none.
    `ariaSnapshot` renders Playwright's own accessible-name engine, whose
    output is `- <role> "<name>": <value>`. */
async function accessibleName(page: Page, selector: string): Promise<string> {
  const snapshot = (await page.locator(selector).first().ariaSnapshot()).trim();
  return (
    /^-\s*[a-z]+\s*"([^"]*)"/i.exec(snapshot)?.[1] ??
    // A name containing ": " makes the YAML emitter quote the whole node, so
    // it arrives as `- 'button "<name>"': <value>` and the anchored form above
    // reads nothing. Still a role and still a quoted name inside the quotes,
    // so a quoted *value* on an unnamed control is not mistaken for a name.
    /^-\s*'[a-z]+\s*"([^"]*)"'/i.exec(snapshot)?.[1] ??
    ""
  );
}

test.describe("the settings panels name every control", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // The panels live in the inspector, which the shell's own CSS drops below
    // 980px, so on a phone these controls have no box to be pressed at and the
    // audit would be reporting on a panel no author can reach. Measured: the
    // panel opens at 240px wide and the select inside it is 0x0.
    test.skip(
      !isDesktopSurface(testInfo),
      "the settings panels are hidden below 980px",
    );
    await page.goto(EDITOR);
    await page.waitForSelector("[data-vigilia-panel]");
    // The palette and type-preset panels are the Tokens pane's; the theme
    // settings (artboard, metadata, background) are the Document pane's. Both
    // live in the left column, hidden until their slot is asked for — not
    // behind a tab in the inspector. This opens the pane most cases read; a
    // case that needs the Document pane opens it itself.
    await openPane(page, "Tokens");
    // The gradient and delete branches render controls a solid token does not,
    // so the audit has to open the same branches an author opens. A token with
    // other tokens to reassign to is what puts the delete row on screen.
    await page.locator("[data-vigilia-palette-token]").selectOption("cpu");
    await page.locator("[data-vigilia-type-preset]").selectOption("20-500");
  });

  test("no control is unnamed", async ({ page }) => {
    const unnamed: string[] = [];
    const measured: string[] = [];
    const audit = async (selectors: readonly string[]): Promise<void> => {
      for (const selector of selectors) {
        const locator = page.locator(selector).first();
        if ((await locator.count()) === 0) continue;
        measured.push(selector);
        if ((await accessibleName(page, selector)) === "")
          unnamed.push(selector);
      }
    };

    // The three panels span two panes now: the palette and type presets in
    // Tokens, the theme settings in Document. Each is measured with its own
    // pane open, because a control inside a hidden pane is out of the
    // accessibility tree and measuring it there would report a name it does
    // not announce. Tokens is open from the setup.
    await audit(TOKENS_CONTROLS);
    await audit([HEADER_CONTROL]);
    await openPane(page, "Document");
    await audit(DOCUMENT_CONTROLS);

    // The gradient, the delete controls and every field really rendered: a
    // short list would mean the audit passed by not looking.
    expect(measured.length).toBeGreaterThanOrEqual(30);
    expect(unnamed).toEqual([]);
  });

  test("the release version is a named status, not a label naming nothing", async ({
    page,
  }) => {
    // The version control is the artboard panel's, so it is in Document.
    await openPane(page, "Document");
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
    // Both choosers are the Tokens pane's, open from the setup.
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
    // The set, not the order: the theme settings and the tokens now live in
    // different panes' hosts, so their DOM order is the hosts' and not the
    // list's.
    expect(
      headings.filter((text) => PANELS.includes(text.trim())).sort(),
    ).toEqual([...PANELS].sort());
  });
});

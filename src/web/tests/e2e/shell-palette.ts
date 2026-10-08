import { expect, type Page } from "@playwright/test";

/** The editor, served by the preview projects. */
export const EDITOR = "http://127.0.0.1:4174/";

/** The palette popup, named rather than class-matched: the View menu carries
 *  the same class and stays mounted-but-closed beside it, so the class alone is
 *  a strict-mode violation the moment two of them exist. */
export const PALETTE_POPUP =
  '.editor-shell-menu-popup[aria-label="Shell palette"]';

/** Read from the same list the editor uses, so a palette added there cannot
 *  escape a sweep over it. Kept as a literal because a spec file cannot import
 *  the editor package; `shellPalettes` in `editor-shell/palette.ts` is the
 *  owner, and this is the only copy of it on the test side. */
export const PALETTES = [
  "editorial",
  "graphite",
  "ember",
  "moss",
  "plum",
  "light",
] as const;

export type Palette = (typeof PALETTES)[number];

/** The editor, loaded once. A spec then switches palettes through the menu,
 *  which is the route an author takes and costs no reload — the editor boots a
 *  whole Fabric session per load, and six of those is past the test budget. */
export async function openShell(page: Page): Promise<void> {
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
}

/** Choose a palette the way an author does: open the menu, click the entry.
 *
 *  The menu is closed with Escape rather than left to the selection: Base UI
 *  keeps a radio menu open so several entries can be compared before dismissing
 *  it, so selecting is not what closes it. Asserts the attribute rather than
 *  trusting the click, so a menu that failed to apply the choice fails here
 *  rather than six assertions later against whatever was in force. */
export async function choosePalette(
  page: Page,
  palette: Palette,
): Promise<void> {
  await page.locator("[data-vigilia-palette]").click();
  const popup = page.locator(PALETTE_POPUP);
  await expect(popup).toBeVisible();
  await popup
    .getByRole("menuitemradio", { name: palette, exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-shell-palette",
    palette,
  );
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
}

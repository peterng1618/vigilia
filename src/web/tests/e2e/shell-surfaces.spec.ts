import { expect, test } from "@playwright/test";
import { selectLayer } from "./rebuild-driver.js";
import { choosePalette, openShell, PALETTES } from "./shell-palette.js";
import { isDesktopSurface } from "./surface.js";

/**
 * The hand-owned surfaces the palette has to reach anyway.
 *
 * **Neither family here is a React primitive and neither is migrated.** The
 * three native `<dialog>`s (`new-document-chooser.ts`, `persistence-manager/`,
 * `theme-library-dialog.ts`) are DOM factories styled by `.vigilia-dialog`, and
 * the inspector's sections are a native `<details>` (`controls/property-section.ts`).
 * 0033's argument for the tooltip applies unchanged to both, and §8's table row
 * for `collapsible` is discharged by that owner rather than by a Radix one.
 *
 * They are also the surfaces a palette change is most likely to break, because
 * each paints from the shell's tokens through a class rather than through the
 * attribute — and a `<dialog>` in the top layer is not a descendant of `#app`,
 * so it is the layer most likely to miss. This file exists to pin what the
 * palette pipeline reaches, in a browser, where the cascade is real.
 *
 * Split from `shell-appearance.spec.ts` rather than appended to it: that file
 * carries the pipeline, this one carries what the pipeline reaches, and together
 * they would have passed the 500-line signal the repo uses for a source file.
 */

test("the dialogs and the inspector's sections paint every palette", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(120_000);

  await openShell(page);

  // Selected once rather than per palette: the column only renders sections for
  // a selection, and with nothing selected it correctly says where to choose
  // from instead — which is a different assertion, not this one. A top-level
  // group, because the starter's cards are nested inside these and a collapsed
  // row is not a clickable one.
  //
  // The column needs no pane opened: unlike Layers and Assets it is not a
  // segment of the pane bar, it is the right column and is always mounted.
  await selectLayer(page, "group-cpu-card");
  const section = page.locator(".vigilia-section-details").first();
  await expect(section).toBeVisible();

  for (const palette of PALETTES) {
    await choosePalette(page, palette);

    // The New-theme chooser, opened the way an author opens it and closed with
    // Escape. It is a `<dialog>` in the top layer, so it is the one place a
    // shell token can be in force and still not reach the surface drawn from it.
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "New theme", exact: true })
      .click();
    const dialog = page.locator("dialog[open]", {
      hasText: "Choose an artboard size",
    });
    await expect(dialog).toBeVisible();
    const dialogPaints = await dialog.evaluate((node) => {
      const style = getComputedStyle(node);
      return `${style.backgroundColor}|${style.color}`;
    });
    expect(
      dialogPaints,
      `the ${palette} chooser painted neither a surface nor an ink`,
    ).not.toBe("|");
    expect(
      dialogPaints,
      `the ${palette} chooser paints a different surface from the chrome that opened it`,
    ).toBe(await shellHeaderPaints(page));
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // The inspector's own disclosure, a native `<details>` whose summary is
    // painted by the shell's tokens rather than by a primitive library.
    const summaryInk = await section
      .locator("summary")
      .first()
      .evaluate((node) => getComputedStyle(node).color);
    expect(
      summaryInk,
      `the ${palette} inspector section is invisible against its own panel`,
    ).not.toBe("rgba(0, 0, 0, 0)");
    expect(
      summaryInk,
      `the ${palette} inspector section has no ink at all`,
    ).not.toBe("");
  }
});

/** The chrome's own surface and ink, read as one string so a palette that
 *  changed both is still comparable to a dialog in one assertion. */
function shellHeaderPaints(
  page: import("@playwright/test").Page,
): Promise<string> {
  return page.locator(".editor-shell-header").evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.backgroundColor}|${style.color}`;
  });
}

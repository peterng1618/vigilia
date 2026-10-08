import { expect, type Locator, type Page, test } from "@playwright/test";
import { openPane } from "./editor-rail.js";
import { isDesktopSurface } from "./surface.js";

/**
 * The Add pane, now the one surface the insertable list is reached from.
 *
 * These two journeys were `insert-popover.spec.ts`'s, carried over when the
 * header's Insert menu and the pane bar's `+` were deleted (§7.1: Insert lives
 * in the Add pane). Neither lost anything by the move — both already drove the
 * pane — and what the deleted file proved is kept: the pane offers the whole
 * `insertGroups()` list, and a card inserted from it arrives as a unit the tree
 * can name.
 */

const EDITOR = "http://127.0.0.1:4174/";

/** The words neither half may be described by (spec `:537`). */
const REFUSED = ["fallback", "advanced", "basic", "simple", "expert"];

/** The pane that carries the insertable list. */
function addPane(page: Page): Locator {
  return page.locator('[data-vigilia-panel="add"]');
}

test("the Add pane offers units and primitives, neither greyed, neither a fallback", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);

  // The `+` chooser and the Insert menu both left, so the pane is now the one
  // surface the insert list is reached from. Its own copy is unchanged: units
  // and primitives, neither greyed.
  await openPane(page, "Add");
  const pane = addPane(page);
  await expect(pane).toBeVisible();
  for (const heading of ["Card", "Shape", "Chart"]) {
    await expect(pane.getByRole("group", { name: heading })).toBeVisible();
  }

  // Every control the pane offers is usable, whichever group it comes from.
  const controls = pane.getByRole("button");
  await expect(controls).not.toHaveCount(0);
  for (const item of await controls.all()) {
    await expect(item).toBeEnabled();
  }

  // Neither half is greyed, and neither is described as one.
  const spoken = await pane.locator("legend, button").allTextContents();
  for (const word of REFUSED) {
    expect(spoken.join(" ").toLowerCase()).not.toContain(word);
  }
});

test("a card inserted from the Add pane arrives as a unit the tree can name", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await openPane(page, "Add");
  await addPane(page)
    .getByRole("button", { name: "Clock", exact: true })
    .click();

  await openPane(page, "Composition");
  await expect(
    page.locator(
      '[data-vigilia-layer="card-group-time-card"] .vigilia-layer-role',
    ),
  ).toHaveText("Clock");
});

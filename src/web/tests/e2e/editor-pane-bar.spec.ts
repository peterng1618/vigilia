import { expect, test } from "@playwright/test";
import { openPane } from "./editor-pane-bar.js";
import { isDesktopSurface } from "./surface.js";

/**
 * The contract of the shared `openPane` helper, against the real editor.
 *
 * The pane bar is a toggle, so the helper this suite hands to 28 call sites is
 * only correct if it reads the state first. When it did not, every call site
 * that asked for the pane already showing closed it instead, and the failure
 * landed as a timeout in an unrelated assertion rather than as anything naming
 * the helper. These two cases are the whole contract: asking twice is still
 * open, and asking for a pane that is shut is still open.
 */

const EDITOR = "http://127.0.0.1:4174/";

test("asking for the pane already showing leaves it showing", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  await openPane(page, "Insert");
  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();

  // The second ask is the whole test. An unconditional click closes the pane
  // the first one opened, and the caller is left waiting for a control that has
  // left the accessibility tree.
  await openPane(page, "Insert");

  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();
  await expect(page.locator(".editor-shell-panel")).toBeVisible();
});

test("asking for a shut pane opens it, and asking again does not close it", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  // Shut first, by the product's own route: clicking the segment for the pane
  // showing. A helper that skipped its click when the pane was open must still
  // click when it is shut, or "open" would be a no-op that happened to pass.
  await page
    .locator(".editor-shell-pane-bar")
    .getByRole("button", { name: "Layers", exact: true })
    .click();
  await expect(page.locator('[data-vigilia-panel="layers"]')).toBeHidden();

  await openPane(page, "Insert");
  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();
  await expect(page.locator(".editor-shell-panel")).toBeVisible();

  await openPane(page, "Insert");
  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();
  await expect(page.locator(".editor-shell-panel")).toBeVisible();
});

test("a collapse between two swaps does not lose the list's scroll", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  // The browser pin for the collapse-and-restore bug, and the only one that
  // can catch it: jsdom has no layout, so its `scrollTop` round-trips a value
  // written while the element is `hidden`, where a browser answers 0. Read the
  // offset back off the element rather than assuming the write landed, so a
  // list that is not scrollable fails here instead of passing vacuously.
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  const list = page.locator(".editor-shell-panel");
  const offset = await list.evaluate((node) => {
    node.scrollTop = 300;
    return node.scrollTop;
  });
  expect(offset, "the layer list is long enough to scroll").toBeGreaterThan(0);

  // Close the panel the product's own way, then look at Assets and come back.
  await page
    .locator(".editor-shell-pane-bar")
    .getByRole("button", { name: "Layers", exact: true })
    .click();
  await expect(list).toBeHidden();

  await openPane(page, "Assets");
  await expect(page.locator("[data-vigilia-asset-import]")).toBeVisible();
  await openPane(page, "Layers");
  await expect(page.locator('[data-vigilia-panel="layers"]')).toBeVisible();

  await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBe(offset);
});

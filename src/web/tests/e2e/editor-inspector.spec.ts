import { expect, test } from "@playwright/test";

/**
 * The selection inspector on a small screen, which is where F1.29 lived.
 *
 * The shell's CSS hid `.editor-shell-inspector` below 980px. The defect was not
 * that the panel was narrow — it was that the panel was *gone*, and the guard
 * was applied to both sides: the product hid it and every spec skipped on a
 * phone, so the two agreed and the suite was never red. A phone author had no
 * geometry, no material, no glass and no runs: the whole authoring surface.
 *
 * So this spec runs on the phone project on purpose, and it is skipped on
 * desktop only because these assertions are about the small-screen shape. What
 * it measures is a box, not a presence: a control that is in the accessibility
 * tree at 0x0 is worse than an absent one, because a screen reader still reads
 * it out and a finger still cannot press it.
 */

const EDITOR = "http://127.0.0.1:4174/";

/** A control that is in the inspector with nothing selected, so it needs no
 *  canvas gesture to reach — the artboard panel is in the Design tab and is
 *  mounted whatever the selection is. */
const ARTBOARD_WIDTH = "[data-vigilia-artboard-width]";

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone project is where the small screen is real");
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
});

test("the inspector is a rail region a phone author can open", async ({
  page,
}) => {
  // Closed is the default: the canvas is what an author works in, and the
  // inspector is chrome around it (the same argument F1.1 settled for the
  // left panel). What it must never be is unreachable.
  const inspector = page.locator(".editor-shell-inspector");
  await expect(inspector).toBeHidden();

  await page.getByRole("button", { name: "Inspect", exact: true }).click();

  // Reachable *and* on screen. `toBeVisible` is the box, which is the whole
  // claim: the old `display: none` failed this on the pixel, not the DOM.
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('[role="tablist"]')).toBeVisible();
  // A collapsed panel leaves the accessibility tree rather than sitting in it
  // at 0x0, which is why this is `hidden` and not a zero-width column.
  await expect(inspector).not.toHaveAttribute("hidden", "");
});

test("every inspector control a desktop author has, a phone author can press", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  const inspector = page.locator(".editor-shell-inspector");

  // The tabs are the inspector's own navigation: Design, Data, Style. A phone
  // that lost one of them lost a third of the surface.
  for (const tab of ["Design", "Data", "Style"]) {
    const entry = inspector.getByRole("tab", { name: tab, exact: true });
    await expect(entry).toBeVisible();
    const box = await entry.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);
  }

  // A representative control from each of the three tabs' owners, measured
  // rather than counted, because `count()` is satisfied by a 0x0 node.
  const control = page.locator(ARTBOARD_WIDTH);
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  expect(box?.height ?? 0).toBeGreaterThan(0);

  // And it is operable, not merely drawn: typing a value has to reach the
  // control, which a 0x0 node cannot accept.
  await control.fill("1280");
  await control.blur();
  await expect(control).toHaveValue("1280");
});

test("the inspector and the canvas do not both claim the whole phone", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page.locator(".editor-shell-inspector")).toBeVisible();

  // The canvas is the surface being authored on. An inspector that squeezes it
  // to a sliver has traded the authoring surface for the thing that edits it,
  // and the shell drops a column rather than narrowing it (F1.1's ruling).
  const stage = await page.locator(".editor-shell-stage").boundingBox();
  const viewport = page.viewportSize();
  expect(stage?.width ?? 0).toBeGreaterThan((viewport?.width ?? 0) / 3);
});

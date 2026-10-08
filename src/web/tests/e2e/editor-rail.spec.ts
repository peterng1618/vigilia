import { expect, test } from "@playwright/test";
import { openPane } from "./editor-rail.js";
import { selectLayer } from "./rebuild-driver.js";
import { isDesktopSurface } from "./surface.js";

/**
 * The contract of the shared `openPane` helper, against the real editor.
 *
 * The rail is a toggle, so the helper this suite hands to its call sites is
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

  await openPane(page, "Add");
  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();

  // The second ask is the whole test. An unconditional click closes the pane
  // the first one opened, and the caller is left waiting for a control that has
  // left the accessibility tree.
  await openPane(page, "Add");

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

  // Shut first, by the product's own route: clicking the slot for the pane
  // showing. A helper that skipped its click when the pane was open must still
  // click when it is shut, or "open" would be a no-op that happened to pass.
  await page
    .locator(".editor-shell-rail")
    .getByRole("button", { name: "Composition", exact: true })
    .click();
  await expect(page.locator('[data-vigilia-panel="layers"]')).toBeHidden();

  await openPane(page, "Add");
  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();
  await expect(page.locator(".editor-shell-panel")).toBeVisible();

  await openPane(page, "Add");
  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();
  await expect(page.locator(".editor-shell-panel")).toBeVisible();
});

test("shows the theme's own panel in the left column, and swaps away from it", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  // The artboard panel's width field stands for the document host: the artboard
  // and the document-references panels append into that one node, so a control
  // of either being reachable is the host having moved into the pane rather
  // than into the inspector's tab.
  await openPane(page, "Document");
  await expect(page.locator("[data-vigilia-artboard-width]")).toBeVisible();

  // Swapping the slot hides the whole host rather than unmounting it, and
  // coming back must not have left it behind — the pane is the slot's, not a
  // tab's.
  await openPane(page, "Add");
  await expect(page.locator("[data-vigilia-artboard-width]")).toBeHidden();

  await openPane(page, "Document");
  await expect(page.locator("[data-vigilia-artboard-width]")).toBeVisible();
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

  // **The premise, not the guard, is what grouping invalidated.** The guard —
  // read the offset back rather than assuming the write landed, so a list that
  // cannot scroll fails here instead of passing vacuously — is the point of the
  // test and is untouched. What changed is the fixture: ten collapsed cards
  // genuinely no longer overflow a 721px panel, so the guard was being asked
  // about a document the starter stopped being. Opening every group restores a
  // tree long enough to scroll *and* keeps the guard's teeth: a panel that
  // stopped laying out rows at all still fails this.
  const twisties = page.locator(
    '[data-vigilia-layer] button[aria-label^="Expand"]',
  );
  for (let opened = await twisties.count(); opened > 0; opened -= 1) {
    await twisties.first().click();
  }

  const list = page.locator(".editor-shell-panel");
  const offset = await list.evaluate((node) => {
    node.scrollTop = 300;
    return node.scrollTop;
  });
  expect(offset, "the layer list is long enough to scroll").toBeGreaterThan(0);

  // Close the pane the product's own way, then look at Add and come back.
  await page
    .locator(".editor-shell-rail")
    .getByRole("button", { name: "Composition", exact: true })
    .click();
  await expect(list).toBeHidden();

  await openPane(page, "Add");
  await expect(page.locator("[data-vigilia-asset-import]")).toBeVisible();
  await openPane(page, "Composition");
  await expect(page.locator('[data-vigilia-panel="layers"]')).toBeVisible();

  await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBe(offset);
});

/** §7.7's desktop-density proof, for the one cluster the rail's column can
 *  starve. **Reachability, not visibility.**
 *
 *  The dock is a fixed 639px row of every object and arrange action, centred on
 *  the stage. The rail's 46px column is taken off the stage's width, so the row
 *  no longer fitted: `.editor-shell-stage`'s `overflow: hidden` clipped its ends
 *  and `elementFromPoint` at `Duplicate`'s centre answered the layer panel next
 *  door. Playwright reported that as a 30-second hover timeout three specs away
 *  from the cause, which is why the assertion here is the hit test rather than
 *  a bounding box: a control drawn outside its stage is `visible` to Playwright
 *  and unclickable to an author.
 *
 *  The three configurations are §7.7's own. The third is a viewport rather than
 *  a root `zoom`, because 200% browser zoom halves the CSS viewport — that is
 *  what the shell's media queries answer, and a `zoom` on the root leaves the
 *  layout viewport at 1280 while the fixed 46/360/280 columns stop adapting. */
test("every dock control stays reachable with the rail's column in place", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(120_000);

  for (const view of [
    { name: "1280×720", width: 1280, height: 720 },
    { name: "1440×900", width: 1440, height: 900 },
    {
      name: "640×360, the CSS viewport 200% zoom gives",
      width: 640,
      height: 360,
    },
  ]) {
    await page.setViewportSize({ width: view.width, height: view.height });
    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    // A group rather than a card: the object half of the dock is a filtered
    // registry, and a group carries the most actions, so this is the widest the
    // row gets.
    await selectLayer(page, "group-cpu-card");
    const dock = page.locator("[data-vigilia-canvas-toolbar]");
    await expect(dock).toBeVisible();

    const unreachable = await dock.evaluate((node) =>
      [...node.querySelectorAll("button")].flatMap((button) => {
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        // Containment, not equality: the point lands on the button's own glyph,
        // and a `<path>` inside the control is still the control.
        if (hit !== null && (button === hit || button.contains(hit))) return [];
        return [
          `${button.getAttribute("aria-label")} is under ${hit?.tagName ?? "nothing"}`,
        ];
      }),
    );
    expect(
      unreachable,
      `${view.name}: a dock control is drawn where nothing can click it`,
    ).toEqual([]);

    // And the cluster sits inside the stage at all: §7.5's 14px is the least a
    // cluster clears its stage's edges by, and the overrun this pinned is what
    // put the row outside them.
    const insets = await page.evaluate(() => {
      const stage = document.querySelector(".editor-shell-stage");
      const box = document.querySelector(".editor-shell-dock");
      if (stage === null || box === null) throw new Error("no dock");
      const outer = stage.getBoundingClientRect();
      const inner = box.getBoundingClientRect();
      return {
        left: Math.round(inner.left - outer.left),
        right: Math.round(outer.right - inner.right),
      };
    });
    expect(
      Math.min(insets.left, insets.right),
      `${view.name}: the dock overruns its stage`,
    ).toBeGreaterThanOrEqual(14);
  }
});

/**
 * The panes' chrome starts at one offset, whichever slot is showing.
 *
 * `editor-shell.css` drops a 12px `margin-top` on the sections inside a pane,
 * and a pane is excluded from that rule. When the exclusion was keyed on the
 * *absence* of `data-vigilia-panel` and the attribute was written conditionally,
 * three of the four panes were not excluded: their title bar, body and footer
 * sat 12px lower than the Composition pane's. No gate can see it — jsdom has no
 * layout, so the defect exists only in a rendered box — which is why this is a
 * browser case and why it measures a position rather than counting elements.
 *
 * The panes are measured one at a time because only the chosen slot's pane is
 * laid out; the others are `hidden`.
 */
test("every pane's title bar sits at the same top offset", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  const tops: [string, number][] = [];
  for (const slot of ["Composition", "Add", "Tokens", "Document"]) {
    await openPane(page, slot);
    const title = page.locator(
      ".editor-shell-pane:not([hidden]) > .editor-shell-pane-title",
    );
    await expect(title, `${slot} is the pane showing`).toHaveCount(1);
    const box = await title.boundingBox();
    expect(box, `${slot} draws a title bar`).not.toBeNull();
    tops.push([slot, Math.round(box?.y ?? Number.NaN)]);
  }

  const baseline = tops[0]?.[1];
  expect(
    tops.map(([, y]) => y),
    `title-bar tops: ${tops.map(([slot, y]) => `${slot} ${y}`).join(", ")}`,
  ).toEqual(tops.map(() => baseline));
});

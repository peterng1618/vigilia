import { expect, type Locator, type Page, test } from "@playwright/test";
import { openPane } from "./editor-pane-bar.js";
import { isDesktopSurface } from "./surface.js";

const EDITOR = "http://127.0.0.1:4174/";

/** The words neither half may be described by (spec `:537`). */
const REFUSED = ["fallback", "advanced", "basic", "simple", "expert"];

/** One surface's groups, as the headings an author reads and the labels under
 *  them: the entries that stand alone first, then each labelled group. The same
 *  shape `shell-layout.dom.test.tsx`'s `paneGroups` and `menuGroupsIn` return, so
 *  the comparison is of two renderings of one list and not of two DOM idioms. */
type SurfaceGroups = readonly (readonly [string | null, readonly string[]])[];

/** The Add pane's own groups. A `<fieldset>` carries no `role` attribute — its
 *  `group` role and its name are both implicit — so the heading is read from the
 *  `legend` rather than from `aria-label`, which the pane's fieldsets never set. */
async function paneGroups(pane: Locator): Promise<SurfaceGroups> {
  return pane.evaluate((element) => {
    const text = (node: Element): string => node.textContent?.trim() ?? "";
    return [
      [
        null,
        Array.from(element.children)
          .filter((child) => child.tagName === "BUTTON")
          .map(text),
      ],
      ...Array.from(element.querySelectorAll<HTMLElement>("fieldset")).map(
        (fieldset): [string | null, string[]] => [
          fieldset.querySelector("legend")?.textContent?.trim() ?? null,
          Array.from(fieldset.querySelectorAll("button")).map(text),
        ],
      ),
    ];
  });
}

/** A menu popup's groups, read the way Base UI renders them: `role=group` named
 *  by `aria-labelledby`, which points at the group's own label element. */
async function menuGroups(popup: Locator): Promise<SurfaceGroups> {
  return popup.evaluate((element) => {
    const items = Array.from(
      element.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    const text = (node: Element): string => node.textContent?.trim() ?? "";
    return [
      [
        null,
        items.filter((item) => item.closest("[role=group]") === null).map(text),
      ],
      ...Array.from(element.querySelectorAll<HTMLElement>("[role=group]")).map(
        (group): [string | null, string[]] => [
          document
            .getElementById(group.getAttribute("aria-labelledby") ?? "")
            ?.textContent?.trim() ?? null,
          items
            .filter((item) => item.closest("[role=group]") === group)
            .map(text),
        ],
      ),
    ];
  });
}

function popupOf(page: Page): Locator {
  return page.locator(".editor-shell-menu-popup[data-open]");
}

async function openChooser(page: Page): Promise<void> {
  const plus = page.locator(".editor-shell-pane-bar-add");
  await expect(plus).toBeEnabled();
  await plus.click();
}

test("the + offers units and primitives, neither greyed, neither a fallback", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);

  // The pane first: it starts shut (the shell opens on Layers), and its segment
  // is outside the chooser — clicking it with the menu up would dismiss it.
  await openPane(page, "Insert");
  const pane = page.locator('[data-vigilia-panel="add"]');
  await expect(pane).toBeVisible();
  for (const heading of ["Card", "Shape", "Chart"]) {
    await expect(pane.getByRole("group", { name: heading })).toBeVisible();
  }

  await openChooser(page);
  const popup = popupOf(page);

  // Every control the menu offers is usable, whichever half it comes from.
  await expect(popup.getByRole("menuitem")).not.toHaveCount(0);
  for (const item of await popup.getByRole("menuitem").all()) {
    await expect(item).toBeEnabled();
  }

  // The list is the pane's own list, read from the pane rather than restated: a
  // hard-coded count here is a spec that breaks on the day a card is added and
  // proves nothing on the day one is dropped.
  expect(await menuGroups(popup)).toEqual(await paneGroups(pane));

  // Neither half is greyed, and neither is described as one.
  const spoken = (
    await pane.locator("legend, button").allTextContents()
  ).concat(await popup.getByRole("menuitem").allTextContents());
  for (const word of REFUSED) {
    expect(spoken.join(" ").toLowerCase()).not.toContain(word);
  }
});

test("a card inserted from the + arrives as a unit the tree can name", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await openChooser(page);
  await popupOf(page)
    .getByRole("menuitem", { name: "Clock", exact: true })
    .click();

  await openPane(page, "Layers");
  await expect(
    page.locator(
      '[data-vigilia-layer="card-group-time-card"] .vigilia-layer-role',
    ),
  ).toHaveText("Clock");
});

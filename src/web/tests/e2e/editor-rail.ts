import { type Locator, type Page } from "@playwright/test";

/** §7.7's scroller, and `vg-208`'s ruling: the showing pane's **body**, not the
 *  column around it — the column clips, so reading it would pass whatever the
 *  pane drew. Scoped to the pane's column so a `Pane` elsewhere in the shell
 *  cannot answer. */
export const PANE_BODY =
  ".editor-shell-panel .editor-shell-pane:not([hidden]) > .editor-shell-pane-body";

/** The box `PANE_BODY` names, for a case that scrolls or measures it. */
export function paneBody(page: Page): Locator {
  return page.locator(PANE_BODY);
}

/** Every group opened, so the layer tree is long enough to scroll: ten collapsed
 *  cards no longer overflow a 721px panel, and a list that fits proves nothing
 *  about a scroller. Counted down so a tree that keeps producing twisties cannot
 *  spin. */
export async function openEveryGroup(page: Page): Promise<void> {
  const twisties = page.locator(
    '[data-vigilia-layer] button[aria-label^="Expand"]',
  );
  for (let opened = await twisties.count(); opened > 0; opened -= 1) {
    await twisties.first().click();
  }
}

/** The rail's slot for one pane.
 *
 *  Scoped to the rail because "Add" is two controls' names while the Insert
 *  menu still exists: this suite's slot and the menu trigger Task 3 removes.
 *  An unscoped `getByRole` is a strict-mode violation the day they differ by a
 *  rename rather than by a deletion. */
function railSlot(page: Page, name: string): Locator {
  return page
    .locator(".editor-shell-rail")
    .getByRole("button", { name, exact: true });
}

/**
 * Shows the pane behind `name`, leaving a pane that is already showing alone.
 *
 * The slot for the open pane closes the column, so the click is a toggle
 * rather than a navigation, and an unconditional one closes what the caller
 * just opened. Every call site means "show me this", and the two facts that
 * decide it are on the two elements that own them: `aria-pressed` names the
 * chosen slot, and the rail's own `data-collapsed` says whether the column is
 * out. A pane is showing only when both hold.
 */
export async function openPane(page: Page, name: string): Promise<void> {
  const slot = railSlot(page, name);
  const showing =
    (await slot.getAttribute("aria-pressed")) === "true" &&
    (await page
      .locator(".editor-shell-rail")
      .getAttribute("data-collapsed")) === "false";
  if (showing) return;
  await slot.click();
}

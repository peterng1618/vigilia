import { type Locator, type Page } from "@playwright/test";

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
    (await page.locator(".editor-shell-rail").getAttribute("data-collapsed")) ===
      "false";
  if (showing) return;
  await slot.click();
}

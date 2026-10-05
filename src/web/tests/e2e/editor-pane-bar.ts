import { type Locator, type Page } from "@playwright/test";

/** The pane bar's segment for one pane.
 *
 *  Scoped to the bar because "Insert" is two controls' names while the Insert
 *  menu still exists: this suite's segment and the menu trigger Task 3 removes.
 *  An unscoped `getByRole` is a strict-mode violation the day they differ by a
 *  rename rather than by a deletion. */
function paneSegment(page: Page, name: string): Locator {
  return page
    .locator(".editor-shell-pane-bar")
    .getByRole("button", { name, exact: true });
}

/**
 * Shows the pane behind `name`, leaving a pane that is already showing alone.
 *
 * The segment for the visible pane closes the panel, so the click is a toggle
 * rather than a navigation and an unconditional one closes what the caller just
 * opened. Every call site means "show me this", and the state that decides it
 * is on the segment: `aria-pressed` names the chosen pane and `aria-expanded`
 * says the panel is out. A pane is showing only when it is both.
 */
export async function openPane(page: Page, name: string): Promise<void> {
  const segment = paneSegment(page, name);
  const showing =
    (await segment.getAttribute("aria-pressed")) === "true" &&
    (await segment.getAttribute("aria-expanded")) === "true";
  if (showing) return;
  await segment.click();
}

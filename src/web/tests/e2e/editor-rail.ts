import { type Locator, type Page } from "@playwright/test";

/** The rail entry for one area. */
function railEntry(page: Page, name: string): Locator {
  return page.getByRole("button", { name, exact: true });
}

/**
 * Shows the rail pane behind `name`, leaving a pane that is already showing
 * alone.
 *
 * The entry for the visible pane closes the panel, so the click is a toggle
 * rather than a navigation and an unconditional one closes what the caller just
 * opened. Every call site means "show me this", and the state that decides it
 * is on the entry: `aria-pressed` names the chosen pane and `aria-expanded` says
 * the panel is out. A pane is showing only when it is both.
 */
export async function openRailPane(page: Page, name: string): Promise<void> {
  const entry = railEntry(page, name);
  const showing =
    (await entry.getAttribute("aria-pressed")) === "true" &&
    (await entry.getAttribute("aria-expanded")) === "true";
  if (showing) return;
  await entry.click();
}

/**
 * Shows the selection inspector, leaving one that is already showing alone.
 *
 * A separate helper because the state that decides it is not the same state:
 * the inspector is a region rather than one of four interchangeable panes, so
 * its entry carries `aria-expanded` and no `aria-pressed`. Read through
 * `openRailPane`'s test it would never be "showing", and every call would be an
 * unconditional click — which closes what the caller just opened, the exact
 * failure F1.28 was filed for.
 */
export async function openInspector(page: Page): Promise<void> {
  const entry = railEntry(page, "Inspect");
  if ((await entry.getAttribute("aria-expanded")) === "true") return;
  await entry.click();
}

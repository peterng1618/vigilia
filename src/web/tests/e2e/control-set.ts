import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Driving plan 1's control set, the way an author does.
 *
 * Three controls stopped being native while the inspector was rewritten, and
 * every suite that drove them still drove the native one:
 *
 * - a `<select>` became Base UI's select: a `button[role=combobox]` that opens
 *   a listbox portalled to `body`. `selectOption` reports *"Element is not a
 *   `<select>` element"* and an option that was never rendered cannot be found
 *   by `locator("option")` at all;
 * - a bounded number became a slider whose nested `input[type=range]` is the
 *   focus target and whose well is a `<span>` readout. `click()` on that input
 *   **times out** — Base UI's control div intercepts the pointer — so a
 *   click-then-type helper waits 30 seconds and reports nothing;
 * - a section became a disclosure whose header is a button carrying
 *   `aria-expanded`, not a native `<details>` with an `.open` property.
 *
 * None of the three is a product defect. Each is a locator that no longer names
 * what it names, which is why the suite has to say the new one rather than the
 * product grow the old one back.
 */

/** The value a plan-1 select shows: the label of what is chosen, in the well. */
export async function choiceOf(control: Locator): Promise<string> {
  return control.locator(".font-mono").first().innerText();
}

/** The values a plan-1 select offers, read from its opened popup — it renders
 *  none until it is opened. Values, not labels, for the same reason
 *  {@link chooseIn} takes one. */
export async function optionsOf(
  page: Page,
  control: string | Locator,
): Promise<string[]> {
  const options = await openList(page, control);
  const values = await options.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-vigilia-option") ?? ""),
  );
  await page.keyboard.press("Escape");
  return values;
}

/**
 * Opens a plan-1 select and hands back **its own** option list.
 *
 * Scoped by the `aria-controls` the trigger already carries: Base UI leaves a
 * closed popup in the document while it animates out, so a bare
 * `[role=option]` lookup finds two `palette.text` rows when one picker is
 * opened straight after another — which is exactly what an author does.
 */
async function openList(
  page: Page,
  control: string | Locator,
): Promise<Locator> {
  const trigger =
    typeof control === "string" ? page.locator(control).first() : control;
  if ((await trigger.count()) === 0) {
    throw new Error(`no control matches ${String(control)} on this selection`);
  }
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const list = await trigger.getAttribute("aria-controls");
  const options =
    list === null
      ? page.getByRole("option")
      : page.locator(`#${list} [role="option"]`);
  await expect(options.first()).toBeVisible();
  return options;
}

/**
 * Picks the option whose value is `value` — the id the control commits, not the
 * label it prints.
 *
 * **By value, because the label is document data.** A picker's options are the
 * theme's own tokens and presets, named by their author (`palette.text` prints
 * `Text`, `typePresets.24-400` prints `Card title`); matching on those words
 * would copy the document's glossary into the suite, and the `Text` / `Muted
 * text` pair is a substring collision besides. `control-select.tsx` puts
 * `data-vigilia-option` on each `Select.Item` for exactly this, so the string a
 * locator names and the string the control commits are one string — the rule the
 * `data-vigilia-*` hooks already keep.
 */
export async function chooseIn(
  page: Page,
  control: string | Locator,
  value: string,
): Promise<void> {
  const trigger =
    typeof control === "string" ? page.locator(control).first() : control;
  if ((await trigger.count()) === 0) {
    throw new Error(`no control matches ${String(control)} on this selection`);
  }
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  // Scoped to **this** trigger's listbox. Base UI leaves a closed popup in the
  // document while it animates out, so a bare `[role=option]` lookup finds two
  // `palette.text` rows when one picker is opened straight after another — and
  // `aria-controls` is the id the trigger already names its own list by.
  const list = await trigger.getAttribute("aria-controls");
  const option =
    list === null
      ? page.locator(`[role="option"][data-vigilia-option="${value}"]`)
      : page.locator(
          `#${list} [role="option"][data-vigilia-option="${value}"]`,
        );
  await expect(option).toHaveCount(1);
  await option.click();
}

/**
 * Replaces a field's value: click-and-type for a text or number input, and
 * `fill` for a slider.
 *
 * The slider branch is not a shortcut. Its nested `input[type=range]` sits
 * inside a control `div` that takes the pointer, so `click()` never lands and
 * the whole test spends its budget waiting. `fill` sets the value and fires the
 * `input` the primitive commits on.
 *
 * A value past either end **lands on that end**, read off the control's own
 * `min`/`max`: that is the bound the field declares, and it is also what the
 * pre-plan `numberField` did — clamped to the bound it crossed rather than
 * reverting, so the author who types past the ceiling is taught where it is.
 * Playwright refuses an out-of-range `fill` outright ("Malformed value"), so
 * the clamp is also what makes the case expressible at all.
 */
export async function typeIntoControl(
  page: Page,
  field: Locator,
  value: string | number,
): Promise<void> {
  await field.scrollIntoViewIfNeeded();
  if ((await field.getAttribute("type")) === "range") {
    const max = Number(await field.getAttribute("max"));
    const min = Number(await field.getAttribute("min"));
    const numeric = Number(value);
    const landed = Number.isFinite(numeric)
      ? Math.min(Math.max(numeric, min), max)
      : numeric;
    await field.fill(String(landed));
    await field.blur();
    return;
  }
  await field.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(String(value));
  await page.keyboard.press("Tab");
}

/** Whether a section's disclosure is open. The header is the button (§5). */
export async function sectionExpanded(
  page: Page,
  id: string,
): Promise<boolean> {
  const header = page
    .locator(`[data-vigilia-section="${id}"] button[aria-expanded]`)
    .first();
  return (await header.getAttribute("aria-expanded")) === "true";
}

/** Opens a section's disclosure if it is closed. */
export async function openSection(page: Page, id: string): Promise<void> {
  const header = page
    .locator(`[data-vigilia-section="${id}"] button[aria-expanded]`)
    .first();
  if ((await header.count()) === 0) return;
  if ((await header.getAttribute("aria-expanded")) === "true") return;
  await header.click();
}

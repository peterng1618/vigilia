import { expect, type Page } from "@playwright/test";
import { PALETTES, type Palette } from "./shell-palette.js";
import { focusedWithin, tabToMark } from "./walkthrough-focus.js";

/**
 * The settings modal's keyboard vocabulary: the two of §13.1's interactions
 * that live in one popup — §4's shell palette and the shortcut capture — and the
 * route that reaches them.
 *
 * Split out of `walkthrough-shell.ts` on Ruling L's own principle, when Task 4's
 * helpers took that module past AGENTS.md's 800-line stop: this is one surface,
 * a modal opened from the rail's gear, with a primitive of its own (a tab list
 * whose inactive panels unmount, a radio group with roving focus, an armed row),
 * where `walkthrough-shell.ts` holds the shell's panes and the gestures an author
 * makes in them. Nothing here reached for a pointer, and `walkthrough-focus.ts`
 * is where focus is observed.
 */

/** §7's settings modal and the rail's gear that opens it (`rail.tsx`,
 *  `components/ui/dialog.tsx`). */
const SETTINGS_DIALOG = ".editor-shell-dialog";
const SETTINGS_GEAR = "data-rail-settings";
/** The Appearance tab's six palette cards, each marked with the palette it
 *  offers (`settings.tsx`). */
const PALETTE_CHOICE = "data-vigilia-palette-choice";
/** The same attribute as a query for any of the six cards, which is how a tab
 *  is asked whether it is the one showing: `PALETTE_CHOICE` is a bare attribute
 *  name, and a bare name is a **tag** selector to `page.locator`, which matches
 *  nothing and would read every tab as the wrong one. */
const PALETTE_CARDS = `[${PALETTE_CHOICE}]`;
/** The Keyboard tab's own tree, which exists only while that tab is showing:
 *  Base UI unmounts an inactive panel, so its presence *is* the tab's answer
 *  and a tab's word is not needed to ask. */
const KEYBOARD_TAB = "[data-vigilia-keyboard]";
/** A binding row's own pieces (`settings-keyboard.tsx`): the control that arms
 *  the capture, the row the capture listens in, and the chord it prints. */
const SHORTCUT_ARM = "data-vigilia-shortcut-arm";
const SHORTCUT_ROW = "data-vigilia-shortcut-row";
const SHORTCUT_CHORD = "data-vigilia-shortcut-chord";
/** The settings modal, opened from the rail's gear with no pointer.
 *
 *  Idempotent: two of §13.1's interactions live in this one popup — the palette
 *  and the shortcut capture — so the second caller finds it already open rather
 *  than tabbing at a page its own modal has made inert. (The gear would be
 *  unreachable anyway: the modal traps focus inside itself.)
 *
 *  On the open it takes, it asserts the popup's focus the same way
 *  `openPopup` does — Review Focus 3, asked of the surface §13.1's palette
 *  is chosen in. */
export async function openSettingsByKeyboard(page: Page): Promise<void> {
  const dialog = page.locator(SETTINGS_DIALOG);
  if (await dialog.isVisible()) return;
  await tabToMark(page, { attribute: SETTINGS_GEAR });
  await page.keyboard.press("Enter");
  await expect(
    dialog,
    "the settings modal after Enter on the gear",
  ).toBeVisible();
  expect(
    await focusedWithin(page, SETTINGS_DIALOG),
    "the settings modal opened with focus inside it rather than left on its gear",
  ).toBe(true);
}

/** Brings the settings modal to the tab whose label is `label`, with no pointer.
 *
 *  The tab list is Base UI's `Tabs`, a roving-focus group: Tab reaches the
 *  *selected* tab and the arrow keys move between them, **vertically** —
 *  `settings.tsx` gives the list `orientation="vertical"`, which is what points
 *  the arrows up and down its three rows. **And it is in manual-activation
 *  mode**: no `activateOnFocus` is passed, so an arrow moves focus without
 *  opening the panel (`measured in a browser: ArrowDown leaves `aria-selected`
 *  where it was and the Keyboard panel unmounted`), and `Enter` is the key that
 *  selects. An inactive panel is unmounted, which is why the tab is asked for by
 *  the marker only its own content carries, and why that asking waits: a panel
 *  mounts a render after the key.
 *
 *  **The tab is picked by its label, and the direction read from the drawn
 *  order** — the same shape `choosePalette` uses to pick a card, and for the
 *  same reason. A helper that assumed the modal opened on the tab it wanted
 *  would be right only while no other helper had moved it; `cancelShortcutCapture`
 *  leaves the Keyboard tab selected, and the modal remounts on Appearance after
 *  its Escape, so the two callers have to be independent rather than ordered. */
async function activateTab(
  page: Page,
  label: string,
  marker: string,
): Promise<void> {
  await tabToMark(page, { attribute: "role", value: "tab" });
  const labels: readonly string[] = await page.evaluate(() =>
    [
      ...document.querySelectorAll('.editor-shell-settings-tabs [role="tab"]'),
    ].map((tab) => (tab.textContent ?? "").trim()),
  );
  const target = labels.indexOf(label);
  if (target < 0) {
    throw new Error(
      `no settings tab named ${label} (saw ${labels.join(", ")})`,
    );
  }
  for (let press = 0; press < labels.length; press++) {
    const on = await page.evaluate(() =>
      (document.activeElement?.textContent ?? "").trim(),
    );
    if (on === label) break;
    await page.keyboard.press(
      target > labels.indexOf(on) ? "ArrowDown" : "ArrowUp",
    );
  }
  await page.keyboard.press("Enter");
  await expect(
    page.locator(marker).first(),
    `the ${label} tab's own panel`,
  ).toBeVisible();
}

/**
 * Chooses one of §4's six shell palettes in Settings, with no pointer — by
 * arrowing onto its card.
 *
 * **The arrows are what choose it; this helper presses nothing else.** Base UI's
 * radio group moves focus *and* selects: `RadioGroup.js`'s `onKeyDownCapture`
 * marks the group `touched` for any key starting with `Arrow`, and `RadioRoot`'s
 * `onFocus` then clicks the radio focus landed on. `RadioRoot`'s `onKeyDown`
 * cancels `Enter` in as many words — "Radio only activates with Space" — so no
 * activation key applies the palette here. That was measured the hard way: a
 * probe printed the palette already on `html` *before* the `Space` this helper
 * used to press, and deleting that line left the walk green. A line no failure
 * in the walk can detect is dead evidence, so it is gone; `Space` would activate
 * a card, but nothing here would notice if it did not.
 *
 * So the reach is what this helper proves: Tab gets into the group, the arrows
 * walk the six in their drawn order (the same list `shellPalettes` holds and the
 * cards are mapped from), and where they stop is asserted before anything is
 * read. The two assertions that follow are the choice's two halves — the card's
 * own `aria-checked`, and the attribute `applyShellPalette` writes to the
 * document element, which is the one every palette block and every portalled
 * surface reads. Disabling the movement reddens the first of them.
 *
 * It reaches the Appearance tab itself rather than assuming it, so this helper
 * does not depend on the capture having left a different tab mounted.
 */
export async function choosePalette(page: Page, name: Palette): Promise<void> {
  await openSettingsByKeyboard(page);
  await activateTab(page, "Appearance", PALETTE_CARDS);
  const card = page.locator(`[${PALETTE_CHOICE}="${name}"]`);
  await expect(card, `the palette card named ${name}`).toHaveCount(1);

  const order: readonly string[] = [...PALETTES];
  await tabToMark(page, { attribute: PALETTE_CHOICE });
  for (let press = 0; press < order.length; press++) {
    const on = await page.evaluate(
      (attribute: string) =>
        document.activeElement?.getAttribute(attribute) ?? "",
      PALETTE_CHOICE,
    );
    if (on === name) break;
    await page.keyboard.press(
      order.indexOf(name) > order.indexOf(on) ? "ArrowRight" : "ArrowLeft",
    );
  }

  await expect(
    card,
    `the card the arrow keys stopped on rather than ${name}`,
  ).toBeFocused();
  await expect(
    card,
    `the card named ${name} the arrows selected`,
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.locator("html"),
    `the palette in force after choosing ${name}`,
  ).toHaveAttribute("data-shell-palette", name);
}

/**
 * Arms a shortcut capture in Settings and cancels it with Escape, proving that
 * nothing was recorded.
 *
 * **The cancel is Escape, and it is one press with two effects**: `settings.tsx`
 * passes Base UI's dismissal straight through and clears `armed` with it (`an
 * earlier cut that declined the dismissal left the modal unclosable`), so the
 * capture is abandoned *because* the modal goes. Both halves are asserted —
 * the chord the row prints is unchanged after reopening, and the modal left and
 * handed focus back to the gear — because §13.1's second invariant is exactly
 * this question, and the answer is only worth reporting if it is measured.
 *
 * The reopen is what makes "cancelled" mean anything: a capture that recorded
 * the Escape as a chord would leave the modal up, or would print a different
 * chord when it came back. The chord is read *before* the arming and compared
 * after, and the helper ends with focus on that row's own arm control, which is
 * where the walk's last interaction leaves it.
 *
 * Answers the action whose capture was cancelled.
 */
export async function cancelShortcutCapture(page: Page): Promise<string> {
  await openSettingsByKeyboard(page);
  await activateTab(page, "Keyboard", KEYBOARD_TAB);

  const action = await tabToMark(page, { attribute: SHORTCUT_ARM });
  const chord = page.locator(`[${SHORTCUT_CHORD}="${action}"]`);
  const recorded = (await chord.textContent()) ?? "";
  expect(
    recorded,
    `the chord the row for ${action} prints before the capture`,
  ).not.toBe("");

  await page.keyboard.press("Enter");
  await expect(
    page.locator(`[${SHORTCUT_ROW}="${action}"]`),
    `the row the capture for ${action} listens in`,
  ).toHaveAttribute("data-armed", "");

  await page.keyboard.press("Escape");
  await expect(
    page.locator(SETTINGS_DIALOG),
    "the settings modal after Escape on an armed row",
  ).toBeHidden();
  await expect(
    page.locator(`[${SETTINGS_GEAR}]`),
    "the gear the dismissed modal returned focus to",
  ).toBeFocused();

  await openSettingsByKeyboard(page);
  await activateTab(page, "Keyboard", KEYBOARD_TAB);
  await expect(
    page.locator(`[${SHORTCUT_CHORD}="${action}"]`),
    `the chord after the cancelled capture for ${action}`,
  ).toHaveText(recorded);
  await tabToMark(page, { attribute: SHORTCUT_ARM, value: action });
  return action;
}

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
/** The Keyboard tab's own tree, which exists only while that tab is showing:
 *  Base UI unmounts an inactive panel, so its presence *is* the tab's answer
 *  and a tab's word is not needed to ask. */
const KEYBOARD_TAB = "[data-vigilia-keyboard]";
/** A binding row's own pieces (`settings-keyboard.tsx`): the control that arms
 *  the capture, the row the capture listens in, and the chord it prints. */
const SHORTCUT_ARM = "data-vigilia-shortcut-arm";
const SHORTCUT_ROW = "data-vigilia-shortcut-row";
const SHORTCUT_CHORD = "data-vigilia-shortcut-chord";
/** The modal's three tabs, the one search here whose answer is a handful of
 *  presses away. It reports a count rather than hanging. */
const TAB_LIST_BOUND = 3;

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

/** Brings the settings modal to its Keyboard tab, with no pointer.
 *
 *  The tab list is Base UI's `Tabs`, which is a roving-focus group: Tab reaches
 *  the *selected* tab and the arrow keys move between them. **This primitive is
 *  in its manual-activation mode** — `settings.tsx` passes no `activateOnFocus`,
 *  so the arrow key that moves focus does not open the panel (`measured in a
 *  browser: ArrowDown leaves `aria-selected` where it was and the Keyboard panel
 *  unmounted`). The key that opens the tab is the one every button answers to,
 *  so the walk is Tab in, then down-and-Enter until the tab's own panel exists:
 *  an inactive panel is unmounted, which is why the panel is asked for rather
 *  than the tab's word. */
async function activateKeyboardTab(page: Page): Promise<void> {
  const panel = page.locator(KEYBOARD_TAB);
  if (await panel.isVisible()) return;
  await tabToMark(page, { attribute: "role", value: "tab" });
  for (let press = 0; press < TAB_LIST_BOUND; press++) {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    if (await panel.isVisible()) return;
  }
  throw new Error(
    `the Keyboard tab did not mount its panel in ${TAB_LIST_BOUND} presses`,
  );
}

/**
 * Chooses one of §4's six shell palettes in Settings, with no pointer.
 *
 * The cards are a **radio group** (`ControlChoiceRow`), and the group is where
 * the roving focus lives: only the checked card is tabbable, so the walk reaches
 * the group by Tab and then moves *along* it with the arrow keys — the direction
 * is read from the order the six are drawn in, which is the same list
 * `shellPalettes` holds and the same list the cards are mapped from.
 *
 * The activation is `Space`, and that is the key a native button answers rather
 * than a constraint of the primitive — measured, after this doc first claimed
 * the reverse: the card renders `<button>` (`nativeButton` in
 * `control-choice-row.tsx`), so swapping in `Enter` reddens nothing here because
 * both keys press it. Nothing rests on which of the two.
 *
 * Two assertions, because a choice has two halves: the card's own
 * `aria-checked`, and the attribute `applyShellPalette` writes to the document
 * element — the one every palette block and every portalled surface reads. */
export async function choosePalette(page: Page, name: Palette): Promise<void> {
  await openSettingsByKeyboard(page);
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
  await page.keyboard.press(" ");
  await expect(card, `the card named ${name} after Space`).toHaveAttribute(
    "aria-checked",
    "true",
  );
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
  await activateKeyboardTab(page);

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
  await activateKeyboardTab(page);
  await expect(
    page.locator(`[${SHORTCUT_CHORD}="${action}"]`),
    `the chord after the cancelled capture for ${action}`,
  ).toHaveText(recorded);
  await tabToMark(page, { attribute: SHORTCUT_ARM, value: action });
  return action;
}

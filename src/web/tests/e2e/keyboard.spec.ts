import { expect, test } from "@playwright/test";
import { uiCopy } from "../../packages/editor/src/ui-copy.js";
import { captureVisualReview, enterLayer } from "./editor-canvas.js";
import { openPane } from "./editor-rail.js";
import { isDesktopSurface } from "./surface.js";

/** The editor URL, declared here rather than imported: every spec in this
 *  directory declares its own and no spec exports one (`editor.spec.ts:37`). */
const EDITOR = "http://127.0.0.1:4174/";

test("every canvas action's tooltip names the chord that runs it", async ({
  page,
}, testInfo) => {
  // The **rendered** popup, not the registry: Task 2.2's unit test proves the
  // association exists, and this proves it reaches a screen. A `.editor-shell-tooltip`
  // locator here is the same class `editor.spec.ts:1427` names, so the mechanism
  // is the one already contracted.
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  // A **top-level** row, so no entry is needed. `cpu-card` is a part inside
  // `group-cpu-card`, and a part's row does not exist until its group is entered
  // or expanded (`bridge.ts:198-227`, and the starter's groups ship shut) — which
  // is why the one spec that clicks that row enters first (`editor.spec.ts:1107`).
  // The group is a selection like any other, so the dock offers its actions.
  await page.locator('[data-vigilia-layer="group-cpu-card"]').click();

  const toolbar = page.locator("[data-vigilia-canvas-toolbar]");
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: uiCopy.actions.duplicate }).hover();

  const tooltip = page.locator(".editor-shell-tooltip");
  await expect(tooltip).toBeVisible();
  // The chord the platform this browser runs on prints. On this machine that is
  // `Ctrl+D`; the Macintosh spelling is Task 1.2's unit test, because a browser
  // cannot be asked to report somebody else's keyboard.
  await expect(tooltip.locator("kbd")).toHaveText("Ctrl+D");
  // One popup, and not sitting on the control that opened it — the failure
  // `tooltip.ts:20-31` records, which jsdom cannot see because it has no layout.
  await expect(tooltip).toHaveCount(1);
  const [trigger, popup] = await Promise.all([
    toolbar
      .getByRole("button", { name: uiCopy.actions.duplicate })
      .boundingBox(),
    tooltip.boundingBox(),
  ]);
  // The popup's **bottom** clears the trigger's **top**. The weaker
  // `popup.y < trigger.y` passes while the popup still covers its trigger, which
  // is the exact failure this comment names; `editor.spec.ts:1490-1493` is the
  // form the suite already uses.
  expect(
    popup!.y + popup!.height,
    "the popup overlaps its own trigger",
  ).toBeLessThanOrEqual(trigger!.y);

  await captureVisualReview(page, testInfo, "keyboard-tooltip");
});

test("? opens the sheet, and the document behind it does not change", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  // Inside a group first, so the Escape assertion has something to lose.
  await enterLayer(page, "group-cpu-card");
  const selected = page.locator('[data-vigilia-layer="cpu-card"]');
  await expect(selected).toBeVisible();

  await page.keyboard.press("?");
  // **By role *and* name.** The wrapper renders no `Dialog.Title`, so the sheet's
  // accessible name is its `aria-label`; a migration to a library that wires its
  // own labelling would leave the *attribute* reading back while the name a
  // screen reader announces changed. Asking by name is the assertion that sees
  // the difference (Review Focus 2), and `role` is what the shortcut manager's
  // own modal guard matches on (`shortcut-manager/index.ts:121-123`).
  const sheet = page.getByRole("dialog", {
    name: uiCopy.shortcuts.reference,
  });
  await expect(sheet).toBeVisible();
  // Every action is listed, which is the sheet's whole promise: §7's figure for
  // the table is eighteen, Task 3.3's `?` row makes it nineteen, and the row
  // count is a property of the projection rather than of this test.
  await expect(sheet.locator("kbd")).toHaveCount(19);

  // The capture is taken **here, with the sheet open**, because a shot named
  // for the reference that shows no reference is not evidence of one. Its
  // footer reads `Unsaved changes` — that is `vg-188`, entering a group marking
  // the document dirty, and it happens before this test presses anything.
  await captureVisualReview(page, testInfo, "keyboard-reference");

  // Nothing reaches the document behind it. This is the assertion for Review
  // Focus 2, and it is a *visible* one: if the Delete press landed, the layer
  // the author had selected would stop existing.
  await page.keyboard.press("Delete");
  await page.keyboard.press("Control+z");
  await expect(selected).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  // One press, one effect: the sheet closed and `view.exit-group` did **not**
  // also fire, so the group is still entered and its children's rows are still
  // mounted.
  //
  // **This fails on the built bundle, and that is the finding rather than a
  // flake** — `vg-187`, issue #32. The guard asks the DOM whether a modal is
  // open, but Radix has already unmounted the dialog by the time the manager's
  // window-bubble listener asks: Radix binds Escape on `document` in the
  // *capture* phase, and `Presence` unmounts from a `useLayoutEffect` whenever
  // `getComputedStyle(node).animationName` is `"none"`. jsdom never computes an
  // animation name — it reports `""` — so the unit test passes for a reason that
  // does not exist in a browser. These two lines are the regression proof.
  await expect(selected).toBeVisible();
  await expect(selected).toHaveCount(1);
});

test("the palette picker lands beside its trigger, and its tracks answer the arrow keys", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  // The palette panel is the Tokens pane's, so it is in the Tokens pane, and
  // the picker belongs to a **solid** token — a gradient's editor is a different
  // surface, which is why the token is named rather than left at the default.
  await openPane(page, "Tokens");
  await page.locator("[data-vigilia-palette-token]").selectOption("background");

  const trigger = page.getByTestId("picker-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();
  const popover = page.getByTestId("colour-picker");
  await expect(popover).toBeVisible();

  // **Where it landed, which is what the migration could have broken.** The
  // popup moved from Radix's `Content`, which positions itself, to Base UI's
  // `Positioner`; a `Popup` placed straight in the portal renders unpositioned,
  // and the same class of mistake put this control's popover in the top-left
  // corner of the window once before (`panel.dom.test.ts:187-192`). Anchored to
  // a 28px swatch with a 6px offset, so the popup's top is just under it.
  const [swatch, popup] = await Promise.all([
    trigger.boundingBox(),
    popover.boundingBox(),
  ]);
  expect(swatch).not.toBeNull();
  expect(popup).not.toBeNull();
  expect(
    Math.abs(popup!.y - (swatch!.y + swatch!.height + 6)),
    "the popup is anchored to the swatch, not to the window",
  ).toBeLessThanOrEqual(12);

  // `vg-194` in a browser rather than in jsdom: the role promises a range and a
  // keyboard, so both are asked for. **The alpha track, not the hue one** — the
  // token this panel opens on is a near-black with no saturation, so a hue step
  // changes nothing an author could see and only alpha moves the hex.
  const alpha = page.getByTestId("picker-alpha");
  await expect(alpha).toHaveAttribute("aria-valuemin", "0");
  await expect(alpha).toHaveAttribute("aria-valuemax", "100");
  const before = Number(await alpha.getAttribute("aria-valuenow"));
  const readout = popover.locator("p");
  const said = await readout.textContent();

  await alpha.focus();
  await page.keyboard.press("ArrowLeft");

  await expect(alpha).toHaveAttribute("aria-valuenow", String(before - 1));
  // The same key reaches the value the author reads, not just the attribute.
  await expect(readout).not.toHaveText(said ?? "");
});

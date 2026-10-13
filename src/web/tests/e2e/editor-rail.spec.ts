import { expect, test } from "@playwright/test";
import { uiCopy } from "../../packages/editor/src/ui-copy.js";
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
 *  layout viewport at 1280 while the fixed 46/246/280 columns stop adapting. */
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

/**
 * A pane's column does not scroll sideways — `vg-270`, and the reading that
 * closed it.
 *
 * The row measured the Tokens pane's column at `scrollWidth` 449 against a
 * `clientWidth` of 244, a 205px sideways scroll, and named the cause as a flex
 * item with `white-space: nowrap` and no `min-w-0`: the min-content width of
 * "Yaldevi Libre Franklin — Yaldevi + Libre" became the pane's own width. The
 * reading on 2026-10-12 found the overflow gone and `min-w-0` present on that
 * row. Nothing watched for its return, which is what this case is: a column
 * that scrolls sideways clips whatever the author cannot scroll to, and the
 * capture cannot show it because the column image is the scroll origin.
 *
 * The panes are read one at a time for the reason the case above gives — only
 * the chosen slot's pane is laid out.
 */
test("no pane's column scrolls sideways", async ({ page }, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  const overflow: [string, number][] = [];
  for (const slot of ["Composition", "Add", "Tokens", "Document"]) {
    await openPane(page, slot);
    const column = page.locator(".editor-shell-panel");
    await expect(column, `${slot}'s column is showing`).toHaveCount(1);
    const scroll = await column.evaluate((element) =>
      Math.round(element.scrollWidth - element.clientWidth),
    );
    // The measurement names the pane it belongs to: a bare number in the
    // failure would not say which slot to open.
    if (scroll > 0) overflow.push([slot, scroll]);
  }

  expect(overflow, "panes whose column scrolls sideways").toEqual([]);
});

/**
 * The status bar's box, which no other gate in this plan can see.
 *
 * The strip **is** the deliverable, and its geometry is a rendered fact: a
 * full-width bar flush to the window's right and bottom edges. jsdom has no
 * layout, so `shell-layout.dom.test.tsx` can prove the footer's children and
 * nothing can prove its box — the same blindness that failed Task 2 with a
 * rendered offset.
 *
 * The last two assertions are F2's invariant. `min-height`, not `height`, is
 * what §7.7 requires — a refusal may not be ellipsized, so a long diagnostic
 * wraps and the strip grows a line rather than cutting the message or spilling
 * over the stage. **No refusal reachable at this width is long enough to wrap**:
 * the editor's own refusals are short fixed strings, and the one long message,
 * `ARC_FILL_REFUSED` (~200 characters), needs a hand-authored theme carrying a
 * filled arc — a filled arc the editor cannot make (its arcs are stroked). So
 * the wrapping state is left to the declaration, and the guard asserted here is
 * the invariant at rest: the content never exceeds the box it defines.
 */
test("the status bar is the window's full-width bottom edge", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  const box = await page.locator("#status").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    // The window's own box, scrollbar excluded: `rect.right` against
    // `innerWidth` would pass or fail on whether a scrollbar happens to be drawn.
    const window_ = document.documentElement;
    return {
      width: Math.round(rect.width),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      windowWidth: window_.clientWidth,
      windowHeight: window_.clientHeight,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      hasDiagnostic:
        node.querySelector(".editor-shell-diagnostic svg") !== null,
    };
  });

  // The measurement is the report's evidence, so it is printed as well as
  // asserted — the fixture-read pattern `design-language.spec.ts` uses.
  const measured = JSON.stringify(box);
  console.log(`status-bar ${measured}`);
  testInfo.annotations.push({ type: "status-bar", description: measured });

  expect(box.right, "the strip is flush with the window's right edge").toBe(
    box.windowWidth,
  );
  expect(box.bottom, "the strip is flush with the window's bottom edge").toBe(
    box.windowHeight,
  );
  expect(box.width, "the strip is the window's full width").toBe(
    box.windowWidth,
  );
  // Nothing has refused yet, so the strip sits at its resting height.
  expect(box.hasDiagnostic, "no diagnostic is showing at rest").toBe(false);
  expect(box.height, "the strip's resting height is 26px").toBe(26);
  expect(
    box.scrollHeight,
    "the strip's content overflows its own box",
  ).toBeLessThanOrEqual(box.clientHeight);
  expect(
    box.scrollWidth,
    "the strip's content overruns its width",
  ).toBeLessThanOrEqual(box.clientWidth);
});

/**
 * The selected slot's accent bar is on the rail's **inner** edge (DESIGN.md §7.2),
 * and only a rendered box can show which edge that is.
 *
 * jsdom has no layout and no cascade, so a `*.dom.test.tsx` case cannot see a
 * rendered side — the bar lived at `left: -8px`, painting outside the rail's
 * outer edge (the window's left edge), with a comment eight lines above it
 * stating the rule it broke. The parity gate could not catch it either: the
 * mockup drew the same bar in the same wrong place, so the two agreed. This is
 * the assertion that can see it — the bar's own edges measured against the
 * rail's — and the measurement is printed as the report's evidence.
 *
 * The rail is a 46px column and the slot a centred 34px button, so a 6px gutter
 * sits on each side. The bar belongs to the rail, so its outer edge is flush
 * with the rail's inner (right) edge, not past it: the mirror `right: -8px`
 * lands 2px out in the rail-to-pane gap and fails `barRight` below.
 */
test("the selected slot's accent bar sits on the rail's inner edge", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  const measured = await page.evaluate(() => {
    const rail = document.querySelector(".editor-shell-rail");
    const slot = document.querySelector(
      '.editor-shell-rail-slot[aria-pressed="true"]',
    );
    if (rail === null || slot === null) throw new Error("no selected slot");
    const railBox = rail.getBoundingClientRect();
    const slotBox = slot.getBoundingClientRect();
    // The `::before` has no `getBoundingClientRect` of its own, so its box is
    // composed from the slot's rect and the pseudo's resolved anchor.
    const bar = getComputedStyle(slot, "::before");
    const slotStyle = getComputedStyle(slot);
    const width = Number.parseFloat(bar.width);
    // **The padding box, not the border box.** An absolutely positioned child
    // resolves against its containing block's padding box, and this Chromium
    // hands back the *used* `left`, so composing it against the slot's
    // border-box rect counts the slot's border a second time. The slot carries
    // §5 rule 6's 1px transparent resting border, which is exactly that 1px.
    const borderLeft = Number.parseFloat(slotStyle.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(slotStyle.borderRightWidth) || 0;
    const left =
      bar.left !== "auto"
        ? slotBox.left + borderLeft + Number.parseFloat(bar.left)
        : slotBox.right - borderRight - Number.parseFloat(bar.right) - width;
    return {
      railLeft: railBox.left,
      railRight: railBox.right,
      slotLeft: slotBox.left,
      slotRight: slotBox.right,
      barLeft: left,
      barRight: left + width,
      barWidth: width,
      anchor: bar.left !== "auto" ? `left ${bar.left}` : `right ${bar.right}`,
    };
  });
  const report = JSON.stringify(measured);
  console.log(`accent-bar ${report}`);
  testInfo.annotations.push({ type: "accent-bar", description: report });

  expect(measured.barWidth, "the bar is DESIGN.md's 2px").toBe(2);
  expect(
    measured.barLeft,
    "the bar starts inside the rail's outer edge",
  ).toBeGreaterThanOrEqual(measured.railLeft);
  expect(
    measured.barRight,
    "the bar's outer edge is the rail's inner edge",
  ).toBeCloseTo(measured.railRight, 5);
});

/**
 * The gear's ink, which the cascade decides and no unit test can see.
 *
 * `editor-shell.css` set the gear `--muted` on a bare class while
 * `.editor-shell-rail button` set `--faint`; specificity (0,1,1) beat (0,1,0),
 * so the gear painted `--faint` — 68 % of `--muted`, the closed-slot shade —
 * and read as a slot that is merely unchosen, contradicting the decision
 * written above the rule. jsdom applies no stylesheet to a computed style, so
 * the resolved colour exists only in a browser; this compares the gear's ink to
 * a closed slot's and fails while the two are the same.
 */
test("the settings gear paints a lighter ink than a closed slot", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  const ink = await page.evaluate(() => {
    const gear = document.querySelector(".editor-shell-rail-settings");
    // A slot that is not the chosen one: `--faint` is the closed slot's ink,
    // and the gear must not match it.
    const slot = document.querySelector(
      '.editor-shell-rail-slot:not([aria-pressed="true"])',
    );
    if (gear === null || slot === null) throw new Error("no gear or slot");
    return {
      gear: getComputedStyle(gear).color,
      slot: getComputedStyle(slot).color,
    };
  });
  const measured = JSON.stringify(ink);
  console.log(`gear-ink ${measured}`);
  testInfo.annotations.push({ type: "gear-ink", description: measured });

  expect(ink.gear, "the gear is invisible or paints no ink").not.toBe("");
  expect(
    ink.gear,
    `the gear paints the closed slot's --faint, not its own --muted (${measured})`,
  ).not.toBe(ink.slot);
});

/**
 * The keyboard route through the gear's modal: open with the keyboard, Tab and
 * Shift+Tab, Escape, and where focus ends.
 *
 * The brief demands the whole sequence and a browser is the only place it can
 * be observed. jsdom performs **no** sequential focus navigation — a Tab
 * keypress moves nothing — and Base UI's `FloatingFocusManager` deliberately
 * does not handle Tab when tabbable content exists; it relies on the browser
 * walking focus onto its focus-guard spans, whose `onFocus` redirects it to the
 * first or last tabbable. So the trap is a rendered fact with nothing to press
 * in jsdom, and this presses real keys: Tab from the last control wraps to the
 * first, Shift+Tab from the first wraps back, and Escape returns focus to the
 * gear it was opened from.
 */
test("Tab and Shift+Tab stay inside the settings modal, and Escape returns focus to the gear", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  // Open with the keyboard, not a click: the gear is reachable and Enter
  // activates it.
  const gear = page.locator(".editor-shell-rail-settings");
  await gear.focus();
  await expect(gear).toBeFocused();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: uiCopy.settings.title });
  await expect(dialog).toBeVisible();
  // The two ends of the popup's tab order: the selected tab leads, the labelled
  // close is last. The panels sit between them and are not named here.
  const first = dialog.getByRole("tab", { name: uiCopy.settings.appearance });
  const last = dialog.locator(".editor-shell-dialog-close");

  // Tab from the last control wraps forward to the first.
  await last.focus();
  await expect(last).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();

  // Shift+Tab from the first wraps back to the last.
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();

  // Escape is one press, one effect, and it hands focus back to the gear.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(gear).toBeFocused();

  // ── §7.7's constrained proof, in this same procedure ───────────────────────
  //
  // DESIGN.md asks for "the full shell at 1280×720 and 1440×900 CSS pixels,
  // then at 200% browser zoom", with every control reachable through scrolling
  // or compact composition. The two sizes are `design-language.spec.ts`'s loop;
  // what was never taken is the modal under the zoom.
  //
  // **200% zoom is modelled as the CSS-pixel viewport it produces** — 640×360,
  // which is what a browser zoom does: it halves the layout viewport in CSS
  // pixels, and `80vh` and every other length in §7's modal then resolve
  // against the halved box, exactly as they do at a real 200%. CSS `zoom` on the
  // root, which `design-language.spec.ts` uses for its own width assertions, is
  // *not* faithful here and measurably so: it scales a `vh`-capped fixed dialog
  // to twice its computed height while the window stays 720 device pixels, so
  // the modal runs off the screen at a size a real browser zoom never gives it.
  // What this still does not reproduce is the device scale factor, so text
  // rasterisation is not what it proves; the four claims below are all layout
  // and focus, which it does.
  await page.setViewportSize({ width: 640, height: 360 });

  await gear.click();
  await expect(dialog).toBeVisible();

  // (1) All three tabs are reachable, and each one mounts its panel.
  for (const name of [
    uiCopy.settings.appearance,
    uiCopy.settings.keyboard,
    uiCopy.settings.about,
  ]) {
    const tab = dialog.getByRole("tab", { name });
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await expect(tab).toHaveAttribute("data-active", "");
  }

  // (2) The panel scrolls rather than clipping. Read on the Keyboard tab, which
  // holds the twenty-row table: this is the case §7.7's sentence is about, and
  // it is the tab left selected for (3).
  await dialog.getByRole("tab", { name: uiCopy.settings.keyboard }).click();
  const scroller = await dialog.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(
    scroller.overflowY,
    `the modal is not the scroller at 200% zoom: ${JSON.stringify(scroller)}`,
  ).toBe("auto");
  expect(
    scroller.scrollHeight,
    `the Keyboard table is clipped rather than scrolled at 200% zoom: ${JSON.stringify(scroller)}`,
  ).toBeGreaterThan(scroller.clientHeight);

  // (3) The trap still holds at this size: Tab from the last control wraps to
  // the first tabbable, which is the selected tab.
  const close = dialog.locator(".editor-shell-dialog-close");
  await close.scrollIntoViewIfNeeded();
  await close.focus();
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("tab", { name: uiCopy.settings.keyboard }),
  ).toBeFocused();

  // (4) And Close is reachable — scrolled to, visible and operable — rather
  // than merely present at the end of an overflow.
  await expect(close).toBeVisible();
  await close.click();
  await expect(dialog).toBeHidden();
});

import { expect, test } from "@playwright/test";
import { uiCopy } from "../../packages/editor/src/ui-copy.js";
import { openEveryGroup, openPane, paneBody } from "./editor-rail.js";
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

/** DESIGN.md §7.2's rail accent bar, in px. A bare number rather than a `px`
 *  string so the one value is written once and the assertion's message spells
 *  it from here — §3's step table has no entry for it. */
const RAIL_ACCENT_BAR_PX = 2;

/** §7.1's header strip, in px, for the same reason: `--header-height` is a
 *  density rather than one of §3's steps, so the one value is written here and
 *  the mode-switch case spells its message from this. */
const HEADER_STRIP_PX = 42;

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

/** §7.7's "Chrome stays still", and the ruling `vg-208` carries, on a real box.
 *
 *  The rule the row is about put the pane's one `overflow: auto` on the *column*,
 *  so the column scrolled the title bar and the footer along with the list. The
 *  ruling settles the other way: the **body** owns the scroll and the title bar
 *  and the footer sit outside it. Only a rendered box can say which element that
 *  is — jsdom has no layout, so `shell-layout-scroll.dom.test.ts` pins the offset
 *  surviving a swap and nothing about who scrolls.
 *
 *  The measurement is the report's evidence and it reads three things rather
 *  than assuming any of them: which box the list overflows, whether setting that
 *  box's `scrollTop` moves it, and where the chrome is before and after. Both
 *  boxes are scrolled in the one reading, so the numbers say which of the two is
 *  the scroll owner instead of the case saying it.
 */
test("a pane's title bar and footer stay put while its body scrolls", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await openEveryGroup(page);

  const measured = await page.evaluate(() => {
    const column = document.querySelector<HTMLElement>(".editor-shell-panel");
    const pane = column?.querySelector<HTMLElement>(
      ".editor-shell-pane:not([hidden])",
    );
    const body = pane?.querySelector<HTMLElement>(".editor-shell-pane-body");
    const title = pane?.querySelector<HTMLElement>(".editor-shell-pane-title");
    const footer = pane?.querySelector<HTMLElement>(
      ".editor-shell-pane-actions",
    );
    if (
      column === null ||
      pane === undefined ||
      body === null ||
      body === undefined ||
      title === null ||
      title === undefined ||
      footer === null ||
      footer === undefined
    ) {
      throw new Error("no pane column, body, title bar or footer");
    }
    const chrome = () => ({
      title: Math.round(title.getBoundingClientRect().top),
      footer: Math.round(footer.getBoundingClientRect().top),
    });
    // The expand clicks above scroll the column to reach each twisty, so the
    // reading starts by putting it back at the top — the position the chrome is
    // asked to hold.
    column.scrollTop = 0;
    const atTop = chrome();
    column.scrollTop = 300;
    const columnScrolled = { offset: column.scrollTop, ...chrome() };
    column.scrollTop = 0;
    body.scrollTop = 300;
    const bodyScrolled = { offset: body.scrollTop, ...chrome() };
    body.scrollTop = 0;
    const box = (node: HTMLElement) => ({
      overflow: node.scrollHeight - node.clientHeight,
      client: node.clientHeight,
      bottom: Math.round(node.getBoundingClientRect().bottom),
    });
    return {
      atTop,
      columnScrolled,
      bodyScrolled,
      column: box(column),
      body: box(body),
    };
  });
  const report = JSON.stringify(measured);
  console.log(`pane-chrome ${report}`);
  testInfo.annotations.push({ type: "pane-chrome", description: report });

  expect(
    measured.body.overflow,
    "the list overflows the pane's column, not its body",
  ).toBeGreaterThan(0);
  expect(
    measured.columnScrolled.offset,
    "the pane's column is still a scroller, so §7.7's rule is still on the wrong box",
  ).toBe(0);
  expect(
    measured.bodyScrolled.offset,
    "the pane's body is not the scroller",
  ).toBeGreaterThan(0);
  expect(
    measured.bodyScrolled.title,
    "the title bar scrolled with the body",
  ).toBe(measured.atTop.title);
  expect(
    measured.bodyScrolled.footer,
    "the footer scrolled with the body",
  ).toBe(measured.atTop.footer);
  // At rest the footer is the pane's bottom edge, not the end of the list: the
  // property the row is about is that the toolbar stays put while the list
  // scrolls beneath it.
  expect(
    measured.atTop.footer,
    `the footer is drawn outside the pane's box (${report})`,
  ).toBeLessThan(measured.column.bottom);
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
  await openEveryGroup(page);

  // The offset lives on the showing pane's **body** (§7.7, `vg-208`), so the
  // scroll is taken there. The column is what goes `hidden` on a collapse and
  // the body is hidden with it, which is what makes the restore below the pin
  // it is: a real browser discards a `display: none` box's scroll position, so
  // only the shell's own write can bring it back.
  const list = paneBody(page);
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

/** §7.7's per-pane offsets, on every pane and not only the layer list.
 *
 *  The rule is one sentence — "preserve per-pane offsets and disclosure state
 *  across routine updates" — and `choosePane` implements it once, over a map
 *  keyed by the rail's slot. The case above pins it for the Composition pane;
 *  a proof of one pane is a proof of that pane's luck, so this walks all four
 *  and asserts each one comes back where it was left.
 *
 *  **A pane that cannot scroll proves nothing**, so each slot's offset is read
 *  back off the element after it is written: a pane whose body fits fails here
 *  with the slot named rather than passing on a `0` that survived a swap.
 *  Composition is opened to its full length first for the reason the case above
 *  gives — a collapsed starter does not overflow the panel. Add, Tokens and
 *  Document overflow at rest, and two of them are the surfaces the archived
 *  bullet named: the declared-asset library renders inside the Add pane's body,
 *  so Add is where the Assets pane that bullet named survives, and Document is
 *  the other. Their overflow heights are deliberately not stated — measured
 *  twice at this viewport they differed by tens of px, because they move with
 *  font loading — and the guard above is the load-bearing claim, not the sizes.
 *
 *  The offset lives on the showing pane's **body** (§7.7, `vg-208`), and a
 *  browser discards a `display: none` box's scroll position — the swap hides
 *  the pane it leaves — so what the read-back finds after the return is the
 *  shell's own restore and not the box remembering.
 */
test("each pane comes back to the offset it was left at", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await openEveryGroup(page);

  const measured: Record<string, number> = {};
  for (const slot of ["Composition", "Add", "Tokens", "Document"]) {
    await openPane(page, slot);
    const body = paneBody(page);
    await expect(body, `${slot} is the pane showing`).toHaveCount(1);

    const offset = await body.evaluate((node) => {
      node.scrollTop = 300;
      return node.scrollTop;
    });
    // The guard, not the assertion: a pane that fits its box cannot be left at
    // an offset, so a swap that "restored" 0 would pass without proving
    // anything.
    expect(offset, `${slot}'s body is long enough to scroll`).toBeGreaterThan(
      0,
    );

    // Away and back. The partner is whichever slot this one is not, so the
    // swap always leaves the pane it is about.
    await openPane(page, slot === "Composition" ? "Add" : "Composition");
    await openPane(page, slot);

    const returned = await body.evaluate((node) => node.scrollTop);
    measured[slot] = returned;
    expect(
      returned,
      `${slot} came back to ${returned} rather than the ${offset} it was left at`,
    ).toBe(offset);
  }

  const report = JSON.stringify(measured);
  console.log(`pane-offsets ${report}`);
  testInfo.annotations.push({ type: "pane-offsets", description: report });
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
 * A pane does not scroll sideways — `vg-270`, and the reading that closed it.
 *
 * The row measured the Tokens pane's column at `scrollWidth` 449 against a
 * `clientWidth` of 244, a 205px sideways scroll, and named the cause as a flex
 * item with `white-space: nowrap` and no `min-w-0`: the min-content width of
 * "Yaldevi Libre Franklin — Yaldevi + Libre" became the pane's own width. The
 * reading on 2026-10-12 found the overflow gone and `min-w-0` present on that
 * row. Nothing watched for its return, which is what this case is: a box that
 * scrolls sideways clips whatever the author cannot scroll to, and the capture
 * cannot show it because the column image is the scroll origin.
 *
 * **The box read is the pane's body**, which is what scrolls since `vg-208`
 * moved the scroll off the column. Reading the column would now pass whatever
 * the pane drew: it clips, so its own `scrollWidth` stops at its `clientWidth`.
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
    const body = paneBody(page);
    await expect(body, `${slot}'s body is showing`).toHaveCount(1);
    const scroll = await body.evaluate((element) =>
      Math.round(element.scrollWidth - element.clientWidth),
    );
    // The measurement names the pane it belongs to: a bare number in the
    // failure would not say which slot to open.
    if (scroll > 0) overflow.push([slot, scroll]);
  }

  expect(overflow, "panes whose body scrolls sideways").toEqual([]);
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
 * §7.6's left readouts, as the strip draws them, and the report beside them.
 *
 * The counts are the strip's *resting* content: nothing has to happen for them
 * to be there. What they read is the scene's own — compared against the
 * bridge's snapshot rather than against a number this test remembers — so a
 * strip that kept its own tally would fail here the moment the two drifted.
 * That they are on the **left** is a rendered fact, so it is measured: the
 * footer's first content begins at its own left padding, and both counts come
 * before the message that follows them.
 *
 * The message is a distinct element now, so it is read where it is written.
 * `#status`'s own text is the footer's: the counts, the message, the diagnostic
 * and the save state together, and a whole-text assertion on it would say
 * nothing about which of them a reader meant.
 */
test("the status bar reads the scene's counts, and still carries its message", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await page.waitForFunction(() => "vigiliaEditorBridge" in window);

  const objects = page.locator("[data-vigilia-status-objects]");
  const selected = page.locator("[data-vigilia-status-selected]");
  await expect(
    objects,
    "the object count is on the left at rest",
  ).toBeVisible();
  await expect(selected).toBeVisible();
  await expect(selected).toHaveText("0 selected");
  await expect(page.locator("#status-message")).toHaveText("Editor ready");

  // On the left, measured rather than assumed: the first thing in the strip is
  // the counts, and they begin at the footer's own left padding. A readout that
  // drifted to the right half would still be visible and still read the scene,
  // and would fail here.
  const lefts = await page.evaluate(() => {
    const footer = document.querySelector("#status") as HTMLElement;
    const at = (selector: string): number =>
      (document.querySelector(selector) as HTMLElement).getBoundingClientRect()
        .left;
    return {
      footer: footer.getBoundingClientRect().left,
      padding: Number.parseFloat(getComputedStyle(footer).paddingLeft),
      objects: at("[data-vigilia-status-objects]"),
      selected: at("[data-vigilia-status-selected]"),
      message: at("#status-message"),
    };
  });
  expect(
    lefts.objects,
    "the counts are the strip's first content, at its own left padding",
  ).toBeCloseTo(lefts.footer + lefts.padding, 0);
  expect(
    lefts.selected,
    "the selection count sits beside the object count, and to its right",
  ).toBeGreaterThan(lefts.objects);
  expect(
    lefts.message,
    "the message comes after both counts, so neither was moved to the right half",
  ).toBeGreaterThan(lefts.selected);

  // The reading is the scene's, not a tally the strip keeps. The starter is the
  // document this route boots, so it holds something.
  const total = await page.evaluate(
    () =>
      (
        window as unknown as {
          readonly vigiliaEditorBridge: {
            snapshot(): { readonly objectCount: number };
          };
        }
      ).vigiliaEditorBridge.snapshot().objectCount,
  );
  expect(total, "the booted document holds objects").toBeGreaterThan(0);
  await expect(objects).toHaveText(`${total} objects`);

  // A selection moves the reading, and the message keeps its own element while
  // it does.
  await selectLayer(page, "group-cpu-card");
  await expect(selected).toHaveText("1 selected");
  await expect(page.locator("#status-message")).toHaveText("Editor ready");
});

/**
 * §7.3's count, in each pane's title bar, read where an author reads it.
 *
 * The row ruled it per pane, so this walks all four slots and reads each title
 * bar against **the list that pane draws** rather than against a number this
 * test remembers: the Add pane's count is the tiles under it, the Tokens pane's
 * is the token rows under it, and the Composition pane's is the scene's own
 * total, which is also what §7.6's strip prints — the duplication the row
 * accepted and named, asserted here as one string in two surfaces so a pane
 * that drifted to a different number fails.
 *
 * **The Document pane is the one with no count, and the absence is the
 * assertion.** Its body is two sections of fields and it holds no list of its
 * own, so a count there would be a number the product does not have. A dom case
 * can show the span is absent from the tree; only a rendered pane shows that it
 * is absent from the surface the author opens.
 */
test("every pane's title bar carries the count of its own list, and Document carries none", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await page.waitForFunction(() => "vigiliaEditorBridge" in window);

  const titleCount = (pane: string) =>
    page.locator(`[data-vigilia-panel="${pane}"] .editor-shell-pane-count`);

  // Composition is the slot the shell opens on.
  const objects = await page.evaluate(
    () =>
      (
        window as unknown as {
          readonly vigiliaEditorBridge: {
            snapshot(): { readonly objectCount: number };
          };
        }
      ).vigiliaEditorBridge.snapshot().objectCount,
  );
  expect(objects, "the booted document holds objects").toBeGreaterThan(0);
  await expect(titleCount("layers")).toHaveText(`${objects} objects`);
  // The strip and the pane print one number. Two chrome surfaces, one fact.
  await expect(page.locator("[data-vigilia-status-objects]")).toHaveText(
    `${objects} objects`,
  );

  // Add: the card library's own entry count, which is the tiles it draws —
  // not `insertGroups()`'s objects, which add primitives and a text object to
  // the library.
  await openPane(page, "Add");
  const cards = await page
    .locator('[data-vigilia-panel="add"] [data-vigilia-panel-card]')
    .count();
  expect(cards, "the booted library holds units").toBeGreaterThan(0);
  await expect(titleCount("add")).toHaveText(`${cards} units`);

  // Tokens: the theme's paints, which is the rows the pane draws.
  await openPane(page, "Tokens");
  const tokens = await page
    .locator('[data-vigilia-panel="tokens"] [data-vigilia-palette-token-row]')
    .count();
  expect(tokens, "the booted theme declares tokens").toBeGreaterThan(0);
  await expect(titleCount("tokens")).toHaveText(`${tokens} tokens`);

  // Document: no list, so no count.
  await openPane(page, "Document");
  await expect(page.locator('[data-vigilia-panel="document"]')).toBeVisible();
  await expect(
    page.locator('[data-vigilia-panel="document"] .editor-shell-pane-count'),
    "the Document pane holds no list, so its title bar prints no count",
  ).toHaveCount(0);
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
 * The rail is a 46px column and the slot a centred 36px button, so a 5px gutter
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

  // §5's rail slot, which is the size the bar's offset is derived from: at 34px
  // the same `-6px` lands the bar's outer edge 1px short of the rail. Read here
  // rather than by a geometry case of its own, because the two numbers are one
  // decision — `vg-227` moved the slot and the bar together.
  expect(
    measured.slotRight - measured.slotLeft,
    "the slot is §5's 36px rail slot",
  ).toBe(36);
  expect(
    measured.barWidth,
    `the bar is DESIGN.md's ${RAIL_ACCENT_BAR_PX}px`,
  ).toBe(RAIL_ACCENT_BAR_PX);
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

/**
 * §7.1's mode switch, as a rendered box and as the guard in front of it.
 *
 * Two facts live only in a browser. The first is the switch's geometry: it is
 * the header's own control, so it has to fit the 42px strip rather than grow it,
 * and the chosen segment's *paint* — the shared chosen treatment, a lifted
 * ground and `--text`, **never the accent** — is a resolved cascade, which jsdom
 * does not apply. The accent is read as a resolved colour rather than compared
 * with the token, because the token is a `var()` chain and a comparison of two
 * unresolved strings passes a segment painted any colour at all.
 *
 * The second is the round trip: the case drives a real document dirty through
 * the product's own route (duplicate a layer), answers the guard both ways, and
 * reads that the canvas is still **painted** after the editor comes back. The
 * body is `display:none` while another mode shows, so an assertion on the
 * element alone would pass over a surface that never painted again.
 *
 * The header measurement is the report's evidence as well as an assertion, so a
 * run that changes the strip's height says so rather than failing obscurely.
 */
test("the header's mode switch moves the shell, and asks before it leaves a dirty document", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  const header = page.locator(".editor-shell-header");
  const group = header.locator(".editor-shell-mode-switch");
  await expect(group, "the mode switch is not in the header").toBeVisible();
  const segment = (name: string) =>
    group.getByRole("button", { name, exact: true });

  await expect(group.getByRole("button")).toHaveCount(3);
  // The words come from `uiCopy`, which is what the header draws them from: a
  // literal here is how a label the user did not choose gets frozen into a test.
  await expect(segment(uiCopy.modes.editor)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(segment(uiCopy.modes.themes)).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(segment(uiCopy.modes.thisPc)).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  const paint = await group.evaluate((node) => {
    const segments = [...node.querySelectorAll("button")];
    const chosen = segments.find(
      (button) => button.getAttribute("aria-pressed") === "true",
    );
    const rest = segments.find(
      (button) => button.getAttribute("aria-pressed") === "false",
    );
    const strip = node.closest(".editor-shell-header");
    if (chosen === undefined || rest === undefined || strip === null) {
      throw new Error("no chosen segment, unchosen segment or header");
    }
    // The **whole background**, not `backgroundColor`: `--stage` resolves to the
    // shell's backdrop, which is a gradient in most palettes, and a gradient is
    // `background-image` — reading the colour alone would report both segments
    // as transparent and pass a switch that paints nothing.
    const paintOf = (element: Element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor} ${style.backgroundImage}`;
    };
    // The accent as the browser resolved it. A probe element inside the strip
    // reads the same cascade the segment does, and reports `rgb(...)` — the form
    // the segment's own computed colour is in, so the two are comparable.
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    strip.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return {
      well: Math.round(node.getBoundingClientRect().height),
      header: Math.round(strip.getBoundingClientRect().height),
      chosenFill: paintOf(chosen),
      restFill: paintOf(rest),
      chosenInk: getComputedStyle(chosen).color,
      restInk: getComputedStyle(rest).color,
      accent,
    };
  });
  const report = JSON.stringify(paint);
  console.log(`mode-switch ${report}`);
  testInfo.annotations.push({ type: "mode-switch", description: report });

  expect(
    paint.header,
    `the switch grew the header's ${HEADER_STRIP_PX}px strip`,
  ).toBe(HEADER_STRIP_PX);
  expect(
    paint.well,
    `the switch overflows the header (${report})`,
  ).toBeLessThan(paint.header);
  // The chosen treatment, measured rather than assumed: a lifted ground and
  // `--text` that differ from an unchosen segment's — and neither is the
  // region's accent, because §4 spends the header's one accent-filled control
  // on the publish button.
  expect(
    paint.chosenFill,
    `the chosen segment paints the same ground as an unchosen one (${report})`,
  ).not.toBe(paint.restFill);
  expect(
    paint.chosenInk,
    `the chosen segment paints the same ink as an unchosen one (${report})`,
  ).not.toBe(paint.restInk);
  expect(
    paint.chosenFill.includes(paint.accent),
    `the chosen segment is filled with the accent (${report})`,
  ).toBe(false);
  expect(
    paint.chosenInk,
    `the chosen segment is inked with the accent (${report})`,
  ).not.toBe(paint.accent);

  // ── The guard, on a document the product dirtied ──────────────────────────
  const identity = page.locator(".editor-shell-identity");
  await expect(identity).toHaveAttribute("data-dirty", "false");
  await selectLayer(page, "group-cpu-card");
  await page
    .locator("[data-vigilia-canvas-toolbar] [aria-label='Duplicate']")
    .click();
  await expect(
    identity,
    "the product did not mark the document dirty, so the guard is untested",
  ).toHaveAttribute("data-dirty", "true");

  // What the document is painted as, before it is hidden: the count of painted
  // pixels on the canvas Fabric draws objects on (`lower-canvas`; the upper one
  // carries only the selection layer). Read as coverage rather than as an exact
  // image because the starter's bindings tick — a live pass repaints a little of
  // the surface while the shell is elsewhere, and an exact match would call a
  // perfectly healthy document a failure.
  const coverage = async (): Promise<number> =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        "#vigilia-fabric-editor canvas.lower-canvas",
      );
      const pixels = canvas
        ?.getContext("2d")
        ?.getImageData(0, 0, canvas.width, canvas.height).data;
      if (pixels === undefined) throw new Error("no lower canvas to read");
      let painted = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 0) painted += 1;
      }
      return painted;
    });

  const drawnBefore = await coverage();
  expect(
    drawnBefore,
    "the editor painted nothing before the switch, so the round trip is untested",
  ).toBeGreaterThan(0);

  // The question, refused. The instrument is the editor's own replacement
  // prompt, so it is answered in the DOM rather than through `page.on("dialog")`.
  const prompt = page.getByRole("dialog");
  await segment(uiCopy.modes.themes).click();
  await expect(prompt, "leaving a dirty document asked nothing").toBeVisible();
  await expect(prompt).toHaveAttribute("aria-label", uiCopy.modes.unsaved);
  // Save is offered, which is the whole reason the instrument is the editor's
  // own prompt and not a browser dialog. It is not *pressed* here: a real save
  // downloads a package, and the dom case covers that path instead.
  await expect(
    prompt.getByRole("button", {
      name: uiCopy.replaceDocument.save,
      exact: true,
    }),
  ).toBeVisible();
  await prompt
    .getByRole("button", { name: uiCopy.replaceDocument.cancel, exact: true })
    .click();
  await expect(prompt).toHaveCount(0);
  await expect(
    segment(uiCopy.modes.editor),
    "the mode moved while the guard was refused",
  ).toHaveAttribute("aria-pressed", "true");

  // The question, discarded: the mode moves, and the editor's own header actions
  // do not follow it — §7.1's right-hand region is per-mode.
  await segment(uiCopy.modes.themes).click();
  await prompt
    .getByRole("button", { name: uiCopy.replaceDocument.discard, exact: true })
    .click();
  await expect(segment(uiCopy.modes.themes)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator(".editor-shell-body"),
    "the editor's body was unmounted rather than hidden",
  ).toBeHidden();
  await expect(
    page.locator("[data-vigilia-mode-region]"),
    "the themes mode renders no region",
  ).toHaveAttribute("data-vigilia-mode-region", "themes");
  await expect(group, "the switch left the header").toBeVisible();
  await expect(
    header.locator(".editor-shell-menubar"),
    "themes mode still draws the editor's menus",
  ).toHaveCount(0);

  await segment(uiCopy.modes.thisPc).click();
  await expect(
    page.locator("[data-vigilia-mode-region]"),
    "the host mode renders no region",
  ).toHaveAttribute("data-vigilia-mode-region", "this-pc");
  await expect(
    header.locator(".editor-shell-menubar"),
    "host mode still draws the editor's menus",
  ).toHaveCount(0);

  // And back: the editor is the document's surface, and the switch returns it
  // without a reload and without a second question.
  await segment(uiCopy.modes.editor).click();
  await expect(segment(uiCopy.modes.editor)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".editor-shell-body")).toBeVisible();
  await expect(page.locator("[data-vigilia-mode-region]")).toHaveCount(0);
  await expect(
    header.locator(".editor-shell-menubar"),
    "the editor's menus did not come back",
  ).toHaveCount(1);
  await expect(
    identity,
    "the document did not survive the round trip",
  ).toHaveAttribute("data-dirty", "true");

  const drawnAfter = await coverage();
  expect(
    drawnAfter,
    `the canvas came back blank (painted ${drawnBefore} before, ${drawnAfter} after)`,
  ).toBeGreaterThan(0);
  expect(
    Math.abs(drawnAfter - drawnBefore) / drawnBefore,
    `the canvas came back painted as something else (${drawnBefore} before, ${drawnAfter} after)`,
  ).toBeLessThan(0.1);
});

/**
 * The store mode's own header row, as a rendered row.
 *
 * §7.2 forbids a second bar under the header, so what the store draws is the
 * *region's* first row rather than a strip between the header and the content.
 * This case reads the row really drawn — both halves, the search well, five
 * facet buttons and the sort well, all inside the region — and reads the
 * editor's own body as hidden from the other side of A.1's invariant.
 *
 * **The narrow pass is the wrap.** jsdom lays nothing out, so the dom case can
 * only say that no facet is conditional; this says that a window too narrow for
 * the row takes a second line rather than losing a control — every facet is
 * still drawn, still inside the row's own box, and the row is taller than the
 * one line it draws at 1280. A row that stayed one line tall while a button fell
 * outside it would pass a drawn/not-drawn reading alone, which is why both are
 * read.
 *
 * **The asserted narrow width is 720, not the width that forces the facet row
 * itself to wrap.** That width is about 380px, which is not an arrangement this
 * shell is a desktop surface in; at 720 the row takes its second line and every
 * facet is still drawn inside it. The facet row's own wrap is read structurally
 * in `region.dom.test.tsx`, where the row's declaration is what is asserted,
 * and was measured once at 380 while this case was written: the fifth facet
 * moved to the next line and none was lost.
 */
test("the themes mode draws the store's own header row, and no width drops a facet", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await page
    .locator(".editor-shell-mode-switch")
    .getByRole("button", { name: uiCopy.modes.themes, exact: true })
    .click();

  const region = page.locator("[data-vigilia-mode-region='themes']");
  await expect(region, "the themes mode renders no region").toBeVisible();
  await expect(
    page.locator(".editor-shell-body"),
    "the editor's body was not hidden",
  ).toBeHidden();

  const header = region.locator("[data-vigilia-store-header]");
  await expect(header, "the region draws no header row").toBeVisible();

  // The two halves, named and opening on Local — §5's Segmented, which is what
  // the region's own header row carries rather than a second mode switch.
  const halves = header.locator("[data-vigilia-store-halves] button");
  await expect(halves).toHaveCount(2);
  await expect(halves.nth(0)).toHaveText(uiCopy.store.halves.local);
  await expect(halves.nth(1)).toHaveText(uiCopy.store.halves.online);
  await expect(halves.nth(0)).toHaveAttribute("aria-pressed", "true");

  await expect(
    header.locator("[data-vigilia-store-search]"),
    "the region draws no search well",
  ).toBeVisible();
  const facets = header.locator("[data-vigilia-facet]");
  await expect(facets, "the region does not draw the five facets").toHaveCount(
    5,
  );
  await expect(
    header.locator("[data-vigilia-store-sort]"),
    "the region draws no sort well",
  ).toBeVisible();

  // Nothing sits above the region's own first row: the header row is the
  // region element's first child, which is what makes it the region's row
  // rather than a bar the switch was moved into.
  expect(
    await header.evaluate(
      (node) => node === node.parentElement?.firstElementChild,
    ),
    "something sits above the region's own header row",
  ).toBe(true);

  // ── The narrow pass ───────────────────────────────────────────────────────
  /** The row and the five facets, as rendered boxes. */
  const measure = async (): Promise<{
    readonly row: { left: number; right: number; height: number };
    readonly boxes: readonly {
      left: number;
      right: number;
      width: number;
      height: number;
    }[];
  }> => ({
    row: await header.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        height: Math.round(rect.height),
      };
    }),
    boxes: await facets.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
    ),
  });

  const wide = await measure();
  await page.setViewportSize({ width: 720, height: 720 });
  const narrow = await measure();
  const report = JSON.stringify({ wide, narrow });
  console.log(`store-facets ${report}`);
  testInfo.annotations.push({ type: "store-facets", description: report });

  expect(
    narrow.boxes.every((box) => box.width > 0 && box.height > 0),
    `a facet is not drawn at a narrow width (${report})`,
  ).toBe(true);
  expect(
    narrow.boxes.every(
      (box) =>
        box.left >= narrow.row.left - 1 && box.right <= narrow.row.right + 1,
    ),
    `a facet falls outside the row at a narrow width (${report})`,
  ).toBe(true);
  expect(
    narrow.row.height,
    `the row did not wrap, so a control is out of reach (${report})`,
  ).toBeGreaterThan(wide.row.height);
  expect(
    narrow.row.right,
    `the row overflows the window it is drawn in (${report})`,
  ).toBeLessThanOrEqual(720);
});

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isDesktopSurface } from "./surface.js";

/**
 * The composition panel's browser contract, against the real editor.
 *
 * This file is the composition panel's, not the pane bar's: `editor-pane-bar
 * .spec.ts` owns the shared `openPane` helper, and every case here addresses the
 * panel's own markers — `data-vigilia-layer`, `data-vigilia-layer-mark`,
 * `data-vigilia-layer-role` and `.vigilia-layer-name`.
 *
 * Which task owns which case:
 * - **Task 3** owns both cases below: what the row's role costs the row's width,
 *   and that every row still carries its role and its mark at the same height.
 * - Task 5 adds the row's enter control; Task 6 the route into a group's parts.
 * - Task 8 the Document pane, and Task 10 the capture-backed cases (the panel at
 *   two hundred rows) plus the evidence-table rows that point at them.
 *
 * The editor is a separate preview server on its own port, so `use.baseURL` —
 * 4173, the player — is never the right address here.
 */

const EDITOR = "http://127.0.0.1:4174/";

/**
 * The column the stylesheet's own record was taken in, before the row carried a
 * role. It is a comparison point for this case, never an assertion about what
 * ships — the shipped width is whatever `editor-shell.css` says, and the case
 * reads it rather than restating it.
 */
const RECORDED_WIDTH = 340;

// Playwright's headless default argument hides the scrollbars, which would
// measure a panel whose list never pays for one — and the panel's own record was
// taken with the scrollbar in place. The list here overflows at every width
// tested, so this is the difference between the author's layout and a wider one.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

/** Every group open, counted down so a tree that keeps producing twisties cannot spin. */
async function openEveryGroup(page: Page): Promise<void> {
  const twisties = page.locator(
    '[data-vigilia-layer] button[aria-label^="Expand"]',
  );
  for (let opened = await twisties.count(); opened > 0; opened -= 1) {
    await twisties.first().click();
  }
}

/**
 * The measurement the stylesheet's comment records: a name is clipped when its
 * own content is wider than the box it was given. A number, not a judgement.
 */
async function clippedNames(
  page: Page,
): Promise<{ readonly clipped: number; readonly total: number }> {
  return page.locator(".vigilia-layer-name").evaluateAll((names) => ({
    clipped: names.filter((name) => name.scrollWidth > name.clientWidth).length,
    total: names.length,
  }));
}

/**
 * A measurement is taken on a layout, and the layout is the product's, so the
 * instruments are applied as a stylesheet rather than by mutating the document
 * the panel reads. An empty `css` removes the instrument.
 */
async function instrument(page: Page, key: string, css: string): Promise<void> {
  await page.evaluate(
    ({ id, text }) => {
      document.getElementById(id)?.remove();
      if (text === "") return;
      const style = document.createElement("style");
      style.id = id;
      style.textContent = text;
      document.head.append(style);
    },
    { id: `composition-panel-${key}`, text: css },
  );
}

/** The record's own viewport. Playwright's is 1280×720, which is a different layout. */
async function openStarterEditor(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await expect(page.locator("[data-vigilia-layer]").first()).toBeVisible();
  await openEveryGroup(page);
}

test("every row carries a role and a mark, and the role adds no height", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  const rows = page.locator("[data-vigilia-layer]");
  const rowCount = await rows.count();
  expect(rowCount, "the starter's tree, every group open").toBeGreaterThan(1);

  // One role per row, and never the empty string: a row whose role said nothing
  // would be a row whose kind is unstated on four kinds in five (the mark beside
  // the name is `aria-hidden` or absent).
  const roles = page.locator(".vigilia-layer-role");
  await expect(roles).toHaveCount(rowCount);
  for (const text of await roles.allTextContents()) {
    expect(text.trim().length, "a role that says nothing").toBeGreaterThan(0);
  }

  // A mark *slot* on every row, even where the treatment inside it is nothing —
  // that slot is what lines the names up.
  await expect(page.locator(".vigilia-layer-mark")).toHaveCount(rowCount);

  // The role is `flex: none`, so it is never the element that gives up width.
  // What it must not do instead is leave the row's box: the row clips its
  // overflow, so a role pushed past the edge is a role the author cannot read.
  const overflowing = await page
    .locator("[data-vigilia-layer]")
    .evaluateAll((elements) =>
      elements
        .map((row) => ({
          name: row.querySelector(".vigilia-layer-name")?.textContent ?? "",
          slack:
            row.getBoundingClientRect().right -
            (row.querySelector(".vigilia-layer-role")?.getBoundingClientRect()
              .right ?? Number.NEGATIVE_INFINITY),
        }))
        .filter((row) => row.slack < 0)
        .map((row) => row.name),
    );
  expect(overflowing, "roles pushed out of their own row").toEqual([]);

  // One line per row, the height the row has always been: the role added a
  // column and not a second line.
  const heights = await rows.evaluateAll((elements) =>
    elements.map((row) => Math.round(row.getBoundingClientRect().height)),
  );
  expect(new Set(heights).size, "every row is the same height").toBe(1);
  expect(heights[0], "the row's height, unchanged by the role").toBe(24);
});

test("the width the panel ships is the one that clips the fewest names", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  const shipped = await clippedNames(page);
  expect(shipped.total, "the names measured are the rows the DOM has").toBe(
    await page.locator("[data-vigilia-layer]").count(),
  );

  // The same width with the role taken out of the row: the number the
  // stylesheet recorded before the role existed, re-taken on this machine and
  // this font stack rather than restated.
  await instrument(page, "no-role", ".vigilia-layer-role { display: none; }");
  const withoutRole = await clippedNames(page);
  await instrument(page, "no-role", "");

  // And the column the record was taken in, so the count is a delta between two
  // runs of this case rather than a promise about a comment.
  await instrument(
    page,
    "recorded",
    `.editor-shell-body { grid-template-columns: ${RECORDED_WIDTH}px minmax(0, 1fr) 280px; }`,
  );
  const recorded = await clippedNames(page);
  await instrument(page, "recorded", "");

  // The role is paid for out of the name, so taking it out can only unclip
  // names; and the column the panel ships is the one measured wide enough for
  // them, so it clips no more than the column the record was taken in. Both are
  // directions, not pixel values: the exact count belongs to one font stack, and
  // it lives in the stylesheet's comment and the commit that measured it.
  expect(shipped.clipped).toBeGreaterThanOrEqual(withoutRole.clipped);
  expect(recorded.clipped).toBeGreaterThanOrEqual(shipped.clipped);

  for (const [type, value] of [
    ["rows", shipped.total],
    ["clipped@shipped", shipped.clipped],
    ["clipped@shipped-without-role", withoutRole.clipped],
    [`clipped@${RECORDED_WIDTH}`, recorded.clipped],
  ] as const) {
    testInfo.annotations.push({ type, description: String(value) });
  }
});

import { expect, type Page, test } from "@playwright/test";
import { isDesktopSurface } from "./surface.js";

/**
 * The canvas context menu in a window too short to hold it.
 *
 * It carries the Add pane's whole list — 13 entries under two headings — which
 * is 470px tall. That fits a 720px window and does not fit a shorter one, and it
 * had no scroll: the entries below the fold were simply gone, with no scrollbar
 * and no keyboard route to them. The editor is desktop-only, but a desktop
 * window can still be short, and the menu is the one surface that has to work
 * at whatever height the author dragged the window to.
 *
 * Geometry, not a class name: the claim is that the last entry can be *reached*,
 * and only a rendered popup answers that. Nothing here writes scene state — the
 * point is found and clicked through the product's own right-click.
 */

const EDITOR = "http://127.0.0.1:4174/";

/**
 * The menu is 470px, so it cannot fit this window however it is placed.
 *
 * A viewport rather than a window height: Playwright sizes the page, and 420px
 * of it is short enough to clip a 470px menu while still being a window a person
 * could have.
 */
const SHORT_WINDOW = { width: 1280, height: 420 };

/**
 * A client point on the upper canvas that holds no object and is not under the
 * floating dock, so a right-click there opens the creation menu rather than an
 * object's own.
 *
 * Read off the product's two own answers rather than a fixed coordinate: Fabric
 * says whether an object is under the pointer and `elementFromPoint` says
 * whether the dock is. A hard-coded point would pass or fail on the starter's
 * layout instead of on the menu, and would go on doing so after the layout
 * changed. Lowest point first, because the lower the click the less room is left
 * below it — the case that clips.
 */
async function emptyCanvasPoint(page: Page): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "#vigilia-fabric-editor canvas.upper-canvas",
    );
    if (canvas === null) throw new Error("The editor's upper canvas is gone.");
    const rect = canvas.getBoundingClientRect();
    // Called as a method: Fabric's `findTarget` reads `this`, and a detached
    // reference would throw on the first point rather than answer.
    const editorCanvas = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: {
            canvas: { findTarget(event: unknown): { target?: unknown } };
          };
        };
      }
    ).vigiliaEditorBridge.editor.canvas;
    for (let fy = 0.95; fy > 0.02; fy -= 0.02) {
      for (let fx = 0.9; fx > 0.02; fx -= 0.02) {
        const x = rect.left + rect.width * fx;
        const y = rect.top + rect.height * fy;
        if (document.elementFromPoint(x, y) !== canvas) continue;
        if (editorCanvas.findTarget({ clientX: x, clientY: y }).target !== undefined)
          continue;
        return { x, y };
      }
    }
    return null;
  });
  if (point === null)
    throw new Error("No empty canvas point to right-click: the starter covers it.");
  return point;
}

/** The open canvas menu, with the geometry a clipped menu is missing. */
async function readMenu(page: Page): Promise<{
  readonly itemCount: number;
  readonly viewportHeight: number;
  readonly popupTop: number;
  readonly popupBottom: number;
  readonly clientHeight: number;
  readonly scrollHeight: number;
  readonly scrollTop: number;
  readonly lastLabel: string;
  readonly lastTop: number;
  readonly lastBottom: number;
}> {
  return page.evaluate(() => {
    const popup = Array.from(
      document.querySelectorAll<HTMLElement>(".editor-shell-menu-popup"),
    ).find((element) => element.getAttribute("aria-label") === "Canvas actions");
    if (popup === undefined) throw new Error("The canvas menu did not open.");
    const items = Array.from(
      popup.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    const last = items[items.length - 1];
    if (last === undefined) throw new Error("The canvas menu rendered no entries.");
    const rect = popup.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    return {
      itemCount: items.length,
      viewportHeight: window.innerHeight,
      popupTop: rect.top,
      popupBottom: rect.bottom,
      clientHeight: popup.clientHeight,
      scrollHeight: popup.scrollHeight,
      scrollTop: popup.scrollTop,
      lastLabel: last.getAttribute("aria-label") ?? "",
      lastTop: lastRect.top,
      lastBottom: lastRect.bottom,
    };
  });
}

test("the last entry is reachable in a window too short to hold the menu", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.setViewportSize(SHORT_WINDOW);
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  const point = await emptyCanvasPoint(page);
  await page.mouse.click(point.x, point.y, { button: "right" });
  await expect(page.getByRole("menu", { name: "Canvas actions" })).toBeVisible();

  const opened = await readMenu(page);
  // The whole creation list, so this is the menu that overflows and not an
  // object's own short one. `emptyCanvasPoint` aimed for it; this confirms it.
  expect(opened.itemCount).toBeGreaterThan(10);

  // The claim. A menu taller than the room it was given must scroll rather than
  // run off the bottom, and what is below the fold has to be inside the popup's
  // own box once it has scrolled there.
  expect(
    opened.scrollHeight,
    "the menu is taller than the window and must scroll",
  ).toBeGreaterThan(opened.clientHeight);
  expect(
    opened.popupBottom,
    "the popup must stay inside the window it was opened in",
  ).toBeLessThanOrEqual(opened.viewportHeight);

  // **By the keyboard, which is the route a short window takes away.** With no
  // scroll the `End` key moved the active entry off the screen and left it there;
  // the last two families are the ones an author inserting a chart needs.
  await page.keyboard.press("End");
  // The active entry is scrolled into view by the menu's own key handling, so
  // the geometry settles on the next frame rather than immediately.
  await expect
    .poll(async () => (await readMenu(page)).lastBottom, { timeout: 5_000 })
    .toBeLessThanOrEqual(opened.viewportHeight);
  const reached = await readMenu(page);
  expect(reached.lastBottom, `${reached.lastLabel} is on screen`).toBeGreaterThan(
    0,
  );
  expect(reached.scrollTop, "the menu scrolled to the last entry").toBeGreaterThan(
    0,
  );

  // And it is a working entry rather than a reachable-looking one.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Canvas actions" })).toBeHidden();
  const inserted = await page.evaluate(() => {
    const objects = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getObjects(): unknown[] } };
        };
      }
    ).vigiliaEditorBridge.editor.canvas.getObjects();
    return objects.length;
  });
  expect(inserted, "Enter on the last entry inserted an object").toBeGreaterThan(0);
});

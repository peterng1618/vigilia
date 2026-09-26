import { expect, type Page, test } from "@playwright/test";
import { writeThemePackage } from "@vigilia/theme-package";
import {
  clientOfScene,
  objectHandleScenePoint,
  sceneToClient,
} from "./editor-canvas.js";
import { isDesktopSurface } from "./surface.js";

// Built editor E2E host, started by Playwright config.
const EDITOR = "http://127.0.0.1:4174/";
const ARTBOARD_WIDTH = 800;

type Kind = "shape" | "text" | "group";
type Rect = { left: number; top: number; width: number; height: number };

const kindTop: Record<Kind, number> = { shape: 70, text: 250, group: 430 };

function paint(): Record<string, unknown> {
  return {
    palette: {
      none: { name: "None", value: { kind: "solid", color: "transparent" } },
      accent: { name: "Accent", value: { kind: "solid", color: "#ef476f" } },
    },
    typePresets: {
      body: {
        name: "Body",
        value: { family: "Segoe UI, sans-serif", size: 32 },
      },
    },
  };
}

function rect(
  id: string,
  left: number,
  top: number,
  width = 80,
): Record<string, unknown> {
  return {
    type: "Rect",
    id,
    left,
    top,
    width,
    height: 80,
    fill: "#ef476f",
    vigiliaPaint: { fill: "palette.accent" },
    originX: "left",
    originY: "top",
  };
}

function source(
  kind: Kind,
  id: string,
  left: number,
  top: number,
): Record<string, unknown> {
  if (kind === "shape") return rect(id, left, top);
  if (kind === "text") {
    return {
      type: "Textbox",
      id,
      left,
      top,
      width: 80,
      text: "TEXT",
      fontSize: 32,
      fill: "#ef476f",
      vigiliaPaint: { fill: "palette.accent" },
      vigiliaText: {
        runs: [
          {
            kind: "literal",
            text: "TEXT",
            typePreset: "typePresets.body",
            style: { color: { ref: "palette.accent" } },
          },
        ],
      },
      originX: "left",
      originY: "top",
    };
  }
  return {
    type: "Group",
    id,
    left,
    top,
    width: 80,
    height: 80,
    originX: "left",
    originY: "top",
    objects: [rect(`${id}-child`, 0, 0)],
  };
}

async function openFixture(
  page: Page,
  kind: Kind,
  mode = "single",
): Promise<void> {
  await page.goto(EDITOR);
  const top = kindTop[kind];
  const objects: Record<string, unknown>[] = [source(kind, "mover", 100, top)];
  if (mode === "spacing") {
    objects.push(
      source(kind, "left-source", 280, top),
      source(kind, "right-source", 520, top),
    );
  } else if (mode === "steps") {
    objects.push(source(kind, "first-source", 450, top));
  } else {
    objects.push(source(kind, "source", 500, top));
  }
  const result = writeThemePackage({
    envelope: {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: `snapping-${kind}-${mode}`,
      metadata: { locale: "en" },
      artboard: { width: ARTBOARD_WIDTH, height: 600 },
      globals: paint(),
      scene: { version: "7.4.0", objects },
    },
    assets: {},
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name: `snapping-${kind}-${mode}.vigilia-theme`,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(result.bytes),
  });
  await expect(page.locator("#status")).toContainText("Opened snapping-");
}

async function expectActiveTarget(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const bridge = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: { getActiveObject(): { id?: string } | undefined };
              };
            };
          }
        ).vigiliaEditorBridge;
        return bridge.editor.canvas.getActiveObject()?.id;
      }),
    )
    .toBe("mover");
}

async function objectRect(page: Page, id: string): Promise<Rect> {
  return page.evaluate((objectId) => {
    const editor = Object.entries(
      window as unknown as Record<string, unknown>,
    ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
      | {
          canvas: {
            getObjects(): Array<{
              get(name: string): unknown;
              getBoundingRect(): Rect;
            }>;
          };
        }
      | undefined;
    const object = editor?.canvas
      .getObjects()
      .find((candidate) => candidate.get("id") === objectId);
    if (object === undefined) throw new Error(`no object with id ${objectId}`);
    return object.getBoundingRect();
  }, id);
}

/** Device rows along the vertical scene line `sceneX` that carry a guide
 * colour, over the artboard's height plus a column band (the line is ~1 device
 * px wide and dashed, so a single column misses it on a rounding). Counting
 * *rows* rather than pixels is what separates the two guide orientations: a
 * vertical guide paints the whole column band for the artboard's height, while
 * a horizontal guide the same gesture may legitimately publish crosses it for
 * only its own two or three rows. A pixel count cannot tell those apart. Reads
 * the rendered pixels because the applied guides are not exposed through the
 * bridge. The colour is `GUIDE_COLOR` (#3D8BF4). */
async function guideRowsAtSceneX(page: Page, sceneX: number): Promise<number> {
  return page.evaluate(
    async ([x, sceneWidth]) => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              viewport: {
                artboardScreenRect(): {
                  left: number;
                  top: number;
                  width: number;
                  height: number;
                };
              };
            };
          };
        }
      ).vigiliaEditorBridge;
      const rect = bridge.editor.viewport.artboardScreenRect();
      const canvas = document.querySelector<HTMLCanvasElement>(
        "#vigilia-fabric-editor canvas.upper-canvas",
      );
      const context = canvas?.getContext("2d");
      if (
        canvas === null ||
        canvas === undefined ||
        context === null ||
        context === undefined
      )
        return -1;
      const ratio = canvas.width / canvas.getBoundingClientRect().width;
      const centre = (rect.left + x * (rect.width / sceneWidth)) * ratio;
      const top = Math.max(0, Math.round(rect.top * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      const band = Math.max(1, Math.round(4 * ratio));
      const width = Math.min(
        band * 2 + 1,
        canvas.width - Math.max(0, Math.round(centre) - band),
      );
      const data = context.getImageData(
        Math.max(0, Math.round(centre) - band),
        top,
        width,
        height,
      ).data;
      let rows = 0;
      for (let row = 0; row < height; row += 1) {
        for (let column = 0; column < width; column += 1) {
          const index = (row * width + column) * 4;
          if (
            (data[index + 3] ?? 0) > 0 &&
            Math.abs((data[index] ?? 0) - 61) <= 12 &&
            Math.abs((data[index + 1] ?? 0) - 139) <= 12 &&
            Math.abs((data[index + 2] ?? 0) - 244) <= 12
          ) {
            rows += 1;
            break;
          }
        }
      }
      return rows;
    },
    [sceneX, ARTBOARD_WIDTH] as const,
  );
}

/** Rows a vertical guide must paint for this fixture to count as drawn. The
 * artboard is 600 scene px tall, so a real guide covers hundreds of device
 * rows; a horizontal crossing covers a few. */
const GUIDE_ROWS_PRESENT = 50;
/** Upper bound for "no vertical guide here", above a horizontal crossing's few
 * rows and far below a drawn one. */
const GUIDE_ROWS_ABSENT = 20;

/** Landing tolerance for a gesture that should have snapped onto a line. Below
 * the snap threshold (5 screen px), so a dropped snap cannot pass, and above
 * the half pixel a client-coordinate rounding leaves behind. */
const SNAPPED_TOLERANCE = 1;
/** Landing tolerance for a gesture whose own numbers are being compared to
 * each other — the raw landing is derived through two client-pixel roundings,
 * so it drifts by a device pixel or two from the scene value asked for. Still
 * far below the snap threshold, so it cannot absorb a snap that should have
 * happened. */
const RAW_TOLERANCE = 3.5;

async function sceneTravel(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<number> {
  return page.evaluate(
    ([start, end]) => {
      const canvas = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getScenePoint(event: { clientX: number; clientY: number }): {
                  x: number;
                };
              };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas;
      return (
        canvas.getScenePoint({ clientX: end.x, clientY: end.y }).x -
        canvas.getScenePoint({ clientX: start.x, clientY: start.y }).x
      );
    },
    [from, to],
  );
}

async function moveTo(
  page: Page,
  rawLeft: number,
  options: { ctrl?: boolean; release?: boolean } = {},
): Promise<{ left: number; raw: number; guideRows: number }> {
  const before = await objectRect(page, "mover");
  const from = await clientOfScene(page, "mover", ARTBOARD_WIDTH);
  const target = await sceneToClient(
    page,
    ARTBOARD_WIDTH,
    rawLeft + before.width / 2,
    before.top + before.height / 2,
  );
  const travelled = await sceneTravel(page, from, target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (options.ctrl) await page.keyboard.down("Control");
  await page.mouse.move(target.x, target.y, { steps: 12 });
  const left = (await objectRect(page, "mover")).left;
  const guideRows = await guideRowsAtSceneX(page, left);
  if (options.ctrl) await page.keyboard.up("Control");
  if (options.release !== false) await page.mouse.up();
  return { left, raw: before.left + travelled, guideRows };
}

/** Drags the mover's `br` corner horizontally so its right edge lands unsnapped
 * at `rawRight`, and reports that landing next to the edge it finished on.
 *
 * The corner is the one handle all three target kinds share as a *scale*
 * action: a Textbox's side handle changes `width` instead, which is a different
 * Fabric action the scale snapping path does not claim.
 *
 * Shift is held for the whole drag. The editor canvas keeps Fabric's
 * `uniformScaling` on, so a plain corner drag scales both axes at once: the
 * pointer has to travel twice as far as the edge does, and every vertical edge
 * candidate travels with it — at a right edge of 260 the bottom edge lands 2
 * units from the neighbour's bottom and a different edge takes the snap. Shift
 * is the mode toggle, so the drag becomes a free scale and the horizontal edge
 * is the only one that moves. `release: false` leaves Shift held with the
 * button, so a caller that continues the gesture owns releasing it. */
async function resizeTo(
  page: Page,
  rawRight: number,
  options: { ctrl?: boolean; release?: boolean } = {},
): Promise<{ right: number; raw: number; guideRows: number }> {
  const before = await objectRect(page, "mover");
  const select = await clientOfScene(page, "mover", ARTBOARD_WIDTH);
  await page.mouse.click(select.x, select.y);
  const corner = await objectHandleScenePoint(page, "mover", "br");
  const from = await sceneToClient(page, ARTBOARD_WIDTH, corner.x, corner.y);
  const target = await sceneToClient(page, ARTBOARD_WIDTH, rawRight, corner.y);
  const travelled = await sceneTravel(page, from, target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.keyboard.down("Shift");
  if (options.ctrl) await page.keyboard.down("Control");
  await page.mouse.move(target.x, target.y, { steps: 12 });
  const rect = await objectRect(page, "mover");
  const right = rect.left + rect.width;
  const guideRows = await guideRowsAtSceneX(page, right);
  if (options.ctrl) await page.keyboard.up("Control");
  if (options.release !== false) {
    await page.mouse.up();
    await page.keyboard.up("Shift");
  }
  return { right, raw: before.left + before.width + travelled, guideRows };
}

async function moveSteps(
  page: Page,
  first: number,
  second: number,
): Promise<{ first: number; second: number; rows: number }> {
  const before = await objectRect(page, "mover");
  const from = await clientOfScene(page, "mover", ARTBOARD_WIDTH);
  const at = (left: number) =>
    sceneToClient(
      page,
      ARTBOARD_WIDTH,
      left + before.width / 2,
      before.top + before.height / 2,
    );
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const firstPoint = await at(first);
  await page.mouse.move(firstPoint.x, firstPoint.y, { steps: 8 });
  const firstLeft = (await objectRect(page, "mover")).left;
  const secondPoint = await at(second);
  await page.mouse.move(secondPoint.x, secondPoint.y);
  const secondLeft = (await objectRect(page, "mover")).left;
  const rows = await guideRowsAtSceneX(page, secondLeft);
  await page.mouse.up();
  return { first: firstLeft, second: secondLeft, rows };
}

async function resizeSteps(
  page: Page,
  first: number,
  second: number,
): Promise<{ first: number; second: number; rows: number }> {
  const centre = await clientOfScene(page, "mover", ARTBOARD_WIDTH);
  await page.mouse.click(centre.x, centre.y);
  const corner = await objectHandleScenePoint(page, "mover", "br");
  const from = await sceneToClient(page, ARTBOARD_WIDTH, corner.x, corner.y);
  const at = (right: number) =>
    sceneToClient(page, ARTBOARD_WIDTH, right, corner.y);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.keyboard.down("Shift");
  const firstPoint = await at(first);
  await page.mouse.move(firstPoint.x, firstPoint.y, { steps: 8 });
  const firstRect = await objectRect(page, "mover");
  const secondPoint = await at(second);
  await page.mouse.move(secondPoint.x, secondPoint.y);
  const secondRect = await objectRect(page, "mover");
  const rows = await guideRowsAtSceneX(
    page,
    secondRect.left + secondRect.width,
  );
  await page.mouse.up();
  await page.keyboard.up("Shift");
  return {
    first: firstRect.left + firstRect.width,
    second: secondRect.left + secondRect.width,
    rows,
  };
}

test("layer-panel object actions match canvas dock", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "shape");
  const centre = await clientOfScene(page, "mover", ARTBOARD_WIDTH);
  await page.mouse.click(centre.x, centre.y);
  await expectActiveTarget(page);
  const panel = page.locator('[data-vigilia-panel="layers"]');
  const footer = panel.locator("[data-vigilia-layer-actions]");
  const dock = page.getByRole("navigation", {
    name: "Selected object actions",
  });
  await expect(panel).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(dock).toBeVisible();
  expect(
    await footer.evaluate(
      (element) => element.closest("[data-vigilia-layer]") === null,
    ),
  ).toBe(true);
  const panelBox = (await panel.boundingBox())!;
  const footerBox = (await footer.boundingBox())!;
  const treeBox = (await panel.getByRole("tree").boundingBox())!;
  const lastRowBox = (await panel.getByRole("treeitem").last().boundingBox())!;
  expect(footerBox.y).toBeGreaterThanOrEqual(treeBox.y + treeBox.height);
  expect(footerBox.y).toBeGreaterThanOrEqual(lastRowBox.y + lastRowBox.height);
  expect(footerBox.x).toBeGreaterThanOrEqual(panelBox.x);
  expect(footerBox.x + footerBox.width).toBeLessThanOrEqual(
    panelBox.x + panelBox.width,
  );
  expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
    panelBox.y + panelBox.height,
  );
  const entries = (buttons: Element[]) =>
    buttons.map((button) => button.getAttribute("aria-label") ?? "").sort();
  const footerEntries = await footer.getByRole("button").evaluateAll(entries);
  expect(footerEntries).not.toEqual([]);
  expect(footerEntries).toEqual(
    await dock.getByRole("button").evaluateAll(entries),
  );
});

for (const kind of ["shape", "text", "group"] as const) {
  test.describe(`active ${kind}`, () => {
    test.beforeEach(async ({}, testInfo) => {
      test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    });

    for (const gesture of ["moving", "resizing"] as const) {
      const perform = gesture === "moving" ? moveTo : resizeTo;
      const steps = gesture === "moving" ? moveSteps : resizeSteps;
      const edge = (result: { left?: number; right?: number }) =>
        (gesture === "moving" ? result.left : result.right)!;

      test(`${gesture} geometry snaps to a guide`, async ({ page }) => {
        await openFixture(page, kind);
        const line = (await objectRect(page, "source")).left;
        const result = await perform(page, line - 2);
        await expectActiveTarget(page);
        expect(Math.abs(edge(result) - line)).toBeLessThan(SNAPPED_TOLERANCE);
        expect(result.guideRows).toBeGreaterThan(GUIDE_ROWS_PRESENT);
      });

      test(`${gesture} hold re-plans every pointer step`, async ({ page }) => {
        await openFixture(page, kind, "steps");
        const line = (await objectRect(page, "first-source")).left;
        // The second leg lands inside the snap threshold, the first well
        // outside it. Both are in SCENE units, and the threshold is 5 *screen*
        // pixels — about 6.4 scene units at this zoom — so 3 is inside it with
        // room to spare while 140 is nowhere near.
        const result = await steps(page, line - 140, line - 3);
        await expectActiveTarget(page);
        expect(Math.abs(result.first - (line - 140))).toBeLessThan(
          RAW_TOLERANCE,
        );
        expect(Math.abs(result.second - line)).toBeLessThan(SNAPPED_TOLERANCE);
        expect(result.rows).toBeGreaterThan(GUIDE_ROWS_PRESENT);
      });

      test(`${gesture} hold releases past the guide threshold`, async ({
        page,
      }) => {
        await openFixture(page, kind);
        const line = (await objectRect(page, "source")).left;
        const held = await perform(page, line - 2, { release: false });
        expect(Math.abs(edge(held) - line)).toBeLessThan(SNAPPED_TOLERANCE);
        expect(held.guideRows).toBeGreaterThan(GUIDE_ROWS_PRESENT);
        const before = await objectRect(page, "mover");
        const point = await sceneToClient(
          page,
          ARTBOARD_WIDTH,
          line + 30 + (gesture === "moving" ? before.width / 2 : 0),
          before.top + before.height / 2,
        );
        await page.mouse.move(point.x, point.y, { steps: 8 });
        const released = await objectRect(page, "mover");
        const position =
          released.left + (gesture === "resizing" ? released.width : 0);
        expect(position).toBeGreaterThan(line + 10);
        expect(await guideRowsAtSceneX(page, line)).toBeLessThan(
          GUIDE_ROWS_ABSENT,
        );
        // A held resize leaves Shift down with the button; this gesture ends here.
        await page.mouse.up();
        if (gesture === "resizing") await page.keyboard.up("Shift");
        await expectActiveTarget(page);
      });

      test(`${gesture} lifecycle leaves no guide far from a source`, async ({
        page,
      }) => {
        await openFixture(page, kind);
        const result = await perform(page, gesture === "moving" ? 300 : 260);
        await expectActiveTarget(page);
        expect(Math.abs(edge(result) - result.raw)).toBeLessThan(RAW_TOLERANCE);
        expect(result.guideRows).toBeLessThan(GUIDE_ROWS_ABSENT);
      });

      test(`${gesture} Ctrl keeps raw geometry near a guide`, async ({
        page,
      }) => {
        await openFixture(page, kind);
        const line = (await objectRect(page, "source")).left;
        const result = await perform(page, line - 2, { ctrl: true });
        await expectActiveTarget(page);
        expect(Math.abs(edge(result) - result.raw)).toBeLessThan(RAW_TOLERANCE);
        expect(Math.abs(edge(result) - line)).toBeGreaterThan(
          SNAPPED_TOLERANCE,
        );
        expect(result.guideRows).toBeLessThan(GUIDE_ROWS_ABSENT);
      });
    }

    test("moving spacing reaches equal gaps", async ({ page }) => {
      await openFixture(page, kind, "spacing");
      const left = await objectRect(page, "left-source");
      const right = await objectRect(page, "right-source");
      const mover = await objectRect(page, "mover");
      const midpoint = (left.left + left.width + right.left - mover.width) / 2;
      const result = await moveTo(page, midpoint - 2);
      await expectActiveTarget(page);
      expect(Math.abs(result.left - midpoint)).toBeLessThan(SNAPPED_TOLERANCE);
      expect(
        Math.abs(
          result.left -
            (left.left + left.width) -
            (right.left - (result.left + mover.width)),
        ),
      ).toBeLessThan(SNAPPED_TOLERANCE);
      expect(result.guideRows).toBeGreaterThan(GUIDE_ROWS_PRESENT);
    });
  });
}

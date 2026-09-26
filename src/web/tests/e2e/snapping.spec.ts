import { expect, type Page, test } from "@playwright/test";
import { writeThemePackage } from "@vigilia/theme-package";
import { clientOfScene, sceneToClient } from "./editor.spec.js";
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
  const objects: Record<string, unknown>[] = [rect("mover", 100, top, 80)];
  if (mode === "spacing") {
    objects.push(
      source(kind, "left-source", 280, top),
      source(kind, "right-source", 520, top),
    );
  } else if (mode === "steps") {
    objects.push(source(kind, "first-source", 360, top));
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

async function guidePixelsAtSceneX(
  page: Page,
  sceneX: number,
): Promise<number> {
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
      const data = context.getImageData(
        Math.max(0, Math.round(centre) - band),
        top,
        band * 2 + 1,
        height,
      ).data;
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (
          (data[index + 3] ?? 0) > 0 &&
          Math.abs((data[index] ?? 0) - 61) <= 12 &&
          Math.abs((data[index + 1] ?? 0) - 139) <= 12 &&
          Math.abs((data[index + 2] ?? 0) - 244) <= 12
        )
          count += 1;
      }
      return count;
    },
    [sceneX, ARTBOARD_WIDTH] as const,
  );
}

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
): Promise<{ left: number; raw: number; guidePixels: number }> {
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
  const guidePixels = await guidePixelsAtSceneX(page, left);
  if (options.ctrl) await page.keyboard.up("Control");
  if (options.release !== false) await page.mouse.up();
  return { left, raw: before.left + travelled, guidePixels };
}

async function resizeTo(
  page: Page,
  rawRight: number,
  options: { ctrl?: boolean; release?: boolean } = {},
): Promise<{ right: number; raw: number; guidePixels: number }> {
  const before = await objectRect(page, "mover");
  const select = await clientOfScene(page, "mover", ARTBOARD_WIDTH);
  await page.mouse.click(select.x, select.y);
  const from = await sceneToClient(
    page,
    ARTBOARD_WIDTH,
    before.left + before.width,
    before.top + before.height / 2,
  );
  const target = await sceneToClient(
    page,
    ARTBOARD_WIDTH,
    rawRight,
    before.top + before.height / 2,
  );
  const travelled = await sceneTravel(page, from, target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (options.ctrl) await page.keyboard.down("Control");
  await page.mouse.move(target.x, target.y, { steps: 12 });
  const rect = await objectRect(page, "mover");
  const right = rect.left + rect.width;
  const guidePixels = await guidePixelsAtSceneX(page, right);
  if (options.ctrl) await page.keyboard.up("Control");
  if (options.release !== false) await page.mouse.up();
  return { right, raw: before.left + before.width + travelled, guidePixels };
}

async function moveSteps(
  page: Page,
  first: number,
  second: number,
): Promise<{ first: number; second: number; pixels: number }> {
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
  const pixels = await guidePixelsAtSceneX(page, secondLeft);
  await page.mouse.up();
  return { first: firstLeft, second: secondLeft, pixels };
}

async function resizeSteps(
  page: Page,
  first: number,
  second: number,
): Promise<{ first: number; second: number; pixels: number }> {
  const before = await objectRect(page, "mover");
  const centre = await clientOfScene(page, "mover", ARTBOARD_WIDTH);
  await page.mouse.click(centre.x, centre.y);
  const from = await sceneToClient(
    page,
    ARTBOARD_WIDTH,
    before.left + before.width,
    before.top + before.height / 2,
  );
  const at = (right: number) =>
    sceneToClient(page, ARTBOARD_WIDTH, right, before.top + before.height / 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const firstPoint = await at(first);
  await page.mouse.move(firstPoint.x, firstPoint.y, { steps: 8 });
  const firstRect = await objectRect(page, "mover");
  const secondPoint = await at(second);
  await page.mouse.move(secondPoint.x, secondPoint.y);
  const secondRect = await objectRect(page, "mover");
  const pixels = await guidePixelsAtSceneX(
    page,
    secondRect.left + secondRect.width,
  );
  await page.mouse.up();
  return {
    first: firstRect.left + firstRect.width,
    second: secondRect.left + secondRect.width,
    pixels,
  };
}

test("layer-panel object actions match canvas dock", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await page.goto(EDITOR);
  const centre = await clientOfScene(page, "load-gauge");
  await page.mouse.click(centre.x, centre.y);
  const labels = async (selector: string): Promise<string[]> =>
    page
      .locator(`${selector} button`)
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label") ?? "").sort(),
      );
  const layerActions = await labels("[data-vigilia-layer-actions]");
  expect(layerActions).not.toEqual([]);
  await expect(
    page.locator('[aria-label="Selected object actions"]'),
  ).toBeVisible();
  expect(layerActions).toEqual(
    await labels('[aria-label="Selected object actions"]'),
  );
});

test("moving geometry snaps to a shape guide", async ({ page }, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "shape");
  const line = (await objectRect(page, "source")).left;
  const result = await moveTo(page, line - 2);
  expect(result.left).toBeCloseTo(line, 1);
  expect(result.guidePixels).toBeGreaterThan(100);
});

test("moving hold re-plans every pointer step against text", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "text", "steps");
  const line = (await objectRect(page, "first-source")).left;
  const result = await moveSteps(page, line - 160, line - 6);
  expect(Math.abs(result.first - (line - 160))).toBeLessThan(3);
  expect(Math.abs(result.second - line)).toBeLessThan(3);
  expect(result.pixels).toBeGreaterThan(8);
});

test("moving hold releases past a group guide threshold", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "group");
  const line = (await objectRect(page, "source")).left;
  const held = await moveTo(page, line - 2, { release: false });
  expect(Math.abs(held.left - line)).toBeLessThan(3);
  const before = await objectRect(page, "mover");
  const point = await sceneToClient(
    page,
    ARTBOARD_WIDTH,
    before.left + before.width / 2 + 30,
    before.top + before.height / 2,
  );
  await page.mouse.move(point.x, point.y, { steps: 8 });
  const released = await objectRect(page, "mover");
  await page.mouse.up();
  expect(released.left).toBeGreaterThan(line + 10);
});

test("moving lifecycle leaves no guide far from a shape", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "shape");
  const result = await moveTo(page, 300);
  expect(Math.abs(result.left - result.raw)).toBeLessThan(3);
  expect(result.guidePixels).toBeLessThan(20);
});

test("moving Ctrl keeps raw geometry near text", async ({ page }, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "text");
  const line = (await objectRect(page, "source")).left;
  const result = await moveTo(page, line - 2, { ctrl: true });
  expect(Math.abs(result.left - result.raw)).toBeLessThan(3);
  expect(Math.abs(result.left - line)).toBeGreaterThan(0.5);
  expect(result.guidePixels).toBe(0);
});

test("moving spacing reaches equal gaps between groups", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "group", "spacing");
  const left = await objectRect(page, "left-source");
  const right = await objectRect(page, "right-source");
  const result = await moveTo(page, 400);
  expect(result.left - (left.left + left.width)).toBeCloseTo(
    right.left - (result.left + 80),
    1,
  );
  expect(result.guidePixels).toBeGreaterThan(100);
});

test("resizing geometry snaps to a shape guide", async ({ page }, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "shape");
  const line = (await objectRect(page, "source")).left;
  const result = await resizeTo(page, line - 2);
  expect(result.right).toBeCloseTo(line, 1);
  expect(result.guidePixels).toBeGreaterThan(100);
});

test("resizing hold re-plans every pointer step against text", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "text", "steps");
  const first = (await objectRect(page, "first-source")).left;
  const second = first - 160;
  const result = await resizeSteps(page, second, first - 6);
  expect(Math.abs(result.first - second)).toBeLessThan(3);
  expect(Math.abs(result.second - first)).toBeLessThan(3);
  expect(result.pixels).toBeGreaterThan(8);
});

test("resizing hold releases past a group guide threshold", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "group");
  const line = (await objectRect(page, "source")).left;
  const held = await resizeTo(page, line - 2, { release: false });
  expect(Math.abs(held.right - line)).toBeLessThan(3);
  const before = await objectRect(page, "mover");
  const point = await sceneToClient(
    page,
    ARTBOARD_WIDTH,
    line + 30,
    before.top + before.height / 2,
  );
  await page.mouse.move(point.x, point.y, { steps: 8 });
  const released = await objectRect(page, "mover");
  const right = released.left + released.width;
  const pixels = await guidePixelsAtSceneX(page, right);
  await page.mouse.up();
  expect(right).toBeGreaterThan(line + 10);
  expect(pixels).toBe(0);
});

test("resizing lifecycle leaves no guide far from a shape", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "shape");
  const result = await resizeTo(page, 260);
  expect(Math.abs(result.right - result.raw)).toBeLessThan(3);
  expect(result.guidePixels).toBe(0);
});

test("resizing Ctrl keeps raw geometry near text", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "text");
  const line = (await objectRect(page, "source")).left;
  const result = await resizeTo(page, line - 2, { ctrl: true });
  expect(Math.abs(result.right - result.raw)).toBeLessThan(3);
  expect(Math.abs(result.right - line)).toBeGreaterThan(0.5);
  expect(result.guidePixels).toBe(0);
});

test("resizing spacing reaches equal gaps between groups", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  await openFixture(page, "group", "spacing");
  const left = await objectRect(page, "left-source");
  const right = await objectRect(page, "right-source");
  const sourceGap = right.left - (left.left + left.width);
  const expectedRight = left.left - sourceGap;
  const result = await resizeTo(page, expectedRight + 2);
  expect(Math.abs(result.right - expectedRight)).toBeLessThan(3);
  expect(result.guidePixels).toBe(0);
});

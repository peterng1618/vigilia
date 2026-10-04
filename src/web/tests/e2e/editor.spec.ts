import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
import { readThemePackage, writeThemePackage } from "@vigilia/theme-package";
import { strToU8, zipSync } from "fflate";
import { installFixedClock } from "./clock.js";
import {
  type ArtboardRect,
  captureVisualReview,
  chooseAssetFile,
  clearSceneX,
  clientOfScene,
  objectHandleScenePoint,
  objectRect,
  sceneToClient,
  worldLeftOf,
  worldRightOf,
} from "./editor-canvas.js";
import { openPane } from "./editor-pane-bar.js";
import { isDesktopSurface } from "./surface.js";

/** Clicks one primitive in the Add pane's shape group. */
async function insertShape(page: Page, name: string): Promise<void> {
  await page
    .locator('[data-vigilia-panel="add"]')
    .getByRole("group", { name: "Shape" })
    .getByRole("button", { name, exact: true })
    .click();
}

const EDITOR = "http://127.0.0.1:4174/";

/**
 * The starter scene's artboard width. Every helper that turns a scene x into a
 * client point needs it, and a stale 1280 inside a 1672-wide scene puts the
 * pointer somewhere the test never intended — the whole gesture would run
 * against the background and still assert something.
 */
const STARTER_WIDTH = 1672;

/** A scene object as a saved envelope carries it: Fabric JSON, nested. */
type SceneObjectJson = Readonly<Record<string, unknown>>;

/** Shift-clicks two starter labels into an `ActiveSelection`, the product's own
 * multi-selection path. Both centres sit inside their label and outside every
 * card behind it, so each click resolves to the label itself. A drag then moves
 * the composed selection as one unit. */
async function selectTwoLabels(page: Page): Promise<void> {
  // Inside each label's measured run rather than its box: a Textbox hit-tests
  // the glyphs, so the box centre of a wide label lands past the text and the
  // click selects the card behind it.
  const first = await sceneToClient(page, STARTER_WIDTH, 200, 78);
  const second = await sceneToClient(page, STARTER_WIDTH, 180, 114);
  await page.mouse.click(first.x, first.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(second.x, second.y);
  await page.keyboard.up("Shift");
}

/** The active object's authored id. A newly inserted object is given a uuid the
 * test cannot know, so it is read from the object the insertion selected. */
async function activeId(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
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
  });
}

/** Replaces a numeric field's value from the keyboard alone: focus, select the
 * contents, type, then Tab to commit. Clicking alone would append to whatever
 * the field already showed. */
async function typeInto(
  page: Page,
  field: Locator,
  value: string,
): Promise<void> {
  await field.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(value);
  await page.keyboard.press("Tab");
}

/** The active object's scene geometry through the bridge. `members` counts an
 * `ActiveSelection`'s children and a single object as one, so a test can tell a
 * composed selection from a lone object — the guard's whole subject. */
async function activeGeometry(page: Page): Promise<{
  members: number;
  centre: { x: number; y: number };
  rect: ArtboardRect;
}> {
  return page.evaluate(() => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: {
            canvas: {
              getActiveObject():
                | {
                    getObjects?(): unknown[];
                    getCenterPoint(): { x: number; y: number };
                    getBoundingRect(): {
                      left: number;
                      top: number;
                      width: number;
                      height: number;
                    };
                  }
                | undefined;
            };
          };
        };
      }
    ).vigiliaEditorBridge;
    const active = bridge.editor.canvas.getActiveObject();
    if (active === undefined) throw new Error("no active object");
    return {
      members: active.getObjects?.().length ?? 1,
      centre: active.getCenterPoint(),
      rect: active.getBoundingRect(),
    };
  });
}

/** Counts the guide-coloured pixels in the upper canvas' backing store along the
 * vertical scene line `sceneX`, over the artboard's full height plus a small
 * column band (the line is ~1 device px wide and dashed, so a single column
 * misses it on a rounding). Reads the rendered pixels rather than the guide
 * list because the applied guides are not exposed through the bridge — which is
 * exactly why a regression that stops painting them would otherwise pass: the
 * geometry assertions cannot see a missing guide, and captures only run under
 * `VIGILIA_CAPTURE`. The colour is `GUIDE_COLOR` (#3D8BF4). */
async function guidePixelsAtSceneX(
  page: Page,
  sceneX: number,
  sceneWidth = STARTER_WIDTH,
): Promise<number> {
  return page.evaluate(
    async ([x, width]) => {
      // The guide is painted in `after:render`, which `requestRenderAll`
      // schedules on an animation frame; sampling before it runs reads a canvas
      // the guide has not reached yet.
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: { viewport: { artboardScreenRect(): ArtboardRect } };
          };
        }
      ).vigiliaEditorBridge;
      const rect = bridge.editor.viewport.artboardScreenRect();
      const element = document.querySelector<HTMLCanvasElement>(
        "#vigilia-fabric-editor canvas.upper-canvas",
      );
      const context = element?.getContext("2d");
      if (element === null || context === null || context === undefined)
        return -1;

      const ratio = element.width / element.getBoundingClientRect().width;
      const centre = (rect.left + x * (rect.width / width)) * ratio;
      const top = Math.max(0, Math.round(rect.top * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      const band = Math.max(1, Math.round(4 * ratio));
      const left = Math.max(0, Math.round(centre) - band);
      const pixels = context.getImageData(left, top, band * 2 + 1, height).data;
      let matching = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (
          (pixels[index + 3] ?? 0) > 0 &&
          Math.abs((pixels[index] ?? 0) - 61) <= 12 &&
          Math.abs((pixels[index + 1] ?? 0) - 139) <= 12 &&
          Math.abs((pixels[index + 2] ?? 0) - 244) <= 12
        )
          matching += 1;
      }
      return matching;
    },
    [sceneX, sceneWidth] as const,
  );
}

/**
 * The rightmost column of a named object's box that carries light ink, in
 * canvas pixels. `-1` when the object or the canvas cannot be read.
 *
 * Samples `lower-canvas`, where Fabric paints objects; `upper-canvas` carries
 * only the selection overlay. Waits two animation frames first, for the reason
 * `guidePixelsAtSceneX` gives: a render scheduled by `requestRenderAll` has not
 * reached the canvas when the `fill` resolves, so reading immediately samples a
 * canvas from before the edit.
 *
 * Brightness rather than alpha, because text over an opaque panel is covered
 * everywhere and only the glyphs are light.
 */
async function inkReachOf(page: Page, id: string): Promise<number> {
  return page.evaluate(
    async ([objectId, artboard]) => {
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
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
              canvas: {
                getObjects(): Array<{
                  id?: string;
                  getBoundingRect(): ArtboardRect;
                }>;
              };
            };
          };
        }
      ).vigiliaEditorBridge;
      const object = bridge.editor.canvas
        .getObjects()
        .find((candidate) => candidate.id === objectId);
      if (object === undefined) return -1;
      const view = bridge.editor.viewport.artboardScreenRect();
      const element = document.querySelector<HTMLCanvasElement>(
        "#vigilia-fabric-editor canvas.lower-canvas",
      );
      const context = element?.getContext("2d");
      if (element === null || context === null || context === undefined)
        return -1;

      const rect = object.getBoundingRect();
      const ratio = element.width / element.getBoundingClientRect().width;
      const scale = view.width / artboard;
      const left = Math.round((view.left + rect.left * scale) * ratio);
      const top = Math.round((view.top + rect.top * scale) * ratio);
      const width = Math.max(1, Math.round(rect.width * scale * ratio));
      const height = Math.max(1, Math.round(rect.height * scale * ratio));
      const pixels = context.getImageData(left, top, width, height).data;

      let rightmost = -1;
      for (let column = 0; column < width; column += 1) {
        for (let row = 0; row < height; row += 1) {
          const at = (row * width + column) * 4;
          const luminance =
            0.2126 * (pixels[at] ?? 0) +
            0.7152 * (pixels[at + 1] ?? 0) +
            0.0722 * (pixels[at + 2] ?? 0);
          if (luminance > 140) {
            rightmost = column;
            break;
          }
        }
      }
      return rightmost;
    },
    [id, STARTER_WIDTH] as [string, number],
  );
}

/** Drags a named object's `mr` handle so its raw right edge would land at
 * `toSceneX`, and reports the right edge the resize actually left, plus the
 * guide pixels drawn along that edge while the pointer was still down. The
 * handle is read from the object's own corners, so a quantised client mapping
 * cannot put the grab off the handle. */
async function resizeRightHandleTo(
  page: Page,
  id: string,
  toSceneX: number,
  testInfo: TestInfo | undefined,
  options: { ctrlKey?: boolean; captureName?: string } = {},
): Promise<{ right: number; raw: number; guidePixels: number }> {
  const handle = await objectHandleScenePoint(page, id, "mr");
  const from = await sceneToClient(page, STARTER_WIDTH, handle.x, handle.y);
  const to = await sceneToClient(page, STARTER_WIDTH, toSceneX, handle.y);
  const travelled = await page.evaluate(
    ([fx, fy, tx, ty]) => {
      const c = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getScenePoint(e: { clientX: number; clientY: number }): {
                  x: number;
                };
              };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas;
      return (
        c.getScenePoint({ clientX: tx!, clientY: ty! }).x -
        c.getScenePoint({ clientX: fx!, clientY: fy! }).x
      );
    },
    [from.x, from.y, to.x, to.y],
  );
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (options.ctrlKey === true) await page.keyboard.down("Control");
  await page.mouse.move(to.x, to.y, { steps: 12 });

  if (testInfo)
    await captureVisualReview(
      page,
      testInfo,
      options.captureName ?? "editor-snap-resize",
    );
  // Sampled while the pointer is still down: a snapped guide is drawn at the
  // edge the resize landed on, so the object's own right edge names the column.
  const guidePixels = await guidePixelsAtSceneX(
    page,
    await worldRightOf(page, id),
  );
  if (options.ctrlKey === true) await page.keyboard.up("Control");
  await page.mouse.up();

  return {
    right: await worldRightOf(page, id),
    raw: handle.x + travelled,
    guidePixels,
  };
}

/** Gives the active selection a non-unit scale, which is what the eligibility
 * guard refuses when a `Textbox` child is present. The product cannot reach this
 * state — only a scale gesture leaves one, and that deselects first — so the
 * test sets it directly through the live canvas. `setCoords` is not optional:
 * without it the selection's hit area stays at the old scale, the press misses
 * it, and Fabric clears the selection and drags the card behind instead. */
async function scaleActiveSelection(page: Page, factor: number): Promise<void> {
  await page.evaluate((value) => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: {
            canvas: {
              getActiveObject():
                | {
                    set(values: Record<string, number>): void;
                    setCoords(): void;
                  }
                | undefined;
              requestRenderAll(): void;
            };
          };
        };
      }
    ).vigiliaEditorBridge;
    const active = bridge.editor.canvas.getActiveObject();
    if (active === undefined) throw new Error("no active object");
    active.set({ scaleX: value, scaleY: value });
    active.setCoords();
    bridge.editor.canvas.requestRenderAll();
  }, factor);
}

/** Drags the active selection by `amount` scene px in one gesture and reports
 * the world left edge it landed on plus the pointer's exact scene travel.
 *
 * Every leg is at least 30px, and `dragToLine` below parks the selection when
 * the target is nearer. That floor is load-bearing: `sceneToClient` quantises to
 * client pixels, so a leg sized only by the distance to a nearby line can round
 * to no pointer movement — the browser sends no `mousemove`, Fabric never fires
 * `object:moving`, and a test built on that leg passes without exercising
 * anything. `travelled` is read through the canvas's own `getScenePoint` at the
 * two client points actually sent, so `startLeft + travelled` is exactly the
 * landing Fabric's drag would leave unsnapped — the baseline a snap correction
 * is measured against. */
async function dragActiveSelection(
  page: Page,
  amount: number,
  options: { ctrlKey?: boolean } = {},
): Promise<{ left: number; travelled: number; guidePixels: number }> {
  const current = await activeGeometry(page);
  const from = await sceneToClient(
    page,
    STARTER_WIDTH,
    current.centre.x,
    current.centre.y,
  );
  const to = await sceneToClient(
    page,
    STARTER_WIDTH,
    current.centre.x + amount,
    current.centre.y,
  );
  const travelled = await page.evaluate(
    ([fx, fy, tx, ty]) => {
      const c = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getScenePoint(e: { clientX: number; clientY: number }): {
                  x: number;
                  y: number;
                };
              };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas;
      const a = c.getScenePoint({ clientX: fx!, clientY: fy! });
      const b = c.getScenePoint({ clientX: tx!, clientY: ty! });
      return b.x - a.x;
    },
    [from.x, from.y, to.x, to.y],
  );
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (options.ctrlKey === true) await page.keyboard.down("Control");
  await page.mouse.move(to.x, to.y, { steps: 12 });
  const left = (await activeGeometry(page)).rect.left;
  const guidePixels = await guidePixelsAtSceneX(page, left);
  if (options.ctrlKey === true) await page.keyboard.up("Control");
  await page.mouse.up();
  return { left, travelled, guidePixels };
}

/** Drags the active selection so its raw landing is `offset` scene px past
 * `line`, and reports that landing alongside the left edge it finally sits on.
 * Parks 80px away first when the selection is already within 30px of the
 * target, so the approach leg is always long enough to move the pointer (see
 * above). */
async function dragToLine(
  page: Page,
  line: number,
  offset: number,
): Promise<{ left: number; raw: number }> {
  let startLeft = (await activeGeometry(page)).rect.left;
  if (Math.abs(line + offset - startLeft) < 30) {
    startLeft = (await dragActiveSelection(page, -80)).left;
  }
  const { left, travelled } = await dragActiveSelection(
    page,
    line + offset - startLeft,
  );
  return { left, raw: startLeft + travelled };
}

/** The inspector's two geometry pairs, measured from the built bundle. jsdom
 * cannot lay out, so a wrapped pair and a same-line pair return the identical
 * row element there; only a browser can tell the two apart.
 *
 * The Position pair is the reference: it fits this column at every width the
 * editor uses, so a Size row taller than it has wrapped. Comparing the two rows
 * rather than a literal height keeps the check honest if the row's own metrics
 * ever change. */
async function geometryPairBoxes(page: Page): Promise<{
  sizeRowHeight: number;
  positionRowHeight: number;
  widthTop: number;
  heightTop: number;
}> {
  return page.evaluate(() => {
    const input = (key: string): HTMLInputElement => {
      const field = document.querySelector<HTMLInputElement>(
        `[data-vigilia-geometry="${key}"]`,
      );
      if (field === null) throw new Error(`no ${key} geometry field`);
      return field;
    };
    const rowOf = (element: Element): HTMLElement => {
      const row = element.closest(".vigilia-field-row");
      if (row === null) throw new Error("a geometry input has no field row");
      return row as HTMLElement;
    };
    const width = input("width");
    const height = input("height");
    return {
      sizeRowHeight: rowOf(width).getBoundingClientRect().height,
      positionRowHeight: rowOf(input("left")).getBoundingClientRect().height,
      widthTop: width.getBoundingClientRect().top,
      heightTop: height.getBoundingClientRect().top,
    };
  });
}

test.describe("Fabric editor route", () => {
  test("shows the inspector's Size pair on one line", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    // Selecting through the layer row, not a canvas click: the stage
    // letterboxes the artboard, so a scene coordinate is not a stable page one.
    await page.locator('[data-vigilia-layer="wordmark"]').click();
    await expect(page.locator('[data-vigilia-geometry="width"]')).toBeVisible();

    // "One line" is the two inputs sharing a top, not a row-height threshold:
    // a row that wrapped and a row that did not both satisfy a loose height.
    const boxes = await geometryPairBoxes(page);
    expect(Math.round(boxes.widthTop)).toBe(Math.round(boxes.heightTop));
    // ...and the wrap shows up as height, so the Size row must be no taller
    // than the Position row that already fits.
    expect(boxes.sizeRowHeight).toBeLessThanOrEqual(boxes.positionRowHeight);
  });

  test("keeps the drag marquee drawn while the pointer rests", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    // The scene has to be mounted before a gesture means anything: hit-testing
    // an empty canvas finds nothing empty, because nothing is on it yet.
    await expect(page.locator("#status")).toHaveText("Fabric editor ready");
    await page.waitForFunction(() => "vigiliaEditorBridge" in window);

    // Fabric draws the marquee onto the context rather than into the scene, so
    // the only way to see it is to read back the pixels a repaint erases. The
    // upper canvas is where it lands, and it is otherwise blank.
    const marqueeSum = async (): Promise<number> =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          "#vigilia-fabric-editor canvas.upper-canvas",
        ) as HTMLCanvasElement | null;
        const context = canvas?.getContext("2d");
        if (canvas === null || context === null || context === undefined) {
          return -1;
        }
        const data = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 64) sum += data[i];
        return sum;
      });

    // A marquee needs nothing under the pointer where it starts, or the gesture
    // moves an object instead of drawing a box. Which point is empty depends on
    // the window and where the stage letterboxed the artboard, so the start is
    // found by hit-testing rather than guessed.
    const points = await page.evaluate(() => {
      const canvas = document.querySelector(
        "#vigilia-fabric-editor canvas.upper-canvas",
      ) as HTMLCanvasElement;
      const box = canvas.getBoundingClientRect();
      const fabric = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                findTarget(e: unknown): { currentTarget?: unknown } | undefined;
              };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas;
      const candidates: { x: number; y: number }[] = [];
      for (let i = 1; i <= 8; i += 1) {
        const step = i / 9;
        candidates.push({ x: box.left + 8, y: box.top + box.height * step });
        candidates.push({
          x: box.left + box.width - 8,
          y: box.top + box.height * step,
        });
        candidates.push({ x: box.left + box.width * step, y: box.top + 8 });
        candidates.push({
          x: box.left + box.width * step,
          y: box.top + box.height - 8,
        });
      }
      // A descriptor with no current target is the canvas saying "nothing here".
      const empty = candidates.find(
        (p) =>
          fabric.findTarget({ clientX: p.x, clientY: p.y })?.currentTarget ===
          undefined,
      );
      return {
        empty,
        box: {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
        },
      };
    });
    expect(points.empty, "an empty point on the canvas").toBeDefined();

    const from = points.empty!;
    const to = {
      x: points.box.left + points.box.width * 0.55,
      y: points.box.top + points.box.height * 0.3,
    };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    // The control is taken with the pointer already down and the refresh
    // already paused, so the marquee is the only thing that can put ink on that
    // canvas before the second read.
    await page.waitForTimeout(200);
    const control = await marqueeSum();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    // The pause is the whole finding: the marquee used to survive about 33ms,
    // one frame of the 30fps refresh, and be gone by the time anyone looked.
    await page.waitForTimeout(600);
    const during = await marqueeSum();
    await page.mouse.up();

    expect(control).toBeGreaterThanOrEqual(0);
    expect(during).toBeGreaterThan(control);
  });

  test("refuses a palette colour the browser cannot paint", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await expect(page.locator("#status")).toHaveText("Fabric editor ready");
    await page.getByRole("button", { name: "Add colour" }).click();
    const field = page.locator("[data-vigilia-palette-color]");

    // jsdom has no `CSS` object, so this refusal can only be proven where the
    // predicate actually lives: the browser that will paint the value.
    await field.fill("#123456");
    await field.press("Tab");
    await expect(field).toHaveJSProperty("validity.valid", true);

    // A value the engine rejects is refused with a message that names it, and
    // `ctx.fillStyle` would have kept the PREVIOUS colour — so accepting it
    // writes a document the renderer cannot honour.
    await field.fill("not-a-colour");
    await field.press("Tab");
    await expect(field).toHaveJSProperty("validity.valid", false);
    expect(
      await field.evaluate((node: HTMLInputElement) => node.validationMessage),
    ).toContain("not-a-colour");

    // The refusal is not sticky: a value the engine can paint clears it.
    await field.fill("rgb(1, 2, 3)");
    await field.press("Tab");
    await expect(field).toHaveJSProperty("validity.valid", true);
  });

  test("mounts the adopted editor shell on the editor stage", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);

    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await expect(page.locator("#status")).toHaveText("Fabric editor ready");
  });

  test("switches chart refresh between 30 and 1 FPS", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    // The View menu owns chart refresh; the panel select is gone.
    await page.getByRole("button", { name: "View", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: /Chart refresh: 30 FPS/ }).first(),
    ).toBeVisible();
    // **Pick the rate, rather than re-opening the menu and hoping.** The View
    // menu's `Chart refresh` entry is a submenu trigger, so clicking it opens
    // the rates and changes nothing. The old body clicked the trigger a second
    // time and asserted the trigger now read `1 FPS` — an assertion that could
    // only pass if something else had changed the rate, and nothing did, so it
    // was red from the day the entry became a submenu.
    await page
      .getByRole("menuitem", { name: /Chart refresh: 30 FPS/ })
      .first()
      .click();
    await page.getByRole("menuitemradio", { name: "1 FPS" }).click();
    await page.getByRole("button", { name: "View", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: /Chart refresh: 1 FPS/ }).first(),
    ).toBeVisible();
  });

  test("creates and saves text with derived v2 references", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await openPane(page, "Insert");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Text" })
      .click();

    const envelope = (await saveEnvelope(page)) as {
      scene: {
        objects: Array<{
          vigiliaPaint?: { fill?: string };
          vigiliaText?: {
            runs: Array<{
              text?: string;
              typePreset?: string;
              style?: { color?: { ref?: string } };
            }>;
          };
        }>;
      };
    };
    const text = envelope.scene.objects.find(
      (object) => object.vigiliaText?.runs[0]?.text === "New text",
    );
    // New content takes a token named for content, not the palette's first
    // entry, which is the artboard background and would paint the text
    // invisible.
    expect(text).toMatchObject({
      vigiliaPaint: { fill: "palette.text" },
      vigiliaText: {
        runs: [
          {
            // The largest body-role preset, which is what the editor's new-text
            // defaults pick — not the first entry, and not a caption too small
            // to inspect comfortably. At the reference's artboard that is the
            // 32px date face.
            typePreset: "typePresets.32-400",
            style: { color: { ref: "palette.text" } },
          },
        ],
      },
    });
  });

  test("creates a chart with palette-backed settings that save and reopen", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await openPane(page, "Insert");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Gauge" })
      .click();
    await openInspectorTab(page, "Data");
    await expect(
      page.locator('[data-vigilia-chart-setting="thickness"]'),
    ).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-chart-creation");

    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    const chart = saved.parsed.envelope.scene.objects
      .filter((object) => object["type"] === "VigiliaChart")
      .at(-1);
    // A chart takes a content token for its data and a surface token for its
    // track; one token cannot serve both.
    expect(chart).toMatchObject({
      family: "gauge",
      settings: {
        track: { ref: "palette.background" },
        progress: { ref: "palette.text" },
      },
    });
    expect(chart).not.toHaveProperty("option");

    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "created-chart.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened created-chart.vigilia-theme",
    );
  });

  test("authors a panel from the Add panel, styles it by keyboard and pointer, and reopens it", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await openPane(page, "Insert");
    // The Add pane's shapes are a group: "Line" is both a chart family and a
    // primitive, so the legend is what tells the two apart.
    await insertShape(page, "Rectangle");
    await openInspectorTab(page, "Design");

    // Insertion selects what it inserted, so the controls belong to the new
    // panel without a second click.
    const fill = page.locator("[data-vigilia-panel-fill]");
    const stroke = page.locator("[data-vigilia-panel-stroke]");
    const border = page.locator("[data-vigilia-panel-border]");
    const radius = page.locator("[data-vigilia-panel-radius]");
    const shadow = page.locator("[data-vigilia-panel-shadow]");
    await expect(fill).toBeVisible();
    await expect(stroke).toBeVisible();
    await expect(border).toBeVisible();
    await expect(radius).toBeVisible();
    await expect(shadow).toBeVisible();

    // Pointer: the canvas, not the panel. Clicking the new panel's own centre
    // must leave the controls bound to *that* object — asserted by the id the
    // bridge reports and by the token the controls show. A starter card behind
    // it would also render the fields, so "the field is visible" proves
    // nothing; the inserted panel's fill is the card token and no card
    // shares it — the starter's are all `frost`.
    const panelId = (await activeId(page)) ?? "";
    const inserted = await clientOfScene(page, panelId, STARTER_WIDTH);
    await page.mouse.click(inserted.x, inserted.y);
    await expect.poll(() => activeId(page)).toBe(panelId);
    await expect(fill).toHaveValue("palette.panel");

    // Keyboard: one arrow step on the fill token. The inserted panel starts on
    // the card token, so a step is a real change the envelope can show.
    await fill.focus();
    const fillBefore = await fill.inputValue();
    await page.keyboard.press("ArrowDown");
    await expect(fill).not.toHaveValue(fillBefore);

    // Pointer: the border token.
    await stroke.selectOption("palette.panelStroke");

    // Keyboard: type a radius, committing with Tab.
    await typeInto(page, radius, "24");

    // A gradient cannot be a shadow colour, so none is offered there. The
    // starter's `sparkArea` token is one. (It used to be `scene`, which the
    // starter no longer carries — its backdrop is packaged media — so naming
    // that one would have made this assertion vacuous rather than true.)
    const shadowValues = await shadow
      .locator("option")
      .evaluateAll((options) => options.map((option) => option.value));
    expect(shadowValues).toContain("palette.panelStroke");
    expect(shadowValues).not.toContain("palette.sparkArea");
    await shadow.selectOption("palette.panelStroke");
    await expect(
      page.locator("[data-vigilia-panel-shadow-blur]"),
    ).toBeVisible();

    // Keyboard: the last edit, so the undo below is that edit and not the panel.
    await typeInto(page, border, "3");

    await captureVisualReview(page, testInfo, "editor-panel-authoring");

    // Undo steps back one committed edit, not the whole panel.
    await page.keyboard.press("Control+z");
    await expect(border).toHaveValue("1");
    await expect(fill).toBeVisible();

    await typeInto(page, border, "3");
    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    const panel = saved.parsed.envelope.scene.objects.find(
      (object) => object["vigiliaPaint"] !== undefined && object["rx"] === 24,
    );
    // Every field the author touched survives the save as authored state: the
    // tokens stay references, and the geometry is plain Fabric.
    expect(panel).toMatchObject({
      type: "Rect",
      rx: 24,
      ry: 24,
      strokeWidth: 3,
      vigiliaPaint: {
        fill: expect.stringMatching(/^palette\./),
        stroke: "palette.panelStroke",
        shadowColor: "palette.panelStroke",
      },
    });
    expect(
      (panel as { shadow?: { blur: number } }).shadow?.blur,
    ).toBeGreaterThan(0);

    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "authored-panel.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened authored-panel.vigilia-theme",
    );
    // Reopened, the panel is still there with the same authored material.
    const reopened = (await saveEnvelope(page)) as {
      scene: { objects: ReadonlyArray<Readonly<Record<string, unknown>>> };
    };
    expect(
      reopened.scene.objects.filter((object) => object["rx"] === 24),
    ).toHaveLength(1);
  });

  test("offers every primitive as a named shape and styles one that is not a rectangle", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await openPane(page, "Insert");

    // Six, which is `SHAPE_KINDS` — rect, ellipse, polygon, polyline, line,
    // path — spelled out here rather than imported, because the count is the
    // claim being made: the pane offers every primitive and nothing else. The
    // eight this used to expect were the list before arc and wedge were folded
    // into the shape families, and nothing removed them.
    const shapes = page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("group", { name: "Shape" });
    await expect(shapes.getByRole("button")).toHaveCount(6);
    // Both lists are groups, so neither is orphaned under the other's legend
    // and the two "Line" buttons are told apart by the group they sit in.
    const charts = page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("group", { name: "Chart" });
    await expect(charts.getByRole("button")).toHaveCount(4);
    await expect(
      page
        .locator('[data-vigilia-panel="add"]')
        .getByRole("button", { name: "Line", exact: true }),
    ).toHaveCount(2);

    await insertShape(page, "Polygon");
    await openInspectorTab(page, "Design");

    // A shape that is not a rectangle is still a shape: it carries material,
    // it has no corner radius to show, and it has a side count of its own.
    await expect(page.locator("[data-vigilia-panel-fill]")).toBeVisible();
    await expect(page.locator("[data-vigilia-panel-radius]")).toHaveCount(0);
    const sides = page.locator("[data-vigilia-shape-sides]");
    await expect(sides).toBeVisible();
    await typeInto(page, sides, "5");
    await expect(sides).toHaveValue("5");

    const envelope = (await saveEnvelope(page)) as {
      scene: { objects: ReadonlyArray<Readonly<Record<string, unknown>>> };
    };
    const polygon = envelope.scene.objects.find(
      (object) => object["type"] === "Polygon",
    );
    expect((polygon?.["points"] as unknown[]).length).toBe(5);
    // The material the author did not touch is still a palette reference, so
    // the document stays reassignable — and it is the card token, because a
    // polygon filled with the scene's own backdrop is not a shape at all.
    expect(polygon?.["vigiliaPaint"]).toEqual({ fill: "palette.panel" });
  });

  test("reassigns an authored panel's fill, stroke and shadow before deleting a token", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await openPane(page, "Insert");
    // The Add pane's shapes are a group: "Line" is both a chart family and a
    // primitive, so the legend is what tells the two apart.
    await insertShape(page, "Rectangle");
    await openInspectorTab(page, "Design");
    const panelId = (await activeId(page)) ?? "";
    await page
      .locator("[data-vigilia-panel-stroke]")
      .selectOption("palette.text");
    await page
      .locator("[data-vigilia-panel-shadow]")
      .selectOption("palette.text");

    // `text` is the token the new panel's border and shadow now point at.
    await page.locator("[data-vigilia-palette-token]").selectOption("text");
    await page
      .locator("[data-vigilia-palette-replacement]")
      .selectOption("dim");
    await page.locator("[data-vigilia-palette-delete]").click();

    const envelope = (await saveEnvelope(page)) as {
      globals: { palette: Record<string, unknown> };
      scene: { objects: ReadonlyArray<Readonly<Record<string, unknown>>> };
    };
    expect(envelope.globals.palette.text).toBeUndefined();
    // A deleted token that reached only the fill would leave a border and a
    // shadow pointing at a token the palette no longer has — and the save
    // would refuse the document rather than persist it.
    const panel = envelope.scene.objects.find(
      (object) => object["id"] === panelId,
    );
    expect(panel).toBeDefined();
    expect(panel?.["vigiliaPaint"]).toEqual({
      fill: "palette.panel",
      stroke: "palette.dim",
      shadowColor: "palette.dim",
    });
  });

  test("ships the starter's frosted CPU card, reads it live, and round-trips it", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    // The card is a rectangle carrying the treatment, a two-run reading and a
    // line chart — so it is selected and inspected like anything else an
    // author would click, and the control reads back what the document says.
    // Clicked left of the reading rather than at the card's centre: the centre
    // is where the value run is, and a text object is selectable in its own
    // right, exactly as every other label on a starter card is.
    const spot = await sceneToClient(page, STARTER_WIDTH, 438, 420);
    // The card is a group, so a click on it selects the card; the frosted panel
    // the treatment lives on is a part of it. The card's middle is over its own
    // panel, so entering lands there.
    await page.mouse.dblclick(spot.x, spot.y);
    await expect.poll(() => activeId(page)).toBe("cpu-card");
    await openInspectorTab(page, "Design");
    const enabled = page.locator("[data-vigilia-glass-enabled]");
    const blur = page.locator("[data-vigilia-glass-blur]");
    await expect(enabled).toBeChecked();
    // The card's own authored radius, read back through the control: 40 is the
    // value that dissolves the sunset's structure behind the glass, so a
    // control showing anything else would mean the control invented a default.
    await expect(blur).toHaveValue("40");

    // The reading is a **value** run, not authored text. The editor paints
    // the reading by default — a dashboard showing `@cpu.load` where the reader
    // expects a number is not a preview of the thing — and the em-dash
    // placeholder it replaces is gone. Read through the editor bridge, because
    // `canvasProp` addresses the player's handle.
    const painted = () =>
      page.evaluate(() => {
        const bridge = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  getObjects(): Array<{ get(name: string): unknown }>;
                };
              };
            };
          }
        ).vigiliaEditorBridge;
        // Groups descended: the reading is painted on a part of the card, and
        // a search of the root list answered `undefined` for an object the
        // editor was visibly rendering a number into.
        const find = (
          objects: ReadonlyArray<{
            get(name: string): unknown;
            getObjects?: () => readonly unknown[];
          }>,
        ): { get(name: string): unknown } | undefined => {
          for (const candidate of objects) {
            if (candidate.get("id") === "cpu-card-value") return candidate;
            const found = find(
              (candidate.getObjects?.() ?? []) as ReadonlyArray<{
                get(name: string): unknown;
              }>,
            );
            if (found !== undefined) return found;
          }
          return undefined;
        };
        return String(
          find(
            bridge.editor.canvas.getObjects() as ReadonlyArray<{
              get(name: string): unknown;
              getObjects?: () => readonly unknown[];
            }>,
          )?.get("text"),
        );
      });

    await expect.poll(painted, { timeout: 15_000 }).toMatch(/^\d+%$/);

    // The token view is the deliberate override, and it is what an author needs
    // to see which binding a run names. Nothing else proves it survives the
    // canvas default moving away from it, so it is switched on and off here.
    // **Pick the mode, rather than re-opening the menu and hoping.** These View
    // entries are submenu triggers labelled with the *current* value, so
    // clicking "Value runs: values" opens the modes and changes nothing — the
    // body below then asserted the token view and the value view against a
    // setting it had never actually touched, which is why it was red at base
    // as well as here.
    await page.getByRole("button", { name: "View", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Value runs: values", exact: true })
      .click();
    await page.getByRole("menuitemradio", { name: "tokens" }).click();
    await expect.poll(painted, { timeout: 15_000 }).toContain("cpu.load");
    await page.getByRole("button", { name: "View", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Value runs: tokens", exact: true })
      .click();
    await page.getByRole("menuitemradio", { name: "values" }).click();
    await expect.poll(painted, { timeout: 15_000 }).toMatch(/^\d+%$/);

    await captureVisualReview(page, testInfo, "editor-starter-cpu-card");

    // Save, reopen, and the treatment is still authored state rather than a
    // cache the round trip dropped.
    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "starter-cpu.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened starter-cpu.vigilia-theme",
    );
    const reopened = (await saveEnvelope(page)) as {
      scene: { objects: ReadonlyArray<Readonly<Record<string, unknown>>> };
      bindings?: Record<string, ReadonlyArray<{ semanticKey: string }>>;
    };
    const card = sceneObject(reopened, "cpu-card");
    expect(card?.["vigiliaGlass"]).toEqual({ blurRadius: 40 });
    // Both halves of the card still read the same key after the round trip.
    expect(reopened.bindings?.["cpu-card-value"]).toEqual([
      expect.objectContaining({ semanticKey: "cpu.load" }),
    ]);
    expect(reopened.bindings?.["cpu-card-sparkline"]).toEqual([
      expect.objectContaining({ semanticKey: "cpu.load" }),
    ]);
  });

  test("captures the mounted editor for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await captureVisualReview(page, testInfo, "editor");
  });

  test("suppresses motion when the user asks for reduced motion", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(EDITOR);
    const duration = await page
      .locator(".editor-shell-panel")
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe("0s");

    // The media block suppresses transitions as well as animations, so read a
    // control too: the animation assertion alone cannot see that half.
    const controlTransition = await page
      .locator(".editor-shell button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(controlTransition).toBe("0s");

    // With the guard absent the reveal must be a real animation. Duration alone
    // stays 0.16s when the @keyframes block is deleted, so read the effect.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const reveal = await page.locator(".editor-shell-panel").evaluate((el) => {
      // The reveal runs once on mount and leaves getAnimations() when it ends,
      // so restart it before sampling.
      el.style.animation = "none";
      el.getBoundingClientRect();
      el.style.animation = "";
      const effect = el.getAnimations()[0]?.effect;
      return {
        duration: getComputedStyle(el).animationDuration,
        keyframes:
          effect instanceof KeyframeEffect ? effect.getKeyframes().length : 0,
      };
    });
    expect(reveal.duration).not.toBe("0s");
    expect(reveal.keyframes).toBeGreaterThanOrEqual(2);

    // The suppression assertion above reads 0s whether or not the shorthand
    // exists, so pin the shorthand itself: five compositor-owned properties,
    // never a layout one.
    const motion = await page
      .locator(".editor-shell button")
      .first()
      .evaluate((el) => ({
        properties: getComputedStyle(el).transitionProperty,
        duration: getComputedStyle(el).transitionDuration,
      }));
    expect(motion.properties).toBe(
      "background-color, border-color, color, transform, opacity",
    );
    expect(motion.duration).toBe("0.14s, 0.14s, 0.14s, 0.14s, 0.14s");

    const injectedTransition = (locator: Locator) =>
      locator.evaluate((el) => {
        el.style.transition = "opacity 200ms ease";
        return getComputedStyle(el).transitionDuration;
      });

    // Base UI portals the popup to `body`, where `.editor-shell *` cannot reach
    // it, so the media block names the popup's own class. Without the injection
    // this reads 0s either way and would pass with that selector deleted; with
    // it, only the media block can produce the 0s below.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "View", exact: true }).click();
    // The zoom readout's popup stays mounted (`keepMounted`), so two popups are
    // in the DOM; only the open View menu's is visible.
    const popup = page.locator(".editor-shell-menu-popup:visible");
    await expect(popup).toBeVisible();
    // Anchored to the View popup's own item, not merely to "a visible popup": the
    // zoom menu also satisfies `:visible`, so a popup-agnostic locator would let
    // the positive control pass while measuring the wrong menu.
    await expect(
      popup.getByRole("menuitem", { name: /Value runs/ }),
    ).toBeVisible();
    await expect.poll(() => injectedTransition(popup)).toBe("0.2s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => injectedTransition(popup)).toBe("0s");

    // The menu item is the element a hover transition would land on, and it is
    // outside `.editor-shell`, so the in-shell shorthand
    // `.editor-shell [role="menuitem"]` cannot reach it — the popup's own `*`
    // line is its only suppression. Without this assertion, adding a transition
    // to a menu row and deleting the `*` lines leaves the suite green under
    // `reduce`.
    const menuItem = popup.getByRole("menuitem", { name: /Value runs/ });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(() => injectedTransition(menuItem)).toBe("0.2s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => injectedTransition(menuItem)).toBe("0s");

    // The positioner is a separate portalled element, styled in its own right
    // (`z-index: 60`), and it is NOT covered by the popup's selectors — the popup
    // nests inside it, not the reverse. A popup-position animation lands here.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const positioner = page.locator(".editor-shell-positioner:visible");
    await expect(positioner).toBeVisible();
    await expect.poll(() => injectedTransition(positioner)).toBe("0.2s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => injectedTransition(positioner)).toBe("0s");

    // The dock tooltip is portalled under its own class, and its positioner carries
    // no class at all — so `.editor-shell-tooltip` is the whole of its coverage. The
    // dock renders no triggers until something is selected.
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await selectStarterChart(page);
    const dock = page.locator('[aria-label="Selected object actions"]');
    await dock.getByRole("button", { name: "Duplicate" }).hover();
    const tooltip = page.locator(".editor-shell-tooltip");
    await expect(tooltip).toBeVisible();
    await expect.poll(() => injectedTransition(tooltip)).toBe("0.2s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => injectedTransition(tooltip)).toBe("0s");
  });

  test("a refused glass control says why to a pointer and to a keyboard alike", async ({
    page,
  }, testInfo) => {
    /**
     * The browser half of a fix jsdom cannot see.
     *
     * The reason reached the keyboard and not the mouse: `pointerenter` fired
     * and no popup appeared, while the dock's one-word labels hovered fine. The
     * cause was placement, not listeners. `place()` measured the popup before it
     * was pinned, and an out-of-flow popup sizes against the space from its
     * static position to the viewport edge until `left` and `top` are assigned —
     * so a three-line reason measured one line, the computed height was short by
     * two, and the popup landed **on top of its own trigger**. That fires
     * `pointerleave` on the trigger, which dismisses the popup and restarts the
     * hover timer, forever. jsdom has no layout, so nothing there could see it:
     * the same event sequence passes in jsdom and flickers in a browser.
     *
     * A `Path` is one of the kinds the treatment cannot reach, and the reason
     * named for it is a full sentence — the shape of the text is what made the
     * stale measurement wrong, so a short label would pass here and still ship.
     */
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    // By id rather than by Fabric's class tag, and through the card rather than
    // around it: the starter's icons are paths *inside* their cards, so a search
    // of `getObjects()` never saw one and threw "the starter has no Path" for a
    // shape the author can click. Entering the card is also the gesture the spec
    // defines for reaching a part, and it opens the card in the layer tree on
    // the way — so the icon is selected the way an author selects it.
    await enterStarterCard(page, "group-cpu-card");
    await page.locator('[data-vigilia-layer="cpu-card-icon"]').click();
    await expect.poll(() => activeId(page)).toBe("cpu-card-icon");
    await openInspectorTab(page, "Design");

    const control = page.locator("[data-vigilia-glass-enabled]");
    await expect(control).toHaveAttribute("aria-disabled", "true");
    const tooltip = page.locator(".editor-shell-tooltip");

    // **Hover**, asserted on its own: focusing first would make this pass on
    // the behaviour that already worked.
    await control.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Path");
    // Settled, not flickering: the popup has to survive a moment rather than
    // appear and be dismissed by the pointerleave its own placement provoked.
    await page.waitForTimeout(1200);
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveCount(1);
    // And it is not sitting on the control that opened it.
    const [triggerBox, tooltipBox] = await Promise.all([
      control.boundingBox(),
      tooltip.boundingBox(),
    ]);
    expect(
      tooltipBox!.y + tooltipBox!.height,
      "the popup overlaps its own trigger",
    ).toBeLessThanOrEqual(triggerBox!.y);

    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCount(0);

    // **Focus**, asserted separately, so neither can pass on the other.
    await control.focus();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Path");
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
  });

  test("captures selected chart binding controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page
      .locator('[data-vigilia-binding="ram-gauge-percent"]')
      .selectOption("ram.used");
    const precision = page.locator(
      '[data-vigilia-binding-field="ram-gauge-percent.precision"]',
    );
    await precision.fill("2");
    await precision.press("Tab");
    await expect(precision).toHaveValue("2");
    const progressPaint = page.locator('[data-vigilia-chart-paint="progress"]');
    await progressPaint.scrollIntoViewIfNeeded();
    await expect(progressPaint).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-chart-binding");
  });

  test("captures the controls that give a text run its reading", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    // The starter theme's clock is authored as a value run, so selecting it
    // shows what an author chooses to read and how it should read. It is a part
    // of the time card, and a part is reached by **entering** its group: with
    // the card merely opened in the tree, a row click still selects the card,
    // which has no run controls.
    await enterStarterCard(page, "group-time-card");
    await page.locator('[data-vigilia-layer="time"]').click();
    const source = page.locator('[data-vigilia-run-source="0"]');
    await expect(source).toBeVisible();
    await expect(source).toHaveValue("time.now");
    const format = page.locator('[data-vigilia-run-format="0"]');
    await expect(format).toBeVisible();
    // The starter clock's own tokens, so the reading below is one this test can
    // compute rather than one it wrote.
    await expect(format).toHaveValue("hh:mm");

    // A clock pinned to another city is the point of a world clock, so the zone
    // has to change the reading rather than only the envelope: the control is
    // rebuilt from what was written, and the preview follows it.
    const zone = page.locator('[data-vigilia-run-zone="0"]');
    await expect(zone).toHaveValue("");
    await zone.selectOption("Asia/Tokyo");
    await expect(zone).toHaveValue("Asia/Tokyo");
    await expect
      .poll(
        async () => {
          const shown = (
            await page
              .locator('[data-vigilia-run-format-preview="0"]')
              .textContent()
          )?.trim();
          const tokyo = await page.evaluate(() => {
            const parts = new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Tokyo",
              hour12: true,
              hour: "2-digit",
              minute: "2-digit",
            }).formatToParts(new Date());
            const part = (type: string): string =>
              parts.find((entry) => entry.type === type)?.value ?? "";
            return `${part("hour")}:${part("minute")}`;
          });
          return shown === tokyo;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    await zone.scrollIntoViewIfNeeded();

    await captureVisualReview(page, testInfo, "editor-text-reads");
  });

  test("captures semantic layer controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    // The gauge is a part of the RAM card, so the card is opened first.
    await expandLayer(page, "group-ram-card");
    const layer = page.locator('[data-vigilia-layer="ram-gauge"]');
    await expect(layer).toBeVisible();
    await layer.click();
    // The **card** is what carries the selection marker, not the row that was
    // clicked: `selectLayer` reaches a child through its owning group, because
    // a bare child has no transform controls of its own. Asserting the marker
    // on the part would pin the opposite of the rule, and the part's own row
    // is still here to be styled and renamed.
    await expect(
      page.locator('[data-vigilia-layer="group-ram-card"]'),
    ).toHaveAttribute("aria-selected", "true");
    // One dense line per layer: the state icons, not the old six text buttons.
    await expect(layer.locator("button")).toHaveCount(2);
    await expect(layer.locator('[aria-label="Hide"]')).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-layer-arrange");
  });

  test("captures changed artboard controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.locator("[data-vigilia-artboard-width]").fill("1000");
    await page.locator("[data-vigilia-artboard-width]").press("Tab");
    await page
      .locator("[data-vigilia-artboard-background]")
      .selectOption("palette.bars");
    await expect(page.locator("[data-vigilia-artboard-width]")).toHaveValue(
      "1000",
    );
    await expect(
      page.locator("[data-vigilia-artboard-background]"),
    ).toHaveValue("palette.bars");

    await captureVisualReview(page, testInfo, "editor-artboard");
  });

  test("rejects literal artboard paint in a v2 document", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await setUncheckedThemePackage(page, "literal-bars.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "literal-bars",
      metadata: { themeLanguage: "en" },
      artboard: {
        width: 1000,
        height: 720,
        background: { value: "#101216" },
        barColor: { value: "#e20074" },
      },
      scene: { version: "7.4.0", objects: [] },
    });
    await expect(page.locator("#status")).toContainText("Could not open");
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
  });

  test("renders palette gradients on the native Fabric artboard", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await setThemePackage(page, "gradient-artboard.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "gradient-artboard",
      metadata: { themeLanguage: "en" },
      artboard: {
        width: 1000,
        height: 720,
        background: { ref: "palette.background" },
        barColor: { ref: "palette.bars" },
      },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          background: {
            name: "Background",
            value: {
              kind: "gradient",
              angle: 0,
              stops: [
                { offset: 0, color: "#102030" },
                { offset: 1, color: "#d0e0f0" },
              ],
            },
          },
          bars: {
            name: "Bars",
            value: {
              kind: "gradient",
              angle: 90,
              stops: [
                { offset: 0, color: "#001122" },
                { offset: 1, color: "#334455" },
              ],
            },
          },
        },
      },
      scene: { version: "7.4.0", objects: [] },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened gradient-artboard.vigilia-theme",
    );
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-artboard-gradient");
  });

  test("edits an artboard palette token through the property surface", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-palette-token]")
      .selectOption("background");
    const color = page.locator("[data-vigilia-palette-color]");
    await color.fill("rgb(16 32 48)");
    await color.press("Tab");
    await expect(color).toHaveValue("rgb(16 32 48)");

    const envelope = (await saveEnvelope(page)) as {
      globals: { palette: { background: { value: unknown } } };
    };
    expect(envelope.globals.palette.background.value).toEqual({
      kind: "solid",
      color: "rgb(16 32 48)",
    });

    await captureVisualReview(page, testInfo, "editor-palette-solid");
  });

  test("reassigns palette references before deleting a token", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    // The token deleted has to be one the **artboard** references, or the
    // reassignment has nothing to reassign and the test passes for the wrong
    // reason. `bars` is the artboard's `barColor`; its own paint is `none`
    // since the backdrop became packaged media, so `background` — the token
    // this used to delete — is no longer referenced by it.
    await page.locator("[data-vigilia-palette-token]").selectOption("bars");
    await page
      .locator("[data-vigilia-palette-replacement]")
      .selectOption("panel");
    await captureVisualReview(page, testInfo, "editor-palette-reassignment");
    await page.locator("[data-vigilia-palette-delete]").click();
    await expect(
      page.locator('[data-vigilia-palette-token] option[value="bars"]'),
    ).toHaveCount(0);

    const envelope = (await saveEnvelope(page)) as {
      artboard: { barColor?: { ref: string } };
      globals: { palette: Record<string, unknown> };
    };
    expect(envelope.artboard.barColor).toEqual({ ref: "palette.panel" });
    expect(envelope.globals.palette.bars).toBeUndefined();
  });

  test("reassigns chart paint before deleting its palette token", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-palette-token]")
      .selectOption("chartTrack");
    await page
      .locator("[data-vigilia-palette-replacement]")
      .selectOption("bars");
    await page.locator("[data-vigilia-palette-delete]").click();

    const envelope = (await saveEnvelope(page)) as {
      globals: { palette: Record<string, unknown> };
      scene: {
        objects: Array<{
          id?: string;
          settings?: { track?: { ref?: string } };
        }>;
      };
    };
    expect(envelope.globals.palette.chartTrack).toBeUndefined();
    expect(
      (
        sceneObject(envelope, "ram-gauge")?.["settings"] as
          | { track?: unknown }
          | undefined
      )?.track,
    ).toEqual({ ref: "palette.bars" });
  });

  test("edits a global type preset through the property surface", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.route("https://cdn.jsdelivr.net/fontsource/fonts/**", (route) =>
      route.fulfill({ body: Buffer.from([0, 1, 2]) }),
    );
    await page.locator("[data-vigilia-type-preset]").selectOption("36-500");
    // Read the option the panel offers rather than typing an id: the picker's
    // rows come from the generated catalogue, so a literal here pins one
    // revision of it.
    const faceId = await page
      .locator("[data-vigilia-font-face] option")
      .first()
      .getAttribute("value");
    await page.locator("[data-vigilia-font-face]").selectOption(faceId!);
    await page.locator("[data-vigilia-font-apply]").click();
    const size = page.locator("[data-vigilia-type-size]");
    await size.fill("34");
    await size.press("Tab");
    await expect(size).toHaveValue("34");
    const letterSpacing = page.locator("[data-vigilia-type-letter-spacing]");
    await letterSpacing.fill("0.25");
    await letterSpacing.press("Tab");

    const saved = await savePackage(page);
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "type-preset.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened type-preset.vigilia-theme",
    );
    await page.locator("[data-vigilia-type-preset]").selectOption("36-500");
    const reopened = (await saveEnvelope(page)) as {
      globals: {
        typePresets: {
          "36-500": {
            value: {
              size: number;
              letterSpacing: number;
              face: { assetId: string };
              trioRole: string;
            };
          };
        };
      };
    };
    expect(reopened.globals.typePresets["36-500"].value).toMatchObject({
      size: 34,
      letterSpacing: 0.25,
      face: { assetId: faceId! },
      trioRole: "heading",
    });
    await page
      .locator("[data-vigilia-type-letter-spacing]")
      .scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-type-preset");
  });

  test("paints a preset's tracking into the rendered wordmark", async ({
    page,
  }, testInfo) => {
    // The one assertion the unit tests cannot make: that ink actually moves.
    // `applyObjectTypePresets` could set `charSpacing` correctly and the canvas
    // could still not show it.
    //
    // Measured as pixels rather than as the object's `width`, because the
    // wordmark is a `Textbox` — its width is the authored box, which tracking
    // does not change. What tracking changes is where the ink lands inside it.
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.locator("[data-vigilia-type-preset]").selectOption("36-500");
    const tracking = page.locator("[data-vigilia-type-letter-spacing]");

    await tracking.fill("0");
    await tracking.press("Tab");
    const untracked = await inkReachOf(page, "wordmark");

    await tracking.fill("6");
    await tracking.press("Tab");
    const tracked = await inkReachOf(page, "wordmark");

    // Six gaps at 6px each is 36px of extra tracking at 36px. The bar is
    // below that, so a resampling artefact cannot produce it — but it has to be
    // real ink, and ink only reaches that far if the tracking propagated.
    expect(untracked).toBeGreaterThan(0);
    expect(tracked - untracked).toBeGreaterThan(8);
  });

  test("captures curated font trio controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.locator("[data-vigilia-type-preset]").selectOption("36-500");
    const face = page.locator("[data-vigilia-font-face]");
    await face.scrollIntoViewIfNeeded();
    await expect(face).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apply trio" }),
    ).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-font-trio");
  });

  test("reassigns text type presets before deleting one", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.locator("[data-vigilia-type-preset]").selectOption("20-400");
    await page
      .locator("[data-vigilia-type-replacement]")
      .selectOption("24-400");
    await page.locator("[data-vigilia-type-delete]").scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-type-reassignment");
    await page.locator("[data-vigilia-type-delete]").click();
    await expect(
      page.locator('[data-vigilia-type-preset] option[value="20-400"]'),
    ).toHaveCount(0);

    const envelope = (await saveEnvelope(page)) as {
      globals: { typePresets: Record<string, unknown> };
      scene: {
        objects: Array<{
          id?: string;
          vigiliaText?: { runs: Array<{ typePreset?: string }> };
        }>;
      };
    };
    expect(envelope.globals.typePresets["20-400"]).toBeUndefined();
    expect(
      (
        sceneObject(envelope, "cpu-card-title")?.["vigiliaText"] as
          | { runs: ReadonlyArray<{ typePreset?: string }> }
          | undefined
      )?.runs[0]?.typePreset,
    ).toBe("typePresets.24-400");
  });

  test("captures dirty document replacement confirmation for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.evaluate(() => {
      const editor = Object.entries(
        window as unknown as Record<string, unknown>,
      ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
        | {
            canvas: {
              item(
                index: number,
              ): { set(key: string, value: number): void } | undefined;
              requestRenderAll(): void;
            };
          }
        | undefined;
      editor?.canvas.item(1)?.set("left", 64);
      editor?.canvas.requestRenderAll();
    });
    await page.keyboard.press("Control+n");
    await expect(page.locator("dialog")).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-dirty-replacement");
  });

  test("selects a chart in the starter theme through the visible Fabric canvas", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await expect(
      page.locator('[data-vigilia-chart-setting="thickness"]'),
    ).toBeVisible();
  });

  test("persists artboard properties without rescaling Fabric objects", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-background-media-fit]")
      .selectOption("contain");
    await page.locator("[data-vigilia-artboard-width]").fill("1000");
    await page.locator("[data-vigilia-artboard-width]").press("Tab");
    await page
      .locator("[data-vigilia-artboard-background]")
      .selectOption("palette.bars");

    const envelope = (await saveEnvelope(page)) as {
      artboard: {
        contentFit?: string;
        width: number;
        background?: { ref: string };
        backgroundMedia?: { fit: string };
      };
      scene: { objects: Array<{ id?: string; left?: number }> };
    };
    // The only fit an author sets is the media's. The artboard's own content
    // fit is a guarantee of the model, so this asserts the control that does
    // exist writes what it says and the one that does not is not invented.
    expect(envelope.artboard.backgroundMedia?.fit).toBe("contain");
    expect(envelope.artboard.contentFit ?? "contain").toBe("contain");
    expect(envelope.artboard.width).toBe(1000);
    expect(envelope.artboard.background).toEqual({ ref: "palette.bars" });
    expect(leftFor(envelope, "wordmark")).toBe(118);
  });

  test("offers no control for the artboard's own content fit", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    // The user read "Preview fit" as how their picture renders in the preview,
    // because it sat above "Media fit" and chose between the same two words.
    // It was the artboard content's fit, it is always contain, and no author
    // sets it — so the panel must not offer it, and must still offer the media's.
    // No pane is opened first: the artboard panel is document-level, so it is
    // in the inspector's Design tab whatever the left column is showing.
    await page.goto(EDITOR);
    await page.waitForSelector(
      "[data-vigilia-artboard-fit-mode], [data-vigilia-background-media-fit]",
    );

    await expect(page.locator("[data-vigilia-artboard-fit-mode]")).toHaveCount(
      0,
    );
    const mediaFit = page.locator("[data-vigilia-background-media-fit]");
    const settingsPanel = page.locator("section", {
      has: mediaFit,
    });
    const labels = await settingsPanel.locator("label").allTextContents();
    expect(labels).not.toContain("Preview fit");
    // The control that does exist, still named and still choosing.
    expect(labels).toContain("Media fit");
    await expect(mediaFit).toHaveValue("cover");
    await mediaFit.selectOption("contain");
    await expect(mediaFit).toHaveValue("contain");
  });

  test("shows the Style tab's resolved appearance for a selection", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await setThemePackage(page, "style-tab.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "style-tab",
      metadata: { themeLanguage: "en" },
      artboard: {
        width: 320,
        height: 180,
        background: { ref: "palette.background" },
        barColor: { ref: "palette.none" },
      },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          background: {
            name: "Background",
            value: { kind: "solid", color: "#102030" },
          },
          ink: { name: "Ink", value: { kind: "solid", color: "#00b8d9" } },
        },
        typePresets: {
          body: { name: "Body", value: { family: "sans-serif", size: 16 } },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Textbox",
            id: "cpu-label",
            left: 20,
            top: 20,
            width: 200,
            text: "CPU",
            originX: "left",
            originY: "top",
            fill: "#00b8d9",
            vigiliaPaint: { fill: "palette.ink" },
            vigiliaText: {
              runs: [
                {
                  kind: "literal",
                  text: "CPU",
                  typePreset: "typePresets.body",
                  style: { color: { ref: "palette.ink" } },
                },
              ],
            },
          },
        ],
      },
    });

    // With nothing selected the tab lists what the document offers, which is
    // what an author needs before they have picked anything.
    await openInspectorTab(page, "Style");
    const style = page.locator('[data-vigilia-panel="style"]');
    // The tab names the token and its value, not the `palette.ink` string the
    // reference is written as. `Ink → #00b8d9` is the same fact in the author's
    // words, and asserting it keeps both halves of the claim — which token, and
    // what it resolves to here.
    await expect(style).toContainText("Ink");
    await expect(style).toContainText("#00b8d9");
    await expect(style).toContainText("Body");

    // Selecting the text replaces the document's list with its own resolution.
    // Select through the layer row: the canvas origin is not a stable coordinate
    // to click, because the stage letterboxes the artboard inside its host.
    await page.locator('[data-vigilia-layer="cpu-label"]').click();
    await openInspectorTab(page, "Style");
    await expect(style).toContainText("Ink");
    await expect(style).toContainText("Body → sans-serif 16px");
    await expect(style.locator("[data-vigilia-globals]")).toHaveCount(0);

    await captureVisualReview(page, testInfo, "editor-style-tab");
  });

  test("persists a selected chart binding", async ({ page }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page
      .locator('[data-vigilia-binding="ram-gauge-percent"]')
      .selectOption("ram.used");
    const precision = page.locator(
      '[data-vigilia-binding-field="ram-gauge-percent.precision"]',
    );
    await precision.fill("2");
    await precision.press("Tab");

    const envelope = (await saveEnvelope(page)) as {
      bindings: Record<string, Array<{ id: string; semanticKey: string }>>;
    };
    expect(envelope.bindings["ram-gauge"]).toContainEqual({
      id: "ram-gauge-percent",
      semanticKey: "ram.used",
      precision: 2,
    });
  });

  test("persists selected chart paint as a palette reference", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page
      .locator('[data-vigilia-chart-paint="progress"]')
      .selectOption("palette.chartTrack");

    const envelope = (await saveEnvelope(page)) as {
      scene: {
        objects: Array<{
          id?: string;
          settings?: { progress?: { ref?: string } };
        }>;
      };
    };
    expect(
      (
        sceneObject(envelope, "ram-gauge")?.["settings"] as
          | { progress?: unknown }
          | undefined
      )?.progress,
    ).toEqual({ ref: "palette.chartTrack" });
  });

  test("refreshes bound text without saving its sampled value", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await setThemePackage(page, "live-text.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "live-text",
      metadata: { themeLanguage: "en" },
      artboard: {
        width: 320,
        height: 180,
        background: { ref: "palette.background" },
        barColor: { ref: "palette.none" },
      },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          background: {
            name: "Background",
            value: { kind: "solid", color: "#102030" },
          },
          ink: { name: "Ink", value: { kind: "solid", color: "#00b8d9" } },
        },
        typePresets: {
          body: { name: "Body", value: { family: "sans-serif", size: 16 } },
        },
      },
      bindings: {
        "cpu-label": [{ id: "load", semanticKey: "cpu.load", precision: 0 }],
      },
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Textbox",
            id: "cpu-label",
            left: 20,
            top: 20,
            width: 200,
            text: "CPU --",
            originX: "left",
            originY: "top",
            fill: "#00b8d9",
            vigiliaPaint: { fill: "palette.ink" },
            vigiliaText: {
              runs: [
                {
                  kind: "literal",
                  text: "CPU ",
                  typePreset: "typePresets.body",
                  style: { color: { ref: "palette.ink" } },
                },
                {
                  kind: "value",
                  bindingId: "load",
                  typePreset: "typePresets.body",
                  style: { color: { ref: "palette.ink" } },
                },
              ],
            },
          },
        ],
      },
    });
    // Values are the editor's default, so nothing has to be switched to prove
    // a sampled value reaches the canvas.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const editor = Object.entries(
            window as unknown as Record<string, unknown>,
          ).find(
            ([key, value]) =>
              key.startsWith("vigilia-fabric-editor-") &&
              (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } })
                .canvas.upperCanvasEl?.isConnected,
          )?.[1] as
            | {
                canvas: { getObjects(): Array<{ get(name: string): unknown }> };
              }
            | undefined;
          return editor?.canvas
            .getObjects()
            .find((object) => object.get("id") === "cpu-label")
            ?.get("text");
        }),
      )
      .toMatch(/^CPU \d/);
    await expect(
      page.evaluate(() => {
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(
          ([key, value]) =>
            key.startsWith("vigilia-fabric-editor-") &&
            (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } }).canvas
              .upperCanvasEl?.isConnected,
        )?.[1] as
          | {
              canvas: { getObjects(): Array<{ get(name: string): unknown }> };
            }
          | undefined;
        const text = editor?.canvas
          .getObjects()
          .find((object) => object.get("id") === "cpu-label");
        return {
          fill: text?.get("fill"),
          height: text?.get("height"),
          opacity: text?.get("opacity"),
          styles: text?.get("styles"),
          visible: text?.get("visible"),
          width: text?.get("width"),
        };
      }),
    ).resolves.toMatchObject({
      fill: "#00b8d9",
      height: expect.any(Number),
      opacity: 1,
      styles: { 0: { 0: { fill: "#00b8d9" } } },
      visible: true,
      width: 200,
    });
    await expect(
      page.evaluate(() => {
        const coverage = [
          ...document.querySelectorAll<HTMLCanvasElement>(
            "#vigilia-fabric-editor canvas",
          ),
        ].map((canvas) => {
          const pixels = canvas
            .getContext("2d")
            ?.getImageData(0, 0, canvas.width, canvas.height).data;
          let ink = 0;
          for (
            let index = 0;
            pixels !== undefined && index < pixels.length;
            index += 4
          ) {
            if (
              pixels[index] < 32 &&
              pixels[index + 1] > 100 &&
              pixels[index + 2] > 100
            )
              ink += 1;
          }
          return `${canvas.className}:${canvas.width}x${canvas.height}; ink=${ink}`;
        });
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(
          ([key, value]) =>
            key.startsWith("vigilia-fabric-editor-") &&
            (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } }).canvas
              .upperCanvasEl?.isConnected,
        )?.[1] as
          | {
              canvas: { getObjects(): Array<{ get(name: string): unknown }> };
            }
          | undefined;
        const text = editor?.canvas
          .getObjects()
          .find((object) => object.get("id") === "cpu-label") as
          | {
              getBoundingRect(): {
                left: number;
                top: number;
                width: number;
                height: number;
              };
            }
          | undefined;
        return { coverage, bounds: text?.getBoundingRect() };
      }),
    ).resolves.toMatchObject({
      coverage: expect.arrayContaining([expect.stringMatching(/ink=[1-9]\d*/)]),
      bounds: expect.objectContaining({
        left: expect.any(Number),
        top: expect.any(Number),
      }),
    });
    await captureVisualReview(page, testInfo, "editor-live-text");

    const envelope = (await saveEnvelope(page)) as {
      scene: {
        objects: Array<{ id?: string; text?: string; vigiliaText?: unknown }>;
      };
    };
    const text = envelope.scene.objects.find(
      (object) => object.id === "cpu-label",
    );
    expect(text?.text).toBe("CPU —");
    expect(text?.vigiliaText).toEqual(
      expect.objectContaining({
        runs: expect.arrayContaining([
          expect.objectContaining({ bindingId: "load" }),
        ]),
      }),
    );
  });

  test("opens a v2 theme and keeps the active editor when its Fabric runtime is incompatible", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    const envelope = {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "opened",
      metadata: { themeLanguage: "en" },
      artboard: { width: 320, height: 180 },
      scene: {
        version: "7.4.0",
        objects: [{ type: "Rect", id: "panel", width: 100, height: 50 }],
      },
    };

    await setThemePackage(page, "opened.vigilia-theme", envelope);
    await expect(page.locator("#status")).toHaveText(
      "Opened opened.vigilia-theme",
    );
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await setThemePackage(page, "incompatible.vigilia-theme", {
      ...envelope,
      fabricVersion: "7.5.0",
    });
    await expect(page.locator("#status")).toContainText("incompatible");
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
  });

  test("names an object from the selection inspector and keeps it across save and reopen", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.locator('[data-vigilia-layer="wordmark"]').click();
    await openInspectorTab(page, "Design");

    // Driven through the control, not the bridge: reaching into the page would
    // prove the bridge works, not that an author can name anything.
    const name = page.locator("[data-vigilia-name]");
    await expect(name).toBeVisible();
    await name.fill("Brand mark");
    await name.press("Tab");

    await expect(page.locator('[data-vigilia-layer="wordmark"]')).toContainText(
      "Brand mark",
    );

    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    const envelope = saved.parsed.envelope as {
      scene?: { objects?: { id?: string; name?: string }[] };
    };
    // The name is authored state on the object, so it travels in the scene and
    // not in an editor-only side map beside it.
    expect(
      envelope.scene?.objects?.find((object) => object.id === "wordmark")?.name,
    ).toBe("Brand mark");

    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "renamed.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened renamed.vigilia-theme",
    );

    // The reopened document's own layer list must carry the name, not just the
    // bytes: a reader that never loaded the property would pass the assertion
    // above.
    await expect(page.locator('[data-vigilia-layer="wordmark"]')).toContainText(
      "Brand mark",
    );
  });

  test("falls back to the id for an object authored before names existed", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await setThemePackage(page, "unnamed.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "unnamed",
      metadata: { themeLanguage: "en" },
      artboard: { width: 320, height: 180 },
      scene: {
        version: "7.4.0",
        objects: [{ type: "Rect", id: "panel", width: 100, height: 50 }],
      },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened unnamed.vigilia-theme",
    );

    // A scene with no name on the object still opens, still shows its id, and
    // still accepts a name typed into the same control.
    await expect(page.locator('[data-vigilia-layer="panel"]')).toContainText(
      "panel",
    );
    await page.locator('[data-vigilia-layer="panel"]').click();
    await openInspectorTab(page, "Design");
    await page.locator("[data-vigilia-name]").fill("Card");
    await page.locator("[data-vigilia-name]").press("Tab");
    await expect(page.locator('[data-vigilia-layer="panel"]')).toContainText(
      "Card",
    );
  });

  test("round-trips an opened v2 Fabric scene through the save path", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    const picker = page.locator('input[accept=".vigilia-theme"]');
    await setThemePackage(page, "source.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "source",
      metadata: { themeLanguage: "en" },
      artboard: { width: 320, height: 180 },
      scene: {
        version: "7.4.0",
        objects: [{ type: "Rect", id: "panel", width: 100, height: 50 }],
      },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened source.vigilia-theme",
    );

    const download = page.waitForEvent("download");
    await page.keyboard.press("Control+s");
    const stream = await (await download).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const saved = Buffer.concat(chunks);
    const parsed = readThemePackage(saved);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = parsed.envelope as {
      id: string;
      scene: { objects: Array<{ id?: string }> };
    };

    expect(envelope.id).toBe("source");
    expect(envelope.scene.objects).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "panel" })]),
    );

    await picker.setInputFiles({
      name: "roundtrip.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened roundtrip.vigilia-theme",
    );
  });

  test("imports and round-trips packaged images", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    // **The pane is opened first, because an author opens it first.** The import
    // and replace below go through the buttons the pane renders, and a control
    // behind a closed pane is not one a person can press. Driving the hidden
    // input directly is the route this finding is about: it stays green while
    // the feature is unreachable, so it proves nothing.
    await openPane(page, "Assets");
    await expect(page.locator("[data-vigilia-asset-import]")).toBeVisible();
    await expect(page.locator("[data-vigilia-asset-replace]")).toBeVisible();
    await chooseAssetFile(page, "import", {
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAIklEQVQ4jWNk2HHzPwMVARM1DRs1cNTAUQNHDRw1cCgZCAC1HQK4IWYK+QAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    // The starter declares a packaged backdrop of its own, so the claim is that
    // this import produced exactly one option named for it — not a bare total,
    // which a starter change would silently move. An option carries the file the
    // author chose, so that is what it is matched on.
    const imported = page.locator("[data-vigilia-asset-select] option");
    await expect(imported.filter({ hasText: "logo" })).toHaveCount(1);
    // **The asset to replace is named, not assumed.** The panel's select keeps
    // whatever was selected, and a fresh document's first declaration is now
    // the starter's own backdrop — so a bare "replace" here would rewrite that
    // one. Saying which asset is meant keeps the test independent of
    // declaration order.
    await page.locator("[data-vigilia-asset-select]").selectOption("logo");
    // **A different extension is refused, and this is now pinned as one.**
    // `replace` keeps the declared path and its bytes in step, so swapping a
    // `.png` for `.svg` would leave the package claiming `.png` over SVG bytes.
    // The old body asserted the opposite — that the replacement arrived as a
    // second `logo-2` declaration — which is the behaviour `replace` was
    // changed away from, so the test had been red since.
    await chooseAssetFile(page, "replace", {
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#00b8d9"/></svg>',
      ),
    });
    await expect(page.locator("#status")).toContainText(
      "could not be imported",
    );
    await expect(imported.filter({ hasText: "logo" })).toHaveCount(1);
    await expect(assetReferences(page)).resolves.toEqual([
      { assetId: "logo", kind: "image" },
    ]);

    // The same extension is the supported replacement: one declaration, new
    // bytes, everything bound to it re-pointed. **Reselected first**, because a
    // refused replace clears the selection and the geometry below reads the
    // active object.
    await page.locator("[data-vigilia-asset-select]").selectOption("logo");
    await chooseAssetFile(page, "replace", {
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABJLR0AcHhtczMAAAGH",
        "base64",
      ),
    });
    // **One declaration, not two.** `Replace` swaps the chosen asset's bytes and
    // re-points everything bound to it; declaring a second asset and leaving the
    // chosen one holding its old bytes is what it stopped doing, precisely so a
    // package does not grow by one file per press. The count is asserted so a
    // regression that went back to declaring would be caught here.
    await expect(imported.filter({ hasText: "logo" })).toHaveCount(1);
    // **What the select holds afterwards is asserted, because the panel now
    // guarantees it.** Re-rendering rebuilds the options and restores the
    // previous selection, so replacing must not move the author off the asset
    // they were pointing at.
    await expect(page.locator("[data-vigilia-asset-select]")).toHaveValue(
      "logo",
    );
    // What the round trip owes is the one declaration, re-pointed at the new
    // file, and the object still bound to it.
    await expect(assetReferences(page)).resolves.toEqual([
      { assetId: "logo", kind: "image" },
    ]);
    await expect(
      page.evaluate(() => {
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(
          ([key, value]) =>
            key.startsWith("vigilia-fabric-editor-") &&
            (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } }).canvas
              .upperCanvasEl?.isConnected,
        )?.[1] as {
          canvas: {
            getActiveObject():
              | {
                  hasBorders: boolean;
                  hasControls: boolean;
                  controls: Record<string, { visible?: boolean }>;
                  get(name: string): unknown;
                  getCoords(): Array<{ x: number; y: number }>;
                }
              | undefined;
            getObjects(): Array<{ get(name: string): unknown }>;
            setActiveObject(object: unknown): void;
          };
        };
        // **Select the image, rather than reading whatever is active.** The
        // round trip above re-opened the package, which clears the selection,
        // and a refused replace clears it too — so this was reading a different
        // object on a different day and calling the difference "no selection
        // geometry". Named by the asset the test imported, so it is the same
        // object the rest of the block is about.
        const image = editor.canvas
          .getObjects()
          .find(
            (object) =>
              (object.get("vigiliaAsset") as { assetId?: string } | undefined)
                ?.assetId === "logo",
          );
        if (image !== undefined) editor.canvas.setActiveObject(image);
        else return undefined;
        return image === undefined
          ? undefined
          : {
              hasBorders: image.hasBorders,
              hasControls: image.hasControls,
              format: image.get("format"),
              controls: Object.fromEntries(
                Object.entries(image.controls).map(([key, control]) => [
                  key,
                  control.visible,
                ]),
              ),
              hasSelectionGeometry: (() => {
                const [topLeft, topRight, bottomRight] = image.getCoords();
                return (
                  topLeft !== undefined &&
                  topRight !== undefined &&
                  bottomRight !== undefined &&
                  topRight.x - topLeft.x > 50 &&
                  bottomRight.y - topRight.y > 50
                );
              })(),
            };
      }),
    ).resolves.toMatchObject({
      hasBorders: true,
      hasControls: true,
      format: "png",
      controls: { tl: true, tr: true, bl: true, br: true },
      hasSelectionGeometry: true,
    });
    await openPane(page, "Assets");
    await page
      .getByRole("heading", { name: "Assets" })
      .scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-assets");
    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    expect(saved.parsed.assets["assets/logo.svg"]).toBeDefined();
    expect(saved.parsed.envelope.scene.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vigiliaAsset: { assetId: "logo", kind: "image" },
        }),
      ]),
    );
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "assets.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: saved.bytes,
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened assets.vigilia-theme",
    );
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await expect(assetReferences(page)).resolves.toContainEqual({
      assetId: "logo",
      kind: "svg",
    });
  });

  test("authors a packaged background image through Theme settings", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    await page.goto(EDITOR);
    await openPane(page, "Assets");
    await chooseAssetFile(page, "import", {
      name: "hero.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAIklEQVQ4jWNk2HHzPwMVARM1DRs1cNTAUQNHDRw1cCgZCAC1HQK4IWYK+QAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await page.locator("[data-vigilia-background-asset]").selectOption("hero");
    await page
      .locator("[data-vigilia-background-media-fit]")
      .selectOption("contain");
    await expect(page.locator("[data-vigilia-background-asset]")).toHaveValue(
      "hero",
    );
    await page
      .locator("[data-vigilia-background-asset]")
      .scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-background-media");

    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    expect(saved.parsed.envelope.artboard.backgroundMedia).toEqual({
      assetId: "hero",
      fit: "contain",
    });
    expect(saved.parsed.assets["assets/hero.png"]).toBeDefined();
  });

  test("persists an ordinary drag and restores it through undo", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await setThemePackage(page, "movable.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "movable",
      metadata: { themeLanguage: "en" },
      artboard: { width: 320, height: 180 },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          accent: {
            name: "Accent",
            value: { kind: "solid", color: "#00b8d9" },
          },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Rect",
            id: "panel",
            left: 40,
            top: 50,
            width: 60,
            height: 40,
            scaleX: 1.2,
            scaleY: 0.8,
            angle: 30,
            fill: "#00b8d9",
            vigiliaPaint: { fill: "palette.accent" },
            originX: "left",
            originY: "top",
          },
        ],
      },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened movable.vigilia-theme",
    );

    // Scene points go through the camera (`artboardScreenRect`), never the canvas
    // box: the canvas is host-sized, so its box says nothing about the artboard.
    const center = await sceneToClient(page, 320, 76, 66);
    await page.mouse.dblclick(center.x, center.y);
    expect(await saveEnvelope(page)).toMatchObject({
      scene: {
        objects: [
          expect.objectContaining({
            id: "panel",
            left: 40,
            top: 50,
            scaleX: 1.2,
            scaleY: 0.8,
            angle: 30,
          }),
        ],
      },
    });

    await page.keyboard.press("Control+z");
    expect(leftFor(await saveEnvelope(page), "panel")).toBeCloseTo(40, 3);

    const start = await sceneToClient(page, 320, 70, 70);
    const end = await sceneToClient(page, 320, 150, 70);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();

    const savedAfterDrag = await saveEnvelope(page);
    expect(leftFor(savedAfterDrag, "panel")).toBeGreaterThan(100);

    await page.keyboard.press("Control+z");
    const savedAfterUndo = await saveEnvelope(page);
    expect(leftFor(savedAfterUndo, "panel")).toBeCloseTo(40, 3);
  });

  test("enters a group, steps back out, and survives an undo", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "desktop surface");
    await page.goto(EDITOR);
    await setThemePackage(page, "grouping.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "grouping",
      metadata: { themeLanguage: "en" },
      artboard: { width: 320, height: 180 },
      // The brief's fixture wrote a raw `fill`; this validator rejects one
      // without a palette reference, so the paint is declared the way every
      // other fixture here declares it.
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          accent: {
            name: "Accent",
            value: { kind: "solid", color: "#00b8d9" },
          },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Group",
            id: "grp",
            left: 40,
            top: 40,
            // Without these the group revives 0x0 and its `aCoords` collapse to a
            // point, so the pointer finds no target at all and entry never starts.
            width: 30,
            height: 30,
            objects: [
              {
                type: "Rect",
                id: "child",
                left: 0,
                top: 0,
                width: 30,
                height: 30,
                fill: "#00b8d9",
                vigiliaPaint: { fill: "palette.accent" },
                originX: "left",
                originY: "top",
              },
            ],
          },
          {
            type: "Rect",
            id: "outside",
            left: 240,
            top: 40,
            width: 30,
            height: 30,
            fill: "#00b8d9",
            vigiliaPaint: { fill: "palette.accent" },
            originX: "left",
            originY: "top",
          },
        ],
      },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened grouping.vigilia-theme",
    );

    // Points are derived from the camera, never from the canvas box: the canvas is
    // host-sized, so its box says nothing about where the artboard is.
    const rect = await page.evaluate(() => {
      const b = (
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
      return b.editor.viewport.artboardScreenRect();
    });
    // `rect` is canvas-relative, so the canvas box offset is added here. The
    // local form stays because the call site destructures a tuple; the poll for
    // `active === "child"` below is what stops a click on nothing from passing.
    const canvasBox = (await page
      .locator("#vigilia-fabric-editor canvas.upper-canvas")
      .boundingBox())!;
    const at = (x: number, y: number): [number, number] => [
      canvasBox.x + rect.left + (x / 320) * rect.width,
      canvasBox.y + rect.top + (y / 180) * rect.height,
    ];

    const state = (): Promise<{
      active: string | undefined;
      childLeft: number | undefined;
      groupPresent: boolean;
    }> =>
      page.evaluate(() => {
        const b = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  getActiveObject(): { id?: string } | undefined;
                  getObjects(): Array<{
                    id?: string;
                    getObjects?(): Array<{ id?: string; left?: number }>;
                  }>;
                };
              };
            };
          }
        ).vigiliaEditorBridge;
        const canvas = b.editor.canvas;
        const group = canvas.getObjects().find((object) => object.id === "grp");
        return {
          active: canvas.getActiveObject()?.id,
          childLeft: group
            ?.getObjects?.()
            .find((object) => object.id === "child")?.left,
          groupPresent: group !== undefined,
        };
      });

    // Double-click inside the child: the pointer's target resolves to the child,
    // which becomes the active object while the group stays in the context.
    const [cx, cy] = at(55, 55);
    await page.mouse.dblclick(cx, cy);
    await expect.poll(async () => (await state()).active).toBe("child");

    // The entered group and its child are reachable; the row outside the context is
    // not. `data-context` is the attribute the stylesheet keys on, and the computed
    // opacity is the only thing that shows the rule matches the row it should.
    const rowStyle = (id: string) =>
      page.locator(`[data-vigilia-layer="${id}"]`).evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          context: node.getAttribute("data-context"),
          opacity: style.opacity,
        };
      });

    await expect.poll(async () => (await rowStyle("grp")).context).toBe("true");
    await expect
      .poll(async () => (await rowStyle("child")).context)
      .toBe("true");
    await expect
      .poll(async () => (await rowStyle("outside")).context)
      .toBe("false");
    await expect
      .poll(async () => (await rowStyle("outside")).opacity)
      .toBe("0.45");
    // The positive half of the same rule: the child is inside the context and must
    // not be dimmed. Without this, a rule that dimmed every row would pass.
    await expect.poll(async () => (await rowStyle("child")).opacity).toBe("1");

    const before = (await state()).childLeft;
    // `toBeTypeOf` is Vitest's; Playwright's `expect` has no such matcher.
    expect(typeof before).toBe("number");

    // Nudge (Task 6's binding), then undo it. The undo must not leave the context
    // pointing at a destroyed object.
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await state()).childLeft)
      .toBe((before ?? 0) + 1);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await state()).childLeft).toBe(before);

    // Escape is the assertion that survives the undo — but only if it reads
    // identity rather than id. Every read above is by `id`, and a revived object
    // keeps its `id`: a context still holding the *pre-undo* instance satisfies
    // `active === "grp"` just as well as a re-resolved one, and `groupPresent`
    // reads the revived canvas either way. Neither can tell the two apart.
    const inCanvas = (): Promise<boolean> =>
      page.evaluate(() => {
        const b = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: { getActiveObject(): unknown; getObjects(): unknown[] };
              };
            };
          }
        ).vigiliaEditorBridge;
        return b.editor.canvas
          .getObjects()
          .includes(b.editor.canvas.getActiveObject());
      });

    await page.keyboard.press("Escape");
    // For a one-object selection Fabric sets `activeObject` to that object, so
    // `setActiveObject(target)` makes `getActiveObject() === target`. Identity is
    // therefore readable here, and is the only thing that separates a live group
    // from the destroyed instance.
    await expect.poll(inCanvas).toBe(true);
    await expect.poll(async () => (await state()).active).toBe("grp");
    expect((await state()).groupPresent).toBe(true);
  });

  test("rehydrates a chart runtime after undo", async ({ page }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await selectStarterChart(page);
    // The grab point comes from the object's own geometry, through the camera.
    // **The gauge's own world box.** Inside an entered group a drag moves the
    // part, and the part's `left` in the saved document is its position inside
    // the card — which a drag does not change. The card's own left edge is no
    // better: the gauge sits inside the card's wider panel, so moving it 80
    // units need not move the card's edge at all. World coordinates on the
    // thing the pointer actually moved is the only read that survives.
    const cardLeft = async (): Promise<number> =>
      (await objectRect(page, "ram-gauge")).left;
    const start = await clientOfStarterGauge(page);
    const left = await cardLeft();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y);
    await page.mouse.up();
    expect(await cardLeft()).toBeGreaterThan(left);

    await page.keyboard.press("Control+z");
    expect(await cardLeft()).toBeCloseTo(left, 3);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const editor = Object.entries(
            window as unknown as Record<string, unknown>,
          ).find(
            ([key, value]) =>
              key.startsWith("vigilia-fabric-editor-") &&
              (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } })
                .canvas.upperCanvasEl?.isConnected,
          )?.[1] as
            | {
                canvas: { getObjects(): Array<{ get(name: string): unknown }> };
              }
            | undefined;
          const find = (
            objects: readonly {
              get(name: string): unknown;
              getObjects?: () => unknown[];
            }[],
          ): unknown => {
            for (const candidate of objects) {
              if (candidate.get("id") === "ram-gauge") return candidate;
              const found = find(candidate.getObjects?.() ?? []);
              if (found !== undefined) return found;
            }
            return undefined;
          };
          // The gauge is a part of the RAM card, so a search of the root list
          // found nothing and the poll timed out on a chart that was there.
          const chart = find(editor?.canvas.getObjects() ?? []) as
            | { option?: { series?: unknown[] } }
            | undefined;
          const option = chart?.option;
          return option?.series?.length ?? 0;
        }),
      )
      .toBeGreaterThan(0);
  });

  test("keeps a non-selectable object unselectable after an undo", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    // The reported bug: an object authored `selectable: false` resists a click
    // on first open — but undo revives the scene through serialisation, and
    // Fabric omits `selectable`/`evented` from `toObject`, so it came back an
    // ordinary draggable object. The fix is in
    // `scene-fabric/src/persist.ts`, which lists both in
    // `SCENE_PERSISTED_PROPERTIES`, so the guard is general.
    //
    // **The witness is a fixture, not the starter.** The starter used to author
    // a full-artboard `background` rect and this clicked bare artboard to meet
    // it; its backdrop is packaged media now, so that object is gone and the
    // property is asserted on a plate the test authors itself — which is also
    // the property the fix actually covers. A test aimed at the plate alone
    // would pass while any other non-selectable object stayed draggable.
    await page.goto(EDITOR);
    await setThemePackage(page, "unselectable.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "unselectable",
      metadata: { themeLanguage: "en" },
      artboard: {
        width: STARTER_WIDTH,
        height: 941,
        background: { ref: "palette.none" },
        barColor: { ref: "palette.none" },
      },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid" as const, color: "transparent" },
          },
          plate: {
            name: "Plate",
            value: { kind: "solid" as const, color: "#101318" },
          },
          ink: {
            name: "Ink",
            value: { kind: "solid" as const, color: "#ecf5ff" },
          },
        },
        typePresets: {},
      },
      bindings: {},
      scene: {
        version: "7.4.0" as const,
        objects: [
          {
            type: "Rect" as const,
            id: "background",
            left: 0,
            top: 0,
            width: STARTER_WIDTH,
            height: 941,
            fill: "palette.plate",
            originX: "left" as const,
            originY: "top" as const,
            selectable: false,
            evented: false,
            vigiliaPaint: { fill: "palette.plate" },
          },
          {
            type: "Rect" as const,
            id: "draggable",
            left: 400,
            top: 400,
            width: 200,
            height: 60,
            fill: "palette.ink",
            originX: "left" as const,
            originY: "top" as const,
            vigiliaPaint: { fill: "palette.ink" },
          },
        ],
      },
    });

    /** Artboard coordinates to page pixels, through the live camera. */
    const at = (x: number, y: number): Promise<{ x: number; y: number }> =>
      sceneToClient(page, STARTER_WIDTH, x, y);

    /** The authored background object, by id, as the page's own instance. */
    const background = async (): Promise<unknown> =>
      page.evaluate(() => {
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
          | { canvas: { getObjects(): Array<{ get(n: string): unknown }> } }
          | undefined;
        const object = editor?.canvas
          .getObjects()
          .find((candidate) => candidate.get("id") === "background");
        return object === undefined
          ? null
          : {
              selectable: object.get("selectable"),
              evented: object.get("evented"),
            };
      });

    /** Whether the background geometrically covers a point, page coordinates. */
    const covers = async (point: { x: number; y: number }): Promise<boolean> =>
      page.evaluate(
        ([clientX, clientY]) => {
          const editor = Object.entries(
            window as unknown as Record<string, unknown>,
          ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
            | {
                canvas: {
                  getScenePoint(e: {
                    clientX: number;
                    clientY: number;
                  }): unknown;
                  getObjects(): Array<{
                    get(n: string): unknown;
                    containsPoint(p: unknown): boolean;
                  }>;
                };
              }
            | undefined;
          const object = editor?.canvas
            .getObjects()
            .find((candidate) => candidate.get("id") === "background");
          if (editor === undefined || object === undefined) return false;
          return object.containsPoint(
            editor.canvas.getScenePoint({ clientX: clientX, clientY: clientY }),
          );
        },
        [point.x, point.y],
      );

    const selected = async (): Promise<unknown> =>
      page.evaluate(() => {
        const editor = Object.entries(
          window as unknown as Record<string, unknown>,
        ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
          | {
              canvas: {
                getActiveObject(): { get(name: string): unknown } | undefined;
              };
            }
          | undefined;
        return editor?.canvas.getActiveObject()?.get("id") ?? null;
      });

    // A point in bare artboard, clear of the fixture's one draggable rect.
    const spot = await at(836, 890);

    // The guard is geometric, not a hit test: `findTarget` skips an object with
    // `evented: false`, so it reports nothing here whether or not the background
    // is still armed — it cannot witness the bug. `containsPoint` asks the
    // object's own bounds, which is true either way, so a pass below means the
    // background declined the click rather than that no object was there.
    expect(await covers(spot)).toBe(true);
    expect(await background()).toEqual({ selectable: false, evented: false });

    await page.mouse.click(spot.x, spot.y);
    expect(await selected()).toBeNull();

    // One authored change, so undo has entries either side of the revive. The
    // drag lands on the fixture's own `draggable` rect.
    const marker = await at(432, 418);
    await page.mouse.move(marker.x, marker.y);
    await page.mouse.down();
    await page.mouse.move(marker.x + 40, marker.y);
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(400);

    expect(await covers(spot)).toBe(true);
    expect(await background()).toEqual({ selectable: false, evented: false });

    await page.mouse.click(spot.x, spot.y);
    expect(await selected()).toBeNull();
  });

  test("keeps the active document when Fabric cannot revive a schema-valid scene", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await setUncheckedThemePackage(page, "unrevivable.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "unrevivable",
      metadata: { themeLanguage: "en" },
      artboard: { width: 320, height: 180 },
      scene: { version: "7.4.0", objects: [{ type: "UnknownFabricObject" }] },
    });

    await expect(page.locator("#status")).toContainText("Could not open");
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
  });

  test("asks before Open discards a changed Fabric scene", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.evaluate(() => {
      const editor = Object.entries(
        window as unknown as Record<string, unknown>,
      ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
        | {
            canvas: {
              item(
                index: number,
              ): { set(key: string, value: number): void } | undefined;
              requestRenderAll(): void;
            };
          }
        | undefined;
      editor?.canvas.item(1)?.set("left", 64);
      editor?.canvas.requestRenderAll();
    });
    await page.keyboard.press("Control+o");

    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "Save changes before opening another theme?",
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
  });

  test("asks before New discards a changed Fabric scene", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.evaluate(() => {
      const editor = Object.entries(
        window as unknown as Record<string, unknown>,
      ).find(([key]) => key.startsWith("vigilia-fabric-editor-"))?.[1] as
        | {
            canvas: {
              item(
                index: number,
              ): { set(key: string, value: number): void } | undefined;
              requestRenderAll(): void;
            };
          }
        | undefined;
      editor?.canvas.item(1)?.set("left", 64);
      editor?.canvas.requestRenderAll();
    });
    await page.keyboard.press("Control+n");

    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("#status")).toHaveText("Fabric editor ready");
  });

  test("snaps a dragged object to a neighbour and shows a guide", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();

    // Drag the network card's title (starter scene: left 1230, top 704,
    // originX left) horizontally until its left edge lands 2px short of the
    // storage card's left edge (1138) — a vertical alignment inside the 5-px
    // threshold, against the only card edge near that landing.
    const grab = await sceneToClient(page, STARTER_WIDTH, 1270, 720);
    const drop = await sceneToClient(page, STARTER_WIDTH, 1270 - 94, 720);
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(drop.x, drop.y, { steps: 12 });

    await captureVisualReview(page, testInfo, "editor-snap-guides");
    await page.mouse.up();
  });

  test("Ctrl-resizes near a neighbour without snapping or showing a guide", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    // **The card, not the frosted panel inside it.** A card is a group, and a
    // group is both what a click selects and what carries its own transform
    // controls — a bare panel inside it has no resize handle to grab. The
    // subject is the thing an author drags anyway.
    const card = await objectRect(page, "group-ram-card");
    const select = await sceneToClient(
      page,
      STARTER_WIDTH,
      card.left + (card.width / 2) * 0.6,
      card.top + 10,
    );
    await page.mouse.click(select.x, select.y);
    // **By id, not by member count.** `members` counts an `ActiveSelection`'s
    // children, and a card is a group of six — so the old "one object selected"
    // assertion now read 6 for the card the click correctly selected. The
    // question is *which* object, and only the id answers it.
    expect(await activeId(page)).toBe("group-ram-card");

    const line = (await objectRect(page, "group-vram-card")).left;
    const target = line - 2;
    const ctrl = await resizeRightHandleTo(
      page,
      "group-ram-card",
      target,
      testInfo,
      {
        ctrlKey: true,
        captureName: "editor-snap-resize-ctrl",
      },
    );

    // Ctrl-resize must match Ctrl-drag: preserve raw fractional geometry and
    // suppress guides, even when the raw edge is inside the snap threshold.
    // Client-pixel quantisation shifts the measured edge by less than 3 scene
    // pixels; snapping would move it onto `line` instead of preserving target.
    expect(Math.abs(ctrl.right - ctrl.raw)).toBeLessThan(3);
    expect(ctrl.right % 1).not.toBe(0);
    expect(Math.abs(ctrl.right - line)).toBeGreaterThan(0.5);
    expect(ctrl.guidePixels).toBe(0);

    // Compare same modifier against drag: both gestures must keep raw geometry
    // inside snap threshold rather than joining the neighbour's line.
    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    const dragCard = await objectRect(page, "ram-card");
    const dragSelect = await sceneToClient(
      page,
      STARTER_WIDTH,
      dragCard.left + (dragCard.width / 2) * 0.6,
      dragCard.top + 10,
    );
    await page.mouse.click(dragSelect.x, dragSelect.y);
    const dragBefore = await activeGeometry(page);
    const dragLine = (await objectRect(page, "vram-card")).left;
    const dragged = await dragActiveSelection(
      page,
      dragLine - 2 - dragBefore.rect.left,
      { ctrlKey: true },
    );
    // The dragged object stays off the neighbour line and paints no guide, the
    // same visible Ctrl escape required from resize.
    expect(Math.abs(dragged.left - dragLine)).toBeGreaterThan(0.5);
    expect(dragged.guidePixels).toBe(0);
  });

  test("snaps a resized object to a neighbour and shows a guide", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    // Select the RAM card by clicking its top strip, above every child. A
    // resize handle is only hit-testable on the active object, so this is not
    // optional: without it the pointerdown below starts a drag, not a scale.
    // The pair matters: the RAM card's right edge (1318) has no other candidate
    // line within the acquire threshold, so the only line the drag can reach is
    // the VRAM card's left edge (1332) — a nearer neighbour would be acquired
    // first and held, and the edge would land there instead. Both cards are
    // frosted like every other panel, and neither carries the one treatment that
    // is not: the frosted CPU card's own mr handle does not track the pointer
    // (recorded as a concern in the Task 7 report), so it cannot be the subject
    // of a resize that has to land on a line.
    // **The card, not the frosted panel inside it.** A card is a group, and a
    // group is both what a click selects and what carries its own transform
    // controls — a bare panel inside it has no resize handle to grab. The
    // subject is the thing an author drags anyway.
    const card = await objectRect(page, "group-ram-card");
    const select = await sceneToClient(
      page,
      STARTER_WIDTH,
      card.left + (card.width / 2) * 0.6,
      card.top + 10,
    );
    await page.mouse.click(select.x, select.y);
    // **By id, not by member count.** `members` counts an `ActiveSelection`'s
    // children, and a card is a group of six — so the old "one object selected"
    // assertion now read 6 for the card the click correctly selected. The
    // question is *which* object, and only the id answers it.
    expect(await activeId(page)).toBe("group-ram-card");

    // The no-snap control first: drag the `mr` handle to the scene x furthest
    // from every candidate line the rest of the scene offers. The edge must stay
    // where the pointer put it — a snap here would be a guide with no line to
    // snap to, which is exactly the mistake Review Focus item 1 names.
    const clear = await clearSceneX(
      page,
      "group-ram-card",
      card.left + card.width + 60,
      STARTER_WIDTH,
      STARTER_WIDTH,
    );
    expect(clear.distance).toBeGreaterThan(5);
    const raw = await resizeRightHandleTo(
      page,
      "group-ram-card",
      clear.x,
      undefined,
    );
    expect(Math.abs(raw.right - raw.raw)).toBeLessThan(3);
    // The user-visible half of "a guide with no snap": nothing was applied, so
    // no guide may be painted. Asserted on the pixels, because the geometry
    // assertions above cannot see a guide and a capture only exists under
    // VIGILIA_CAPTURE — a regression that painted unconditionally would pass
    // them all.
    expect(raw.guidePixels).toBe(0);

    // Then the snap, from a fresh page: drag the same handle so the raw right
    // edge lands 2px short of the VRAM card's left edge. That is inside the
    // threshold, so a live resize path pulls the edge onto the line and a dead
    // one leaves it 2px short.
    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await page.mouse.click(select.x, select.y);

    const line = (await objectRect(page, "group-vram-card")).left;
    const snapped = await resizeRightHandleTo(
      page,
      "group-ram-card",
      line - 2,
      testInfo,
    );
    expect(Math.abs(snapped.right - line)).toBeLessThan(1.5);
    // The applied guide, asserted where it is drawn: the whole row is sampled
    // for the guide colour along the snapped edge, so "verified guides" is
    // re-checkable by CI rather than only by a regenerated capture.
    expect(snapped.guidePixels).toBeGreaterThan(100);
  });

  test("snaps a two-object selection as a unit", async ({ page }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await selectTwoLabels(page);
    const before = await activeGeometry(page);
    // Without this the drag below is one object's, and the guard's whole
    // subject — a composed selection — is never exercised.
    expect(before.members).toBe(2);

    // `time-card`'s world left edge is a line near the drag's landing, read
    // rather than restated so the card's half-pixel stroke is included.
    const line = await worldLeftOf(page, "group-time-card");

    // Raw landing 4px past the line: inside the acquire threshold, so an eligible
    // selection is pulled onto a candidate. 4px, not 1px, because the pointer's
    // scene travel can shift by about a pixel.
    const { left } = await dragToLine(page, line, 4);

    // The drag ran: the selection moved well clear of where it started.
    expect(Math.abs(left - before.rect.left)).toBeGreaterThan(30);
    // The composed selection joined the snap and sits on the line. A selection
    // that never entered the gesture lands ~5px past it, so this is the
    // assertion the guard has to fail.
    expect(Math.abs(left - line)).toBeLessThan(0.5);
  });

  test("refuses a snap gesture for a scaled text selection", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await selectTwoLabels(page);
    expect((await activeGeometry(page)).members).toBe(2);
    // `time-card`'s world left edge is a candidate line near the drag landing.
    const line = await worldLeftOf(page, "group-time-card");

    // Positive control: the SAME gesture on the same objects while still
    // eligible. The raw landing is 4px past a candidate line, inside the acquire
    // threshold, so an eligible selection is pulled onto it — which is what
    // makes the refusal below a difference rather than a drag that missed.
    const snapped = await dragToLine(page, line, 4);
    expect(Math.abs(snapped.left - line)).toBeLessThan(0.5);

    // The refusal: a non-unit scale with a `Textbox` child. This is why the case
    // cannot be a jsdom test — the claim is about Fabric's own drag still running
    // while the snapping path never joins it.
    await scaleActiveSelection(page, 1.5);

    const refused = await dragToLine(page, line, 4);
    // Fabric's drag ran and nothing corrected it: the selection sits on the
    // landing the pointer asked for, 4px past the line, where the eligible
    // control above was pulled onto it. Measured against the landing rather
    // than the line because a refused drag may settle near a *different*
    // candidate; with the guard disabled the snap runs and this deviation is
    // several pixels, which is what the assertion has to catch.
    expect(Math.abs(refused.left - refused.raw)).toBeLessThan(1.5);
  });

  test("shows the rotation-angle indicator beside the pointer mid-rotation", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();

    // Select the performance card's title (scene 134,528, literal text) via
    // the canvas, then sweep its rotation handle above the top edge: the degree
    // readout must appear beside the pointer mid-gesture.
    const centre = await sceneToClient(page, STARTER_WIDTH, 200, 545);
    await page.mouse.click(centre.x, centre.y);
    // Fabric's mtr sits above the top edge at the object's centre X, roughly
    // 45px above the bounding top plus the handle radius.
    const handle = await sceneToClient(page, STARTER_WIDTH, 200, 457);
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + 30, handle.y + 30, { steps: 12 });

    await captureVisualReview(page, testInfo, "editor-rotation-indicator");
    await page.mouse.up();
  });

  test("captures the canvas dock over a selected object", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();

    // Select the performance card's title; the dock anchors to the canvas
    // bottom and shows only the actions this selection can run.
    const centre = await sceneToClient(page, STARTER_WIDTH, 200, 545);
    await page.mouse.click(centre.x, centre.y);
    const dock = page.locator('[aria-label="Selected object actions"]');
    await expect(dock).toHaveAttribute("data-visible", "true");
    await expect(dock.getByRole("button", { name: "Duplicate" })).toBeVisible();
    // **A group can be ungrouped**, and a click on a card selects the card. The
    // comment this replaces said "a single object cannot be ungrouped", which was
    // true while a click on a card reached one of its parts — so the button was
    // correctly absent for the wrong reason, and the assertion was pinning the
    // harness rather than the dock. What the dock must not show is `Group`,
    // which is what a multi-selection gets and this selection is not.
    await expect(dock.getByRole("button", { name: "Ungroup" })).toBeVisible();

    // The toolbar is the arrange surface: it stays visible for one object, so
    // the capture shows the discoverable-but-greyed state.
    const toolbar = page.locator("[data-vigilia-arrange-toolbar]");
    await expect(toolbar).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: "Align left" }),
    ).toBeDisabled();

    await captureVisualReview(page, testInfo, "editor-toolbar");
  });

  test("captures the canvas context menu over a selected object", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();
    await selectStarterChart(page);

    // The dock is the other surface that filters the same registry, so its
    // buttons are the expected entry set without restating the registry here.
    const dockNames = (
      await page
        .locator('[aria-label="Selected object actions"] button')
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("aria-label") ?? ""),
        )
    ).sort();

    // Off the gauge's centre, which is where its reading sits: a `Textbox`
    // hit-tests its glyphs, and a miss there lands on nothing — and a
    // right-click on nothing opens the *creation* menu, which is a different
    // menu and would make the dock/menu comparison vacuous.
    const gauge = await objectRect(page, "ram-gauge");
    const overGauge = await sceneToClient(
      page,
      STARTER_WIDTH,
      gauge.left + gauge.width / 2,
      gauge.top + 10,
    );
    await page.mouse.click(overGauge.x, overGauge.y, { button: "right" });

    const menu = page.locator('[aria-label="Canvas actions"]');
    await expect(menu).toBeVisible();
    const itemNames = (
      await menu
        .locator('[role="menuitem"]')
        .evaluateAll((items) =>
          items.map((item) => item.getAttribute("aria-label") ?? ""),
        )
    ).sort();

    // A menu that rendered nothing would satisfy a containment check.
    expect(dockNames.length).toBeGreaterThan(0);
    expect(itemNames).toEqual(dockNames);
    // Arrange has no `OBJECT_ACTIONS` id, so it cannot leak in from the toolbar.
    expect(itemNames).not.toContain("Align left");

    await captureVisualReview(page, testInfo, "editor-canvas-context-menu");

    // Phase 1 adds a second owner of the arrow keys. Read both axes of the
    // object's own origin point: `nudge-down` moves `top` and leaves `left`
    // alone, so the exact delta below pins the axis as well as the step. A lost
    // selection throws rather than returning nulls, or "did not move" would be
    // true for the wrong reason.
    const activePosition = async (): Promise<{
      left: number;
      top: number;
    }> =>
      page.evaluate(() => {
        const active = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  getActiveObject():
                    | { left?: number; top?: number }
                    | undefined;
                };
              };
            };
          }
        ).vigiliaEditorBridge.editor.canvas.getActiveObject();
        if (active?.left === undefined || active.top === undefined) {
          throw new Error(
            "The test needs an active object with an origin point.",
          );
        }
        return { left: active.left, top: active.top };
      });
    const before = await activePosition();
    await page.keyboard.press("ArrowDown");
    await expect(menu.locator('[role="menuitem"]').first()).toBeVisible();
    const after = await activePosition();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    // The requirement this task exists to prove: with the menu open, the arrow
    // reaches no canvas owner, so the selection does not move at all.
    expect(after).toEqual(before);
    // And the control that stops that requirement from being vacuous: the arrow
    // must still nudge once the menu has closed. An exact delta, measured in
    // this browser as `(0, +1)` — `NUDGE_STEP` in `canvas-nudge.ts` — not
    // `not.toEqual(before)`, so a dead nudge and a wrong step both fail here
    // instead of sliding through.
    await page.keyboard.press("ArrowDown");
    const nudged = await activePosition();
    expect(nudged).toEqual({ left: before.left, top: before.top + 1 });
  });

  test("zooms and pans the canvas, and cannot lose the artboard", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    // Read the camera through its own accessor: `viewport.zoom()` is the owner
    // of zoom (Task 1), and `window.vigiliaEditorBridge` is the page handle
    // Plan B Task 4 established. Reaching into `canvas.getZoom()` through a
    // debug-key scan reads a different owner and breaks when the handle moves.
    const readZoom = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { viewport: { zoom(): number } };
            };
          }
        ).vigiliaEditorBridge.editor.viewport.zoom(),
      );
    // Clamping is the camera's own contract, so the transform is read through
    // the same bridge the zoom is: a debug-key scan would read whichever
    // editor mounted first and could assert a stale canvas entirely.
    const translate = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { canvas: { viewportTransform: number[] } };
            };
          }
        ).vigiliaEditorBridge.editor.canvas.viewportTransform.slice(4, 6),
      );

    const fitted = await readZoom();
    await page
      .locator("#vigilia-fabric-editor canvas.upper-canvas")
      .hover({ position: { x: 200, y: 200 } });
    // Control is required: a plain wheel pans (Step 1 pins that), so wheeling
    // without it asserts the opposite of the unit contract and can only pass by
    // breaking it. Hold the modifier, then confirm the assertion fails with it
    // released — that is the teeth check for the modifier branch.
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -400);
    await page.keyboard.up("Control");
    expect(await readZoom()).toBeGreaterThan(fitted);
    // Pan a long way and confirm the artboard is still on screen: the clamped
    // transform keeps its edge inside the viewport.
    await page.keyboard.down("Space");
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(4000, 4000, { steps: 20 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    const transform = await page.evaluate(
      () =>
        (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { canvas: { viewportTransform: number[] } };
            };
          }
        ).vigiliaEditorBridge.editor.canvas.viewportTransform,
    );
    // The pan is clamped, so the transform saturates rather than running away.
    // Asserting only finiteness would pass for an unclamped transform — which is
    // exactly the regression this pins. Saturating is sign-agnostic and does not
    // depend on how viewportTransform[4] relates to clampPan's `offset`: drag
    // the same way again and the translate must not move.
    expect(Number.isFinite(transform[4])).toBe(true);
    expect(Number.isFinite(transform[5])).toBe(true);
    const atLimit = await translate();
    expect(atLimit.length).toBe(2);
    await page.keyboard.down("Space");
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(4000, 4000, { steps: 20 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    expect(await translate()).toEqual(atLimit);
  });

  test("tracks the camera's zoom in the stage readout", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "desktop surface");

    await page.goto(EDITOR);
    const readout = page.locator("[data-vigilia-zoom]");
    await expect(readout).toBeVisible();
    // Read the camera, not the canvas: `ViewportManager` owns zoom, so only the
    // camera can tell a readout that stopped following it from one that works.
    const cameraZoom = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { viewport: { zoom(): number } };
            };
          }
        ).vigiliaEditorBridge.editor.viewport.zoom(),
      );
    const percent = async (): Promise<number> =>
      Number((await readout.textContent())?.replace("%", ""));
    const fitted = await percent();
    expect(fitted).toBe(Math.round((await cameraZoom()) * 100));

    // A pan moves the canvas without changing the zoom: this is what separates a
    // readout that tracks the camera from one rendered once at mount.
    await page.keyboard.down("Space");
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(500, 470, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    expect(await percent()).toBe(fitted);

    // A wheel without the modifier pans too — only ctrl-wheel zooms.
    await page
      .locator("#vigilia-fabric-editor canvas.upper-canvas")
      .hover({ position: { x: 200, y: 200 } });
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -400);
    await page.keyboard.up("Control");
    expect(await percent()).toBe(Math.round((await cameraZoom()) * 100));
    expect(await percent()).toBeGreaterThan(fitted);

    await captureVisualReview(page, testInfo, "editor-zoom-readout");
  });

  test("a pasteboard drag marquees instead of moving an object", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "desktop surface");
    await page.goto(EDITOR);

    // Scene-space document geometry, NOT object `left`. A marquee press puts the
    // hit objects inside an ActiveSelection, whose `enterGroup` rebases every
    // child's `left` to be relative to the selection — so comparing raw `left`
    // across a selection boundary reports a move for an object that never moved,
    // and cannot tell a marquee from a drag. `getBoundingRect` is the world-space
    // rect either way. `selected` is read as well because "nothing moved" alone
    // is satisfied by a drag that reached nothing at all.
    const read = (): Promise<{
      selected: number;
      rects: Array<[string, number, number]>;
    }> =>
      page.evaluate(() => {
        const bridge = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  getActiveObject(): { getObjects?(): unknown[] } | undefined;
                  getObjects(): Array<{
                    id?: string;
                    getBoundingRect(): { left: number; top: number };
                  }>;
                };
              };
            };
          }
        ).vigiliaEditorBridge;
        const active = bridge.editor.canvas.getActiveObject();
        return {
          selected:
            active?.getObjects?.().length ?? (active === undefined ? 0 : 1),
          rects: bridge.editor.canvas
            .getObjects()
            .map((object) => {
              const bounds = object.getBoundingRect();
              return [
                String(object.id),
                Math.round(bounds.left),
                Math.round(bounds.top),
              ] as [string, number, number];
            })
            .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
        };
      });

    // The artboard's rect from the camera, in CANVAS-element coordinates — not the
    // canvas box (the canvas is host-sized and much larger than the artboard now)
    // and not client space either. `vpt[4]`/`vpt[5]` are relative to the canvas
    // element, and the canvas sits at x~357 in the page, so the offset is added
    // below rather than assumed away.
    const rect = await page.evaluate(() => {
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
      return bridge.editor.viewport.artboardScreenRect();
    });
    const canvasBox = (await page
      .locator("#vigilia-fabric-editor canvas.upper-canvas")
      .boundingBox())!;
    // Artboard point -> client point. The scale is uniform and derived from the
    // rect, so this mapping is correct whatever the artboard's aspect:
    // `fitScale()` is `Math.min(vw/w, vh/h)` (`viewport-manager/index.ts:97-100`), a
    // contain-fit, so at the measured 626x594 host the 1672x941 artboard draws
    // 626x352 and every point below y=941 in artboard space is BELOW the canvas.
    //
    // The `canvasBox.x/y` terms are the whole difference between this and a
    // vacuous test: without them every point below lands ~357px left and ~72px
    // above where it belongs, off the canvas, where the drag selects nothing and
    // the assertion passes while proving nothing.
    const scale = rect.width / STARTER_WIDTH;
    const at = (x: number, y: number): [number, number] => [
      canvasBox.x + rect.left + x * scale,
      canvasBox.y + rect.top + y * scale,
    ];

    const before = await read();

    // The pasteboard is the vertical band BELOW the artboard, and it is the only
    // one there is. `fitScale()` is a contain-fit, so at the 626x594 host the
    // scale is `min(626/1672, 594/941) = 0.374` and the artboard draws 626x352 —
    // full canvas width, centred vertically, leaving 121px bands above and below.
    // An earlier revision of this step claimed "about 240px of pasteboard below
    // the artboard and 350px to its right"; there is no pasteboard to its right,
    // and a pick point that assumed one would land off-canvas and pass vacuously.
    // So the press is placed by Y only, at the horizontal centre; X inside the
    // canvas is free because every X is pasteboard in that band.
    const [sx, sy] = [
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height - 16,
    ];
    // Both sides in client space: `rect` is canvas-relative, so its client
    // position is `canvasBox` + `rect`. Without the offsets these guards compare a
    // client point against a canvas-space edge and pass on a drag that is nowhere
    // near the pasteboard — the vacuity this test exists to remove, reintroduced
    // in the guard itself. The Y guard is the load-bearing one; the X guard only
    // records that the canvas is wider than the artboard's left edge, which is
    // trivially true and kept to document that X is unconstrained here.
    expect(sy).toBeGreaterThan(canvasBox.y + rect.top + rect.height);
    expect(sy).toBeLessThan(canvasBox.y + canvasBox.height);
    expect(sx).toBeGreaterThan(canvasBox.x + rect.left);
    const [ex, ey] = at(100, 200);

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // Past Fabric's marquee threshold before releasing: a zero-distance drag would
    // select nothing and pass without exercising the marquee at all.
    await page.mouse.move(ex, ey, { steps: 15 });
    await page.mouse.up();

    // A marquee selects, so the assertion is that no object MOVED — compared in
    // world space, because a selection rebases its members' `left`.
    expect((await read()).rects).toEqual(before.rects);
    // ...and that the marquee did reach the canvas at all: a drag whose press
    // landed off-canvas selects nothing, moves nothing, and would satisfy the
    // call above while exercising nothing.
    expect(before.selected).toBe(0);
    expect((await read()).selected).toBeGreaterThan(0);

    // The vacuity guard: the same gesture started INSIDE an object must move it.
    // Without this, a canvas that ignores pointer input entirely would pass the
    // assertions above.
    // The target is `time-card` (40,187 367x307), deliberately NOT the header:
    // Step 3 offers disarming `header-wash` as a fix, and a guard that drags inside
    // it would stop being interactive the moment that fix is taken,
    // failing for a reason unrelated to the marquee. (70,450) is inside the card
    // and outside every child it contains.
    const [ox, oy] = at(70, 450);
    await page.mouse.move(ox, oy);
    await page.mouse.down();
    await page.mouse.move(ox + 40, oy + 30, { steps: 10 });
    await page.mouse.up();
    expect((await read()).rects).not.toEqual(before.rects);
  });

  test("reorders a layer and refuses a cross-group drop", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "desktop surface");

    await page.goto(EDITOR);
    // A fixture with both shapes the rule distinguishes: two plain siblings, and a
    // group whose child must not be movable across the boundary.
    // `vigiliaPaint` and `globals.palette` are not decoration: a literal `fill`
    // with no paint ref is `unresolved-global-ref` and `setThemePackage` asserts
    // `writeThemePackage` returned ok, so a fixture without them fails before the
    // editor opens. Copied from the `movable.vigilia-theme` fixture at `:1322`.
    const paint = {
      palette: {
        none: { name: "None", value: { kind: "solid", color: "transparent" } },
        accent: { name: "Accent", value: { kind: "solid", color: "#00b8d9" } },
      },
    };
    const rect = (id: string, left: number, top: number) => ({
      type: "Rect",
      id,
      left,
      top,
      width: 40,
      height: 40,
      fill: "#00b8d9",
      vigiliaPaint: { fill: "palette.accent" },
      originX: "left",
      originY: "top",
    });
    await setThemePackage(page, "reorder.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "reorder",
      metadata: { themeLanguage: "en" },
      artboard: { width: 320, height: 180 },
      globals: paint,
      scene: {
        version: "7.4.0",
        objects: [
          rect("alpha", 20, 20),
          rect("beta", 80, 20),
          {
            type: "Group",
            id: "grp",
            left: 20,
            top: 90,
            objects: [{ ...rect("child", 0, 0), width: 30, height: 30 }],
          },
        ],
      },
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened reorder.vigilia-theme",
    );

    const panelOrder = (): Promise<(string | null)[]> =>
      page
        .locator("[data-vigilia-layer]")
        .evaluateAll((rows) =>
          rows.map((row) => row.getAttribute("data-vigilia-layer")),
        );
    // The panel paints topmost-first, so its row order is the reverse of the
    // serialized paint order. Compare the pair's *relative* order, never an
    // absolute index, so this holds whichever direction the projection uses.
    const idsIn = (envelope: unknown): string[] =>
      (
        envelope as { scene: { objects: Array<{ id?: string }> } }
      ).scene.objects.map((object) => object.id ?? "");
    const pairRelativeTo = (ids: string[]): boolean =>
      ids.indexOf("alpha") < ids.indexOf("beta");

    const beforeIds = idsIn(await saveEnvelope(page));
    const beforePanel = await panelOrder();
    expect(beforeIds).toContain("alpha");
    expect(beforeIds).toContain("beta");

    // Same parent: drop alpha on beta's row.
    await page
      .locator('[data-vigilia-layer="alpha"]')
      .dragTo(page.locator('[data-vigilia-layer="beta"]'));
    const afterPanel = await panelOrder();
    expect(afterPanel).not.toEqual(beforePanel);

    // Reordering is authored state (Step 4 calls `saveState`), so it must reach
    // the saved envelope — a panel-only change would be a projection bug.
    const afterIds = idsIn(await saveEnvelope(page));
    expect(pairRelativeTo(afterIds)).toBe(!pairRelativeTo(beforeIds));

    // Cross-group: a child dropped on a top-level sibling changes membership,
    // which this operation must refuse outright.
    await page
      .locator('[data-vigilia-layer="child"]')
      .dragTo(page.locator('[data-vigilia-layer="alpha"]'));
    expect(await panelOrder()).toEqual(afterPanel);
    expect(idsIn(await saveEnvelope(page))).toEqual(afterIds);
  });

  test("nudges the selection and records one history entry", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "desktop surface");
    // A stopped clock, so the burst's 300 ms idle window (NUDGE_IDLE_MS) can
    // never fire between two presses. On the wall clock the CDP round trips
    // around the assertions below are enough to exceed it under worker load,
    // which split one burst into two entries and made the undo assertion depend
    // on how fast the machine was.
    await installFixedClock(page);
    await page.goto(EDITOR);
    // Select through the bridge, not the layer row: a focused panel row is a
    // different starting state, and this test is about the nudge binding.
    await page.evaluate(() => {
      (
        window as unknown as {
          vigiliaEditorBridge: { selectLayer(id: string): void };
        }
      ).vigiliaEditorBridge.selectLayer("time-rule");
    });
    // **World, not group-local.** `selectLayer` selects the owning group, so the
    // nudge moves the card and `time-rule`'s own `left` — its position inside
    // the card — never changes. Reading that field would report a nudge that
    // did not happen as one that did not either, which is the harder failure to
    // see. `objectRect` descends into the group and composes the transform.
    const left = async (): Promise<number> =>
      (await objectRect(page, "time-rule")).left;
    const before = await left();
    await page.keyboard.press("ArrowRight");
    expect(await left()).toBeCloseTo(before + 1, 5);
    await page.keyboard.press("Shift+ArrowRight");
    expect(await left()).toBeCloseTo(before + 11, 5);

    // Control+z immediately after the burst's last press: the burst's entry is
    // not recorded until it closes, so the undo binding must close it first.
    await page.keyboard.press("Control+z");
    expect(await left()).toBeCloseTo(before, 5);
    // Both presses are one entry, so one redo must restore the *whole* burst. A
    // mechanism that recorded two entries would land at `before + 1` here.
    await page.keyboard.press("Control+y");
    expect(await left()).toBeCloseTo(before + 11, 5);

    const selectedIds = (): Promise<Array<string | undefined>> =>
      page.evaluate(() => {
        const b = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: { getActiveObjects(): Array<{ id?: string }> };
              };
            };
          }
        ).vigiliaEditorBridge;
        return b.editor.canvas.getActiveObjects().map((object) => object.id);
      });

    // Ctrl+A inside a text field belongs to the field, not to select-all. Focus
    // the layer rename input (Plan B Task 5) and confirm the selection is
    // untouched; without this the binding silently steals the field's own
    // select-all and the author's typed text is never selected.
    //
    // The row is opened from the tree rather than the canvas because a card's
    // parts are shut by default, and `time-rule` is inside one.
    await expandLayer(page, "group-time-card");
    await page.locator('[data-vigilia-layer="time-rule"]').dblclick();
    const rename = page.locator('input[aria-label^="Rename"]');
    await expect(rename).toBeFocused();
    await rename.press("Control+a");
    // The row names the part, but `selectLayer` reaches it through its owning
    // group — the same rule the canvas click follows.
    expect(await selectedIds()).toEqual(["group-time-card"]);

    // ...and the same key with focus on the document does select everything.
    // Without this the test only ever proves the binding stays silent.
    await rename.blur();
    await page.keyboard.press("Control+a");
    const ids = await selectedIds();
    expect(ids.length).toBeGreaterThan(1);
    // The theme's full-artboard `background` rect is `selectable: false` but IS
    // returned by `getObjects()`; selecting it would let the next nudge drag the
    // background off the artboard.
    expect(ids).not.toContain("background");
  });

  test("reorders and redoes on the graphic-editor's own chords", async ({
    page,
  }, testInfo) => {
    // **The chords, not the table.** A binding can sit in `PRODUCT_SHORTCUTS` and
    // still never reach the wire — a browser reports the *shifted* character for
    // Ctrl+Shift+[ and Ctrl+Shift+], so a table written against `[` and `]`
    // alone matches nothing. Only pressing the real keys proves the binding.
    test.skip(!isDesktopSurface(testInfo), "desktop surface");
    await installFixedClock(page);
    await page.goto(EDITOR);

    const paintOrder = (): Promise<Array<string | undefined>> =>
      page.evaluate(() => {
        const b = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  getObjects(): Array<{ id?: string }>;
                  getActiveObject(): { id?: string } | undefined;
                };
              };
            };
          }
        ).vigiliaEditorBridge;
        return b.editor.canvas.getObjects().map((object) => object.id);
      });
    const selectThroughBridge = (id: string): Promise<void> =>
      page.evaluate((layerId) => {
        (
          window as unknown as {
            vigiliaEditorBridge: { selectLayer(id: string): void };
          }
        ).vigiliaEditorBridge.selectLayer(layerId);
      }, id);

    /**
     * Presses a chord **as a physical keyboard delivers it**, over CDP.
     *
     * `page.keyboard.press("Control+Shift+]")` looks like the same gesture and is
     * not: it dispatches `key: "]"`, because Playwright synthesises the key by
     * name and never applies the shift-to-character mapping a real layout does.
     * A US keyboard with Shift held reports `key: "}"`. So the obvious press
     * exercises a *different event* from the one an arriving author generates,
     * and a binding keyed on the shifted character — the correct one — fails
     * under it. Verified by reading `event.key` in the page: `press` gave
     * `key="]" shift=true`, the CDP dispatch below gives `key="}" shift=true`.
     *
     * `page.keyboard.press` is still right for the plain chords below, which
     * produce the same event either way.
     */
    const cdp = await page.context().newCDPSession(page);
    const pressChord = async (
      key: string,
      code: string,
      virtualKey: number,
    ): Promise<void> => {
      await cdp.send("Input.dispatchKeyEvent", {
        type: "rawKeyDown",
        key,
        code,
        windowsVirtualKeyCode: virtualKey,
        // 2 = Ctrl, 8 = Shift.
        modifiers: 10,
      });
    };

    // **The subject is whichever object the starter paints second**, read rather
    // than assumed: the starter's absolute order is the fixture's business, and
    // the full-artboard `background` rect is in `getObjects()` but is not
    // selectable, so a hardcoded "first layer" would be a guess about both.
    const start = await paintOrder();
    const subject = start[1];
    if (subject === undefined)
      throw new Error("starter painted too few objects");
    await selectThroughBridge(subject);

    // **To front, on the standard chord**: Ctrl+Shift+], arriving as `}`.
    await pressChord("}", "BracketRight", 221);
    const afterFront = await paintOrder();
    expect(afterFront.at(-1)).toBe(subject);
    expect(afterFront).not.toEqual(start);

    // **To back, on the standard chord**: Ctrl+Shift+[, arriving as `{`.
    // Sending the *second* object to the back swaps it with the first, so the
    // order is the one-rotation of `start`, not `start` itself — comparing
    // against the full start would be arithmetic about the starter's order
    // rather than evidence about the binding.
    await pressChord("{", "BracketLeft", 219);
    const afterBack = await paintOrder();
    expect(afterBack[0]).toBe(subject);
    expect(afterBack.slice(1)).toEqual(start.filter((id) => id !== subject));

    // **The bare pair still works** — additive, not a replacement. Without this
    // the test only ever proves the new chords fire, and a regression that
    // deleted the old ones would pass.
    await page.keyboard.press("Control+]");
    expect((await paintOrder()).at(-1)).toBe(subject);
    await page.keyboard.press("Control+[");
    expect(await paintOrder()).toEqual(afterBack);

    // **Redo, on the standard chord.** The discriminator: after the redo below
    // the history holds no later entry, so a *second* Ctrl+Shift+Z that was
    // really an undo would step back to `before` and fail this assertion.
    const left = (): Promise<number | undefined> =>
      page.evaluate((id) => {
        const b = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  getObjects(): Array<{ id?: string; left?: number }>;
                };
              };
            };
          }
        ).vigiliaEditorBridge;
        return b.editor.canvas.getObjects().find((object) => object.id === id)
          ?.left;
      }, subject);
    const before = await left();
    if (typeof before !== "number")
      throw new Error(`${subject} is missing from the canvas`);
    await page.keyboard.press("ArrowRight");
    expect(await left()).toBe(before + 1);
    await page.keyboard.press("Control+z");
    expect(await left()).toBe(before);

    await page.keyboard.press("Control+Shift+z");
    expect(await left()).toBe(before + 1);
    await page.keyboard.press("Control+Shift+z");
    expect(await left()).toBe(before + 1);

    // **Ctrl+Y is still redo**, which is why the new chord was added beside it
    // rather than in place of it.
    await page.keyboard.press("Control+z");
    expect(await left()).toBe(before);
    await page.keyboard.press("Control+y");
    expect(await left()).toBe(before + 1);
  });
});

async function saveEnvelope(page: Page): Promise<unknown> {
  const { parsed } = await savePackage(page);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.envelope;
}

async function savePackage(page: Page): Promise<{
  readonly parsed: ReturnType<typeof readThemePackage>;
  readonly bytes: Buffer;
}> {
  const download = page.waitForEvent("download");
  // The File menu owns Save; the old panel section is gone.
  await page.locator("[data-vigilia-save-package]").click();
  await expect(page.locator("#status")).toHaveText("Theme package saved");
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  return { parsed: readThemePackage(bytes), bytes };
}

async function setThemePackage(
  page: Page,
  name: string,
  envelope: Parameters<typeof writeThemePackage>[0]["envelope"],
): Promise<void> {
  const result = writeThemePackage({ envelope, assets: {} });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(result.bytes),
  });
}

async function setUncheckedThemePackage(
  page: Page,
  name: string,
  envelope: unknown,
): Promise<void> {
  const buffer = zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        format: "vigilia-theme-package",
        version: 1,
        theme: "theme.json",
      }),
    ),
    "theme.json": strToU8(JSON.stringify(envelope)),
  });
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(buffer),
  });
}

async function openInspectorTab(page: Page, name: string): Promise<void> {
  await page.getByRole("tab", { name, exact: true }).click();
}

/**
 * A point inside the starter gauge that is not covered by the reading centred in
 * it. The gauge's own centre is the obvious choice and the wrong one: a text
 * object is selectable in its own right, so a click there selects the label and
 * the chart panel never opens. The gauge's box is opaque, so anywhere inside it
 * off the label's measured run will do.
 */
async function clientOfStarterGauge(
  page: Page,
): Promise<{ x: number; y: number }> {
  return sceneToClient(page, STARTER_WIDTH, 1068, 375);
}

/**
 * Selects the RAM card's gauge, by entering the card.
 *
 * **Two gestures, because the spec says they are two** (§3): a click *selects*
 * and gives the card's settings; entering gives the parts. The RAM gauge is a
 * part, so it is reached by entering — the first click of the double-click
 * selects the card and the manager then re-resolves the child under the pointer,
 * which is the gauge.
 *
 * The single click this used to be asserted `ram-gauge` and now gets
 * `group-ram-card`, which is the correct answer to a different question: the
 * card *is* what a click on it selects. This helper's subject is the chart, so
 * it takes the gesture that reaches a chart.
 */
async function selectStarterChart(page: Page): Promise<void> {
  const centre = await clientOfStarterGauge(page);
  await page.mouse.dblclick(centre.x, centre.y);
  // The precondition this helper never had: the tab lookup below turns a wrong
  // selection into a confusing timeout, so name the failure here instead.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              vigiliaEditorBridge: {
                editor: {
                  canvas: {
                    getActiveObject(): { id?: string } | undefined;
                  };
                };
              };
            }
          ).vigiliaEditorBridge.editor.canvas.getActiveObject()?.id ?? null,
      ),
    )
    .toBe("ram-gauge");
  // A chart selection routes the inspector to its Data tab.
  await openInspectorTab(page, "Data");
  await expect(
    page.locator('[data-vigilia-chart-setting="thickness"]'),
  ).toBeVisible();
}

/**
 * Enters a starter card by double-clicking its middle.
 *
 * The centre rather than an edge because the card's own parts are what the
 * manager re-resolves to, and the middle of a card is over one of them — an
 * edge click lands on the frosted panel. Enters *some* part, which is what the
 * gesture means; the caller names the part it then wants from the tree.
 */
async function enterStarterCard(page: Page, groupId: string): Promise<void> {
  const card = await objectRect(page, groupId);
  const centre = await sceneToClient(
    page,
    STARTER_WIDTH,
    card.left + card.width / 2,
    card.top + card.height / 2,
  );
  await page.mouse.dblclick(centre.x, centre.y);
  await expect.poll(() => activeId(page)).not.toBe(groupId);
}

/**
 * Opens a group in the layer tree, by its own twisty.
 *
 * A group is shut by default, so a test that wants a row inside one has to open
 * it first — the same two steps an author takes. Driven through the button
 * rather than the bridge so the row that appears is the one the panel painted.
 */
async function expandLayer(page: Page, groupId: string): Promise<void> {
  // `aria-expanded` rather than the label prefix: a row carries three
  // buttons — the twisty, Hide and Lock — so `button[aria-label]` is a strict
  // -mode violation, and only the twisty declares expansion at all.
  const twisty = page.locator(
    `[data-vigilia-layer="${groupId}"] button[aria-expanded]`,
  );
  await expect(twisty).toHaveAttribute("aria-expanded", "false");
  await twisty.click();
  await expect(twisty).toHaveAttribute("aria-expanded", "true");
}

async function assetReferences(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const editor = Object.entries(
      window as unknown as Record<string, unknown>,
    ).find(
      ([key, value]) =>
        key.startsWith("vigilia-fabric-editor-") &&
        (value as { canvas: { upperCanvasEl?: HTMLCanvasElement } }).canvas
          .upperCanvasEl?.isConnected,
    )?.[1] as
      | { canvas: { getObjects(): Array<{ get(name: string): unknown }> } }
      | undefined;
    return (
      editor?.canvas
        .getObjects()
        .filter((object) => object.get("type") === "image")
        .map((object) => object.get("vigiliaAsset")) ?? []
    );
  });
}

/**
 * Every object in a saved envelope, groups descended.
 *
 * The same defect as `readSceneObject` had, one layer out: the saved document
 * is Fabric JSON, so a card is a group and its parts live under `objects`. A
 * `.find` over the top level reported `undefined` for `ram-gauge` — a chart
 * the author can see and click — and the assertion failed as a *missing
 * setting* rather than as a search that stopped too early, which is the harder
 * failure to read.
 *
 * Read rather than written per call site so no assertion can quietly keep its
 * own shallower search.
 */
function sceneObjects(envelope: unknown): ReadonlyArray<SceneObjectJson> {
  const root = (
    envelope as {
      scene: { objects: readonly SceneObjectJson[] };
    }
  ).scene.objects;
  const all: SceneObjectJson[] = [];
  const visit = (objects: readonly SceneObjectJson[]): void => {
    for (const object of objects) {
      all.push(object);
      if (Array.isArray(object["objects"])) visit(object["objects"]);
    }
  };
  visit(root);
  return all;
}

/** One object out of a saved envelope, wherever it sits. */
function sceneObject(
  envelope: unknown,
  id: string,
): SceneObjectJson | undefined {
  return sceneObjects(envelope).find((object) => object["id"] === id);
}

function leftFor(envelope: unknown, id: string): number {
  const left = sceneObject(envelope, id)?.["left"];
  expect(left).toEqual(expect.any(Number));
  return left as number;
}

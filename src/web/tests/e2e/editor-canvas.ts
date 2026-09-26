import { expect, type Page, type TestInfo } from "@playwright/test";

export type ArtboardRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Viewport offsets are canvas-relative, not page coordinates. */
async function artboardRect(page: Page): Promise<ArtboardRect> {
  return page.evaluate(() =>
    (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: { viewport: { artboardScreenRect(): ArtboardRect } };
        };
      }
    ).vigiliaEditorBridge.editor.viewport.artboardScreenRect(),
  );
}

export async function sceneToClient(
  page: Page,
  sceneWidth: number,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const rect = await artboardRect(page);
  const box = (await page
    .locator("#vigilia-fabric-editor canvas.upper-canvas")
    .boundingBox())!;
  const scale = rect.width / sceneWidth;
  return { x: box.x + rect.left + x * scale, y: box.y + rect.top + y * scale };
}

/** Fabric's centre handles every origin; left + width / 2 does not. */
export async function clientOfScene(
  page: Page,
  id: string,
  sceneWidth = 1280,
): Promise<{ x: number; y: number }> {
  const centre = await page.evaluate((objectId) => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: {
            canvas: {
              getObjects(): Array<{
                id?: string;
                getCenterPoint(): { x: number; y: number };
              }>;
            };
          };
        };
      }
    ).vigiliaEditorBridge;
    const object = bridge.editor.canvas
      .getObjects()
      .find((candidate) => candidate.id === objectId);
    if (object === undefined) throw new Error(`no object with id ${objectId}`);
    const point = object.getCenterPoint();
    return { x: point.x, y: point.y };
  }, id);
  return sceneToClient(page, sceneWidth, centre.x, centre.y);
}

export type HandleKey = "tl" | "tr" | "br" | "bl" | "ml" | "mr" | "mt" | "mb";

/** The scene point of a named object's resize handle, read from the object's own
 * corner coordinates: Fabric draws and hit-tests `ml`/`mr` at the midpoint of
 * the two corners on that side, and the corner controls sit on the corners
 * themselves. Reading it rather than restating fixture numbers keeps the grab
 * on the handle after any fixture tweak, and the corners already carry the
 * object's stroke and scale. */
export async function objectHandleScenePoint(
  page: Page,
  id: string,
  key: HandleKey,
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([objectId, controlKey]) => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getObjects(): Array<{
                  id?: string;
                  getCoords(): Array<{ x: number; y: number }>;
                }>;
              };
            };
          };
        }
      ).vigiliaEditorBridge;
      const object = bridge.editor.canvas
        .getObjects()
        .find((candidate) => candidate.id === objectId);
      if (object === undefined)
        throw new Error(`no object with id ${objectId}`);
      const [topLeft, topRight, bottomRight, bottomLeft] = object.getCoords();
      if (!topLeft || !topRight || !bottomRight || !bottomLeft)
        throw new Error(`${objectId} has no corner coordinates`);
      const midpoint = (
        first: { x: number; y: number },
        second: { x: number; y: number },
      ) => ({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
      if (controlKey === "tl") return topLeft;
      if (controlKey === "tr") return topRight;
      if (controlKey === "br") return bottomRight;
      if (controlKey === "bl") return bottomLeft;
      if (controlKey === "ml") return midpoint(topLeft, bottomLeft);
      if (controlKey === "mr") return midpoint(topRight, bottomRight);
      if (controlKey === "mt") return midpoint(topLeft, topRight);
      return midpoint(bottomLeft, bottomRight);
    },
    [id, key] as const,
  );
}

export async function captureVisualReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  if (process.env["VIGILIA_CAPTURE"] === undefined) return;
  const directory =
    process.env["VIGILIA_CAPTURE_DIR"] ?? "../../docs/evidence/screenshots";
  const filename = `${name}-${testInfo.project.name}.png`;
  const screenshot = await page.screenshot({
    path: `${directory}/${filename}`,
  });
  await testInfo.attach(filename, {
    body: screenshot,
    contentType: "image/png",
  });
  expect(screenshot.byteLength).toBeGreaterThan(1000);
}

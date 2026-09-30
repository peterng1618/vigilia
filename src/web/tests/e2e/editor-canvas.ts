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

/** A local file the chooser offers, in the shape both chooser paths accept. */
export type LocalFile = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

/**
 * Chooses a local file the way an author does: press the button, then answer
 * the file chooser it opened.
 *
 * `setInputFiles` against the hidden input proves a route the product does not
 * offer — it drives a control no one can reach, so it stays green while the
 * feature is unreachable. Going through the button and the chooser event is
 * what a click actually produces, and it fails the moment the button is gone.
 */
export async function chooseAssetFile(
  page: Page,
  control: "import" | "replace",
  file: LocalFile,
): Promise<void> {
  const chooser = page.waitForEvent("filechooser");
  await page.locator(`[data-vigilia-asset-${control}]`).click();
  await (await chooser).setFiles(file);
}

/**
 * Answers a modal if it turns up, and reports whether it did.
 *
 * `isVisible()` answers about *now*, and these prompts are not up *now*: the
 * dirty guard resolves before it asks, so a test that checks immediately sees
 * nothing and skips the click — then hangs somewhere downstream waiting for a
 * button it decided did not exist. It reads as a product timeout and is a test
 * defect, which is exactly how issue #7 presented.
 *
 * Bounded so that "no prompt" stays a real outcome rather than a long wait: the
 * dirty guard is genuinely not settled on a just-saved document, and some
 * rounds ask and some do not.
 */
export async function answerDialogIfShown(
  page: Page,
  button: string,
  timeout = 3_000,
): Promise<boolean> {
  const dialog = page.locator("dialog");
  const shown = await dialog
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
  if (!shown) return false;
  await dialog.getByRole("button", { name: button, exact: true }).click();
  // Deliberately no "and wait for it to close". One flow reuses the element for
  // its next prompt — New asks for a size, then asks about the changes — so a
  // caller that waited for closure here would hang on the dialog it was about to
  // answer. Calling this twice in a row handles both steps.
  return true;
}

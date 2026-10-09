import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

export type ArtboardRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** What the page-side reader can be asked for off a scene object. */
export type SceneRead = "center" | "rect" | "coords";

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

/**
 * One named object, read from wherever in the document it lives.
 *
 * **The one search, in one place.** A card's parts are not in
 * `canvas.getObjects()` — they live inside the group, and the starter is eight
 * groups over fifty parts — so a helper that searched only the root reported
 * `no object with id time-card` for an object the author can see on the canvas,
 * and eleven specs failed on it. `glass-probe.ts` already carried this search
 * for the same reason.
 *
 * Every read is **world** rather than group-local: `getBoundingRect` and
 * `getCenterPoint` compose the ancestor transform, which is what a pointer
 * gesture needs. Reading `.left` off a part returns its position *inside* its
 * card, and the click lands somewhere the author never put anything — a test
 * that then fails for a reason that names neither grouping nor the bug.
 *
 * `read` is named rather than a callback because `page.evaluate` serializes the
 * function and cannot close over one; a switch inside the page is the honest
 * spelling of that constraint.
 */
export async function readSceneObject<T>(
  page: Page,
  id: string,
  read: SceneRead,
): Promise<T> {
  return page.evaluate(
    ([objectId, what]) => {
      type SceneObject = {
        readonly id?: string;
        readonly getObjects?: () => readonly SceneObject[];
        readonly getCenterPoint: () => { x: number; y: number };
        readonly getBoundingRect: () => {
          left: number;
          top: number;
          width: number;
          height: number;
        };
        readonly getCoords: () => Array<{ x: number; y: number }>;
      };
      const objects = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: { canvas: { getObjects(): readonly SceneObject[] } };
          };
        }
      ).vigiliaEditorBridge.editor.canvas.getObjects();

      const find = (
        candidates: readonly SceneObject[],
      ): SceneObject | undefined => {
        for (const candidate of candidates) {
          if (candidate.id === objectId) return candidate;
          const found = find(candidate.getObjects?.() ?? []);
          if (found !== undefined) return found;
        }
        return undefined;
      };
      const object = find(objects);
      if (object === undefined)
        throw new Error(`no object with id ${objectId}`);
      if (what === "center") return object.getCenterPoint();
      if (what === "coords") return object.getCoords();
      return object.getBoundingRect();
    },
    [id, read] as const,
  ) as Promise<T>;
}

/** Fabric's centre handles every origin; left + width / 2 does not. */
export async function clientOfScene(
  page: Page,
  id: string,
  sceneWidth = 1280,
): Promise<{ x: number; y: number }> {
  const centre = await readSceneObject<{ x: number; y: number }>(
    page,
    id,
    "center",
  );
  return sceneToClient(page, sceneWidth, centre.x, centre.y);
}

export type HandleKey = "tl" | "tr" | "br" | "bl" | "ml" | "mr" | "mt" | "mb";

/**
 * The scene point of a named object's resize handle, read from the object's own
 * corner coordinates: Fabric draws and hit-tests `ml`/`mr` at the midpoint of
 * the two corners on that side, and the corner controls sit on the corners
 * themselves. Reading it rather than restating fixture numbers keeps the grab
 * on the handle after any fixture tweak, and the corners already carry the
 * object's stroke and scale.
 */
export async function objectHandleScenePoint(
  page: Page,
  id: string,
  key: HandleKey,
): Promise<{ x: number; y: number }> {
  const corners = await readSceneObject<Array<{ x: number; y: number }>>(
    page,
    id,
    "coords",
  );
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  if (!topLeft || !topRight || !bottomRight || !bottomLeft)
    throw new Error(`${id} has no corner coordinates`);
  const midpoint = (
    first: { x: number; y: number },
    second: { x: number; y: number },
  ) => ({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
  if (key === "tl") return topLeft;
  if (key === "tr") return topRight;
  if (key === "br") return bottomRight;
  if (key === "bl") return bottomLeft;
  if (key === "ml") return midpoint(topLeft, bottomLeft);
  if (key === "mr") return midpoint(topRight, bottomRight);
  if (key === "mt") return midpoint(topLeft, topRight);
  return midpoint(bottomLeft, bottomRight);
}

/**
 * Opens a group row in the layer tree, the way an author does.
 *
 * **A group's parts are rows only while it is open**, and a document starts
 * with every group shut — so a spec that names a part's row without this waits
 * out its whole budget on a locator that never matches, and reports a broken
 * click rather than a shut tree.
 *
 * `button[aria-expanded]` rather than a label prefix: a group row carries four
 * buttons — the twisty, Hide, Lock and the entry control — so
 * `button[aria-label]` is a strict-mode violation, and only the twisty declares
 * expansion at all.
 */
export async function expandLayer(page: Page, groupId: string): Promise<void> {
  const twisty = page.locator(
    `[data-vigilia-layer="${groupId}"] button[aria-expanded]`,
  );
  if ((await twisty.getAttribute("aria-expanded")) === "true") return;
  await twisty.click();
  await expect(twisty).toHaveAttribute("aria-expanded", "true");
}

/**
 * Enters a group from its own row, the way an author does.
 *
 * **Entering and expanding are two acts**, and this is the entry one: the
 * twisty opens a group's rows, while entering makes its parts *selectable*.
 * `bridge.selectLayer` takes `owner ?? target`, so with the group merely open a
 * click on a part's row hands back the group. Hover is required rather than
 * decorative — the control is drawn on an attended row only, so it is not in
 * the DOM until the pointer is on the row, and entering expands the group on
 * the way.
 *
 * **Waits on the bridge's `groupContext()` naming the id**, not on the button
 * and not on the row's own attribute: the click repaints the row before the
 * panel has re-projected the tree around the new context, so a helper that
 * resolved on the DOM would leave the next action in the same spec racing the
 * re-projection. Returns immediately when the group is already entered, also
 * read from the bridge rather than from the row's label.
 */
export async function enterLayer(page: Page, groupId: string): Promise<void> {
  const entered = (): Promise<readonly string[]> =>
    page.evaluate(() =>
      (
        window as unknown as {
          vigiliaEditorBridge: { groupContext(): readonly string[] };
        }
      ).vigiliaEditorBridge.groupContext(),
    );
  if ((await entered()).includes(groupId)) return;
  const row = page.locator(`[data-vigilia-layer="${groupId}"]`);
  await row.hover();
  await row.locator("[data-vigilia-layer-entry]").click();
  await expect.poll(entered).toContain(groupId);
}

/**
 * A named object's world-space bounding rect, read from the object itself so a
 * fixture tweak cannot leave a test clicking at a stale point.
 */
export async function objectRect(
  page: Page,
  id: string,
): Promise<ArtboardRect> {
  return readSceneObject<ArtboardRect>(page, id, "rect");
}

/** A named object's world-space left edge, the snap line a neighbour offers. */
export async function worldLeftOf(page: Page, id: string): Promise<number> {
  return (await objectRect(page, id)).left;
}

/** A named object's world-space right edge, the snap line a neighbour offers. */
export async function worldRightOf(page: Page, id: string): Promise<number> {
  const rect = await objectRect(page, id);
  return rect.left + rect.width;
}

/**
 * The scene x in `[from, to]` furthest from every x-line the other objects and
 * the artboard offer, with that distance. A resize aimed at this x is clear of
 * every snap candidate, so "the raw landing survived" is a real no-snap
 * assertion — a guide drawn there would be a snap with no line to snap to.
 *
 * **The candidates are the root objects only, and that is the product's own
 * rule rather than a limit of this helper.** `snap-manager` enumerates
 * `canvas.forEachObject`, so a card snaps to cards and to loose objects but not
 * to a part inside a neighbouring card (`vg-123`, filed). Measuring against
 * anything more would make "clear of every candidate" vacuous in the safe
 * direction, which is the direction that hides a regression.
 */
export async function clearSceneX(
  page: Page,
  excludeId: string,
  from: number,
  to: number,
  artboardWidth: number,
): Promise<{ x: number; distance: number }> {
  return page.evaluate(
    ([objectId, start, end, artboard]: [string, number, number, number]) => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getObjects(): Array<{
                  id?: string;
                  getBoundingRect(): { left: number; width: number };
                }>;
              };
            };
          };
        }
      ).vigiliaEditorBridge;
      // The artboard is a snap source too; every test in this file treats the
      // scene as the starter's artboard wide, so its edges and centre belong
      // here. Passed in rather than closed over: this runs in the page.
      const lines = [0, artboard / 2, artboard];
      for (const object of bridge.editor.canvas.getObjects()) {
        if (object.id === objectId) continue;
        const rect = object.getBoundingRect();
        lines.push(
          rect.left,
          rect.left + rect.width / 2,
          rect.left + rect.width,
        );
      }
      let best = { x: start, distance: -1 };
      for (let x = start; x <= end; x += 0.5) {
        const distance = Math.min(...lines.map((line) => Math.abs(line - x)));
        if (distance > best.distance) best = { x, distance };
      }
      return best;
    },
    [excludeId, from, to, artboardWidth],
  );
}

/**
 * A visual-review capture, written only under `VIGILIA_CAPTURE=1`.
 *
 * **An optional `scope` photographs one element rather than the viewport.** The
 * inspector column is taller than a 1280×720 fold and its own scroller clips the
 * rest, so a viewport shot of it stops at whatever fits — the read-only `Spends`
 * section, bible §5 rule 1's standing example, never reaches the frame. Passing
 * the column element captures the whole column. With no scope the output is the
 * viewport shot every existing caller already produced.
 */
export async function captureVisualReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
  scope?: Locator,
): Promise<void> {
  if (process.env["VIGILIA_CAPTURE"] === undefined) return;
  const directory =
    process.env["VIGILIA_CAPTURE_DIR"] ?? "../../docs/evidence/screenshots";
  const filename = `${name}-${testInfo.project.name}.png`;
  const path = `${directory}/${filename}`;
  const screenshot =
    scope === undefined
      ? await page.screenshot({ path })
      : await scope.screenshot({ path });
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

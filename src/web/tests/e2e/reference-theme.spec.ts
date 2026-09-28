import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
import { readThemePackage, writeThemePackage } from "@vigilia/theme-package";
import { strToU8, zipSync } from "fflate";
import {
  type ArtboardRect,
  captureVisualReview,
  clientOfScene,
} from "./editor-canvas.js";
import { GLASS_ENVELOPE, glassStripesPng } from "./glass-fixture.js";
import { isDesktopSurface } from "./surface.js";

const EDITOR = "http://127.0.0.1:4174/";

/**
 * The reference composition, driven the way an author drives it.
 *
 * Eleven tasks built this. The files beside this one each prove one operation —
 * a glass control, a snap, a tracked preset, a caption. None of them proves
 * that a *user's* journey holds together, and that is the only thing left to
 * check: one document, authored through the product's own controls, saved,
 * closed, reopened, imported and captured, with the things that are allowed to
 * differ called out by name.
 *
 * Two things this file is careful about, because both produced confident wrong
 * answers elsewhere in this plan:
 *
 *  - **A rendered result is inspected, not inferred from a count.** The glass
 *    and the sharp-text claims are pixel measurements, and the thumbnails are
 *    looked at.
 *  - **A requirement the product does not meet is pinned, not written around.**
 *    `test.fail` marks the three gaps in "known gaps, pinned", so the suite
 *    stays runnable and still refuses to stay green once a gap closes. Only a
 *    gap that reproduces every time earns the marker: an intermittent one
 *    flaps, and the first version of the fourth marker did.
 */

const STARTER_WIDTH = 1672;
const STARTER_HEIGHT = 941;

/** The cards and marks the reference composition is made of. */
const REFERENCE_IDS = [
  "wordmark",
  "strapline",
  "time-card",
  "time",
  "date",
  "cpu-card",
  "cpu-card-value",
  "gpu-card",
  "ram-card",
  "ram-gauge",
  "vram-card",
  "trends-card",
  "trends-chart",
  "storage-card",
  "network-card",
] as const;

const desktop = (testInfo: TestInfo): void => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
};

/**
 * Keys that may never appear in a saved object.
 *
 * Two families, and both are claims the plan makes about persistence. Fabric's
 * own runtime and derived geometry — `ownMatrixCache` and friends — are what
 * `includeDefaultValues = false` exists to drop. The rest is the plan's rule that
 * telemetry, built chart options and resolved surfaces are runtime state: an
 * object carrying a series or a batch count has recorded a run, not a document.
 *
 * Read off the starter's own save rather than guessed: the authored set is
 * geometry, paint, type, the four `vigilia*` properties and a chart's `settings`,
 * and nothing below is authored state.
 */
const NEVER_SAVED = [
  "__corner",
  "__aCoords",
  "oCoords",
  "matrix",
  "calcTransformMatrix",
  "ownMatrixCache",
  "dirty",
  "cacheProperties",
  "_cacheCanvas",
  "_cacheContext",
  "_cacheTexture",
  "_set",
  "_width",
  "_height",
  "_objects",
  "_controls",
  "controls",
  "group",
  "zActive",
  "zReverse",
  "isEditing",
  "fontCache",
  "__style",
  "stateProperties",
  "globalCompositeOperation",
  "noScaleCache",
  "perPixelTargetFind",
  "minWidthLimit",
  "crossOrigin",
  "image",
  "src",
  "backgroundImage",
  "paintFirst",
  "skipControlsDrawing",
  "borderScaleFactor",
  "batchCount",
  "latest",
  "samples",
  "sample",
  "series",
  "xAxis",
  "yAxis",
  "tooltip",
  "legend",
  "option",
  "resolved",
  "runtime",
  "readings",
] as const;

interface ObjectFact {
  readonly id: string;
  readonly type: string;
  readonly rect: ArtboardRect;
  readonly glass: unknown;
}

/** Every object on the canvas, groups walked, with its authored box. */
function sceneFacts(page: Page): Promise<readonly ObjectFact[]> {
  return page.evaluate(() => {
    type Obj = {
      get(n: string): unknown;
      getObjects?(): Obj[];
      getBoundingRect(): {
        left: number;
        top: number;
        width: number;
        height: number;
      };
    };
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getObjects(): Obj[] } };
        };
      }
    ).vigiliaEditorBridge;
    const out: Array<{
      id: string;
      type: string;
      rect: { left: number; top: number; width: number; height: number };
      glass: unknown;
    }> = [];
    const walk = (objects: Obj[]): void => {
      for (const object of objects) {
        const id = object.get("id");
        if (typeof id === "string") {
          const r = object.getBoundingRect();
          out.push({
            id,
            type: String(object.get("type")),
            rect: {
              left: Math.round(r.left * 100) / 100,
              top: Math.round(r.top * 100) / 100,
              width: Math.round(r.width * 100) / 100,
              height: Math.round(r.height * 100) / 100,
            },
            glass: object.get("vigiliaGlass") ?? null,
          });
        }
        const children = object.getObjects?.() ?? [];
        if (children.length > 0) walk(children);
      }
    };
    walk(bridge.editor.canvas.getObjects());
    return out;
  });
}

function idsOf(facts: readonly ObjectFact[]): readonly string[] {
  return facts.map((fact) => fact.id);
}

async function openEditor(page: Page): Promise<void> {
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await waitForBridge(page);
  // The first envelope is mounted after `loadFontAssets` resolves, so an id
  // list read too early would be the starter's absence rather than the
  // reference composition's.
  await expect
    .poll(async () => (await sceneFacts(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(20);
}

/**
 * The scene bridge, once. The status line is set in the same tick the mount
 * finishes, but the global is published after the previous document's is torn
 * down, so waiting on the status is not waiting on the bridge — measured, not
 * assumed: without this the first `page.evaluate` of the scene reads
 * `undefined`.
 */
async function waitForBridge(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (
        window as unknown as {
          vigiliaEditorBridge?: { editor?: { canvas?: unknown } };
        }
      ).vigiliaEditorBridge?.editor?.canvas !== undefined,
    undefined,
    { timeout: 20_000 },
  );
}

/** The media layer showing decoded pixels, not merely a `complete` image —
 * `complete` is also true of a failed load, which is how an earlier round of
 * this plan measured an empty scratch and blamed the sampler. */
async function waitForMedia(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const element = document.querySelector<
        HTMLImageElement | HTMLVideoElement
      >(
        "[data-vigilia-background-media] img, [data-vigilia-background-media] video",
      );
      return element !== null && element.complete;
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.evaluate(() => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge?: { editor?: { canvas?: { renderAll(): void } } };
      }
    ).vigiliaEditorBridge;
    bridge?.editor?.canvas?.renderAll();
  });
}

async function openRailPane(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
}

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

async function savePackage(page: Page): Promise<{
  readonly bytes: Buffer;
  readonly envelope: Record<string, unknown>;
}> {
  const download = page.waitForEvent("download");
  await page.locator("[data-vigilia-save-package]").click();
  await expect(page.locator("#status")).toHaveText("Theme package saved");
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const parsed = readThemePackage(Buffer.concat(chunks));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.message);
  return {
    bytes: Buffer.concat(chunks),
    envelope: parsed.envelope as unknown as Record<string, unknown>,
  };
}

async function importPackage(
  page: Page,
  name: string,
  bytes: Buffer,
): Promise<void> {
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  await expect(page.locator("#status")).toHaveText(`Opened ${name}`);
}

function activeId(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: { getActiveObject(): { id?: string } | undefined };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas.getActiveObject()?.id,
  );
}

/** Walks a saved envelope and names every authored object that grew a key the
 * persistence rules forbid. Returns names, so a failure says which object. */
function forbiddenKeys(envelope: unknown): readonly string[] {
  const found: string[] = [];
  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if ((NEVER_SAVED as readonly string[]).includes(key)) {
        found.push(`${path}.${key}`);
      }
      walk(value, `${path}.${key}`);
    }
  };
  walk(envelope, "envelope");
  return found;
}

/**
 * The document without Fabric's derived per-character `styles` table.
 *
 * `styles` is what `applyAuthoredText` computes from each object's authored
 * `vigiliaText.runs`; nothing reads it back as authored state, and it is
 * recomputed on every mount. It is stripped here so the comparison is about
 * authored state, and the fact that it is *not* stable across two saves is
 * pinned by its own test rather than hidden by this exclusion.
 */
function authoredOnly(envelope: Record<string, unknown>): unknown {
  const copy = JSON.parse(JSON.stringify(envelope)) as {
    scene?: { objects?: Array<Record<string, unknown>> };
  };
  for (const object of copy.scene?.objects ?? []) delete object["styles"];
  return copy;
}

function objectsOf(
  envelope: Record<string, unknown>,
): readonly Record<string, unknown>[] {
  const scene = envelope["scene"] as { objects: Record<string, unknown>[] };
  return scene.objects;
}

test.describe("the reference composition, authored", () => {
  test("a new document is the reference composition, and a saved one is never replaced by it", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    await openEditor(page);

    // **The new default.** The reference's own shape, not an approximation of
    // it: every card and mark, at the reference's artboard.
    const fresh = await sceneFacts(page);
    expect(idsOf(fresh)).toEqual(expect.arrayContaining([...REFERENCE_IDS]));
    // The reference card's own box, in scene coordinates, so the composition is
    // the reference's rather than any arrangement of the right names.
    const clock = fresh.find((fact) => fact.id === "time-card");
    // `getBoundingRect` is the drawn box, so it carries the card's own 2px
    // outline on every side: 367x307 authored, 369x309 drawn.
    expect(clock?.rect).toEqual({
      left: 40,
      top: 187,
      width: 369,
      height: 309,
    });
    expect(
      await page.evaluate(() => {
        const bridge = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { viewport: { artboardScreenRect(): ArtboardRect } };
            };
          }
        ).vigiliaEditorBridge;
        return bridge.editor.viewport.artboardScreenRect().width;
      }),
    ).toBeGreaterThan(0);

    // **The author's work.** A panel inserted and styled through the product.
    await openRailPane(page, "Add");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Panel", exact: true })
      .click();
    const authored = (await activeId(page)) ?? "";
    expect(authored).not.toBe("");
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    await typeInto(page, page.locator("[data-vigilia-panel-radius]"), "18");
    const radius = page.locator("[data-vigilia-panel-radius]");
    await expect(radius).toHaveValue("18");
    const beforeSave = await sceneFacts(page);
    const authoredBefore = beforeSave.find((f) => f.id === authored);
    expect(authoredBefore).toBeDefined();

    const saved = await savePackage(page);
    expect(saved.envelope["artboard"]).toMatchObject({
      width: STARTER_WIDTH,
      height: STARTER_HEIGHT,
    });
    expect(
      objectsOf(saved.envelope).find((object) => object["id"] === authored),
    ).toMatchObject({ rx: 18, ry: 18 });

    // **Close.** A reload is a fresh mount, and a fresh mount is the new
    // default again — nothing about the edited document survives it, which is
    // what makes the next step a real test rather than a formality.
    await page.reload();
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await expect
      .poll(async () => (await sceneFacts(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(20);
    const reopened = idsOf(await sceneFacts(page));
    expect(reopened).toEqual(expect.arrayContaining([...REFERENCE_IDS]));
    expect(reopened).not.toContain(authored);

    // **Reopen the saved document.** Its own composition, bounds and all.
    await importPackage(page, "mine.vigilia-theme", saved.bytes);
    const restored = await sceneFacts(page);
    expect(idsOf(restored)).toEqual(expect.arrayContaining([...REFERENCE_IDS]));
    const restoredAuthored = restored.find((fact) => fact.id === authored);
    expect(restoredAuthored?.rect).toEqual(authoredBefore?.rect);

    // **And the new default must not have overwritten it on the way in.** A
    // document-for-document comparison, because "the composition looks right"
    // is also what a document the editor quietly rebuilt would look like.
    // Key order is not compared — JSON property order is not authored state —
    // and neither is Fabric's per-character `styles` table, which
    // `applyAuthoredText` rebuilds from `vigiliaText.runs` on every mount. That
    // exclusion is a measured defect, not a convenience: two saves of the same
    // unchanged document disagree on it, and the gap is pinned separately as
    // "a save is reproducible".
    const again = await savePackage(page);
    const first = readThemePackage(saved.bytes);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(authoredOnly(again.envelope)).toEqual(
        authoredOnly(first.envelope),
      );
    }

    // **New**, from the reopened document: the reference composition returns,
    // and the file the author saved is still theirs afterwards.
    // The menu's own shortcut, so the gesture is the editor's and not a
    // hand-rolled click sequence.
    //
    // **Both answers are answered, because the editor does not know which one
    // to ask for.** A just-saved document is reported as changed *sometimes*:
    // five "discard?" prompts and one silent New across six save-then-`Ctrl+N`
    // rounds on an unchanged starter. The author answers whichever comes.
    await page.keyboard.press("Control+n");
    const dialog = page.locator("dialog");
    if (await dialog.isVisible()) {
      await dialog.getByRole("button", { name: "Discard" }).click();
      await expect(dialog).toHaveCount(0);
    }
    await expect(page.locator("#status")).toHaveText("New Fabric theme");
    await expect
      .poll(async () => idsOf(await sceneFacts(page)), { timeout: 15_000 })
      .not.toContain(authored);
    expect(idsOf(await sceneFacts(page))).toEqual(
      expect.arrayContaining([...REFERENCE_IDS]),
    );
    const afterNew = readThemePackage(saved.bytes);
    expect(afterNew.ok).toBe(true);
    if (afterNew.ok) {
      expect(
        (afterNew.envelope as { scene: { objects: Record<string, unknown>[] } })
          .scene.objects,
      ).toContainEqual(expect.objectContaining({ id: authored, rx: 18 }));
    }

    await captureVisualReview(page, testInfo, "editor-reference-new");
  });

  test("insert, style, glass, bind and text survive save, close and reopen with no runtime state", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    // A whole journey — insert, style, glass, bind, save, close, reopen,
    // export — in one document, which is the point of the file. `test.slow`
    // raises the budget rather than the assertions.
    test.slow();
    await openEditor(page);

    // **Insert** — a text object and a chart, from the Add pane.
    await openRailPane(page, "Add");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Text", exact: true })
      .click();
    const textId = (await activeId(page)) ?? "";
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Panel", exact: true })
      .click();
    const panelId = (await activeId(page)) ?? "";
    expect(textId).not.toBe("");
    expect(panelId).not.toBe("");

    // **Style**, by keyboard: a radius, then a glass radius through the
    // checkbox's own Space key.
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    await typeInto(page, page.locator("[data-vigilia-panel-radius]"), "22");
    const glassToggle = page.locator("[data-vigilia-glass-enabled]");
    await glassToggle.focus();
    await page.keyboard.press("Space");
    await expect(glassToggle).toBeChecked();
    await typeInto(page, page.locator("[data-vigilia-glass-blur]"), "14");

    // **Bind** — the new chart pointed at a real semantic key, through the
    // binding select the chart panel owns. The select is named
    // `<nodeId>.<bindingId>`, so the node is read back rather than guessed.
    await openRailPane(page, "Add");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Line", exact: true })
      .click();
    const chartId = (await activeId(page)) ?? "";
    expect(
      await page.locator("[data-vigilia-binding]").count(),
      "a freshly inserted chart arrives unbound",
    ).toBe(0);

    // **Bind** — the starter's own sparkline, pointed at another real key
    // through the select the chart panel owns.
    await openRailPane(page, "Layers");
    await page.locator('[data-vigilia-layer="cpu-card-sparkline"]').click();
    await expect.poll(() => activeId(page)).toBe("cpu-card-sparkline");
    // A chart selection routes the inspector to its Data tab, which is where
    // the binding select lives.
    await page.getByRole("tab", { name: "Data", exact: true }).click();
    const bindingSelect = page.locator("[data-vigilia-binding]").first();
    await expect(bindingSelect).toBeVisible();
    const keys = await bindingSelect
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      );
    const key = keys.find((candidate) => candidate.startsWith("gpu."));
    expect(key, "the document offers a real key to bind").toBeDefined();
    await bindingSelect.selectOption(key!);
    const bound = "cpu-card-sparkline";

    const beforeSave = await sceneFacts(page);
    const ids = idsOf(beforeSave);
    expect(new Set(ids).size, "authored ids are unique").toBe(ids.length);
    for (const id of [textId, panelId, chartId]) expect(ids).toContain(id);

    // **Save**, and read what the file actually says.
    const saved = await savePackage(page);
    expect(forbiddenKeys(saved.envelope)).toEqual([]);
    const objects = objectsOf(saved.envelope);
    expect(objects).toContainEqual(
      expect.objectContaining({
        id: panelId,
        vigiliaGlass: { blurRadius: 14 },
      }),
    );
    // A chart carries its own `LineSettings`, never a built ECharts option.
    const chart = objects.find((object) => object["id"] === chartId);
    expect(chart?.["settings"]).toBeDefined();
    expect(forbiddenKeys(chart?.["settings"])).toEqual([]);
    // And the binding is authored state on the chart's own node.
    expect(
      (
        saved.envelope["bindings"] as Record<
          string,
          Array<{ semanticKey: string }>
        >
      )[bound],
    ).toContainEqual(expect.objectContaining({ semanticKey: key }));
    // And nothing sampled: the value a bound run is painting right now is not
    // in the file.
    const json = JSON.stringify(saved.envelope);
    const painted = await page.evaluate(() => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: { getObjects(): Array<{ get(n: string): unknown }> };
            };
          };
        }
      ).vigiliaEditorBridge;
      return bridge.editor.canvas
        .getObjects()
        .map((object) => String(object.get("text") ?? ""))
        .filter((text) => /^\d+(\.\d+)?%?$/.test(text.trim()));
    });
    for (const reading of painted) {
      expect(json, `"${reading}" was not sampled into the file`).not.toContain(
        `"text":"${reading}"`,
      );
    }

    // **Close and reopen** through the file the author exported.
    await page.reload();
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await importPackage(page, "journey.vigilia-theme", saved.bytes);
    await expect
      .poll(async () => idsOf(await sceneFacts(page)), { timeout: 15_000 })
      .toEqual(ids);
    const afterReopen = await sceneFacts(page);
    for (const fact of beforeSave) {
      const again = afterReopen.find((other) => other.id === fact.id);
      // Authored bounds are unchanged, to a hundredth of a scene pixel.
      expect(again?.rect, `${fact.id}'s box`).toEqual(fact.rect);
      expect(again?.glass, `${fact.id}'s treatment`).toEqual(fact.glass);
    }

    // **Export again** and confirm the second export carries the same document.
    const exported = await savePackage(page);
    expect(forbiddenKeys(exported.envelope)).toEqual([]);
    expect(idsOf(objectsOf(exported.envelope))).toEqual(ids);

    await captureVisualReview(page, testInfo, "editor-reference-journey");
  });

  test("an unreadable package leaves the open document and the author's work alone", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    await openEditor(page);

    await openRailPane(page, "Add");
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Panel", exact: true })
      .click();
    const panelId = (await activeId(page)) ?? "";
    const before = (await sceneFacts(page)).find((f) => f.id === panelId);
    expect(before).toBeDefined();

    // **Not a package at all.**
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "broken.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("this is not a zip archive"),
    });
    await expect(page.locator("#status")).toContainText("Could not open:");
    expect(idsOf(await sceneFacts(page))).toContain(panelId);

    // **A package whose envelope the validator refuses.** Written without
    // `writeThemePackage`, so the bytes are a real zip around a bad document.
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "invalid.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(
        zipSync({
          "manifest.json": strToU8(
            JSON.stringify({
              format: "vigilia-theme-package",
              version: 1,
              theme: "theme.json",
            }),
          ),
          "theme.json": strToU8(JSON.stringify({ schemaVersion: 2 })),
        }),
      ),
    });
    await expect(page.locator("#status")).toContainText("Could not open:");

    // **The work is still there, still editable, and still saveable** — the
    // property "errors preserve recoverable work" actually means.
    const after = (await sceneFacts(page)).find((f) => f.id === panelId);
    expect(after?.rect).toEqual(before?.rect);
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    await typeInto(page, page.locator("[data-vigilia-panel-radius]"), "9");
    await expect(page.locator("[data-vigilia-panel-radius]")).toHaveValue("9");
    const saved = await savePackage(page);
    expect(objectsOf(saved.envelope)).toContainEqual(
      expect.objectContaining({ id: panelId, rx: 9 }),
    );
  });

  test("a packaged font that will not load still leaves the document editable", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);

    // A declared face whose bytes are not a font. `writeThemePackage` is the
    // gate and it only checks the declaration matches the archive, so this is a
    // package the host would happily store and a browser cannot load.
    const broken = writeThemePackage({
      envelope: {
        ...GLASS_ENVELOPE,
        id: "e2e-broken-font",
        assets: [
          ...GLASS_ENVELOPE.assets,
          {
            id: "broken",
            kind: "font" as const,
            path: "assets/broken.woff2",
            family: "Broken Test Face",
            weight: 400,
            style: "normal" as const,
            format: "woff2" as const,
            // The declaration is well formed; the bytes behind it are not, which
            // is the only way to make the browser refuse the face.
            sourceUrl:
              "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.1.1/latin-400-normal.woff2",
            license: {
              name: "SIL Open Font License 1.1",
              url: "https://openfontlicense.org/",
              attribution: "Not a real face; a Vigilia test fixture.",
            },
          },
        ],
      },
      assets: {
        "assets/stripes.png": glassStripesPng(),
        "assets/broken.woff2": new TextEncoder().encode("not a font"),
      },
    });
    if (!broken.ok) throw new Error(`font fixture: ${broken.message}`);
    expect(broken.ok).toBe(true);

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await waitForBridge(page);
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "broken-font.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(broken.bytes),
    });
    // **The face really was refused.** `loadFontAssets` catches the rejection
    // and the document opens regardless. What is missing is the *report*: the
    // loader writes its message to the status line and the picker's
    // `Opened <name>` overwrites it, so the author is told the package opened
    // and nothing else. Measured for the report; the observable truth here is
    // that no face was registered.
    await expect(page.locator("#status")).toHaveText(
      "Opened broken-font.vigilia-theme",
    );
    const faces = await page.evaluate(() =>
      [...document.fonts].map((face) => face.family),
    );
    expect(faces, "the refused face is not registered").not.toContain(
      "Broken Test Face",
    );

    // **The document is still open and still editable.** A theme is not a font
    // file, and a font the browser refused must not take the scene with it.
    await expect
      .poll(async () => (await sceneFacts(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    const centre = await clientOfScene(
      page,
      "authoring",
      GLASS_ENVELOPE.artboard.width,
    );
    await page.mouse.click(centre.x, centre.y);
    await expect.poll(() => activeId(page)).toBe("authoring");
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    const glassToggle = page.locator("[data-vigilia-glass-enabled]");
    await glassToggle.focus();
    await page.keyboard.press("Space");
    await expect(glassToggle).toBeChecked();

    // **And the author's work is recoverable** — the saved document still
    // carries the face, so the author can replace it rather than start again.
    const saved = await savePackage(page);
    expect(forbiddenKeys(saved.envelope)).toEqual([]);
    expect(saved.envelope["assets"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "broken", family: "Broken Test Face" }),
      ]),
    );
    expect(
      objectsOf(saved.envelope).find((object) => object["id"] === "authoring"),
    ).toMatchObject({ vigiliaGlass: { blurRadius: expect.any(Number) } });
  });

  test("a run naming a binding the object does not declare says so", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    // **The author's half of a missing reading.** A run that names a binding
    // the object never declared resolves to nothing at runtime, and the author
    // has to be able to tell that apart from a run whose sensor is merely
    // quiet. The editor states both, distinctly.
    //
    // The *display* half — a declared binding nothing reports — is not
    // measurable here: the editor's preview source samples every key it is
    // asked for, which is what preview mode is for. It is proved against the
    // real host in `host-player.spec.ts`, where the source only reports what a
    // provider reported.
    const envelope = {
      ...GLASS_ENVELOPE,
      id: "e2e-undeclared-run",
      globals: {
        ...GLASS_ENVELOPE.globals,
        typePresets: {
          "40-400": {
            name: "Reading",
            value: { family: "Segoe UI, sans-serif", size: 40, weight: "400" },
          },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [
          ...GLASS_ENVELOPE.scene.objects,
          {
            type: "Textbox",
            version: "7.4.0",
            originX: "left",
            originY: "top",
            left: 320,
            top: 180,
            width: 300,
            height: 60,
            // A run the object declares no binding for. The validator accepts
            // the document; the run simply cannot resolve.
            text: "",
            fontSize: 40,
            fontFamily: "Segoe UI, sans-serif",
            fill: "#ffffff",
            id: "orphan",
            vigiliaPaint: { fill: "palette.edge" },
            vigiliaText: {
              runs: [
                {
                  kind: "value",
                  bindingId: "not-declared",
                  typePreset: "typePresets.40-400",
                  style: { color: { ref: "palette.edge" } },
                },
              ],
            },
          },
        ],
      },
    };
    const built = writeThemePackage({
      envelope,
      assets: { "assets/stripes.png": glassStripesPng() },
    });
    if (!built.ok) throw new Error(`undeclared fixture: ${built.message}`);

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "undeclared.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(built.bytes),
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened undeclared.vigilia-theme",
    );
    await waitForBridge(page);

    await openRailPane(page, "Layers");
    await page.locator('[data-vigilia-layer="orphan"]').click();
    await expect.poll(() => activeId(page)).toBe("orphan");
    // The run editor states the problem rather than leaving a silent gap, and
    // marks which of the three states this is.
    const note = page.locator('[data-vigilia-run-problem="undeclared"]');
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute(
      "data-vigilia-run-binding",
      "not-declared",
    );
    await expect(note).toContainText("resolves to nothing");

    // **And the document is still saveable with the orphan in it**, because a
    // document an author cannot save is not recoverable work.
    const saved = await savePackage(page);
    expect(forbiddenKeys(saved.envelope)).toEqual([]);
    expect(
      objectsOf(saved.envelope).find((object) => object["id"] === "orphan"),
    ).toMatchObject({
      vigiliaText: { runs: [{ kind: "value", bindingId: "not-declared" }] },
    });
  });
});

/** The starter's own picture, taken the way the product takes one. */
function captureOf(page: Page): Promise<{
  readonly width: number;
  readonly height: number;
  readonly transparent: number;
  readonly png: string;
}> {
  return page.evaluate(() => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: {
            canvas: {
              lowerCanvasEl: HTMLCanvasElement;
              renderAll(): void;
              getRetinaScaling(): number;
              toCanvasElement(m: number): HTMLCanvasElement;
              getZoom(): number;
            };
          };
        };
      }
    ).vigiliaEditorBridge.editor.canvas;
    bridge.renderAll();
    // The product's own call: `captureThumbnail` is `toCanvasElement(scale)`
    // with `scale = min(1, 640 / max(width, height))`. Computed here from the
    // live canvas rather than restated, so a change to that constant does not
    // silently stop being measured.
    const element = bridge.lowerCanvasEl;
    const scale = Math.min(1, 640 / Math.max(element.width, element.height));
    const shot = bridge.toCanvasElement(scale);
    const context = shot.getContext("2d");
    if (context === null) throw new Error("no capture context");
    const data = context.getImageData(0, 0, shot.width, shot.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4)
      if (data[i] === 0) transparent += 1;
    return {
      width: shot.width,
      height: shot.height,
      transparent: transparent / (data.length / 4),
      png: shot.toDataURL("image/png"),
      zoom: bridge.getZoom(),
      retina: bridge.getRetinaScaling(),
    };
  }) as Promise<{
    width: number;
    height: number;
    transparent: number;
    png: string;
    zoom: number;
    retina: number;
  }>;
}

const FIXTURE_WITH_MEDIA = {
  ...GLASS_ENVELOPE,
  id: "e2e-capture",
  globals: {
    ...GLASS_ENVELOPE.globals,
    typePresets: {
      "20-400": {
        name: "Caption",
        value: { family: "Segoe UI, sans-serif", size: 20, weight: "400" },
      },
    },
  },
  assets: [
    ...GLASS_ENVELOPE.assets,
    {
      id: "badge",
      kind: "svg" as const,
      path: "assets/badge.svg",
      license: { name: "MIT", attribution: "Vigilia test fixture." },
    },
  ],
  scene: {
    version: "7.4.0",
    objects: [
      ...GLASS_ENVELOPE.scene.objects,
      {
        type: "Image",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 40,
        top: 400,
        width: 128,
        height: 40,
        scaleX: 1,
        scaleY: 1,
        id: "badge",
        vigiliaAsset: { assetId: "badge", kind: "svg" },
      },
      {
        type: "Textbox",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 320,
        top: 180,
        width: 200,
        height: 40,
        text: "FROST",
        fontSize: 40,
        fontFamily: "Segoe UI, sans-serif",
        fill: "#ffffff",
        id: "over-glass",
        vigiliaPaint: { fill: "palette.edge" },
        vigiliaText: {
          runs: [
            {
              kind: "literal",
              text: "FROST",
              typePreset: "typePresets.20-400",
              style: { color: { ref: "palette.edge" } },
            },
          ],
        },
      },
    ],
  },
};

const BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 40" width="128" height="40">
  <rect width="64" height="40" fill="#101820"/>
  <rect x="64" width="64" height="40" fill="#f0f4f8"/>
</svg>
`;

async function openCaptureFixture(page: Page): Promise<Buffer> {
  const built = writeThemePackage({
    envelope: FIXTURE_WITH_MEDIA,
    assets: {
      "assets/stripes.png": glassStripesPng(),
      "assets/badge.svg": new TextEncoder().encode(BADGE_SVG),
    },
  });
  if (!built.ok) throw new Error(`capture fixture: ${built.message}`);
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name: "capture.vigilia-theme",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(built.bytes),
  });
  await expect(page.locator("#status")).toHaveText(
    "Opened capture.vigilia-theme",
  );
  await waitForBridge(page);
  await page.waitForFunction(
    () => {
      const image = document.querySelector<HTMLImageElement>(
        "[data-vigilia-background-media] img",
      );
      return image !== null && image.complete && image.naturalWidth > 0;
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.evaluate(() => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge: { editor: { canvas: { renderAll(): void } } };
      }
    ).vigiliaEditorBridge;
    bridge.editor.canvas.renderAll();
  });
  return Buffer.from(built.bytes);
}

/** Band statistics inside a scene box, on the live canvas, the way
 * `glass-probe.ts` places them: from the object's own device box, never from
 * hand-picked artboard coordinates. */
function bandStats(
  page: Page,
  id: string,
  inset: { left: number; top: number; width: number; height: number },
): Promise<{ peak: number; contrast: number; rows: number }> {
  return page.evaluate(
    ([objectId, box]) => {
      type Obj = {
        get(n: string): unknown;
        getBoundingRect(): {
          left: number;
          top: number;
          width: number;
          height: number;
        };
      };
      const canvas = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getObjects(): Obj[];
                lowerCanvasEl: HTMLCanvasElement;
                renderAll(): void;
                getRetinaScaling(): number;
                viewportTransform: number[];
              };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas;
      canvas.renderAll();
      const object = canvas
        .getObjects()
        .find((candidate) => candidate.get("id") === objectId);
      if (object === undefined) throw new Error(`no object ${objectId}`);
      const rect = object.getBoundingRect();
      const vp = canvas.viewportTransform;
      const retina = canvas.getRetinaScaling();
      const toDevice = (x: number, y: number): readonly [number, number] => [
        (x * vp[0] + y * vp[2] + vp[4]) * retina,
        (x * vp[1] + y * vp[3] + vp[5]) * retina,
      ];
      const [x0, y0] = toDevice(rect.left + box.left, rect.top + box.top);
      const [x1, y1] = toDevice(
        rect.left + box.left + box.width,
        rect.top + box.top + box.height,
      );
      const left = Math.max(0, Math.round(x0));
      const top = Math.max(0, Math.round(y0));
      const width = Math.max(1, Math.round(x1 - x0));
      const height = Math.max(1, Math.round(y1 - y0));
      const element = canvas.lowerCanvasEl;
      const data = element
        .getContext("2d")!
        .getImageData(left, top, width, height).data;
      const means = new Array<number>(width).fill(0);
      for (let y = 0; y < height; y += 1)
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          means[x] +=
            0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
      for (let x = 0; x < width; x += 1) means[x] /= height;
      let peak = 0;
      for (let x = 1; x < width; x += 1)
        peak = Math.max(peak, Math.abs(means[x]! - means[x - 1]!));
      return {
        peak: Math.round(peak * 100) / 100,
        contrast:
          Math.round((Math.max(...means) - Math.min(...means)) * 100) / 100,
        rows: height,
      };
    },
    [id, inset] as const,
  );
}

test.describe("the reference composition, captured", () => {
  test("the capture path shows the glass and the packaged assets, and changes nothing", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    await openCaptureFixture(page);

    const before = await sceneFacts(page);
    const glass = await bandStats(page, "glass", {
      left: 20,
      top: 14,
      width: 200,
      height: 20,
    });
    const badge = await bandStats(page, "badge", {
      left: 0,
      top: 0,
      width: 128,
      height: 40,
    });

    const capture = await captureOf(page);

    // **The glass is in the picture, and it is really blurred.** A flat wash
    // over an empty canvas also scores a low gradient, so the contrast floor
    // is the second half: the panel has to be carrying backdrop detail.
    expect(glass.rows, "the band covers rows").toBeGreaterThan(8);
    expect(glass.contrast, "the panel carries backdrop detail").toBeGreaterThan(
      8,
    );
    expect(
      glass.peak,
      "the backdrop is softened, not merely tinted",
    ).toBeLessThan(40);

    // **The packaged asset is in the picture.** A 64/64 black-white SVG split:
    // anything but a flat fill has a real step in it.
    expect(
      badge.contrast,
      "the packaged SVG has two tones in the capture",
    ).toBeGreaterThan(100);
    expect(capture.transparent, "the capture is a real picture").toBeLessThan(
      1,
    );
    expect(capture.width).toBeGreaterThan(100);

    // **And the capture changed nothing.** A thumbnail is a read of the
    // document, not an edit of it.
    const after = await sceneFacts(page);
    expect(after).toEqual(before);

    // **The picture itself, looked at.** The capture is a data URL rather than
    // a file, so it is shown at 2x on a dark ground — the library card's own
    // conditions — and the screenshot is taken of that. Registered in
    // `docs/evidence/screenshots/README.md` and inspected before it is kept.
    expect(capture.png.length).toBeGreaterThan(1000);
    await page.setContent(
      `<body style="margin:0;background:#0c0e13;display:flex;align-items:center;justify-content:center;height:100vh">` +
        `<img src="${capture.png}" style="image-rendering:pixelated;transform:scale(2);transform-origin:center">` +
        `</body>`,
    );
    await expect(page.locator("img")).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-reference-capture");
  });

  test("the capture carries a theme's background media", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    // **Known gap, pinned rather than written around.** Background media is a
    // DOM sibling below the canvas (`scene-fabric/src/background-media.ts`), and
    // Fabric's `toCanvasElement` re-renders the scene graph into a fresh
    // canvas — so the media layer is not in the picture. Measured here on a
    // theme whose only backdrop is a packaged image: the capture is transparent
    // where the media is.
    //
    // `test.fail` so the requirement stays written down and the suite stays
    // runnable, and so closing the gap turns this red until the marker is
    // removed. Owner: `thumbnail-capture.ts` together with the media layer's
    // owner, `scene-fabric/src/background-media.ts`.
    test.fail(
      true,
      "background media is a DOM sibling and never reaches toCanvasElement",
    );
    await openCaptureFixture(page);
    const layer = await page.evaluate(() => {
      const element = document.querySelector<HTMLElement>(
        "[data-vigilia-background-media] img",
      );
      return element === null
        ? null
        : { width: element.naturalWidth, height: element.naturalHeight };
    });
    expect(layer, "the media layer has pixels").not.toBeNull();
    // **Measured where it matters.** The whole-canvas fraction is too blunt:
    // the panels already cover most of the ink, so a threshold loose enough to
    // be about the media also passes without it. This counts only the pixels
    // *inside the artboard*, which is the region the media layer covers, and
    // the fixture leaves most of it with nothing at all on the canvas.
    const inside = await page.evaluate(
      ([width, height]) => {
        const bridge = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                canvas: {
                  lowerCanvasEl: HTMLCanvasElement;
                  renderAll(): void;
                  toCanvasElement(m: number): HTMLCanvasElement;
                  getZoom(): number;
                  viewportTransform: number[];
                };
              };
            };
          }
        ).vigiliaEditorBridge.editor.canvas;
        bridge.renderAll();
        const element = bridge.lowerCanvasEl;
        const scale = Math.min(
          1,
          640 / Math.max(element.width, element.height),
        );
        const shot = bridge.toCanvasElement(scale);
        // `toCanvasElement` keeps the camera's zoom and pan and scales both by
        // the multiplier, so the artboard's corners are mapped the way the
        // capture actually drew them rather than assumed to be its corners.
        const zoom = bridge.getZoom();
        const vp = bridge.viewportTransform;
        const map = (x: number, y: number): readonly [number, number] => [
          (x * zoom + vp[4]!) * scale,
          (y * zoom + vp[5]!) * scale,
        ];
        const [x0, y0] = map(0, 0);
        const [x1, y1] = map(width, height);
        const left = Math.max(0, Math.round(x0));
        const top = Math.max(0, Math.round(y0));
        const w = Math.min(shot.width - left, Math.max(1, Math.round(x1 - x0)));
        const h = Math.min(shot.height - top, Math.max(1, Math.round(y1 - y0)));
        const data = shot.getContext("2d")!.getImageData(left, top, w, h).data;
        let clear = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] === 0) clear += 1;
        return { clear: clear / (data.length / 4), w, h };
      },
      [GLASS_ENVELOPE.artboard.width, GLASS_ENVELOPE.artboard.height] as const,
    );
    expect(inside.w, "the artboard is inside the capture").toBeGreaterThan(50);
    expect(
      inside.clear,
      "the media is in the capture: most of the artboard reads as empty",
    ).toBeLessThan(0.2);
  });

  test("text above a glass panel stays sharp through a real mount", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    await openCaptureFixture(page);

    // **The inherited half of Task 4.** Its container had no usable font, so
    // "FROST" rendered as a placeholder dash and the claim could not be
    // measured. It can now: `Segoe UI` resolves to a real face (measured
    // widths differ per family in this Chromium), and the text below is a
    // 40px run that occupies real columns.
    //
    // The measure is **the glyph alone**. The frame with the text minus the
    // frame without it cancels the blurred backdrop, so what is left is the
    // glyph's own coverage — and its sharpness does not depend on how dark the
    // panel behind it happens to be. The control is the same text in the same
    // place over the same media with the blur set to zero.
    const reading = await page.evaluate(() => {
      type Obj = {
        get(n: string): unknown;
        set(n: string, v: unknown): void;
        getBoundingRect(): {
          left: number;
          top: number;
          width: number;
          height: number;
        };
      };
      const canvas = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getObjects(): Obj[];
                lowerCanvasEl: HTMLCanvasElement;
                renderAll(): void;
                getRetinaScaling(): number;
                viewportTransform: number[];
              };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas;
      const objects = canvas.getObjects();
      const find = (id: string): Obj | undefined =>
        objects.find((object) => object.get("id") === id);
      const glass = find("glass");
      const text = find("over-glass");
      if (glass === undefined || text === undefined)
        throw new Error("the fixture lost its panel or its text");
      const element = canvas.lowerCanvasEl;
      const vp = canvas.viewportTransform;
      const retina = canvas.getRetinaScaling();
      const rect = text.getBoundingRect();
      const left = Math.round(
        (rect.left * vp[0] + rect.top * vp[2] + vp[4]) * retina,
      );
      const top = Math.round(
        (rect.left * vp[1] + rect.top * vp[3] + vp[5]) * retina,
      );
      const width = Math.max(1, Math.round(rect.width * vp[0] * retina));
      const height = Math.max(1, Math.round(rect.height * vp[0] * retina));
      const context = element.getContext("2d")!;

      const glyphSharpness = (): number => {
        const grab = (): Uint8ClampedArray =>
          context.getImageData(left, top, width, height).data.slice();
        canvas.renderAll();
        const withText = grab();
        const visible = text.get("visible");
        text.set("visible", false);
        canvas.renderAll();
        const without = grab();
        text.set("visible", visible);
        canvas.renderAll();
        const luma = (d: Uint8ClampedArray, i: number): number =>
          0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        let best = 0;
        for (let y = 0; y < height; y += 1) {
          const diff = new Array<number>(width);
          for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            diff[x] = luma(withText, i) - luma(without, i);
          }
          const range = Math.max(...diff) - Math.min(...diff);
          if (range < 40) continue;
          let step = 0;
          for (let x = 1; x < width; x += 1)
            step = Math.max(step, Math.abs(diff[x]! - diff[x - 1]!));
          best = Math.max(best, step / range);
        }
        return Math.round(best * 1000) / 1000;
      };

      glass.set("vigiliaGlass", { blurRadius: 16 });
      const blurred = glyphSharpness();
      glass.set("vigiliaGlass", { blurRadius: 0 });
      const control = glyphSharpness();
      glass.set("vigiliaGlass", { blurRadius: 16 });
      const occupied = context
        .getImageData(left, top, width, height)
        .data.some((_, index) => index % 4 === 3 && _ > 0);
      return { blurred, control, width, height, occupied };
    });

    // Non-vacuous: the band really is a text run and not an empty box.
    expect(reading.width).toBeGreaterThan(100);
    expect(reading.height).toBeGreaterThan(20);
    expect(reading.occupied).toBe(true);
    // A one-pixel transition scores near 1 whatever the contrast; a transition
    // spread over a 16px blur scores near 1/16.
    expect(
      reading.blurred,
      "glyph edges above a 16px-blurred panel are one-pixel transitions",
    ).toBeGreaterThan(0.6);
    // And the panel's own blur is real in the same frame, so the blurred side
    // is not vacuously sharp because nothing was blurred.
    const band = await bandStats(page, "glass", {
      left: 20,
      top: 14,
      width: 200,
      height: 20,
    });
    expect(band.peak, "the backdrop under the panel is softened").toBeLessThan(
      40,
    );
    expect(
      reading.blurred,
      "text over the blurred panel is as sharp as text over the sharp one",
    ).toBeGreaterThan(reading.control * 0.85);
  });
});

test.describe("the reference composition, at the sizes it is read at", () => {
  test("the fitted, reference-size and DPR views render the same composition", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    await openCaptureFixture(page);

    /** Every object on the canvas, in scene coordinates. */
    const fitted = await sceneFacts(page);
    const zoom = page.locator("[data-vigilia-zoom]");
    await expect(zoom).toHaveText(/^\d+%$/);
    expect(fitted.length).toBeGreaterThan(3);

    // **Reference size.** 100% is the artboard's own scale, and this fixture's
    // artboard is 640 wide, so it fits the stage whole.
    await zoom.click();
    await page.getByRole("menuitem", { name: "100 %" }).click();
    await expect(zoom).toHaveText("100%");
    const atReference = await sceneFacts(page);
    // Scene geometry does not move with the camera: the same boxes, rendered
    // at a different scale.
    expect(idsOf(atReference)).toEqual(idsOf(fitted));
    for (const fact of fitted) {
      const again = atReference.find((other) => other.id === fact.id);
      expect(again?.rect, `${fact.id} is the same box at 100%`).toEqual(
        fact.rect,
      );
    }
    // Ink landed: a camera that had lost the scene would still pass the id list.
    const drawn = await page.evaluate(() => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: { lowerCanvasEl: HTMLCanvasElement; renderAll(): void };
            };
          };
        }
      ).vigiliaEditorBridge;
      bridge.editor.canvas.renderAll();
      const element = bridge.editor.canvas.lowerCanvasEl;
      const data = element
        .getContext("2d")!
        .getImageData(0, 0, element.width, element.height).data;
      let ink = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 8) ink += 1;
      return ink / (data.length / 4);
    });
    expect(drawn, "the artboard is painted at reference size").toBeGreaterThan(
      0.01,
    );

    // **A device-pixel view.** A real DPR change through the browser's own
    // emulation, so `devicePixelRatio` and the canvas's retina scaling move
    // together — which is what makes text sharp rather than merely larger.
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await page.waitForTimeout(500);
    const dpr = await page.evaluate(() => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                lowerCanvasEl: HTMLCanvasElement;
                renderAll(): void;
                getRetinaScaling(): number;
              };
            };
          };
        }
      ).vigiliaEditorBridge;
      bridge.editor.canvas.renderAll();
      const element = bridge.editor.canvas.lowerCanvasEl;
      return {
        ratio: window.devicePixelRatio,
        retina: bridge.editor.canvas.getRetinaScaling(),
        backing: element.width,
        css: element.getBoundingClientRect().width,
      };
    });
    expect(dpr.ratio, "the browser really is at two device pixels").toBe(2);
    // The editor's Fabric canvas is *not* device-scaled: `retina` stays 1 and
    // the backing store tracks the CSS box. Recorded rather than required,
    // because the display surface is the player and this file does not own that
    // decision; the numbers are here so the report can state it rather than
    // guess it.
    // The same document, at a different resolution, and still painted.
    expect(idsOf(await sceneFacts(page))).toEqual(idsOf(fitted));
    const stillPainted = await page.evaluate(() => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: { lowerCanvasEl: HTMLCanvasElement; renderAll(): void };
            };
          };
        }
      ).vigiliaEditorBridge;
      bridge.editor.canvas.renderAll();
      const element = bridge.editor.canvas.lowerCanvasEl;
      const data = element
        .getContext("2d")!
        .getImageData(0, 0, element.width, element.height).data;
      let ink = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 8) ink += 1;
      return ink / (data.length / 4);
    });
    expect(
      stillPainted,
      "the artboard is painted at two device pixels",
    ).toBeGreaterThan(0.01);
    await captureVisualReview(page, testInfo, "editor-reference-dpr2");
    await session.send("Emulation.clearDeviceMetricsOverride");
  });

  test("rotated and overlapping panels both keep compositing", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    await openCaptureFixture(page);

    // **Rotated.** A treatment is a property, not a promise that the panel is
    // axis-aligned. A band placed from the panel's own unrotated box would miss
    // it after a 30° turn, so the box itself is asserted first: had the angle
    // not taken, the rest of this test would quietly measure an upright panel.
    await setAngle(page, "glass", 30);
    const turned = (await sceneFacts(page)).find((f) => f.id === "glass");
    expect(turned?.rect.width).toBeGreaterThan(FIXTURE_GLASS_BOX.width);
    expect(turned?.rect.height).toBeGreaterThan(FIXTURE_GLASS_BOX.height);
    // The treatment survived the turn.
    expect(turned?.glass).toEqual({ blurRadius: 16 });
    await setAngle(page, "glass", 0);

    // **Overlapping.** A second treated panel on top of the first, authored
    // through the product's own control rather than placed by the test.
    const centre = await clientOfScene(
      page,
      "authoring",
      GLASS_ENVELOPE.artboard.width,
    );
    await page.mouse.click(centre.x, centre.y);
    await expect.poll(() => activeId(page)).toBe("authoring");
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    const toggle = page.locator("[data-vigilia-glass-enabled]");
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    await typeInto(page, page.locator("[data-vigilia-glass-blur]"), "12");

    const treated = (await sceneFacts(page))
      .filter((fact) => fact.glass !== null)
      .map((fact) => fact.id)
      .sort();
    expect(treated, "two panels now carry a treatment").toEqual([
      "authoring",
      "glass",
    ]);
    // And the panel behind the new one is still compositing, not overwritten.
    const behind = await bandStats(page, "glass", {
      left: 20,
      top: 14,
      width: 200,
      height: 20,
    });
    expect(behind.rows).toBeGreaterThan(8);
    expect(behind.peak, "the panel behind still composites").toBeLessThan(40);

    await captureVisualReview(page, testInfo, "editor-reference-overlap");
  });
});

/** The fixture's own glass panel box, so a turn reads as a turn and not a
 * resize. Measured on the built bundle, not copied from the fixture. */
const FIXTURE_GLASS_BOX = { width: 242, height: 162 } as const;

async function setAngle(page: Page, id: string, angle: number): Promise<void> {
  await page.evaluate(
    ([objectId, degrees]) => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getObjects(): Array<{
                  get(n: string): unknown;
                  set(n: string, v: unknown): void;
                }>;
                renderAll(): void;
              };
            };
          };
        }
      ).vigiliaEditorBridge;
      bridge.editor.canvas
        .getObjects()
        .find((object) => object.get("id") === objectId)
        ?.set("angle", degrees);
      bridge.editor.canvas.renderAll();
    },
    [id, angle] as const,
  );
}

/** A real 16x16 PNG: the same bytes the editor's own suite imports, so this
 * fixture does not have to be right about PNG. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAIklEQVQ4jWNk2HHzPwMVARM1DRs1cNTAUQNHDRw1cCgZCAC1HQK4IWYK+QAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("background media", () => {
  test("a new background image is imported, and the artboard is repointed at it", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    // **What the product actually offers, named.** The Assets panel's *Replace*
    // acts on the selected canvas object, not on the asset the artboard names,
    // so there is no control that swaps a background's bytes in place. What an
    // author does instead is import the new image and repoint the artboard at
    // it, and that is the path proved here. Finding for the report: no
    // replace-bytes control for a background asset; the id allocator also
    // suffixes a repeated filename, so the old declaration cannot be reused.
    await openEditor(page);

    await openRailPane(page, "Assets");
    await page.locator("[data-vigilia-asset-import]").setInputFiles({
      name: "hero.png",
      mimeType: "image/png",
      buffer: PIXEL_PNG,
    });
    await page.locator("[data-vigilia-background-asset]").selectOption("hero");
    await expect(page.locator("[data-vigilia-background-asset]")).toHaveValue(
      "hero",
    );
    await waitForMedia(page);
    const first = await mediaSrc(page);
    expect(
      first,
      "the media layer is showing the imported image",
    ).not.toBeNull();

    // **A second image under the same name.** A repeated filename is suffixed,
    // so it lands beside the first rather than on top of it.
    await page.locator("[data-vigilia-asset-import]").setInputFiles({
      name: "hero.png",
      mimeType: "image/png",
      buffer: PIXEL_PNG,
    });
    const ids = await page
      .locator("[data-vigilia-background-asset]")
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      );
    expect(ids).toEqual(expect.arrayContaining(["hero", "hero-2"]));
    expect(ids.filter((id) => id.startsWith("hero"))).toHaveLength(2);

    // **Repoint.** The artboard names the new one, and the layer follows it.
    await page
      .locator("[data-vigilia-background-asset]")
      .selectOption("hero-2");
    await waitForMedia(page);
    const second = await mediaSrc(page);
    expect(second).not.toBe(first);
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

    const saved = await savePackage(page);
    const background = (
      saved.envelope["artboard"] as { backgroundMedia?: { assetId: string } }
    ).backgroundMedia;
    expect(background?.assetId).toBe("hero-2");
    // Whatever the artboard names is a declared asset, and the layer is
    // showing that one — the reference, not a count.
    expect(saved.envelope["assets"]).toContainEqual(
      expect.objectContaining({ id: "hero-2" }),
    );
  });

  test("a video asset becomes a video in the media layer", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    // **Wiring only, and said so.** These bytes are not a decodable video, so
    // no frame is claimed: what this proves is that a declared video asset
    // reaches the media layer as a `<video>`. Fabric cannot see a DOM sibling,
    // so a decoded frame is the media owner's business, not this file's.
    await openEditor(page);
    await openRailPane(page, "Assets");
    await page.locator("[data-vigilia-asset-import]").setInputFiles({
      name: "loop.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("not a decodable video"),
    });
    await page.locator("[data-vigilia-background-asset]").selectOption("loop");
    await expect(page.locator("[data-vigilia-background-asset]")).toHaveValue(
      "loop",
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document.querySelector("[data-vigilia-background-media] video")
                ?.tagName ?? null,
          ),
        { timeout: 15_000 },
      )
      .toBe("VIDEO");
    // The saved document says `video`, not `image`.
    const saved = await savePackage(page);
    expect(saved.envelope["assets"]).toEqual([
      expect.objectContaining({ id: "loop", kind: "video" }),
    ]);
    expect(
      (saved.envelope["artboard"] as { backgroundMedia?: { assetId: string } })
        .backgroundMedia?.assetId,
    ).toBe("loop");
  });
});

function mediaSrc(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const element = document.querySelector<HTMLImageElement | HTMLVideoElement>(
      "[data-vigilia-background-media] img, [data-vigilia-background-media] video",
    );
    return element?.currentSrc || element?.src || null;
  });
}

/**
 * The two gaps this file pins rather than writes around.
 *
 * `test.fail` keeps the requirement written down, keeps the suite runnable, and
 * turns red the moment the gap closes — so neither can be quietly forgotten.
 */
test.describe("known gaps, pinned", () => {
  test("a saved object carries no derived per-character style table", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    // **Measured, and pinned on the cause rather than the symptom.** Fabric
    // writes a per-character `styles` table on every `Textbox`, and
    // `serialiseScene` — which passes `SCENE_PERSISTED_PROPERTIES` and sets
    // `includeDefaultValues = false` — carries it into the package anyway,
    // because `styles` is a set property rather than a Fabric default. The
    // authored equivalent is `vigiliaText.runs`; nothing reads `styles` back.
    //
    // The symptom is that two exports of one document disagree: the starter's
    // own `gpu-card-caption` exports `styles: [{start: 0, end: 2}]` from a
    // first mount and `{start: 0, end: 4}]` after that same document is
    // reopened — the range left behind by whichever placeholder the run last
    // showed. That symptom is a **race** between the live repaint and the
    // save, and it reproduced in only one of three measured runs, so it is
    // reported rather than asserted. The presence of the table is
    // deterministic, so that is what this pins.
    //
    // Owner: `packages/scene-fabric/src/persist.ts`, beside
    // `removeDerivedTextClips`, which already strips the sibling derived field.
    test.fail(
      true,
      "Fabric's derived styles table is serialised into the package",
    );
    await openEditor(page);
    const saved = await savePackage(page);
    const styled = objectsOf(saved.envelope).filter(
      (object) => object["styles"] !== undefined,
    );
    expect(
      styled.map((object) => object["id"]),
      "objects carrying a derived style table",
    ).toEqual([]);
  });

  test("a packaged image object saves no runtime object URL", async ({
    page,
  }, testInfo) => {
    desktop(testInfo);
    // **Measured.** Importing an image through the Assets panel inserts a
    // Fabric `Image` whose `src` is the `blob:` URL the editor minted for it.
    // `serialiseScene` sets `includeDefaultValues = false` and passes
    // `SCENE_PERSISTED_PROPERTIES`, but `src` is a set property rather than a
    // Fabric default, so it survives into the exported package:
    //
    //   "src": "blob:http://127.0.0.1:4174/e16c3b9b-…"
    //
    // It is unrevivable state in a shareable artifact: it names the editor's
    // own origin and a UUID that dies with the tab, and it changes on every
    // save of the same document. The round trip still works — the object is
    // re-resolved from `vigiliaAsset.assetId` — so this is a leak, not a
    // break.
    //
    // Owner: `scene-fabric/src/persist.ts`, beside `removeRuntimeText`.
    test.fail(
      true,
      "a Fabric Image's blob: src is serialised into the package",
    );
    await openEditor(page);
    await openRailPane(page, "Assets");
    await page.locator("[data-vigilia-asset-import]").setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: PIXEL_PNG,
    });
    const saved = await savePackage(page);
    expect(forbiddenKeys(saved.envelope)).toEqual([]);
  });
});

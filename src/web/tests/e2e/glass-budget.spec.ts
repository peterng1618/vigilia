import { expect, type Page, test } from "@playwright/test";
import { writeThemePackage } from "@vigilia/theme-package";
import { GLASS_ENVELOPE, glassStripesPng } from "./glass-fixture.js";

const EDITOR = "http://127.0.0.1:4174/";

/** The artboard Task 1 set its budget on: 1672x941, same DPR, same browser
 *  family. The yardstick is a **delta** - the composite's own cost - and these
 *  are the same conditions Task 1 measured that delta under, so the two are
 *  comparable even though their absolute frame times are not.
 *
 *  What the absolute times are not is comparable: a scene with much else in it
 *  has a large baseline, and subtracting a large baseline is noisier, not
 *  different in kind. A small baseline makes the delta *cleaner*.
 */
const BUDGET_ARTBOARD = { width: 1672, height: 941 };

/** The scene Task 1's figure is quoted against, and its no-media twin. */
function fixture(withMedia: boolean) {
  const artboard = { ...GLASS_ENVELOPE.artboard, ...BUDGET_ARTBOARD };
  // The key is absent, not `undefined`: `backgroundMedia: undefined` is not the
  // same document, and the validator says so.
  if (!withMedia)
    delete (artboard as unknown as Record<string, unknown>)["backgroundMedia"];
  const written = writeThemePackage({
    envelope: { ...GLASS_ENVELOPE, artboard },
    assets: { "assets/stripes.png": glassStripesPng() },
  });
  if (!written.ok) throw new Error(written.message);
  return written.bytes;
}

async function open(page: Page, withMedia: boolean): Promise<void> {
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name: "glass.vigilia-theme",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(fixture(withMedia)),
  });
  await expect(page.locator("#status")).toHaveText(
    "Opened glass.vigilia-theme",
  );
  if (!withMedia) return;
  // With no media there is nothing to wait for, and waiting would hang.
  await page.waitForFunction(
    () => {
      const image = document.querySelector<HTMLImageElement>(
        "[data-vigilia-background-media] img",
      );
      return image !== null && image.complete && image.naturalWidth > 0;
    },
    null,
    { timeout: 20_000 },
  );
}

/**
 * The composite's marginal cost per frame, in the real editor: the same scene
 * with and without the panel, median of nine runs of fifty synchronous
 * renders.
 */
async function curve(
  page: Page,
): Promise<Array<{ radius: number; cost: number }>> {
  return page.evaluate(() => {
    const scope = window as unknown as Record<string, unknown>;
    const key = Object.keys(scope).find((candidate) =>
      candidate.startsWith("vigilia-fabric-editor"),
    );
    const editor = (
      scope[key ?? ""] as
        | {
            canvas: {
              getObjects(): Array<Record<string, unknown>>;
              renderAll(): void;
              add(object: unknown): void;
              remove(...objects: unknown[]): void;
              set(key: string, value: unknown): void;
            };
          }
        | undefined
    )?.canvas;
    if (editor === undefined) throw new Error("no editor canvas is mounted");
    const panel = editor
      .getObjects()
      .find((object) => object["vigiliaGlass"] !== undefined);
    if (panel === undefined) throw new Error("the fixture has no glass panel");

    const time = (samples: number, frames: number): number => {
      editor.renderAll();
      const runs: number[] = [];
      for (let s = 0; s < samples; s += 1) {
        const started = performance.now();
        for (let i = 0; i < frames; i += 1) editor.renderAll();
        runs.push((performance.now() - started) / frames);
      }
      runs.sort((a, b) => a - b);
      return runs[Math.floor(runs.length / 2)] ?? 0;
    };

    const measured: Array<{ radius: number; cost: number }> = [];
    for (const radius of [0, 16, 48]) {
      panel.set("vigiliaGlass", { blurRadius: radius });
      editor.renderAll();
      const withGlass = time(9, 50);
      editor.remove(panel);
      const withoutGlass = time(9, 50);
      editor.add(panel);
      measured.push({ radius, cost: withGlass - withoutGlass });
    }
    return measured;
  });
}

test.describe("glass cost on the real editor", () => {
  test("the composite is bounded, with and without background media", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );
    await page.goto(EDITOR);
    await open(page, true);
    const withMedia = await curve(page);

    // The discriminating case for the attribution. With no media layer the
    // composite has no `paint` to do, so the difference between these two
    // curves is the media term and the rest is the composite proper.
    await open(page, false);
    const noMedia = await curve(page);

    console.log(
      `GLASS CURVE withMedia=${JSON.stringify(withMedia)} noMedia=${JSON.stringify(noMedia)}`,
    );
    for (const reading of [withMedia, noMedia]) {
      for (const { radius, cost } of reading) {
        expect(cost, `the ${radius} px composite is bounded`).toBeLessThan(3);
        expect(
          cost,
          `and the ${radius} px reading is not inverted`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

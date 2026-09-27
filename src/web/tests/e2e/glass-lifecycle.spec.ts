import { expect, test } from "@playwright/test";
import { writeThemePackage } from "@vigilia/theme-package";
import { GLASS_ENVELOPE, glassStripesPng } from "./glass-fixture.js";

const EDITOR = "http://127.0.0.1:4174/";

/**
 * The lifecycle property, measured on the real editor and the real fixture.
 *
 * **Not** "zero repaints in 1000 ms". Task 1 measured that on a bare
 * `StaticCanvas`; the editor runs a 30 Hz chart-refresh loop of its own, so an
 * idle editor repaints about 22 times a second whatever glass is doing.
 * Asserting zero here would assert a fact about a loop this task does not
 * own, and it would fail for a reason unrelated to glass. Measured, not
 * assumed: every one of those 22 requests stacks to `LiveRuntime.refresh`
 * and `ChartManager.refresh`.
 *
 * The property that *is* this task's is the **delta**: a glass panel must not
 * add a repaint of its own. That is measured by comparing the same scene with
 * and without the panel, so the editor's own refresh cancels out, and by
 * counting composites at the panel - one per editor frame means the owner is
 * riding frames someone else asked for rather than making or missing any.
 */
test.describe("glass lifecycle in the real editor", () => {
  test("a glass panel adds no repaint of its own", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );
    const fixture = writeThemePackage({
      envelope: GLASS_ENVELOPE,
      assets: { "assets/stripes.png": glassStripesPng() },
    });
    if (!fixture.ok) throw new Error(fixture.message);

    await page.goto(EDITOR);
    await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
      name: "glass.vigilia-theme",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(fixture.bytes),
    });
    await expect(page.locator("#status")).toHaveText(
      "Opened glass.vigilia-theme",
    );
    // The media must have real pixels, or a panel has no backdrop to blur and
    // the comparison below would be measuring an empty scene.
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

    const measurement = await page.evaluate(async () => {
      const scope = window as unknown as Record<string, unknown>;
      const key = Object.keys(scope).find((candidate) =>
        candidate.startsWith("vigilia-fabric-editor"),
      );
      const canvas = (
        scope[key ?? ""] as
          | {
              canvas: {
                getObjects(): Array<Record<string, unknown>>;
                remove(...objects: unknown[]): void;
                renderAll(): void;
              };
            }
          | undefined
      )?.canvas;
      if (canvas === undefined) throw new Error("no editor canvas is mounted");
      const panel = canvas
        .getObjects()
        .find((object) => object["vigiliaGlass"] !== undefined);
      if (panel === undefined)
        throw new Error("the fixture has no glass panel");

      const originalRender = canvas.renderAll.bind(canvas);
      let renders = 0;
      canvas.renderAll = () => {
        renders += 1;
        originalRender();
      };
      // Composites are counted at the panel, so "did the owner do work" is
      // separated from "did something repaint".
      let composites = 0;
      (panel["on"] as (event: string, handler: () => void) => void).call(
        panel,
        "before:render",
        () => {
          composites += 1;
        },
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
      const withPanel = renders;
      const compositesWithPanel = composites;

      // The same scene without the panel: the media layer, the glass owner and
      // the editor's chart refresh are all still mounted, so the difference is
      // the panel and nothing else.
      canvas.remove(panel);
      renders = 0;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const withoutPanel = renders;

      canvas.renderAll = originalRender;
      return { withPanel, withoutPanel, compositesWithPanel };
    });

    // Match set: the editor's own refresh really is running in both windows,
    // so a zero here would mean the scene was static rather than that glass
    // is free.
    expect(
      measurement.withPanel,
      "the editor is repainting at all",
    ).toBeGreaterThan(10);
    expect(
      measurement.withoutPanel,
      "and keeps repainting with the panel removed",
    ).toBeGreaterThan(10);
    // The property. The two windows are the same 1000 ms of the same loop, so
    // they are equal up to the loop's own jitter, and the panel can only ever
    // be at or below the window without it.
    // Two separate 1000 ms samples of a live 30 Hz loop, so they differ by the
    // loop's own jitter; the claim is that the panel adds nothing, which shows
    // up as the two being the same within that jitter rather than the panel's
    // window being systematically higher.
    expect(
      measurement.withPanel,
      "a glass panel adds no repaint of its own",
    ).toBeLessThanOrEqual(measurement.withoutPanel + 3);
    // One composite per editor frame: the owner rides frames someone else
    // asked for, and misses none of them.
    expect(
      measurement.compositesWithPanel,
      "one composite per editor frame",
    ).toBe(measurement.withPanel);
  });
});

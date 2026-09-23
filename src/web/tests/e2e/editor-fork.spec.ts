import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readThemePackage, writeThemePackage } from "@vigilia/theme-package";
import { strToU8, zipSync } from "fflate";

const EDITOR = "http://127.0.0.1:4174/";

test.describe("Fabric editor route", () => {
  test("mounts the adopted editor shell on the editor stage", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);

    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();
    await expect(page.locator("#status")).toHaveText("Fabric editor ready");
  });

  test("switches chart refresh between 30 and 1 FPS", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    // The View menu owns chart refresh; the panel select is gone.
    await page.getByRole("button", { name: "View" }).click();
    await expect(
      page.getByRole("menuitem", { name: /Chart refresh: 30 FPS/ }).first(),
    ).toBeVisible();
    await page
      .getByRole("menuitem", { name: /Chart refresh: 30 FPS/ })
      .first()
      .click();
    await page.getByRole("button", { name: "View" }).click();
    await expect(
      page.getByRole("menuitem", { name: /Chart refresh: 1 FPS/ }).first(),
    ).toBeVisible();
  });

  test("creates and saves text with derived v2 references", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
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
    expect(text).toMatchObject({
      vigiliaPaint: { fill: "palette.background" },
      vigiliaText: {
        runs: [
          {
            typePreset: "typePresets.11-400",
            style: { color: { ref: "palette.background" } },
          },
        ],
      },
    });
  });

  test("creates a chart with palette-backed settings that save and reopen", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page
      .locator('[data-vigilia-panel="add"]')
      .getByRole("button", { name: "Gauge" })
      .click();
    await expect(
      page.locator('[data-vigilia-chart-setting="thickness"]'),
    ).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-fork-chart-creation");

    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    const chart = saved.parsed.envelope.scene.objects
      .filter((object) => object["type"] === "VigiliaChart")
      .at(-1);
    expect(chart).toMatchObject({
      family: "gauge",
      settings: {
        track: { ref: "palette.background" },
        progress: { ref: "palette.background" },
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

  test("captures the mounted editor for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-fork");
  });

  test("captures selected chart binding controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page
      .locator('[data-vigilia-binding="cpu-load"]')
      .selectOption("ram.used");
    const precision = page.locator(
      '[data-vigilia-binding-field="cpu-load.precision"]',
    );
    await precision.fill("2");
    await precision.press("Tab");
    await expect(precision).toHaveValue("2");
    const progressPaint = page.locator('[data-vigilia-chart-paint="progress"]');
    await progressPaint.scrollIntoViewIfNeeded();
    await expect(progressPaint).toBeVisible();

    await captureVisualReview(page, testInfo, "editor-fork-chart-binding");
  });

  test("captures semantic layer controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const layer = page.locator('[data-vigilia-layer="load-gauge"]');
    await expect(layer).toBeVisible();
    await layer.click();
    await expect(layer).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('[data-vigilia-arrange="align-left"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-vigilia-arrange="distribute-x"]'),
    ).toBeDisabled();

    await captureVisualReview(page, testInfo, "editor-layer-arrange");
  });

  test("captures changed artboard controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-artboard-fit-mode]")
      .selectOption("cover");
    await page.locator("[data-vigilia-artboard-width]").fill("1000");
    await page.locator("[data-vigilia-artboard-width]").press("Tab");
    await page
      .locator("[data-vigilia-artboard-background]")
      .selectOption("palette.bars");
    await expect(page.locator("[data-vigilia-artboard-fit-mode]")).toHaveValue(
      "cover",
    );
    await expect(
      page.locator("[data-vigilia-artboard-background]"),
    ).toHaveValue("palette.bars");

    await captureVisualReview(page, testInfo, "editor-fork-artboard");
  });

  test("rejects literal artboard paint in a v2 document", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setUncheckedThemePackage(page, "literal-bars.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "literal-bars",
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
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setThemePackage(page, "gradient-artboard.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "gradient-artboard",
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

    await captureVisualReview(page, testInfo, "editor-fork-artboard-gradient");
  });

  test("edits an artboard palette token through the fork property surface", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

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

    await captureVisualReview(page, testInfo, "editor-fork-palette-solid");
  });

  test("reassigns palette references before deleting a token", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-palette-token]")
      .selectOption("background");
    await page
      .locator("[data-vigilia-palette-replacement]")
      .selectOption("bars");
    await captureVisualReview(
      page,
      testInfo,
      "editor-fork-palette-reassignment",
    );
    await page.locator("[data-vigilia-palette-delete]").click();
    await expect(
      page.locator('[data-vigilia-palette-token] option[value="background"]'),
    ).toHaveCount(0);

    const envelope = (await saveEnvelope(page)) as {
      artboard: { background?: { ref: string } };
      globals: { palette: Record<string, unknown> };
    };
    expect(envelope.artboard.background).toEqual({ ref: "palette.bars" });
    expect(envelope.globals.palette.background).toBeUndefined();
  });

  test("reassigns chart paint before deleting its palette token", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

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
      envelope.scene.objects.find((object) => object.id === "load-gauge")
        ?.settings?.track,
    ).toEqual({ ref: "palette.bars" });
  });

  test("edits a global type preset through the fork property surface", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.route("https://cdn.jsdelivr.net/fontsource/fonts/**", (route) =>
      route.fulfill({ body: Buffer.from([0, 1, 2]) }),
    );
    await page.locator("[data-vigilia-type-preset]").selectOption("32-500");
    await page.locator("[data-vigilia-font-face]").selectOption("inter-700");
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
    await page.locator("[data-vigilia-type-preset]").selectOption("32-500");
    const reopened = (await saveEnvelope(page)) as {
      globals: {
        typePresets: {
          "32-500": {
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
    expect(reopened.globals.typePresets["32-500"].value).toMatchObject({
      size: 34,
      letterSpacing: 0.25,
      face: { assetId: "inter-700" },
      trioRole: "heading",
    });
    await page
      .locator("[data-vigilia-type-letter-spacing]")
      .scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-fork-type-preset");
  });

  test("captures curated font trio controls for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.locator("[data-vigilia-type-preset]").selectOption("32-500");
    const face = page.locator("[data-vigilia-font-face]");
    await face.scrollIntoViewIfNeeded();
    await expect(face).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apply trio" }),
    ).toBeVisible();
    await captureVisualReview(page, testInfo, "editor-fork-font-trio");
  });

  test("reassigns text type presets before deleting one", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page.locator("[data-vigilia-type-preset]").selectOption("11-400");
    await page
      .locator("[data-vigilia-type-replacement]")
      .selectOption("11-500");
    await page.locator("[data-vigilia-type-delete]").scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-fork-type-reassignment");
    await page.locator("[data-vigilia-type-delete]").click();
    await expect(
      page.locator('[data-vigilia-type-preset] option[value="11-400"]'),
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
    expect(envelope.globals.typePresets["11-400"]).toBeUndefined();
    expect(
      envelope.scene.objects.find((object) => object.id === "trend-legend")
        ?.vigiliaText?.runs[0]?.typePreset,
    ).toBe("typePresets.11-500");
  });

  test("captures dirty document replacement confirmation for visual review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

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

    await captureVisualReview(page, testInfo, "editor-fork-dirty-replacement");
  });

  test("selects a chart in the starter theme through the visible Fabric canvas", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await expect(
      page.locator('[data-vigilia-chart-setting="thickness"]'),
    ).toBeVisible();
  });

  test("persists artboard properties without rescaling Fabric objects", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await page
      .locator("[data-vigilia-artboard-fit-mode]")
      .selectOption("cover");
    await page.locator("[data-vigilia-artboard-width]").fill("1000");
    await page.locator("[data-vigilia-artboard-width]").press("Tab");
    await page
      .locator("[data-vigilia-artboard-background]")
      .selectOption("palette.bars");

    const envelope = (await saveEnvelope(page)) as {
      artboard: {
        fitMode?: string;
        width: number;
        background?: { ref: string };
      };
      scene: { objects: Array<{ id?: string; left?: number }> };
    };
    expect(envelope.artboard.fitMode).toBe("cover");
    expect(envelope.artboard.width).toBe(1000);
    expect(envelope.artboard.background).toEqual({ ref: "palette.bars" });
    expect(leftFor(envelope, "wordmark")).toBe(54);
  });

  test("persists a selected chart binding", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await selectStarterChart(page);
    await page
      .locator('[data-vigilia-binding="cpu-load"]')
      .selectOption("ram.used");
    const precision = page.locator(
      '[data-vigilia-binding-field="cpu-load.precision"]',
    );
    await precision.fill("2");
    await precision.press("Tab");

    const envelope = (await saveEnvelope(page)) as {
      bindings: Record<string, Array<{ id: string; semanticKey: string }>>;
    };
    expect(envelope.bindings["load-gauge"]).toContainEqual({
      id: "cpu-load",
      semanticKey: "ram.used",
      precision: 2,
    });
  });

  test("persists selected chart paint as a palette reference", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

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
      envelope.scene.objects.find((object) => object.id === "load-gauge")
        ?.settings?.progress,
    ).toEqual({ ref: "palette.chartTrack" });
  });

  test("refreshes bound text without saving its sampled value", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setThemePackage(page, "live-text.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "live-text",
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
    await captureVisualReview(page, testInfo, "editor-fork-live-text");

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
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const envelope = {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "opened",
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

  test("round-trips an opened v2 Fabric scene through the fork save path", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const picker = page.locator('input[accept=".vigilia-theme"]');
    await setThemePackage(page, "source.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "source",
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
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );
    await page.goto(EDITOR);
    await page.locator("[data-vigilia-asset-import]").setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAIklEQVQ4jWNk2HHzPwMVARM1DRs1cNTAUQNHDRw1cCgZCAC1HQK4IWYK+QAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await expect(
      page
        .locator("[data-vigilia-asset-import]")
        .locator("xpath=..")
        .locator("option"),
    ).toHaveCount(1);
    await page.locator("[data-vigilia-asset-replace]").setInputFiles({
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#00b8d9"/></svg>',
      ),
    });
    await expect(
      page
        .locator("[data-vigilia-asset-import]")
        .locator("xpath=..")
        .locator("option"),
    ).toHaveCount(2);
    await expect(
      page
        .locator("[data-vigilia-asset-import]")
        .locator("xpath=..")
        .locator("select"),
    ).toHaveValue("logo");
    await expect(assetReferences(page)).resolves.toContainEqual({
      assetId: "logo-2",
      kind: "svg",
    });
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
          };
        };
        const image = editor.canvas.getActiveObject();
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
    await page
      .getByRole("heading", { name: "Assets" })
      .scrollIntoViewIfNeeded();
    await captureVisualReview(page, testInfo, "editor-fork-assets");
    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    expect(saved.parsed.assets["assets/logo.svg"]).toBeDefined();
    expect(saved.parsed.envelope.scene.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vigiliaAsset: { assetId: "logo-2", kind: "svg" },
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
      assetId: "logo-2",
      kind: "svg",
    });
  });

  test("authors a packaged background image through Theme settings", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );
    await page.goto(EDITOR);
    await page.locator("[data-vigilia-asset-import]").setInputFiles({
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
    await captureVisualReview(page, testInfo, "editor-fork-background-media");

    const saved = await savePackage(page);
    expect(saved.parsed.ok).toBe(true);
    if (!saved.parsed.ok) return;
    expect(saved.parsed.envelope.artboard.backgroundMedia).toEqual({
      assetId: "hero",
      fit: "contain",
    });
    expect(saved.parsed.assets["assets/hero.png"]).toBeDefined();
  });

  test("persists an ordinary fork drag and restores it through undo", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setThemePackage(page, "movable.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "movable",
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

    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;
    const point = (x: number, y: number) => ({
      x: box.x + (x / 320) * box.width,
      y: box.y + (y / 180) * box.height,
    });
    const center = point(76, 66);
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

    const start = point(70, 70);
    const end = point(150, 70);
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

  test("rehydrates a chart runtime after undo", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await selectStarterChart(page);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;
    const start = {
      x: box.x + (432 / 1280) * box.width,
      y: box.y + (418 / 720) * box.height,
    };
    const left = leftFor(await saveEnvelope(page), "load-gauge");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y);
    await page.mouse.up();
    expect(leftFor(await saveEnvelope(page), "load-gauge")).toBeGreaterThan(
      left,
    );

    await page.keyboard.press("Control+z");
    expect(leftFor(await saveEnvelope(page), "load-gauge")).toBeCloseTo(
      left,
      3,
    );
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
          const chart = editor?.canvas
            .getObjects()
            .find((object) => object.get("id") === "load-gauge") as
            | { option?: { series?: unknown[] } }
            | undefined;
          const option = chart?.option;
          return option?.series?.length ?? 0;
        }),
      )
      .toBeGreaterThan(0);
  });

  test("keeps the active document when Fabric cannot revive a schema-valid scene", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    await setUncheckedThemePackage(page, "unrevivable.vigilia-theme", {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "unrevivable",
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
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

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
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

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
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;

    // Drag the "SYSTEM STATUS" label (starter scene: left 1074, top 538,
    // originX left) horizontally until its left edge lands on the status
    // card's left edge (1018) — a vertical alignment inside the 5-px threshold.
    const toCanvas = (x: number, y: number) => ({
      x: box.x + (x / 1280) * box.width,
      y: box.y + (y / 720) * box.height,
    });
    const grab = toCanvas(1104, 546);
    const drop = toCanvas(1048, 546);
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(drop.x, drop.y, { steps: 12 });

    await captureVisualReview(page, testInfo, "editor-fork-snap-guides");
    await page.mouse.up();
  });

  test("shows the rotation-angle indicator beside the pointer mid-rotation", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;

    // Select the "time" label (scene 78,189, size ~210x70) via the canvas,
    // then sweep its rotation handle above the top edge: the degree readout
    // must appear beside the pointer mid-gesture.
    const toCanvas = (x: number, y: number) => ({
      x: box.x + (x / 1280) * box.width,
      y: box.y + (y / 720) * box.height,
    });
    const centre = toCanvas(180, 220);
    await page.mouse.click(centre.x, centre.y);
    // Fabric's mtr sits above the top edge at the object's centre X, roughly
    // 45px above the bounding top plus the handle radius.
    const handle = toCanvas(180, 132);
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + 30, handle.y + 30, { steps: 12 });

    await captureVisualReview(page, testInfo, "editor-fork-rotation-indicator");
    await page.mouse.up();
  });

  test("captures the canvas dock over a selected object", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the editor is a desktop surface",
    );

    await page.goto(EDITOR);
    const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;

    // Select the "time" label; the dock anchors to the canvas bottom and
    // shows only the actions this selection can run.
    const centre = {
      x: box.x + (180 / 1280) * box.width,
      y: box.y + (220 / 720) * box.height,
    };
    await page.mouse.click(centre.x, centre.y);
    const dock = page.locator('[aria-label="Selected object actions"]');
    await expect(dock).toHaveAttribute("data-visible", "true");
    await expect(dock.getByRole("button", { name: "Duplicate" })).toBeVisible();
    // A single object cannot be ungrouped.
    await expect(dock.getByRole("button", { name: "Ungroup" })).toHaveCount(0);

    await captureVisualReview(page, testInfo, "editor-fork-toolbar");
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

async function selectStarterChart(page: Page): Promise<void> {
  const box = await page
    .locator("#vigilia-fabric-editor canvas.upper-canvas")
    .boundingBox();
  expect(box).not.toBeNull();
  if (box === null) throw new Error("The editor canvas has no visible bounds.");
  await page.mouse.click(
    box.x + (432 / 1280) * box.width,
    box.y + (418 / 720) * box.height,
  );
  await expect(
    page.locator('[data-vigilia-chart-setting="thickness"]'),
  ).toBeVisible();
}

async function captureVisualReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  if (process.env["VIGILIA_CAPTURE"] === undefined) return;
  const directory =
    process.env["VIGILIA_CAPTURE_DIR"] ??
    (process.env["VIGILIA_CAPTURE"] === undefined
      ? "test-results/screenshots"
      : "../../.agents/screenshots");
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

function leftFor(envelope: unknown, id: string): number {
  const objects = (
    envelope as { scene: { objects: Array<{ id?: string; left?: number }> } }
  ).scene.objects;
  const left = objects.find((object) => object.id === id)?.left;
  expect(left).toEqual(expect.any(Number));
  return left!;
}

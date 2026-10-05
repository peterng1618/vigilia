import { expect, type Page, test } from "@playwright/test";

/**
 * The stage looks through a display, and the display is a lens.
 *
 * A framing claim, so it is measured in a real browser against built bundles
 * rather than inferred from the unit tests: every number below is read back
 * out of the running editor's own camera, through the product's own control.
 *
 * The load-bearing assertion is the *containment*: the artboard must sit
 * wholly inside the display's screen, at its own aspect, with pasteboard
 * showing either side. A lens that cropped to fill would produce a larger,
 * wrong-shaped artboard and pass every "is something drawn here" check —
 * which is why the bars are asserted as bars and not as emptiness.
 */

/** Relative, so the proof runs against whichever preview the config started
 *  rather than the shared one on 4174 that other agent sessions also use. */
const EDITOR = "/";

/** The starter's artboard, as the theme declares it. */
const STARTER = { width: 1672, height: 941 } as const;

type Bridge = {
  editor: {
    artboard(): { readonly width: number; readonly height: number };
    viewport: {
      zoom(): number;
      display(): string | undefined;
      displayScreenRect():
        | {
            left: number;
            top: number;
            width: number;
            height: number;
          }
        | undefined;
      artboardScreenRect(): {
        left: number;
        top: number;
        width: number;
        height: number;
      };
    };
  };
};

type Measured = {
  readonly display: string | undefined;
  readonly screen: { left: number; top: number; width: number; height: number };
  readonly board: { left: number; top: number; width: number; height: number };
  /** The lower canvas' own box in page coordinates. */
  readonly stage: { x: number; y: number; width: number; height: number };
};

/** The camera's own geometry, plus the stage it is measured against. */
async function measure(page: Page): Promise<Measured> {
  return page.evaluate(() => {
    const bridge = (window as unknown as { vigiliaEditorBridge: Bridge })
      .vigiliaEditorBridge;
    const screen = bridge.editor.viewport.displayScreenRect();
    if (screen === undefined) {
      throw new Error(
        "no display screen: the stage is showing the bare window",
      );
    }
    const canvas = document.querySelector<HTMLCanvasElement>(
      "#vigilia-fabric-editor canvas.lower-canvas",
    );
    if (canvas === null) throw new Error("no lower canvas in the editor");
    const box = canvas.getBoundingClientRect();
    return {
      display: bridge.editor.viewport.display(),
      screen,
      board: bridge.editor.viewport.artboardScreenRect(),
      stage: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  });
}

const aspect = (r: { width: number; height: number }): number =>
  r.width / r.height;

/** Pins `Date.now` for the page, so the starter's live readings stop moving.
 *
 *  The editor samples a waveform at wall-clock time, so two scene reads a
 *  second apart differ in the *text* of every card — measured here: `51%`
 *  became `64%` with nothing but time between them. Anything comparing a
 *  document across reads has to remove that, or it measures the clock.
 *
 *  `addInitScript` only reaches documents loaded *after* it is registered, so
 *  this is called before `goto` in `beforeEach` rather than inside the test
 *  that needs it — registering it later left the page already loaded, and the
 *  first version of this file failed on the very readings it was meant to
 *  remove. */
async function freezeClock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fixed = 1_760_000_000_000;
    Date.now = () => fixed;
  });
}

/** Picks a display through the stage's own control, by its visible name. */
async function chooseDisplay(page: Page, name: string): Promise<void> {
  await page.locator("[data-vigilia-zoom]").click();
  await page.getByRole("menuitemradio", { name }).click();
}

/** Where each menu label sits, in page px, measured on the live menu.
 *
 *  The label is a text node inside the item, so it is measured through a
 *  `Range` rather than a bounding box of its own. */
async function labelOffsets(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const offsets: Record<string, number> = {};
    for (const item of document.querySelectorAll('[role="menuitemradio"]')) {
      const name = item.getAttribute("aria-label") ?? "";
      const label = [...item.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (label === undefined) continue;
      const range = document.createRange();
      range.selectNodeContents(label);
      offsets[name] = range.getBoundingClientRect().left;
    }
    return offsets;
  });
}

/** Opens the display menu on the trigger, leaving the current choice ticked. */
async function openMenu(page: Page): Promise<void> {
  await page.locator("[data-vigilia-zoom]").click();
  await expect(page.getByRole("menu")).toBeVisible();
}

test.describe("the stage looks through a display", () => {
  test.beforeEach(async ({ page }) => {
    // Before the navigation: see `freezeClock`.
    await freezeClock(page);
    await page.goto(EDITOR);
    await expect(page.locator("#vigilia-fabric-editor")).toBeVisible();
    await page.waitForFunction(
      () =>
        (window as unknown as { vigiliaEditorBridge?: unknown })
          .vigiliaEditorBridge !== undefined,
    );
    // The starter paints asynchronously (fonts, images); a read before it has
    // finished is a read of an empty canvas.
    await page.waitForTimeout(1500);
  });

  test("opens on a landscape phone, framing the starter whole with bars", async ({
    page,
  }) => {
    const m = await measure(page);

    expect(
      m.display,
      "the default display is the one the starter is drawn in",
    ).toBe("phone-landscape");
    expect(
      aspect(m.screen),
      "and its screen carries the phone's aspect, not the window's",
    ).toBeCloseTo(19.5 / 9, 2);
    expect(
      Math.abs(aspect(m.stage) - aspect(m.screen)),
      "so the screen is not the stage",
    ).toBeGreaterThan(0.05);

    // Containment, which is the whole claim. The artboard keeps its own
    // aspect...
    expect(
      aspect(m.board),
      "the artboard is presented at its own aspect, not the screen's",
    ).toBeCloseTo(STARTER.width / STARTER.height, 3);
    // ...and sits wholly inside the screen rather than being cropped to fill.
    expect(
      m.board.left,
      "pasteboard on the left of the artboard",
    ).toBeGreaterThan(m.screen.left + 1);
    expect(m.board.left + m.board.width, "and on the right").toBeLessThan(
      m.screen.left + m.screen.width - 1,
    );

    // It is the artboard and nothing larger that the camera holds: at the
    // device framing the whole board fits, which a cropped preview would not.
    expect(
      m.board.height,
      "the board's height in screen px",
    ).toBeLessThanOrEqual(m.screen.height + 0.5);
  });

  test("the artboard's authored dimensions are untouched by the choice", async ({
    page,
  }) => {
    // The size only, not the whole artboard: the starter's carries a background,
    // bars and a media reference, so a whole-object comparison would report a
    // difference in any of those rather than in the dimensions this is about.
    const read = () =>
      page.evaluate(() => {
        const artboard = (
          window as unknown as { vigiliaEditorBridge: Bridge }
        ).vigiliaEditorBridge.editor.artboard();
        return { width: artboard.width, height: artboard.height };
      });

    expect(await read(), "the starter is 16:9 to begin with").toEqual(STARTER);

    for (const name of ["Phone portrait", "Wall panel", "Fit"]) {
      // Every entry is a radio: Fit is "no display" and the three lenses are
      // displays, so they are one fact with four values, not two controls.
      await page.locator("[data-vigilia-zoom]").click();
      await page.getByRole("menuitemradio", { name }).click();
      // The lens frames what the author wrote; it never rewrites it (§57).
      expect(await read(), `after choosing ${name}`).toEqual(STARTER);
    }
  });

  test("each display frames the board to its own shape, and Fit restores the window", async ({
    page,
  }) => {
    const seen: { readonly name: string; readonly aspect: number }[] = [];

    for (const [name, want] of [
      ["Phone landscape", 19.5 / 9],
      ["Phone portrait", 1 / (19.5 / 9)],
      ["Wall panel", 16 / 9],
    ] as const) {
      await chooseDisplay(page, name);
      const m = await measure(page);
      expect(aspect(m.screen), `${name}'s screen aspect`).toBeCloseTo(want, 2);
      // The board is never cropped to suit the screen it is being shown on.
      expect(
        aspect(m.board),
        `${name} still shows the board whole`,
      ).toBeCloseTo(STARTER.width / STARTER.height, 3);
      seen.push({ name, aspect: aspect(m.screen) });
    }

    // Three genuinely different framings, not one zoom relabelled three times.
    expect(new Set(seen.map((row) => row.aspect.toFixed(2))).size).toBe(3);

    await page.locator("[data-vigilia-zoom]").click();
    await page.getByRole("menuitemradio", { name: "Fit" }).click();
    // Fit is one click away and is the whole window again — no screen drawn
    // around a display the author did not choose.
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { vigiliaEditorBridge: Bridge }
        ).vigiliaEditorBridge.editor.viewport.displayScreenRect(),
      ),
      "Fit has no screen to draw",
    ).toBeUndefined();
    // The trigger reads the zoom whatever is chosen. That readout predates this
    // task and two browser specs pin it, so a display must not take it over —
    // and the default is a display, so it would have gone on open.
    expect(
      await page.locator("[data-vigilia-zoom]").textContent(),
      "and the trigger still reads the camera's scale",
    ).toMatch(/^\d+%$/);
  });

  test("the menu labels do not move when the tick moves between them", async ({
    page,
  }) => {
    // Measured, because the claim is a pixel one and the CSS that makes it is
    // dead unless Base UI actually keeps the indicator mounted: `keepMounted`
    // defaults to false, so without it the tick exists on the checked item
    // only and every other label sits a gutter-width to the left of it.
    //
    // Choosing a display moves *every* label, including the one the pointer is
    // travelling toward — which is the reason the gutter has to exist.
    await openMenu(page);
    const ticked = await labelOffsets(page);
    expect(Object.keys(ticked), "the menu offered its labels").toHaveLength(4);

    await page.getByRole("menuitemradio", { name: "Wall panel" }).click();
    await openMenu(page);
    const moved = await labelOffsets(page);

    for (const [name, before] of Object.entries(ticked)) {
      expect(
        Math.abs((moved[name] ?? Number.NaN) - before),
        `${name} kept its column when the tick moved to another row`,
      ).toBeLessThan(0.5);
    }

    // Control: the menu really did re-render with a different tick, or the
    // comparison above is measuring a menu that never changed.
    await expect(
      page.getByRole("menuitemradio", { name: "Wall panel" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("menuitemradio", { name: "Fit" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  test("100 % is not reported to the author as Fit", async ({ page }) => {
    // The control asserting a camera state that is not true. `reset` clears the
    // lens and parks the camera at 1:1, and a tick derived from the lens alone
    // then reads that as Fit — the whole stage framed, which it is not.
    await page.locator("[data-vigilia-zoom]").click();
    await page.getByRole("menuitem", { name: "100 %" }).click();

    const camera = () =>
      page.evaluate(() => {
        const bridge = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: {
                viewport: {
                  zoom(): number;
                  isFitted(): boolean;
                  displayScreenRect(): unknown;
                };
              };
            };
          }
        ).vigiliaEditorBridge;
        return {
          zoom: bridge.editor.viewport.zoom(),
          fitted: bridge.editor.viewport.isFitted(),
          screen: bridge.editor.viewport.displayScreenRect() !== undefined,
        };
      });

    const after = await camera();
    expect(after.zoom, "the camera is at its own scale").toBe(1);
    expect(after.screen, "and there is no screen drawn around 1:1").toBe(false);
    expect(after.fitted, "which is not a fit").toBe(false);

    await openMenu(page);
    // Nothing ticked at all: the camera is at a framing this menu does not
    // offer, and the honest report of that is silence.
    await expect(
      page.getByRole("menuitemradio", { name: "Fit" }),
    ).toHaveAttribute("aria-checked", "false");

    // And the reverse shape: Fit chosen, then zoomed off it by hand.
    await page.getByRole("menuitemradio", { name: "Fit" }).click();
    await openMenu(page);
    await expect(
      page.getByRole("menuitemradio", { name: "Fit" }),
    ).toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitem", { name: "100 %" }).click();
    await openMenu(page);
    await expect(
      page.getByRole("menuitemradio", { name: "Fit" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  test("choosing a display changes the view and leaves the document alone", async ({
    page,
  }) => {
    // Read through the scene itself, so this compares the document rather than
    // a summary of it. Fabric JSON *is* the document (§134). The clock is
    // already frozen by `beforeEach`, which is what makes this a comparison of
    // the lens rather than of the readings.
    const scene = () =>
      page.evaluate(() => {
        const bridge = (
          window as unknown as {
            vigiliaEditorBridge: {
              editor: { canvas: { toObject(properties: string[]): unknown } };
            };
          }
        ).vigiliaEditorBridge;
        return JSON.stringify(
          bridge.editor.canvas.toObject([
            "id",
            "left",
            "top",
            "width",
            "height",
          ]),
        );
      });

    const before = await scene();
    expect(
      before.length,
      "the scene was not empty, so this proves nothing",
    ).toBeGreaterThan(200);

    for (const name of ["Phone portrait", "Wall panel", "Phone landscape"]) {
      await chooseDisplay(page, name);
      expect(await scene(), `the document after choosing ${name}`).toBe(before);
    }

    // And the view really did move — a control that changed nothing would leave
    // the scene equal too, so the comparison above needs this to mean anything.
    const fitted = await measure(page);
    await chooseDisplay(page, "Phone portrait");
    const portrait = await measure(page);
    expect(
      Math.abs(portrait.board.width - fitted.board.width),
      "the camera really did re-frame",
    ).toBeGreaterThan(1);

    // Control: a comparison that cannot fail proves nothing. An authored move
    // *is* a document change, and it has to show up in the same comparison the
    // lens passed — otherwise "the scene was unchanged" could just mean the
    // scene is not being read.
    await page.evaluate(() => {
      const bridge = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getObjects(): { set(values: Record<string, unknown>): void }[];
              };
            };
          };
        }
      ).vigiliaEditorBridge;
      const card = bridge.editor.canvas.getObjects()[0];
      card?.set({ left: 999 });
    });
    expect(await scene(), "a real edit does change it").not.toBe(before);
  });
});

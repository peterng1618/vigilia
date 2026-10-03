import { expect, type Page, test } from "@playwright/test";
import { isDesktopSurface } from "./surface.js";

/**
 * Every palette resolves, in the chrome and in the portalled popups.
 *
 * **This cannot be a jsdom test, and there is deliberately no unit test beside
 * it.** A `var(--vigilia-x)` naming a token no declaration in scope provides is
 * invalid at computed-value time: the declaration using it is dropped whole
 * rather than falling back. jsdom does not resolve custom properties at all, so
 * an assertion there passes whether or not the cascade does — it would be green
 * for the exact defect it was written to catch. The static half lives beside the
 * stylesheet (`editor-shell.tokens.test.ts`); the half that needs a real
 * cascade is here.
 *
 * The palettes are driven through `localStorage` and a reload rather than
 * through the menu. The menu is a Base UI popup whose items are portalled out of
 * `#app`, so driving six palettes through it would test the portal twice per
 * palette and make a failure ambiguous between the two.
 */

const EDITOR = "http://127.0.0.1:4174/";

/** The palette popup, named rather than class-matched: the View menu carries
 *  the same class and stays mounted-but-closed beside it, so the class alone is
 *  a strict-mode violation the moment two of them exist. */
const PALETTE_POPUP = '.editor-shell-menu-popup[aria-label="Shell palette"]';

/** Read from the same list the editor uses, so a palette added there cannot
 *  escape this sweep. Kept as a literal because the spec file cannot import the
 *  editor package; `shellPalettes` in `palette.ts` is the owner. */
const PALETTES = [
  "editorial",
  "graphite",
  "ember",
  "moss",
  "plum",
  "light",
] as const;

type Palette = (typeof PALETTES)[number];

/** The editor, loaded once. Palettes are switched through the menu after this,
 *  which is the route an author takes and costs no reload — the editor boots a
 *  whole Fabric session per load, and six of those is past the test budget. */
async function openEditor(page: Page): Promise<void> {
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
}

/** Choose a palette the way an author does: open the menu, click the entry.
 *
 *  The menu is closed with Escape rather than left to the selection: Base UI
 *  keeps a radio menu open so several entries can be compared before dismissing
 *  it, so selecting is not what closes it. Asserts the attribute rather than
 *  trusting the click, so a menu that failed to apply the choice fails here
 *  rather than six assertions later against whatever was in force. */
async function choosePalette(page: Page, palette: Palette): Promise<void> {
  await page.locator("[data-vigilia-palette]").click();
  const popup = page.locator(PALETTE_POPUP);
  await expect(popup).toBeVisible();
  await popup.getByRole("menuitemradio", { name: palette, exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-shell-palette",
    palette,
  );
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
}

/** The computed colours of the surfaces a `--vigilia-*` token paints. */
async function shellColours(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const read = (selector: string): string => {
      const node = document.querySelector(selector);
      return node === null ? "" : getComputedStyle(node).backgroundColor;
    };
    return {
      paletteTrigger: read("[data-vigilia-palette]"),
      inspectorInput: read(".editor-shell-inspector input"),
      inspectorSelect: read(".editor-shell-inspector select"),
      stage: read(".editor-shell-stage"),
    };
  });
}

test.describe("shell palettes", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "measured through getComputedStyle; the custom-property cascade is what is under test",
  );

  test("every palette paints the surfaces its --vigilia-* tokens name", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    // Today five of the six resolve to nothing: `--vigilia-*` was declared only
    // under `[data-shell-palette="editorial"]`, so under the others the
    // declaration that referenced it was dropped and the element rendered
    // transparent.
    const empty = "rgba(0, 0, 0, 0)";
    const unresolved: string[] = [];

    await openEditor(page);
    for (const palette of PALETTES) {
      await choosePalette(page, palette);
      const colours = await shellColours(page);

      for (const [surface, colour] of Object.entries(colours)) {
        // `getComputedStyle` answers `rgba(0, 0, 0, 0)` for a dropped
        // declaration, which is indistinguishable from a deliberately
        // transparent surface — so the check is against a surface that is
        // required to be opaque.
        if (colour === "" || colour === empty) {
          unresolved.push(`${palette}/${surface} = ${colour || "(absent)"}`);
        }
      }
    }

    expect(
      unresolved,
      "a --vigilia-* reference with no declaration in scope is invalid at " +
        "computed-value time, and the declaration using it is dropped whole",
    ).toEqual([]);
  });

  test("a portalled popup carries the palette in force", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    // Six palettes, each opening and dismissing a popup, is past the 30s
    // default here. The other sweeps stay inside it.
    test.setTimeout(90_000);

    await openEditor(page);
    for (const palette of PALETTES) {
      await choosePalette(page, palette);
      await page.locator("[data-vigilia-palette]").click();
      const popup = page.locator(PALETTE_POPUP);
      await expect(popup).toBeVisible();

      // The popup is a sibling of `#app`, not a descendant — the reason this
      // failed under every non-editorial palette while the chrome beside it was
      // correct. Asserted rather than assumed, so the check keeps meaning what
      // it says if the portal target ever changes.
      const portalled = await popup.evaluate(
        (node) => document.getElementById("app")?.contains(node) === false,
      );
      expect(portalled, "the popup left #app, which is the whole case").toBe(true);

      const [popupBackground, headerBackground] = await Promise.all([
        popup.evaluate((node) => getComputedStyle(node).backgroundColor),
        page
          .locator(".editor-shell-header")
          .evaluate((node) => getComputedStyle(node).backgroundColor),
      ]);
      expect(
        popupBackground,
        `the ${palette} popup does not match its chrome`,
      ).toBe(headerBackground);

      await page.keyboard.press("Escape");
      await expect(popup).toBeHidden();
    }
  });

  test("every chip shows the palette it names, not the one in force", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    // `ember`, `moss` and `plum` override only the accent, so a chip naming one
    // used to inherit the live palette's surface and paint, under graphite,
    // graphite's dark glass behind a peach ring.
    await openEditor(page);
    await choosePalette(page, "graphite");
    await page.locator("[data-vigilia-palette]").click();
    const popup = page.locator(PALETTE_POPUP);
    await expect(popup).toBeVisible();

    const chips = await popup.evaluate((node) =>
      [...node.querySelectorAll(".editor-shell-palette-swatch")].map((chip) => ({
        palette: chip.getAttribute("data-shell-palette"),
        background: getComputedStyle(chip).backgroundColor,
        ring: getComputedStyle(chip).boxShadow,
      })),
    );

    expect(chips.map((chip) => chip.palette)).toEqual([...PALETTES]);

    // Only two of the six declare a surface of their own — graphite's dark
    // glass and light's mint — so the other four share editorial's paper by
    // design, and `editorial` and `light` share its ink accent too. What must
    // hold is that no chip shows the *live* palette's surface or ring while
    // naming a different one, which is the defect.
    const live = chips.find((chip) => chip.palette === "graphite");
    const borrowed = chips.filter(
      (chip) =>
        chip.palette !== "graphite" &&
        (chip.background === live?.background || chip.ring === live?.ring),
    );
    expect(
      borrowed.map((chip) => chip.palette),
      "these chips are showing graphite, the palette in force, not their own",
    ).toEqual([]);

    // The four accent palettes each read as themselves: their rings are
    // distinct, and none is the ink `editorial` and `light` share.
    const rings = chips.filter(
      (chip) => chip.palette === "ember" || chip.palette === "moss" || chip.palette === "plum",
    );
    expect(new Set(rings.map((chip) => chip.ring)).size).toBe(rings.length);

    await page.keyboard.press("Escape");
  });

  test("a fresh profile with no stored palette renders editorial", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    // The comment above `:root` promises this, and moving the `--vigilia-*`
    // block onto `:root` is exactly the change that could have broken it: a base
    // that does not carry editorial's values renders the wrong palette before
    // any attribute is applied. Each test gets its own storage, so this one
    // arrives with nothing stored and only this one depends on that.
    await openEditor(page);

    await expect(page.locator("[data-vigilia-palette]")).toHaveText("editorial");
    await expect(page.locator("html")).toHaveAttribute(
      "data-shell-palette",
      "editorial",
    );
    const colours = await shellColours(page);
    expect(colours.paletteTrigger).not.toBe("rgba(0, 0, 0, 0)");
  });
});

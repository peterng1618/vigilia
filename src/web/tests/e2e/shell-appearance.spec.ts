import { expect, type Page, test } from "@playwright/test";
import { captureVisualReview } from "./editor-canvas.js";
import { openPane } from "./editor-pane-bar.js";
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
  // The document panels — the artboard's and the palette's — are the chrome's
  // form controls, and they live in the left column's Document pane. Its width
  // and ratio controls are what `shellColours` reads, so the pane has to be
  // showing for them to have a box.
  await openPane(page, "Document");
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
  await popup
    .getByRole("menuitemradio", { name: palette, exact: true })
    .click();
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
      documentInput: read(".editor-shell-panel input"),
      documentSelect: read(".editor-shell-panel select"),
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
      expect(portalled, "the popup left #app, which is the whole case").toBe(
        true,
      );

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

    // A chip names a palette it may not be rendering under. `ember`, `moss`
    // and `plum` declared only an accent, so under graphite a chip naming one
    // inherited the live palette's surface and painted graphite's dark glass
    // behind a peach ring.
    await openEditor(page);
    await choosePalette(page, "graphite");
    await page.locator("[data-vigilia-palette]").click();
    const popup = page.locator(PALETTE_POPUP);
    await expect(popup).toBeVisible();

    const chips = await popup.evaluate((node) =>
      [...node.querySelectorAll(".editor-shell-palette-swatch")].map(
        (chip) => ({
          palette: chip.getAttribute("data-shell-palette"),
          background: getComputedStyle(chip).backgroundColor,
          ring: getComputedStyle(chip).boxShadow,
        }),
      ),
    );

    expect(chips.map((chip) => chip.palette)).toEqual([...PALETTES]);

    // No chip shows the *live* palette's surface or ring while naming a
    // different one, which is the defect this test was written for.
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

    // And all six are surfaces of their own, which is what the picker is for.
    // `ember`, `moss` and `plum` declared only an accent, so four of the six
    // chips were byte-identical cream — a computed-value assertion cannot see
    // that as wrong, because editorial's value is a legitimate value; only the
    // eye catches a picker offering four options that look alike. Hence this
    // is the assertion *and* the six screenshots beside it.
    const surfaces = chips.map((chip) => chip.background);
    expect(
      surfaces.filter((surface, i) => surfaces.indexOf(surface) !== i),
      "two palettes render the same surface, so the picker offers a duplicate",
    ).toEqual([]);
    expect(
      new Set(chips.map((chip) => chip.ring)).size,
      "two palettes render the same ring",
    ).toBe(chips.length);

    await page.keyboard.press("Escape");
  });

  /** A utility resolves the palette of the SUBTREE it is written in.
   *
   *  Injected rather than written into a component: the shell has no
   *  `bg-shell-surface` yet, and this is the property that decides whether the
   *  first one is safe to write. The probe goes inside the ember chip while
   *  graphite is in force, which is the exact case a non-inline `@theme` loses
   *  — it compiles to `var(--color-shell-surface)`, resolved at `:root`, so the
   *  chip's own declaration is never consulted. */
  test("a shell colour utility resolves the palette of its own subtree", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await openEditor(page);
    await choosePalette(page, "graphite");
    await page.locator("[data-vigilia-palette]").click();
    const popup = page.locator(PALETTE_POPUP);
    await expect(popup).toBeVisible();

    const [inside, chip, live] = await popup.evaluate((node) => {
      const ember = node.querySelector<HTMLElement>(
        '[data-shell-palette="ember"]',
      );
      // A missing chip would leave the probe detached, where
      // `getComputedStyle` answers "" for everything and the comparison below
      // passes vacuously. Fail loudly instead.
      if (ember === null) {
        throw new Error("no ember chip in the palette popup");
      }
      const probe = document.createElement("span");
      probe.className = "bg-shell-surface";
      ember.appendChild(probe);
      const header = document.querySelector(".editor-shell-header");
      return [
        getComputedStyle(probe).backgroundColor,
        getComputedStyle(ember).backgroundColor,
        header === null ? "" : getComputedStyle(header).backgroundColor,
      ];
    });

    expect(inside, "the utility did not resolve the chip's own palette").toBe(
      chip,
    );
    expect(inside, "and it must not be the live palette").not.toBe(live);
    expect(
      inside,
      "the live palette was not measured, so nothing was proved",
    ).not.toBe("");

    await page.keyboard.press("Escape");
  });

  /** The scale, as the built bundle actually resolves it.
   *
   *  `--text-sm`, `--text-xs` and `--radius-md` were declared on an unlayered
   *  `:root`, which beats `@layer theme` whatever its specificity — so
   *  Tailwind's defaults lost globally, and `text-sm` shipped as 12px on
   *  Tailwind's own 14px line height. Nothing errors when that happens and
   *  nothing reaches a jsdom assertion either, so it is measured here: a probe
   *  carrying the class names resolves through exactly the cascade the live
   *  components resolve through, which is the claim.
   *
   *  The four unused tokens are read as variables rather than as utilities —
   *  `@theme static` emits them, but Tailwind only generates a rule for a class
   *  some source file uses, and `rounded-lg` is not one yet. */
  test("the scale resolves to the editor's density", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await openEditor(page);

    const probe = await page.evaluate(() => {
      // Attached: `getComputedStyle` on a detached node answers "" for
      // everything, which would make every assertion here pass vacuously.
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;top:0;left:0;visibility:hidden";
      document.body.appendChild(host);
      // Each probe reads only the property its utility owns. Reading all three
      // would pin the inherited body font here too, which is not what this
      // test is about and would break on an unrelated change.
      const measure = (
        className: string,
        properties: readonly string[],
      ): Record<string, string> => {
        const node = document.createElement("div");
        node.className = className;
        host.appendChild(node);
        const style = getComputedStyle(node);
        const read = Object.fromEntries(
          properties.map((name) => [name, style.getPropertyValue(name)]),
        );
        node.remove();
        return read;
      };
      const root = getComputedStyle(document.documentElement);
      const theme = Object.fromEntries(
        [
          "--spacing",
          "--text-md",
          "--radius-lg",
          "--shadow-raised",
          "--shadow-overlay",
        ].map((name) => [name, root.getPropertyValue(name).trim()]),
      );
      const utilities = {
        "text-xs": measure("text-xs", ["font-size", "line-height"]),
        "text-sm": measure("text-sm", ["font-size", "line-height"]),
        "rounded-sm": measure("rounded-sm", ["border-radius"]),
        "rounded-md": measure("rounded-md", ["border-radius"]),
      };
      host.remove();
      return { utilities, theme };
    });

    expect(probe.utilities).toEqual({
      "text-xs": { "font-size": "11px", "line-height": "13.75px" },
      "text-sm": { "font-size": "12px", "line-height": "15px" },
      "rounded-sm": { "border-radius": "4px" },
      "rounded-md": { "border-radius": "8px" },
    });
    expect(probe.theme).toEqual({
      // `.25rem`, not `0.25rem`: the bundle is minified, and this reads what
      // the browser resolved rather than what the source says.
      "--spacing": ".25rem",
      "--text-md": "13px",
      "--radius-lg": "12px",
      "--shadow-raised": "0 12px 28px #0000003d",
      "--shadow-overlay": "0 18px 44px #0006",
    });
  });

  /** Editorial is flat; the glass treatment is the other five's.
   *
   *  The three glass rules select `:root:not([data-shell-palette="editorial"])`,
   *  which excluded editorial only once the palette attribute moved onto
   *  `documentElement`. Editorial had been receiving the glass against the
   *  comment above those rules — which say it is the flat one — and nothing
   *  recorded the change, so a later edit could have put it back unnoticed.
   *  `box-shadow` is the discriminator rather than `backdrop-filter`: this
   *  browser computes `backdrop-filter` to `none` under every palette, so it
   *  would assert nothing at all. */
  test("editorial is flat and the other five are glass", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await openEditor(page);
    const header = page.locator(".editor-shell-header");

    await choosePalette(page, "editorial");
    const flat = await header.evaluate((node) => {
      const style = getComputedStyle(node);
      return { shadow: style.boxShadow, image: style.backgroundImage };
    });
    expect(flat.shadow, "editorial carries the glass shadow").toBe("none");
    expect(flat.image, "editorial carries the glass gradient").toBe("none");

    for (const palette of PALETTES.filter((p) => p !== "editorial")) {
      await choosePalette(page, palette);
      const glass = await header.evaluate((node) => {
        const style = getComputedStyle(node);
        return { shadow: style.boxShadow, image: style.backgroundImage };
      });
      expect(
        glass.shadow,
        `the ${palette} header has no glass shadow`,
      ).not.toBe("none");
      expect(
        glass.image,
        `the ${palette} header has no glass gradient`,
      ).not.toBe("none");
    }
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

    await expect(page.locator("[data-vigilia-palette]")).toHaveText(
      "editorial",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-shell-palette",
      "editorial",
    );
    const colours = await shellColours(page);
    expect(colours.paletteTrigger).not.toBe("rgba(0, 0, 0, 0)");
  });

  /** The OS is a fallback, and a choice outranks it.
   *
   *  `emulateMedia` is the only way to move the OS under the shell's feet, and
   *  it is why this is a browser test: jsdom has no `matchMedia`, so the pure
   *  half in `palette.test.ts` can only check the resolve, never that a live
   *  `change` event reaches it. Each test gets its own storage, so this one
   *  arrives with nothing stored — which is the state the OS is allowed to
   *  speak in. */
  test("the OS is the fallback and the author's choice outlasts it", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.emulateMedia({ colorScheme: "dark" });
    await openEditor(page);
    await expect(page.locator("html")).toHaveAttribute(
      "data-shell-palette",
      "graphite",
    );

    // Nothing is stored, so the shell follows the OS when it changes.
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-shell-palette",
      "editorial",
    );

    // The author chooses, and from here the OS has no vote — including when it
    // changes back to the value it held first.
    await choosePalette(page, "plum");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-shell-palette",
      "plum",
    );
  });

  /** The six palettes, as six pictures.
   *
   *  The computed comparison above is necessary and not sufficient: it can tell
   *  two surfaces apart but cannot say whether either is a surface an author
   *  would recognise, and §9's acceptance item asks for the eye. Deliberately
   *  NOT a golden file — a screenshot here is read by a person once, beside the
   *  change that made it. `choosePalette` closes the popup and asserts the
   *  attribute, so each frame is the editor in one palette rather than the menu
   *  that selected it. */
  test("captures each palette's own surface", async ({ page }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    test.setTimeout(120_000);

    await openEditor(page);
    for (const palette of PALETTES) {
      await choosePalette(page, palette);
      await captureVisualReview(page, testInfo, `shell-palette-${palette}`);
    }
  });
});

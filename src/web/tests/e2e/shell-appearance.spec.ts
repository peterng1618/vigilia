import { expect, type Page, test } from "@playwright/test";
import { captureVisualReview } from "./editor-canvas.js";
import { openPane } from "./editor-rail.js";
import {
  choosePalette,
  EDITOR,
  openAppearance,
  openShell,
  PALETTES,
} from "./shell-palette.js";
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
 * The palettes are driven through §7's settings modal, which is the only route
 * an author has to them now. That modal is a Base UI popup portalled out of
 * `#app`, so driving a palette through it tests the portal as well as the
 * palette — which is why the portal has a case of its own rather than being
 * asserted again inside every other one.
 */

/** The editor, with the Document pane open.
 *
 *  The palettes, the menu and the way an author chooses one live in
 *  `shell-palette.ts`, because a second spec needs the same four things and a
 *  copied six-entry list is a list that drifts. The pane is this spec's own
 *  need: the document panels — the artboard's, and the palette's in Tokens —
 *  are the chrome's form controls and they live in the left column, so its
 *  width and ratio controls have no box until a pane shows. */
async function openEditor(page: Page): Promise<void> {
  await openShell(page);
  await openPane(page, "Document");
}

/**
 * The computed colours of the surfaces a `--vigilia-*` token paints.
 *
 * `documentSelect` is the **control set's** select — a `role="combobox"`
 * trigger. Measured: the match is `data-vigilia-asset-select`, the Add pane's
 * asset-list trigger, which is the surface the panel-`select` read resolved to
 * before that pane converted. It is named by the control set's own role rather
 * than by that hook because the panes are hidden rather than unmounted, so a
 * pane-specific selector would say "document" about whichever pane happens to
 * mount first. It reads a control-set well, so it resolves through `--panel-2`
 * and not through `--vigilia-control-bg`: the legacy `.editor-shell-panel
 * button` rule that used to paint it was removed by plan 7 Task 8, and the hook
 * itself is targeted by no rule at all.
 *
 * There is deliberately **no** entry for `.editor-shell-panel input`. The first
 * match is Base UI's hidden value-carrier — measured at `f31b000b` as
 * `id="base-ui-…-hidden-input"`, `aria-hidden="true"`, `tabindex="-1"`,
 * `clip-path: inset(50%)` — which is not a surface at all, so requiring it to
 * be opaque asserts nothing about the palette. It passed before Task 8 only
 * because the legacy rule painted every input indiscriminately. A real
 * control-set well would be a surface, but one painted by `--panel-2`, so it
 * would not restore what this entry used to cover. The consequence is stated
 * rather than hidden: `--vigilia-control-bg` now paints only conditional
 * surfaces — the Add pane's asset buttons, the crop row, the modal's own
 * buttons, the keyboard sheet's chips — so this sweep no longer verifies that
 * token on a surface that is always mounted, and
 * `editor-shell.tokens.test.ts` is what covers its declaration per palette.
 *
 * `header` is the shell chrome the palette paints, and it is named for the
 * surface rather than for the control that used to sit on it: the palette chip
 * left the header for §7's Appearance tab, so the chip is no longer a surface
 * that is on screen for a reader to measure.
 */
async function shellColours(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const read = (selector: string): string => {
      const node = document.querySelector(selector);
      return node === null ? "" : getComputedStyle(node).backgroundColor;
    };
    return {
      header: read(".editor-shell-header"),
      documentSelect: read('.editor-shell-panel [role="combobox"]'),
      stage: read(".editor-shell-stage"),
    };
  });
}

/** The alpha of a computed `background-color`, in whichever of the three forms
 *  this browser serialises: `rgb(r, g, b)` (opaque), `rgba(r, g, b, a)`, and
 *  the `color(srgb r g b / a)` a `color-mix` resolves to. `null` for a form
 *  this does not read, so a change of serialisation reds here rather than
 *  passing as opaque. */
function backgroundAlpha(colour: string): number | null {
  const value = colour.trim();
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb !== null) {
    const parts = (rgb[1] ?? "").split(/[\s,/]+/).filter(Boolean);
    return parts.length > 3 ? Number(parts[3]) : 1;
  }
  const srgb = /^color\(srgb\s+([^)]+)\)$/.exec(value);
  if (srgb !== null) {
    const alpha = (srgb[1] ?? "").split("/")[1];
    return alpha === undefined ? 1 : Number(alpha.trim());
  }
  return null;
}

/** `light` is the one palette whose chrome is not yet opaque, and it is named
 *  rather than skipped so the exception is visible in the reading it exempts.
 *
 *  `light` declares `--shell-surface: #eff9f2bf` — 75% alpha, the residue of
 *  the glass chrome — and every other surface role it declares is alpha too, so
 *  the derivation plan 7 Task 4 wrote produces no opaque value for it. A value
 *  invented here would be a seventh palette tuned by hand, which is the move
 *  the derivation exists to replace, so the fill stays where it is and `vg-310`
 *  owns the gap.
 *
 *  The waiver names a **value, not a direction** (review round 1): the case
 *  asserts that a palette's rendered chrome alpha equals the alpha its own
 *  `--panel` declares, and this set against what that declaration says. The
 *  exemption therefore reds whichever way the fill moves — a value that lands
 *  (declared opaque) makes the row stale, and any treatment added on top of
 *  light's fill breaks the equality — instead of only in the opaque direction,
 *  which is all an `alpha >= 1` reading of "exempt" could catch. */
const CHROME_NOT_YET_OPAQUE: ReadonlySet<(typeof PALETTES)[number]> = new Set([
  "light",
]);

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

  test("a portalled surface carries the palette in force", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    // Six palettes, each opening and dismissing the modal, is past the 30s
    // default here. The other sweeps stay inside it.
    test.setTimeout(90_000);

    await openEditor(page);
    for (const palette of PALETTES) {
      await choosePalette(page, palette);
      const dialog = await openAppearance(page);

      // The modal is a sibling of `#app`, not a descendant — the reason this
      // failed under every non-editorial palette while the chrome beside it was
      // correct. Asserted rather than assumed, so the check keeps meaning what
      // it says if the portal target ever changes.
      const portalled = await dialog.evaluate(
        (node) => document.getElementById("app")?.contains(node) === false,
      );
      expect(portalled, "the modal left #app, which is the whole case").toBe(
        true,
      );

      const [dialogBackground, headerBackground] = await Promise.all([
        dialog.evaluate((node) => getComputedStyle(node).backgroundColor),
        page
          .locator(".editor-shell-header")
          .evaluate((node) => getComputedStyle(node).backgroundColor),
      ]);
      expect(
        dialogBackground,
        `the ${palette} modal does not match its chrome`,
      ).toBe(headerBackground);

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("every preview shows the palette it names, not the one in force", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    // A preview names a palette it may not be rendering under. `ember`, `moss`
    // and `plum` declared only an accent, so under graphite a preview naming one
    // inherited the live palette's surface and painted graphite's dark ground
    // behind a peach accent.
    await openEditor(page);
    await choosePalette(page, "graphite");
    const dialog = await openAppearance(page);
    const group = dialog.getByRole("radiogroup");
    await expect(group).toBeVisible();

    /** **Both bars of every card**, because the preview is two of them (plan 8
     *  Task 5, `docs/design/mockups/current/settings.html:44-87`): the ground
     *  bar carries the class the parity table's height row addresses and the
     *  accent bar is its next sibling, each with its own `data-shell-palette`.
     *  Reading the ground alone would call two palettes identical where only
     *  their accents differ, which is what the ring this replaces used to read.
     *  The ground is read as `backgroundColor` **and** `backgroundImage`:
     *  `light`'s ground is a gradient stack, so its colour resolves to
     *  transparent and the image is what the eye gets. */
    const previews = await group.evaluate((node) =>
      [...node.querySelectorAll(".editor-shell-palette-swatch")].map((bar) => {
        const ground = getComputedStyle(bar);
        const accent = bar.nextElementSibling;
        return {
          palette: bar.getAttribute("data-shell-palette"),
          background: ground.backgroundColor,
          image: ground.backgroundImage,
          accent:
            accent === null ? "" : getComputedStyle(accent).backgroundColor,
        };
      }),
    );

    expect(previews.map((preview) => preview.palette)).toEqual([...PALETTES]);
    expect(
      previews
        .filter((preview) => preview.accent === "")
        .map((preview) => preview.palette),
      "these previews have no accent bar, so the card is not the two-bar preview the drawing draws",
    ).toEqual([]);

    // No preview shows the *live* palette's ground or accent while naming a
    // different one, which is the defect this test was written for.
    const live = previews.find((preview) => preview.palette === "graphite");
    const ground = (preview: (typeof previews)[number]): string =>
      `${preview.background}|${preview.image}`;
    const borrowed = previews.filter(
      (preview) =>
        preview.palette !== "graphite" &&
        live !== undefined &&
        (ground(preview) === ground(live) || preview.accent === live.accent),
    );
    expect(
      borrowed.map((preview) => preview.palette),
      "these previews are showing graphite, the palette in force, not their own",
    ).toEqual([]);

    // And all six are surfaces of their own, which is what the picker is for.
    // `ember`, `moss` and `plum` declared only an accent, so four of the six
    // were byte-identical cream — a computed-value assertion cannot see that as
    // wrong, because editorial's value is a legitimate value; only the eye
    // catches a picker offering four options that look alike. Hence this is the
    // assertion *and* the six screenshots beside it.
    const surfaces = previews.map(
      (preview) => `${ground(preview)}|${preview.accent}`,
    );
    expect(
      surfaces.filter((surface, i) => surfaces.indexOf(surface) !== i),
      "two palettes render the same preview, so the picker offers a duplicate",
    ).toEqual([]);
    // The accent bar is what the chip's own ring used to be for: `--accent` is
    // the one colour each palette is named by, so two palettes sharing one is a
    // picker offering a duplicate even where their grounds differ.
    const accents = previews.map((preview) => preview.accent);
    expect(
      accents.filter((accent, i) => accents.indexOf(accent) !== i),
      "two palettes render the same accent",
    ).toEqual([]);

    await page.keyboard.press("Escape");
  });

  /** A utility resolves the palette of the SUBTREE it is written in.
   *
   *  Injected rather than written into a component: the shell has no
   *  `bg-shell-surface` yet, and this is the property that decides whether the
   *  first one is safe to write. The probe goes inside the ember preview bar
   *  while graphite is in force, which is the exact case a non-inline `@theme`
   *  loses — it compiles to `var(--color-shell-surface)`, resolved at `:root`,
   *  so the bar's own declaration is never consulted. */
  test("a shell colour utility resolves the palette of its own subtree", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await openEditor(page);
    await choosePalette(page, "graphite");
    const dialog = await openAppearance(page);

    const [inside, declared, live] = await dialog.evaluate((node) => {
      const ember = node.querySelector<HTMLElement>(
        '[data-shell-palette="ember"]',
      );
      // A missing bar would leave the probe detached, where `getComputedStyle`
      // answers "" for everything and the comparison below passes vacuously.
      // Fail loudly instead.
      if (ember === null) {
        throw new Error("no ember preview bar in the palette popup");
      }
      const probe = document.createElement("span");
      probe.className = "bg-shell-surface";
      ember.appendChild(probe);
      /** The reference is a second element in the same subtree painted from the
       *  same token by a plain declaration. It used to be the bar's own
       *  background, which stopped being the token this probe is about when the
       *  bar took the palette's ground (plan 8 Task 5) — a comparison against
       *  the bar would now hold the utility to the wrong role. */
      const reference = document.createElement("span");
      reference.style.background = "var(--shell-surface)";
      ember.appendChild(reference);
      const header = document.querySelector(".editor-shell-header");
      return [
        getComputedStyle(probe).backgroundColor,
        getComputedStyle(reference).backgroundColor,
        header === null ? "" : getComputedStyle(header).backgroundColor,
      ];
    });

    expect(
      inside,
      "the utility did not resolve the palette of its own subtree",
    ).toBe(declared);
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
      "text-xs": { "font-size": "11px", "line-height": "14.3px" },
      "text-sm": { "font-size": "12px", "line-height": "16.8px" },
      "rounded-sm": { "border-radius": "4px" },
      "rounded-md": { "border-radius": "6px" },
    });
    expect(probe.theme).toEqual({
      // `.25rem`, not `0.25rem`: the bundle is minified, and this reads what
      // the browser resolved rather than what the source says.
      "--spacing": ".25rem",
      "--text-md": "13px",
      "--radius-lg": "8px",
      "--shadow-raised": "0 12px 28px #0000003d",
      "--shadow-overlay": "0 18px 44px #0006",
    });
  });

  /** The one treatment boundary: chrome is flat and opaque, and a floating
   *  cluster over the canvas is glass.
   *
   *  **This assertion changed shape, deliberately** (plan 7 Task 5), and the shape
   *  it had is why it is named here rather than quietly rewritten. It read
   *  "editorial is flat and the other five are glass" — three facts about
   *  `editorial` written as one assertion, and a `flat` that described a whole
   *  *palette* rather than an element. §3 draws the boundary between elements and
   *  not between palettes: elevation 0 is the chrome (no shadow, a 1px `--edge`
   *  hairline) and elevation 1 is "floating clusters over the canvas", which blur
   *  their backdrop and are never fully opaque. Task 5 moved the gradient and the
   *  blur onto the clusters by name and gave the chrome the palette's own
   *  `--panel`, so the palette split this test used to assert is exactly what was
   *  removed — `editorial`'s clusters are glass now, as every palette's are.
   *
   *  Both halves are read as a **set, not a sample** (review round 1): a boundary
   *  stated per element is not held by one element a side, and the two surfaces
   *  that were missing from the first reading — the status bar and two of the
   *  three clusters — are exactly where a regression could have hidden. On the
   *  built bundle, in all six palettes:
   *
   *  - **chrome** — every surface that declares its own fill: the rail, the pane,
   *    the inspector, and §3's two elevation-0 strips, the header and the status
   *    bar. Each paints the palette's own `--panel` and nothing on top of it, so
   *    the **whole colour** it renders equals the fill that token declares — not
   *    only its alpha, because a hover-tint or a second surface under the same
   *    alpha is what "paints `--panel`" is meant to rule out — and it carries no
   *    gradient, no blur and no shadow.
   *  - a **floating cluster** — §7.5's three: the dock, the view cluster and the
   *    identity chip. Each is translucent and lifted. The two that carry
   *    `editor-glass` also carry the sheen; the chip declares its fill, blur,
   *    hairline and `--elev-1` in its own rule and no gradient, so the gradient is
   *    asserted on those two — §7.5's cluster contract is the `--radius-xl`, the
   *    ~95% fill and the blur, and the sheen is the shared class's.
   *
   *  The cluster's `backdrop-filter` cannot be one of them, and the reason is
   *  measured rather than assumed: the built stylesheet carries only the prefixed
   *  `-webkit-backdrop-filter`, this Chromium does not support that form, and so
   *  every glass element computes `backdropFilter: none` under every palette —
   *  which is what the assertion this replaced already recorded when it chose
   *  `box-shadow` over `backdrop-filter` as its discriminator. The dead blur is
   *  `vg-311`'s finding; asserting it here would pass for the wrong reason. */
  test("chrome is flat and opaque, and the canvas clusters keep the glass", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await openEditor(page);

    const CHROME = [
      ".editor-shell-rail",
      ".editor-shell-panel",
      ".editor-shell-inspector",
      ".editor-shell-header",
      ".editor-shell-status",
    ];
    const GLASS_CLUSTERS = [".editor-shell-dock", ".editor-shell-zoom"];
    const CLUSTERS = [...GLASS_CLUSTERS, ".editor-shell-identity"];

    const read = (selector: string) =>
      page.evaluate((sel) => {
        const node = document.querySelector(sel);
        if (node === null) throw new Error(`no element matches \`${sel}\``);
        const style = getComputedStyle(node);
        return {
          background: style.backgroundColor,
          image: style.backgroundImage,
          blur: style.backdropFilter,
          shadow: style.boxShadow,
        };
      }, selector);

    /** The **whole rendered fill** the palette's own chrome declares. `--panel`
     *  is what every chrome surface paints, so this is what a rendered chrome
     *  background is held against — through a probe element rather than the
     *  token's text, so a fill in any form this browser serialises reads the
     *  same way. Read as the colour and not only its alpha: the boundary is that
     *  the chrome paints `--panel` and **nothing over it**, and a surface
     *  painting `var(--shell-backdrop)` — a different colour that can carry the
     *  same alpha — kept an alpha-only reading green. */
    const declaredFill = async (): Promise<string | null> => {
      const declared = await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = "var(--panel)";
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      });
      return declared.trim() === "" ? null : declared;
    };

    const failures: string[] = [];
    for (const palette of PALETTES) {
      await choosePalette(page, palette);
      const exempt = CHROME_NOT_YET_OPAQUE.has(palette);
      const fill = await declaredFill();
      const declared = fill === null ? null : backgroundAlpha(fill);

      // The exemption is a value, not a direction: a palette still listed whose
      // fill now declares opaque is a stale row, and one that declares less than
      // opaque without being listed is a new gap. Either way the set and the
      // declarations disagree.
      if (declared === null || exempt !== declared < 1) {
        failures.push(
          `${palette}: its \`--panel\` declares alpha ${
            declared ?? "a form this assertion cannot read"
          }, and CHROME_NOT_YET_OPAQUE ${
            exempt ? "lists it" : "does not list it"
          } — the exemption and the declaration disagree (vg-310)`,
        );
      }

      for (const selector of CHROME) {
        const chrome = await read(selector);
        const alpha = backgroundAlpha(chrome.background);
        if (alpha === null || fill === null) {
          failures.push(
            `${palette} ${selector}: its background reads "${chrome.background}", which this assertion cannot read against the palette's own fill`,
          );
        } else if (chrome.background !== fill) {
          failures.push(
            `${palette} ${selector}: its background is ${chrome.background}, and the chrome paints the palette's own \`--panel\` (${fill}) and nothing over it`,
          );
        }
        if (chrome.image !== "none") {
          failures.push(
            `${palette} ${selector}: the chrome carries a gradient (${chrome.image}) — the sheen is the cluster's, per §3's elevation 1`,
          );
        }
        if (chrome.blur !== "none") {
          failures.push(
            `${palette} ${selector}: the chrome blurs its backdrop (${chrome.blur})`,
          );
        }
        if (chrome.shadow !== "none") {
          failures.push(
            `${palette} ${selector}: the chrome carries a shadow (${chrome.shadow}) — elevation 0 is flat`,
          );
        }
      }

      for (const selector of CLUSTERS) {
        const cluster = await read(selector);
        const clusterAlpha = backgroundAlpha(cluster.background);
        if (clusterAlpha === null || clusterAlpha >= 1) {
          failures.push(
            `${palette} ${selector}: the cluster's fill is ${cluster.background}, and §3 has a floating cluster never fully opaque`,
          );
        }
        if (cluster.image === "none" && GLASS_CLUSTERS.includes(selector)) {
          failures.push(
            `${palette} ${selector}: the cluster carries no glass gradient`,
          );
        }
        if (cluster.shadow === "none") {
          failures.push(
            `${palette} ${selector}: the cluster has no elevation shadow, so it does not read as lifted over the canvas`,
          );
        }
      }
    }

    expect(
      failures,
      "the treatment boundary — chrome flat and opaque, a floating cluster glass — does not hold",
    ).toEqual([]);
  });

  test("a fresh profile with no stored palette renders light", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    // With no emulation Playwright's `colorScheme` is light, so the shell
    // resolves `light`. The assertion exists because moving the `--vigilia-*`
    // block onto `:root` could have broken the fresh-profile first paint: a
    // base that carries neither the resolved palette's values nor the
    // attribute renders the wrong palette before anything applies. Each test
    // gets its own storage, so this one arrives with nothing stored and only
    // this one depends on that.
    await openEditor(page);

    await expect(page.locator("html")).toHaveAttribute(
      "data-shell-palette",
      "light",
    );
    // And the tab agrees with the attribute rather than holding a default of
    // its own: the row that reads as chosen is the one the shell applied.
    const dialog = await openAppearance(page);
    await expect(
      dialog.getByRole("radio", { name: "light", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");

    const colours = await shellColours(page);
    expect(colours.header).not.toBe("rgba(0, 0, 0, 0)");
  });

  /** The frame **before** React writes the palette attribute (`vg-351`).
   *
   *  Every other assertion in this file reads `data-shell-palette`, which is
   *  exactly why none of them could see this: the attribute *is* the settled
   *  state, and the defect lives in the frame before it exists. Two base paints
   *  disagreed with `systemShellPalette` there — the stylesheet's bare `:root`
   *  block resolved editorial, and this document's own pre-shell `<style>` drew
   *  editorial cream with a `#0b1419` under its dark media query that matched no
   *  palette in the set — so a fresh profile flashed cream and then snapped to
   *  graphite.
   *
   *  The bundle is blocked rather than raced: with no script the attribute is
   *  never written, so what is measured is the pre-JS frame by construction
   *  rather than by timing. The expected value is read out of the stylesheet's
   *  own palette block through a probe carrying the attribute, so no colour is
   *  copied into this file — what is named here is the palette
   *  `systemShellPalette` picks, which `palette.ts` owns. */
  test("the frame before the palette attribute is the palette the OS resolves", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    // Both halves of the first frame are read: the document's own pre-shell
    // style, and the stylesheet's base block. `#app` stays empty without the
    // bundle, so the body is the surface that paints.
    await page.route("**/*.js", (route) => route.abort());

    for (const [colorScheme, palette] of [
      ["light", "light"],
      ["dark", "graphite"],
    ] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto(EDITOR);

      const frame = await page.evaluate((named) => {
        const painted = (element: Element): string => {
          const style = getComputedStyle(element);
          return `${style.backgroundColor} ${style.backgroundImage} ${style.color}`;
        };
        const token = (element: Element, name: string): string =>
          getComputedStyle(element).getPropertyValue(name).trim();
        const reading = (element: Element): string =>
          `${painted(element)} | ${token(element, "--shell-backdrop")} ${token(element, "--shell-text")}`;

        const probe = document.createElement("div");
        probe.setAttribute("data-shell-palette", named);
        probe.style.background = "var(--shell-backdrop)";
        probe.style.color = "var(--shell-text)";
        document.documentElement.append(probe);
        const wanted = reading(probe);
        probe.remove();

        return {
          attribute:
            document.documentElement.getAttribute("data-shell-palette"),
          wanted,
          base: reading(document.body),
        };
      }, palette);

      expect(
        frame.attribute,
        "the bundle ran, so this measured the settled frame and not the one before it",
      ).toBeNull();
      expect(
        frame.base,
        `a ${colorScheme}-reporting OS paints its first frame in a palette ` +
          "systemShellPalette does not name",
      ).toBe(frame.wanted);
    }
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
      "light",
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
      // The modal hands focus back to the gear when it closes, so the gear's
      // tooltip is open over the rail's foot — a popup left by how the frame was
      // driven, and the same artefact `editor-shell-add` parks the pointer to
      // avoid. The gear and the tooltip are the shell's; it is the palette the
      // capture is of.
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
      const stage = await page.locator(".editor-shell-stage").boundingBox();
      if (stage !== null) {
        await page.mouse.move(
          stage.x + stage.width / 2,
          stage.y + stage.height / 2,
        );
      }
      await captureVisualReview(page, testInfo, `shell-palette-${palette}`);
    }
  });
});

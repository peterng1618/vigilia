import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shellPalettes } from "./palette.js";

const css = readFileSync(
  fileURLToPath(new URL("./editor-shell.css", import.meta.url)),
  "utf8",
);

/** The `:root { ... }` blocks, each with its body and where it starts.
 *
 *  A whole-CSS parser would be a dependency bought to read a file its author
 *  reads by eye, and nothing here needs more: the token blocks are flat, and a
 *  `[^}]*` body stops at the block's own close. The anchor is a line that holds
 *  nothing but `:root`, so `:root:not(...)` and `.foo :root` — which do not
 *  declare anything unconditionally — do not match. */
function rootBlocks(): readonly { body: string; at: number }[] {
  return [...css.matchAll(/^[ \t]*:root[ \t]*\{([^}]*)\}/gm)].map((match) => ({
    body: match[1] ?? "",
    at: match.index ?? 0,
  }));
}

/** Every custom property the given blocks declare. The capture group is
 *  guaranteed by the pattern, so it is unwrapped rather than defaulted — an
 *  empty string in the set would satisfy the check it feeds. */
function declared(blocks: readonly { body: string }[]): Set<string> {
  return new Set(
    blocks.flatMap((block) =>
      [...block.body.matchAll(/(--[a-z-]+)\s*:/g)].flatMap((match) =>
        match[1] === undefined ? [] : [match[1]],
      ),
    ),
  );
}

/** The body of the `@theme` block, or `""` if there is none.
 *
 *  Tailwind reads this at build time rather than serving it as a rule, so it
 *  never appears in the output the browser sees — which is exactly why a scale
 *  that lives *only* here is invisible to the cascade tests and has to be
 *  checked in the source. */
function themeBody(): string {
  return /^[ \t]*@theme[ \t]+static[ \t]*\{([^}]*)\}/m.exec(css)?.[1] ?? "";
}

/** Where the graphite palette's *declaration block* starts.
 *
 *  `[data-shell-palette="graphite"]` occurs four times — the block and the
 *  three glass selector lists — so `indexOf` on the bare attribute anchored
 *  this on whichever came first in the file, and a comment mentioning it above
 *  the palettes would have moved the anchor without changing a thing. The
 *  trailing `{` is the structural part: only a selector *list* that ends the
 *  palette block is followed by one. */
function graphiteBlockAt(): number {
  return css.indexOf('[data-shell-palette="graphite"] {');
}

describe("shell token stylesheet", () => {
  /** The defect this exists to prevent.
   *
   *  A `var(--vigilia-x)` naming a token no declaration in scope provides is
   *  invalid at computed-value time: the declaration using it is dropped whole
   *  rather than falling back. That is invisible in review and in jsdom — jsdom
   *  does not resolve custom properties, so a jsdom assertion would pass
   *  whatever the cascade does. The browser half is
   *  `tests/e2e/shell-appearance.spec.ts`; this half checks only that no
   *  reference can resolve to a single palette's declaration. */
  it("declares every referenced --vigilia-* token on :root", () => {
    const onRoot = declared(rootBlocks());
    const referenced = [...css.matchAll(/var\((--vigilia-[a-z-]+)/g)].flatMap(
      (match) => (match[1] === undefined ? [] : [match[1]]),
    );

    expect(referenced.length).toBeGreaterThan(0);
    expect(
      [...new Set(referenced)].filter((token) => !onRoot.has(token)),
      "these resolve to nothing under the palettes they are not declared for, " +
        "which drops the whole declaration using them",
    ).toEqual([]);
  });

  /** The palette attribute is on `documentElement` now, so `:root` and
   *  `[data-shell-palette="x"]` are the same node and the cascade picks between
   *  them by source order alone. A base block written *after* a palette block
   *  therefore silently wins — which is what happened the first time:
   *  `--vigilia-control-bg` sat below the palettes, so graphite's dark control
   *  surface never applied and the shell stayed editorial cream. */
  it("puts the :root control tokens before the palette blocks overriding them", () => {
    const base = rootBlocks().find((block) =>
      block.body.includes("--vigilia-control-bg"),
    );
    expect(base, "no :root block declares --vigilia-control-bg").toBeDefined();
    expect(
      base?.at ?? Number.MAX_SAFE_INTEGER,
      "the :root control block must precede the palette blocks, or the base wins",
    ).toBeLessThan(graphiteBlockAt());
  });

  /** Choosing a palette the stylesheet does not name leaves the shell on
   *  whichever block happens to match. */
  it("gives every palette in palette.ts a block", () => {
    for (const palette of shellPalettes) {
      expect(css).toContain(`[data-shell-palette="${palette}"]`);
    }
  });

  /** A chip names a palette it is not necessarily rendering under, so without
   *  a declaration of its own it inherits the live palette's tokens — an ember
   *  chip under graphite painted graphite's dark glass behind an ember ring.
   *  The swatch joins the token baseline so it cannot. */
  it("scopes the swatch into the token baseline", () => {
    expect(css).toMatch(
      /:root,\s*\[data-shell-palette="editorial"\],\s*\.editor-shell-palette-swatch\s*\{/,
    );
  });

  /** The scale, on `:root`, silently overrode Tailwind's own theme.
   *
   *  `--text-sm`, `--text-xs` and `--radius-md` are `@theme` names, and
   *  Tailwind emits its defaults into `@layer theme`. An *unlayered* `:root`
   *  beats a layered rule whatever its specificity, so the values shipped by
   *  accident: `text-sm` went 14px → 12px, `rounded-md` 6px → 8px, with no
   *  error anywhere and nothing to read in the browser console. Declaring
   *  them in `@theme` states the same intent in the layer that owns it. */
  it("declares the scale in @theme, where it cannot outrank the utilities it renames", () => {
    const onRoot = [...declared(rootBlocks())];
    for (const token of [
      "--spacing",
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--text-xs",
      "--text-sm",
      "--text-md",
      "--shadow-raised",
      "--shadow-overlay",
    ]) {
      expect(
        onRoot,
        `${token} is declared on :root, which beats @layer theme whatever its ` +
          "specificity — the scale must be an override in @theme",
      ).not.toContain(token);
    }
    expect(
      themeBody(),
      "the scale is not in a @theme block, so Tailwind is not reading it at all",
    ).not.toBe("");
  });

  /** The values themselves, asserted rather than merely present.
   *
   *  These are the editor's existing density — 11/12/13px and an 8px radius
   *  are what the shell's own stylesheet uses throughout — and aligning
   *  Tailwind's utilities with the chrome is the point. Asserting only that a
   *  token exists would let a change to `text-sm` land as a silent shift;
   *  asserting the value makes it an edit somebody has to make here too. The
   *  resolved result is measured in a real browser by
   *  `tests/e2e/shell-appearance.spec.ts`; jsdom resolves nothing. */
  it("pins the scale to the editor's density", () => {
    const theme = themeBody();
    expect(theme, "no `@theme static` block declares the scale").not.toBe("");

    const values = new Map(
      [...theme.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)].flatMap((match) =>
        match[1] === undefined || match[2] === undefined
          ? []
          : [[match[1], match[2].trim()]],
      ),
    );
    expect(Object.fromEntries(values)).toMatchObject({
      "--spacing": "0.25rem",
      "--radius-sm": "4px",
      "--radius-md": "8px",
      "--radius-lg": "12px",
      "--text-xs": "11px",
      "--text-sm": "12px",
      "--text-md": "13px",
      "--text-xs--line-height": "1.25",
      "--text-sm--line-height": "1.25",
      "--text-md--line-height": "1.25",
      "--shadow-raised": "0 12px 28px #0000003d",
      "--shadow-overlay": "0 18px 44px #0006",
    });

    // Tailwind writes each `--text-*` companion for its own size — `--text-sm`
    // ships `calc(1.25 / .875)`, computed for 14px — so a size changed without
    // its companion inherits a ratio belonging to a size the token no longer
    // has. 1.25 is this chrome's density; every size states it.
    for (const size of ["xs", "sm", "md"]) {
      expect(
        values.get(`--text-${size}--line-height`),
        `--text-${size} has no line-height of its own, so it inherits a ratio ` +
          "computed for a size it no longer is",
      ).toBe("1.25");
    }
  });

  /** `static`, because Tailwind drops a theme variable no utility references.
   *
   *  `--text-md`, `--radius-lg` and both elevations are used by nothing yet.
   *  Without `static` they were emitted nowhere — measured in the built bundle,
   *  where only `--spacing`, `--radius-sm|md` and `--text-xs|sm` survived —
   *  which is the same resolves-to-nothing defect the `--vigilia-*` block had,
   *  arrived at through the door that was supposed to fix it. */
  it("keeps the unreferenced scale tokens in the bundle", () => {
    expect(css).toMatch(/^[ \t]*@theme[ \t]+static[ \t]*\{/m);
  });

  /** A utility compiled from the palette must resolve at the ELEMENT.
   *
   *  `@theme` compiles `.bg-shell-surface` to `var(--color-shell-surface)`,
   *  which the browser looks up from `:root` — losing the one subtree that
   *  re-declares the token, the swatch that names a palette it is not rendering
   *  under, which `shell-appearance.spec.ts` already holds as a contract.
   *  `inline` compiles it to `var(--shell-surface)` and the lookup happens where
   *  the utility is written. jsdom resolves no custom properties, so this half
   *  can only check that the block is the right KIND; the resolution is
   *  measured in a browser, by `shell-appearance.spec.ts`. */
  it("gives every shell colour token a name in @theme inline", () => {
    const inline =
      /^[ \t]*@theme[ \t]+inline[ \t]*\{([^}]*)\}/m.exec(css)?.[1] ?? "";
    expect(inline, "the palette is not in an @theme inline block").not.toBe("");

    // **Two tokens are not colours, and a `--color-*` name for either would
    // compile a broken utility** — Tailwind's namespaces are per type, so a
    // font stack belongs in `--font-*` and a bare number belongs in none.
    // Measured: the file declares thirteen `--shell-*` tokens and eleven of
    // them are colours, which the count below pins so this exclusion cannot
    // quietly grow to swallow one.
    const NOT_A_COLOUR = new Set(["--shell-display", "--shell-flat"]);
    const declared = [...css.matchAll(/^\s*(--shell-[a-z-]+)\s*:/gm)].map(
      (match) => match[1] ?? "",
    );
    const colours = [...new Set(declared)].filter(
      (token) => !NOT_A_COLOUR.has(token),
    );
    expect(colours, "the exclusion set is hiding a colour").toHaveLength(11);

    for (const token of colours) {
      expect(
        inline,
        `${token} has no utility name, so nothing can read it as a Tailwind colour`,
      ).toContain(
        `${token.replace("--shell-", "--color-shell-")}: var(${token})`,
      );
    }
  });
});

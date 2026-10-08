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
   *  `docs/design/design-language.md` §2–§3 is normative for these, and these
   *  are the values it names. Asserting only that a token exists would let a
   *  change to `text-sm` land as a silent shift — which is how `--radius-md` sat
   *  at 8px against the bible's 6px with nothing to catch it; asserting the
   *  value makes it an edit somebody has to make here too. The resolved result
   *  is measured in a real browser by `tests/e2e/shell-appearance.spec.ts`;
   *  jsdom resolves nothing. */
  it("pins the scale to the design language", () => {
    const theme = themeBody();
    expect(theme, "no `@theme static` block declares the scale").not.toBe("");

    // Digits are part of the name: `--text-2xs--line-height` was read as
    // `--line-height` by a `[a-z-]+` pattern, so its value was never seen.
    const values = new Map(
      [...theme.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].flatMap((match) =>
        match[1] === undefined || match[2] === undefined
          ? []
          : [[match[1], match[2].trim()]],
      ),
    );
    expect(Object.fromEntries(values)).toMatchObject({
      "--spacing": "0.25rem",
      "--radius-sm": "4px",
      "--radius-md": "6px",
      "--radius-lg": "8px",
      "--text-xs": "11px",
      "--text-sm": "12px",
      "--text-md": "13px",
      "--shadow-raised": "0 12px 28px #0000003d",
      "--shadow-overlay": "0 18px 44px #0006",
    });

    // Tailwind writes each `--text-*` companion for its own size — `--text-sm`
    // ships `calc(1.25 / .875)`, computed for 14px — so a size changed without
    // its companion inherits a ratio belonging to a size the token no longer
    // has. These are bible §2's ratios; every size states its own.
    for (const [size, lineHeight] of [
      ["2xs", "1.2"],
      ["xs", "1.3"],
      ["sm", "1.4"],
      ["md", "1.3"],
      ["lg", "1.3"],
      ["xl", "1.2"],
    ]) {
      expect(
        values.get(`--text-${size}--line-height`),
        `--text-${size} has no line-height of its own, so it inherits a ratio ` +
          "computed for a size it no longer is",
      ).toBe(lineHeight);
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

  /** Bible §4's role vocabulary is what a *surface* writes, and today only the
   *  `--shell-*` layer exists. An alias is substituted where it is declared, so
   *  a role declared once at `:root` would resolve the root's palette and pin a
   *  subtree that re-declares `--shell-*` — the swatch chip — to it. Every
   *  palette therefore declares all thirteen, and each colour role that can hold
   *  a plain colour gets a utility name so a React surface writes `bg-panel-2`
   *  rather than an arbitrary value; `--bg` and `--stage` cannot, and say why
   *  below.
   *
   *  `--stage`, `--hdr` and `--edge-2` were declared ahead of their consumers
   *  on the user's instruction, reversing the earlier "nothing declared for
   *  nothing" ruling recorded here: §4 names all thirteen roles, and the gap
   *  was the detail pass every later plan composes from. A colour declared for
   *  nothing is still the defect this plan exists to remove — the reversal is
   *  the user's, and the three now have a named consumer path. */
  it("declares every §4 colour role in every palette block", () => {
    const roles = [
      "--bg",
      "--stage",
      "--hdr",
      "--panel",
      "--panel-2",
      "--edge",
      "--edge-2",
      "--text",
      "--muted",
      "--faint",
      "--accent",
      "--warn",
      "--hot",
    ];
    const declarationBlock = (palette: string): string => {
      const at = css.indexOf(`[data-shell-palette="${palette}"] {`);
      // Editorial has no block of its own: it is the shared baseline, which the
      // swatch chip joins so a chip can render a palette it is not under.
      const from =
        at === -1 ? css.indexOf(".editor-shell-palette-swatch {") : at;
      return from === -1 ? "" : css.slice(from, css.indexOf("}", from));
    };

    for (const palette of shellPalettes) {
      const body = declarationBlock(palette);
      expect(body, `no declaration block found for ${palette}`).not.toBe("");
      for (const role of roles) {
        expect(
          body,
          `${palette} does not declare ${role}, so it resolves to whatever ` +
            "the root happened to hold where the alias was written",
        ).toContain(`${role}:`);
      }
    }

    const inline =
      /^[ \t]*@theme[ \t]+inline[ \t]*\{([^}]*)\}/m.exec(css)?.[1] ?? "";
    // `--bg` and `--stage` are the two roles with no utility: both alias
    // `--shell-backdrop`, which is a gradient stack in graphite and light, and a
    // colour utility from either would set a colour to that and fail silently.
    // Both roles are still declared and asserted above; only the utility name
    // would be wrong. `--hdr` aliases `--shell-surface`, a plain colour (alpha
    // at most) in all six palettes, so its utility is safe.
    const noUtility = new Set(["--bg", "--stage"]);
    for (const role of roles.filter((role) => !noUtility.has(role))) {
      expect(
        inline,
        `${role} has no utility name, so a surface cannot write it as a class`,
      ).toContain(`--color-${role.slice(2)}: var(${role})`);
    }
    for (const role of noUtility) {
      expect(
        inline,
        `a colour utility from ${role} would set a colour to a gradient stack`,
      ).not.toContain(`--color-${role.slice(2)}:`);
    }
  });
});

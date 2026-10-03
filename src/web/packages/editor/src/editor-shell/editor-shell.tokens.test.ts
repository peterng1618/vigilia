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
    const referenced = [
      ...css.matchAll(/var\((--vigilia-[a-z-]+)/g),
    ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));

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
    ).toBeLessThan(css.indexOf('[data-shell-palette="graphite"]'));
  });

  /** Choosing a palette the stylesheet does not name leaves the shell on
   *  whichever block happens to match. */
  it("gives every palette in palette.ts a block", () => {
    for (const palette of shellPalettes) {
      expect(css).toContain(`[data-shell-palette="${palette}"]`);
    }
  });

  /** `ember`, `moss` and `plum` override only the accent, so a chip naming one
   *  inherited the live palette's surface — graphite's dark glass behind a
   *  peach ring. The swatch joins the token baseline so it cannot. */
  it("scopes the swatch into the token baseline", () => {
    expect(css).toMatch(
      /:root,\s*\[data-shell-palette="editorial"\],\s*\.editor-shell-palette-swatch\s*\{/,
    );
  });
});

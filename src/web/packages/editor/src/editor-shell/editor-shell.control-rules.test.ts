import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The stylesheet's *rules*, read as text.
 *
 *  `editor-shell.tokens.test.ts` reads the token blocks; this file reads the
 *  two rules `scripts/design-tokens.mjs` is blind to, because it scans literals
 *  and both of these are semantic. A style change is a rendered outcome, and the
 *  rendered half is the browser: this is the half that reddens in `vitest` when
 *  a rule is reverted, so a fix cannot quietly go back.
 *
 *  The regex is anchored at a line start so a selector *list* that merely
 *  contains the name — the dock's glass pair, the palette swatch — does not
 *  answer for the rule itself. */
const css = readFileSync(
  fileURLToPath(new URL("./editor-shell.css", import.meta.url)),
  "utf8",
);

/** Every declaration body written under `selector`, joined in document order.
 *
 *  Joined rather than first-match because a control's shape can be split across
 *  rules: `.editor-shell-dock button` takes its fill in one rule and its 1px
 *  resting border with the 26px square in another. */
function ruleBodies(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bodies = [
    ...css.matchAll(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "gm")),
  ].map((match) => match[1] ?? "");
  return bodies.join("\n");
}

/** §5 rule 6's second clause: "On a glyph-only control with no resting border —
 *  the icon button — it is the border it acquires on hover. Nothing moves,
 *  nothing scales." A wash is what the rule forbids here. */
const GLYPH_ONLY = [
  ".editor-shell-rail button",
  ".vigilia-layer-row button",
  ".editor-shell-dock button",
  ".editor-shell-view-step",
] as const;

describe("§5 rule 6 on the shell's glyph-only controls", () => {
  for (const selector of GLYPH_ONLY) {
    it(`${selector} acquires --muted on hover and nothing else moves`, () => {
      const resting = ruleBodies(selector);
      expect(resting, `${selector} has no rule`).not.toBe("");
      expect(
        resting,
        `${selector} has no resting 1px transparent border, so acquiring one ` +
          "on hover would move the box",
      ).toContain("border: 1px solid transparent");

      const hover = ruleBodies(`${selector}:hover`);
      expect(hover, `${selector}:hover has no rule`).not.toBe("");
      expect(
        hover,
        `${selector}:hover does not raise the acquired border to --muted`,
      ).toContain("border-color: var(--muted)");
      expect(
        hover,
        `${selector}:hover washes its background where §5 rule 6 asks for the ` +
          "border the control acquires",
      ).not.toContain("background");
    });
  }

  /** "Nothing moves" is not in the two declarations above: it holds because the
   *  acquired 1px border lands *inside* the box. Two of these rules say
   *  `box-sizing: border-box` for themselves; the rail's slot and the layer
   *  row's square rely on the global rule, which nothing else pins — without it
   *  the 34px slot and the 20px square grow by 2px on hover and every case above
   *  stays green. */
  it("puts every box on border-box, so the acquired border does not grow it", () => {
    expect(
      css,
      "the global `*, *::before, *::after` rule no longer sets border-box, so a " +
        "control that acquires its 1px hover border grows by 2px instead",
    ).toMatch(
      /^\*,\s*\n\s*\*::before,\s*\n\s*\*::after\s*\{\s*\n\s*box-sizing:\s*border-box;/m,
    );
  });
});

/** §2 gives list rows `--text-sm`. A dialog is portalled, so a body that
 *  declares no role inherits the host document's base and lands on a §2 step by
 *  accident — `vg-317`: the `?` sheet's rows read `--text-md` because
 *  `index.html` said 13px, not because any rule of the dialog's chose it. */
describe("§2's role on a dialog's own body", () => {
  it("declares the list-row role rather than inheriting the portal's base", () => {
    expect(
      ruleBodies(".editor-shell-dialog"),
      "`.editor-shell-dialog` declares no font-size, so every surface inside it " +
        "that declares none of its own inherits the portalled document's",
    ).toContain("font-size: var(--text-sm)");
  });
});

/** §4's destructive mark, painted by one rule that reaches every surface.
 *
 *  `vg-226`'s complaint was that Delete was `--hot` in the dock and ordinary in
 *  the layer footer and the canvas context menu. The colour is painted by the
 *  shared `data-vigilia-destructive` the registry's `destructiveMarker` puts on
 *  each control, and the failure it replaced was a **surface-scoped** rule:
 *  `.editor-shell-dock button[data-vigilia-destructive]` cannot reach a popup
 *  Base UI portals to `body`, so the menu's Delete kept its inherited colour.
 *
 *  A text read rather than a rendered one on purpose: jsdom has no cascade, so a
 *  DOM assertion could only ever prove the string it wrote. This is the half that
 *  reddens in `vitest` when the rule is reverted; the rendered half is the
 *  browser. */
/** The stylesheet without its comments, for the two reads below that look for a
 *  *declaration*: a comment that explains why a declaration is gone
 *  (`color: inherit`, the removed restatement) is text the same regexes would
 *  otherwise find and accuse. */
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("§4's destructive mark", () => {
  it("paints --hot from the shared marker, and from one rule that no surface scopes", () => {
    expect(
      ruleBodies("[data-vigilia-destructive]"),
      "no rule keys §4's `--hot` on the shared `data-vigilia-destructive`, so a " +
        "surface the bare selector cannot be beaten to — the portalled context " +
        "menu — paints its destructive action as ordinary text",
    ).toContain("color: var(--hot)");

    // One rule, not one per surface. A rule whose *selector* mentions the marker
    // is a rule that paints it; two of them is the owner violation `vg-226` was
    // filed for, one level down, whatever colours they name.
    const painters = [
      ...cssNoComments.matchAll(
        /^[^{}\n]*\[data-vigilia-destructive\][^{}\n]*\{/gm,
      ),
    ].map((match) => match[0]);
    expect(
      painters,
      "more than one rule paints the destructive mark",
    ).toHaveLength(1);
    expect(
      painters[0],
      "the destructive mark is still painted by a surface-scoped rule, so a " +
        "surface outside that scope — a portalled popup — is left ordinary",
    ).not.toMatch(/\.editor-shell-|\[role=/);

    // And nothing else declares a colour on a control that carries the mark. The
    // menu popup's items are the ones that did: a rule there outranks a bare
    // attribute at (0,2,0), which is exactly how the menu's Delete stayed
    // ordinary while carrying the mark.
    expect(
      cssNoComments,
      "the menu popup's item rule declares a colour again, so it outranks the " +
        "bare `[data-vigilia-destructive]` selector and the menu's Delete stops " +
        "painting §4's `--hot`",
    ).not.toMatch(/\.editor-shell-menu-popup\s+\[role="menuitem"\][^}]*color:/);
  });
});

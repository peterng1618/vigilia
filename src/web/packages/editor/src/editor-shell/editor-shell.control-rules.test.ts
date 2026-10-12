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

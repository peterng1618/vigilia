import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The editor stylesheet's own scales, read rather than restated.
 *
 * `@theme static` is where the design language declares the spacing, radius,
 * type and elevation values a surface may write, and it is the mirror
 * `scripts/design-md.mjs --sync` keeps against DESIGN.md's front matter. A spec
 * that expects one of those values reads it here, so the stylesheet stays the
 * value's single owner: a scale change moves the expectation with it, where a
 * hard-coded copy would keep asserting a value the bundle no longer resolves.
 *
 * This is a *reader*, not a gate — the source ratchet over these literals is
 * `scripts/design-tokens.mjs`, and it is the one that scans what a file writes.
 */

const CSS = readFileSync(
  fileURLToPath(
    new URL(
      "../../packages/editor/src/editor-shell/editor-shell.css",
      import.meta.url,
    ),
  ),
  "utf8",
);

/** The `@theme static` block's body, or `""` when there is none. Tailwind reads
 *  this at build time rather than serving it as a rule, so this is the only
 *  place the scales can be read from the source. */
function themeBody(): string {
  return /^[ \t]*@theme[ \t]+static[ \t]*\{([^}]*)\}/m.exec(CSS)?.[1] ?? "";
}

const DECLARED = new Map(
  [...themeBody().matchAll(/(--[a-z0-9-]+)[ \t]*:[ \t]*([^;]+);/g)].map(
    (match) => [match[1] ?? "", (match[2] ?? "").trim()],
  ),
);

/** One `@theme static` declaration's value. Throwing rather than returning `""`
 *  is deliberate: an absent token would make every expectation built on it
 *  compare against nothing and pass, which is the vacuous guard this reader
 *  replaces. */
export function themeToken(name: string): string {
  const value = DECLARED.get(name);
  if (value === undefined) {
    throw new Error(`editor-shell.css declares no ${name} in its @theme block`);
  }
  return value;
}

/** The shell's compact-viewport breakpoint, in px — the width below which
 *  `editor-shell.css` drops the panels. Read from the one `@media (max-width:
 *  …)` the stylesheet declares rather than restated, so a spec's skip reason
 *  moves with the rule that actually hides the panel. Throws where the
 *  stylesheet carries no such query, for the same reason `themeToken` does. */
export function compactViewportMaxPx(): number {
  const found = /@media[^{]*\(max-width:[ \t]*(\d+)px\)/.exec(CSS);
  if (found === null) {
    throw new Error(
      "editor-shell.css declares no (max-width: …px) media query",
    );
  }
  return Number(found[1]);
}

/** The px a stylesheet *rule* declares for a property — the owner a value has
 *  when no token names it: `.vigilia-layer-mark`'s `flex: 0 0 28px` mark slot,
 *  and the layer row's fourth `:has` arm's reserved `padding-right`. Found by
 *  the rule's own selector text, anchored at a line start so a longer selector
 *  sharing the prefix cannot match in its place. Throws when the rule or the
 *  declaration is absent, so a renamed selector reddens the spec that read it
 *  rather than resolving to nothing. */
export function rulePx(selector: string, property: string): number {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(`^[ \\t]*${escaped}[ \\t]*\\{([^}]*)\\}`, "m").exec(
    CSS,
  );
  if (rule === null) {
    throw new Error(`editor-shell.css declares no rule for ${selector}`);
  }
  const declaration = new RegExp(
    `(?:^|;)[ \\t]*${property}[ \\t]*:[^;]*`,
    "m",
  ).exec(rule[1] ?? "");
  if (declaration === null) {
    throw new Error(`${selector} declares no ${property}`);
  }
  const px = /(\d+(?:\.\d+)?)px/.exec(declaration[0]);
  if (px === null) {
    throw new Error(`${selector}'s ${property} carries no px length`);
  }
  return Number(px[1]);
}

/** A type step as the browser resolves it, in the shape a computed style
 *  reports it: the declared font size, and that size times the token's own
 *  unitless line-height companion. Rounded to two places because the product is
 *  computed in binary floating point by the browser too — `11 * 1.3` is
 *  `14.299999999999999` in JavaScript and `14.3px` in the cascade. */
export function typeStep(sizeToken: string): {
  "font-size": string;
  "line-height": string;
} {
  const fontSize = themeToken(sizeToken);
  const ratio = Number.parseFloat(themeToken(`${sizeToken}--line-height`));
  const px = Number.parseFloat(fontSize);
  return {
    "font-size": fontSize,
    "line-height": `${Math.round(px * ratio * 100) / 100}px`,
  };
}

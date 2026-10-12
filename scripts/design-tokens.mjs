#!/usr/bin/env node

/**
 * The ratchet that keeps the design language consumed.
 *
 * The scales in `editor-shell.css`'s `@theme static` block are the design
 * language; a surface that writes `padding: 7px` or `color: #ff0000` has gone
 * around them, and nothing fails — it just renders slightly wrong. This scans
 * the files listed in `design-tokens.gated.json` — the files already converted —
 * and refuses a literal that should have been a token. The list only grows, so
 * the repo never has to be green all at once.
 *
 * A second instrument covers the one large surface that is not on that list:
 * `CEILINGS` *records that file's whole residual set*, so it is green today and
 * any movement in it fails — a violation arriving, one leaving, or a swap of one
 * for another at the same size. It records the set rather than a count because a
 * count cannot see a swap, and it is a recording rather than a conversion: the
 * constant says why the path does not simply join the list above, and every entry
 * names the site it sits at, not just the text it holds.
 *
 * This is deliberately the *cheap* ratchet, and its second px tier is coarse in
 * a way that is documented rather than accidental: in a spacing property
 * DESIGN.md's §3 steps are enforced exactly, because the property is right there to
 * read, and everywhere else only the values DESIGN.md prints are allowed. The
 * real enforcement is the browser assertion in Task 4 — every gated element's
 * computed spacing on DESIGN.md's scale — which is what catches a `26px` in a
 * place this text scan cannot reason about.
 *
 * `node scripts/design-tokens.mjs --self-test` proves every rule still fires.
 * A guard that passes because it looked at nothing is the defect this file
 * exists to remove, so an empty gated list is a failure, not a pass.
 */

import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** DESIGN.md §3's named steps: the only spacing values a surface may write. */
const SPACING_STEPS = new Set([4, 6, 8, 10, 12, 14, 16, 20, 24, 32]);
/** Always allowed anywhere: `1px` is a hairline border, and `0` is no border at all. */
const ALWAYS_PX = new Set([0, 1]);

/**
 * A px here *is* a spacing decision, so it is held to §3's steps alone —
 * DESIGN.md's `26px` row rhythm is a density, not a gutter, and 26 is in no step.
 */
const SPACING_PROPERTY =
  /^(?:padding|margin|inset|translate)(?:-|$)|^(?:gap|row-gap|column-gap|top|right|bottom|left)$/;

/**
 * Tailwind's spacing utilities with an arbitrary length — `p-[26px]`,
 * `gap-x-[7px]`, `md:mt-[30px]`, and their negatives `-mt-[26px]`. In a `.tsx`
 * there is no declaration property to read, so the utility name is the signal
 * that the px is a spacing decision; these are held to §3's steps the way a
 * CSS spacing property is. Scoped to these names on purpose: `h-[26px]`,
 * `size-[24px]`, `translate-x-[10px]` and `min-w-[10rem]` are not spacing
 * properties and stay in tier 2. Longest name first so `px-`/`gap-x-` win over
 * `p-`/`gap-`, and the optional leading `-` covers a negative margin or inset.
 */
const TW_SPACING =
  /(?<![\w-])-?(?:px|py|pt|pb|pl|pr|p|mx|my|mt|mb|ml|mr|m|gap-x|gap-y|gap|space-x|space-y)-\[(\d+(?:\.\d+)?)px\](?![\w-])/g;

/**
 * A block whose whole selector list is one of these *defines* tokens, so its
 * literals are the values rather than a surface going around them. A rule that
 * merely mentions the attribute — `[data-shell-palette="x"] .chip`,
 * `:root:not([data-shell-palette="editorial"]) .editor-glass` — is a treatment
 * rule, and its hexes and px are violations like any other.
 */
const DEFINITION_SELECTOR =
  /^(?::root|\[data-shell-palette="[a-z-]+"\]|\.editor-shell-palette-swatch)$/;

/** Longest alternative first: a 6-digit match on an 8-digit literal would leave two hex digits behind. */
const HEX = /(?<![\w#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g;
const PX = /(?<![\w.])(\d+(?:\.\d+)?)px(?![\w-])/g;

const DEFAULT_GATED = "scripts/design-tokens.gated.json";
const ROOT = resolve(import.meta.dirname, "..");

/**
 * The ceiling over a file deliberately kept off the list above.
 * `editor-shell.css` defines the scales and holds dozens of residuals, so putting
 * it in `gated` would redden this gate at HEAD — a gate that starts red and stays
 * red is turned off (ADR-0040 `:12`). `max` is 0 and `exempt` records the file's
 * whole residual set, keyed on `site`, `text` and — where a rule writes one value
 * twice — `occurrence`. So the instrument is green today and *any* movement in
 * the set fails: a violation the record does not hold (arrival), and a recorded
 * one that no longer occurs (`dead`, departure). That is the shape `vg-327` asks
 * for: a count could not see a swap, because correcting one violation while
 * another arrives leaves the total unchanged.
 *
 * The consequence is deliberate and a maintainer has to know it: fixing one of
 * these violations reddens the gate until the record is updated in the same
 * commit. The record is the review point, not a number to stay under. A `max`
 * that is absent or not finite is treated as breached rather than compared,
 * because `NaN` is never greater than anything and a ceiling that cannot be
 * evaluated would otherwise be the one way this instrument silently stops being
 * able to fail.
 *
 * Three of the recorded entries are a different kind of thing and carry their
 * reasons: the values no §3 step can express — the shape the drawings gate uses
 * for `1px`/`2px`/`50%`. The rest are the file's existing off-scale px and hex
 * literals, recorded rather than justified: a rationale per entry would be 54
 * fabrications, and the reason they are permitted is the one stated here — this
 * file defines the scales and cannot be converted in one pass (`vg-274`).
 * `recordedAt` is the sha the set was taken at — `git diff <sha> -- <path>` shows
 * it — and one entry per line, in the checker's own order, is what re-recording
 * the set emits.
 */
export const CEILINGS = [
  {
    path: "src/web/packages/editor/src/editor-shell/editor-shell.css",
    max: 0,
    recordedAt: "f832ddd8",
    exempt: [
      { site: ".editor-shell-dock.editor-glass, .editor-shell-zoom.editor-glass", text: "#ffffff1f" },
      { site: ".editor-shell-dock.editor-glass, .editor-shell-zoom.editor-glass", text: "#ffffff05" },
      { site: ".editor-shell-dock.editor-glass, .editor-shell-zoom.editor-glass", text: "#020b0e18" },
      { site: ".editor-shell-dock.editor-glass, .editor-shell-zoom.editor-glass", text: "#ffffff4d" },
      { site: ".editor-shell-dock.editor-glass, .editor-shell-zoom.editor-glass", text: "#ffffff12" },
      { site: ".editor-shell-dock.editor-glass, .editor-shell-zoom.editor-glass", text: "18px" },
      { site: ".editor-shell-dock.editor-glass, .editor-shell-zoom.editor-glass", text: "40px" },
      { site: ".editor-shell-dock.editor-glass, .editor-shell-zoom.editor-glass", text: "#0000004a" },
      { site: ".editor-shell-header", text: "42px" },
      { site: ".editor-shell-publish-toggle", text: "padding: 7px" },
      { site: ".editor-shell-menubar", text: "gap: 2px" },
      { site: ".editor-shell-menubar button", text: "padding: 9px" },
      { site: ".editor-shell-menu-popup", text: "190px" },
      { site: ".editor-shell-menu-popup", text: "padding: 5px" },
      { site: '.editor-shell-menu-popup [role="menuitem"], .editor-shell-menu-popup [role="menuitemradio"]', text: 'padding: 9px' },
      { site: ".editor-shell-menu-label", text: "padding: 9px" },
      { site: ".editor-shell-menu-label", text: "padding: 3px" },
      { site: ".editor-shell-primary", text: "padding: 7px" },
      { site: ".editor-shell-rail button", text: "34px" },
      { site: ".editor-shell-rail button", text: "34px", occurrence: 1 },
      { site: '.editor-shell-rail button[aria-pressed="true"]::before', text: '2px' },
      { site: '.editor-shell-rail button[aria-pressed="true"]::before', text: '2px', occurrence: 1 },
      { site: ".editor-shell-panel fieldset", text: "padding: 2px" },
      { site: ".editor-shell-panel .vigilia-asset-preview", text: "120px" },
      { site: ".editor-shell-panel [data-vigilia-asset-import], .editor-shell-panel [data-vigilia-asset-replace], .editor-shell-panel [data-vigilia-asset-remove]", text: "margin: 3px" },
      { site: ".editor-shell-panel [data-vigilia-asset-import], .editor-shell-panel [data-vigilia-asset-replace], .editor-shell-panel [data-vigilia-asset-remove]", text: "margin: 3px", occurrence: 1 },
      { site: ".editor-shell-panel .vigilia-layer-rename", text: "margin: 3px" },
      { site: ".editor-shell-panel .vigilia-layer-rename", text: "margin: 3px", occurrence: 1 },
      { site: ".editor-shell-inspector [data-vigilia-run-add], .editor-shell-inspector [data-vigilia-run-remove], .editor-shell-inspector [data-vigilia-chart-binding-remove], .editor-shell-inspector [data-vigilia-crop], .editor-shell-inspector [data-vigilia-crop-aspect], .editor-shell-inspector [data-vigilia-crop-apply], .editor-shell-inspector [data-vigilia-crop-cancel], .editor-shell-inspector [data-vigilia-reveal-type-presets]", text: "margin: 3px" },
      { site: ".editor-shell-inspector [data-vigilia-run-add], .editor-shell-inspector [data-vigilia-run-remove], .editor-shell-inspector [data-vigilia-chart-binding-remove], .editor-shell-inspector [data-vigilia-crop], .editor-shell-inspector [data-vigilia-crop-aspect], .editor-shell-inspector [data-vigilia-crop-apply], .editor-shell-inspector [data-vigilia-crop-cancel], .editor-shell-inspector [data-vigilia-reveal-type-presets]", text: "margin: 3px", occurrence: 1 },
      { site: '.editor-shell :is( button, input, select, [tabindex]:not(:where([role="tabpanel"])) ):focus-visible', text: '2px' },
      { site: ".editor-shell-dialog", text: "720px" },
      { site: ".editor-shell-dialog", text: "340px" },
      { site: ".editor-shell-dialog", text: "560px" },
      { site: ".editor-shell-dialog dl > div", text: "padding: 3px" },
      { site: ".editor-shell-settings-tabs", text: "150px" },
      { site: ".editor-shell-settings-tab[data-active]", text: "2px" },
      { site: ".editor-shell-settings-tab:focus-visible", text: "2px" },
      { site: ".editor-shell-settings-tab:focus-visible", text: "2px", occurrence: 1 },
      { site: ".editor-shell-settings-panel:focus-visible", text: "2px" },
      { site: ".editor-shell-settings-panel:focus-visible", text: "2px", occurrence: 1 },
      { site: ".editor-shell-keyboard [data-armed]", text: "2px" },
      { site: ".editor-shell-keyboard [data-armed]", text: "2px", occurrence: 1 },
      { site: ".vigilia-field", text: "72px" },
      { site: ".vigilia-layer-dropline", text: "2px" },
      { site: ".vigilia-layer-mark", text: "28px" },
      { site: ".vigilia-layer-thumb", text: "18px" },
      { site: ".vigilia-layer-state", text: "right: 2px" },
      {
        site: ".vigilia-layer-row:has(.vigilia-layer-state button:nth-child(2)) .vigilia-layer-bound",
        text: "margin-right: 62px",
        reason: "the layer row's reserved slot for two controls — `6 + 26*2 + 4` (§3's 26px row rhythm plus its 6px and 4px steps) — so the sum is off §3's step table by construction, and correcting it to a step would move the reserved width and let the icons cover the key again",
      },
      {
        site: ".vigilia-layer-row:has(.vigilia-layer-state button:nth-child(3)) .vigilia-layer-bound",
        text: "margin-right: 92px",
        reason: "the same arithmetic at three controls — `6 + 26*3 + 8` — and inexpressible as a §3 step for the same reason, `n=1` landing on the step 32 only because its gap term is zero",
      },
      {
        site: ".vigilia-layer-row:has(.vigilia-layer-state button:nth-child(4)) .vigilia-layer-bound",
        text: "margin-right: 122px",
        reason: "the same arithmetic at four controls — `6 + 26*4 + 12` — so 62, 92 and 122 are one class of three, not three exceptions",
      },
      { site: ".vigilia-layer-rename", text: "22px" },
      { site: ".editor-shell-identity-dot", text: "7px" },
      { site: ".editor-shell-identity-dot", text: "7px", occurrence: 1 },
      { site: ".editor-shell-view-readout", text: "56px" },
      { site: "[hidden]", text: "980px" },
      { site: ".editor-shell-body", text: "280px" },
    ],
  },
];

/**
 * Blank a span to spaces, keeping its newlines. A masked span must not move a
 * reported line number, so whitespace is emptied character for character.
 */
function blank(span) {
  return span.replace(/[^\n]/g, " ");
}

/**
 * The text the rules read: comments and `calc()` blanked out. A comment
 * explaining that `7px` was the bug is not that bug, and `calc()` is left alone.
 */
function scannable(source, relPath) {
  let text = source.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (/\.(tsx?|jsx?)$/.test(relPath)) {
    // `(?<!:)` because `https://` is not a comment, and blanking the rest of
    // that line would hide every violation on it.
    text = text.replace(/(?<!:)\/\/[^\n]*/g, blank);
  }
  const opens = /\bcalc\(/g;
  let match = opens.exec(text);
  while (match !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < text.length && depth > 0) {
      if (text[i] === "(") depth += 1;
      else if (text[i] === ")") depth -= 1;
      i += 1;
    }
    const from = match.index + match[0].length;
    text = text.slice(0, from) + blank(text.slice(from, i - 1)) + text.slice(i - 1);
    match = opens.exec(text);
  }
  return text;
}

function isDefinition(prelude) {
  const head = prelude.trim();
  if (head === "") return false;
  if (/^@theme\b/.test(head)) return true;
  return head.split(",").every((selector) => DEFINITION_SELECTOR.test(selector.trim()));
}

/** Offsets of every definition block's body: `@theme`, and the palette blocks. */
function definitionSpans(text) {
  const spans = [];
  let prelude = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{") {
      if (isDefinition(prelude)) {
        let depth = 1;
        let j = i + 1;
        while (j < text.length && depth > 0) {
          if (text[j] === "{") depth += 1;
          else if (text[j] === "}") depth -= 1;
          j += 1;
        }
        spans.push([i + 1, j]);
        i = j;
        prelude = "";
        continue;
      }
      prelude = "";
    } else if (ch === "}" || ch === ";") {
      prelude = "";
    } else {
      prelude += ch;
    }
    i += 1;
  }
  return spans;
}

/** The property name the px at `index` is a value of, or null outside a declaration. */
function declarationProperty(text, index) {
  const start =
    Math.max(text.lastIndexOf("{", index), text.lastIndexOf("}", index), text.lastIndexOf(";", index)) + 1;
  const colon = text.indexOf(":", start);
  if (colon === -1 || colon > index) return null;
  const property = text.slice(start, colon).trim();
  return /^[a-z-]+$/.test(property) ? property : null;
}

/**
 * The prelude of the block the literal at `index` sits in — its selector, in a
 * `.css`. It is what identifies *where* a declaration is, so an exemption keyed
 * on it cannot be inherited by a second rule that happens to write the same
 * text; a line number would identify it too, and would move under every
 * unrelated edit above it. Walked the way `declarationProperty` walks, and over
 * the scanned text, so a comment before a selector is already blanked to spaces.
 */
function siteOf(text, index) {
  const open = text.lastIndexOf("{", index);
  if (open === -1) return "";
  const start =
    Math.max(text.lastIndexOf("}", open), text.lastIndexOf("{", open - 1), text.lastIndexOf(";", open)) + 1;
  return text.slice(start, open).replace(/\s+/g, " ").trim();
}

function position(text, index) {
  const before = text.slice(0, index);
  return { line: before.split("\n").length, column: index - before.lastIndexOf("\n") };
}

/**
 * Violations in one file's source. `designLanguagePx` is the tier-2 allowlist: px
 * lengths DESIGN.md fixes outside §3's spacing table, whatever the property —
 * the row rhythms, the rail and pane widths, the pill and toggle heights, the
 * slider's track and value well, the swatch, and §6's stroke widths among
 * them. It is the set of values that actually appear, not an enumeration of
 * every number DESIGN.md prints. What it deliberately does NOT cover is §2's
 * type sizes 13/15/19, because a value here is allowed *anywhere*, so adding
 * them would license `padding: 13px`. The steps and `0`/`1` are allowed
 * without it, so an empty allowlist narrows the rule rather than disabling it.
 * Each violation carries its `rule`, its position, the `site` it sits at (the
 * enclosing selector) and its `text` — the last two being what an exemption is
 * keyed on.
 */
export function check(relPath, source, designLanguagePx = []) {
  const path = String(relPath ?? "");
  const named = new Set([...designLanguagePx].map(Number));
  const text = scannable(String(source ?? ""), path);
  const definitions = definitionSpans(text);
  const inDefinition = (index) => definitions.some(([from, to]) => index >= from && index < to);
  const isCss = /\.css$/.test(path);
  const found = [];

  // In a `.tsx` there is no declaration property to read, so a Tailwind
  // spacing utility carrying an arbitrary value is what marks the px as a
  // spacing decision. Computed once, lazily, only for a non-CSS file.
  let twSpans;
  const isTwSpacing = (index) => {
    if (isCss) return false;
    if (twSpans === undefined) {
      twSpans = [...text.matchAll(TW_SPACING)].map((match) => {
        const from = match.index + match[0].indexOf(match[1]);
        return [from, from + match[1].length];
      });
    }
    return twSpans.some(([from, to]) => index >= from && index < to);
  };

  for (const match of text.matchAll(HEX)) {
    if (inDefinition(match.index)) continue;
    found.push({
      rule: "hex-literal",
      ...position(text, match.index),
      site: siteOf(text, match.index),
      text: match[0],
    });
  }

  for (const match of text.matchAll(PX)) {
    if (inDefinition(match.index)) continue;
    const value = Number(match[1]);
    if (ALWAYS_PX.has(value)) continue;
    const property = isCss ? declarationProperty(text, match.index) : null;
    const spacing =
      property !== null
        ? SPACING_PROPERTY.test(property)
        : isTwSpacing(match.index);
    const site = siteOf(text, match.index);
    if (spacing && !SPACING_STEPS.has(value)) {
      found.push({
        rule: "spacing-px",
        ...position(text, match.index),
        site,
        text: `${property}: ${match[0]}`,
      });
    } else if (!spacing && !SPACING_STEPS.has(value) && !named.has(value)) {
      found.push({ rule: "off-scale-px", ...position(text, match.index), site, text: match[0] });
    }
  }

  return found.sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * The key an exemption and a violation meet on: the site the declaration sits
 * at, its text, and *which* of that text's occurrences in that site it is. Site
 * and text together because neither alone identifies a declaration — a text-only
 * key is inherited by a second rule that happens to write the same value
 * (`vg-327`), and a site-only key cannot tell a `width`/`height` pair apart.
 * `occurrence` is the index among one site's identical texts in source order, so
 * only the second and later have to say it.
 */
function keyOf(site, text, occurrence) {
  return `${String(site ?? "")}\u0000${String(text)}\u0000${occurrence ?? 0}`;
}

/**
 * The ceiling's reading of one file, as a *set*: `counted` is every violation the
 * record does not hold, `dead` is every recorded entry that matches no violation
 * any more, and `over` is true when `counted` is over `max` — 0 in `CEILINGS`, so
 * an arrival fails. Together the two directions are the swap a count could not
 * see: correcting one violation while another arrives reddens the gate on both
 * sides of the same commit.
 *
 * `over` is strict — a count at the ceiling passes — because `>=` would redden
 * the gate at the number it was measured at, which is the failure the ceiling
 * exists to avoid — and it **fails closed**: a `max` that is absent, a string or
 * `NaN` is not compared, because `NaN` is never greater than a count and that is
 * the one way this instrument silently stops being able to fail. `dead` is
 * returned rather than logged so a caller sees a licence nobody needs as a
 * failure, not a silent pass, and it is returned as the entries themselves so the
 * caller can name the site as well as the text.
 */
export function ceilingExcess(relPath, source, designLanguagePx = [], ceiling = {}) {
  const seen = new Map();
  const keyed = check(relPath, source, designLanguagePx).map((violation) => {
    const base = keyOf(violation.site, violation.text);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return { violation, key: keyOf(violation.site, violation.text, occurrence) };
  });
  const exempt = new Map(
    (Array.isArray(ceiling.exempt) ? ceiling.exempt : []).map((entry) => [keyOf(entry.site, entry.text, entry.occurrence), entry]),
  );
  const counted = keyed.filter(({ key }) => !exempt.has(key)).map(({ violation }) => violation);
  const present = new Set(keyed.map(({ key }) => key));
  const dead = [...exempt].filter(([key]) => !present.has(key)).map(([, entry]) => entry);
  return {
    counted,
    dead,
    over: !Number.isFinite(ceiling.max) || counted.length > ceiling.max,
  };
}

/**
 * The tier-2 allowlist entries that permit nothing: no source the checker reads
 * *writes* that px value where the checker could see it (`vg-340`, `vg-332`).
 *
 * Two shapes count as no consumer, and both are defects of the list rather than
 * of a file. A value written only inside a definition block is a token's value,
 * not a surface's: nothing would be flagged were the entry dropped. A value
 * written only as a bare number — `strokeWidth={1.7}`, a component prop — is
 * invisible to this text scan, which matches `px` only, so an entry for it can
 * never fire and the DOM assertion is the only instrument that has ever seen it.
 * Either way the entry is dead weight, and the fix is to drop it: removing an
 * allowed value can only tighten the gate, while an entry nothing writes is what
 * this rule exists to forbid.
 *
 * `sources` is `[relPath, source]` pairs — everything the run reads, the gated
 * list *and* the ceilings' paths, because a value consumed only by a ceiling file
 * is still consumed.
 */
export function unconsumedPx(designLanguagePx, sources) {
  const written = new Set();
  for (const [relPath, source] of sources) {
    const text = scannable(String(source ?? ""), String(relPath ?? ""));
    const definitions = definitionSpans(text);
    for (const match of text.matchAll(PX)) {
      if (definitions.some(([from, to]) => match.index >= from && match.index < to)) continue;
      written.add(Number(match[1]));
    }
  }
  return [...designLanguagePx].filter((value) => !written.has(value));
}

/**
 * Proves every rule still fires. Called only from the entry-point gate: an
 * importer in a process whose argv happens to mention `--self-test` must not
 * run it and exit mid-import.
 */
function selfTest() {
  const cases = [
    // A literal is a violation; a role reference is not.
    ["a hex colour is a violation", "a.css", ".x { color: #ff0000; }", 1],
    ["a role reference is not", "a.css", ".x { color: var(--text); }", 0],

    // Tier 1: a spacing property is held to §3's steps, and to nothing else.
    ["an off-scale px spacing is a violation", "a.css", ".x { padding: 7px; }", 1],
    ["an on-scale px spacing is not", "a.css", ".x { padding: 12px; }", 0],
    ["a DESIGN.md row rhythm is not a spacing step", "a.css", ".x { margin: 26px; }", 1, { designLanguagePx: [26] }],
    ["a hairline border is not", "a.css", ".x { border: 1px solid var(--edge); }", 0],
    ["a zero and a percentage are not", "a.css", ".x { margin: 0; opacity: 100%; }", 0],

    // Tier 2: outside a spacing property, every value DESIGN.md prints is allowed.
    ["a DESIGN.md value outside a spacing property is not", "a.css", ".x { width: 26px; }", 0, { designLanguagePx: [26] }],
    ["the same value is a violation with no allowlist", "a.css", ".x { width: 26px; }", 1],
    ["a rem length is not checked", "a.css", ".x { padding: 1rem; }", 0],
    ["calc() is not checked", "a.css", ".x { width: calc(100% - 7px); }", 0],

    // A definition block holds values; a rule that merely names a palette does not.
    [
      "a palette block keeps its hex",
      "editor-shell.css",
      '[data-shell-palette="graphite"] {\n  --shell-text: #eef9f4;\n}',
      0,
    ],
    [
      "a @theme block defines the scale, so its values are not literals",
      "editor-shell.css",
      "@theme static {\n  --text-xs: 11px;\n  --shadow-raised: 0 12px 28px #0000003d;\n}",
      0,
    ],
    [":root token block is a definition", "a.css", ":root {\n  --vigilia-input-bg: #ffffff;\n}", 0],
    [
      "a rule that only names a palette is not a definition",
      "editor-shell.css",
      '[data-shell-palette="graphite"] .chip {\n  color: #ff0000;\n  padding: 7px;\n}',
      2,
    ],
    [
      "a :not() treatment rule is not a definition",
      "editor-shell.css",
      ':root:not([data-shell-palette="editorial"]) .editor-glass {\n  background: #ff0000;\n}',
      1,
    ],
    ["the same hex outside a definition block is a violation", "a.css", ".x { color: #eef9f4; }", 1],

    ["a comment is not a violation", "a.css", "/* 12px was the step; 7px was the bug */", 0],
    ["an eight-digit hex is one violation, not two", "a.css", ".x { color: #00000059; }", 1],
    ["an id selector is not a hex colour", "a.css", "#app { height: 100%; }", 0],
    ["a tsx literal is checked", "a.tsx", 'const s = { padding: "7px" };', 1],
    // A Tailwind spacing utility in a `.tsx` is tier 1, even where the value is
    // a DESIGN.md value tier 2 would admit — `26` is allowed here only with the
    // allowlist, so this case fails if the utility rule is removed.
    [
      "a tsx spacing utility is held to §3 even for a DESIGN.md value",
      "a.tsx",
      'const c = "p-[26px]";',
      1,
      { designLanguagePx: [26] },
    ],
    ["a tsx gap utility with an off-scale value is a violation", "a.tsx", 'const c = "gap-[7px]";', 1],
    ["a tsx spacing utility on a step is not", "a.tsx", 'const c = "px-[12px]";', 0],
    // A leading `-` is a negative margin/inset, not an exemption: it is held to
    // §3 the same way, so this case fails if negative support is removed.
    [
      "a negative tsx spacing utility is held to §3",
      "a.tsx",
      'const c = "-mt-[26px]";',
      1,
      { designLanguagePx: [26] },
    ],
    ["a negative tsx spacing utility on a step is not", "a.tsx", 'const c = "-mt-[12px]";', 0],
    // Scoping: a non-spacing utility keeps the tier-2 allowlist.
    ["a tsx non-spacing utility keeps the DESIGN.md allowlist", "a.tsx", 'const c = "h-[26px]";', 0, { designLanguagePx: [26] }],
    ["a tsx comment is not", "a.tsx", "// 7px was the bug\nconst s = {};", 0],
    ["a url in a tsx file is not a comment", "a.tsx", 'const u = "https://x"; const s = "7px";', 1],
    // A masked comment must not move the line it reports: it did, and a
    // multi-line comment is what shifted every line below it.
    [
      "a violation after a multi-line comment keeps its line",
      "a.css",
      "/* one\n two */\n.x { padding: 7px; }",
      1,
      { line: 3 },
    ],
  ];

  let failed = 0;
  const report = (name, ok, detail) => {
    if (!ok) failed += 1;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` (${detail})`}`);
  };

  for (const [name, path, source, expected, options = {}] of cases) {
    const found = check(path, source, options.designLanguagePx ?? []);
    report(
      name,
      found.length === expected && (options.line === undefined || found[0]?.line === options.line),
      `expected ${expected} violation(s)${options.line === undefined ? "" : ` on line ${options.line}`}, got ${found.length} on ${found.map((v) => v.line).join(",") || "no line"}`,
    );
  }

  // The ceiling, over a file that is deliberately not gated. Both of its silent
  // failures are proved here rather than assumed: `>=` would redden the gate at
  // the count it was measured at, and a ceiling above the count never fires.
  const ceilingCases = [
    ["a count at the ceiling passes", ".x { color: #ff0000; }", { max: 1 }, 1, 0, false],
    [
      "one above the ceiling reddens",
      ".x { color: #ff0000; }\n.y { color: #00ff00; }",
      { max: 1 },
      2,
      0,
      true,
    ],
    ["a clean file under the ceiling passes", ".x { padding: 12px; }", { max: 4 }, 0, 0, false],
    [
      "an exempt value does not count",
      ".x { margin-right: 62px; }",
      { max: 0, exempt: [{ site: ".x", text: "margin-right: 62px", reason: "the row's own arithmetic" }] },
      0,
      0,
      false,
    ],
    [
      "an exemption that matches nothing fails",
      ".x { padding: 12px; }",
      { max: 4, exempt: [{ site: ".x", text: "margin-right: 62px", reason: "the row's own arithmetic" }] },
      0,
      1,
      false,
    ],
    // `vg-327`: a count cannot see a swap, so the recorded set has to fail on
    // both sides of one — a violation the record does not hold, and a recorded
    // one that has gone. The size is unchanged at two either way.
    [
      "a swap at an unchanged size fails on both sides",
      ".x { padding: 7px; }\n.z { padding: 9px; }",
      {
        max: 0,
        exempt: [
          { site: ".x", text: "padding: 7px" },
          { site: ".y", text: "padding: 9px" },
        ],
      },
      1,
      1,
      true,
    ],
    // `vg-327`'s second instance: an exemption is not a site either. The text is
    // the same in both rules, so a text-only key exempts the second rule too and
    // the dead-exemption guard stays quiet, because the keyed text still occurs.
    [
      "an exemption is keyed on its site, so a second site is not exempt",
      ".a { margin-right: 62px; }\n.b { margin-right: 62px; }",
      { max: 0, exempt: [{ site: ".a", text: "margin-right: 62px" }] },
      1,
      0,
      true,
    ],
    // One site can carry two of one text — `width`/`height` pair — so the key is
    // the occurrence too, and the record has to name the second one.
    [
      "two of one text in one site are not one entry",
      ".x { width: 34px; height: 34px; }",
      { max: 0, exempt: [{ site: ".x", text: "34px" }] },
      1,
      0,
      true,
    ],
    [
      "the second of one text in a site is its own entry",
      ".x { width: 34px; height: 34px; }",
      {
        max: 0,
        exempt: [
          { site: ".x", text: "34px" },
          { site: ".x", text: "34px", occurrence: 1 },
        ],
      },
      0,
      0,
      false,
    ],
    // Fail closed, not open: `NaN` is never greater than a count, so a ceiling
    // whose `max` is absent or a typo would otherwise compare nothing and pass.
    ["a ceiling with no finite max fails closed", ".x { padding: 12px; }", {}, 0, 0, true],
  ];
  for (const [name, source, ceiling, counted, dead, over] of ceilingCases) {
    const got = ceilingExcess("editor-shell.css", source, [], ceiling);
    report(
      name,
      got.counted.length === counted && got.dead.length === dead && got.over === over,
      `expected ${counted} counted/${dead} dead/over ${over}, got ${got.counted.length}/${got.dead.length}/over ${got.over}`,
    );
  }

  // The tier-2 allowlist's own guard (`vg-340`, `vg-332`): an entry no source
  // writes permits nothing. Every case is a shape the checker really meets, and
  // the two that matter are `vg-332`'s — a bare number, and a `px` that only a
  // comment holds.
  const allowlistCases = [
    ["a px value a source writes is consumed", [46], [["a.tsx", 'const s = "h-[46px]";']], []],
    ["a value no source writes is unconsumed", [999], [["a.tsx", 'const s = "h-[26px]";']], [999]],
    ["a bare numeric literal is not a consumer", [1.7], [["a.tsx", "const w = { strokeWidth: 1.7 };"]], [1.7]],
    ["a value only a comment holds is unconsumed", [1.8], [["a.tsx", '// a 1.8px stroke\nconst s = "";']], [1.8]],
    ["a value only a definition block holds is unconsumed", [46], [["a.css", "@theme static { --x: 46px; }"]], [46]],
    // The rule is about what a file *writes*, not about what the allowlist
    // suppresses: a spacing utility is held to §3 anyway, and its value still
    // counts as written, which is why a §3 step in the list is not reported.
    ["a spacing utility still writes its value", [46], [["a.tsx", 'const s = "p-[46px]";']], []],
  ];
  for (const [name, values, sources, expected] of allowlistCases) {
    const got = unconsumedPx(values, sources);
    report(
      name,
      got.length === expected.length && got.every((value, at) => value === expected[at]),
      `expected [${expected.join(",")}] unconsumed, got [${got.join(",")}]`,
    );
  }

  // The brief writes its test as `check(...)` calls from an importer. Importing
  // must hand back the function and nothing else — no CLI, no exit, and not the
  // self-test either, whatever the importing process's argv happens to hold.
  const moduleUrl = pathToFileURL(import.meta.filename).href;
  const importer = (extra) =>
    spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const m = await import(${JSON.stringify(moduleUrl)}); console.log("imported", typeof m.check);`,
        ...extra,
      ],
      { encoding: "utf8" },
    );

  const probe = importer([]);
  report(
    "the export is callable without running the CLI",
    probe.status === 0 && probe.stdout.trim() === "imported function",
    `exit ${probe.status}, stdout ${JSON.stringify(probe.stdout.trim())}, stderr ${JSON.stringify(probe.stderr.trim().slice(0, 120))}`,
  );

  const flagged = importer(["--", "--self-test"]);
  report(
    "an importer's argv cannot trigger the self-test",
    flagged.status === 0 && flagged.stdout.trim() === "imported function",
    `exit ${flagged.status}, stdout ${JSON.stringify(flagged.stdout.trim().slice(0, 120))}`,
  );

  if (failed > 0) {
    console.error(`design-tokens self-test: ${failed} case(s) wrong`);
    process.exit(1);
  }
  console.log("design-tokens self-test: all cases behave");
  process.exit(0);
}

function flagValue(name) {
  const at = process.argv.indexOf(name);
  if (at === -1) return null;
  const value = process.argv[at + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`design-tokens: ${name} needs a path`);
    process.exit(1);
  }
  return value;
}

/**
 * The CLI — self-test included — runs only when this file is the entry point,
 * so an importer gets `check` and no side effects at all. Both sides are
 * resolved through `realpathSync` so a symlinked invocation still matches
 * rather than silently running nothing; Windows compares case-insensitively,
 * because a drive-letter case difference would do the same.
 */
const isEntryPoint = (() => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  const real = (path) => {
    try {
      return realpathSync(path);
    } catch {
      return path;
    }
  };
  const invoked = real(resolve(entry));
  const self = real(import.meta.filename);
  return process.platform === "win32"
    ? invoked.toLowerCase() === self.toLowerCase()
    : invoked === self;
})();

if (isEntryPoint) {
  if (process.argv.includes("--self-test")) selfTest();

  const gatedArg = flagValue("--gated");
  const gatedPath = gatedArg === null ? resolve(ROOT, DEFAULT_GATED) : resolve(gatedArg);

  let config;
  try {
    config = JSON.parse(await readFile(gatedPath, "utf8"));
  } catch (error) {
    console.error(`design-tokens: cannot read the gated list ${gatedPath} (${error.code ?? error.message})`);
    process.exit(1);
  }
  // A bare array is the gated list alone, which is what the plan's own
  // empty-list proof writes into a temp file.
  const gated = Array.isArray(config) ? config : config.gated;
  const designLanguagePx = config.designLanguagePx ?? [];
  if (!Array.isArray(gated)) {
    console.error(`design-tokens: ${gatedPath} must hold an array, or an object with a "gated" array`);
    process.exit(1);
  }
  if (!Array.isArray(designLanguagePx) || designLanguagePx.some((value) => !Number.isFinite(value))) {
    console.error(`design-tokens: ${gatedPath}'s "designLanguagePx" must be an array of numbers`);
    process.exit(1);
  }
  if (gated.length === 0) {
    // The whole point of the ratchet: a list nobody has added to yet proves nothing.
    console.error(`design-tokens: the gated list ${gatedPath} is empty; the guard would check nothing`);
    process.exit(1);
  }

  // Every file the run reads, read once: the gated list and the ceilings' paths.
  // The allowlist rule at the end needs the same union, and reading a file twice
  // would let the two rules disagree about which file they looked at. A read that
  // failed is kept as the error, so the caller that reports it reports once.
  const sources = new Map();
  const sourceOf = async (relPath) => {
    if (!sources.has(relPath)) {
      try {
        sources.set(relPath, await readFile(resolve(ROOT, relPath), "utf8"));
      } catch (error) {
        sources.set(relPath, { error });
      }
    }
    return sources.get(relPath);
  };
  // A success sentence beside a failure is how a red run reads green, so both of
  // the run's success lines wait until nothing has failed.
  const notices = [];

  let violations = 0;
  for (const entry of gated) {
    const relPath = String(entry);
    const source = await sourceOf(relPath);
    if (typeof source !== "string") {
      console.error(`design-tokens: ${relPath} cannot be read (${source.error.code ?? source.error.message})`);
      violations += 1;
      continue;
    }
    for (const violation of check(relPath, source, designLanguagePx)) {
      console.error(
        `${relPath}:${violation.line}:${violation.column} ${violation.rule} ${violation.text}`,
      );
      violations += 1;
    }
  }
  if (violations > 0) {
    console.error(`design-tokens: ${violations} violation(s) across ${gated.length} gated file(s)`);
    process.exit(1);
  }
  notices.push(`design-tokens: ${gated.length} gated file(s) clean`);

  // The same guards the gated list gets above, for the same reason: a guard over
  // nothing proves nothing, and a `max` that is not a finite number is a ceiling
  // comparing against nothing. `ceilingExcess` fails closed on it too; this is
  // the legible refusal. An exemption is refused unless it names a site and a
  // text, because a key missing either half would match nothing and report as a
  // dead exemption, hiding the shape mistake behind a plausible message.
  if (CEILINGS.length === 0) {
    console.error("design-tokens: CEILINGS is empty; the guard would compare no file at all");
    process.exit(1);
  }
  for (const ceiling of CEILINGS) {
    if (!Number.isFinite(ceiling.max)) {
      console.error(
        `design-tokens: CEILINGS entry ${String(ceiling.path)} has no finite "max"; a ceiling compared against nothing is never over`,
      );
      process.exit(1);
    }
    for (const entry of Array.isArray(ceiling.exempt) ? ceiling.exempt : []) {
      const shape =
        typeof entry.site !== "string" || entry.site === "" || typeof entry.text !== "string" || entry.text === "";
      const occurrence =
        entry.occurrence !== undefined && (!Number.isInteger(entry.occurrence) || entry.occurrence < 0);
      if (shape || occurrence) {
        console.error(
          `design-tokens: CEILINGS entry ${String(ceiling.path)} has an exemption that is not { site, text, occurrence? }; an exemption is keyed on all three`,
        );
        process.exit(1);
      }
    }
  }

  let breached = 0;
  for (const ceiling of CEILINGS) {
    const relPath = String(ceiling.path);
    const source = await sourceOf(relPath);
    if (typeof source !== "string") {
      console.error(`design-tokens: ${relPath} cannot be read (${source.error.code ?? source.error.message})`);
      breached += 1;
      continue;
    }
    const { counted, dead, over } = ceilingExcess(relPath, source, designLanguagePx, ceiling);
    for (const entry of dead) {
      console.error(
        `design-tokens: ${relPath}'s ceiling records "${entry.text}" at "${entry.site}", which is not a violation any more — update the record`,
      );
      breached += 1;
    }
    if (over) {
      for (const violation of counted) {
        console.error(
          `${relPath}:${violation.line}:${violation.column} ${violation.rule} ${violation.text}`,
        );
      }
      console.error(
        `design-tokens: ${relPath} holds ${counted.length} violation(s) the record does not, above its ceiling of ${ceiling.max} — re-record the file's residual set`,
      );
      breached += 1;
    } else if (dead.length === 0) {
      notices.push(
        `design-tokens: ${relPath} holds ${counted.length} violation(s) not in its record, at or below its ceiling of ${ceiling.max}`,
      );
    }
  }

  // The tier-2 allowlist's own guard: an entry no file the run reads writes
  // permits nothing. It reads the same union the checker does — a value consumed
  // only by a ceiling file is still consumed — and it runs after the ceilings, so
  // an unreadable ceiling file is reported as that rather than as the entries its
  // absence would orphan.
  const unconsumed = unconsumedPx(designLanguagePx, [...sources].filter(([, source]) => typeof source === "string"));
  for (const value of unconsumed) {
    console.error(
      `design-tokens: designLanguagePx allows ${value}px, which no file this run reads writes — the entry has no consumer, so drop it`,
    );
    breached += 1;
  }

  if (breached > 0) process.exit(1);
  for (const notice of notices) console.log(notice);
}

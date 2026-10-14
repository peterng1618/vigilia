import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reads a value the drawing *declares*, rather than a copy of one.
 *
 * The contradiction this removes: a value transcribed out of
 * `docs/design/mockups/current/shell.html` into a test is a second owner of it.
 * The drawing can move and the test keeps asserting the transcription, so the
 * comparison passes while the two disagree — which is what spec §13's
 * amendment of 2026-10-10 is about. So the drawing is parsed here, and a row
 * that names a value the drawing no longer declares fails instead of passing.
 *
 * **Two declaration sites, one reader.** Every drawing here declares in a
 * `<style>` block holding `:root`, `*` and `body`, *and* in inline `style`
 * attributes — every region a row addresses (the header, the body row, the rail,
 * the panes, the stage and its ground, the inspector, and the field rows the two
 * control drawings carry) is an anonymous inline-styled `div` with no selector to
 * reach it by. A selector is therefore either:
 *
 * - a rule selector, matched against the drawing's `<style>` rules — no `PARITY`
 *   row uses one, so the rule half of the reader is exercised by the reader's own
 *   proofs, which read `body`;
 * - an attribute selector of the form `[style*="width:46px"]`, matched against
 *   an element's own `style` attribute — how every row above is addressed.
 *
 * **Document order decides — between rules.** Where more than one `<style>` rule
 * carries the selector, the **last** declaration wins: the cascade's rule for
 * equal specificity, and the reading a person gets from opening the file. Unlike
 * the cascade this reader does not weigh specificity, so a row gets exactly the
 * rule it names.
 *
 * **An inline selector must be unambiguous.** `[style*="…"]` in a browser
 * matches *every* element carrying that substring, and the last in document
 * order is a different element, not a later rule for the same one — so a second
 * match is refused rather than resolved (`lookup`). Otherwise a row could quietly
 * compare the wrong element, and a wrong element with a real value reads as a
 * **pass** — the failure mode this file exists to end.
 *
 * `ponytail:` a regex over an inline stylesheet is the ceiling here — no at-rule
 * nesting, no shorthand expansion, no specificity. Upgrade to a real CSS parse
 * if the drawing gains nested rules or a shorthand a row mis-reads.
 */

/** The drawing this plan measures the shell against. `fileURLToPath`, because a
 *  `file:` URL does not survive a Windows path. */
export const MOCKUP_PATH = fileURLToPath(
  new URL(
    "../../../../docs/design/mockups/current/shell.html",
    import.meta.url,
  ),
);

/** The drawing the settings modal is measured against. A second path rather
 *  than a second reader: `readMockup` takes one, so a surface drawn on its own
 *  file is read by the same parser and neither drawing goes unread. */
export const SETTINGS_MOCKUP_PATH = fileURLToPath(
  new URL(
    "../../../../docs/design/mockups/current/settings.html",
    import.meta.url,
  ),
);

/** The settings modal's other two panels, each drawn on its own file for the
 *  reason the current set's README gives: one drawn view per file. The reader's
 *  inline selector `[style*="…"]` refuses to settle between two elements
 *  carrying it, so a second copy of the modal's frame inside one file would
 *  break every address the frame's own rows use — the navigation's `width:150px`
 *  among them. Three files, one modal, and each panel's rows read from the file
 *  that draws that panel. */
export const SETTINGS_KEYBOARD_MOCKUP_PATH = fileURLToPath(
  new URL(
    "../../../../docs/design/mockups/current/settings-keyboard.html",
    import.meta.url,
  ),
);

export const SETTINGS_ABOUT_MOCKUP_PATH = fileURLToPath(
  new URL(
    "../../../../docs/design/mockups/current/settings-about.html",
    import.meta.url,
  ),
);

/** The inspector column as the shell draws it, and the same column on the light
 *  ground. Together they are the control set's own drawing — the field row this
 *  task fixes, the well's radius and the label column all live here.
 *
 *  They are read by `PARITY`'s two `fixture` rows rather than by a copy: a
 *  drawing that nothing reads is a drawing that rots, and this task changes the
 *  geometry they declare, which makes them the rows most able to catch a drift
 *  in it. The frozen originals (`mockups/inspector-controls.html`,
 *  `mockups/inspector-language.html`) are provenance and are never a target. */
export const CONTROLS_MOCKUP_PATH = fileURLToPath(
  new URL(
    "../../../../docs/design/mockups/current/controls.html",
    import.meta.url,
  ),
);

/** The same column on the light ground — the token table swapped and nothing
 *  else, so a row that reads both is reading one geometry twice. */
export const CONTROLS_LIGHT_MOCKUP_PATH = fileURLToPath(
  new URL(
    "../../../../docs/design/mockups/current/controls-editorial.html",
    import.meta.url,
  ),
);

/** The **frozen original** drawing the current set's treatment is copied from.
 *
 *  Not a target — nothing is measured against it — but not provenance only
 *  either: `docs/design/mockups/README.md` copies colour, spacing, radii, type,
 *  elevation and hairlines from here, and a copied value that drifts from it is
 *  read by no gate (`vg-320`). `COPIED_ELEMENTS` compares the pairs a person can
 *  name, and the file is read for that comparison alone. */
export const ORIGINAL_MOCKUP_PATH = fileURLToPath(
  new URL("../../../../docs/design/mockups/editor-shell.html", import.meta.url),
);

/** The directory every checked drawing lives in. */
const CURRENT_MOCKUPS_DIR = fileURLToPath(
  new URL("../../../../docs/design/mockups/current/", import.meta.url),
);

/** Every drawing in `docs/design/mockups/current/`, in name order, each with
 *  the checked-in path a failure names it by.
 *
 *  **A directory read, not a list of the six the directory holds today** —
 *  `controls.html`, `controls-editorial.html`, `settings.html`,
 *  `settings-keyboard.html`, `settings-about.html`, `shell.html` — because the
 *  hole this closes is a drawing the reader did not know about: the set was four
 *  when it landed, all four declared the off-scale `7px` toggle track the radius
 *  sweep corrected in `shell.html`, and the only row that read a drawing's radius
 *  scale read `MOCKUP_PATH` alone. Task 4 added the settings panel's two siblings
 *  and this read took them without an edit; a seventh is read the moment it lands
 *  rather than joining the set silently (`vg-296`). */
export function currentDrawings(): readonly {
  readonly path: string;
  readonly name: string;
}[] {
  return readdirSync(CURRENT_MOCKUPS_DIR)
    .filter((entry) => entry.endsWith(".html"))
    .sort()
    .map((entry) => ({
      path: join(CURRENT_MOCKUPS_DIR, entry),
      name: `docs/design/mockups/current/${entry}`,
    }));
}

/** The drawing's own token table — the block `current/shell.html:17-18` writes
 *  on its outermost element, which is where every value graphite takes lives.
 *
 *  Addressed by the drawn window's `width:1180px`, a declaration no other
 *  element in the file carries: anchoring on a *token* (say `--accent:#72e0c0`)
 *  would break the row the moment the value moved, which is the drift this
 *  reader exists to report rather than to hide. */
export const SHELL_TOKEN_SELECTOR = '[style*="width:1180px"]';

/** The settings dialog's own frame in `current/settings.html:20`, addressed by
 *  the width it declares. The row that reads its `border-radius` against the
 *  product's `--radius-lg` names the drawing's element through this constant
 *  rather than a second copy of the drawn width, so the drawing stays the one
 *  owner of the value the selector is built from. */
export const SETTINGS_DIALOG_SELECTOR = '[style*="width:560px"]';

/** The drawing's tokens and the product variable each one owns.
 *
 *  **Eleven, not ten.** The brief that scoped this row listed the table's ten
 *  original tokens; the current drawing's table carries an eleventh, `--hot`
 *  (`current/shell.html:18`), added when the current set was built. Two drawing
 *  names spell without the product's hyphen (`--panel2`/`--panel-2`,
 *  `--edge2`/`--edge-2`), and two drawing tokens share one product variable —
 *  `--hdr` and `--panel` are both `--shell-surface`, and the drawing gives them
 *  the same value.
 *
 *  **A product role the drawing names no token for is absent, not invented**:
 *  `--warn` (`--shell-warm`), `--shell-display`, `--shell-flat` and
 *  `--vigilia-control-bg` have no drawing value to compare against. */
export const SHELL_ROLES: readonly {
  readonly drawingToken: string;
  readonly productVariable: string;
}[] = [
  { drawingToken: "--bg", productVariable: "--shell-backdrop" },
  { drawingToken: "--hdr", productVariable: "--shell-surface" },
  { drawingToken: "--panel", productVariable: "--shell-surface" },
  { drawingToken: "--panel2", productVariable: "--shell-surface-strong" },
  { drawingToken: "--edge", productVariable: "--shell-edge" },
  { drawingToken: "--edge2", productVariable: "--edge-2" },
  { drawingToken: "--text", productVariable: "--shell-text" },
  { drawingToken: "--muted", productVariable: "--shell-muted" },
  { drawingToken: "--faint", productVariable: "--faint" },
  { drawingToken: "--accent", productVariable: "--shell-accent" },
  { drawingToken: "--hot", productVariable: "--shell-danger" },
];

export function readMockup(path: string = MOCKUP_PATH): string {
  return readFileSync(path, "utf8");
}

/** Every declaration the drawing writes, in document order — each `<style>`
 *  block's rules, then each element's inline `style` attribute — each with the
 *  line it is written on.
 *
 *  **The drawing-wide reading, beside the per-selector one.** `mockupDeclared`
 *  answers "what does the element this selector names declare", which is the
 *  wrong shape for a question about *every* declaration a file makes: §3's
 *  radius scale binds each `border-radius` wherever it is written (`vg-296`),
 *  and the token table is read from every site that carries a token rather than
 *  from the one element the width selector happens to match (`vg-309`). A row
 *  that used a per-selector reader for either would read one element and report
 *  the file as checked. */
export function mockupDeclarations(
  mockupHtml: string,
): readonly MockupDeclaration[] {
  return declarations(mockupHtml);
}

/** One declaration the drawing writes, with the thing that owns it. */
type Declaration = {
  /** A single selector from a `<style>` rule's list, or the element's whole
   *  `style` attribute for an inline declaration. */
  readonly owner: string;
  readonly inline: boolean;
  readonly property: string;
  readonly value: string;
  /** 1-based line in the drawing's text. For an inline declaration it is the
   *  line the `style` attribute's value starts on; for a `<style>` rule it is
   *  the line the rule's **selector** starts on. */
  readonly line: number;
};

/** A declaration as a caller outside this module reads it — the same shape the
 *  reader uses internally, exported because a *drawing-wide* question (`vg-296`'s
 *  radii, `vg-309`'s token sites) is about every declaration the file writes
 *  rather than about one selector's value. */
export type MockupDeclaration = Declaration;

/** `[style*="…"]` — the only selector form this reader gives a meaning to
 *  beyond "a rule in the `<style>` block". */
const INLINE_SELECTOR = /^\[style\*="([\s\S]*)"\]$/;

/** Every `property: value` pair of a declaration body, in written order. A
 *  value keeps its own text — `8px 12px`, `var(--edge)`, `0 8px 20px #0007` —
 *  because a row compares a computed value against what is written. */
function pairs(body: string): { property: string; value: string }[] {
  const found: { property: string; value: string }[] = [];
  for (const part of body.split(";")) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const property = part.slice(0, at).trim().toLowerCase();
    const value = part.slice(at + 1).trim();
    if (property === "" || value === "") continue;
    found.push({ property, value });
  }
  return found;
}

/** The 1-based line `index` falls on. */
function lineOf(mockupHtml: string, index: number): number {
  let line = 1;
  for (let at = 0; at < index; at += 1) {
    if (mockupHtml[at] === "\n") line += 1;
  }
  return line;
}

/** The drawing's declarations in document order: every `<style>` block's rules,
 *  then every element's inline `style` attribute. */
function declarations(mockupHtml: string): Declaration[] {
  const found: Declaration[] = [];
  for (const block of mockupHtml.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
  )) {
    const blockText = block[0];
    const css = block[1] ?? "";
    // Comments are blanked **in place** rather than removed: a rule's match
    // index is an offset into this text, and dropping characters would shift
    // every line number below the comment.
    const blanked = css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      comment.replace(/[^\n]/g, " "),
    );
    const contentStart = (block.index ?? 0) + blockText.indexOf(css);
    for (const rule of blanked.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const pairs_ = pairs(rule[2] ?? "");
      const head = rule[1] ?? "";
      // The **selector's** line, not the match's. `[^{}]+` is greedy, so a match
      // begins at the previous rule's closing brace: reading `rule.index` alone
      // reports a rule on the line the one before it ended, which is how a
      // declaration in a 2,500-line stylesheet got reported 22 lines above
      // itself. Trimming the lead whitespace lands on the selector.
      const line = lineOf(
        mockupHtml,
        contentStart +
          (rule.index ?? 0) +
          (head.length - head.trimStart().length),
      );
      for (const selector of head.split(",")) {
        const owner = selector.trim();
        if (owner === "") continue;
        for (const pair of pairs_) {
          found.push({ owner, inline: false, line, ...pair });
        }
      }
    }
  }
  for (const element of mockupHtml.matchAll(/<[a-z][^>]*\sstyle="([^"]*)"/gi)) {
    const owner = element[1] ?? "";
    const line = lineOf(
      mockupHtml,
      (element.index ?? 0) + element[0].indexOf(owner),
    );
    for (const pair of pairs(owner)) {
      found.push({ owner, inline: true, line, ...pair });
    }
  }
  return found;
}

/** Every declaration a selector addresses, in document order, with the two
 *  guards a reading depends on: a selector that addresses none is a broken row
 *  rather than a silence, and an **inline** selector addresses one element.
 *
 *  `[style*="…"]` matches every element carrying the substring, so a second
 *  match is not a later rule for the same thing — it is a different thing, and
 *  the row cannot say which it meant. That throws, like a selector that
 *  addresses nothing, because the alternative is a row that reads whichever
 *  element the document lists last and can pass on it. Elements written with
 *  *identical* `style` attributes count once: they are indistinguishable here
 *  and declare the same value either way.
 *
 *  Both callers take it through this: one reading (`lookup`) and one whole-set
 *  reading (`mockupDeclaredProperties`), so a set is addressed the strict way a
 *  value is. */
function addressed(mockupHtml: string, selector: string): Declaration[] {
  const inline = INLINE_SELECTOR.exec(selector);
  const wanted = (inline?.[1] ?? "").trim();
  const matched = new Set<string>();
  const found: Declaration[] = [];
  for (const declaration of declarations(mockupHtml)) {
    const matches =
      inline === null
        ? !declaration.inline && declaration.owner === selector.trim()
        : declaration.inline && declaration.owner.includes(wanted);
    if (!matches) continue;
    found.push(declaration);
    matched.add(declaration.owner);
  }
  if (found.length === 0) {
    throw new Error(
      `the drawing addresses nothing with \`${selector}\`: this row names a selector the drawing does not declare`,
    );
  }
  if (inline !== null && matched.size > 1) {
    throw new Error(
      `the drawing addresses ${matched.size} elements with \`${selector}\`: this row names a selector that does not settle which one it means`,
    );
  }
  return found;
}

/** The shorthands that would set each longhand a row reads: `padding` sets
 *  `padding-top`, `gap` sets `column-gap`.
 *
 *  **Why a shorthand has to be loud.** `lookup` matches property names exactly,
 *  so a shorthand the drawing writes is invisible to a row reading its longhand,
 *  and the row reads the drawing's *silence* where the drawing drew an inset —
 *  which `PARITY` reads as `0`. A body row is the shape: `padding:8px` on the
 *  flush body div reads as no `padding-top` at all, and the row's expected value
 *  inverts. Silence must keep meaning silence, so a shorthand for a property a
 *  row reads **throws** rather than returning `null`: it is a declaration the
 *  row cannot see, not a declaration the drawing omitted (`vg-296`'s family,
 *  `vg-302`). A shorthand with no row reading its longhand — `flex`, `background`
 *  — is unaffected, because no entry names it. */
const SHORTHANDS_SETTING: Readonly<Record<string, readonly string[]>> = {
  "padding-top": ["padding"],
  "padding-right": ["padding"],
  "padding-bottom": ["padding"],
  "padding-left": ["padding"],
  "margin-top": ["margin"],
  "margin-right": ["margin"],
  "margin-bottom": ["margin"],
  "margin-left": ["margin"],
  "row-gap": ["gap"],
  "column-gap": ["gap"],
};

/** The value the drawing last declares for `property` under `selector`, or
 *  `null` when it declares none. Throws when the drawing declares a shorthand
 *  that sets `property` instead — a value the row cannot read, which must not
 *  pass as the drawing's silence. */
function lookup(
  mockupHtml: string,
  selector: string,
  property: string,
): string | null {
  let value: string | null = null;
  const shorthands = SHORTHANDS_SETTING[property] ?? [];
  for (const declaration of addressed(mockupHtml, selector)) {
    if (declaration.property === property) value = declaration.value;
    if (shorthands.includes(declaration.property)) {
      throw new Error(
        `\`${selector}\` declares \`${declaration.property}: ${declaration.value}\`, the shorthand that sets \`${property}\`: this row reads the longhand, so a shorthand is a value it cannot see and would read as the drawing's silence`,
      );
    }
  }
  return value;
}

/** A CSS length in px that **every** value of a shorthand agrees on.
 *
 *  **A pure decision, so it is proved in `mockup-values.test.ts` rather than in a
 *  browser run.** Its defect — reading only the first token — was invisible for
 *  exactly the reason this file is unit-tested: `border-radius` is a shorthand of
 *  four corners and `getComputedStyle` serialises a non-uniform radius as
 *  `8px 8px 0px 0px`, so `border-radius: 8px 8px 0 0` on `.editor-shell-dialog`
 *  read as `8` and the modal shipped with two square corners a person can see. A
 *  comparator whose guard sits behind a desktop browser run is a comparator a
 *  `vitest run` cannot hold, and that is the failure it already had once.
 *
 *  Every token is therefore held: a value whose tokens disagree has no single
 *  length it means, so it is `null` and the row fails naming the whole rendered
 *  value rather than the first token of it. `normal` is `gap`'s own word for no
 *  gap and reads as `0`, and so is a bare `0` — the one length CSS lets a
 *  drawing write without a unit, so a row whose drawing says `padding-top:0`
 *  reads as flush rather than as a value this table cannot read. Anything else
 *  without `px` is not a length, and fails with its own text. A **single-value**
 *  radius is unchanged: `8px` is one token and still means `8`, as does
 *  `8px 8px 8px 8px` — the same radius spelled out. */
export function lengthInPx(value: string): number | null {
  const tokens = value
    .trim()
    .split(/[\s/]+/)
    .filter((part) => part !== "");
  if (tokens.length === 0) return null;
  if (tokens[0] === "normal") return 0;
  const lengths: number[] = [];
  for (const token of tokens) {
    if (token === "0") {
      lengths.push(0);
      continue;
    }
    const match = /^(-?[\d.]+)px$/.exec(token);
    if (match === null) return null;
    const px = Number.parseFloat(match[1] ?? "NaN");
    if (!Number.isFinite(px)) return null;
    lengths.push(px);
  }
  const first = lengths[0] ?? null;
  return lengths.every((length) => length === first) ? first : null;
}

/** How many tracks a `grid-template-columns` value declares or resolves to.
 *
 *  **A count is not a length.** `lengthInPx` returns `null` for the drawing's
 *  `repeat(3,1fr)` and for the product's computed track list alike, so a length
 *  row over the palette grid fails saying "not a length this table can compare"
 *  whatever either side does. The count is read from the same property on both
 *  sides: the drawing's declared `repeat(3,1fr)`, and the product's computed
 *  list, which a browser serialises for a fixed grid as `"146px 146px 146px"`.
 *
 *  `null` is a value this comparator cannot read — `none`, `subgrid`, an empty
 *  string, or a `repeat()` whose count is not a plain integer
 *  (`repeat(auto-fill, …)` is a bound, not a count) — and a row reading `null`
 *  fails naming the whole rendered value rather than passing as a zero.
 *
 *  `ponytail:` splitting a serialised track list at top-level whitespace is the
 *  ceiling here; a real grid-resolution model would be a second layout engine
 *  for a fixed column count.
 */
export function trackCount(value: string): number | null {
  const text = value.trim();
  if (text === "" || text === "none" || text === "subgrid") return null;
  const repeated = /^repeat\(\s*(\d+)\s*,/.exec(text);
  if (repeated !== null) {
    const count = Number.parseInt(repeated[1] ?? "", 10);
    return Number.isInteger(count) && count > 0 ? count : null;
  }
  // A `repeat()` this reader has no plain count for is `null` rather than one
  // track: `repeat(auto-fill, …)` is a bound, and counting the whole function as
  // a single token would answer `1` for a grid whose column count is not fixed.
  if (text.startsWith("repeat(")) return null;
  /** Top-level whitespace only: a `minmax(100px, 1fr)` track and a `[name]`
   *  line both carry spaces of their own, and neither is two tracks. */
  const tracks: string[] = [];
  let depth = 0;
  let track = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (depth === 0 && /\s/.test(char)) {
      if (track !== "") tracks.push(track);
      track = "";
      continue;
    }
    track += char;
  }
  if (track !== "") tracks.push(track);
  const counted = tracks.filter(
    (one) => !(one.startsWith("[") && one.endsWith("]")),
  );
  return counted.length === 0 ? null : counted.length;
}

/** One channel of an `rgb()`/`rgba()` argument, as an 8-bit integer. */
function channel(token: string): number | null {
  const percent = token.endsWith("%");
  const number = Number.parseFloat(token);
  if (!Number.isFinite(number)) return null;
  return Math.round(percent ? (number / 100) * 255 : number);
}

/** Alpha, as the same 8 bits — **not** through `channel`: alpha is written
 *  fractional (`0.451`) or as a percentage (`45.1%`), never as 0–255, so the
 *  first form has to be scaled rather than rounded. Reading `0.451` as a channel
 *  turns a 45% scrim into a fully transparent one. */
function alphaChannel(token: string): number | null {
  if (token.endsWith("%")) return channel(token);
  const number = Number.parseFloat(token);
  if (!Number.isFinite(number)) return null;
  return Math.round(number <= 1 ? number * 255 : number);
}

/** A colour as one canonical spelling, or `null` when the value is not one this
 *  comparator can read.
 *
 *  **A colour is not a length, and two spellings of one colour are not equal as
 *  strings.** DESIGN.md writes the modal's scrim `#00000073` and a browser
 *  computes the same colour as `rgba(0, 0, 0, 0.451)`, so a string comparison
 *  fails on a surface that is right — and `lengthInPx` fails on one that is read
 *  at all. The value is therefore parsed into 8-bit channels and returned as a
 *  single spelling, so two readings compare equal exactly when they are the same
 *  colour.
 *
 *  Hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), `rgb()`/`rgba()` with commas or
 *  spaces, integer or percentage channels, and `transparent` are read. Anything
 *  else — a `color-mix(…)`, a gradient, a named colour — is `null`, which a row
 *  fails on naming the whole value rather than comparing two unknowns. Alpha is
 *  quantised to the same 8 bits the channels are, so `0.45` and `0.451` are one
 *  colour: a finer distinction than an 8-bit channel can carry.
 */
export function colourValue(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (text === "transparent") return "rgba(0, 0, 0, 0)";
  const hex = /^#([0-9a-f]{3,8})$/.exec(text);
  if (hex !== null) {
    const digits = hex[1] ?? "";
    const wide = digits.length === 6 || digits.length === 8;
    if (!wide && digits.length !== 3 && digits.length !== 4) return null;
    const step = wide ? 2 : 1;
    const parts: number[] = [];
    for (let at = 0; at < digits.length; at += step) {
      const pair = digits.slice(at, at + step);
      parts.push(Number.parseInt(wide ? pair : pair + pair, 16));
    }
    const [r, g, b, a] = parts;
    return `rgba(${r ?? 0}, ${g ?? 0}, ${b ?? 0}, ${a ?? 255})`;
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(text);
  if (fn === null) return null;
  const parts = (fn[1] ?? "").split(/[\s,/]+/).filter((part) => part !== "");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const channels = parts.slice(0, 3).map(channel);
  if (channels.some((one) => one === null)) return null;
  const alpha = parts.length === 4 ? alphaChannel(parts[3] ?? "") : 255;
  if (alpha === null) return null;
  const [r, g, b] = channels;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Every drawing in `current/`, as text, keyed by the path a `PARITY` row names.
 *
 *  **The map a row's `mockupPath` is resolved against — a map rather than a
 *  fallback.** A row that names a drawing the reader was not given is a broken
 *  row: a settings row that lost its `mockupPath` would otherwise read
 *  `current/shell.html` silently and could *pass* on a value the shell declares
 *  where the drawing it means declares something else. `undefined` still means
 *  the shell drawing, which is every plan 7 row. */
export function drawingTexts(): ReadonlyMap<string, string> {
  return new Map(
    currentDrawings().map(({ path }) => [path, readMockup(path)] as const),
  );
}

/** The drawing a row is read from: the one it names, or the shell drawing when it
 *  names none.
 *
 *  **A path the reader was not given throws.** The silent default is what would
 *  let a row read the wrong file and report the wrong file's value as its own —
 *  the failure mode every other guard in this module exists to end, one level up.
 *  A row's `mockupPath` is a claim about which file governs it, and a claim this
 *  reader cannot honour has to be loud. */
export function rowDrawing(
  mockupPath: string | undefined,
  drawings: ReadonlyMap<string, string>,
): string {
  const path = mockupPath ?? MOCKUP_PATH;
  const text = drawings.get(path);
  if (text === undefined) {
    throw new Error(
      `the row names a drawing the reader was not given (\`${path}\`): a row read from another file can pass on a value the drawing it names does not declare`,
    );
  }
  return text;
}

/** Every property name the selector declares, each once and in document order.
 *
 *  The reading a *set* needs and a value cannot give: an assertion that each row
 *  is present passes when the drawing has grown a row nobody mapped, which is how
 *  the shell's eleventh token (`--hot`) arrived under a brief that listed ten. */
export function mockupDeclaredProperties(
  mockupHtml: string,
  selector: string,
): readonly string[] {
  return [
    ...new Set(addressed(mockupHtml, selector).map(({ property }) => property)),
  ];
}

/** The value the drawing declares for `selector`'s `property`.
 *
 *  Throws naming **both** when the drawing declares none, so a row that has
 *  outlived its declaration says so rather than comparing against an empty
 *  string. A selector the drawing addresses nothing with throws too: silence
 *  about a property is a reading, a selector that matches no declaration is a
 *  broken row. */
export function mockupDeclared(
  mockupHtml: string,
  selector: string,
  property: string,
): string {
  const value = lookup(mockupHtml, selector, property);
  if (value === null) {
    throw new Error(
      `the drawing declares no \`${property}\` for \`${selector}\``,
    );
  }
  return value;
}

/** The same reading, with the drawing's silence returned as `null`.
 *
 *  A parity row is often a value the drawing *is* silent about — a region it
 *  draws flush declares no inset, and that silence is the value `0`. The
 *  distinction that matters is therefore between "declares none" and "addresses
 *  nothing": the first is `null` here, the second still throws, so a misspelt
 *  selector cannot be read as a region the drawing draws flush. */
export function mockupDeclaredOrNull(
  mockupHtml: string,
  selector: string,
  property: string,
): string | null {
  return lookup(mockupHtml, selector, property);
}

/** One region's parity row: what the drawing declares, what the product
 *  renders, and the rule that governs the difference.
 *
 *  `licensed` carries the text of a **predating** normative rule — a DESIGN.md §N,
 *  an ADR or a spec section — that positively requires the product's treatment.
 *  Its absence is what makes a difference a defect (spec §13 as amended
 *  2026-10-10): the drawing's silence is not permission, and a rule this plan
 *  writes cannot license this plan's divergence. */
export type ParityRegion = {
  readonly region: string;
  /** A `<style>` rule selector, or `[style*="…"]` for an inline declaration.
   *
   *  **Absent** on a row the closed scale owns rather than the drawing — see
   *  `scaleToken`. A row with neither is a row with no comparator, and the row
   *  does not belong in this table. */
  readonly mockupSelector?: string;
  /** The CSS property, named the same on both sides — `border-radius` is read
   *  from the drawing's rule and from the product's computed style alike. */
  readonly mockupProperty: string;
  readonly productSelector: string;
  /** Names a `§N` marker in `DESIGN.md` — never a line number; the section is the stable anchor. */
  readonly designLanguageSection: string;
  /** The drawing `mockupSelector` is read from, when it is not the plan's own
   *  shell drawing. A surface drawn on its own file names that file, so one
   *  table can address every drawing the plan measures. */
  readonly mockupPath?: string;
  /** A closed-scale token the product's own declaration must resolve to, read
   *  from `:root` at run time so the expected value cannot drift from the
   *  token — `--radius-lg` is the file's, not this table's. Set only where the
   *  drawing is not the source: a region the drawing draws as part of a
   *  *window* has no counterpart element in a product that **is** the window. */
  readonly scaleToken?: string;
  /** Which surface must be open for `productSelector` to be the element meant.
   *  Both dialogs render `.editor-shell-dialog` from one rule, so the two are
   *  told apart by the route that opened them, not by the DOM; `fixture` is the
   *  control-set page, which is the only surface the control set renders on.
   *  A row with a surface is asserted where that surface is open — the shell
   *  test skips it.
   *
   *  **The settings modal's three panels are three surfaces, not one.** Base UI
   *  tabs keep the inactive panels out of the DOM, so a Keyboard row read with
   *  the modal open would measure no element at all and report "the row
   *  measured nothing" — a lie about a panel that is drawn and rendered. The
   *  two panel surfaces are read with their tab showing (plan 8 Task 4). */
  readonly surface?:
    | "settings"
    | "settings-keyboard"
    | "settings-about"
    | "sheet"
    | "fixture";
  /** The text of a **predating** normative rule that positively requires the
   *  product's treatment, quoted. Not free text: `licenceFindings` refuses a
   *  licence that names no source from spec §13's set, quotes nothing of that
   *  source, or names a rule written by the commit that cites it — asserted in
   *  `mockup-values.test.ts`, since this table is the only place the licence
   *  text and the rule it cites can be read together. */
  readonly licensed?: string;
  /** The row's value **is the drawing's silence** about `mockupProperty` — a
   *  region it draws flush or square, whose omission is the `0` the product
   *  must render (the four body regions and the four panel radii).
   *
   *  **Required, not decorative.** A row whose selector declares no
   *  `mockupProperty` is otherwise indistinguishable from a row that misspelt
   *  one: both read the drawing's silence, and a silent pass is exactly what
   *  `vg-304` is about. So the reading is asserted both ways
   *  (`assertParityRowProperty`) — an unmarked row naming an undeclared
   *  property throws, and a marked row on an element that *does* declare it
   *  throws too, because then the marker is stale. */
  readonly mockupSilence?: true;
  /** Which comparator reads this row's two values. **Absent means `length`**,
   *  the px reading every row used before the modal's regions arrived; `count`
   *  is a track list's number of tracks (`trackCount`) and `colour` is a colour
   *  as a resolved value (`colourValue`). Both were added by plan 8 Task 1 for
   *  the regions a single px cannot express — the palette grid's column count
   *  and the modal's scrim — and a row whose value is not one the named
   *  comparator reads fails naming the whole rendered value. */
  readonly comparator?: "length" | "count" | "colour";
};

/* ── The licence policy ──────────────────────────────────────────────────────
 *
 * **The defect this closes is `vg-292`.** `licensed` was free text, and a row
 * carrying one was *recorded* rather than compared, so a reason discharged the
 * gate by existing. Plan 5's Task 6 recorded ten of the modal's eleven
 * differences as deliberate, each citing the *silence* of a section as its
 * warrant, and the aggregate was a modal the user said looked nothing like the
 * drawing. Spec §13's amendment of 2026-10-10 states the policy this file now
 * enforces: a deliberate difference must "name the normative source that
 * requires it, quoted", that source "can only be a bible `§N`, an ADR, or this
 * spec", and "only a licence that predates the divergence counts".
 *
 * **Three refusals, each one a reason the old gate accepted.** A licence that
 * names no source; a licence that quotes nothing, or quotes text its named
 * source does not contain (the shape of every "the section does not forbid it"
 * reason); and a licence naming a rule introduced by the commit that cites it,
 * which is what plan 5 did when it added §5's choice row and then cited it.
 *
 * **The `§N` arm resolves through `design-md --cite`, and nothing here parses
 * DESIGN.md's markers.** The canonical range arrives as `canonicalNumbers`, so
 * the check's own constant is the only owner of "which numbers are a section",
 * and the marker each number resolves to is the checker's rule, not a second
 * one written here — the licence lives under `src/`, so `--cite` already scans
 * it. `mockup-values.test.ts` calls `checkCitations` over each licence for the
 * half this predicate delegates.
 *
 * **What this cannot read.** Whether the *product* treatment a row records is
 * itself the divergence — a row can name a region it matches. A `§N` quotation
 * is found in DESIGN.md's whole text rather than in the named section, so a
 * licence can quote one section's words under another's number; finding the
 * section a marker opens would be a second reader of a namespace
 * `design-md.mjs` owns. And predating is read as commit identity, not ancestry:
 * a rule split into a later commit of the same change passes, and a licence that
 * is **not committed yet** has no commit to compare, so the check stays silent
 * until the commit that adds it lands — the same shape as `vg-287`'s recorded
 * capture sha, which is read against history rather than against the tree.
 * `ponytail:` commit identity and document-wide quotation are the ceiling —
 * upgrade to `git merge-base --is-ancestor` against the commit that introduced
 * the product's own deviation once a row records that commit, and to a
 * marker-section reader if a mislabelled quotation ever costs a review.
 */

/** The spec that owns §13, and so the third source spec §13 admits. Named here
 *  because the rule and the file it is written in are one fact. */
export const LICENCE_SPEC =
  "docs/superpowers/specs/2026-10-08-editor-design-language-design.md";

/** A source a licence may name, with the text it must quote. `text` is `null`
 *  for a decision note or spec the tree does not hold — a licence naming a file
 *  that is not there is a finding, not a crash. */
export type LicenceSource = {
  /** The token as the licence writes it: `§7.5`, a `docs/decisions/…` path, or
   *  the spec's own path. This is what `introducedAt` is keyed on. */
  readonly label: string;
  readonly text: string | null;
};

/** Everything the licence policy reads, supplied by the caller so the predicate
 *  stays pure and its decisions are pinned with fixtures.
 *
 *  **The git-shaped members are the caller's to fill.** `licensedAt` is the
 *  commit that introduced the licence text and `introducedAt(label)` the commit
 *  that introduced the rule the label names; the two are compared for identity.
 *  Keeping them out of this module is what lets a unit test date a fixture
 *  without a repository. */
export type LicenceLedger = {
  /** `DESIGN.md`'s text — where a `§N` licence's quote has to be found. */
  readonly design: string;
  /** Every `docs/decisions/**` note the tree holds, keyed by the path a licence
   *  writes for it. */
  readonly decisions: ReadonlyMap<string, string>;
  /** The spec §13 lives in: its path, and its text. */
  readonly spec: { readonly path: string; readonly text: string };
  /** `scripts/design-md.mjs`'s `CITE_NUMBERS` — the numbers that are a
   *  DESIGN.md section. Transcribed nowhere: the caller imports the constant. */
  readonly canonicalNumbers: readonly string[];
  /** The commit that introduced the licence. */
  readonly licensedAt: string | null;
  /** The commit that introduced the rule `label` names, or `null` when the tree
   *  does not hold it or nothing dates it. */
  readonly introducedAt: (label: string) => string | null;
};

const LICENCE_SECTION = /§(\d+(?:\.\d+)?)/g;
const LICENCE_DECISION = /docs\/decisions\/\d{4}-[a-z0-9-]+\.md/g;
/** The spaced spellings a licence may use for a quotation: `"…"`, `“…”`. */
const LICENCE_QUOTES = [/"([^"]+)"/g, /“([^”]+)”/g];

/** Whitespace collapsed, so a rule a file wraps across lines is still the text a
 *  licence quotes — §7.5's sentence spans three lines of DESIGN.md. */
const flatten = (text: string): string => text.replace(/\s+/g, " ").trim();

/** The sources a licence names, in the order it names them, without repeats.
 *  Exported so a caller can date each label without re-reading the licence. */
export function licenceSources(
  licensed: string,
  ledger: LicenceLedger,
): LicenceSource[] {
  const found = new Map<string, LicenceSource>();
  const add = (label: string, text: string | null) => {
    if (!found.has(label)) found.set(label, { label, text });
  };
  for (const match of licensed.matchAll(LICENCE_SECTION)) {
    const number = match[1] ?? "";
    // A number outside the canonical range belongs to another document's
    // numbering (the redesign spec's own `§N`), so it names no DESIGN.md rule.
    if (!ledger.canonicalNumbers.includes(number)) continue;
    add(`§${number}`, ledger.design);
  }
  for (const match of licensed.matchAll(LICENCE_DECISION)) {
    add(match[0], ledger.decisions.get(match[0]) ?? null);
  }
  if (licensed.includes(ledger.spec.path)) {
    add(ledger.spec.path, ledger.spec.text);
  }
  return [...found.values()];
}

/** Why a `licensed` string does not discharge the gate, one line per reason; an
 *  empty list is a licence that does.
 *
 *  A licence must name a source from the set spec §13 admits, that source's own
 *  words must appear in it as a quotation, and the source must not have been
 *  written by the commit that cites it. Each refusal names the row's licence so
 *  the finding can be read against the row it is about. */
export function licenceFindings(
  licensed: string,
  ledger: LicenceLedger,
): string[] {
  const sources = licenceSources(licensed, ledger);
  if (sources.length === 0) {
    return [
      "names no normative source: spec §13 admits a DESIGN.md `§N`, a `docs/decisions/` note or the design spec, and this reason names none of them",
    ];
  }
  const quotes = LICENCE_QUOTES.flatMap((pattern) =>
    [...licensed.matchAll(pattern)].map((match) => flatten(match[1] ?? "")),
  );
  const findings: string[] = [];
  for (const source of sources) {
    if (source.text === null) {
      findings.push(
        `names \`${source.label}\`, which the tree does not hold, so there is no rule to read`,
      );
      continue;
    }
    // The decisive one: a section's *silence* cannot be quoted, so every reason
    // that cited what a section does not say dies here.
    const body = flatten(source.text);
    if (!quotes.some((quote) => quote !== "" && body.includes(quote))) {
      findings.push(
        `names \`${source.label}\` without quoting it: spec §13 requires the source's own text, and a section's silence is not quotable`,
      );
    }
    const at = ledger.introducedAt(source.label);
    if (at === null) {
      findings.push(
        `names \`${source.label}\`, which nothing dates, so its rule cannot be shown to predate the divergence it licenses`,
      );
    } else if (at === ledger.licensedAt) {
      findings.push(
        `names \`${source.label}\`, written in the same commit as the licence that cites it: a rule this change writes cannot license this change's divergence`,
      );
    }
  }
  return findings;
}

/** A `PARITY` row's `mockupProperty`, checked against the set its
 *  `mockupSelector` actually declares (`vg-304`).
 *
 *  **The hole this closes is silence mistaken for a reading.** `mockupDeclared`
 *  throws when the drawing declares no value, but `mockupDeclaredOrNull`
 *  answers `null` — the row's own reading of a region drawn flush — and a row
 *  that *misspelt* its property reads the same `null` and passes. Nothing
 *  related the two before: a row naming `border-radius` where its element
 *  declares `gap` compared the drawing's silence, and a real value on the wrong
 *  property still reads as a pass.
 *
 *  So a row must say which of the two it means. Without `mockupSilence` the
 *  drawing must declare the property it names; with it, the drawing must
 *  *not* — a marker on an element that declares the property is a stale claim
 *  about a declaration that now exists. The set is read through `addressed`, so
 *  a selector that addresses nothing or settles between two elements throws here
 *  as it does for a value. */
export function assertParityRowProperty(
  mockupHtml: string,
  row: ParityRegion,
): void {
  const selector = row.mockupSelector ?? "";
  const declared = mockupDeclaredProperties(mockupHtml, selector);
  // The set matches property names exactly, so a shorthand the drawing writes is
  // invisible to it — and not to the value path, which refuses to read a longhand
  // out of one. Ask it before either branch below can call the property absent, so
  // the two readings of the same drawing cannot disagree about whether it is there.
  mockupDeclaredOrNull(mockupHtml, selector, row.mockupProperty);
  if (declared.includes(row.mockupProperty)) {
    if (row.mockupSilence === true) {
      throw new Error(
        `\`${row.region}\` says its value is the drawing's silence about \`${row.mockupProperty}\`, but \`${selector}\` declares it: the marker is stale and the row is comparing a declaration it claims the drawing does not make`,
      );
    }
    return;
  }
  if (row.mockupSilence === true) return;
  throw new Error(
    `\`${row.region}\` names \`${row.mockupProperty}\`, which \`${selector}\` does not declare (it declares \`${
      declared.join("`, `") || "nothing"
    }\`): a row reading a property its element does not carry compares the drawing's silence, not a value`,
  );
}

/**
 * The shell's regions, as the census adjudicates them
 * (`.superpowers/sdd/2026-10-10-shell-parity/adjudication.md`).
 *
 * Every row here is one `design-language.spec.ts` asserts. The measured
 * differences are the four body regions the drawing draws **flush** and
 * **square**, and both dialogs' frames. `height` on the header is the **positive
 * control**: the drawing and the product already agree on 42px, so a run that
 * finds no failures at all is caught as a reader that stopped reading rather
 * than reported as a shell that came right.
 *
 * **Two regions the superseded drawing drew have no row here, because they have
 * no counterpart element** (the census records both as `no-counterpart`): the
 * shell frame there was a `1180px` card bounding the app *inside a page*, and
 * the product's editor **is** the window and fills it, so no product element
 * carried that card's radius or its border. `current/shell.html` draws the shell
 * as the window and has no card, so the frame is gone rather than measured.
 *
 * Two rows the census adjudicates are deliberately *not* here, and say so rather
 * than being implied: the graphite role values are Task 4's assertions (the
 * drawing declares them in its own token table, and the reader gains that target
 * then), and every `fix` row whose owner is another plan or another backlog row
 * is named in plan 8's census instead of asserted here.
 *
 * **The settings modal's regions are the tail of this table** (plan 8 Task 1,
 * `.superpowers/sdd/2026-10-11-settings-parity/adjudication.md`): six rows
 * against `current/settings.html` and the shipped modal, four of them reading a
 * *drawing* selector now that the modal has its own file. They are red on the
 * build this table landed on — that is the instrument's contract, and a row that
 * cannot fail is the defect it exists to end (spec §13). Three rows before them
 * (the boxed switch row, its gap, and the two control drawings' label column)
 * already reach into `settings.html` through `mockupPath`.
 */
export const PARITY: readonly ParityRegion[] = [
  {
    region: "header — height",
    mockupSelector: '[style*="height:42px"]',
    mockupProperty: "height",
    productSelector: ".editor-shell-header",
    designLanguageSection: "§7.1, §7's diagram",
  },
  {
    region: "body — inset",
    mockupSelector: '[style*="flex:1;min-height:0"]',
    mockupProperty: "padding-top",
    productSelector: ".editor-shell-body",
    designLanguageSection: "§7's diagram, §3 elevation 0",
    mockupSilence: true,
  },
  {
    region: "body — gap",
    mockupSelector: '[style*="flex:1;min-height:0"]',
    mockupProperty: "column-gap",
    productSelector: ".editor-shell-body",
    designLanguageSection: "§7's diagram, §3 elevation 0",
    mockupSilence: true,
  },
  {
    region: "rail — radius",
    mockupSelector: '[style*="width:46px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-rail",
    designLanguageSection: "§3 radius table, §7's diagram",
    mockupSilence: true,
  },
  {
    region: "left pane — radius",
    mockupSelector: '[style*="width:246px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-panel",
    designLanguageSection: "§3 radius table, §7's diagram",
    mockupSilence: true,
  },
  {
    region: "stage — radius",
    mockupSelector: '[style*="repeating-linear-gradient(45deg"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-stage",
    designLanguageSection: "§3 radius table, §7's diagram",
    mockupSilence: true,
  },
  {
    region: "inspector — radius",
    mockupSelector: '[style*="width:276px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-inspector",
    designLanguageSection: "§3 radius table, §7's diagram",
    mockupSilence: true,
  },
  /* **A dialog's radius is not the drawing's to give.** The only 10px frame the
     superseded drawing had was the window's own — `.mockup` and the shell card it
     wrapped — and both belong to a drawn window, which the product does not have;
     `current/settings.html` draws no window and so has no frame for a row to
     name. DESIGN.md §3's radius table is closed (4/6/8/10) and gives 10 to
     "Floating clusters (dock, view controls, identity chip)" only; a modal is not
     a cluster, so both dialogs are panels and take `--radius-lg`. So this row's
     comparator is the **scale**, read from the product's own `:root` declaration
     (`scaleToken`) rather than written here, and it stays red until Task 3.
     Two rows, because both dialogs render the one `.editor-shell-dialog` rule
     (`shortcut-reference.tsx` and `settings.tsx`) and a change made for one is
     exactly what a single row would miss. */
  {
    region: "settings modal — frame radius",
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-dialog",
    designLanguageSection: "§3 radius table",
    scaleToken: "--radius-lg",
    surface: "settings",
  },
  {
    region: "`?` sheet — frame radius",
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-dialog",
    designLanguageSection: "§3 radius table",
    scaleToken: "--radius-lg",
    surface: "sheet",
  },
  {
    /* The one composition difference a predating rule addresses: §7.5 admits
       both treatments, so the drawing's texture is not the product's obligation.
       Recorded rather than asserted — see the census's `licensed` tally. */
    region: "stage ground — texture",
    mockupSelector: '[style*="repeating-linear-gradient(45deg"]',
    mockupProperty: "background",
    productSelector: ".editor-shell-stage",
    designLanguageSection: "§7.5",
    licensed:
      '§7.5: "Subtle palette-derived stage texture is permitted when it stays behind the artwork and does not obscure controls; neither texture nor a flat ground is mandatory."',
  },
  /* **The control set's own drawing, read on the fixture.** Both files are the
     inspector column and both declare the same row: a label column of
     `width:74px;flex:0 0 auto` and a value cell of `flex:1`. The product
     declared neither, so a number well was as wide as its `<input>`, a select
     filled the slot and a segmented group hugged its right edge — four widths
     in one section where the drawing draws one (`vg-297`).

     **The selector names the long-copy label, and that is not an accident.**
     Eleven of the twelve labels carry `width:74px;flex:0 0 auto` with nothing
     after it, and the twelfth — the one over the multi-line well — carries the
     same declaration plus `padding-top:4px`. A `[style*="…"]` selector is a
     substring match, so every prefix of the eleven also matches the twelfth and
     the reader refuses to pick one; the twelfth is the *only* address that
     settles which element is meant, and it declares the same column. Two rows
     rather than one because the drawings are two files, and one of them having
     drifted is exactly what a single row could not say. */
  {
    region: "field row — label column (controls drawing)",
    mockupPath: CONTROLS_MOCKUP_PATH,
    mockupSelector:
      '[style*="width:74px;flex:0 0 auto;color:var(--muted);font-size:11px;padding-top:4px"]',
    mockupProperty: "width",
    productSelector: '[data-fixture="text"] label',
    designLanguageSection:
      "§5 (the shared grid); DESIGN.md is silent on the column's width, so the drawing governs",
    surface: "fixture",
  },
  {
    region: "field row — label column (controls-editorial drawing)",
    mockupPath: CONTROLS_LIGHT_MOCKUP_PATH,
    mockupSelector:
      '[style*="width:74px;flex:0 0 auto;color:var(--muted);font-size:11px;padding-top:4px"]',
    mockupProperty: "width",
    productSelector: '[data-fixture="text"] label',
    designLanguageSection:
      "§5 (the shared grid); DESIGN.md is silent on the column's width, so the drawing governs",
    surface: "fixture",
  },
  /* **The two shapes a row takes when a drawing shapes it differently.** The
     field row above is the default; these two are the rows the drawings draw as
     something else, and each is read from the drawing that draws it rather than
     from a value chosen here (`vg-302`).

     **Two properties each, because the drawing declares two.** The box's
     `border-radius` alone was the instrument claiming more coverage than it had:
     the product's `gap` matched the drawing's by construction, and nothing
     compared it. Reading one of a drawing's two declared values is `vg-292`'s
     family, which is the family this task exists to leave.

     The settings modal's switch row: `settings.html:89-93` draws it as a
     `--panel-2` box at `--radius-lg`, the label at `flex:1` and the 26×14
     switch at the right — no label column. That box is why the row is a shape
     and not a width: applying the inspector's 74px column to it wrapped
     "Follow the system" onto a second line. The drawn box's inset is §3's `8px`
     (the off-scale `9px` was drawing-stale, `vg-303`); the drawing writes it as
     a `padding` shorthand, which `lookup` refuses to read a longhand from, so no
     row holds it and the rows read the radius and gap the drawing declares.

     The drawing's `gap: 10px` is the row's own: label to switch. The pane
     picker's `gap: 6px` is inside its trigger, name to chevron, which is the
     element the row names. */
  {
    region: "field row — the settings switch row's box (settings drawing)",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--panel2);border:1px solid var(--edge);border-radius:8px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-fixture="boxed"] > div',
    designLanguageSection:
      "§5 (the well); DESIGN.md does not shape the modal's switch row, so the drawing governs",
    surface: "fixture",
  },
  {
    region: "field row — the settings switch row's box, label to switch",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--panel2);border:1px solid var(--edge);border-radius:8px"]',
    mockupProperty: "gap",
    productSelector: '[data-fixture="boxed"] > div',
    designLanguageSection:
      "§5 (the well); DESIGN.md does not shape the modal's switch row, so the drawing governs",
    surface: "fixture",
  },
  /* The shell's select-trigger box — the well-with-chevron form the drawing
     writes on the Add pane's picker and twice on the inspector's own triggers.

     **The row reads the inspector's instance, and the title names it rather than
     claiming the picker.** `shell.html:129` (the picker) declares the trigger as
     `display:flex;align-items:center;gap:6px;…;border-radius:6px;padding:4px
     8px`; `:275` and `:312` (the inspector's triggers) declare exactly that plus
     a leading `flex:1;`, so the picker's attribute is a **suffix** of theirs and
     every substring that matches it matches them too. A `[style*="…"]` selector
     therefore cannot settle the picker alone — a shorter one addresses three
     elements and `lookup` refuses — and the declaration the row can read is the
     inspector's. Its `border-radius` and `gap` are the picker's too, and the
     product side of both rows is the picker (`control-fixture.tsx`'s `headed`
     element, the fixture's copy of `shell.html:128-132` because the Add pane is
     closed while Document is open). What the column's *absence* buys the picker
     is geometry, and the fixture asserts that: the control starts where the row
     starts. */
  {
    region: "field row — the inspector select trigger box (shell drawing)",
    mockupPath: MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--edge);border-radius:6px;padding:4px 8px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-fixture="headed"] [data-fixture-select]',
    designLanguageSection:
      "§5 (the well the trigger is drawn as); DESIGN.md does not shape the pane's picker, so the drawing governs",
    surface: "fixture",
  },
  {
    region: "field row — the inspector select trigger box, name to chevron",
    mockupPath: MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--edge);border-radius:6px;padding:4px 8px"]',
    mockupProperty: "gap",
    productSelector: '[data-fixture="headed"] [data-fixture-select]',
    designLanguageSection:
      "§5 (the well the trigger is drawn as); DESIGN.md does not shape the pane's picker, so the drawing governs",
    surface: "fixture",
  },
  /* ── The settings modal, against `current/settings.html` (plan 8 Task 1) ────
     The drawing is now the modal's comparator for the regions it draws, read on
     the `settings` surface: the modal is opened by the gear, its Appearance panel
     is the default tab, and every element below exists only while it is open
     (plan 7's `surface` control set — no new machinery).

     **These rows are red on the build they land on, on purpose.** Tasks 2, 3 and
     5 pull the product to the drawing, and each row names its task in the census.
     A row loosened, skipped or `test.fixme`d to reach green would be the defect
     this table exists to end, so none is. Task 2 has since answered two of them —
     row 1 and row 2 below read green — and the note each carries says how.

     **Row 1 — the navigation's axis.** The drawing is a `150px` column with an
     icon per row; the product *was* a horizontal word strip with no width of its
     own, and is now the column the drawing draws (Task 2). The *width* is the
     one property the axis has, and it is what this row reads: a strip's width is
     its container's, a column's is its own — and the column's is on the element
     this row names, with no padding or border on it, because a border-box width
     would shorten the content box a `width` reading returns. The axis's
     *direction* — and the keyboard model it implies — is not a property and is a
     named gap in the census, Task 2's browser walk being its evidence.

     The rule that makes the drawing govern is **§5** — "The vocabulary
     is closed. A control is one of these, or it is not a control", with no *tab*
     in it, so DESIGN.md requires nothing about the axis — and **spec §13**
     (`:451-454`), which names this very strip: "The mockup governs wherever the
     written rules are silent. Silence is not permission — it is the drawing's
     jurisdiction."

     **Row 2 — the lead's role.** §2 gives a dialog exactly two type roles, and
     the product's `<h2>` was neither: `--text-md` (13px) on `--shell-text` where
     the drawing puts the surface's name on the nav as a `--text-2xs` eyebrow.
     The `<h2>` is the modal's own title and the `?` sheet renders the same rule,
     so its role is §2's dialog title, `--text-lg` — read from the product's own
     `:root`, so this row cannot drift from the token. **Task 2 removed the
     eyebrow marks with the size**: §2 reserves uppercase for a section
     eyebrow ("Nothing else is uppercase"), and the rule covers the dialog's
     visible name at seven sites, five of them `<p>`s that render the same string
     the dialog passes as its `label`. The theme library's `role="status"` node
     no longer wears the rule — a status is not a name — and takes
     `.editor-shell-dialog-status` instead.

     **Row 3 — the scrim, and the first colour row.** `#0009` is 60% black where
     §3's modal scrim is `#00000073`, 45%, and a hex literal where §10 forbids one
     in a surface; both are vg-294. The expected value is the token Task 3
     declares — `--elev-scrim` — read from `:root` at run time, so the row follows
     the token rather than a copy of DESIGN.md's number. Until that token exists
     the row reads "the product declares no `--elev-scrim`", which is the failure
     it is for. A *colour* cannot ride `lengthInPx` (it returns `null` for a
     colour) and the drawing draws no scrim at all, so this is the one row whose
     comparator is a resolved colour.

     **Rows 4–6 — the palette group.** The drawing is a `repeat(3,1fr)` grid of
     `--radius-lg` cards, each carrying two 16px bars — the palette's ground and
     its accent. The product is a `grid-cols-2` of `--radius-md` choice rows,
     each carrying one 14px chip. The count is read by `trackCount` (a
     track list is neither side a single px), the card's radius by the px reading,
     and the bar's height by the px reading against the one bar the reader can
     settle: the other eleven carry the same prefix, so a shorter selector would
     address twelve elements and `lookup` refuses rather than pick one. `§5`'s
     choice row is the licence spec `:469-477` withdraws — plan 5 wrote it and
     then cited it — so the drawing governs.

     **The shape is the part of it no row can read.** One chip versus two bars is
     a difference in how many elements the card carries and what each carries, not
     a property of one element; the census names that gap rather than pretending
     the bar's height is the whole finding. */
  {
    region: "settings nav — column width (the axis)",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector: '[style*="width:150px"]',
    mockupProperty: "width",
    productSelector: ".editor-shell-settings-tabs",
    designLanguageSection:
      "§5 closes the vocabulary — no *tab* control is in it, so DESIGN.md requires nothing about the axis — and spec §13 (`:451-454`) makes the drawing its jurisdiction where the rules are silent, naming this strip at `:458-459`",
    surface: "settings",
  },
  {
    region: "settings modal — lead type",
    mockupProperty: "font-size",
    productSelector: ".editor-shell-dialog-lead",
    designLanguageSection: "§2 — a dialog title is `--text-lg` 15px (`vg-295`)",
    scaleToken: "--text-lg",
    surface: "settings",
  },
  {
    region: "settings modal — scrim",
    mockupProperty: "background-color",
    productSelector: ".editor-shell-dialog-overlay",
    designLanguageSection:
      "§3 elevation 3 — the modal's scrim is `#00000073`; §10 forbids a hex literal in a surface (`vg-294`)",
    scaleToken: "--elev-scrim",
    comparator: "colour",
    surface: "settings",
  },
  {
    region: "palette grid — column count",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector: '[style*="display:grid"]',
    mockupProperty: "grid-template-columns",
    comparator: "count",
    productSelector: '[aria-labelledby="vigilia-settings-palette"]',
    designLanguageSection:
      "§5 rule 7 leaves the grid to the drawing, which draws three columns; no section names a column count",
    surface: "settings",
  },
  {
    region: "palette card — radius",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="border:1px solid var(--edge);border-radius:8px;padding:8px;background:var(--panel2)"]',
    mockupProperty: "border-radius",
    productSelector: "[data-vigilia-palette-choice]",
    designLanguageSection:
      "§3 radius table — a card in a grid is `--radius-lg`; §5's choice row is the licence spec `:469-477` withdraws",
    surface: "settings",
  },
  {
    region: "palette swatch — bar height",
    mockupPath: SETTINGS_MOCKUP_PATH,
    // **Re-anchored on the value the drawing now paints.** The selector was
    // `background:#fffdf7` — editorial's *surface* — and the user's ruling that
    // the bar depicts the palette's **ground** (`vg-321`, 2026-10-11) repainted
    // the drawing's bar to `#f5f1e8`, so the old substring matched nothing. The
    // bar's own colour is the honest anchor: it is the value, it says what was
    // drawn, and a bar repainted again moves the address rather than passing.
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#f5f1e8"]',
    mockupProperty: "height",
    productSelector: ".editor-shell-palette-swatch",
    designLanguageSection:
      "§7.8 — 'Palette choices retain visual swatches'; the swatch's form is the drawing's, and §5 names a swatch, never one",
    surface: "settings",
  },
  /* ── The ground bar's COLOUR, one row per solid-ground palette (`vg-321`) ───
     The 2026-10-11 ruling makes the bar depict the palette's **ground** — §4's
     `--bg`, `--shell-backdrop` — and names the drawing's six bars the stale
     side. The height row above reads **only the first rendered bar**
     (editorial's, `readRows`), so a bar's *colour* was compared against
     nothing and every palette passed; each row below is therefore keyed to its
     own palette with a compound `productSelector`, because the grid renders all
     six bars at once and one `.editor-shell-palette-swatch` can only address the
     first of them.

     **Light is deliberately absent, and its bar's colour is therefore
     unverified.** Its ground is a *gradient* (`editor-shell.css:281`, and the
     drawing draws the same `linear-gradient(145deg,#d8ebe4,#afd4d1)`), so the
     product's `background-color` resolves to `rgba(0, 0, 0, 0)` and a gradient
     is exactly what `colourValue` answers `null` for — a colour row would fail
     on a surface that is correct. No `scaleToken` can cover the six either:
     scale tokens are read once from `:root`, which carries only editorial's
     baseline. Five solid grounds are what this instrument can read honestly;
     the light bar needs a gradient-aware comparator that does not exist. */
  {
    region: "palette swatch — editorial ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#f5f1e8"]',
    mockupProperty: "background-color",
    productSelector:
      '.editor-shell-palette-swatch[data-shell-palette="editorial"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    region: "palette swatch — graphite ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#0b0e12"]',
    mockupProperty: "background-color",
    productSelector:
      '.editor-shell-palette-swatch[data-shell-palette="graphite"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    region: "palette swatch — ember ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#e9cdb4"]',
    mockupProperty: "background-color",
    productSelector: '.editor-shell-palette-swatch[data-shell-palette="ember"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    region: "palette swatch — moss ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#cfe0bb"]',
    mockupProperty: "background-color",
    productSelector: '.editor-shell-palette-swatch[data-shell-palette="moss"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    region: "palette swatch — plum ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#dccdef"]',
    mockupProperty: "background-color",
    productSelector: '.editor-shell-palette-swatch[data-shell-palette="plum"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    /* **The frame's inset — the one settings region a predating rule keeps, and
       the licence is §3's own spacing table.** The census records `#4` and `#7`
       as one composition difference: the drawing's frame carries no padding of
       its own and insets *from its children* (`current/settings.html:41`
       `padding:14px 16px`, `:22` `padding:10px 6px`), while `.editor-shell-dialog`
       carries `padding: 20px 24px` on the frame and none on the panel. The two
       differ in **where** the inset sits, not in whether there is one — and §3
       positively requires `20–24` for "dialog padding", which is the
       product's value, so this is a difference kept by a rule that predates it,
       not a defect.

       **Task 2 Step 2 may move this value.** It rebuilds `.editor-shell-dialog`'s
       padding as part of the nav (its `Produces`: "a `.editor-shell-dialog` whose
       padding is the nav's geometry rather than a padded column around a strip"),
       so this licence is re-examined when that lands rather than silently
       inherited — the row names the value, so a change to it brings the reader
       back here.

       The selector reads the drawing's *own* inset declaration (`:41`), because
       that is the half of the pair the drawing states as a value: the frame's
       silence about padding is the other half, and it is silence this reader
       would report as the drawing drawing nothing. */
    region: "settings modal — the frame's inset (the dialog's padding)",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector: '[style*="flex:1;min-width:0;padding:14px 16px"]',
    mockupProperty: "padding",
    productSelector: ".editor-shell-dialog",
    designLanguageSection: "§3 spacing",
    surface: "settings",
    licensed:
      '§3: "| 20–24 | Between regions; dialog padding |" — the product renders `padding: 20px 24px` on `.editor-shell-dialog`, the value §3 requires for a dialog; the drawing draws no frame padding and insets its children (`current/settings.html:41` `padding:14px 16px`) instead.',
  },
  /* ── The modal's two other panels (plan 8 Task 4) ───────────────────────────
     The census recorded six regions as `no-counterpart` because the current set
     drew the Appearance panel alone (`adjudication.md:96-101`, rows `#13`–`#18`).
     The Keyboard and About panels are now drawn, each on its own file, and these
     are the values those drawings declare for the regions the product renders.

     **The drawing is the target and the rows are red on purpose.** They are
     pulled green by Task 7, which owns the Keyboard panel; the About row passes,
     because that panel is drawn as the product renders it (the census's
     `drawing-stale` repair of a capability the drawing lacked) rather than
     redrawn, and the release row it would carry is absent on both sides
     (`vg-288`, still open).

     **What is not a row, and why.** `#13`'s *placement* — the return-to-default
     action moving into a panel header — and `#16`/`#17`'s armed row and its
     refusal are not values of one element: the first is a shape the drawing now
     draws and the second two are states, of which a drawing shows one
     (`mockups/README.md`). They are Task 7's driven captures (§13.1), not
     comparators, and the census's gap list is where a shape belongs.

     **The chord mark's two declared values are read together**, the shape the
     settings switch row's box already uses: the chip is a bordered mono mark in
     the drawing and a bare `<kbd>` in the product, so its radius and its inset
     are the two halves of one difference. Both rows address the same element —
     twenty unchanged chips in the drawing, which is **one** element form to the
     reader (`addressed` counts identical attributes once), so the selector
     settles which is meant.

     **The row container's radius is a row the census does not carry**, added at
     review: `#13`–`#17` are the header, the chip, the per-row control, the armed
     row and the refusal, and none of them is the container those sit in. §3's
     table puts it out of reach of the value the product declared — a binding row
     is a row, so `--radius-md` and not `--radius-sm` — and the drawing draws 6px.
     Its selector is the container's whole declaration, which twenty rows carry
     identically: one element form, the same reading the chip's row uses. The
     container's `padding:4px 6px` is a shorthand this row does not read, so
     `lookup`'s guard is not tripped. */
  {
    region: "keyboard — the shortcut row's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:center;gap:16px;padding:4px 6px;border-radius:6px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-keyboard [data-vigilia-shortcut-row]",
    designLanguageSection:
      "§3 radius table — `--radius-md` 6px is 'Controls, menu rows, small tiles' and a binding row is a row; `--radius-sm` 4px is 'Swatches, inline chips, the slider thumb's container'",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the chord mark's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="border:1px solid var(--edge);border-radius:4px;padding:4px;font:400 11px/1.2 ui-monospace,Menlo,monospace;color:var(--muted)"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-keyboard kbd",
    designLanguageSection:
      "§2 — a chord mark is mono, so it is a value; §3 radius table — `--radius-sm` 4px is 'Swatches, inline chips'",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the chord mark's inset",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="border:1px solid var(--edge);border-radius:4px;padding:4px;font:400 11px/1.2 ui-monospace,Menlo,monospace;color:var(--muted)"]',
    mockupProperty: "padding",
    productSelector: ".editor-shell-keyboard kbd",
    designLanguageSection:
      "§3 spacing — 4px is 'Inside a control (well padding, icon button)'",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the per-row return-to-default action's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:0 0 auto;border:1px solid var(--edge);border-radius:6px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-vigilia-shortcut-reset="file.new"]',
    designLanguageSection:
      "§3 radius table — `--radius-md` 6px is 'Controls, menu rows, small tiles', and a button is a control; the dialog's own Close already takes it",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the return-to-default action's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="margin-left:auto;border:1px solid var(--edge);border-radius:6px"]',
    mockupProperty: "border-radius",
    productSelector: "[data-vigilia-shortcut-reset-all]",
    designLanguageSection:
      "§3 radius table — `--radius-md` 6px is 'Controls'; the same value the per-row action takes, one act being one control",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the rebind control's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-vigilia-shortcut-arm="file.new"]',
    designLanguageSection:
      "§5 — 'Icon button — A 26–30px square at `--radius-md`, glyph only'",
    surface: "settings-keyboard",
  },
  {
    region: "about — the read-only row's label-to-value gap",
    mockupPath: SETTINGS_ABOUT_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:4px 0"]',
    mockupProperty: "gap",
    productSelector: "[data-vigilia-about] dl > div",
    designLanguageSection:
      "§5 rule 2 — 'Read-only rows are label + mono value, baseline-aligned, right-aligned'",
    surface: "settings-about",
  },
];

/** One element the current set **copies** from the original drawing, with the
 *  treatment values the copy is held to. */
export type CopiedElement = {
  /** Names the element for a failure message. */
  readonly region: string;
  /** The current drawing the element is drawn in. */
  readonly drawing: string;
  /** The element's address *in that drawing*. */
  readonly selector: string;
  /** The same element's address in `ORIGINAL_MOCKUP_PATH`. */
  readonly originalSelector: string;
  /** The properties copied unchanged — the treatment, not the layout. */
  readonly properties: readonly string[];
};

/** What a copied element declares that its original does not, one line per
 *  drifted property (`vg-320`).
 *
 *  **A copied value is not a scale question.** The drawings gate asks whether a
 *  value is one §3 has, and the keyboard drawing shipped a `4px` row container
 *  where the original draws `6px` with every gate green: 4px *is* `--radius-sm`.
 *  So this reads the pair the doctrine makes — README: "Colour, spacing,
 *  radii, type, elevation, hairlines ... are copied from the original
 *  drawings" — and an empty answer is the reading that the copy is intact.
 *
 *  Read through `mockupDeclared` on **both** sides, so a stale address or a
 *  property the element stopped declaring throws rather than comparing an
 *  empty string against a real value. */
export function copiedElementDrift(
  currentHtml: string,
  originalHtml: string,
  entry: CopiedElement,
): readonly string[] {
  const drift: string[] = [];
  for (const property of entry.properties) {
    const copied = mockupDeclared(currentHtml, entry.selector, property);
    const original = mockupDeclared(
      originalHtml,
      entry.originalSelector,
      property,
    );
    if (copied !== original) {
      drift.push(
        `${property}: the drawing declares \`${copied}\`, the original \`${original}\``,
      );
    }
  }
  return drift;
}

/** The elements the current set copies from the original, and the values a copy
 *  is held to.
 *
 *  **A named list, because a file diff is noise.** The current drawings are
 *  redrawn with the product's real content, and the original's off-scale values
 *  — its `gap:3px`, its `padding:7px 8px`, the chord chip's `border-radius:5px`
 *  — are normalised onto §3's closed scale on the way across, so comparing
 *  whole elements reports the normalisation as drift and is turned off within a
 *  week. Each entry therefore names the properties copied *unchanged*, and the
 *  row container's `gap` (16px here against the original's 10px) is
 *  deliberately not one of them: it is the current set's own density, already
 *  read by a `PARITY` row.
 *
 *  **A `selector` must avoid every property the entry compares**, which is the
 *  same rule `SHELL_TOKEN_SELECTOR` follows for the opposite reason. An address
 *  carrying the compared value is read by the drawing *only while that value
 *  holds*: the value drifts, the address stops matching, and — where the
 *  element's declaration is what several elements share — the elements that did
 *  not drift answer for the ones that did. So the compared properties are the
 *  ones the address leaves out, and a drift in a property the address *does*
 *  carry is loud too: the address matches nothing and `mockupDeclared` throws.
 *  The rail's slot is the one copied element this cannot be written for —
 *  every address that settles its plain form carries the size and the radius it
 *  would be compared on — and it is left out rather than read through an address
 *  that goes stale the moment either moves.
 *
 *  **Every address must settle one element form**, the rule a row is held to.
 *  The original's shortcut rows declare their container as a *prefix* of the
 *  armed row's declaration, so the plain form cannot be addressed alone — the
 *  entry names the armed row, whose radius is the container's either way. */
export const COPIED_ELEMENTS: readonly CopiedElement[] = [
  {
    region: "shell — the rail",
    drawing: MOCKUP_PATH,
    selector: '[style*="width:46px"]',
    originalSelector: '[style*="width:46px"]',
    properties: ["background", "border-right", "display", "flex-direction"],
  },
  {
    region: "shell — the header",
    drawing: MOCKUP_PATH,
    selector: '[style*="height:42px"]',
    originalSelector: '[style*="height:42px"]',
    properties: ["gap", "padding", "background", "border-bottom"],
  },
  {
    region: "settings — the navigation's active row",
    drawing: SETTINGS_MOCKUP_PATH,
    selector:
      '[style*="background:#1d2733;box-shadow:inset 2px 0 0 var(--accent)"]',
    originalSelector:
      '[style*="background:#1d2733;box-shadow:inset 2px 0 0 #72e0c0"]',
    properties: ["border-radius"],
  },
  {
    region: "settings — the chosen palette card",
    drawing: SETTINGS_MOCKUP_PATH,
    selector: '[style*="border:1px solid var(--accent)"]',
    originalSelector: '[style*="border:1px solid #72e0c0;border-radius:8px"]',
    properties: ["border-radius", "padding"],
  },
  {
    region: "settings — the switch row's box",
    drawing: SETTINGS_MOCKUP_PATH,
    selector:
      '[style*="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--panel2)"]',
    originalSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:9px 10px;background:#171c23"]',
    properties: ["margin-top", "border-radius"],
  },
  {
    region: "keyboard — the shortcut row container",
    drawing: SETTINGS_KEYBOARD_MOCKUP_PATH,
    selector:
      '[style*="display:flex;align-items:center;gap:16px;padding:4px 6px"]',
    originalSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:6px;background:#171c23;border:1px solid #72e0c0"]',
    properties: ["border-radius"],
  },
];

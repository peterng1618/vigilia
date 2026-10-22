import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Responsibility: what a checked drawing declares — the parse, the addresses, and the per-row reads every `PARITY` row and every copied-element entry is driven over. */

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
 *  `--warn` (`--shell-warm`), `--shell-display` and
 *  `--yunari-control-bg` have no drawing value to compare against. */
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
  // **`font` is the same shape one property over, and it went unlisted.** The
  // controls drawing states the plain-DOM button box's type as the shorthand
  // (`current/controls.html` `font:400 12px/1.4 system-ui`), so a row naming
  // `font-size` read the drawing's **silence** where the drawing drew a size —
  // the inversion this table exists to refuse, one property over from the
  // padding case (`vg-442`'s type half). The longhands listed are the ones a row
  // could name; `font-variant` and `font-stretch` are named by no row.
  "font-size": ["font"],
  "font-family": ["font"],
  "font-weight": ["font"],
  "font-style": ["font"],
  "line-height": ["font"],
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

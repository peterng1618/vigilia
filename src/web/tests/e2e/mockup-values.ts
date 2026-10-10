import { readFileSync } from "node:fs";
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
    "../../../../docs/design/mockups/current/controls-light.html",
    import.meta.url,
  ),
);

/** The drawing's own token table — the block `current/shell.html:17-18` writes
 *  on its outermost element, which is where every value graphite takes lives.
 *
 *  Addressed by the drawn window's `width:1180px`, a declaration no other
 *  element in the file carries: anchoring on a *token* (say `--accent:#72e0c0`)
 *  would break the row the moment the value moved, which is the drift this
 *  reader exists to report rather than to hide. */
export const SHELL_TOKEN_SELECTOR = '[style*="width:1180px"]';

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

/** One declaration the drawing writes, with the thing that owns it. */
type Declaration = {
  /** A single selector from a `<style>` rule's list, or the element's whole
   *  `style` attribute for an inline declaration. */
  readonly owner: string;
  readonly inline: boolean;
  readonly property: string;
  readonly value: string;
};

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

/** The drawing's declarations in document order: every `<style>` block's rules,
 *  then every element's inline `style` attribute. */
function declarations(mockupHtml: string): Declaration[] {
  const found: Declaration[] = [];
  for (const block of mockupHtml.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
  )) {
    const css = (block[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const pairs_ = pairs(rule[2] ?? "");
      for (const selector of (rule[1] ?? "").split(",")) {
        const owner = selector.trim();
        if (owner === "") continue;
        for (const pair of pairs_) {
          found.push({ owner, inline: false, ...pair });
        }
      }
    }
  }
  for (const element of mockupHtml.matchAll(/<[a-z][^>]*\sstyle="([^"]*)"/gi)) {
    const owner = element[1] ?? "";
    for (const pair of pairs(owner)) {
      found.push({ owner, inline: true, ...pair });
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

/** The value the drawing last declares for `property` under `selector`, or
 *  `null` when it declares none. */
function lookup(
  mockupHtml: string,
  selector: string,
  property: string,
): string | null {
  let value: string | null = null;
  for (const declaration of addressed(mockupHtml, selector)) {
    if (declaration.property === property) value = declaration.value;
  }
  return value;
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
 *  `licensed` carries the text of a **predating** normative rule — a bible §N,
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
  readonly bibleSection: string;
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
   *  test skips it. */
  readonly surface?: "settings" | "sheet" | "fixture";
  readonly licensed?: string;
};

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
 * then), and the settings modal's own regions are the next plan's.
 */
export const PARITY: readonly ParityRegion[] = [
  {
    region: "header — height",
    mockupSelector: '[style*="height:42px"]',
    mockupProperty: "height",
    productSelector: ".editor-shell-header",
    bibleSection: "§7.1 (`:259`), §7's diagram (`:242-257`)",
  },
  {
    region: "body — inset",
    mockupSelector: '[style*="flex:1;min-height:0"]',
    mockupProperty: "padding-top",
    productSelector: ".editor-shell-body",
    bibleSection: "§7's diagram (`:242-257`), §3 elevation 0 (`:102`)",
  },
  {
    region: "body — gap",
    mockupSelector: '[style*="flex:1;min-height:0"]',
    mockupProperty: "column-gap",
    productSelector: ".editor-shell-body",
    bibleSection: "§7's diagram (`:242-257`), §3 elevation 0 (`:102`)",
  },
  {
    region: "rail — radius",
    mockupSelector: '[style*="width:46px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-rail",
    bibleSection: "§3 radius table (`:92`), §7's diagram (`:242-257`)",
  },
  {
    region: "left pane — radius",
    mockupSelector: '[style*="width:246px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-panel",
    bibleSection: "§3 radius table (`:92`), §7's diagram (`:242-257`)",
  },
  {
    region: "stage — radius",
    mockupSelector: '[style*="repeating-linear-gradient(45deg"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-stage",
    bibleSection: "§3 radius table (`:86-94`), §7's diagram (`:242-257`)",
  },
  {
    region: "inspector — radius",
    mockupSelector: '[style*="width:276px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-inspector",
    bibleSection: "§3 radius table (`:92`), §7's diagram (`:242-257`)",
  },
  /* **A dialog's radius is not the drawing's to give.** The only 10px frame the
     superseded drawing had was the window's own — `.mockup` and the shell card it
     wrapped — and both belong to a drawn window, which the product does not have;
     `current/settings.html` draws no window and so has no frame for a row to
     name. Bible §3's radius table is closed (4/6/8/10) and gives 10 to
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
    bibleSection: "§3 radius table (`design-language.md:86-94`)",
    scaleToken: "--radius-lg",
    surface: "settings",
  },
  {
    region: "`?` sheet — frame radius",
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-dialog",
    bibleSection: "§3 radius table (`design-language.md:86-94`)",
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
    bibleSection: "§7.5 (`:338`)",
    licensed:
      '§7.5 (`:338-344`): "Subtle palette-derived stage texture is permitted when it stays behind the artwork and does not obscure controls; neither texture nor a flat ground is mandatory."',
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
     same declaration plus `padding-top:5px`. A `[style*="…"]` selector is a
     substring match, so every prefix of the eleven also matches the twelfth and
     the reader refuses to pick one; the twelfth is the *only* address that
     settles which element is meant, and it declares the same column. Two rows
     rather than one because the drawings are two files, and one of them having
     drifted is exactly what a single row could not say. */
  {
    region: "field row — label column (controls drawing)",
    mockupPath: CONTROLS_MOCKUP_PATH,
    mockupSelector:
      '[style*="width:74px;flex:0 0 auto;color:var(--muted);font-size:11.5px;padding-top:5px"]',
    mockupProperty: "width",
    productSelector: '[data-fixture="text"] label',
    bibleSection:
      "§5 (`:163-164`, the shared grid); the bible is silent on the column's width, so the drawing governs",
    surface: "fixture",
  },
  {
    region: "field row — label column (controls-light drawing)",
    mockupPath: CONTROLS_LIGHT_MOCKUP_PATH,
    mockupSelector:
      '[style*="width:74px;flex:0 0 auto;color:var(--muted);font-size:11.5px;padding-top:5px"]',
    mockupProperty: "width",
    productSelector: '[data-fixture="text"] label',
    bibleSection:
      "§5 (`:163-164`, the shared grid); the bible is silent on the column's width, so the drawing governs",
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
     "Follow the system" onto a second line. The drawn box's vertical padding is
     `9px`, which §3's scale has no step for, so the product renders
     `--space-8` and the row reads the radius the drawing does declare.

     The drawing's `gap: 10px` is the row's own: label to switch. The pane
     picker's `gap: 6px` is inside its trigger, name to chevron, which is the
     element the row names. */
  {
    region: "field row — the settings switch row's box (settings drawing)",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:9px 10px;background:var(--panel2);border:1px solid var(--edge);border-radius:8px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-fixture="boxed"] > div',
    bibleSection:
      "§5 (`:163-164`, the well); the bible does not shape the modal's switch row, so the drawing governs",
    surface: "fixture",
  },
  {
    region: "field row — the settings switch row's box, label to switch",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:9px 10px;background:var(--panel2);border:1px solid var(--edge);border-radius:8px"]',
    mockupProperty: "gap",
    productSelector: '[data-fixture="boxed"] > div',
    bibleSection:
      "§5 (`:163-164`, the well); the bible does not shape the modal's switch row, so the drawing governs",
    surface: "fixture",
  },
  /* The Add pane's asset trigger: `shell.html:129` draws a picker spanning the
     pane under an `Asset` eyebrow, the file name at `flex:1` and a chevron
     after it.

     **The selector names the trigger's second form, and it has to.** The
     drawing writes that declaration twice more, identically, on the
     inspector's own select triggers (`shell.html:273` and `:310`), and the
     picker's element at `:129` is exactly that declaration as a suffix of
     theirs — so `[style*="…"]` can settle the shared form and can never settle
     the picker alone. The declaration is one declaration either way, and it is
     the picker's box. What the column's *absence* buys the picker is geometry,
     and the fixture asserts that: the control starts where the row starts. */
  {
    region: "field row — the Add pane's asset trigger (shell drawing)",
    mockupPath: MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--edge);border-radius:6px;padding:5px 8px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-fixture="headed"] [data-fixture-select]',
    bibleSection:
      "§5 (`:163-164`, the well the trigger is drawn as); the bible does not shape the pane's picker, so the drawing governs",
    surface: "fixture",
  },
  {
    region: "field row — the Add pane's asset trigger, name to chevron",
    mockupPath: MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--edge);border-radius:6px;padding:5px 8px"]',
    mockupProperty: "gap",
    productSelector: '[data-fixture="headed"] [data-fixture-select]',
    bibleSection:
      "§5 (`:163-164`, the well the trigger is drawn as); the bible does not shape the pane's picker, so the drawing governs",
    surface: "fixture",
  },
];

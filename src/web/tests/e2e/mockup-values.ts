import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Reads a value the drawing *declares*, rather than a copy of one.
 *
 * The contradiction this removes: a value transcribed out of
 * `docs/design/mockups/editor-shell.html` into a test is a second owner of it.
 * The drawing can move and the test keeps asserting the transcription, so the
 * comparison passes while the two disagree — which is what spec §13's
 * amendment of 2026-10-10 is about. So the drawing is parsed here, and a row
 * that names a value the drawing no longer declares fails instead of passing.
 *
 * **Two declaration sites, one reader.** The drawing declares in its `<style>`
 * block (`.mockup`) *and* in inline `style` attributes — the shell's regions,
 * its frame and its token table are all inline, with no selector to reach them
 * by. A selector is therefore either:
 *
 * - a rule selector, matched against the drawing's `<style>` blocks (`.mockup`);
 * - an attribute selector of the form `[style*="width:46px"]`, matched against
 *   an element's own `style` attribute — which is how the shell's frame, its
 *   body row, its rail, its panes, its stage and its status bar are addressed.
 *
 * **Document order decides.** Where the drawing has more than one `<style>`
 * block, or more than one declaration matches, the **last** declaration in
 * document order wins — the cascade's rule for equal specificity, and the
 * reading a person gets from opening the file. Unlike the cascade this reader
 * does not weigh specificity: a row named against a rule gets that rule's own
 * declaration, and a row named against an inline attribute gets that element's.
 *
 * `ponytail:` a regex over an inline stylesheet is the ceiling here — no at-rule
 * nesting, no shorthand expansion, no specificity. Upgrade to a real CSS parse
 * if the drawing gains nested rules or a shorthand a row mis-reads.
 */

/** The drawing this plan measures the shell against. `fileURLToPath`, because a
 *  `file:` URL does not survive a Windows path. */
export const MOCKUP_PATH = fileURLToPath(
  new URL("../../../../docs/design/mockups/editor-shell.html", import.meta.url),
);

export function readMockup(): string {
  return readFileSync(MOCKUP_PATH, "utf8");
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

/** What a selector addresses: how many declarations carry it (a selector that
 *  addresses none is a broken row, not a silence), and the value the drawing
 *  last declares for `property` under it, or `null` when it declares none. */
function lookup(
  mockupHtml: string,
  selector: string,
  property: string,
): { owners: number; value: string | null } {
  const inline = INLINE_SELECTOR.exec(selector);
  const wanted = (inline?.[1] ?? "").trim();
  let owners = 0;
  let value: string | null = null;
  for (const declaration of declarations(mockupHtml)) {
    const matches =
      inline === null
        ? !declaration.inline && declaration.owner === selector.trim()
        : declaration.inline && declaration.owner.includes(wanted);
    if (!matches) continue;
    owners += 1;
    if (declaration.property === property) value = declaration.value;
  }
  if (owners === 0) {
    throw new Error(
      `the drawing addresses nothing with \`${selector}\`: this row names a selector the drawing does not declare`,
    );
  }
  return { owners, value };
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
  const found = lookup(mockupHtml, selector, property);
  if (found.value === null) {
    throw new Error(
      `the drawing declares no \`${property}\` for \`${selector}\``,
    );
  }
  return found.value;
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
  return lookup(mockupHtml, selector, property).value;
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
  /** A `<style>` rule selector, or `[style*="…"]` for an inline declaration. */
  readonly mockupSelector: string;
  /** The CSS property, named the same on both sides — `border-radius` is read
   *  from the drawing's rule and from the product's computed style alike. */
  readonly mockupProperty: string;
  readonly productSelector: string;
  readonly bibleSection: string;
  readonly licensed?: string;
};

/**
 * The shell's regions, as the census adjudicates them
 * (`.superpowers/sdd/2026-10-10-shell-parity/adjudication.md`).
 *
 * Every row here is one `design-language.spec.ts` asserts. The measured
 * differences are the four body regions the drawing draws **flush** and
 * **square**, the shell's own frame, and the dialog frame that shares the
 * drawing's one 10px rule. `height` on the header is the **positive control**:
 * the drawing and the product already agree on 42px, so a run that finds no
 * failures at all is caught as a reader that stopped reading rather than
 * reported as a shell that came right.
 *
 * Two rows the census adjudicates are deliberately *not* here, and say so
 * rather than being implied: the graphite role values are Task 4's assertions
 * (the drawing declares them in its own token table, and the reader gains that
 * target then), and the settings modal's own regions are the next plan's.
 */
export const PARITY: readonly ParityRegion[] = [
  {
    region: "shell frame — radius",
    mockupSelector: '[style*="width:1180px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell",
    bibleSection: "§3 radius table (`design-language.md:86-94`)",
  },
  {
    region: "header — height",
    mockupSelector: '[style*="height:42px"]',
    mockupProperty: "height",
    productSelector: ".editor-shell-header",
    bibleSection: "§7.1 (`:259`), §7's diagram (`:242-257`)",
  },
  {
    region: "body — inset",
    mockupSelector: '[style*="height:568px"]',
    mockupProperty: "padding-top",
    productSelector: ".editor-shell-body",
    bibleSection: "§7's diagram (`:242-257`), §3 elevation 0 (`:102`)",
  },
  {
    region: "body — gap",
    mockupSelector: '[style*="height:568px"]',
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
  {
    region: "dialog frame — radius",
    mockupSelector: ".mockup",
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-dialog",
    bibleSection: "§3 radius table (`:86-94`)",
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
];

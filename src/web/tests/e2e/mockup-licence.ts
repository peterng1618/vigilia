/** Responsibility: the licence policy — what a `licensed` reason names, what it quotes, and whether the rule it quotes predates the divergence it licenses. */

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
 * **What a licence must do, and each limb is one the old gate passed.** It names
 * a source from §13's set, in one of the spellings the repo's own prose uses
 * (`ADR-0010` as well as a path; the spec's path, its basename, or the name its
 * cross-references give it). It quotes that source's own rule — not the whole
 * document it lives in, which would admit `§3: "padding"`, and not a section it
 * does not name, which would admit `§3: "<§7.5's sentence>"` — as a whole
 * sentence or a whole line of that source. And the rule it quotes must not have
 * entered in the commit that cites it: plan 5 added §5's choice row and then
 * cited §5.
 *
 * **The `§N` arm resolves through `design-md.mjs`, and nothing here parses
 * DESIGN.md.** The canonical range arrives as `canonicalNumbers` (that file's
 * `CITE_NUMBERS`) and a number's section as `sections` (its `sectionTexts`), so
 * the markers keep one reader; the marker a number resolves to, and whether it
 * has one at all, stay the checker's rule rather than a second one written here.
 *
 * **What this cannot read.** Whether the *product* treatment a row records is
 * itself the divergence — a row can name a region it matches. Predating asks
 * when the quoted text entered the file the licence names, so a rule reworded in
 * the citing commit is caught while one split across two commits of the same
 * change is not. And a licence that is **not committed yet** has no commit to
 * compare, so the check is silent until its own commit lands — the shape of
 * `vg-287`'s recorded capture sha, which is read against history too.
 * `ponytail:` quoted-text introduction is the ceiling — upgrade to
 * `git merge-base --is-ancestor` against the commit that introduced the
 * product's own deviation once a row records that commit.
 */

/** The spec that owns §13, and so the third source §13 admits. Named here
 *  because the rule and the file it is written in are one fact. */
export const LICENCE_SPEC =
  "docs/superpowers/specs/2026-10-08-editor-design-language-design.md";

/** How the repo's prose writes that spec: the file's own name, and the name its
 *  cross-references give it. A licence naming any of these names this spec. */
export const LICENCE_SPEC_ALIASES = [
  "2026-10-08-editor-design-language-design",
  "design language spec",
  "design-language spec",
];

/** A source a licence names, with the rule it quotes from it.
 *
 *  `text` is the source's **scope** — a DESIGN.md section, or a note's or the
 *  spec's whole file — and `quote` is the licence's own quotation of it,
 *  whitespace-collapsed. `null` on either side is a finding: a source the tree
 *  does not hold, or a licence that quotes nothing of the source it named. */
export type LicenceSource = {
  /** `§N` as written, or the path the licence named. */
  readonly label: string;
  /** The file the rule lives in, resolved — what a caller dates the quotation
   *  against. */
  readonly path: string;
  readonly text: string | null;
  readonly quote: string | null;
};

/** Everything the licence policy reads, supplied by the caller so the predicate
 *  stays pure and its decisions are pinned with fixtures.
 *
 *  **The git-shaped member is the caller's to fill.** `introducedAt` answers the
 *  commit a quotation entered a file in, and is compared with `licensedAt` for
 *  identity. Keeping both out of this module is what lets a unit test date a
 *  fixture without a repository — and a caller that has no history (a shallow
 *  clone) must refuse there rather than answering every question with `HEAD`. */
export type LicenceLedger = {
  /** The section each `<!-- §N -->` marker opens, by bare number, read by
   *  `design-md.mjs`'s `sectionTexts`. A number its markers do not carry is
   *  absent, and a licence naming it is refused rather than searching the whole
   *  document. */
  readonly sections: ReadonlyMap<string, string>;
  /** Every decision note and ADR the tree holds: its path → its text. A licence
   *  may name one by path, and an ADR by the `ADR-NNNN` form the repo's prose
   *  also uses. */
  readonly notes: ReadonlyMap<string, string>;
  /** The spec §13 lives in: its path, the spellings `LICENCE_SPEC_ALIASES`
   *  gives it, and its text. */
  readonly spec: {
    readonly path: string;
    readonly aliases: readonly string[];
    readonly text: string;
  };
  /** `scripts/design-md.mjs`'s `CITE_NUMBERS` — the numbers that are a
   *  DESIGN.md section. Transcribed nowhere: the caller imports the constant. */
  readonly canonicalNumbers: readonly string[];
  /** The commit that introduced the licence. */
  readonly licensedAt: string | null;
  /** The commit the quotation entered `path` in — the rule's own introduction.
   *  `null` when history cannot date it. */
  readonly introducedAt: (path: string, quote: string) => string | null;
};

const LICENCE_SECTION = /§(\d+(?:\.\d+)?)/g;
const LICENCE_PATH = /docs\/(?:adr|decisions)\/\d{4}-[a-z0-9-]+\.md/g;
/** `ADR-0010`, the form the repo's own prose cites a decision by. */
const LICENCE_ADR = /\bADR-(\d{4})\b/g;
/** The two spellings a licence may wrap a quotation in. */
const LICENCE_QUOTES = [/"([^"]+)"/g, /“([^”]+)”/g];
/** A quotation's end: the punctuation a sentence closes on, so a span that stops
 *  mid-clause is not read as the rule. */
const SENTENCE_END = /(?<=[.!?])\s+/;

/** Whitespace collapsed, so a rule a file wraps across lines is still the text a
 *  licence quotes — §7.5's sentence spans three lines of DESIGN.md. */
const flatten = (text: string): string => text.replace(/\s+/g, " ").trim();

/** The quotations a licence carries, flattened, in the order it writes them. */
function licenceQuotes(licensed: string): string[] {
  return LICENCE_QUOTES.flatMap((pattern) =>
    [...licensed.matchAll(pattern)].map((match) => flatten(match[1] ?? "")),
  ).filter((quote) => quote !== "");
}

/** Whether `quote` is a rule the source states rather than a fragment of one: a
 *  whole line of it, or a whole sentence of it.
 *
 *  **Why a fragment is refused.** `"padding"` appears in every section of a
 *  document about layout and quotes nothing; the rule is the clause around it.
 *  A whole-line test alone would refuse §7.5, whose licence quotes one sentence
 *  out of the middle of a paragraph, and a whole-sentence test alone would
 *  refuse §3, whose rule is a table row — so both are admitted, and a span that
 *  is neither is not a quotation of a rule. */
function quotesWholeUnit(source: string, quote: string): boolean {
  if (quote === "") return false;
  if (source.split("\n").some((line) => flatten(line) === quote)) return true;
  return flatten(source)
    .split(SENTENCE_END)
    .some((sentence) => sentence === quote);
}

/** The source an `ADR-NNNN` names, or `null`: the note the tree numbers NNNN.
 *
 *  **Two trees carry those numbers and this order is the repo's own.**
 *  `docs/adr/` titles its files `ADR-NNNN`, so it is what a bare `ADR-NNNN`
 *  means; where it has no such number, the decision notes are what the register
 *  and the notes' own prose call `ADR-NNNN` (`docs/decisions/0021` writes
 *  "ADR-0017 made a theme a directory" of `0017`). Both are read, either is
 *  accepted, and neither naming the number is a finding. */
function adrPath(
  number: string,
  notes: ReadonlyMap<string, string>,
): string | null {
  const named = [...notes.keys()].filter((path) =>
    path.includes(`/${number}-`),
  );
  return named.find((path) => path.startsWith("docs/adr/")) ?? named[0] ?? null;
}

/** The sources a licence names, in the order it names them, without repeats,
 *  each carrying the quotation the licence makes of it. Exported so a caller can
 *  date each quotation without re-reading the licence. */
export function licenceSources(
  licensed: string,
  ledger: LicenceLedger,
): LicenceSource[] {
  const quotes = licenceQuotes(licensed);
  const found = new Map<string, LicenceSource>();
  const add = (label: string, path: string, text: string | null) => {
    if (found.has(label)) return;
    const quote =
      text === null
        ? null
        : (quotes.find((one) => quotesWholeUnit(text, one)) ?? null);
    found.set(label, { label, path, text, quote });
  };
  for (const match of licensed.matchAll(LICENCE_SECTION)) {
    const number = match[1] ?? "";
    // A number outside the canonical range belongs to another document's
    // numbering (the redesign spec's own `§N`), so it names no DESIGN.md rule.
    if (!ledger.canonicalNumbers.includes(number)) continue;
    add(`§${number}`, "DESIGN.md", ledger.sections.get(number) ?? null);
  }
  for (const match of licensed.matchAll(LICENCE_ADR)) {
    const path = adrPath(match[1] ?? "", ledger.notes);
    add(
      match[0],
      path ?? "",
      path === null ? null : (ledger.notes.get(path) ?? null),
    );
  }
  for (const match of licensed.matchAll(LICENCE_PATH)) {
    add(match[0], match[0], ledger.notes.get(match[0]) ?? null);
  }
  if (
    licensed.includes(ledger.spec.path) ||
    ledger.spec.aliases.some((alias) => licensed.includes(alias))
  ) {
    add(ledger.spec.path, ledger.spec.path, ledger.spec.text);
  }
  return [...found.values()];
}

/** Why a `licensed` string does not discharge the gate, one line per reason; an
 *  empty list is a licence that does.
 *
 *  A licence must name a source from the set spec §13 admits, quote that
 *  source's own rule, and cite a rule that entered its file before the commit
 *  that cites it. Each refusal names the row's licence so the finding can be
 *  read against the row it is about. */
export function licenceFindings(
  licensed: string,
  ledger: LicenceLedger,
): string[] {
  const sources = licenceSources(licensed, ledger);
  if (sources.length === 0) {
    return [
      "names no normative source: spec §13 admits a DESIGN.md `§N`, a `docs/adr/` or `docs/decisions/` note (`ADR-NNNN` is the same claim), or the design spec, and this reason names none of them",
    ];
  }
  const quotes = licenceQuotes(licensed);
  const findings: string[] = [];
  for (const source of sources) {
    if (source.text === null) {
      findings.push(
        `names \`${source.label}\`, which the tree does not hold, so there is no rule to read`,
      );
      continue;
    }
    if (source.quote === null) {
      // Two refusals, kept apart because they are two mistakes: quoting the
      // source's words *outside* the rule it names, and quoting a fragment that
      // is inside it. The decisive case is the first — a section's silence
      // cannot be quoted, and every reason that cited what a section does not
      // say dies here.
      const body = flatten(source.text);
      const inside = quotes.some((quote) => body.includes(quote));
      findings.push(
        inside
          ? `quotes a fragment of \`${source.label}\` rather than the rule it states: a quotation is a whole sentence or a whole line of the source, and a term is in every section of a document about its subject`
          : `names \`${source.label}\` without quoting its rule: the quotation must be a whole sentence or line *of that source*, and text from elsewhere in the document — or from another section — is not what it says`,
      );
      continue;
    }
    const at = ledger.introducedAt(source.path, source.quote);
    if (at === null) {
      findings.push(
        `quotes \`${source.label}\`, which nothing in the history dates, so its rule cannot be shown to predate the divergence it licenses`,
      );
    } else if (at === ledger.licensedAt) {
      findings.push(
        `quotes \`${source.label}\`, whose text entered in the same commit as the licence that cites it: a rule this change writes cannot license this change's divergence`,
      );
    }
  }
  return findings;
}

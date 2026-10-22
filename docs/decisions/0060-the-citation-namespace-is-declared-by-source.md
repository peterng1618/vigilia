# 0060 — The citation namespace is declared by source

- **Date:** 2026-10-17
- **Status:** accepted
- **Paths:** `scripts/design-md.mjs`
- **Task:** Phase 21.2 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (row `vg-352`)

## The problem

`scripts/design-md.mjs --cite` rule 3 asserts that every `<!-- §N -->` marker in
`DESIGN.md` is claimed by at least one citation, and its claim test is a bare
text match over `docs/`, `src/` and `scripts/` with **no notion of which document
is speaking**. `§1`–`§10` is a shared namespace: `docs/product/requirements.md`
numbers its own requirements `## §N — title`, `docs/product/tester-runbook.md`
numbers its own `## 0.`–`## 6.`, and `docs/architecture/`'s two censuses number
their own `## 1.`–`## 4.`. So an in-range `§7` from a document whose `§7` is
*its own section* satisfies rule 3 for a marker nothing has cited.

The shape of the problem is therefore: **what makes a `§N` a claim on
`DESIGN.md`, when the number alone cannot say?** The ruling answers it: the
namespace is declared by source, not inferred from the number. The set is the
list of documents whose `§N` are design-language citations, and a document joins
by being *about* the design language — a property a reviewer checks, unlike a
number.

## Rung 1 — Yunari

Searched: `CITE_TREES`, `CITE_EXTENSIONS`, `CITE_EXCLUDE`, `CITE_NUMBERS`,
`UNCITED_OK`, `MAPPING_EXEMPT`, `citedIn`, `collectCitations` and `checkCitations`
in `scripts/design-md.mjs`; the other `scripts/*.mjs` for a check that already
declares *whose* text it reads; `docs/decisions/0047` (the one prior ruling on
this range); `docs/decisions/0059` (the sibling mechanism, a claim scoped to a
file); and row `vg-352`'s own detail.

Found:

- **The file already declares lists beside the range.** `UNCITED_OK` and
  `MAPPING_EXEMPT` are constants at `:120` and `:130`, each a list of exemptions
  with a reason, and the docblock at `:55` states why the range is a constant and
  never read from `DESIGN.md`. A declared source set beside them is the file's
  own established shape, not a new mechanism.
- **Nothing in the repo scopes a check to a set of documents.** Every other
  `scripts/` gate reads a fixed file or walks a fixed tree.
- **The overlap is wider than the row's headline.** `requirements.md`'s `§7` is
  the only *live* collision with the canonical range (its other numbers are `§31`
  and above), but nine tracked documents number their own sections and carry an
  in-range `§N`; the row names two of them.
- **The excluded documents' numbers are their own.** `requirements.md:20` is
  `## §7 — Product and scope`; `tester-runbook.md:58` is "See §2 and §3" against
  its own `## 2.` and `## 3.`; `dead-code-candidates.md:83` is "§3's subject"
  against its own `## 3.`.
- `vg-352` records the ruling and names `requirements.md` as out; the sweep guard
  (Tasks 4–5) is a stated consequence, not a task.

## Rung 2 — dependencies

Searched: `scripts/design-md.mjs`'s imports, the workspace manifests, and
`node_modules` for a path-pattern or policy package that could own a source set.

Found: the script imports `node:fs`, `node:fs/promises`, `node:child_process` and
`node:path` and nothing else. `picomatch` is present transitively under Vitest but
is not a declared dependency, and a set of literal path prefixes needs no matcher:
`String.prototype.startsWith` is the whole of it. Nothing to discharge.

## Rung 3 — platform

Searched: whether any JavaScript or OS API gives a text file a namespace, a
document identity, or a scope for a match.

Found: nothing to search. `git ls-files` already enumerates the tracked corpus and
is what the check reads; the platform offers no notion of which document a string
came from, which is precisely why the source set must be declared rather than
inferred. Rung 3 cannot answer this and is recorded as empty rather than passed.

## Rung 4 — ecosystem

Searched (2026-10-17): *"documentation toolchain cross-reference by explicit label
instead of section number, because numbers are not unique across documents"*,
reading the Asciidoctor cross-reference and custom-ID pages, Sphinx's
`referencing` page and its `autosectionlabel` extension page, and Doxia's Xdoc
format reference.

Found — the ecosystem has met this shape, and its answer has two halves:

- **Name the target rather than its position.** AsciiDoc's own guidance is that a
  title-based cross reference "should only be used for rapid development or
  short-lived content" and that mature content switches to IDs; Doxia notes a
  generated anchor "silently breaks links" when a title is reworded, and that an
  anchor you write yourself wins. Sphinx's `:ref:` cites a label and is advised
  over a section-title link because it works across files and warns when wrong.
- **Where a rule is scoped to a document, the document prefixes the scope.**
  Sphinx's `autosectionlabel` generates labels from section titles and collides
  exactly as this repo does: "If same section names are used in whole of document,
  any one is used for a target by default", and its answer is the
  `autosectionlabel_prefix_document` option, which prefixes each label with the
  document it is in "for avoiding ambiguity when the same section heading appears
  in different documents".
- **Nothing in the ecosystem resolves a bare number to a document.** Every one of
  them keys on a name, because the tooling that has to *resolve* a reference
  cannot guess the speaker.

The comparison to this repo's shape: our markers are already named
(`<!-- §N -->`), but the *citation* is a bare number, so the number is the shared
namespace and the check is the resolver that cannot guess the speaker. The
ecosystem's second half is the one that transfers — scope the rule by the
document — and it is what the set does.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep the bare text match | Nothing changes | None | The row itself: a foreign `§N` claims a marker nothing cited | rejected |
| **A declared source set: the trees whose documents are about the design language** | The ruling's own words, declared where the range is | One constant, one filter at the claim test | A document that really does cite `DESIGN.md` left out turns a green check red — the risk the row names | **chosen** |
| A per-document whitelist of every file that cites today | The most exact reading of "the list of documents" | ~190 entries, one per file, re-listed whenever a file starts citing | Derived from today's citations, which is the argument the range's own header rejects; and it rots red on the first new file | rejected |
| A blacklist: everything except the documents that number themselves | Smallest list | 9 entries today | A document that numbers itself tomorrow re-opens the hole silently — the failure shape, not a fix for it | rejected |
| Re-point every foreign `§N` to a label (`DESIGN-§7`) | Removes the ambiguity at the source | Rewrites citations across the repo and the marker convention | A convention change the ruling did not make, and it breaks the existing citations the markers exist to preserve (D2) | rejected |
| A per-document namespace test inside a mixed document | Would also catch a document that is about the design language *and* numbers its own sections | Needs a second parser of each document's heading scheme | Not what the ruling asks for; a document's own numbering is not machine-readable without inventing a per-document convention | rejected |

## Rung 6 — probe

Measured 2026-10-17 at `45a5642c`, by walking the check's own inputs with a
scratch script (outside the repo) and by running the check itself:

| Measurement | Value | How |
|---|---|---|
| Tracked files under `docs/`, `src/`, `scripts/` carrying an in-range `§N` | **193** | `git ls-files` + the check's own extension filter, matching `§(\d+(?:\.\d+)?)` against the canonical range |
| Documents that number their own sections **and** carry an in-range `§N` | **9** | `^#{1,4}\s*§?\d+[.)]?\s+\S` headings intersected with the in-range `§N` |
| Markers claimed **only** by one area (any of `docs/product/`, `docs/architecture/`, `docs/decisions/`, `docs/design/`, `docs/superpowers/`, `src/`, `scripts/`) | **0 of 18** | per-marker claim sets, grouped by area |
| `requirements.md`'s in-range `§N` | **`§7` only** | its other headings are `§31` and above |
| `docs/design/design-language.md` | **does not exist** | `ls docs/design/` → `mockups/` only; it was retired for `DESIGN.md` (the check's header, D2) |

**What the probe shows.** No area is the sole claimant of any marker, which is why
this is a correctness fix and not a live red — and it is also why the set could
not be *measured* into existence: every candidate set passes today, so the set has
to be argued from what the documents are, not from what they happen to contain.

## Decision

**The check claims only from the documents declared to speak the design
language.** `CITE_SOURCES` sits beside `CITE_NUMBERS` and is the paths whose
`§N` are `DESIGN.md` citations:

| Member | Why it is about the design language |
|---|---|
| `src/` | The product's own source; a `§N` here is a comment naming the rule the code obeys (`control-icon-button.tsx:14` "DESIGN.md §6", `control-fixture.tsx:20` "DESIGN.md §5's vocabulary") |
| `scripts/` | The repo's instruments; `design-tokens.mjs:56` is "DESIGN.md §3's named steps" |
| `docs/decisions/` | A note that rules on a design-language question cites the section it rules on (`0047` §7.9, `0049` §3, §5, `0057` §7.7) |
| `docs/design/` | The language's own drawings and their README; `mockups/README.md` cites §2, §5, §7, §7.8 and §9, and each mockup cites the section it draws |
| `docs/superpowers/` | The specs that state the language and the plans that build it — the ruling's "the redesign spec and the specs that build on it" |
| `docs/product/triage/` | Each row adjudicates a design-language finding against the section it names (`triage-B3.md` "`DESIGN.md` §3 (Elevation)") |

**Left out, and why — the near-misses:**

| Path | Why it is not a source |
|---|---|
| `docs/product/requirements.md` | The ruling's own exclusion: `## §N — title` numbers its own requirements, and its numbers belong to itself |
| `docs/product/tester-runbook.md` | Numbers its own `## 0.`–`## 6.`; "see §2 and §3" is the runbook |
| `docs/product/probes/README.md` | Cites "the runbook's §0" — the same foreign namespace |
| `docs/architecture/` | `dead-code-candidates.md` and `manager-census.md` number their own `## 1.`–`## 4.`; `README.md` cites `requirements.md`'s §97 |
| `docs/evidence/` | Names files, actions and captures; it carries no in-range `§N` at all |
| `docs/product/backlog.jsonl`, `backlog-archive.jsonl` | Already out by `CITE_EXTENSIONS`; historical `§N` prose |
| `DESIGN.md` | The target, and never a source — its own markers would claim themselves |
| `scripts/design-md.mjs`, `src/web/tests/scripts/design-md.test.ts` | The check's own files; `CITE_EXCLUDE` already removes their fixtures |

**A citation now carries the document it came from.** `collectCitations` records
`{ path, text }`, and `citedIn` admits a text only when its path is under a listed
prefix. That is what makes the failure shape a case the self-test can prove: a
read whose only `§7` is `requirements.md`'s leaves the marker unclaimed, and a read
whose `§7` is a design-language document's claims it.

**Known limit, recorded rather than solved.** A document that is about the design
language *and* numbers its own sections still claims with its own numbers:
`docs/superpowers/specs/2026-10-08-editor-design-language-design.md` is `§1`–`§13`,
and its `§2`, `§6` and `§7` are its own sections. Excluding it is the
over-exclusion this set exists to bound — it genuinely cites the bible (§5,
§7.1, §7.8) — and separating the two uses needs a per-document convention the
ruling does not make. The limit is stated here so it is not rediscovered as a new
defect; it is `vg-352`'s shape surviving in a narrower form.

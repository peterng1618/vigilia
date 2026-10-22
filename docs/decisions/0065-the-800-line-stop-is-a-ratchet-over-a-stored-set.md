# 0065 — The 800-line stop is a ratchet over a stored set, and the cut is generated versus authored

- **Date:** 2026-10-17
- **Status:** accepted
- **Paths:** `scripts/oversize-files.mjs`, `scripts/oversize-files.ceiling.json`
- **Task:** Phase 21.7 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (row `vg-536`)

## The problem

`AGENTS.md` states two numbers for a source file — 500 is a signal, 800 is a
stop — and **nothing in the repo computes either**. The row's finding is not the
count: a policy that files one register row per breaching file needs a filing
per file *per growth*, and nothing reads the whole set, so the register's own
size is the instrument and it does not converge. `vg-209` closed on
`layer-panel.tsx` at 838 lines while `layer-panel.dom.test.tsx` grew to 1967
unnamed; `vg-374` closed on `editor-session.ts` while
`editor-session.dom.test.ts` reached 1706 unnamed.

The shape to build is therefore a **measure**, not a cleanup: a reported set with
a ceiling, so the next split is a decision rather than a discovery. Two design
questions are not obvious and are decided below — **what makes a file generated**
(the cut) and **what shape the ceiling has** when 45 files are already past it.

## Rung 1 — Yunari

Searched: every `scripts/*.mjs` for a line count (`grep -l "lineCount|line count|split(\"\\n\")|lines >" scripts/`),
`docs/architecture/` for prior instruments, `AGENTS.md`'s *Code and files* section,
and the register for the rows the row itself cites (`vg-209`, `vg-374`, `vg-394`,
`vg-395`, `vg-415`, `vg-420`, `vg-426`).

Found:

- **Nothing computes a file's line count against a budget.** `check-status.mjs`
  is the only script that counts lines, and it counts `STATUS.md`'s bullets.
- `docs/architecture/manager-census.md` is prior art of the *wrong* kind: it
  states "the family is **30 non-test files / 10,701 lines**, five past 500 and
  four past the stop" — **hand-counted, in prose, in a document dated to a
  commit.** That number is a snapshot nobody re-derives, which is the row's
  failure restated.
- `scripts/design-tokens.mjs`'s remainder (`vg-426`) is the model the row names:
  a count with a `remainderCeiling` in `scripts/design-tokens.gated.json`, the
  offending files printed, and a notice that the ceiling *can* be lowered. Its
  own words are *"a ceiling nobody lowers is a count with no finish, which is the
  failure this row names."* The shape is right; the unit is not (see Rung 5).

## Rung 2 — dependencies

Searched: `src/web/package.json`'s dependencies and devDependencies; the
installed `@biomejs/biome` (2.5.14).

Found: **nothing to adopt, and the one candidate is already installed.**
Dependencies are empty; devDependencies are `@biomejs/biome`, `@google/design.md`,
`@playwright/*`, `canvas`, `jsdom`, `jsqr`, `typescript`, `vite`, `vitest`. No
line-count package (`size-limit` measures bundle bytes, not lines). Biome *is*
the candidate, and it is Rung 4 rather than Rung 2 because the rule it ships is
the question.

## Rung 3 — platform

Searched: what Node gives for "how many lines is this file", and whether git
gives the set.

Found: `git ls-files` gives **the tracked set** — which is the row's own method
and the right semantic, because an untracked scratch file must not redden a live
run — and `readFileSync` plus a newline count gives the length. Neither needs a
parser: a line budget is not a syntax question. Nothing else on the platform
answers it, and there is no platform ratchet.

## Rung 4 — ecosystem

Searched (2026-10-17): the Biome rule list via Context7 for
`noExcessiveLinesPerFile` / `max-lines`, then ESLint's `max-lines`, then
`knip` (already searched in `0064`).

Found — **the closest prior art exists, is installed, and is the wrong shape in
the one way that matters.**

- **Biome ships `style/noExcessiveLinesPerFile`** (added 2.3.12, and the repo
  runs 2.5.14): *"Restricts the number of lines in a file (default max: 300)"*,
  and its declared source is `RuleSource::Eslint("max-lines").inspired()`.
  ESLint's core `max-lines` is the same rule.
- It is **per-file and all-or-nothing at lint time**: setting `maxLines: 800`
  reddens `biome check` — a gate step — on all 45 files at once.
- Its escape hatch is per-file: an `overrides` entry, or a per-file
  `// biome-ignore` / `/* eslint-disable max-lines */`. That is **one line per
  file, edited per file, and it grows with the codebase** — the row's defect,
  relocated into the linter config. Knip's baseline (`0064`) has the same shape
  and the same cost.
- It cannot say the thing the row asks for: there is no *set*, no *ceiling that
  falls*, and no count of "past the stop". A diagnostic per file is a report, not
  a ratchet.
- It reads `AnyJsRoot` only, so **`.css` is not in its reach** and
  `editor-shell.css` (2826 lines) would be outside a set that names it. It has no
  notion of generated, so `font-trios.generated.ts` (28,283) would redden it.

No prior art was found for a **set ratchet over a line budget** — where the
ceiling is the accepted set and a removal never fails. That is the shape this
note decides.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **A set ratchet: the accepted over-stop set is stored, a path over the stop that the set does not name fails, a set entry no longer over the stop is reported** | The row's "reported set with a ceiling that falls"; the `vg-426` shape with the unit corrected from a count to a set | One path per line in one config; edited only to *accept* a breach | The config is state; a stale entry is noise until pruned | **chosen** |
| `style/noExcessiveLinesPerFile` at `maxLines: 800` | Installed, zero code | Reddens `npm run gate` on all 45 today; its escape hatch is one config line per file, edited per file | Re-implements the one-row-per-file policy inside the linter; misses `.css` and generated files | rejected |
| A count ratchet, no paths (the `vg-426` shape literally) | Cheapest; no per-file state | Nothing | Splitting one file and growing another keeps it flat, so a new breach is a *discovery*, which is the row's own failure | rejected |
| Report-only, the number in the report | No state, no chore | Nothing | No finish: nothing makes anyone run it, and the row's finding is that a document nobody re-derives is the wrong instrument | rejected |
| A register row per breaching file (the status quo) | — | One row per file per growth | The row: *"does not converge"* | rejected |

**Why the set and not the count.** A count cannot tell a split from a new file:
split one and grow another and it is flat while the set has changed. The row's
purpose is that the next breach is a *decision* — the set is the only unit that
makes an addition visible as an addition.

**Why a removal never fails, which is the part the brief's option 1 does not
assume.** The rule is *fail on an addition only*. A file that leaves the set
(a split) is **reported, never required to be removed**, so the ceiling is not
edited on every split — which is what would have made it a second
one-row-per-file policy. The ceiling is edited only when a breach is *accepted*
rather than fixed, and that edit is one line. A breach that is split clears the
failure with no edit at all, because the path was never in the ceiling.

## Rung 6 — probe

Measured 2026-10-17 at `5742a071` (`develop`), by
`git ls-files src/web` filtered to `.ts`/`.tsx`/`.mjs`/`.css`, excluding
`dist` and `node_modules`, each file's line count taken as its newline count
(with a trailing newline not counting as a line):

| Measurement | Value |
|---|---|
| Tracked `src/web` files matching the filter | 667 |
| Generated (excluded by the cut) | 1 — `font-trios.generated.ts`, 28,283 lines |
| Past the **500** signal, authored | 109 |
| Over the **800** stop, before the cut | 46 |
| Over the **800** stop, authored | **45** |

**The row's 47/33 is from `5ad08048` and the tree has moved**, so the row's own
counts are historical and this is the re-measurement. **The controller's
cross-check at this sha was 46 over / 10 named / 36 named by none, and the one
file of disagreement is a real fault line in the row's method**: the row says a
file is *named* when a register row's `title` carries its **basename**, and
`shell-layout.dom.test.tsx` (1372) is named by no title while
`vg-276`'s title carries `shell-layout.tsx`. A stem reading counts it named; a
basename reading does not. **This instrument does not read the register at all**
— it reports the set, and whether a row names a file is the register's business,
which is the whole point of replacing it.

## Decision

**`scripts/oversize-files.mjs` reports the set and ratchets it against
`scripts/oversize-files.ceiling.json`**, a JSON array of the accepted over-stop
paths. Live run: exit 0 when no path is over the stop that the ceiling does not
name, exit 1 on an addition, exit 2 on a ceiling it cannot read. The set, the
counts and the entries that have left the set are printed every run.

**The cut is generated versus authored**, and generated is a **head marker**: a
file is generated when any of its first five lines carries both a generation
claim (`@generated`, `generated by`, `code generated`) and a do-not-edit notice.
`font-trios.generated.ts` carries it and its generator
(`src/web/scripts/generate-font-trios.mjs`) emits it, so the rule is
self-maintaining for the one real case. **What it lets through is a generated
file whose generator emits no marker** — and that file lands *in* the over-stop
set, where it is visible, rather than being silently excluded by a filename
convention nothing enforces or by a list someone must maintain. `editor-shell.css`
is **authored**: no generator produces it, the token ratchet parses it for
literals, and provenance is not what that ratchet measures. Tests are **authored
and in scope** — the stop applies to them, and four of the largest entries are
e2e specs.

`ponytail:` the marker is a five-line head read, not a parse. Upgrade to a
per-ecosystem marker table when a second generator exists and does not use this
wording — not before, since there is exactly one generated file today.

`ponytail:` the 500 tier is a **count in the report, never a set**. A per-file
list of 110 signal-tier files would be the second backlog the row warns about,
and a ceiling on a signal would block ordinary work; the number is printed so
`AGENTS.md`'s rule is not silently halved.

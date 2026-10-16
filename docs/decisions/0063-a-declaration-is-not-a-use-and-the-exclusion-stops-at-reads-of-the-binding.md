# 0063 — A declaration is not a use, and the exclusion stops at occurrences that cannot be a read

- **Date:** 2026-10-17
- **Status:** accepted
- **Paths:** `scripts/dead-code-sweep.mjs`
- **Task:** Phase 21.5 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (row `vg-382`)

## The problem

`vg-382`'s ruling is **a declaration is not a use.** The sweep's
`redundant-export` tier decides liveness with a text counter —
`usesIn(selfUse.get(file), name) > 1`, raw occurrences of the name in its own
comment-stripped, string-stripped file — and its evidence sentence reports
`usesIn - 1`, one declaration assumed and every other occurrence a use. Two
shapes break that assumption, and both were found by an independent review
rather than by the tier:

- **An object key.** `new-fabric-theme-globals.ts` declared `panel` and carried
  `panel:` twice, once in `starterPalette` and once in a second map. `panel:` in
  a literal names a *property*; it does not reach the binding. The tier read both
  as uses and reported *"the symbol is LIVE: its own declaring file uses it (2
  occurrence(s) …)"*. The const had no reader.
- **A re-export.** `artboard-crop.ts` imported `countable` and `EDGE_TOLERANCE`
  and re-exported both. `declaredExports` reads `export { x };` as a declared
  export, so the line that *forwards* the name counted as evidence the name was
  live, and both rows were withheld from the removal list.

The shape of the problem: **a text counter has to tell a read from a declaration
without a parse**, and the two shapes are declaration-shaped rather than
read-shaped. The plan's bias — *"a survivor costs a ticket and a deleted live
symbol costs the product"* — fixes which way the errors may fall.

## Rung 1 — Vigilia

Searched: `scripts/dead-code-sweep.mjs` for existing declaration handling
(`usesIn`, `usesOutsideDeclaration`, `declaredExports`, the tier that emits
`redundant-export`); every `.mjs` under `scripts/`, `src/web/scripts/` and
`src/web/packages/*/scripts/` for a TypeScript parse
(`grep -rln 'createSourceFile\|ts-morph\|typescript'` → **nothing**);
`src/web/package.json` for the lint step (`gate` runs `biome check ..` first).

Found:

- `usesOutsideDeclaration = Math.max(0, usesIn - 1)` — exactly one declaration
  assumed, every other occurrence counted as a use.
- **`declaredExports` already carries the parse the fix needs**: `EXPORT_LIST`
  and `EXPORT_FROM` already separate `export { x }` from `export { x } from
  "./y"`, and `readSpecifiers` already distinguishes a re-export from an import.
  The export-list half of this decision is the existing regexes applied to a new
  question, not new parsing.
- Nothing in the repo parses TypeScript. The sweep's importer graph is text.

## Rung 2 — dependencies

Searched: `src/web/package.json`'s devDependencies; the installed
`src/web/node_modules/typescript`; `@biomejs/biome` and `biome.json`.

Found:

- **`typescript` 7.0.2 is installed**, so `ts.createSourceFile` is available and
  would answer "is this occurrence an identifier reference" *exactly* — no
  heuristic. It is also a parser the sweep does not otherwise use, and adding one
  for a single tier makes that tier's answer and the graph's answer come from two
  different readings of the same file.
- **Biome parses TS and already encodes half this ruling**: `biome.json` sets
  `correctness.noUnusedVariables` and `correctness.noUnusedImports` to `error`
  with `recommended: false`, i.e. they are on deliberately and are not part of a
  preset. Biome is a binary, not a callable library, so it is a *backstop* here
  rather than an option — see Rung 6.

## Rung 3 — platform

Searched: what Node and the language give for "is this text occurrence a read".

Found: **nothing.** There is no platform API that answers it; the answer is a
parse or a heuristic over text, and `node:fs` plus a regex is the sweep's whole
mechanism. That is why the decision below is a rule about *which occurrences the
counter may ignore* rather than a new reading of the file.

## Rung 4 — ecosystem

Searched (2026-10-17): *"ts-prune knip unused export detection TypeScript AST
false positive object key"*, then the two tools' own pages —
`ts-prune`'s README (`raw.githubusercontent.com/nadeesha/ts-prune`) and
`knip.dev/reference/configuration`. **The web-search tool was unavailable in this
environment and returned no live results**, so those two pages are the whole of
the live evidence and everything else below is quoted from them rather than
summarised from elsewhere.

Found — **both tools solve this shape by parsing, and neither reports an object
key as a use**, because in an AST a property key is not an identifier reference:

- **`ts-prune`** is built on `ts-morph`, whose README states *"the analyzer uses
  the compiler bundled with ts-morph independently"*. It marks an export used
  inside its own file **`(used in module)`** — the same two-way split as this
  sweep's `redundant-export`/`dead-export`, arrived at separately. It documents
  its own blind spots rather than claiming none: namespace uses it cannot track,
  side-effect imports and wildcard re-exports all *keep unused exports out of the
  report*, and literal dynamic imports *"conservatively mark all exports in that
  module as used"*. It ends on *"Review findings before deleting code."*
- **`knip`** exposes `ignoreExportsUsedInFile` to *suppress* exports used only
  inside their own file, i.e. it models the same class and lets a project choose
  whether that class is a finding. Its configuration page: *"If these exports
  should not be reported"*, and *"once internally unused too, knip reports it"* —
  the same liveness question this tier asks.
- **The negative result is the one that matters here**: neither page documents an
  object-key false positive, because neither can produce one. No prior art was
  found for detecting the same signal with a **text counter**, which is the thing
  this decision has to do.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **A declaration-aware counter: the named declaration shapes are excluded, every rule one that cannot match a read** | The ruling's shape; the export-list regexes already exist; the tier stays text | ~35 lines and three self-test fixtures | A rule that fires on a read moves a live symbol onto the removal list — answered by making each rule structurally unable to match one | **chosen** |
| Parse with the installed `typescript` compiler and collect identifier references | Exact; the false-positive class disappears | A parser added to a text instrument, ~260 files parsed, and the tier's answer then comes from a different reading of the file than the graph's | A second source of truth for one tier; a `.tsx`/`export =`/ambient edge the regexes never had to think about | rejected |
| Adopt `ts-prune` or `knip` as a dependency | Both solve unused exports, and better than this tier does | A new dependency, and it answers only one of this sweep's six kinds — `test-only-consumer`, `no-importer-file` and `unreachable-branch` are not in either tool | Replacing a working instrument with one that answers a quarter of its question; Phase 21's constraints are against adding dependencies | rejected |
| Treat the tier as a pre-filter and let typecheck re-test the survivors | The row's own second option, and it needs no code | Nothing | The ruling chose the other option, and the backstop fires a commit *later* than the report — see Rung 6 | rejected |

## Rung 6 — probe

Measured 2026-10-17 at `3eacbdfd` (`develop`), by the classifier in a scratch
copy of the script outside the repo, against the two historical file contents
(`git show 93bb2c5f^:…new-fabric-theme-globals.ts`,
`git show c9ed9dcc^:…artboard-crop.ts`) and against synthetic fixtures:

| Measurement | Value |
|---|---|
| `panel` in its historical file | raw occurrences **3**, declaration-shaped **3**, reads **0** — was `redundant-export`, is `dead-export` |
| `countable` in the historical `artboard-crop.ts` | raw **2**, declaration-shaped **2**, reads **0** — same flip |
| `EDGE_TOLERANCE`, same file | raw **2**, declaration-shaped **2**, reads **0** — same flip |
| The live tree at HEAD | **0 of 99** `redundant-export` rows change kind, **0** evidence numbers change, `dead-export` stays at 6 |
| Why zero | **both instances the row names are already gone**: `panel` was deleted at `93bb2c5f`, the re-export at `c9ed9dcc` |

**The zero is the finding, and it is a measurement rather than a gap.** The
ruling is a precision fix whose only two known instances were removed by the very
work that found them, so the widened test has no live instance to change and the
re-run's newly-reported set is empty. The classifier is proved by the two
historical file contents above, which are exactly the shapes the row names.

**The row says typecheck is the backstop for this class, and the mechanism is
right but the owner is not.** No `tsconfig` in this repo enables
`noUnusedLocals`, so the typechecker would not have flagged anything; the rule
that fired on `panel` was **Biome's `noUnusedVariables`**, at `error` in
`biome.json:14`, reached through `gate`'s `biome check ..`. Its sibling
`noUnusedImports` (`biome.json:15`) covers the re-export class the same way:
removing `export { countable, EDGE_TOLERANCE }` leaves the import with no reader,
and an unused import is an error. **So the backstop holds for both classes** —
with the caveat that it fires only *after* the wrong remedy has been applied, one
commit later than the report that gave it, which is why the tier's own precision
still matters.

## Decision

**The self-use test excludes declaration-shaped occurrences, and the exclusion
stops at occurrences that cannot be a read of the binding.** Three shapes are
excluded, each because it names the symbol without reaching it:

1. **The declaration site** — the name token directly after
   `function`/`class`/`const`/`let`/`var`/`interface`/`type`/`enum`/`namespace`.
   This is the `- 1` the old arithmetic hard-coded, now stated instead of assumed.
2. **A specifier in an import or an export list.** This is the re-export half,
   and it is what `declaredExports` already reads as a declared export.
3. **An object key** — `name` with `{`, `,` or a line start before it **and a `:`
   after it**. The colon is the whole guard: without it the rule would swallow
   `case name:` and `cond ? name : x`, which are reads.

**Where the line is drawn, and what a false positive costs.** The two remedies
are opposite: `redundant-export` says *"only the `export` keyword is unnecessary
— do not delete the symbol"* and `dead-export` puts the symbol on the removal
list. So excluding too much is the unsafe direction — it moves a live symbol from
the first list to the second. **Every rule above is one that cannot match a
read**, and that is the test each of the three had to pass rather than a
judgement about how likely a false positive is. The two shapes the ruling does
*not* name are recorded as limits rather than implemented:

- **A member access (`obj.name`) is not excluded.** It reaches a property rather
  than the binding, so it is not a read either — but it is not *declaration*-
  shaped, the ruling names two shapes, and a third exclusion is a decision it did
  not make. A symbol kept alive only by `obj.name` still reads as live.
- **A destructuring binding (`const { panel } = obj`) is not excluded.** It
  declares the binding *and* reads the property, so it is counted, which
  over-retains. Safe direction.

**The evidence sentence changes with the counter, rather than the counter being
split in two.** The alternative was to keep `usesIn - 1` in the sentence and use
the declaration-aware count only for liveness — which would leave a row reading
*"2 occurrence(s)"* for a symbol with one call site and one object key, exactly
the imprecision the previous arithmetic was written to remove. The number a
Phase 2 reader acts on now means what its sentence says: *reads* of the name, with
every declaration-shaped occurrence excluded. The `dead-export` sentence changes
with it, because its *"(1 occurrence — the declaration itself)"* is no longer
true once more than one occurrence can be declaration-shaped.

`ponytail:` the exclusion is three text rules, not a parse. Upgrade it to
`ts.createSourceFile` when a rule is observed firing on a read — not before,
since at HEAD the widened test changes no row at all.

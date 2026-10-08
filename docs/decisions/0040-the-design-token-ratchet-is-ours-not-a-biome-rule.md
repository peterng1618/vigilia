# 0040 — The design-token ratchet is our own scan, not a Biome rule

- **Date:** 2026-10-08
- **Status:** accepted
- **Paths:** `scripts/design-tokens.mjs`, `scripts/design-tokens.gated.json`

## The problem

The design language was declared and never consumed: `@theme static` in
`editor-shell.css` held `--spacing`, `--radius-*`, `--text-*` and `--shadow-*`,
and nothing in the workspace referenced them. The fix needs a *ratchet* — a list
of files that are already converted, checked for token literals — because a
whole-repo linter cannot go green on the day it is added and a gate that starts
red and stays red is turned off.

The shape that is non-obvious: the rule must hold for `.css` **and** `.tsx`
(the control set is React), must exempt the places where a literal *is* the
correct answer (any block that defines tokens, palettes included), must not call
every value the bible prints outside §3's spacing table a violation, and must
report success only when it actually looked at files.

## Rung 1 — Vigilia

Searched: `scripts/*.mjs` (seven files: `backlog-check`, `check-status`,
`ownership-enforcement`, `ownership-overlap`, `ownership-sweep`, `reuse-gate`,
`sdd-checkpoint`), and the workspace for existing token consumption.
Found: no literal-scanner of any kind; each existing script is a repo-hygiene
gate wired into `gates:self-test` behind a `--self-test` flag — the pattern this
note's script follows. On the harness side, no existing consumer of
`--space-*`/`--elev-*` (they did not exist) and exactly 8 uses of the affected
Tailwind utilities (`rounded-sm`×4, `text-xs`×2, `text-sm`×1, `rounded-md`×1, in
`components/ui/colour-picker.tsx` and `components/ui/gradient-editor.tsx`).

## Rung 2 — dependencies

Searched: `src/web/package.json` devDependencies (biome 2.5.14, playwright,
vitest, typescript, vite, jsdom 26.1.0, canvas) plus the installed Biome rule
catalogue (`node_modules/@biomejs/biome/configuration_schema.json`).
Found: **Biome ships `lint/style/noHexColors`** (available from 2.3.14,
CSS-only, no fix). It is the CSS half of the hex rule and it already sits in the
tree — the one real alternative in the rung. `jsdom` is also already present and
provides a CSSOM.

## Rung 3 — platform

Searched: Node stdlib (`node:fs`, `node:path`, no CSS parser), the browser
(no diagnostic for a literal that should have been a token), and jsdom's
`cssstyle`-backed stylesheet model.
Found: the platform gives text and no analysis. jsdom parses a stylesheet, but
it drops or ignores modern syntax Tailwind 4 emits (`@theme`, nesting) and it
has nothing to parse when the gated file is a `.tsx`, where the literals live
inside `className` strings and inline style objects.

## Rung 4 — ecosystem

Searched: the installed Biome rule catalogue (`biome explain noHexColors`,
which names its inspiration), and the stylelint rule family that is the
ecosystem's answer to this problem — `color-no-hex`, and
`stylelint-declaration-strict-value` for property→variable enforcement. No
browser search was available in this environment, so the ecosystem half rests on
the rule catalogues of the linters actually installed and on those known rules
rather than on a live query; that limitation is stated rather than hidden.
Found: every one of them is **CSS-only**, is configured repo-wide, and has no
notion of either a per-file ratchet or a block that is allowed to contain the
literal. None solves this shape.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Biome `noHexColors` in `biome.json` | Covers CSS hex only; cannot exempt the palette blocks; says nothing about the px scale; no ratchet | 1 config line | Measured at **84** hits in `editor-shell.css` alone, every one inside a palette block that must keep its hex. The available silence is a file-level ignore, which would also silence the rest of the file | Rejected for this rule |
| Biome `noHexColors` called from our script | Same coverage as above | subprocess per run | Same 84 hits and still CSS-only | Rejected |
| `stylelint` + `stylelint-declaration-strict-value` | Mature property→variable enforcement | New dependency (a plan failure here) and a second linter config | CSS-only while the ratchet's next files are `.tsx` | Rejected |
| jsdom CSSOM walk | Uses an already-installed package | Parse per file | Incomplete for `@theme`/nesting; no stylesheet to walk in `.tsx` | Rejected |
| Our own scanner (chosen) | One text rule set for `.css` and `.tsx`, a per-file ratchet, and a definition-block exemption | ~250 lines in `scripts/` | False positives are possible — the values allowed outside a spacing property are `biblePx` in the gated JSON, precisely so a reviewer can widen them in one line | **Chosen** |

## Rung 6 — probe

`npx biome lint --only=style/noHexColors --max-diagnostics=5 packages/editor/src/editor-shell/editor-shell.css`,
run from `src/web/`: *Checked 1 file in 35ms. Found 84 infos.* (79 not shown.)
Every diagnostic sampled is a `--shell-*` palette declaration — the values the
design language says are the one legitimate home for a hex. The rule is
factually right and unusable here.

`node --version` → v24. Measured on `editor-shell.css` as the same input each
time: 106 violations against the first version of the scan, 87 once the
exemption stopped at definition blocks, 74 with the shipped `biblePx` allowlist.
The first number is the one that mattered: **106** included five hexes in the
`:root:not([data-shell-palette="editorial"]) .editor-glass` treatment rule, which
only a substring test on the attribute could have thought was a palette.

`import.meta.dirname` is what the script resolves the ratchet and its entries
against, so the guard behaves the same from the repo root and from `src/web/`.

## Decision

A plain Node script, `scripts/design-tokens.mjs`, walking
`scripts/design-tokens.gated.json` when run, and exporting
`check(relPath, source, biblePx)` for a caller. It is chosen over Biome's rule
for the reason the probe gives: the exemption is the load-bearing half, and
Biome can only express it as a whole-file silence.

What shipped:

- **A definition-block exemption, not a palette one.** A block is a definition
  when every comma-separated selector in its prelude is `:root`, the
  attribute-only `[data-shell-palette="…"]` or `.editor-shell-palette-swatch`,
  or when it is an `@theme` block. A prelude carrying `:not(` or a descendant
  combinator is a treatment rule and is checked. This is what lets
  `editor-shell.css` — the file that *defines* the language — join the ratchet
  at all.
- **Two px tiers.** In a spacing property (`padding*`, `margin*`, `inset*`,
  `translate*`, `top`, `right`, `bottom`, `left`, `gap`, `row-gap`,
  `column-gap`) only bible §3's steps are allowed; anywhere else the values the
  bible prints are allowed as well, listed as `biblePx` in the gated JSON.
  `0`, `1` and the steps hold without it, so an empty allowlist narrows tier 2
  instead of disabling it. This text guard is the cheap ratchet — Task 4's
  browser assertion on computed spacing is the real enforcement.
- **A CLI that runs only as the entry point**, compared as `realpathSync`ed
  paths (case-insensitively on Windows), so an importer gets the export and no
  side effects — including from a symlinked invocation, which otherwise exits 0
  having checked nothing. The self-test is inside that gate too.
- **A JSON that is either the bare array of gated files or an object holding
  `gated` and `biblePx`.** An empty gated list is still a failure: a guard over
  zero files reporting success is the defect this decision exists to remove.
- **Bible §4's colour roles, declared per palette**, because the spec and every
  later plan write that vocabulary and only `--shell-*` existed. An alias is
  substituted where it is declared, so a single `:root` declaration would
  resolve the root's palette and pin the swatch chip; all six palette blocks
  therefore repeat the ten aliases, and `--faint` is derived from each palette's
  `--muted` with `color-mix` rather than hand-tuned six times. They are exposed
  as `--color-*` utilities through the existing `@theme inline` block, which is
  what makes a utility carry the palette in force. `--color-bg` is deliberately
  absent and pinned absent by a test: `--bg` aliases `--shell-backdrop`, a
  gradient stack in graphite and light, and a colour utility from it would set a
  colour to a gradient and be dropped in silence. `--stage`, `--hdr` and
  `--edge-2` are **not** declared — their first consumers arrive in later plans,
  and a colour declared for nothing is the defect this plan exists to remove.
  Nothing is renamed and no `--shell-*` is deleted.

The guard's own test lives behind `--self-test` in the same file and is wired
into `gates:self-test`, so its proof cannot drift out of the aggregate gate.

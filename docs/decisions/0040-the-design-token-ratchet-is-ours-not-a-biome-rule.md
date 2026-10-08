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
(the control set is React), must exempt the one place hex values are the correct
answer (the six palette blocks), and must report success only when it actually
looked at files.

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
| Our own scanner (chosen) | One text rule set for `.css` and `.tsx`, a per-file ratchet, and a real palette-block exemption | ~130 lines in `scripts/` | False positives are possible — the exempt px set is a visible constant precisely so a reviewer can widen it in one line | **Chosen** |

## Rung 6 — probe

`npx biome lint --only=style/noHexColors --max-diagnostics=5 packages/editor/src/editor-shell/editor-shell.css`,
run from `src/web/`: *Checked 1 file in 35ms. Found 84 infos.* (79 not shown.)
Every diagnostic sampled is a `--shell-*` palette declaration — the values the
design language says are the one legitimate home for a hex. The rule is
factually right and unusable here.

`node --version` → v24; `import.meta.dirname` is available and is what the
script resolves the ratchet and its entries against, so the guard behaves the
same from the repo root and from `src/web/`.

## Decision

A plain Node script, `scripts/design-tokens.mjs`, exporting
`check(relPath, source)` and walking `scripts/design-tokens.gated.json` when run
directly. It is chosen over Biome's rule for the reason the probe gives: the
palette exemption is the load-bearing half, and Biome can only express it as a
whole-file silence. Its own test lives behind `--self-test` in the same file and
is wired into `gates:self-test`, so the guard's proof cannot drift out of the
aggregate gate. An **empty ratchet is a failure**, because a guard over zero
files reporting success is the defect this decision exists to remove.

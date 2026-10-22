# 0058 — The sweep's self-test pins a live file, and a live file's test-only status is not the sweep's to keep

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `scripts/dead-code-sweep.mjs`

## The problem

`scripts/dead-code-sweep.mjs`'s self-test is the only gate that script has — Biome's
`files.includes` covers `src/web/**` and no tsconfig includes `scripts/`, so nothing else in this
repository can fail an `.mjs`. One of its 22 checks asserts that the `test-only-consumer` kind fires,
and it names a file: `at("test-only-consumer", FONT_PICKER)`.

**That file stopped being a test-only consumer on 2026-10-16**, when Phase 19's Task 19.1 mounted
`FontPicker` into `selection-inspector/font-face-field.tsx`. The mount is exactly what `vg-268` and
`vg-283` ruled and both closed on it. So `npm run gate` went red at `055c7ecc` and stayed red through
four task closes and this phase's close, because no close between them ran `gates:self-test` — the
same shape Phase 5's Acceptance records for `dead-code-sweep`'s negative fixture, which survived a
phase close the same way.

The question the red poses is not "which file" but **what a self-test may pin**. The script runs
against the real tree — `the walk found the tree` counts > 400 files and `the walk found the test
suite` counts > 200 test files — so every case it names is a live file whose status the sweep does not
control and the product is free to change for good reasons.

## Rung 1 — Yunari

Searched: `scripts/dead-code-sweep.mjs`'s self-test block (`:911-1000`), its `--json` candidate
report at `014d38b3`, and every other check that names a file (`SETTINGS_FIELD`, `LIVE`,
`CARD_LIBRARY`).

Found: **the self-test names four live files, and two of the four have already been invalidated by
legitimate work.** `font-picker.tsx` is this red; **`boot-theme.ts` is the other**, and Phase 5's
Acceptance records it — `BootThemeOutcome` was exported from the negative fixture with no production
importer, the `the negative case is absent from every kind` check went red at `a50870b5`, and it was
fixed at the consumer in `b1383446`. The remaining two are `settings-field.ts`, whose symbol is dead
by its own file's admission, and `card-library.ts`, a known redundant export. Eleven files are
`test-only-consumer` today: `accessible-name.ts`, `ui-copy-readers.ts`, and nine
`*-fixture.ts`/`*-test-stage.ts(x)`/`*-test-utils.ts`.

## Rung 2 — dependencies

Searched: the script's own imports — `node:fs`, `node:path`, `node:url`, `node:child_process` only.

Found: nothing. The sweep has no dependency that could own this, and a self-test cannot be delegated.

## Rung 3 — platform

Searched: whether Node or the package manager offers a fixture mechanism.

Found: nothing relevant. `node:test` has no fixture-tree concept, and this script is run by
`npm run gates:self-test` as a plain process, not by a runner.

## Rung 4 — ecosystem

Searched: how dead-code and unused-export scanners self-test their own detection — `knip`,
`ts-prune`, `unimported`, `depcheck`, `ts-unused-exports`, `jscpd --dead-code`,
`golang.org/x/tools/cmd/deadcode`, and the projects that wrap them.

Found: **the field pins a fixture the tool owns, never a live file.** `repowise` runs its analyzer
against `tests/fixtures/ts_sample` and asserts a *planted* dead interface and a *planted* orphan
module; `pruneguard` keeps `fixtures/parity/<family>/<name>/` with an `expected.json` naming the
findings by path and symbol; `locrin` calls `fixture("dead_export", "flag")`; `astro-cli` verifies its
gate by **planting a deliberately-unreachable function and reading the gate fail**, then removing it.
The reason is the one this red is: a fixture is owned by the test, so the product cannot invalidate it
by improving.

## Rung 5 — comparison

Our self-test's character is the opposite: it is deliberately a self-test **on the real repository**,
which is what makes its other checks worth having — that no test file is ever a candidate, that no
package barrel is a `no-importer-file`, that no ambient `.d.ts` is a candidate, are claims about
*this* tree and would be vacuous against a synthetic one. Adopting the field's fixture tree would
mean keeping both: a synthetic tree for the kind-fires checks and the real tree for the
invariants. That is a redesign of the instrument, and it is Phase 21's subject, not this close's.

## Rung 6 — probe

The probe is the red itself, and it was run before this note was written: the self-test reads
**21/22 passed**, `failed: ['test-only-consumer lands on font-picker.tsx']`, with the sweep's own
`--json` report showing `font-picker.tsx` absent from `test-only-consumer` and present as
`redundant-export … FontPickerProps`. **The sweep is right and the pin is stale**, which is the
opposite of the Phase 5 case where the negative fixture's own file had gained an export.

## Decision

**Pin a file whose test-only status is legitimate and permanent rather than incidental.** The check
moves to `src/web/packages/editor/src/ui-copy-readers.ts` — a production-named file with no
production importer, consumed by `ui-copy-panels.test.ts` and `ui-copy-surfaces.test.ts` alone. It
exercises the same rule `font-picker.tsx` did (a production path, not a `*-fixture.ts` by naming
convention, so the check cannot pass on the naming alone), and unlike `font-picker.tsx` nothing in the
product should ever import it: a test reader is *supposed* to be test-only.

**The residual is filed rather than fixed**: a self-test that pins a live file can be invalidated by
any future task, and the field's answer is a fixture tree the test owns. That is Phase 21's, and the
row carries this rung-4 search as its evidence.

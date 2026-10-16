# 0067 — The sweep's kind-fires checks run against a fixture tree, and the real tree keeps the invariants

- **Date:** 2026-10-17
- **Status:** accepted
- **Paths:** `scripts/dead-code-sweep.mjs`

## The problem

`0058` closed the first instance of this defect by moving the check off
`font-picker.tsx` and onto `ui-copy-readers.ts`. **That is a third pin on a live
file, not a fix**, and the row says so: the self-test runs against the real tree,
so every file it names is one the product is free to change for good reasons.
Two of the four pins have already been invalidated by work the product wanted —
`font-picker.tsx` by the mount that closed `vg-268`/`vg-283`, and `boot-theme.ts`,
the *negative* fixture, by an export that reddened the whole of Phase 6. **A
negative fixture that is a real file is the same defect wearing the opposite
sign.**

What remains is a design question rather than a red: where a fixture tree lives,
what a kind-fires case asserts against it, and how the fixture stays honest.

## The searches are `0058`'s

Rungs 1–6 of `0058` are this shape's search and are not repeated here. Rung 1
found the four pins and the two already invalidated; rung 2 found no dependency
that could own a self-test; rung 3 found no platform fixture mechanism; **rung 4
found the field's answer — `repowise`, `pruneguard`, `locrin` and `astro-cli`
each pin a fixture the tool owns, never a live file**; rung 5 found that our
self-test is deliberately *on the real repository*, which is what makes its
invariant checks worth having; rung 6 is the red itself.

**This note relies on rung 4 for the fixture and on rung 5 for keeping both
trees, and it moves rung 6's fix**: `ui-copy-readers.ts` is not the answer, and
neither is any other file the product owns.

## What this note adds: the shape, and the two questions `0058` left open

**Where the fixture lives, and how it is walked.** A temp tree the self-test
builds, analysed by **this script run again against that root** (`--root <dir>`)
rather than by a second classifier in the same process. The reason is the one the
row names: a fixture that drifts from what the sweep emits is a new pin, one
directory over. A child process is the same program over a different root, so
there is nothing to drift. `astro-cli`'s shape (rung 4) is this one — plant, run
the gate, read it fail.

Rejected and recorded: extracting the graph build into an `analyse(root)`
function called twice in-process. It costs less at runtime and a far larger diff
(~350 lines re-indented for a test), and it would make the sweep re-runnable over
an arbitrary root, which nothing asked for. The child run exercises the whole
program — CLI, walk, classification, JSON — which is the stronger check.

The temp tree is deliberate rather than a checked-in fixture: under
`src/web/tests/` it would be scanned by the real walk, and anywhere under
`src/web/` it would be picked up by vitest's globs and Biome's `includes`. A temp
tree is invisible to every other instrument, which is what a fixture owned by one
test should be.

**What a kind-fires case asserts, and how the fixture stays honest.** The fixture
mirrors the shape each kind exists for, and the checks name that shape rather
than a file the product owns: a module only a test imports
(`test-only-consumer`); a module a production file imports but whose symbol
nothing imports and whose own file never reads it (`dead-export`); the same,
except its own file calls the symbol (`redundant-export`); and a module a
production file imports, which **no kind may report** — the negative case. The
number a check asserts is read off the fixture body the test itself wrote, so the
check is not a restatement of the emitter: the fixture's `instantiateCard` is
declared once and called once, so the row must claim 1 against 2 raw
occurrences.

**The real tree keeps the invariants, and both walks stay.** `no test file is
ever a candidate`, `no package barrel is a no-importer-file` and `no ambient
`.d.ts` is a candidate` are claims about *this* tree and are vacuous against a
synthetic one, so `the walk found the tree` (> 400 files) and `the walk found the
test suite` (> 200 test files) are kept beside the fixture run. Both are
thresholds rather than exact counts, so a file added to the repository does not
break them; a self-test that replaced one walk with the other would trade a
fragile pin for a check that proves nothing.

**The `barrel-only-export` check stays a count on the real tree**, which `0064`
already arranged — a count survives the split where a pinned file does not.

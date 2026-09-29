# Vigilia status

Updated: 2026-09-30
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

**Be the human author. Use the product, find what is wrong, write it down, and
have it fixed. Repeat.**

This is a standing instruction, not a phase. A fresh session picking this up
should not be asking "what is the next task" — it should be opening the editor
and the host, driving them as an author would, and finding the next thing that
is broken. The backlog grows as a result; work is dispatched against it.

The loop, in order:

1. **Use the product** with Playwright MCP — the editor, the host, the player,
   at a real screen size and at 390 px. Insert, select, type, resize, save,
   reopen, play, fail. Do not read the source for a defect you can see.
2. **Write it into the findings backlog** in
   [the plan](docs/superpowers/plans/2026-09-29-author-journey-proof.md),
   classified blocking or deferred, with the measurement that shows it.
3. **Dispatch a subagent** to fix it, with the file set it owns and the files
   it must not touch, plus a browser proof it cannot fake.
4. **Verify the landed work yourself** by using it again. A passing agent report
   is not evidence; a screenshot and a number are.

## Active work

- **Active plan:** [author journey proof](docs/superpowers/plans/2026-09-29-author-journey-proof.md). Phase 0 is complete and the rebuild has run once; the Findings backlog is now the working queue and it is **live** — it grows and re-prioritises as things are found.
- **How big the backlog is:** ~40 findings, 26 landed, 1 resolved as a side effect, 2 withdrawn, the rest queued or in a design pass. Groups **A** (defects) and **B** (decided) are dispatchable now; **C** wants a design pass first; **D** are questions.
- **The frame that matters:** the editor is **desktop-only** (`tests/e2e/surface.ts`); a **phone is the main display type** and the **player is the product's face**. Weight player and phone work accordingly.
- **The rule for the pass:** fix what you find using what the repo already decides — the owner in `ownership.md`, the surrounding idiom, the copy in `ui-copy.ts`, the pattern the existing controls set. Only a genuine product decision with no precedent gets recorded and passed over. **Nothing waits on a human.**

## Last completed change

- **A token now says how many objects use it, and which** (`b474563`). `objectPaletteReferences` sits beside `reassignObjectPaletteReferences`, which already walked the scene and **returned a count that was thrown away**; the panel takes an injected `usage()` so the number it shows and the number that guards a deletion come from one place.
- **The frosted-glass control now carries the frosted surface** ([#11](https://github.com/peterng1618/vigilia/issues/11)) — `df9e725`. Measured over the author's own photograph on a real host, the card interior went **45.4 → 137.4 luma** against a photograph at 189.1: transmission **0.216 → 0.718**. At 85 % a blur is a blur of nothing.
- **Three more landed:** `artboard.fitMode` → **`contentFit`** in schema, type, validator and geometry (`23b4e7f`), and the control is **gone** because content is always `contain`; redo and front/back now answer to the chords graphic editors use (`66264bc`).
- **Three corrections agents made to my own findings** — the redo audit understated its bug (Ctrl+Shift+Z would have *undone*), the U4 "history" report described a different bug, and `frostedCard` was never the broken piece.
- Gate green: `typecheck`, `lint`, `format:check`, **2167 unit tests across 165 files**. Playwright last ran **209 passed / 143 skipped / 2 failed**.

## Next

1. **Keep using the product.** The backlog is only as good as the last hour of driving it.
2. Dispatch the largest untouched group from the user's review: **bounded number fields** — sliders (Base UI already ships `slider/`) and **clamping instead of reverting**, which is what teaches an author the bound.
3. Group C still wants a design pass: the right sidebar restructure, the token panel to the left, the shortcut editor, the zoom toolbar, the gradient/colour surface.
4. The screenshot spring clean — now for the merely-stale captures; the **v1 ones wait until v1 is removed**, as decided.
5. Then the font trio catalogue and the queued specs.

## Blockers / unverified

- **Whether a person now calls the frosted card glass is still the user's call.** Transmission is measured; the verdict is not an agent's to make.
- [#7](https://github.com/peterng1618/vigilia/issues/7): the `Ctrl+N` discard prompt on a saved document — cause not established, pre-existing. Also filed by agents: **#13** artboard clipping (Fabric has no scene-level clip), **#14** the layer panel's missing background-media row, **#8–#10** rebuild questions.
- **Agents die silently and leave finished work uncommitted** — three times now. And the converse: **no agent shells running does not mean the agent is done**, it means it was between tool calls. Check `git status` after a notification, verify the tree (`typecheck` + `npm test`), and commit what is good rather than losing it — and expect a second wave of changes from the same agent afterwards. A default-worker test run also under-reports: 1821 tests against a real 2169, from worker starvation alone. Pin `--maxWorkers` before believing a count.
- **The Playwright MCP browser and the host ports are shared**, so two agents got a screenshot of someone else's document; and an agent's own test can be a **false green** — `press("Control+Shift+]")` is not that chord, because Playwright synthesises by key name and never applies the shift-to-character mapping. Give each agent its own port and browser, **build the bundles before looking at anything** — a stale bundle cost this pass a wrong conclusion — and dispatch chords over CDP.
- The frosted CPU card's `mr` handle does not track the pointer, and Task 9's three open edges (the `Promise.allSettled` split frame, the POSIX drive→volume join proven only on Windows, `storage-card-value` overrunning its card) are all still open.

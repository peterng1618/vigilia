# Vigilia status

Updated: 2026-10-12
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–5, 7 and 8 are closed, and plan 6 is finished locally and archived; the
objective stays open on one blocked acceptance item. The target is
[`DESIGN.md`](DESIGN.md), the contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
the checked drawing is [`docs/design/mockups/`](docs/design/mockups/), and the boundary that
makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

**The drawing is the acceptance instrument, by the user's ruling of 2026-10-10:** the
mockup is not replaced and the shipped surface is pulled to it. The measure of done is the
spec's Acceptance section, counted rather than reviewed — and it is not met while a surface
satisfies every token in `DESIGN.md` and still does not look like the mockup.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md` — reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: Phase 1 is closed, **Phase 2 closed with both reference reports reviewed**, Phase 3 removal has **Tasks 4 and 5 complete, Task 6 next**, Phase 4 the register (7); **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **Task 5 landed and passed both verdicts** — the six shared packages give up 51 `redundant-export` keywords, 3 dead symbols and 1 dead re-export in `47658230` + `c9ed9dcc` + `fd32a420`; the group went 88 → 32 candidates with 32 kept deliberately, and `theme-package`/`fake-source` yielded none.
- **The persisted-scene boundary was the real risk and it held** — `PlanIssue`'s `"unresolved-asset"` had its producer's removal verified as an ancestor of base, the literal found nowhere constructed by string, and `PlanIssue` confirmed not persisted; nothing removed is a Fabric property name, a `KIND_*` key or a schema value.
- **The 51 keyword strips were scanned rather than sampled** — 51 removed lines against 51 added, every one a bare `export ` strip; and all 24 retained rows were checked per row against the test the row names, with no `vi.mock`-only importer, so Task 4's over-retention gap did not repeat.
- **The full-suite red was not this task's, and reading the source settled it** — the lane's 1 failure did not reproduce (a re-run at the same commit gave 770 suites / 3287 tests / 0 failed), the editor package is byte-identical base↔HEAD, and the assertion at `runs.dom.test.ts:220-221` reads `Date.now()` *after* the render, so it fails on a minute boundary; filed as `vg-383`.
- **Two register rulings, one by amendment and one by declining** — the re-export finding amends `vg-382`, since a property key and a re-export are one rule with one fix, and its quoted count was corrected from 2 to 1; `"highest"` was **not** filed, because the scanner's own evidence names an outside-arriving value as its expected false positive and `lhm-mapping.ts` implements the documented default as the `Math.max` branch.

## Next

1. **Task 6 is next — the ungated trees and stale references** — `tests/e2e/**` and the `.mjs` scripts, which sit in no gate and no tsconfig, so a finding there is more likely real and a *removal* there more likely load-bearing to something outside the type system; `docs/architecture/dead-code-candidates.md` is stale for Tasks 4 and 5's removals and belongs to it.
2. **Task 7 closes the plan** — Phase 4 discharges the register rows the sweep's instruments produced (`vg-378`, `vg-379`, `vg-381`, `vg-382`, `vg-383` and the rest), each with a check naming a word from its own title.
3. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.
4. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.
5. **`vg-383` is a flake with a named mechanism and no owner yet** — the run-format preview is asserted against a clock read after the render, so the suite reads red about once in sixty runs and the failure lands on whichever commit is nearby.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

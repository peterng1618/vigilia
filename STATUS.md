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

- **Active plan:** `docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md` — reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: Phase 1 is closed, **Phase 2 closed with both reference reports reviewed**, **Phase 3 removal is closed — Tasks 4, 5 and 6 all passed both verdicts — with Task 7, the register, next**; **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **Task 6 landed and Phase 3 closed, with every CI step this sweep never named green** — the ungated trees lost a dead hook helper and two unused imports in `7bff97a1`, the stale references `vg-275`/`vg-198` were fixed in `f7900f5c`, and `dead-code-candidates.md` came to HEAD with its delta in `6b3f1a1f`; both verdicts passed with no removal falsified.
- **The candidate report's refresh was checked against a second tree, not its own summary** — the reviewer ran the scanner on base and HEAD through `git archive` worktrees and reproduced the whole picture (312 → 107 candidates), reconciling the delta to the commits; §3's coverage limits are still limits, and `tests/e2e/**` is untouched with all 13 retained helper names confined to their declaring file.
- **`npm run format:check` was red at HEAD and CI runs it first** — the damage was Tasks 4 and 5's keyword removals shortening folded type aliases under biome's 80 columns, and it was fixed on the fly at `c65cc0d6`, because `lint` is `biome lint ..` and does not run the formatter.
- **Filed `vg-384` rather than the symptom it was found through** — the row records why two tasks reported green over a CI-red tree: the dispatch gate lists omitted steps CI runs, and it stays open even though the formatting is fixed.
- **Filed `vg-385`, a pre-existing CI red that nothing can see** — the `licences` job fails on four packages absent from `THIRD-PARTY-NOTICES.md`, and it went unnoticed because `ci.yml` never runs on `develop`, the branch this work lands on.

## Next

1. **Task 7 is next and closes the plan** — Phase 4 removes nothing and is judged differently: whether the register ends up agreeing with the tree. It discharges the rows this sweep's instruments produced (`vg-378`, `vg-379`, `vg-381`–`vg-385` and the rest), each needing a `check` naming a word from its own title **and** an `artefacts` sha that resolves as an ancestor of HEAD.
2. **Two plan-queued items wait behind it** — [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).
3. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.
4. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.
5. **`vg-383` is a flake with a named mechanism and no owner yet** — the run-format preview is asserted against a clock read after the render, so the suite reads red about once in sixty runs and the failure lands on whichever commit is nearby.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

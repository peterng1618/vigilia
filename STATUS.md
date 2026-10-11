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

- **Active plan:** `docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md` — reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: all four phases and all nine tasks are closed, each with both verdicts passed and no removal falsified, and **the plan-boundary whole-branch review is what remains before it is archived**; **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **Task 7 landed at `0af7248e` and removes no code** — its acceptance was whether the register ends up agreeing with the tree: the live register went **238 → 236** and the archive **147 → 149**, exactly three rows changed (`vg-198` retitled in place, `vg-275` and `vg-375` archived `verified`), and **no id sits in both files**.
- **`vg-375` was discharged by an un-exporting, which a grep for deleted identifiers is structurally blind to** — the lane found it by reading what the removals *did* rather than what they *deleted*, and the ledger records the dispatch's limit so the next sweep's controller is not misled by the same phrasing.
- **The `check` Task 7 wrote for `vg-375` was false as written, and the controller fixed it at `a09943db`** — `git grep -nIw arrangeEligible` returns seven lines at HEAD, not two, because it matches the row's own text and an archived plan; the reworded form scopes the path and says the scope is part of the check.
- **`vg-275`'s closure stands on the note's content, not on the reason its review gave** — `docs/decisions/README.md` says nothing about append-only, so the right reason is that `0035`'s dated note supersedes the stale writers table in place and by name, with the true writer set.
- **Ruling: the plan is complete** — nine tasks, four phases, every task closed with both verdicts and no removal falsified; 5 symbols including a whole module, 194 `export` keywords, 4 symbol-or-re-export rows and two unused imports gone, and the scanner's after-picture is **312 candidate rows to 107**.

## Next

1. **The plan-boundary whole-branch review is running and is the only thing left before the plan is archived** — dispatched read-only on the most capable model over **this plan's own removal and move commits rather than a `BASE..HEAD` range**, because two other plans interleave on `develop`; on a clean verdict the workspace is deleted, the plan moves to `docs/superpowers/plans/archive/`, and the next active plan is named here.
2. **The backlog drain is third in the user's sequence and is the queued next plan** — [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md) re-derives its batches from the register at run time, and the first step is a reproduction pass rather than a fix pass.
3. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.
4. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.
5. **`vg-383` is a flake with a named mechanism and no owner yet** — the run-format preview is asserted against a clock read after the render, so the suite reads red about once in sixty runs and the failure lands on whichever commit is nearby.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

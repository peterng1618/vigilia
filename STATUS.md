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

- **Active plan: [`2026-10-12-the-backlog-drain.md`](docs/superpowers/plans/2026-10-12-the-backlog-drain.md)** — third in the user's sequence (**managers, then dead code, then the register**), and the only active plan: eleven phases, 43 tasks, planned from the closed spec. The reproduction pass is archived at `docs/superpowers/plans/archive/2026-10-12-the-backlog-reproduction-pass.md` and the dead-code sweep beside it, with its two deviations named in the file itself; **task numbers in that plan are stable identifiers, not positions**.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **One plan is queued behind it**: [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md), and the drain's phases run in the order its own decision 1 fixes — the close phase opens, the ruling sessions follow, then W1–W9.

## Last completed change

- **The drain is planned** — [`2026-10-12-the-backlog-drain.md`](docs/superpowers/plans/2026-10-12-the-backlog-drain.md) turns the closed spec into eleven phases and 43 tasks: 22 closes, the 104 rulings, then W1–W9; 237 rows, none owned twice, and every phase's membership re-derived from the spec rather than carried.
- **Its independent review found fourteen defects, all in invented mechanics** — eight load-bearing, six minor; the phase order, the arithmetic and the structure came back clean. The controller reproduced the three that decided the round instead of relaying them.
- **The archive has 14 problems the checker never saw** — `check()` over the 149 archived rows finds 11 `verified` rows with no valid `artefacts` array, 2 checks the tokeniser rejects and 1 non-sha entry, while the live file is clean at 237; the plan makes the read fatal and repairs them in the same commit rather than widening the rule.
- **The spec's §3.2 and §8.4 carried stale arithmetic and are corrected** — List A is 22 checks (16 pass, 6 reworded, 14 sha-less), not 21, because `vg-309` joined it after §3.2 was written; and `vg-329`'s "about twelve" counts rows, so the archive's 15 key-less rows cannot be folded into it — 12 of those are `withdrawn` and need no artefact at all.
- **A row that cannot prove its close is not a closed row** — where Task 4.1 cannot find an archived row's closing commit it returns to the live register as `unverified` with a note, rather than sitting demoted in a file the plan defines as holding `verified` and `withdrawn`.

## Next

1. **The drain executes from Phase 0** — the close phase opens because it needs no build, no suite and no ruling, and it exercises the register mechanics before 100+ rows depend on them; the ruling sessions follow, gated clusters first.
2. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — 22 rows close and each names which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
3. **The serialised browser follow-up still owes 31 of its 49 rows**, four of which (`vg-346`, `vg-347`, `vg-233`, `vg-370`) need a new case and are drain work rather than reproduction; they share the fixed preview ports, so two suites at once produce false results rather than slow ones.
4. **`vg-386` is a sweep of its own, not a fix inside the closed plan** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.
5. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan now records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

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

- **Active plan: [`2026-10-12-the-keyboard-only-walkthrough.md`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md)** — the redesign's last open instrument, since every other §13.1 clause is discharged: Task 1's harness and the §13.1 census amendment are committed and green at `48ada839`, `vg-362` closed on them, and **Tasks 2–5** (document and rail pane, Composition edit and cancel, groups and popups and palette, the assembled round trip) remain.
- **The drain is queued behind it by the user's ruling of 2026-10-12** — [`2026-10-12-the-backlog-drain.md`](docs/superpowers/plans/2026-10-12-the-backlog-drain.md) was named active while the walkthrough was parked on an unruled question; it is planned at eleven phases and 43 tasks from the closed spec, the reproduction pass is archived at `docs/superpowers/plans/archive/2026-10-12-the-backlog-reproduction-pass.md` with the dead-code sweep beside it, and **task numbers in that plan are stable identifiers, not positions**. Asked which order they wanted, the user chose to finish the redesign's last instrument first, so the drain resumes at its Phase 0 close list once the walkthrough closes.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Task 3 of the walkthrough is complete and reviewed** — `selectInComposition` and `editFieldThenCancel` at `0814d2cc`, spec compliance ✅ and task quality ✅; the reviewer re-derived three of the five red-proofs and drove two attacks of its own, one of which found a Medium.
- **The Medium is fixed, and it was the acceptance instrument going quietly vacuous** — the history counter attached to whatever canvas the bridge published and never checked again, so a listener outliving its canvas would read 0 forever and "no history entry was added" would pass having observed nothing; `editCommits` now throws when the watched canvas is no longer the published one, and the decoy that used to go green reddens with that message.
- **The file header no longer says the census is red** — it described the pre-ruling state while the test above it was green, which is the one text that could talk a future reader into trimming `REGIONS`.
- **Two more hardenings landed with it** — the field is matched inside the inspector only, and the identity chip's leg of `surroundingState` reads visibility before its text, so a hidden chip answers `null` instead of a string.
- **The spec is now 997 lines**, and the split is Task 4's opening step under Ruling L: the focus primitives and the shell vocabulary move to their own modules before Task 4 adds six helpers to them.

## Next

1. **The walkthrough's Tasks 2–5 first, then the drain's Phase 0** — the round trip is the redesign's acceptance instrument, and the close phase follows because it needs no build, no suite and no ruling and exercises the register mechanics before 100+ rows depend on them.
2. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — 22 rows close and each names which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
3. **The serialised browser follow-up still owes 31 of its 49 rows**, four of which (`vg-346`, `vg-347`, `vg-233`, `vg-370`) need a new case and are drain work rather than reproduction; they share the fixed preview ports, so two suites at once produce false results rather than slow ones.
4. **`vg-386` is a sweep of its own, not a fix inside the closed plan** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.
5. **`vg-368` is ruled and not yet executed** — the user chose on 2026-10-12 to relocate `src/web/.agent-scratch/` outside the tree, keeping its eight files, and the ruling is recorded on the row itself (`RULED 2026-10-12:` in its `detail`), which is where the drain reads it; the move is drain work, not walkthrough work.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan now records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **The four deterministic reds that held the acceptance item are green** — `vg-359`, `vg-360` and `vg-361` were stale gestures and locators, and the keyboard census was asserting §13.1 in the shell's opening state, which the user's 2026-10-12 ruling corrected to the state where a region has content. Only `vg-362` is closed in the register so far; its three siblings close inside the drain's Task 2.2, which owns `vg-359`'s regenerated capture and the spec's §8.12/§8.13 text corrections. What remain are the **deliberate** reds: `reference-theme.spec.ts`'s "known gaps, pinned" carries two `test.fail` cases, which keep the requirement written down rather than failing by accident. `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

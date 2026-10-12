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

- **Active plan: [`2026-10-12-the-keyboard-only-walkthrough.md`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md)** — the redesign's last open instrument, and **all five tasks are implemented**: Task 5's assembled nine-interaction walk, the §13.1 acceptance annotation and the `STATUS` rewrite landed at `c825ec75`/`4ce206f7` and reviewed ✅/✅, leaving one comment that states the opposite of its helper's contract plus one annotation claim wider than what was measured, in a fix round before the plan closes.
- **The drain is queued behind it by the user's ruling of 2026-10-12** — [`2026-10-12-the-backlog-drain.md`](docs/superpowers/plans/2026-10-12-the-backlog-drain.md) was named active while the walkthrough was parked on an unruled question; it is planned at eleven phases and 43 tasks from the closed spec, the reproduction pass is archived at `docs/superpowers/plans/archive/2026-10-12-the-backlog-reproduction-pass.md` with the dead-code sweep beside it, and **task numbers in that plan are stable identifiers, not positions**. Asked which order they wanted, the user chose to finish the redesign's last instrument first, so the drain resumes at its Phase 0 close list once the walkthrough closes.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Task 5 assembles the walkthrough, and §13.1's instrument exists** — `host-walkthrough.spec.ts` now carries the nine interactions in §13.1's own order as one continuous real-host walk, ending at the round trip, with both of §13.1's other invariants swept in the state the walk leaves.
- **The return trip is the library, and it is measured twice** — `openThemeFromLibrary` reaches `File → Open library` by keyboard and opens the `e2e-hosted` fixture the walk booted on; the identity chip names it and `serializedDocument` compares the whole persisted envelope with the opening read.
- **History is read before the return, not after** — the counter watches the published canvas and opening a theme remounts the shell, so a later read would observe nothing; the walk asserts 0 entries across all nine interactions.
- **Three red-proofs, each restored `cmp`-clean** — opening a different theme reddens the chip and, with the chip removed, the envelope comparison; a committed edit anywhere in the walk reddens the history leg at 1 against 0.
- **Assembly exposed one harness bound, not a shell defect** — the rail search spends 53 presses getting back to Composition, so `RAIL_BOUND` takes the census's whole-walk bound and the walk declares itself slow.

## Next

1. **Close the walkthrough, then start the drain's Phase 0** — a fix round on the acceptance instrument's one misleading comment, then a final review over the plan's own commits and the archive move; the close phase follows because it needs no build, no suite and no ruling and exercises the register mechanics before 100+ rows depend on them.
2. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — 22 rows close and each names which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
3. **The serialised browser follow-up still owes 31 of its 49 rows**, four of which (`vg-346`, `vg-347`, `vg-233`, `vg-370`) need a new case and are drain work rather than reproduction; they share the fixed preview ports, so two suites at once produce false results rather than slow ones.
4. **`vg-386` is a sweep of its own, not a fix inside the closed plan** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.
5. **`vg-368` is ruled and not yet executed** — the user chose on 2026-10-12 to relocate `src/web/.agent-scratch/` outside the tree, keeping its eight files, and the ruling is recorded on the row itself (`RULED 2026-10-12:` in its `detail`), which is where the drain reads it; the move is drain work, not walkthrough work.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan now records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **The four deterministic reds that held the acceptance item are green** — `vg-359`, `vg-360` and `vg-361` were stale gestures and locators, and the keyboard census was asserting §13.1 in the shell's opening state, which the user's 2026-10-12 ruling corrected to the state where a region has content. Only `vg-362` is closed in the register so far; its three siblings close inside the drain's Task 2.2, which owns `vg-359`'s regenerated capture and the spec's §8.12/§8.13 text corrections. What remain are the **deliberate** reds: `reference-theme.spec.ts`'s "known gaps, pinned" carries two `test.fail` cases, which keep the requirement written down rather than failing by accident. `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done — with four exceptions, the drain rulings of 2026-10-12, which are written on their own rows as `RULED 2026-10-12:` at `c76be14f`.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

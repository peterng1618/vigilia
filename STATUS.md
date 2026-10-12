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
- **The drain is queued behind it, not abandoned** — [`2026-10-12-the-backlog-drain.md`](docs/superpowers/plans/2026-10-12-the-backlog-drain.md) was named active while the walkthrough was parked on an unruled question; it is planned at eleven phases and 43 tasks from the closed spec, the reproduction pass is archived at `docs/superpowers/plans/archive/2026-10-12-the-backlog-reproduction-pass.md` with the dead-code sweep beside it, and **task numbers in that plan are stable identifiers, not positions**. The standing goal is the redesign, so the design instrument outranks the register sweep and the drain resumes at its Phase 0 close list when the walkthrough closes.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **The walkthrough's Task 2 landed** — `openDocumentByKeyboard` and `chooseRailPane` drive a document created from the starter and a rail pane chosen with no pointer, at `4ef0c94a`; the task's review is in flight, so its reported counts (4 tests, 4 passed, `desktop-host`, `--workers=1`, read from that run's own report) and its two red-proofs are reported rather than accepted.
- **`format:check` was red at HEAD and is green again** — the click line `8a86b2b0` wrote into `editor.spec.ts` was 96 columns and biome folds it; fixed at `a174c300`, 615 files clean, which is the gate CI runs before lint.
- **`vg-387` closes on that fix** — filed by the Task 2 implementer with a `Discovered, not fixed:` trailer and repaired by the controller in its own commit, because the row's stated blocker (a concurrent lane possibly holding the file) had ended when that lane committed.
- **The ruling Task 5 was waiting on** — "create or open" is **create from the starter**, since the pinned fixture carries no group and §13.1 requires entering one; so Task 5's "return to the original document" means returning to the `e2e-hosted` fixture the walk booted on.

## Next

1. **The walkthrough's Tasks 2–5 first, then the drain's Phase 0** — the round trip is the redesign's acceptance instrument, and the close phase follows because it needs no build, no suite and no ruling and exercises the register mechanics before 100+ rows depend on them.
2. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — 22 rows close and each names which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
3. **The serialised browser follow-up still owes 31 of its 49 rows**, four of which (`vg-346`, `vg-347`, `vg-233`, `vg-370`) need a new case and are drain work rather than reproduction; they share the fixed preview ports, so two suites at once produce false results rather than slow ones.
4. **`vg-386` is a sweep of its own, not a fix inside the closed plan** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.
5. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan now records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **The four deterministic reds that held the acceptance item are green** — `vg-359`, `vg-360` and `vg-361` were stale gestures and locators, and the keyboard census was asserting §13.1 in the shell's opening state, which the user's 2026-10-12 ruling corrected to the state where a region has content. Only `vg-362` is closed in the register so far; its three siblings close inside the drain's Task 2.2, which owns `vg-359`'s regenerated capture and the spec's §8.12/§8.13 text corrections. What remain are the **deliberate** reds: `reference-theme.spec.ts`'s "known gaps, pinned" carries two `test.fail` cases, which keep the requirement written down rather than failing by accident. `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

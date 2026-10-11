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

- **The active plan is [`2026-10-12-the-dead-code-sweep`](docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md)**, reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: Phase 1 redistributes the manager layer (Tasks 8–9, census running now), Phase 2 the reference picture (1–3), Phase 3 removal (4–6), Phase 4 the register (7); **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Its Phase 4 is the manager review the user asked for twice, now `vg-364`**: each manager's *role* is reviewed — whether one grown too big owns a concept deserving an independent manager, and whether a concept is spread across several — where the size signal is what found it, not what fixes it: 32 non-test files at or past 500 lines against 12 past the 800 stop, and `snap-manager` at 5,978 lines in five files, four of them over.
- **Nothing in Phase 4 is dead code, so its acceptance inverts**: all 20 managers have production references, and the phase is judged by what moved without moving anything else — splitting a file until both halves fit the number while both go on owning the same concept is the one forbidden move.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product, so no candidate goes on one detection signal.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).
- **Neither ownerless question is settled by an agent**: a module with no production mount but a real test may be abandoned or built ahead of the surface that will mount it, and `vg-362` asks whether §13.1 means the shell's opening state or the state where a region has content.

## Last completed change

- **Both Task 1 loops closed and verified by fresh reviewers, neither implementer self-approved.** The sweep's scanner at `93c4f704` (self-test 18, tier split measured across all 293 rows) and the walkthrough's census at `3852d275`; both re-reviews reproduced rather than trusted — the scanner's two guards sabotaged and restored `cmp`-clean, and the walkthrough's focus claim driven in a browser.
- **The tier disagreement was adjudicated from the code, not averaged:** a type named only in a sibling export's signature in the same file is **live**, so 14 dead / 279 redundant is right and the review's 33 / 260 was a metric artefact — its rule counted zero because the use sits on the same line as another `export`.
- **The user ruled §13.1 on 2026-10-12**: "each region has a reachable focus target" means a region **with content**, so the empty inspector legitimately contributes no tab stop and **no product code changes** — the census takes two walks and its assertion moves rather than shrinks.
- **`vg-358` closed `verified` from a measurement the user ordered**: the palette editor cannot produce an unresolved reference — deleting a referenced token reassigns it first, driven in the browser 4/4 — so the §13.1 item for it is discharged because the state cannot arise, and a hand-edited theme holding one is refused at load rather than opening without a reason.
- **The sweep's bias is now a plan constraint, in the user's words:** *"I want a clean codebase but be careful to not overdo it and break the app"* — a survivor costs a ticket, a live symbol deleted costs the product.

## Next

1. **Sweep Task 1's fix round 2** — the redundant tier's occurrence count says 2 for `instantiateCard`'s one call site, on 279 rows a Phase 2 agent will read; then Phase 1's candidate report at HEAD, and nothing is deleted until Phase 2 verifies each candidate against the string-resolved vocabulary and the gate inputs.
2. **The walkthrough's amended Task 1** — its census now takes two walks because the user ruled on 2026-10-12 that §13.1 means a region *with content*, so the inspector's tab stops are counted after a keyboard selection; `REGIONS` stays four.
3. **Task 9, the redistribution**, consumes the census now running: one manager per commit, the move relocates the *decision* rather than the code, and the map is updated in the same commit as the move.
4. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.
5. **`vg-362` closes only when the amended census passes** — the ruling settles the question it asked, but its second branch is *the census is rewritten*, and the row now says so rather than re-asking a question the user has answered.

## Blockers / unverified

- **Acceptance item 3 now keeps the objective open on one thing: the census amendment.** Both rulings landed on 2026-10-12 — §13.1 means a region with content, and `vg-358`'s unresolved reference is unreachable through the palette editor, so that §13.1 item is discharged because the state cannot arise rather than because a surface was built for it.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

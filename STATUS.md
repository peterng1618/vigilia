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

- **The active plan is [`2026-10-12-the-dead-code-sweep`](docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md)**, four phases: the reference picture (Tasks 1–3), verified removal by owner (4–6), the register discharge (7), and the manager layer (8–9); Task 1's scanner is complete at `d4c820b2` with its fix round running.
- **Its Phase 4 is the manager review the user asked for twice, now `vg-364`**: each manager's *role* is reviewed — whether one grown too big owns a concept deserving an independent manager, and whether a concept is spread across several — where the size signal is what found it, not what fixes it: 32 non-test files at or past 500 lines against 12 past the 800 stop, and `snap-manager` at 5,978 lines in five files, four of them over.
- **Nothing in Phase 4 is dead code, so its acceptance inverts**: all 20 managers have production references, and the phase is judged by what moved without moving anything else — splitting a file until both halves fit the number while both go on owning the same concept is the one forbidden move.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product, so no candidate goes on one detection signal.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).
- **Neither ownerless question is settled by an agent**: a module with no production mount but a real test may be abandoned or built ahead of the surface that will mount it, and `vg-362` asks whether §13.1 means the shell's opening state or the state where a region has content.

## Last completed change

- **The walkthrough's Task 1 landed at `4863a059`**: 30 Tab presses on the pinned fixture, and rail, pane and stage are reachable and named while **the inspector is never reachable** — with nothing selected it renders only "Select an object to inspect it." and nothing focusable.
- **`REGIONS` stayed at four and the test is committed red on purpose**, because weakening the region list to go green was named in advance as the forbidden move; `vg-362` reframes the finding as a rule question rather than a dead region, and both halves of the assertion carry a red-proof.
- **`vg-363` was filed from the same run**: a bare `/editor/` mount resumes whichever theme won a millisecond mtime tie, and two runs opened different documents — 18 presses against 26.
- **`.superpowers/` was untracked at the user's instruction** — tracked 20 to 0 with all 744 files left on disk, and a root ignore rule added because the ignore that was doing the work was itself untracked and would not exist in a fresh clone.
- **The sweep's scanner landed at `d4c820b2`** — `scripts/dead-code-sweep.mjs`, self-test 15/15, proven in both directions including the negative case, nothing deleted, and its own false-positive surface printed rather than hidden; **`vg-364` was filed in the same stretch**, after the user asked twice and nothing had tracked the manager review.

## Next

1. **Sweep Task 1's scanner report**, then Phase 1's candidate report at HEAD; nothing is deleted until Phase 2 verifies each candidate against the string-resolved vocabulary and the gate inputs.
2. **The walkthrough Task 1 review**, running now, then **`vg-362`'s ruling** — it decides whether the walkthrough's Tasks 2–5 are writable as specified, so they stay undispatchable until it lands.
3. **Sweep Phase 4 Task 8, the manager census**: what each of the 20 managers *decides* against what `ownership.md` says it *owns*, ranked by blast radius, folding in the register's `vg-232`–`vg-248` rather than re-finding them.
4. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.
5. **`vg-358`** — an unresolved palette reference takes the inspector column down though the product renders that state and carries its copy; whether the state is reachable at all is the decision it waits on.

## Blockers / unverified

- **Acceptance item 3 now keeps the objective open on its walkthrough half alone, and that half is blocked twice over**: the stress half ran on 2026-10-12 with every §13.1 item met, but one item — the long unresolved reference — is discharged at DOM level rather than in a browser because the state is unreachable there (`vg-358`), and the keyboard-only walkthrough's own premise is now false as written (`vg-362`).
- **Four specs are red on `develop` and each is named rather than left a mystery**: the deliberate walkthrough red at `4863a059`, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 could check neither and recorded both.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

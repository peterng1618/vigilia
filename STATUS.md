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

- **The active plan is [`2026-10-12-the-dead-code-sweep`](docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md)**, reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: Phase 1 redistributes the manager layer (Tasks 8–9), Phase 2 the reference picture (1–3), Phase 3 removal (4–6), Phase 4 the register (7); **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1's census is committed and under independent review** — [`docs/architecture/manager-census.md`](docs/architecture/manager-census.md), landed at `a2fe5a89`, ranks ten candidates by blast radius and marks each clean extraction or cross-cutting; the review is checking its own load-bearing number rather than its prose.
- **Task 9 consumes those ranks in the census's order**: ranks 4, 5, 6 and 9 are clean extractions and go first, while 1, 2, 3 and 7 wait on decisions nobody has made — reach is the reason to be careful, not the reason to be first.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **The plan and register were corrected against the census review** — `3a92e367`: the plan's Step 4 carried the false "11 production modules" while another paragraph of the same file corrected it, so Task 9 read a self-contradicting plan.
- **The census was right and its Task 8 brief was wrong** — `snap-manager` is reached by exactly one production module (`editor-session.ts`); the "11" is a *fork's* feature-scope count from `2026-09-25-snapping-fidelity.md` restated as importers, and `snap-manager/` also holds eleven test files, a second way to land on the same wrong number.
- **Task 9 now orders by the census's clean/cross-cutting labels, not its rank numbers** — §6 claims to be ranked by reach while its own Reach column reads 9, 4, 6, 3, 1, 2, 2, 7, 1, 0, so rank 8 holds the second-highest reach; ordering by rank would reproduce the mistake the rule exists to prevent.
- **Two numbers that were not the same measurement are gone** — a line total of 10,671 where the census says 10,701 (a trailing newline counted as a line) and a denominator that reproduces under no scope root tried; the phase now cites the file counts that do reproduce, 32 at or past 500 and 12 past 800.
- **One review claim did not survive being checked** — it said a bad denominator had propagated into `vg-364`, and no register row ever held it; checked in node over all 220 rows, not by grep.

## Next

1. **Two fix rounds are running**: Task 1's round-4 re-review, attacking the scanner's completion window by inducing the defect rather than reading for it, and Task 8's census fix round on findings F3–F9.
2. **Task 9, the redistribution, once both close** — one manager per commit, the move relocates the *decision* rather than the code, it orders by the census's shape labels, and the map is updated in the same commit as the move.
3. **`vg-234` waits on the census fix round** — the review found the census applying directory-level ownership as sufficient for `renderer-core/src/theme/` and insufficient for `selection-inspector/`, so its verdict is not settled until that inconsistency is resolved.
4. **Phase 2's candidate report at HEAD, then per-candidate verification** — nothing is deleted until each candidate is checked against the string-resolved vocabulary: the `data-vigilia-*` attributes, the `--shell-*` custom properties, the `KIND_*` registries and the four gate scripts that read the source tree as data.
5. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.

## Blockers / unverified

- **Acceptance item 3 now keeps the objective open on one thing: the census amendment.** Both of the user's 2026-10-12 rulings landed — §13.1 means a region with content, and `vg-358`'s unresolved reference is unreachable through the palette editor, so that item is discharged because the state cannot arise rather than because a surface was built for it.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

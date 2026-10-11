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

- **`vg-234` came back CONFIRMED rather than contradicted** — `7ed8950f`: the census's fix round applied one standard in both places, and a registry row that names a *directory* does not name a *module*, so the row's complaint stands and my earlier "partly contradicted" verdict is replaced.
- **The census's own bad denominator had a real cause: `src/web/.agent-scratch/`** — a gitignored, untracked directory of residue from earlier tasks, which `.gitignore` hides from git and from nothing else, so a filesystem walk counted eight files no git-based check can.
- **`vg-368` filed for it rather than fixed** — the scanner is unaffected (its walk skips dot-prefixed entries and the directory sits outside all four of its roots, checked not assumed, so no row of the 311 is phantom), and deleting the directory is not obviously safe.
- **The census's F3 was a false correction to a document of record** — it claimed `ownership.md`'s count of inline `prefix + randomUUID` sites was one too high; the code has **seven**, the missed one being `selection-inspector/run-edits.ts:176`.
- **Task 1's round-4 re-review returned "fix sound"** — it induced the defect's absence across a six-point throw matrix rather than reading for it, and all five red-proofs fail the gate by name at md5 `be09fee1c4577e5244bf46a8966c8845`.

## Next

1. **Two reviews are running**: Task 1's round-5 fix — the candidate report's crash marker still lets `!doc.candidates` read a crashed scan as a clean sweep, on the artefact Phase 2 reads — and Task 8's census fix re-review.
2. **Task 9, the redistribution, once both close** — one manager per commit, the move relocates the *decision* rather than the code, it orders by the census's shape labels, and the map is updated in the same commit as the move.
3. **Phase 2's candidate report at HEAD, then per-candidate verification** — nothing is deleted until each candidate is checked against the string-resolved vocabulary: the `data-vigilia-*` attributes, the `--shell-*` custom properties, the `KIND_*` registries and the four gate scripts that read the source tree as data.
4. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.
5. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.

## Blockers / unverified

- **Acceptance item 3 now keeps the objective open on one thing: the census amendment.** Both of the user's 2026-10-12 rulings landed — §13.1 means a region with content, and `vg-358`'s unresolved reference is unreachable through the palette editor, so that item is discharged because the state cannot arise rather than because a surface was built for it.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

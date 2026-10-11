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

- **The active plan is [`2026-10-12-the-dead-code-sweep`](docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md)**, reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: Phase 1 redistributes the manager layer (Task 8 closed; Task 9's ranks 4, 5 and 9 done, rank 6 left), Phase 2 the reference picture (1–3), Phase 3 removal (4–6), Phase 4 the register (7); **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1's census is closed** — [`docs/architecture/manager-census.md`](docs/architecture/manager-census.md) landed at `a2fe5a89` and closed at `32265c25`: ten candidates ranked by shape, three fix rounds that moved no verdict, and a re-review that reproduced every count independently rather than reading the diff.
- **Task 9 consumes those ranks in the census's order**: ranks 4, 5, 6 and 9 are clean extractions and go first, while 1, 2, 3 and 7 wait on decisions nobody has made — reach is the reason to be careful, not the reason to be first.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **Task 9's rank 9 landed and passed both verdicts** — `6309f899` turns six inline lock expressions in `object-actions.ts` into two named predicates, one per condition, with `ownership.md` correctly left alone because no owner moved.
- **The implementer contradicted the census and was right** — `lockObject`/`unlockObject` guard only a null object and never read the lock state, so two of the six sites are affordances rather than re-encoded refusals, and migrating them would have widened eligibility the way `vg-370` did.
- **No behaviour delta, and the reviewer proved it its own way rather than reading the enumeration** — a per-site pairing of all twelve registry entries base↔head, then a whole-domain check over 64 targets, zero diffs each.
- **`vg-365` stays open, retitled, with its own two false claims recorded in it** — the dedup removed the hand-synchronisation inside the file, not the cross-module half where eligibility still states two managers' refusal.
- **Two prose nits left unfixed because they are in a commit body** — "character for character" is false (the parameter is renamed `t` → `target`) and "the seven suites" over-counts by `icons.test.tsx`, which names the file rather than importing it.

## Next

1. **Task 9's last candidate goes out next — rank 6, `controls-manager`'s document writes** — and its hedge is already surveyed: the writes are Fabric `Control` action handlers, so the move either delegates to an existing geometry owner or the candidate dissolves.
2. **Rank 6 must not invent a destination to give the census somewhere to point** — the census calls it `Clean-ish` precisely because it names no owner for the Line scalars; a reported "the mutation is the mechanism" is a better outcome than a new module built to satisfy a label.
3. **Phase 2's candidate report at HEAD, then per-candidate verification** — nothing is deleted until each candidate is checked against the string-resolved vocabulary: the `data-vigilia-*` attributes, the `--shell-*` custom properties, the `KIND_*` registries and the four gate scripts that read the source tree as data.
4. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.
5. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

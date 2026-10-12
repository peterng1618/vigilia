# Vigilia status

Updated: 2026-10-12
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–8 are closed and the keyboard-only walkthrough plan closed today, so
every instrument the redesign asked for exists. **The spec's Acceptance section
was counted on 2026-10-12 rather than reviewed: fifteen of its sixteen items have
a check that runs and passes, and the sixteenth does not** — see *Next*. The target is
[`DESIGN.md`](DESIGN.md), the contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
the checked drawing is [`docs/design/mockups/`](docs/design/mockups/), and the boundary that
makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

**The drawing is the acceptance instrument, by the user's ruling of 2026-10-10:** the
mockup is not replaced and the shipped surface is pulled to it. The measure of done is the
spec's Acceptance section, counted rather than reviewed — and it is not met while a surface
satisfies every token in `DESIGN.md` and still does not look like the mockup. **That
section now states where each item stands**, which until today only plan 6's archived
ledger did.

## Active work

- **Active plan: [`2026-10-12-the-backlog-drain.md`](docs/superpowers/plans/2026-10-12-the-backlog-drain.md)** — named active now that the walkthrough's instrument is closed, which was the user's sequence of 2026-10-12 (*"Finish the walkthrough first"*); it runs to eleven phases and 43 tasks from the closed spec, **task numbers in it are stable identifiers, not positions**, and its Phase 0 needs no build, no suite and no ruling, so it starts immediately.
- **The drain's first four rulings are already taken and recorded** — the user settled D1 (biome check becomes the gate), D5 (tests join the gated list), D4 (`vg-291` dissolves into `vg-292`) and D11 (`src/web/.agent-scratch/` relocates outside the tree) on 2026-10-12, and each sits on its own row as `RULED 2026-10-12:` in the row's `detail`, which is where the drain reads it. The remaining 100 arrive in the plan's four ruling sessions.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **The redesign's last instrument is closed and archived** — `2026-10-12-the-keyboard-only-walkthrough.md` moved to `docs/superpowers/plans/archive/`; it built §13.1's acceptance instrument, three task reviews and four scoped re-reviews found no vacuous assertion left in it, and the spec's §13.1 clause is annotated met at `472ca4c5`.
- **Fifteen of sixteen acceptance items were counted, and the spec now says so** — the verdicts for most of them lived only in plan 6's archived ledger; the spec's Acceptance section carries them directly now, each with the check that carries it, which is §13.1's own rule.
- **The sixteenth is named rather than assumed** — the parity-capture item is **NOT MET**: plan 8's own report rules its second clause unmet and six differences sit in open rows (`vg-316`, `vg-319`, `vg-322`, `vg-325`, `vg-274`), while plans 1 and 3 have no capture beside their drawings and no surviving workspace to compare.
- **`vg-390` is filed for the half that needs a decision** — for plans 1 and 3 the item asks for a comparison the repo can no longer make, so it needs the wording narrowed or the comparison reproduced; taking the `met` verdict on the capture half alone is the defect the row records.
- **Two residual comment defects in the instrument are fixed, after the review that found them** — a budget comment compared the whole file's 67.8 s against four walk durations (the walk's own clean figure is 63.2 s), and `REGIONS`' docblock still called its four "the ones §13.1's interactions move through" when the interactions also act in the header.

## Next

1. **The drain's Phase 0 first** — its close list of 22 rows, each naming which of §3.1's four shapes it is, plus the archive and register mechanics, exercising them before 100+ rows depend on them.
2. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
3. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — 22 rows close and each names which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
4. **The serialised browser follow-up still owes 31 of its 49 rows**, four of which (`vg-346`, `vg-347`, `vg-233`, `vg-370`) need a new case and are drain work rather than reproduction; they share the fixed preview ports, so two suites at once produce false results rather than slow ones.
5. **`vg-386` is a sweep of its own** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.

## Blockers / unverified

- **Two acceptance decisions are the user's, not a controller's** — which width the settings frame takes (`vg-322`: the drawn 560px, a width per panel, or a stale drawing) and which role a palette preview ground bar depicts; and a third, `vg-390`'s, whether the parity item is narrowed to the plans whose reports survive. Rulings go on the row's own `detail`, never only in a ledger.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **The four deterministic reds that held the acceptance item are green** — `vg-359`, `vg-360` and `vg-361` were stale gestures and locators, and the keyboard census was asserting §13.1 in the shell's opening state, which the user's 2026-10-12 ruling corrected to the state where a region has content; they close inside the drain's Task 2.2. What remain are the **deliberate** reds: `reference-theme.spec.ts` carries two `test.fail` cases keeping a requirement written down, `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. On this box a shared host on port 4175 is adopted by `reuseExistingServer` and can die mid-run, which is contention rather than a defect.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

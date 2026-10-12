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

- **Active plan:** `docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md` — reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: all four phases and all nine tasks are closed, each with both verdicts passed and no removal falsified, and the plan-boundary whole-branch review is **adjudicated** — two load-bearing findings, both dispositions in tracked documents, and the plan's two acceptance claims now name their exceptions rather than asserting them clean; **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **The plan-boundary whole-branch review returned two load-bearing findings and no third** — dispatched read-only on the most capable model over **this plan's own removal and move commits rather than a `BASE..HEAD` range**, because two other plans interleave on `develop`; all eight npm gates green at `93fa9a5a`, its own Vitest report 246 files and 3287 tests with zero failures, and the scanner reproducing 596 files and 107 candidates with its self-test 22/22.
- **Its first finding is in the sweep's own instrument, and it is filed as `vg-386`** — `scripts/dead-code-sweep.mjs:705` runs before the `barrel-only-export` branch at `:708`, and the file's own package barrel counts as a production consumer, so the tier cannot fire for any input and **133 candidate rows were never reported**; an unexercised kind might fire tomorrow, this one cannot fire at all.
- **Reproduced rather than taken on the seat's word** — a copy of the scanner outside the tree with the one filter corrected reports **240 candidates** at `93fa9a5a`, 133 of them `barrel-only-export`, with the other four kinds at exactly their HEAD counts, so the 133 are additions and nothing reclassifies; **76** are the plan's literal sole-importer shape and **57** name test importers, which is why the tier's definition is a decision rather than a fix.
- **The report's zero was a detector limit reading as a measurement, and it is corrected** — `dead-code-candidates.md` now says so in §1.1, §1.3 and a new §3.4, the plan's Step 2 bullet records that the kind it requires was never implemented, and nothing the sweep removed was reported by that tier, so the removals stand and only the picture changes.
- **Phase 1's unconditional acceptance now names its exception at all three sites** — the `dd7c3365` delta is ruling AJ's pre-existing `value < 1` floor reached on a new path rather than a second mechanism, the seat reproduced it against a real Fabric `Textbox`, and the plan states it with the real-gesture reachability marked unverified instead of claiming nothing changed.

## Next

1. **The backlog drain is third in the user's sequence and is the queued next plan** — [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md) re-derives its batches from the register at run time, and the first step is a reproduction pass rather than a fix pass; the closed plan's workspace is deleted and the plan archived to `docs/superpowers/plans/archive/` as its last act.
2. **`vg-386` is a sweep of its own, not a fix inside the closed plan** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated, so the filter, the re-run and whatever removals follow belong to a successor plan; **none of the 133 is proven dead and none may be deleted on classification alone**.
3. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.
4. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.
5. **`vg-383` is a flake with a named mechanism and no owner yet** — the run-format preview is asserted against a clock read after the render, so the suite reads red about once in sixty runs and the failure lands on whichever commit is nearby.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan now records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

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

- **No plan is active, and the reproduction pass is closed and archived** at `docs/superpowers/plans/archive/2026-10-12-the-backlog-reproduction-pass.md` — third in the user's sequence (**managers, then dead code, then the register**), it ran to completion and its spec is committed; the next plan is the drain, written from that spec. The dead-code sweep is archived beside it with its two deviations named in the file itself, and **task numbers in that plan are stable identifiers, not positions**.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **One plan is queued and one is not yet written**: [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md) is queued, and the **drain** has no plan file yet — it is written from the closed spec, whose 237 verdicts are its scope.

## Last completed change

- **The drain spec is reviewed, fixed and closed** — [`2026-10-12-the-backlog-drain-design.md`](docs/superpowers/specs/2026-10-12-the-backlog-drain-design.md) sorts all **237** rows into **22 closes**, **104 decisions** in eleven ruling clusters, **109 work** rows in nine candidates and **2 parked**, and the review re-measured every one of those counts itself.
- **The review's two load-bearing findings were reproduced by the controller, not relayed** — 6 of List A's 21 checks failed the register's own `wordsOf` tokeniser (15 pass / 6 fail), and "eleven clusters means eleven questions" is false for D1, D3 and D11; the fix round reworded the six checks (re-verified 6/6) and the claim is now stated as false in the spec.
- **`vg-309` moves from `work` to `closes` on a run** — the second slice shows `design-language.spec.ts:3160` already reads **every** custom-property declaration site with a positive control, so the parity reader is two rules and not three and the gate class is **fifteen rules over thirteen rows**.
- **The browser follow-up ran 18 of its 49 rows in two serialised slices** — twelve of slice 2's fourteen claims hold, and a green run cannot carry a "no gate reads X" row, which is why the 31 unrun rows stay deferred rather than resolved.
- **Closing has a price the spec names** — 14 of the 22 closes carry no sha, so the drain finds one at close time or the close is not a close; `vg-196` closes on a deletion and leaves a possible repaint-coverage hole to file afresh rather than read out of a deleted subject.

## Next

1. **The drain is planned from the closed spec** — that plan is the next one, with W1–W9 as its candidates and D1–D11's rulings taken as the drain runs; nothing else may be active beside it.
2. **The drain's rule is that a row whose defect does not reproduce is a finding about the row, not a licence to close it** — 22 rows close and each names which of the two kinds of close it is.
3. **The serialised browser follow-up still owes 31 of its 49 rows**, four of which (`vg-346`, `vg-347`, `vg-233`, `vg-370`) need a new case and are drain work rather than reproduction; they share the fixed preview ports, so two suites at once produce false results rather than slow ones.
4. **`vg-386` is a sweep of its own, not a fix inside the closed plan** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.
5. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan now records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

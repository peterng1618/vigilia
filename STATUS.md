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

- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); named active now that the walkthrough's instrument is closed, which was the user's sequence of 2026-10-12 (*"Finish the walkthrough first"*); it runs to eleven phases and 43 tasks, **task numbers in it are stable identifiers, not positions**, and **Phase 0 has closed while Phase 1 has not** — Phase 0's 22 rows are archived and proved, and Phase 1's mechanism and four-session agenda are built but its ruling sessions (Tasks 1.2–1.5) are the user's and unrun.
- **The active phase is Phase 4, W3: the repo's own gates and scanners** — Phase 3 was **skipped, not abandoned**: D8's nine rulings were unanswered and the plan's rule is that a work phase whose gating cluster is unanswered stays queued, and **D8 is now answered in full**, so W2 opens when Task 4.2's review loop closes and Phase 4 resumes at 4.3. Phase 4's gate, D1, **is** answered (biome check becomes the gate); its demand is that each gate owner reads what its rows claim, that a checker reports a **set** and never a count, and that a gate whose self-test is not chained into `gates:self-test` does not count as built.
- **The drain's rulings are taken in batches of four and recorded on the rows themselves** — **25 rows carry a `RULED 2026-10-12` marker, 13 of them from this sitting**: all nine of D8, plus `vg-282`, `vg-386` and `vg-041`+`vg-188` (one question filed twice, both marked); earlier in the day the user settled D1, D5, D4 and D11. The agenda classifies all 104, and the remaining ask rows go in batches — a ruling lands in the row's own `detail`, never only in a ledger.
- **The register's two false equalities are rewritten** — `vg-233`'s `check` and `vg-393`'s `detail` had called the pre-fix landing "the request times `scaleX`", which is 0.78 units off; what is exact is on the box, and both rows now say so; the archive half is read by the gate Task 4.1 landed, at the cost of `vg-404` — that gate is state-blind across the two files.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Task 4.1 lands the register's own gate: `scripts/backlog-check.mjs` reads both files and an archive finding is an error** — the CLI's set is `[FILE, ARCHIVE].map(readRegister)`, every problem names the register it came from, and it prints `404 items across both registers, all valid`.
- **The wider read found 14 problems, and all 14 were repaired in the same commit** so no commit lands a permanently red `backlog:check` — the string-shaped `artefacts` rows `vg-199` counted, `vg-329`'s artefact-less `verified` rows, and the stale claims the register still made about itself; the review reproduced the set row for row.
- **The self-test guards the set rather than the count** — `check()` never knew the set, so no rule inside it can see the set narrowed back to the live file; three cases name both registers in order, a labelled `unreadable`, and a labelled `empty`.
- **Fix round 2 closed the one false green a scoped re-review found** — the two read cases called `registerRows` directly, so `readRegister`'s `catch` was gated by no test; `:271` now reads a real absent path, and the controller red-proved it by neutering the `catch` in a correctly-named copy (uncaught `ENOENT`, exit 1).
- **`vg-404` is filed, not fixed** — the checker is state-blind across the two files, so an `open` row in the archive reads clean; a per-register state allowance is a new rule, not the archive read under the live file's rules this task owed.

## Next

1. **The drain's four ruling sessions are the user's to answer, and Phase 2 runs beside them** — the agenda classifies all 104 decision rows (**12 answered, 8 deferred to the browser follow-up, 84 to ask**); Session 1's eight questions across D1 and D2 are put in chat and unanswered, so the next artifact from them is rulings, not a dispatch.
2. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
3. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — Phase 0's 22 closed rows each name which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
4. **Task 4.2 is next, and it is `design-tokens.mjs`'s two rules** — `vg-327`'s violation set rather than its count, an exemption keyed on the site as well as the text so a new site cannot inherit an old exemption, plus `vg-332` and `vg-340`; each rule needs a self-test case that fails when the rule is disabled.
5. **`vg-386` is a sweep of its own** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.

## Blockers / unverified

- **What waits on the user** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item) and **the rest of the four ruling sessions**, which are now being answered in batches rather than waiting on a session nobody has held — Session 1's remaining six and Session 2's twenty-five are the next two batches, since D1 and D2 gate the phase that is running.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — `reference-theme.spec.ts` carries two `test.fail` cases keeping a requirement written down, `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. A shared host on port 4175 adopted by `reuseExistingServer` can die mid-run, but **do not reach for contention to explain a red at the default worker count** — `vg-285` reproduced four of them on an idle box and bisected them to a load threshold.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

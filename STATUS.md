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
- **The active phase is Phase 4, W3: the repo's own gates and scanners** — Phase 3 was **skipped, not started**: it is blocked on D8's rulings, which are Session 3 of the user's four unrun ruling sessions, and the plan's own rule is that a work phase whose gating cluster is unanswered stays queued. Phase 4's gate, D1, **is** answered (biome check becomes the gate), so it opens; its demand is that each of the three gate owners reads what its rows claim, that a checker reports a **set** and never a count, and that a gate whose self-test is not chained into `gates:self-test` does not count as built.
- **The drain's first four rulings are already taken and recorded** — the user settled D1 (biome check becomes the gate), D5 (tests join the gated list), D4 (`vg-291` dissolves into `vg-292`) and D11 (`src/web/.agent-scratch/` relocates outside the tree) on 2026-10-12, and each sits on its own row as `RULED 2026-10-12:` in the row's `detail`, which is where the drain reads it. The agenda classifies all 104: **12 answered, 8 deferred to the browser follow-up, 84 to ask** across four sessions.
- **The register's two false equalities are rewritten** — `vg-233`'s `check` and `vg-393`'s `detail` had called the pre-fix landing "the request times `scaleX`", which is 0.78 units off; what is exact is on the box, and both rows now say so; the archive half of the register is still read by nothing that runs, which Task 4.1 owns.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Task 2.5 closes Phase 2: `vg-341` is `verified` and eight rows take their reading** — all seven shell captures re-shot from the built bundle, seven of seven byte-changed and inspected, §8.5's split re-derived as six at `7efea17f` and one at `f069e56c`, and the eight readings written on their own lines with no `RULED` sentence and each row left `open`.
- **The phase's rule held under pressure** — the review failed the task on `vg-306` stating a verdict ("the drawing is the side that is off it") on the question its own row reserves for a ruling; the fix keeps the measurement and declines the verdict, and the live marker set is still 12.
- **`vg-270` is the one reading that did not reproduce** — the 205px overflow is gone, `min-w-0` having landed in `control-well.tsx`'s column shape at `0e7b3405`; the row says so, stays `open`, and marks the causal half as ancestry rather than a red proof.
- **Two rows were filed out of the readings' scope** — `vg-402` owns the captures beside the drawings that nothing in the repo re-shoots (byte-identity shown for the graphite file, ancestry only for the settings pair), and `vg-403` owns the eleven rows citing the deleted `design-language.md`, five of them live.
- **`vg-306`'s citations now point at files that exist** — it had cited the deleted bible by line and called it current; the §5 bound is `DESIGN.md:411` under the marker at `:398`.

## Next

1. **The drain's four ruling sessions are the user's to answer, and Phase 2 runs beside them** — the agenda classifies all 104 decision rows (**12 answered, 8 deferred to the browser follow-up, 84 to ask**); Session 1's eight questions across D1 and D2 are put in chat and unanswered, so the next artifact from them is rulings, not a dispatch.
2. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
3. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — Phase 0's 22 closed rows each name which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
4. **Task 4.1 is next, and it is the register's own gate** — `scripts/backlog-check.mjs` must read `backlog-archive.jsonl` under the live file's rules **as an error**, and the 14 problems that read finds are repaired in the same commit so no commit lands a permanently red `backlog:check`; a row whose closing commit cannot be found returns to the live file as `unverified`, because the archive holds `verified` and `withdrawn` and nothing else.
5. **`vg-386` is a sweep of its own** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.

## Blockers / unverified

- **What waits on the user, and the drain is running around it** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item) and **Phase 3, which is skipped rather than started**: W2's Task 3.1 consumes D8's nine rulings, all `ASK`, so the ownership map cannot be derived until Session 3 is held — the phase table's silence about a W2 gate is the defect, not permission. Rulings go on the row's own `detail`, never only in a ledger.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — `reference-theme.spec.ts` carries two `test.fail` cases keeping a requirement written down, `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. A shared host on port 4175 adopted by `reuseExistingServer` can die mid-run, but **do not reach for contention to explain a red at the default worker count** — `vg-285` reproduced four of them on an idle box and bisected them to a load threshold.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

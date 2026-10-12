# Vigilia status

Updated: 2026-10-13
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
- **Phase 4 is the active phase, and its three gate tasks are built** — `scripts/backlog-check.mjs` reads both registers, `scripts/design-tokens.mjs` reports a set and keys an exemption on its site, and `npm run gate` is what CI runs; **Task 4.4 closes the phase's register rows** against those gates. Phase 3, W2, was **skipped, not abandoned** while D8's nine rulings were unanswered; it is closed now, having filed the map's census rows, deleted its one self-contradicting sentence and closed eight register rows, leaving `vg-234` and `vg-245` open against the halves a map row cannot discharge. D1's demand stands: a checker reports a **set** and never a count, and a gate whose self-test is not chained into `gates:self-test` does not count as built.
- **The drain's rulings are taken in batches and recorded on the rows themselves** — **70 live rows carry a `RULED <date>` marker**, and the row's own `detail` is where a ruling exists: one written only into a ledger is invisible to the next session, and the marker is how it is found again. The agenda classifies all 104 decision rows, and the remaining ask rows go in batches.
- **The register's two false equalities are rewritten** — `vg-233`'s `check` and `vg-393`'s `detail` had called the pre-fix landing "the request times `scaleX`", which is 0.78 units off; what is exact is on the box, and both rows now say so; the archive half is read by the gate Task 4.1 landed, at the cost of `vg-404` — that gate is state-blind across the two files.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Task 4.3 wires D1's gate, so `npm run gate` is `biome check .. && gates:self-test && test` and CI's `Format check` and `Lint` steps are one `Gate` step that runs it** — the 63 `organizeImports` and format errors across 618 files are fixed in that commit (`8477e70a`) with zero hand fixes and no rule suppressed, and `format:check` and `lint` remain as developer commands rather than as what green means.
- **All ten `scripts/*.mjs` self-tests are chained in `gates:self-test`** — `dead-code-sweep`, `ownership-enforcement` and `sdd-checkpoint`'s `--self-check` are the three that were missing, and the unit suite joined the chain, which is `vg-379` and `vg-323` together.
- **CI triggers on `develop` and runs nightly** — `vg-385`'s four licence names (`class-variance-authority`, `clsx`, `tailwind-merge`, `@playwright/mcp`) are in `THIRD-PARTY-NOTICES.md`, each established from its own installed metadata, and `vg-282`'s two Playwright suites run on `workflow_dispatch` and the 03:00 schedule, never per push.
- **The review passed both verdicts with no defect in the delivered change** — its two Lows are recorded deviations, not repairs: the standalone `npx vitest run` CI step went because `npm run gate` runs the suite once, and bare `npx biome check ..` exits 1 in this environment as an npx resolution quirk while the local binary exits 0.
- **`vg-407` was filed from the commit's own `Discovered, not fixed:` trailer** — `docs/engineering/dependencies.md` names 21 of the 27 dependencies the manifests declare, and the six missing names are the row; the register is at 407 items, all valid.

## Next

1. **The drain's four ruling sessions are the user's to answer, and Phase 2 runs beside them** — the agenda classifies all 104 decision rows (eight of them deferred to the browser follow-up, and the rest going in batches — the tally moves as they land, so none is kept here); Session 1's eight questions across D1 and D2 are put in chat and unanswered, so the next artifact from them is rulings, not a dispatch.
2. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
3. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — Phase 0's 22 closed rows each name which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
4. **Task 4.4 closes Phase 4 — ten rows, not the nine the phase names** — each `check` names its scanner and its rule and was proved against `scripts/backlog-check.mjs` before the dispatch; `vg-282` joins the nine because Task 4.3 discharged it and no task owned its close, and Step 4 requires the report to name the seven stray gate cells (`vg-313`, `vg-316`, `vg-317`, `vg-333`, `vg-335`, `vg-338`, `vg-339`) so their owners' phases pick them up.
5. **`vg-386` is a sweep of its own** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.

## Blockers / unverified

- **What waits on the user** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item) and **the rest of the four ruling sessions**, which are now being answered in batches rather than waiting on a session nobody has held — Session 1's remaining six and Session 2's twenty-five are the next two batches, since D1 and D2 gate the phase that is running. **The colour and gradient rebuild spec needs your review decision** — [`2026-10-12-colour-and-gradient-rebuild-design.md`](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md), committed `975a9dbd`: its three forks are decided from your rulings, and the vendored ReUI port plus its two open questions (where the swatch lives, which presets ship) are yours.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — `reference-theme.spec.ts` carries two `test.fail` cases keeping a requirement written down, `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake; **neither slow Playwright suite has ever been executed**, so `vg-282`'s close names the command and the job, never a green.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. A shared host on port 4175 adopted by `reuseExistingServer` can die mid-run, but **do not reach for contention to explain a red at the default worker count** — `vg-285` reproduced four of them on an idle box and bisected them to a load threshold.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

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
- **Phase 3, W2 — the ownership map's filing pass — is closed, and Phase 4 is the active phase again** — it was **skipped, not abandoned** while D8's nine rulings were unanswered, and **D8 is answered in full**; the three tasks filed the map's census rows, deleted its one self-contradicting sentence and closed eight register rows, leaving `vg-234` and `vg-245` open against the halves a map row cannot discharge. Phase 4's own gate, D1, is answered (biome check becomes the gate), and its demand stands: each gate owner reads what its rows claim, a checker reports a **set** and never a count, and a gate whose self-test is not chained into `gates:self-test` does not count as built.
- **The drain's rulings are taken in batches and recorded on the rows themselves** — **70 live rows carry a `RULED <date>` marker**, and the row's own `detail` is where a ruling exists: one written only into a ledger is invisible to the next session, and the marker is how it is found again. The agenda classifies all 104 decision rows, and the remaining ask rows go in batches.
- **The register's two false equalities are rewritten** — `vg-233`'s `check` and `vg-393`'s `detail` had called the pre-fix landing "the request times `scaleX`", which is 0.78 units off; what is exact is on the box, and both rows now say so; the archive half is read by the gate Task 4.1 landed, at the cost of `vg-404` — that gate is state-blind across the two files.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Task 3.3 closes Phase 3 by closing eight rows, not the ten the plan names** — `vg-162`, `vg-236`, `vg-237`, `vg-238`, `vg-243`, `vg-244`, `vg-246` and `vg-369` moved to the archive as `verified` with a `check` naming a word of each row's own title and an ancestor `artefacts` sha, and `vg-234` and `vg-245` stay `open`, each with a reading naming what the map row discharged and what it did not.
- **The two open rows are the phase's most useful output, and both were closable and false** — a refused rename is still silent at `editor-shell/bridge.ts:341-352` and reported at `selection-inspector/view.ts:440-450`, and nothing yet compares the schema's two hand-spelled asset-path patterns to `ASSET_PATH_PATTERN`; the plan's acceptance line is annotated rather than rewritten, and the ruling carries its source evidence.
- **Every close was proved against the real checker, not eyeballed** — `check([row])` over the archive returns `[]` for all eight, the archive diff is exactly `8 0` and the live diff `2 10`, both files' 209 and 197 rows parse, and their id sets stay disjoint.
- **The review passed both verdicts and reproduced every claim** — including the `vg-244` separator repair (one base line carried the four-backslash form, none does now) and each of the ten citations in the two readings, every cited line opened and accurate.
- **One cosmetic divergence is recorded rather than repaired** — seven of the eight checks lost the table's code spans, which the register holds both ways (45 of 197 archived checks keep theirs) and the checker ignores; the mover takes a check as one CLI argument, where a backtick would be shell-substituted before node saw it.

## Next

1. **The drain's four ruling sessions are the user's to answer, and Phase 2 runs beside them** — the agenda classifies all 104 decision rows (eight of them deferred to the browser follow-up, and the rest going in batches — the tally moves as they land, so none is kept here); Session 1's eight questions across D1 and D2 are put in chat and unanswered, so the next artifact from them is rulings, not a dispatch.
2. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
3. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — Phase 0's 22 closed rows each name which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
4. **Task 4.3 is next, and D1's ruling gives it four clauses rather than one** — the gate is `biome check`; **one CI step runs it with `gates:self-test`**; every `scripts/*.mjs` self-test is chained in (`dead-code-sweep` and `ownership-enforcement` are the two missing today); and the `organizeImports` findings are fixed in that commit — `npx biome check .` reports 63 errors across 618 files at `cc4a4557`. Beside it: `vg-323` (a test run in the gate), `vg-384` (`ci.yml` is the authority for "green", not a restated list), `vg-385` (four licence names absent from `THIRD-PARTY-NOTICES.md`, and CI triggers on `main` only), and `vg-282` (both Playwright suites on `workflow_dispatch` and nightly, never per push).
5. **`vg-386` is a sweep of its own** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.

## Blockers / unverified

- **What waits on the user** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item) and **the rest of the four ruling sessions**, which are now being answered in batches rather than waiting on a session nobody has held — Session 1's remaining six and Session 2's twenty-five are the next two batches, since D1 and D2 gate the phase that is running. **The colour and gradient rebuild spec needs your review decision** — [`2026-10-12-colour-and-gradient-rebuild-design.md`](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md), committed `975a9dbd`: its three forks are decided from your rulings, and the vendored ReUI port plus its two open questions (where the swatch lives, which presets ship) are yours.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — `reference-theme.spec.ts` carries two `test.fail` cases keeping a requirement written down, `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. A shared host on port 4175 adopted by `reuseExistingServer` can die mid-run, but **do not reach for contention to explain a red at the default worker count** — `vg-285` reproduced four of them on an idle box and bisected them to a load threshold.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

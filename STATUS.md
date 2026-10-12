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

- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); named active now that the walkthrough's instrument is closed, which was the user's sequence of 2026-10-12 (*"Finish the walkthrough first"*); it runs to eleven phases, and **task numbers in it are stable identifiers, not positions** (Task 6.5 was added mid-flight by a ruling), and **Phase 0 has closed while Phase 1 has not** — Phase 0's 22 rows are archived and proved, and Phase 1's mechanism and four-session agenda are built but its ruling sessions (Tasks 1.2–1.5) are the user's and unrun.
- **Phase 6 is closed at 11 of its 13 rows, and Phase 7 (W6) is next** — 6.1 wrote the `vg-240` protocol spec, 6.2 closed `vg-365` and `vg-367`, 6.3 closed `vg-232` and `vg-239`, 6.5a landed the two `scene-fabric` rulings (`vg-247`, `vg-248`), and 6.5b landed the six ruled rows the plan named no task for (`vg-381`, `vg-343`, `vg-104`, `vg-241`, `vg-242` — `vg-342` did not close). **Task 6.4 discharged as a reading, not a close** — `vg-364`'s span is 14 verified and 3 open (`vg-234`, `vg-240`, `vg-245`), the three predicted before the phase ran; and **the repo's own `npm run gate` was red for the whole phase**, which its close found and fixed.
- **The drain's rulings are taken in batches and recorded on the rows themselves** — a row's own `detail` is where a ruling exists, in the marker format `RULED <YYYY-MM-DD>:`, because one written only into a ledger is invisible to the next session and the marker is how it is found again. The agenda classifies all 104 decision rows and the remaining ask rows go in batches; **the tally moves as they land, so none is kept here**.
- **The register's two false equalities are rewritten** — `vg-233`'s `check` and `vg-393`'s `detail` had called the pre-fix landing "the request times `scaleX`", which is 0.78 units off; what is exact is on the box, and both rows now say so; the archive half is read by the gate Task 4.1 landed, at the cost of `vg-404` — that gate is state-blind across the two files.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Phase 6 closed at 11 of 13 rows, and Phase 5's close claim was corrected in place** — `333f538c` annotates the plan: Phase 6's Acceptance names the 11 `verified` rows and the two that stay open, and Phase 5's now says what its close actually ran (`backlog:check` and `design:check`, never `npm run gate`).
- **The repo's own `npm run gate` had been red for the whole of Phase 6** — three `biome` errors in Task 6.5b's files, fixed by `biome check --write` (`a3892dad`), and a `dead-code-sweep` self-test red since Phase 5's `a50870b5`, whose `export type BootThemeOutcome` put an unused export on `boot-theme.ts`, the sweep's negative fixture.
- **The gate break was fixed at the consumer rather than by un-exporting** — `editor-main.ts` now imports `BootThemeOutcome` and annotates the switch's subject, which makes the file's own comment true and anchors the exhaustive `never` check (`b1383446`); gate after: `biome` clean, self-tests 22/22, **251 files / 3315 tests, exit 0**.
- **Every phase close from here names its gate command and that command's exit code** — ruled in the ledger, because "gates run" is not a fact a later session can check; `npm run gate 2>&1 | tail` reports `tail`'s code and printed "exit 0" beside three biome errors.
- **Five of Task 6.5's six ruled rows closed on their own fix, and `vg-104`'s archived `owner` was corrected by byte splice** alongside `ownership.md:74` (`fa75cc7e`); live 193, archive 221, total 414, all valid.

## Next

1. **Phase 7 (W6) — test and evidence instrument hygiene, 19 rows — is next** — 7.1 (`vg-335`, `vg-338`), 7.2 (`vg-356`, `vg-371`, `vg-377`), 7.3 (`vg-135` **and `vg-186`**), 7.4 (13 rows); **`vg-186`'s ruling is DOM isolation and its proof is the sheet test running FIRST in `shell-layout.dom.test.tsx` and passing** — until that is shown the ordering guard stays.
2. **Phase 6's two open rows close nowhere in this plan** — `vg-240` waits on the re-shape Task 6.1's spec describes, and `vg-342` is a rendered-surface rewrite that would reverse `4dc220c6` and needs a browser run.
3. **The drain's four ruling sessions are the user's to answer, and a four-row batch is drafted and waiting** — `vg-023` (does the canvas dim when a group is entered), `vg-037` (a Circle's frost reads stronger than a Rect's at one value), `vg-123` (should a part snap to a part), `vg-269` (what a pane's title bar counts) are written out with their options in the drain's ledger under "The next ask batch", and none of the four has been ruled.
4. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
5. **One of the seven stray gate cells is already closed, and Phase 2 must not re-close it** — `vg-313` ended in a gate and left the live register; the other six (`vg-316`, `vg-317`, `vg-333`, `vg-335`, `vg-338`, `vg-339`) are live and `open`. **`vg-386` is a sweep of its own** — 133 candidates, none proven dead.

## Blockers / unverified

- **What waits on the user** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item) and **the rest of the four ruling sessions**, answered in batches rather than waiting on a session nobody has held — Session 1's remaining six and Session 2's twenty-five are the next two batches. **The colour and gradient rebuild spec needs your review decision** — [`2026-10-12-colour-and-gradient-rebuild-design.md`](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md), committed `975a9dbd`: its three forks are decided from your rulings, and the vendored ReUI port plus its two open questions (where the swatch lives, which presets ship) are yours.
- **A stale generated barrel must be rebuilt before the next browser run** — `packages/renderer-core/dist/**` still holds the `mountScene` and `computeMaxLines` exports that `f75edc3e` retired from source; the output is untracked and not part of any change, but a Playwright run against a stale bundle would exercise the retired API.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — Phase 5 removed `reference-theme.spec.ts`'s two `test.fail` cases, so that file's pins are gone and its cases assert the strip; `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake; **neither slow Playwright suite has ever been executed**, so `vg-282`'s close names the command and the job, never a green.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

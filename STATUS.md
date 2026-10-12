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
- **The active phase is Phase 3, W2: the ownership map's filing pass — Tasks 3.1 and 3.2 are complete and Task 3.3 closes it** — it was **skipped, not abandoned**, while D8's nine rulings were unanswered, and **D8 is answered in full**, so W2 opened when Task 4.2's loop closed; Phase 4 resumes at 4.3 after it. Phase 4's own gate, D1, is answered (biome check becomes the gate), and its demand stands: each gate owner reads what its rows claim, a checker reports a **set** and never a count, and a gate whose self-test is not chained into `gates:self-test` does not count as built.
- **The drain's rulings are taken in batches and recorded on the rows themselves** — **70 live rows carry a `RULED <date>` marker**, and the row's own `detail` is where a ruling exists: one written only into a ledger is invisible to the next session, and the marker is how it is found again. The agenda classifies all 104 decision rows, and the remaining ask rows go in batches.
- **The register's two false equalities are rewritten** — `vg-233`'s `check` and `vg-393`'s `detail` had called the pre-fix landing "the request times `scaleX`", which is 0.78 units off; what is exact is on the box, and both rows now say so; the archive half is read by the gate Task 4.1 landed, at the cost of `vg-404` — that gate is state-blind across the two files.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Task 3.2 deletes the ownership map's one self-contradicting sentence** — the Packaged-fonts note claiming `editor-shell.ts` owns generic z-order, grouping and locks is gone, and the manager rows at `:70`, `:71` and `:107` are the map's only statement on it; the code agrees with the rows, since `editor-shell.ts:327/:382/:399/:405` construct, wire and dispose those managers and write none of their state.
- **The review passed both verdicts and reproduced every claim rather than reading it** — the deletion region is coherent, the map's diff is deletions only, and the register changed exactly one line with `state` untouched and the other 216 rows byte-identical.
- **One Low was the reading's separator, and Task 3.3's step 0 repairs it** — the reading was written with a literal `\n\n` where every sibling row carries the escape, so the row would have archived holding two visible characters where a blank line belongs. Cosmetic, gate-neutral, and not worth leaving in a row about to become the archive's newest entry.
- **The other Low was my own addendum's miscount, not the commit's** — §8.11 has six live rows, not seven, because `vg-328` and `vg-235` are archived; the implementer was right and I confirmed the split against both register files.
- **Two stale §8.11 paths are now evidence for the user's unrun sessions** — `vg-155`'s `asset-manager/panel.ts` and `vg-301`'s `editor-shell.css:1304` still cite moved files, and both belong to Tasks 1.5 and 1.3; reported, deliberately not edited.

## Next

1. **The drain's four ruling sessions are the user's to answer, and Phase 2 runs beside them** — the agenda classifies all 104 decision rows (eight of them deferred to the browser follow-up, and the rest going in batches — the tally moves as they land, so none is kept here); Session 1's eight questions across D1 and D2 are put in chat and unanswered, so the next artifact from them is rulings, not a dispatch.
2. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
3. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — Phase 0's 22 closed rows each name which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
4. **Task 3.3 closes the phase, and it closes eight rows rather than the ten the plan names** — `vg-234` and `vg-245` keep a live half each that a map row cannot discharge (a silent-versus-reported refusal on `bridge.ts:341-352` against `view.ts:440-450`; a missing guard comparing the schema's two hand-spelled asset-path patterns to `ASSET_PATH_PATTERN`), so each stays `open` with a reading instead of a false `verified`; the eight checks and their shas are proved against `scripts/backlog-check.mjs` before the move, not eyeballed. Phase 4 resumes at 4.3 after Phase 3 closes, and Task 4.3's CI work consumes `vg-282`'s ruling (both suites wire in, but not on every push).
5. **`vg-386` is a sweep of its own** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.

## Blockers / unverified

- **What waits on the user** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item) and **the rest of the four ruling sessions**, which are now being answered in batches rather than waiting on a session nobody has held — Session 1's remaining six and Session 2's twenty-five are the next two batches, since D1 and D2 gate the phase that is running. **The colour and gradient rebuild spec needs your review decision** — [`2026-10-12-colour-and-gradient-rebuild-design.md`](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md), committed `975a9dbd`: its three forks are decided from your rulings, and the vendored ReUI port plus its two open questions (where the swatch lives, which presets ship) are yours.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — `reference-theme.spec.ts` carries two `test.fail` cases keeping a requirement written down, `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. A shared host on port 4175 adopted by `reuseExistingServer` can die mid-run, but **do not reach for contention to explain a red at the default worker count** — `vg-285` reproduced four of them on an idle box and bisected them to a load threshold.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

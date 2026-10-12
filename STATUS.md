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

- **Active plan: [`2026-10-12-the-backlog-drain.md`](docs/superpowers/plans/2026-10-12-the-backlog-drain.md)** — named active now that the walkthrough's instrument is closed, which was the user's sequence of 2026-10-12 (*"Finish the walkthrough first"*); it runs to eleven phases and 43 tasks, **task numbers in it are stable identifiers, not positions**, and **Phase 0 has closed while Phase 1 has not** — Phase 0's 22 rows are archived and proved, and Phase 1's mechanism and four-session agenda are built but its ruling sessions (Tasks 1.2–1.5) are the user's and unrun.
- **The active phase is Phase 2, W1's serialised browser follow-up** — opened 2026-10-12 by a recorded ruling, not by drift: §1 justifies ruling-before-work by naming D8→W5, D1→W3 and D4/D3/D6→W9, and **no ruling gates W1**; the eight browser-pinned rows Phase 1's remainder needs are read *here*, and four of the redesign's six open `fix` differences are this phase's. While it runs, nothing else in the drain builds or drives Playwright, and the user's four sessions can still be taken beside it.
- **The drain's first four rulings are already taken and recorded** — the user settled D1 (biome check becomes the gate), D5 (tests join the gated list), D4 (`vg-291` dissolves into `vg-292`) and D11 (`src/web/.agent-scratch/` relocates outside the tree) on 2026-10-12, and each sits on its own row as `RULED 2026-10-12:` in the row's `detail`, which is where the drain reads it. The agenda classifies all 104: **12 answered, 8 deferred to the browser follow-up, 84 to ask** across four sessions.
- **Two claims are owed a rewrite in the next register-bearing commit** — `vg-233`'s `check` and `vg-393`'s `detail` both state "lands at 177.58431…, the request times `scaleX`" where that equality is 0.78 units off (what is exact is the pre-fix box = the stored box × `scaleX`); and the archive half of the register is read by nothing that runs, which Task 4.1 owns.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Task 2.3b closes the chrome row and re-scopes the worker-count row** — `vg-313` is `verified` with its membership derived from `editor-shell.css` and red-proved, and `vg-285` stays `open` on the reading its own gate produced, because the ruling the row asked for is answered by the instrument rather than by a decision.
- **The boundary arm reads its three sets out of the stylesheet** — a rule whose fill is `--panel`/`--shell-surface` is glass when lifted and chrome when flat, so the literal `GLASS_CLUSTERS` pair became the derived `SHEEN_CLUSTERS` and a surface added later is read with the rule that paints it instead of escaping a list.
- **The red proof plants the row's own defect** — a further element carrying `editor-glass` with its own blur rule reddens the cluster arm in all six palettes, naming `7:.editor-shell-probe-cluster.editor-glass`, and the plant was reverted byte-exact (`cmp` against `git show HEAD:<path>`) before the green run.
- **`vg-285` reproduces on an idle box, and its bisect is a curve rather than a boundary** — 4 timeouts at 10 workers, 3 at 8, 1 at 6, none at 5, each failure 1–14% over the 30s limit, so the row's "on an idle box there is nothing to fix" is the half the reading falsifies.
- **`shell-appearance.spec.ts` crosses the 800-line stop with the derivation** — 782 → 868, reported rather than split, because the growth is the instrument and splitting the file is not this task's.

## Next

1. **The drain's four ruling sessions are the user's to answer, and Phase 2 runs beside them** — the agenda classifies all 104 decision rows (**12 answered, 8 deferred to the browser follow-up, 84 to ask**); Session 1's eight questions across D1 and D2 are put in chat and unanswered, so the next artifact from them is rulings, not a dispatch.
2. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
3. **A row whose defect does not reproduce is a finding about the row, not a licence to close it** — Phase 0's 22 closed rows each name which of §3.1's four shapes it is, because a rebuilt surface reported as a fix is the error the shapes exist to prevent.
4. **Task 2.3 is read by file, and `vg-285` now waits on a decision rather than a run** — 2.3a's four rows and 2.3b's two are read and committed, the worker-count row's gate is taken (10 workers red, the same three files green at 5), so what it waits on is which count this suite is run at here; Task 2.4's 23 rows follow, one suite at a time on the fixed preview ports.
5. **`vg-386` is a sweep of its own** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.

## Blockers / unverified

- **Two acceptance decisions are the user's, not a controller's** — which width the settings frame takes (`vg-322`: the drawn 560px, a width per panel, or a stale drawing) and which role a palette preview ground bar depicts; and a third, `vg-390`'s, whether the parity item is narrowed to the plans whose reports survive. Rulings go on the row's own `detail`, never only in a ledger.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — `reference-theme.spec.ts` carries two `test.fail` cases keeping a requirement written down, `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. On this box a shared host on port 4175 is adopted by `reuseExistingServer` and can die mid-run, which is contention rather than a defect.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

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
- **Phase 4, W3 — the repo's own gates and scanners — is closed, and Phase 5 is the active phase** — its three gate tasks built the instruments (`backlog-check.mjs` reads both registers, `design-tokens.mjs` reports a set and keys an exemption on its site, `npm run gate` is what CI runs) and Task 4.4 closed **ten** rows against them. Phase 3, W2, was **skipped, not abandoned** while D8's nine rulings were unanswered; it is closed, having filed the map's census rows, deleted its one self-contradicting sentence and closed eight register rows, leaving `vg-234` and `vg-245` open against the halves a map row cannot discharge. D1's demand stands: a checker reports a **set** and never a count, and a gate whose self-test is not chained into `gates:self-test` does not count as built.
- **The drain's rulings are taken in batches and recorded on the rows themselves** — **70 live rows carry a `RULED <date>` marker**, and the row's own `detail` is where a ruling exists: one written only into a ledger is invisible to the next session, and the marker is how it is found again. The agenda classifies all 104 decision rows, and the remaining ask rows go in batches.
- **The register's two false equalities are rewritten** — `vg-233`'s `check` and `vg-393`'s `detail` had called the pre-fix landing "the request times `scaleX`", which is 0.78 units off; what is exact is on the box, and both rows now say so; the archive half is read by the gate Task 4.1 landed, at the cost of `vg-404` — that gate is state-blind across the two files.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Phase 4 closes by closing ten register rows, not the nine the phase names** — `9739f6e6`, two files, `10 0` in the archive and `0 10` in the live file and nothing else; `vg-282` joins the nine because Task 4.3 built the two `test:*` scripts and the `slow-suites` job it asked for and no task owned its close.
- **Every check was proved against the real checker before the move and re-proved after it** — `check([row])` over the ten archived rows returns `[]`, each `artefacts` sha resolves and is an ancestor of HEAD (`ef358a5e` ×3, `e8ed504d` ×3, `8477e70a` ×4), and the review re-derived the splice itself: each archive line minus its two new fields equals the base live line with only the `state` token swapped, so every `detail`, `title` and row-specific spacing survived byte-identical.
- **The review passed both verdicts with no defect, and its three Lows each got a disposition** — `vg-323`'s check quoted an abbreviated command and was **repaired in this commit**; `vg-313` turned out to be **already closed** (`1fa67b3b`), so Phase 2 must not re-close it; and the scratch mover's dry run gained an archive fallback so the documented proof stays re-runnable after the rows move.
- **The phase's acceptance is met and annotated, not rewritten** — the seven stray gate cells are named with their owners, and the two plan lines that restated CI's steps now point at `.github/workflows/ci.yml`, which is what `vg-384` asked for.
- **`vg-282`'s close is deliberately not a green** — the two Playwright suites have commands and a nightly job, and neither has ever been executed, which its own `check` says in words.

## Next

1. **Phase 5, W4 — persisted-scene exclusions — is next, and it is three rows** — `vg-129` (Fabric's derived per-character `styles` table serialised into every saved text object), `vg-130` (`crossOrigin`, unrevivable runtime state) and `vg-110` (a theme that fails validation is answered 404 and the editor reports success); Tasks 5.1 and 5.2 add one strip handler each in `scene-fabric/src/persist.ts` and remove the matching `test.fail` pin in the same commit, and Task 5.3 carries the store's validation result to its caller. **No decision note is owed**: `persist.ts` is already claimed by `docs/decisions/0003`, `0026` and `0027`, and `store.ts` by `0017`/`0021`.
2. **The drain's four ruling sessions are the user's to answer** — the agenda classifies all 104 decision rows (eight deferred to the browser follow-up, the rest going in batches; the tally moves as they land, so none is kept here); Session 1's remaining six and Session 2's twenty-five are the next two batches.
3. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
4. **One of the seven stray gate cells is already closed, and Phase 2 must not re-close it** — `vg-313` ended in a gate and left the live register before Phase 4 named it as a pickup; the other six (`vg-316`, `vg-317`, `vg-333`, `vg-335`, `vg-338`, `vg-339`) are live and `open` for their owners' phases.
5. **`vg-386` is a sweep of its own** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.

## Blockers / unverified

- **What waits on the user** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item) and **the rest of the four ruling sessions**, which are now being answered in batches rather than waiting on a session nobody has held — Session 1's remaining six and Session 2's twenty-five are the next two batches, since D1 and D2 gate the phase that is running. **The colour and gradient rebuild spec needs your review decision** — [`2026-10-12-colour-and-gradient-rebuild-design.md`](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md), committed `975a9dbd`: its three forks are decided from your rulings, and the vendored ReUI port plus its two open questions (where the swatch lives, which presets ship) are yours.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — `reference-theme.spec.ts` carries two `test.fail` cases keeping a requirement written down, `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake; **neither slow Playwright suite has ever been executed**, so `vg-282`'s close names the command and the job, never a green.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. A shared host on port 4175 adopted by `reuseExistingServer` can die mid-run, but **do not reach for contention to explain a red at the default worker count** — `vg-285` reproduced four of them on an idle box and bisected them to a load threshold.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

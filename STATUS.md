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
- **Phase 5 is closed and Phase 6 is the active phase, three of its tasks done** — 6.1 wrote the `vg-240` protocol spec, 6.5a landed the two `scene-fabric` rulings (`vg-247`, `vg-248`), and 6.2 closed `vg-365` and `vg-367` on one deep walk and one lock predicate. 6.3 (`vg-232`, `vg-239`) and 6.5b (the six remaining ruled rows) are running now; **6.4 cannot close and is a reading, not a close** — `vg-364`'s span is 17 ids, open are `vg-232`, `vg-234`, `vg-239`, `vg-240`, `vg-241`, `vg-242`, `vg-245`, and three of those (`vg-240` pending the re-shape, `vg-234`/`vg-245` held by Phase 3's ruling) close nowhere in this plan. Phases 3 and 4 closed before it, and D1's demand stands: a checker reports a **set** and never a count.
- **The drain's rulings are taken in batches and recorded on the rows themselves** — a row's own `detail` is where a ruling exists, in the marker format `RULED <YYYY-MM-DD>:`, because one written only into a ledger is invisible to the next session and the marker is how it is found again. The agenda classifies all 104 decision rows and the remaining ask rows go in batches; **the tally moves as they land, so none is kept here**.
- **The register's two false equalities are rewritten** — `vg-233`'s `check` and `vg-393`'s `detail` had called the pre-fix landing "the request times `scaleX`", which is 0.78 units off; what is exact is on the box, and both rows now say so; the archive half is read by the gate Task 4.1 landed, at the cost of `vg-404` — that gate is state-blind across the two files.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Task 6.2 closes `vg-365` and `vg-367`** — `sceneObjects` (`asset-manager/index.ts:421`) is now the one at-any-depth walk, spent by `assetReferencedBy` and `editor-shell.ts:137`, and eligibility stays the pure-`ObjectTarget` question it owns instead of restating the copying and deleting managers' refusal from outside them.
- **Both rows closed on the agree-today branch, and the evidence is mutation rather than disagreement** — the two predicates agree today and each is reachable without the other, so the walk re-spelled root-only failing four cases and eligibility losing its lock term failing `expected [ 'copy', true ] to deeply equal [ 'copy', false ]` are what stands in for a red-first case; the register move itself is a true byte splice, `2 ++ / 2 --`.
- **`vg-411` files the eligibility restatement Task 6.2 found and could not file** — `object-actions.ts:234-239`'s `arrangeEligible` re-derives the arrange refusal from a pure `ObjectTarget` while `:100-101` in the same module asks `gate.canArrange`, which is the asymmetry `vg-365`'s own row records, so the two are one decision and are better settled together.
- **`vg-412` files the union `vg-367`'s fix left outside the map** — `file-section.tsx:155-158` ORs the canvas walk with `editor-session.ts:825`'s `#holdsAsset`, and that second operand reads envelope-side references a Fabric walk cannot see, so the split is deliberate while `ownership.md:99` claims the whole concept and names only the canvas half.
- **Task 6.2's third concern was examined and refuted rather than filed** — `#holdsAsset`'s own docstring says the canvas walk cannot see either envelope reference, so it answers a different question than `vg-367` consolidated rather than spelling that one a third time.

## Next

1. **Phase 6, W5 — manager protocols and single-owner facts — is running, and Task 6.3 and Task 6.5b are the two live seats** — Task 6.3 lands `vg-232` and `vg-239` on `editor-session.ts`, whose `vg-232` case must be red over the real surface and whose `vg-239` half closes on a mutation or stays open; Task 6.5b lands the six ruled rows the plan named no task for (`vg-104`, `vg-241`, `vg-242`, `vg-342`, `vg-343`, `vg-381`) one at a time, each on its own evidence. **Task 6.4 cannot close** — 9 of `vg-364`'s 17 subject rows are open — and Task 6.2's task review is dispatched over `34fd00c6..d69840fb`, not over `BASE..HEAD`, because nine other-seat commits landed under that agent.
2. **Task 6.3's "the owner D8 named" is a dangling reference, ruled 2026-10-13** — its steps named an owner for `vg-232` and `vg-239`, but neither row is one of D8's nine and neither carries a `RULED` marker (a scan over all 199 live rows finds no ruling sentence naming either id); **the owner is therefore the one each row's own text names** — `editor-session.ts`'s setters for `vg-232`, and `vg-239`'s own *"OWNER: `editor-session.ts`"* — and the plan's steps are annotated in place rather than rewritten.
3. **The drain's four ruling sessions are the user's to answer** — the agenda classifies all 104 decision rows (eight deferred to the browser follow-up, the rest going in batches; the tally moves as they land, so none is kept here); Session 1's remaining six and Session 2's twenty-five are the next two batches.
4. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
5. **One of the seven stray gate cells is already closed, and Phase 2 must not re-close it** — `vg-313` ended in a gate and left the live register before Phase 4 named it as a pickup; the other six (`vg-316`, `vg-317`, `vg-333`, `vg-335`, `vg-338`, `vg-339`) are live and `open` for their owners' phases. **`vg-386` is a sweep of its own** — 133 candidates, none proven dead, none deletable on classification alone.

## Blockers / unverified

- **What waits on the user** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item) and **the rest of the four ruling sessions**, which are now being answered in batches rather than waiting on a session nobody has held — Session 1's remaining six and Session 2's twenty-five are the next two batches, since D1 and D2 gate the phase that is running. **The colour and gradient rebuild spec needs your review decision** — [`2026-10-12-colour-and-gradient-rebuild-design.md`](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md), committed `975a9dbd`: its three forks are decided from your rulings, and the vendored ReUI port plus its two open questions (where the swatch lives, which presets ship) are yours.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — Phase 5 removed `reference-theme.spec.ts`'s two `test.fail` cases, so that file's pins are gone and its cases assert the strip; `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake; **neither slow Playwright suite has ever been executed**, so `vg-282`'s close names the command and the job, never a green.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. A shared host on port 4175 adopted by `reuseExistingServer` can die mid-run, but **do not reach for contention to explain a red at the default worker count** — `vg-285` reproduced four of them on an idle box and bisected them to a load threshold.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.

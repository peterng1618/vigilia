# Vigilia status

Updated: 2026-10-07
Branch: `develop`

## Current objective

**Be the human author. Use the product, find what is wrong, write it down, and
have it fixed. Repeat.**

This is a standing instruction, not a phase. A fresh session picking this up
should not be asking "what is the next task" — it should be opening the editor
and the host, driving them as an author would, and finding the next thing that
is broken. The backlog grows as a result; work is dispatched against it.

**The scope is expected to keep growing and the task sequence to keep changing.
That is the design, not drift.** This spec and plan are the one unconventional
pair in the repo: every other plan has a fixed scope written down before the
work starts, and this one is driven by finding things the list did not know to
ask for. A stale task number is the plan working. **Definition of done is a
floor, not a ceiling** — the pass ends when nothing is left that using the
product can find, not when the list runs out.

The loop, in order:

1. **Use the product** with Playwright MCP — the editor, the host, the player,
   at a real screen size and at 390 px. Insert, select, type, resize, save,
   reopen, play, fail. Do not read the source for a defect you can see.
2. **Write it into the findings backlog** — `docs/product/backlog.jsonl` is the
   registry, classified open or verified, with the measurement that shows it.
3. **Dispatch a subagent** to fix it, with the file set it owns and the files
   it must not touch, plus a browser proof it cannot fake.
4. **Verify the landed work yourself** by using it again. A passing agent report
   is not evidence; a screenshot and a number are.

## Active work

- **Plan 6, the publish loop, is the active plan; Tasks 1.1 and 1.2 have landed and Task 1.3 is next.** [The plan](docs/superpowers/plans/2026-10-07-publish-loop.md) is 15 tasks in 4 phases against spec §6; plan 5 is closed and archived with the `+` landmark met (spec `:475`, acceptance `:537`).
- **§6's own parenthetical cites work that does not exist.** It says the switch "stays in canvas controls where the canvas is (plan 1, task 4)"; `canvas-view-controls.tsx` was never created and the switch is in the header's View menu (`shell-layout.tsx:316-327`), so plan 6 renames the copy where the switch actually is and leaves the move to `vg-161`, which already queues it.
- **Two plan claims were checked against the packages, not assumed, and both were corrected.** `jsqr` is Apache-2.0, not MIT — the plan's own stop-and-file step would have halted Task 1.2 on a false alarm; and `qr`'s `border` is in modules and defaults to **2**, not the standard's 4, so passing it explicitly is load-bearing.
- **`shell-layout.dom.test.tsx` is slow for a filed reason.** `vg-135`: jsdom stops firing rAF after the View-menu test, so later tests in that file await a frame that never comes — its single View-menu test takes 190 s alone. Tasks 1.1 and 2.3 both run it; a hang there is the row, not the task.
- **The position, and the rule that tests it.** Vigilia is an editor for a phone display that happens to use Fabric. Every decision is judged by one question: *does this remove a step, or does it remove a freedom?* **A card is a fact about the starter, not a rule about themes. The device is a lens, not the document** — the artboard keeps whatever dimensions the author chooses.
- **Convenience is ordering and grouping, not a smaller surface.** Every authorable setting present, ordered by likelihood, grouped by what it is about, every field with a hint, the obscure ones at the end in a collapsed section. Nothing locked to a default, nothing hidden, and the completeness check is a *test* — a settings key with no descriptor fails to compile.

## Last completed change

- **Plan 6's Task 1.2 landed: `qr-code.ts` encodes a URL to a boolean module matrix** through `qr` 0.7.2 with `ecc: "medium"` and `border: QUIET_ZONE_MODULES` (4) passed explicitly, since the library's default is 2.
- **`qr-code.test.ts` proves the round-trip through a second library:** a 77-char URL rasterised by hand decodes back through `jsqr` 1.4.0, the outer frame is light for the 4 modules the standard requires, and the symbol is 45×45 for that payload.
- **The plan's Step 6 break was wrong, and the correction is recorded here.** Inverting ink and paper in `rasterise` does **not** fail: `jsqr` defaults to `inversionAttempts: "attemptBoth"` and reads an inverted symbol. The decode assertion was proved able to fail another way — an all-light raster returned `null` (assertion `expected undefined to be …`), then restored.
- **Licences read from the installed metadata, not assumed:** `qr` 0.7.2 is `(MIT OR Apache-2.0)` with no dependencies, `jsqr` 1.4.0 is `Apache-2.0` with no dependencies — both recorded in `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md`.
- **Gates green on the commit:** `npm run typecheck` exit 0, `biome lint ..` exit 0, `npm run format:check` exit 0 (it was red first — the plan's test line needed wrapping).

## Next

1. **Plan 6 runs phase by phase; Task 1.3 is next.** Phase 1 is the switch's words and the QR encoder (both landed), then the host's `GET /api/hosting`; each phase's browser proof is a task of its own.
2. **Two decisions are the user's, not an agent's.** Whether the right column should empty on deselect, which the spec ruled it must and the product does not (`vg-157`); and which side of `vg-151` is wrong — the zoom-coupled floor, or the blur path it measures.
3. **Rows the user raised on 2026-10-07, none of them plan 4's:** `vg-153` (dissolve the Document pane, give the theme globals their own surface), `vg-154` (drop the asset panel), `vg-155` (an import silently does one of two things), `vg-156` (JPEGs placed but only some listed — cause not established).
4. **Resume the font catalogue plan when someone picks it up** — Task 6 landed and its review failed; its `progress.md` is the resume point. Not plan 5's.
5. **Two stale-prose callouts stay until a later pass touches them.** The spec's acceptance at line 534 still says Content/Appearance/Spends where the corrected vocabulary is Content/Position/Layer/Paint/Spends, and its lines 31-32, 269, 289 still carry the old device vocabulary that plan 2 replaced.

## Blockers / unverified

- **The open rows, and which of them a later task closes.** `vg-151`: the zoom-coupled sharpness floor — `75e9c6d4` passes while `104adefc` and HEAD fail at 0.74 against 0.8024, so the fix is a decision about which side is wrong. `vg-147`: the rebuild journey's memory-rings test needs 45–52 s against Playwright's 30 s default, pre-existing and measurable at `e37f0b51`. `vg-148`: locking through the layer row's control fires no event the column listens to (`object-lock-manager/index.ts:74-81` against `selection-inspector/index.ts:487-501`). `vg-144`: the reuse gate is a one-shot latch per directory. `vg-157`/`vg-158`: the right column's binding disagreeing with the document. `vg-159`/`vg-160`: three of plan 4's verification bullets were never delivered as tests, and the Document pane still sets a panel marker named `style`. `vg-161`: an unlanded plan would remove the menubar's Insert and View menus, and nothing queues it. `vg-162`: `CARD_LIBRARY` owns the card-unit vocabulary and `ownership.md` never names it. `vg-163`: the spec's §5 primitive list names `video`, and no object kind can carry one. `vg-164`: the settings page's disk dropdown was not found in the full suite and passes alone. `vg-166`: the archive's `verified` rows are never validated, because `backlog-check` reads only the live file. `vg-167`/`vg-168`: plan 5's claimed test coverage is narrower than it says — a nested group's stamp is unchecked, and the builders-vs-library agreement pin cannot detect the failure mode it names. `vg-169`: the `+` cannot dismiss its own chooser, though it announces that it can. `vg-170`: a browser spec hard-codes a copy object id. **Plans 1 and 2 of this redesign are still live** in `docs/superpowers/plans/` while plans 3, 4 and 5 are archived — that is `vg-152`, and plan 5 does not close it.
- **`vg-135` is diagnosed to a single line and still open.** Not dead rAF and not a leaked mount: a bare `setTimeout(0)` costs **2 ms before** the View-menu click and **58 592 ms after**, and the frames around it are 18 ms. `BASE_UI_ANIMATIONS_DISABLED` and removing the `getAnimations` stub both leave it slow, so those are ruled out. The next step is timing the synchronous span *inside* the click, not around it.
- **`vg-123`, card-to-card snap granularity, is still open.** Measured: a resized part inside a card lands **956.55** aiming at the part line **960** with **0 guide rows**, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts stays the user's.** The 200-shape acceptance probe was not re-run.
- **Two standing notes that are not ours to chase.** A Playwright 1.63.0 teardown defect: `browserContext.close: ENOENT … traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`); `use.trace: "off"` removes it and the traces with it, not taken. And `vg-129`/`vg-130`, one owner in `scene-fabric/src/persist.ts`: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it. Neither is plan 5's.
- **`vg-116` is ours only as a workaround.** The POSIX drive→volume join is a real defect: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""` and **on macOS and Linux every root volume reports as belonging to no drive** — it passes on Windows only because `C:` has no trailing slash.

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

- **Plan 6, the publish loop, is the active plan; Phases 1, 2 and 3 have landed and Phase 4 is four tasks in — 4.1 through 4.4.** [The plan](docs/superpowers/plans/2026-10-07-publish-loop.md) is 16 tasks in 4 phases against spec §6 — 3.4 was added to fix `vg-173` and the proof task renumbered to 3.5; plan 5 is closed and archived with the `+` landmark met (spec `:475`, acceptance `:537`).
- **§6's own parenthetical cites work that does not exist.** It says the switch "stays in canvas controls where the canvas is (plan 1, task 4)"; `canvas-view-controls.tsx` was never created and the switch is in the header's View menu (`shell-layout.tsx:316-327`), so plan 6 renames the copy where the switch actually is and leaves the move to `vg-161`, which already queues it.
- **Two plan claims were checked against the packages, not assumed, and both were corrected.** `jsqr` is Apache-2.0, not MIT — the plan's own stop-and-file step would have halted Task 1.2 on a false alarm; and `qr`'s `border` is in modules and defaults to **2**, not the standard's 4, so passing it explicitly is load-bearing.
- **`shell-layout.dom.test.tsx` is slow for a filed reason, and the mechanism is a synchronous stall rather than rAF starvation.** `vg-135`: one Base UI menu-trigger click blocks for 50–90 s under jsdom, so the View-menu test takes 190 s alone and three insert tests time out at 91/96/118 s. Tasks 1.1 and 2.3 both run it; a hang there is the row, not the task.
- **The position, and the rule that tests it.** Vigilia is an editor for a phone display that happens to use Fabric. Every decision is judged by one question: *does this remove a step, or does it remove a freedom?* **A card is a fact about the starter, not a rule about themes. The device is a lens, not the document** — the artboard keeps whatever dimensions the author chooses.
- **Convenience is ordering and grouping, not a smaller surface.** Every authorable setting present, ordered by likelihood, grouped by what it is about, every field with a hint, the obscure ones at the end in a collapsed section. Nothing locked to a default, nothing hidden, and the completeness check is a *test* — a settings key with no descriptor fails to compile.

## Last completed change

- **Task 4.4 lands** (`c129db9c`, `51add3b1`, `1f8d0389`) — the editor publishes on change through one debounced publisher, stops with a `keepalive` `DELETE` on `pagehide`, and the control names the document a display is showing or says the theme is unsaved.
- **It caught an error in the controller's own correction, which is why the plan now publishes under `envelope.id`.** The plan had said `#libraryBase.id`; that is `contentId(serialized)`, the **sha256 of the stored bytes** (`themes/store.ts:431-433`), so every publish would have 404'd — `/api/publish` requires the id both to name a folder and to equal the envelope's own id.
- **The corrected break was reproduced here, not taken on report:** making `offer` skip the timer fails `expected [ [ …(2) ], [ …(2) ], [ …(2) ] ] to have a length of 1 but got 3`, and `publish-client.ts` was restored byte-identical.
- **1515 editor tests pass and the 3 failures are `vg-135`'s** — all three `shell-layout.dom.test.tsx` insert tests, timing out at 20 s, which is the filed row and not this task's. `typecheck=0`, `lint=0`, `format=0`.
- **Three more plan defects it found, all now fixed:** the pasted test does not typecheck (`vi.fn()` with no signature types `mock.calls` as `[][]`, so `[url]` is TS2493) and fails `format:check`; the control paragraph contradicted the `editor-main` paragraph over who owns the offer; and the Files block omitted `shell-layout.tsx`, `ui-copy.ts` and the three facade stubs.

## Next

1. **Plan 6 ends with Task 4.5, which is running; the redesign does not end there.** The spec's Sequencing table leaves three plans with no plan file — **7 Keyboard** (§7: every action's shortcut in its tooltip, one contextual toolbar rendered from the action registry, `?` opening a reference from `PRODUCT_SHORTCUTS`), **8 Player chrome** (diagnostics stop eating the phone's best pixels), and **9 Chrome and appearance** (§9's Tailwind `@theme`/`@theme inline`, OS appearance, six palettes, carrying §8's Radix migration of the five Base UI imports). Authoring those is the next work after plan 6 closes. **Plan 7 must not pick Base UI**: §8's ruling is that Radix is the single primitive library, and plan 7 is the first plan to add primitives the repo lacks — a tooltip and the `?` Dialog — so it owes a `docs/decisions/` note and the seven reuse-gate rungs before its first write. **Three acceptance items are still unmet, and they are the yardstick for "finished":** the six-palettes-by-screenshot check (plan 9), the phone showing the theme while the editor has it open (plan 6, Task 4.5, in flight), and "with nothing selected the right column is empty and names where to choose from", which the product does not do and the spec says it must (`vg-157`).
2. **Two decisions are the user's, not an agent's.** Whether the right column should empty on deselect, which the spec ruled it must and the product does not (`vg-157`); and which side of `vg-151` is wrong — the zoom-coupled floor, or the blur path it measures.
3. **Rows the user raised on 2026-10-07, none of them plan 4's:** `vg-153` (dissolve the Document pane, give the theme globals their own surface), `vg-154` (drop the asset panel), `vg-155` (an import silently does one of two things), `vg-156` (JPEGs placed but only some listed — cause not established).
4. **Resume the font catalogue plan when someone picks it up** — Task 6 landed and its review failed; its `progress.md` is the resume point. Not plan 5's.
5. **Two stale-prose callouts stay until a later pass touches them.** The spec's acceptance at line 534 still says Content/Appearance/Spends where the corrected vocabulary is Content/Position/Layer/Paint/Spends, and its lines 31-32, 269, 289 still carry the old device vocabulary that plan 2 replaced.

## Blockers / unverified

- **`vg-174` is the LAN move's one open row, and it is the bigger one.** A GET that lands while a move is in flight waits on a move that is waiting on it, so `server.close()` never completes and the host never listens again — reasoned from the code, not reproduced, and filed because the consequence is a dead host rather than a slow read. Its fix is a choice between destroying connections (now safe, because the answer is already flushed) and bounding the GET's wait. `vg-173` is closed as verified; the remedy rejected for it stays rejected, because binding `0.0.0.0` for the process's life and refusing non-loopback peers makes LAN exposure a default and moves the firewall prompt to startup — §145's posture, and the user's decision rather than an agent's.
- **The open rows, and which of them a later task closes.** `vg-151`: the zoom-coupled sharpness floor — `75e9c6d4` passes while `104adefc` and HEAD fail at 0.74 against 0.8024, so the fix is a decision about which side is wrong. `vg-147`: the rebuild journey's memory-rings test needs 45–52 s against Playwright's 30 s default, pre-existing and measurable at `e37f0b51`. `vg-148`: locking through the layer row's control fires no event the column listens to (`object-lock-manager/index.ts:74-81` against `selection-inspector/index.ts:487-501`). `vg-144`: the reuse gate is a one-shot latch per directory. `vg-157`/`vg-158`: the right column's binding disagreeing with the document. `vg-159`/`vg-160`: three of plan 4's verification bullets were never delivered as tests, and the Document pane still sets a panel marker named `style`. `vg-161`: an unlanded plan would remove the menubar's Insert and View menus, and nothing queues it. `vg-162`: `CARD_LIBRARY` owns the card-unit vocabulary and `ownership.md` never names it. `vg-163`: the spec's §5 primitive list names `video`, and no object kind can carry one. `vg-164`: the settings page's disk dropdown was not found in the full suite and passes alone. `vg-166`: the archive's `verified` rows are never validated, because `backlog-check` reads only the live file. `vg-167`/`vg-168`: plan 5's claimed test coverage is narrower than it says — a nested group's stamp is unchecked, and the builders-vs-library agreement pin cannot detect the failure mode it names. `vg-169`: the `+` cannot dismiss its own chooser, though it announces that it can. `vg-170`: a browser spec hard-codes a copy object id. `vg-171`: `lanAddress()` prefers no adapter over another, so the header's address and QR can name one no phone can reach. `vg-172`: the editor header overflows at 390 px and the publish surface goes off-screen, which no test covers because every editor spec is gated to a desktop surface. **Plans 1 and 2 of this redesign are still live** in `docs/superpowers/plans/` while plans 3, 4 and 5 are archived — that is `vg-152`, and plan 5 does not close it.
- **`vg-135` and `vg-175` are the two rows that make a full run unreadable, and neither is the code under test.** `vg-175` is new: `themes/store.test.ts` times out at 20359 ms inside the full 432 s run and passes 54/54 alone, the same class as `vg-164`, with the `vg-135` load as a hypothesis rather than a measurement. **`vg-135` now reddens the full unit suite, and the broad gate cannot be read as green until it is fixed.** At Phase 1's commit `9d334e09` the file fails **1** test in isolation; at HEAD `79f9a0b0` it fails **3**, all 20 s timeouts, so the Phase 1 report of "3061/3061" was a lucky full-suite sample rather than proof of health. Not dead rAF and not a leaked mount: a bare `setTimeout(0)` costs **2 ms before** the View-menu click and **58 592 ms after**, and the frames around it are 18 ms. `BASE_UI_ANIMATIONS_DISABLED` and removing the `getAnimations` stub both leave it slow, so those are ruled out, and unmounting `PublishControl` changes nothing. The next step is timing the synchronous span *inside* the click, not around it.
- **`vg-123`, card-to-card snap granularity, is still open.** Measured: a resized part inside a card lands **956.55** aiming at the part line **960** with **0 guide rows**, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts stays the user's.** The 200-shape acceptance probe was not re-run.
- **Three standing notes that are not this plan's to chase.** A Playwright 1.63.0 teardown defect: `browserContext.close: ENOENT … traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`); `use.trace: "off"` removes it and the traces with it, not taken. `vg-129`/`vg-130`, one owner in `scene-fabric/src/persist.ts`: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it. And `vg-116`, which is ours only as a workaround — the POSIX drive→volume join is a real defect, because `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""` and **on macOS and Linux every root volume reports as belonging to no drive**, passing on Windows only because `C:` has no trailing slash.

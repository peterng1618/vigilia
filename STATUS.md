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

- **Plan 5, units alongside primitives, is active.** [Plan file](docs/superpowers/plans/2026-10-07-units-alongside-primitives.md), seven tasks in two phases; plan 4's is [archived](docs/superpowers/plans/archive/2026-10-06-the-composition-panel.md).
- **Plan 5's landmark, from the spec's table at `:475`:** the `+` offers **units and primitives, neither greyed, neither described as a fallback**, acceptance at `:537`. The list behind it is delivered and its owner declared; the control is not.
- **What its plan author found, and the brief for it had wrong: the `+` is inert.** `shell-layout.tsx:431` is `const openInsertPopover = (): void => undefined;` under a `ponytail:` marker naming a Task 3 that never landed, and `editor-shell/insert-popover.tsx` does not exist — so plan 5 builds it as a **fourth rendering** of `insertGroups()`, never a fourth list.
- **Plan 4's hand-forward is plan 5's second phase.** The starter's cards carry no `provenance`, because only the insert path stamps it (`card-library.ts:250`), so every card row on the reference composition reads the bare `Group` arm; the stamp goes into `cardGroup`, and `layer-tree.ts:280-291`'s docstring, which documents the absence as deliberate, is corrected in the same change.
- **The position, and the rule that tests it.** Vigilia is an editor for a phone display that happens to use Fabric. Every decision is judged by one question: *does this remove a step, or does it remove a freedom?* **A card is a fact about the starter, not a rule about themes. The device is a lens, not the document** — the artboard keeps whatever dimensions the author chooses.
- **Convenience is ordering and grouping, not a smaller surface.** Every authorable setting present, ordered by likelihood, grouped by what it is about, every field with a hint, the obscure ones at the end in a collapsed section. Nothing locked to a default, nothing hidden, and the completeness check is a *test* — a settings key with no descriptor fails to compile.

## Last completed change

- **Plan 4's whole-plan review ran here, after the plan had closed, because it never had one** — its workspace held no review diffs while plan 2's held eleven.
- **The review's doc-truth findings are corrected in this commit.** `ownership.md:99` and `architecture/README.md:42` still named the deleted Style tab, and `requirements.md:47` still said "inspector tabs"; all three now say the Document pane and the pane bar.
- **Dead CSS removed.** Two `[role="tab"]` rules in `editor-shell.css` matched nothing, because no element carries that role; `editor-pane-bar.spec.ts` is 4/4 green on the rebuilt bundle.
- **`editor.spec.ts`'s pane helper now names its precondition** — a wrong selection used to surface as a confusing timeout in the lookup below it.
- **`vg-159` and `vg-160` are filed, not fixed** — three verification bullets plan 4 wrote have no test behind them, and the Document pane still sets a panel marker named `style` whose reason to keep it has expired.

## Next

1. **Execute plan 5's seven tasks** — the `+`'s chooser first, then the starter's cards carrying the unit stamp. **Plan 6, the publish loop, follows it and has no plan file yet.**
2. **Two decisions are the user's, not an agent's.** Whether the right column should empty on deselect, which the spec ruled it must and the product does not (`vg-157`); and which side of `vg-151` is wrong — the zoom-coupled floor, or the blur path it measures.
3. **Rows the user raised on 2026-10-07, none of them plan 4's:** `vg-153` (dissolve the Document pane, give the theme globals their own surface), `vg-154` (drop the asset panel), `vg-155` (an import silently does one of two things), `vg-156` (JPEGs placed but only some listed — cause not established).
4. **Resume the font catalogue plan when someone picks it up** — Task 6 landed and its review failed; its `progress.md` is the resume point. Not plan 5's.
5. **Two stale-prose callouts stay until a later pass touches them.** The spec's acceptance at line 534 still says Content/Appearance/Spends where the corrected vocabulary is Content/Position/Layer/Paint/Spends, and its lines 31-32, 269, 289 still carry the old device vocabulary that plan 2 replaced.

## Blockers / unverified

- **The open rows, and which of them a later task closes.** `vg-151`: the zoom-coupled sharpness floor — `75e9c6d4` passes while `104adefc` and HEAD fail at 0.74 against 0.8024, so the fix is a decision about which side is wrong. `vg-147`: the rebuild journey's memory-rings test needs 45–52 s against Playwright's 30 s default, pre-existing and measurable at `e37f0b51`. `vg-148`: locking through the layer row's control fires no event the column listens to (`object-lock-manager/index.ts:74-81` against `selection-inspector/index.ts:487-501`). `vg-144`: the reuse gate is a one-shot latch per directory. `vg-157`/`vg-158`: the right column's binding disagreeing with the document. `vg-159`/`vg-160`: three of plan 4's verification bullets were never delivered as tests, and the Document pane still sets a panel marker named `style`. `vg-161`: an unlanded plan would remove the menubar's Insert and View menus, and nothing queues it.
- **`vg-135` is diagnosed to a single line and still open.** Not dead rAF and not a leaked mount: a bare `setTimeout(0)` costs **2 ms before** the View-menu click and **58 592 ms after**, and the frames around it are 18 ms. `BASE_UI_ANIMATIONS_DISABLED` and removing the `getAnimations` stub both leave it slow, so those are ruled out. The next step is timing the synchronous span *inside* the click, not around it.
- **`vg-123`, card-to-card snap granularity, is still open.** Measured: a resized part inside a card lands **956.55** aiming at the part line **960** with **0 guide rows**, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts stays the user's.** The 200-shape acceptance probe was not re-run.
- **Two standing notes that are not ours to chase.** A Playwright 1.63.0 teardown defect: `browserContext.close: ENOENT … traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`); `use.trace: "off"` removes it and the traces with it, not taken. And `vg-129`/`vg-130`, one owner in `scene-fabric/src/persist.ts`: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it. Neither is plan 5's.
- **`vg-116` is ours only as a workaround.** The POSIX drive→volume join is a real defect: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""` and **on macOS and Linux every root volume reports as belonging to no drive** — it passes on Windows only because `C:` has no trailing slash.

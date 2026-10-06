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

- **No implementation plan is active.** Plan 4, the composition panel, closed with Task 11; its plan file is [archived](docs/superpowers/plans/archive/2026-10-06-the-composition-panel.md). The next plan is **plan 5, units alongside primitives** ([spec](docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md)), which has no plan file written yet.
- **Plan 5's landmark, from the spec's table at `:469-479`:** the `+` offers **units and primitives, neither as the fallback**, acceptance at `:537`. The display work sits **fifth, behind three furniture tasks** — that ordering is the mistake the spec exists to correct, so plan 5 is not a detour before it.
- **The one question plan 4 hands forward.** The starter's cards keep no provenance, so every card row on the reference composition says `group` — `metric card` is reachable on a document the author built and not on the starter. Whether the starter *is* a document made of units is **plan 5's** question, because plan 5 is where units stop being an insertion and start being the way a card exists.
- **The position, and the rule that tests it.** Vigilia is an editor for a phone display that happens to use Fabric. Every decision is judged by one question: *does this remove a step, or does it remove a freedom?* **A card is a fact about the starter, not a rule about themes. The device is a lens, not the document** — the artboard keeps whatever dimensions the author chooses.
- **Convenience is ordering and grouping, not a smaller surface.** Every authorable setting present, ordered by likelihood, grouped by what it is about, every field with a hint, the obscure ones at the end in a collapsed section. Nothing locked to a default, nothing hidden, and the completeness check is a *test* — a settings key with no descriptor fails to compile.
- **KWGT is the reference, not Figma UI3** — the closest thing to this product that exists; its lessons and the one place it is worse than us are in the spec. **The font catalogue plan is on hold**, Task 6 landed and its review failed; its `progress.md` is the resume point.

## Last completed change

- **Plan 4: Task 11 landed and the plan is closed.** `vg-146` moved to `verified` and into `docs/product/backlog-archive.jsonl`.
- **`vg-146`'s two halves, both checked here.** `check` is `grep -rnE "Style tab|the Style panel|inspector\.style" src/web/packages src/web/tests`, returning no match now the tab and its `style.ts` are gone; `artefacts` is `9f62b0d3`, the commit that deleted them, confirmed an ancestor of HEAD.
- **`vg-056` and `vg-087` are carried, not closed.** The composition panel keeps the row click, the drag handlers, the same-parent rule and the refusal marks, but neither multi-select nor drag-to-reorder is implemented by this plan.
- **`vg-151` stays open, against the plan's own instruction to close it.** `75e9c6d4` passes but `104adefc` and plan 4's HEAD both fail at 0.74 against the 0.8024 the same run computes, so the zoom-coupled floor is still red and no honest `verified` check exists. `vg-157` and `vg-158` are open too.
- **`vg-152` files the same archive rule against plans 1 and 2** — two closed plans still live while plan 3 was archived. Linked here, not done here; this task moves only its own plan.

## Next

1. **Plan 5, units alongside primitives, is the next plan.** Its landmark from the spec's table at `:469-479` is *the `+` offers units and primitives, neither described as a fallback*; acceptance at `:537`. It also owns the starter-provenance question above.
2. **Two decisions are the user's, not an agent's.** Whether the right column should empty on deselect, which the spec ruled it must and the product does not (`vg-157`); and which side of `vg-151` is wrong — the zoom-coupled floor, or the blur path it measures.
3. **Rows the user raised on 2026-10-07, none of them plan 4's:** `vg-153` (dissolve the Document pane, give the theme globals their own surface), `vg-154` (drop the asset panel), `vg-155` (an import silently does one of two things), `vg-156` (JPEGs placed but only some listed — cause not established).
4. **Resume the font catalogue plan when someone picks it up** — Task 6 landed and its review failed; its `progress.md` is the resume point. Not plan 5's.
5. **Two stale-prose callouts stay until a later pass touches them.** The spec's acceptance at line 534 still says Content/Appearance/Spends where the corrected vocabulary is Content/Position/Layer/Paint/Spends, and its lines 31-32, 269, 289 still carry the old device vocabulary that plan 2 replaced.

## Blockers / unverified

- **The open rows, and which of them a later task closes.** `vg-151`: the zoom-coupled sharpness floor — `75e9c6d4` passes while `104adefc` and HEAD fail at 0.74 against 0.8024, so the fix is a decision about which side is wrong. `vg-147`: the rebuild journey's memory-rings test needs 45–52 s against Playwright's 30 s default, pre-existing and measurable at `e37f0b51`. `vg-148`: locking through the layer row's control fires no event the column listens to (`object-lock-manager/index.ts:74-81` against `selection-inspector/index.ts:487-501`). `vg-144`: the reuse gate is a one-shot latch per directory. `vg-157`/`vg-158`: the right column's binding disagreeing with the document.
- **`vg-135` is diagnosed to a single line and still open.** Not dead rAF and not a leaked mount: a bare `setTimeout(0)` costs **2 ms before** the View-menu click and **58 592 ms after**, and the frames around it are 18 ms. `BASE_UI_ANIMATIONS_DISABLED` and removing the `getAnimations` stub both leave it slow, so those are ruled out. The next step is timing the synchronous span *inside* the click, not around it.
- **`vg-123`, card-to-card snap granularity, is still open.** Measured: a resized part inside a card lands **956.55** aiming at the part line **960** with **0 guide rows**, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts stays the user's.** The 200-shape acceptance probe was not re-run.
- **Two standing notes that are not ours to chase.** A Playwright 1.63.0 teardown defect: `browserContext.close: ENOENT … traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`); `use.trace: "off"` removes it and the traces with it, not taken. And `vg-129`/`vg-130`, one owner in `scene-fabric/src/persist.ts`: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it. Neither is plan 5's.
- **`vg-116` is ours only as a workaround.** The POSIX drive→volume join is a real defect: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""` and **on macOS and Linux every root volume reports as belonging to no drive** — it passes on Windows only because `C:` has no trailing slash.

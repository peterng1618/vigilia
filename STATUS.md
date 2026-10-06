# Vigilia status

Updated: 2026-10-06
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

- **Active plan:** none — **plan 3, the per-kind inspector, is closed** and archived at [the per-kind inspector](docs/superpowers/plans/archive/2026-10-06-the-per-kind-inspector.md). **The next work is plan 4, the composition panel**, the redesign's fourth of nine, named in [authoring a dashboard, not a canvas](docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md) §3 and its plan table row 4; no plan 4 document exists yet, so writing it is the first task.
- **Plan 4's landmarks, from the spec:** the left column becomes a composition panel that is good at **two hundred** rows rather than correct at eight — a **thumbnail** where one means something, each row's **role** (`gauge · cpu.load`, `chart · line ×3`, `metric card`, `shape`) and its **bound key**; **select and enter are separate acts**, because one disclosure triangle that both reveals children and selects the row conflates *what can I configure* with *what is inside*; **lock and eye appear only when true** (hover, selection, or non-default), which is what makes the noise scale; and the Style tab's **document mode relocates into the left column's Document pane**.
- **The position, and the rule that tests it.** Vigilia is an editor for a phone display that happens to use Fabric. Every decision is judged by one question: *does this remove a step, or does it remove a freedom?* **A card is a fact about the starter, not a rule about themes** — the reference happens to be eight frosted panels; another theme is one photograph and a caption, or two hundred loose shapes. **The device is a lens, not the document** — the artboard keeps whatever dimensions the author chooses.
- **The property-surface case that proved it is closed.** `PieSettings.total` and every family's `animation` were unreachable and are now descriptors with controls, so the spec's §4 column is real rather than aspirational: `vg-121` and `vg-122` are `verified`.
- **Convenience is ordering and grouping, not a smaller surface.** Every authorable setting present, ordered by likelihood, grouped by what it is about, every field with a hint, the obscure ones at the end in a collapsed section. Nothing locked to a default, nothing hidden, and the completeness check is a *test* — `NON_SCALAR_SETTINGS` is gone and a settings key with no descriptor fails to compile.
- **KWGT is the reference, not Figma UI3** — the closest thing to this product that exists; its lessons and the one place it is worse than us are in the spec. **The font catalogue plan is on hold**, Task 6 landed and its review failed; its `progress.md` is the resume point.

## Last completed change

- **Plan 3, the per-kind inspector, is closed.** Tasks 1–11 landed from `5c3c31c4` to `8b4274b7`: the right column is five questions — content, position, layer, paint, spends — built from a per-kind plan as data, Position starts closed, and every kind the editor can select renders a non-empty column.
- **The descriptor table in `renderer-core/src/charts/settings-fields.ts` stays the one owner of which settings exist**, and the gap between a settings type and the table is a red gate: `NON_SCALAR_SETTINGS` is deleted, a typed coverage record makes a settings key with no descriptor a compile error, and `validateSettingsRange` is an exhaustive family switch.
- **`vg-121` and `vg-122` are `verified`** — a pie can be given a fixed total, so its remainder is measurable (`remainder = 64 - 32` through the real `computeComposition`), and animation is reachable on all four families through a nested `writeSetting` that materialises the whole `AnimationSettings` block from `defaultAnimationSettings`.
- **The Data tab is gone and a chart answers in its own column.** `chart-manager` keeps every write and hands two field bodies to the column through a `ChartFieldsPort`; the `#announce` replacement keeps a settings edit undoable, and Task 10 proved it load-bearing by renaming the event until the new browser test failed.
- **`vg-145` closed on a measurement that refuted the plan's own hypothesis** — ECharts reduces both sweep angles modulo 360, so the descriptor's ±360 bound was right and the journey was corrected to `45`. Task 10 added six more corrections, including that the `701` vitest figure is describe blocks and the measured file count is **206**.

## Next

1. **Write plan 4, the composition panel, then execute it subagent-driven.** Start with `superpowers:brainstorming`/`writing-plans` against spec §3 and plan-table row 4; the landmarks are in *Active work* above, and the split the spec already records is that the selection column empties when nothing is selected while the document/artboard panel stays mounted until plan 4 moves it left.
2. **The standing loop still applies to plan 4's own work:** use the built editor and host as an author, file what breaks, dispatch against the register, and verify the landed work by using it again rather than by reading the agent's report.
3. **Resume the font catalogue plan when someone picks it up** — Task 6 landed and its review failed; its `progress.md` is the resume point. Not this plan's.
4. **Three rows plan 3 leaves open, plus one it filed about the gate itself, are in *Blockers*** and none is closable by a status edit: `vg-146`, `vg-147`, `vg-148` and `vg-144`.
5. **Two stale-prose callouts stay until a later pass touches them.** The spec's acceptance at line 534 still says Content/Appearance/Spends where the corrected vocabulary is Content/Position/Layer/Paint/Spends, and its lines 31-32, 269, 289 still carry the old device vocabulary that plan 2 replaced.

## Blockers / unverified

- **The four rows plan 3 leaves open, none closable here.** `vg-146`: the Style tab renders an empty panel for a group or a multi-selection while the design column lists the children's effective appearance, so two read-only surfaces answer one selection differently. `vg-148`: locking through the layer row's control fires no event the column listens to (`object-lock-manager/index.ts:74-81` against `selection-inspector/index.ts:487-501`), so it keeps offering writing fields a locked object refuses until the next selection. `vg-147`: the rebuild journey's memory-rings test needs 45–52 s against Playwright's 30 s default, with three siblings at 27–28 s — pre-existing, measured at `e37f0b51` too. `vg-144`: the reuse gate is a one-shot latch per directory, satisfied forever by any older note claiming the same path, so it guards the first change to a boundary and nothing after it.
- **`vg-135` is diagnosed to a single line and still open.** Not dead rAF and not a leaked mount: a bare `setTimeout(0)` costs **2 ms before** the View-menu click and **58 592 ms after**, and the frames around it are 18 ms. `BASE_UI_ANIMATIONS_DISABLED` and removing the `getAnimations` stub both leave it slow, so those are ruled out. The next step is timing the synchronous span *inside* the click, not around it.
- **`vg-123`, card-to-card snap granularity, is still open.** Measured: a resized part inside a card lands **956.55** aiming at the part line **960** with **0 guide rows**, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts stays the user's.** The 200-shape acceptance probe was not re-run.
- **Two standing notes that are not ours to chase.** A Playwright 1.63.0 teardown defect: `browserContext.close: ENOENT … traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`); `use.trace: "off"` removes it and the traces with it, not taken. And `vg-129`/`vg-130`, one owner in `scene-fabric/src/persist.ts`: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it. Neither is plan 3's.
- **`vg-116` is ours only as a workaround.** The POSIX drive→volume join is a real defect: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""` and **on macOS and Linux every root volume reports as belonging to no drive** — it passes on Windows only because `C:` has no trailing slash.

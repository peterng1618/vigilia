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

- **Active plan:** **plan 4, the composition panel**, at [the composition panel](docs/superpowers/plans/2026-10-06-the-composition-panel.md) — the redesign's fourth of nine, following [the per-kind inspector](docs/superpowers/plans/archive/2026-10-06-the-per-kind-inspector.md), which landed and is archived. Eleven tasks in four phases: a row says what it is (role), **enter is its own act**, the Style tab's document mode relocates into the left column's Document pane, then proof. Its workspace is `.superpowers/sdd/2026-10-06-the-composition-panel/`. The redesign is [authoring a dashboard, not a canvas](docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md).
- **Plan 4's landmarks, from the spec:** the left column becomes a composition panel that is good at **two hundred** rows rather than correct at eight — a **thumbnail** where one means something, each row's **role** (`gauge · cpu.load`, `chart · line ×3`, `metric card`, `shape`) and its **bound key**; **select and enter are separate acts**, because one disclosure triangle that both reveals children and selects the row conflates *what can I configure* with *what is inside*; **lock and eye appear only when true** (hover, selection, or non-default), which is what makes the noise scale; and the Style tab's **document mode relocates into the left column's Document pane**.
- **The position, and the rule that tests it.** Vigilia is an editor for a phone display that happens to use Fabric. Every decision is judged by one question: *does this remove a step, or does it remove a freedom?* **A card is a fact about the starter, not a rule about themes** — the reference happens to be eight frosted panels; another theme is one photograph and a caption, or two hundred loose shapes. **The device is a lens, not the document** — the artboard keeps whatever dimensions the author chooses.
- **The property-surface case that proved it is closed.** `PieSettings.total` and every family's `animation` were unreachable and are now descriptors with controls, so the spec's §4 column is real rather than aspirational: `vg-121` and `vg-122` are `verified`.
- **Convenience is ordering and grouping, not a smaller surface.** Every authorable setting present, ordered by likelihood, grouped by what it is about, every field with a hint, the obscure ones at the end in a collapsed section. Nothing locked to a default, nothing hidden, and the completeness check is a *test* — `NON_SCALAR_SETTINGS` is gone and a settings key with no descriptor fails to compile.
- **KWGT is the reference, not Figma UI3** — the closest thing to this product that exists; its lessons and the one place it is worse than us are in the spec. **The font catalogue plan is on hold**, Task 6 landed and its review failed; its `progress.md` is the resume point.

## Last completed change

- **Plan 4's Phase 1 is closed and Phase 2 is open: Tasks 1–4 landed, `61b9673d` → `7c35c6a8`.** A layer row carries a `role` and says it; the column is **360px** because that is what the role cost; and the bridge now has `enterGroup(id)` / `exitGroup()`, so entering a group is a verb the panel can call rather than a canvas double-click.
- **The role cost a number and the number chose the fix:** 4 of 60 names clipped at the recorded 340px against 2 without it; widening to 360px (knee 350px) buys both back, stage 948 → 928. Reproduced here: `rows=60 clipped@shipped=2 clipped@shipped-without-role=2 clipped@340=4`. The same count settled the deferred string — the spec's `chart · line ×3` clips 7 of 60 against the landed `Line ×3`'s 4.
- **`enterGroup` had a one-hop trap the plan named but never settled.** `ownerGroup` is `object.parent`, so handing the manager a nested group enters **its owner**. Ruled at `7c35c6a8`: resolve the id, require `target instanceof Group`, and hand over one of the group's own children when the group is itself nested. A nested group with no children stays shut rather than silently entering its parent. Proved red at `expected [ 'outer' ] to deeply equal [ 'inner' ]`.
- **`4d15992c` puts the enter control on the row**, labelled with the group's name and carrying `data-vigilia-layer-entry="enter"|"leave"` so Task 6 has a row-unique address. Red-proved by dropping the name from the label: `expected 'Enter' to be 'Enter CPU card'`. **`layer-panel.tsx` is now 788 of 800 lines** — the next task that grows the row must extract the state slot rather than trim prose, and the third control's 24px is taken from the bound column by a `:has()` rule that nothing has measured in a browser.
- **Three gates this run proved were not what the plan said.** `vg-149`: biome's `files.includes` matches no `.tsx`, so all 23 tracked React files sit outside lint and format. `vg-150`: `PLAYWRIGHT_JSON_OUTPUT_NAME` applies only when the run also passes `--reporter=json`. And two plan verification bullets were unwritable as stated — `layers()` carries no `data-context`, and the non-group no-op is free only for a *top-level* non-group.
- **Verified here, not on report:** typecheck exit 0, 230 tests across 37 editor-shell suites green, tree clean at every commit.

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

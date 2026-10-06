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

- **Active plan:** **plan 4, the composition panel**, at [the composition panel](docs/superpowers/plans/2026-10-06-the-composition-panel.md) — the redesign's fourth of nine, following [the per-kind inspector](docs/superpowers/plans/archive/2026-10-06-the-per-kind-inspector.md), which landed and is archived. Eleven tasks in four phases: a row says what it is (role), **enter is its own act**, the Style tab's document mode relocates into the left column's Document pane, then proof. **Tasks 1–8 are in; Task 9 is next.** The two decision notes that unblocked Task 8 are `0029` (`shell-layout.tsx`) and `0030` (`selection-inspector/style.ts`). Its workspace is `.superpowers/sdd/2026-10-06-the-composition-panel/`. The redesign is [authoring a dashboard, not a canvas](docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md).
- **Plan 4's landmarks, from the spec:** the left column becomes a composition panel that is good at **two hundred** rows rather than correct at eight — a **thumbnail** where one means something, each row's **role** (`gauge · cpu.load`, `chart · line ×3`, `metric card`, `shape`) and its **bound key**; **select and enter are separate acts**, because one disclosure triangle that both reveals children and selects the row conflates *what can I configure* with *what is inside*; **lock and eye appear only when true** (hover, selection, or non-default), which is what makes the noise scale; and the Style tab's **document mode relocates into the left column's Document pane**.
- **The position, and the rule that tests it.** Vigilia is an editor for a phone display that happens to use Fabric. Every decision is judged by one question: *does this remove a step, or does it remove a freedom?* **A card is a fact about the starter, not a rule about themes** — the reference happens to be eight frosted panels; another theme is one photograph and a caption, or two hundred loose shapes. **The device is a lens, not the document** — the artboard keeps whatever dimensions the author chooses.
- **The property-surface case that proved it is closed.** `PieSettings.total` and every family's `animation` were unreachable and are now descriptors with controls, so the spec's §4 column is real rather than aspirational: `vg-121` and `vg-122` are `verified`.
- **Convenience is ordering and grouping, not a smaller surface.** Every authorable setting present, ordered by likelihood, grouped by what it is about, every field with a hint, the obscure ones at the end in a collapsed section. Nothing locked to a default, nothing hidden, and the completeness check is a *test* — `NON_SCALAR_SETTINGS` is gone and a settings key with no descriptor fails to compile.
- **KWGT is the reference, not Figma UI3** — the closest thing to this product that exists; its lessons and the one place it is worse than us are in the spec. **The font catalogue plan is on hold**, Task 6 landed and its review failed; its `progress.md` is the resume point.

## Last completed change

- **Plan 4: Task 8 landed at `9f62b0d3`, closing `vg-146`.** The Style tab's selection mode is deleted, its document mode moved unchanged into the left column's Document pane, and the right column's tab strip is gone — the column itself stays. Eleven files, **-69 net lines**. Verified here, not on report: typecheck exit 0, `biome lint` exit 0, **1491 tests / 285 suites, 0 failed**, no `role="tab"` in the shell, 0 `style: document.body` fixtures left.
- **The marker looked lost and was not.** `data-vigilia-globals` appears nowhere as a literal because it is set through `section.dataset["vigiliaGlobals"]` at `style.ts:45`; the DOM attribute is right and both browser assertions still read it. A grep for the literal is the wrong query, not a regression.
- **The third falsified comment in this plan is corrected.** `editor-session.ts:125-129` now says the pane shows those panels, not an empty selection — after `editor-canvas.ts`'s "three buttons" and `pane-bar.tsx`'s "three segments", each fixed by the task that made it wrong.
- **The brief's suggested red proof was impossible and the agent said so.** The deletion leaves no `active === undefined` gate to disable, so that case cannot go red; the tab-strip test was used instead and fails exactly when the fix is undone. A brief proposing a proof that cannot fail is a defect in the brief, and this one was caught rather than faked.
- **`biome check` is not a project gate.** Its `organizeImports` failure on `composition-panel.spec.ts` pre-dates Task 8 (verified against `9f62b0d3^`) and `package.json` runs `lint`, `format`, `lint:fix`, `format:check` — **no script runs `check`**. No row filed, and recorded so nobody re-derives it.

## Next

1. **Task 9 is next and it is the red-window closer** — the editor e2e suite has been failing since Task 8 deleted the `role="tab"` both helpers click, so this rewires ~26 call sites across 7 files by reading each one, never by making a helper a no-op. Its brief is measured in `.superpowers/sdd/2026-10-06-the-composition-panel/` and now also carries Task 8's two handovers: `editor.spec.ts:2068`'s stale case title and `:2133`'s `[data-vigilia-panel="style"]`, which needs a pane choice *as well as* losing its tab click. **Rows the user raised on 2026-10-07, none of them this plan's:** `vg-153` (dissolve the Document pane, give the theme globals their own surface), `vg-154` (drop the asset panel), `vg-155` (an import silently does one of two things), `vg-156` (JPEGs placed but only some listed — cause not established).
2. **The standing loop still applies to plan 4's own work:** use the built editor and host as an author, file what breaks, dispatch against the register, and verify the landed work by using it again rather than by reading the agent's report.
3. **Resume the font catalogue plan when someone picks it up** — Task 6 landed and its review failed; its `progress.md` is the resume point. Not this plan's.
4. **Three rows plan 3 leaves open, plus one it filed about the gate itself, are in *Blockers*** and none is closable by a status edit: `vg-146` (which Task 8 closes), `vg-147`, `vg-148` and `vg-144`.
5. **Two stale-prose callouts stay until a later pass touches them.** The spec's acceptance at line 534 still says Content/Appearance/Spends where the corrected vocabulary is Content/Position/Layer/Paint/Spends, and its lines 31-32, 269, 289 still carry the old device vocabulary that plan 2 replaced.

## Blockers / unverified

- **The open rows, and which of them a later task closes.** `vg-151`, filed by Task 6: `reference-theme.spec.ts:1441` reads 0.74 against its 0.8024 floor on two samples, the sampled band is sized by the fit zoom, and Task 3 (`104adefc`) took 20px off the stage — so **Task 10's bisect closes it either way**, and the row now carries that mechanism rather than only "the task's diff cannot cause it". `vg-146`: the Style tab renders an empty panel for a group or a multi-selection while the design column lists the children's effective appearance, so two read-only surfaces answer one selection differently. `vg-148`: locking through the layer row's control fires no event the column listens to (`object-lock-manager/index.ts:74-81` against `selection-inspector/index.ts:487-501`), so it keeps offering writing fields a locked object refuses until the next selection. `vg-147`: the rebuild journey's memory-rings test needs 45–52 s against Playwright's 30 s default, with three siblings at 27–28 s — pre-existing, measured at `e37f0b51` too. `vg-144`: the reuse gate is a one-shot latch per directory, satisfied forever by any older note claiming the same path, so it guards the first change to a boundary and nothing after it.
- **`vg-135` is diagnosed to a single line and still open.** Not dead rAF and not a leaked mount: a bare `setTimeout(0)` costs **2 ms before** the View-menu click and **58 592 ms after**, and the frames around it are 18 ms. `BASE_UI_ANIMATIONS_DISABLED` and removing the `getAnimations` stub both leave it slow, so those are ruled out. The next step is timing the synchronous span *inside* the click, not around it.
- **`vg-123`, card-to-card snap granularity, is still open.** Measured: a resized part inside a card lands **956.55** aiming at the part line **960** with **0 guide rows**, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts stays the user's.** The 200-shape acceptance probe was not re-run.
- **Two standing notes that are not ours to chase.** A Playwright 1.63.0 teardown defect: `browserContext.close: ENOENT … traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`); `use.trace: "off"` removes it and the traces with it, not taken. And `vg-129`/`vg-130`, one owner in `scene-fabric/src/persist.ts`: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it. Neither is plan 3's.
- **`vg-116` is ours only as a workaround.** The POSIX drive→volume join is a real defect: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""` and **on macOS and Linux every root volume reports as belonging to no drive** — it passes on Windows only because `C:` has no trailing slash.

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

- **Active plan:** **plan 3, the per-kind inspector**, at [the per-kind inspector](docs/superpowers/plans/2026-10-06-the-per-kind-inspector.md), the redesign's third of nine — superseding nothing, following [the device lens](docs/superpowers/plans/2026-10-04-the-device-lens.md), which landed, and [groups in the starter](docs/superpowers/plans/2026-10-03-groups-in-the-starter.md). The redesign is [authoring a dashboard, not a canvas](docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md), and it supersedes [one design, four surfaces](docs/superpowers/specs/2026-10-02-frontend-redesign-design.md), which diagnosed the right thing and then scheduled the fix for it fifth, behind three furniture tasks. Nine plans, sequenced by **what becomes visible**: groups in the starter, the device lens, the per-kind inspector, the composition panel, units alongside primitives, the publish loop, keyboard, player chrome, appearance.
- **The position, and the rule that tests it.** Vigilia is an editor for a phone display that happens to use Fabric. Every decision is judged by one question: *does this remove a step, or does it remove a freedom?* **A card is a fact about the starter, not a rule about themes** — the reference happens to be eight frosted panels; another theme is one photograph and a caption, or two hundred loose shapes. **The device is a lens, not the document** — the artboard keeps whatever dimensions the author chooses.
- **Two cases prove it, both found by driving rather than reasoning.** A quarter-disc bleeding 3/4 off the edge is unconstructible today (no arc in `SHAPE_KINDS`) and the editor does not clip at the artboard, so an author composes against a preview that disagrees with the phone. And the property surface: `settings-fields.ts` is headed "every scalar setting" and mostly is, but `PieSettings.total` and every family's `animation` are unreachable — **filed as `vg-121` and `vg-122`.**
- **Convenience is ordering and grouping, not a smaller surface.** Every authorable setting present, ordered by likelihood, grouped by what it is about, every field with a hint, the obscure ones at the end in a collapsed section. Nothing locked to a default, nothing hidden, and the completeness check is a *test*.
- **KWGT is the reference, not Figma UI3** — the closest thing to this product that exists; its lessons and the one place it is worse than us are in the spec. **The font catalogue plan is on hold**, Task 6 landed and its review failed; its `progress.md` is the resume point.

## Last completed change

- **A chart answers where it is, and the Data tab is gone.** Task 9 landed as `1082b7da`: `chart-manager` still owns every write and now hands two field bodies to the column through a `ChartFieldsPort` — the shape `GeometryPort` already had — which mounts them in the chart's own Content and Paint. The `data` tab, `uiCopy.inspector.data`, `createChartPropertyPanel` and the "Chart settings are under Data." hint are all gone; `vigilia-chart-setting-*` and `vigilia-chart-binding-*` are unchanged.
- **`vg-145` is `verified` — and the plan's hypothesis about it was wrong, which is the useful part.** Two agents and this plan reasoned that a `135 → 405` gauge sweep must draw differently from `135 → 45` because 270° is not 90°. Measured on the canvas with a control: of 2087 opaque pixels, `135/405` vs `135/45` differ by **0**, and `135/405` vs `135/360` by **1337**. ECharts reduces both angles modulo 360, so the descriptor's ±360 bound is **correct** and the journey was corrected to `45`. The refutation is written into the plan so nobody re-derives it from the same reasoning.
- **A latent defect Task 9 caught by reading, not by a gate.** `#drawPanel` was the *only* route from a chart settings edit to `object:modified`, the event `history.save()` listens on — deleting it with the panel would have made every chart settings edit **silently non-undoable**, and no test anywhere covers that. It added the `#announce` replacement; Task 10 now owns the browser proof.
- **Verified again here**: typecheck exit 0, 321/321 across 47 suites; the agent's own full run 3026/3026 across 701 files, rebuild config 9/9, and the write path read back off `chart.option.series[0]` in real Chromium rather than off the settings object.
- **`vg-147` filed, not fixed**: the rebuild spec's memory-rings test needs 45–52 s against Playwright's 30 s default and three siblings sit at 27–28 s — pre-existing, measured at `e37f0b51` too. One test got `test.slow()`; a suite-wide budget is a decision about that config.

## Next

1. **Execute plan 3, subagent-driven, in task order.** **Tasks 1–9 have landed.** **Task 10, the browser evidence, is in flight** — the plan boundary, so the broad gate runs there, and it carries the new claim that a chart settings edit is undoable. Task 11 closes the plan: `vg-121`/`vg-122` verified with a check naming their own title plus an ancestor sha, `STATUS.md` naming plan 4, and the plan moved to the archive.
2. **Phase 1 is the descriptor contract** (Tasks 1–4): sections, hints and `advanced`; `total` and `animation` reachable; the typed coverage record that makes a settings key without a descriptor a red gate; the validator's family dispatch made exhaustive.
3. **Phase 2 is the column** (Tasks 5–9): `propertySection`, `settingsField`, the five sections with Position closed, the per-kind plan, and the chart answering in its own column with the Data tab retired.
4. **Phase 3 is proof** (Tasks 10–11): browser evidence against the built bundle, then `vg-121`/`vg-122` verified with a check naming their own title plus an ancestor sha.
5. **Two stale-prose callouts stay until a later pass touches them.** The spec's acceptance at line 534 still says Content/Appearance/Spends where the corrected vocabulary is Content/Position/Layer/Paint/Spends, and its lines 31-32, 269, 289 still carry the old device vocabulary that plan 2 replaced.

## Blockers / unverified

- **`vg-145` blocks plan 3's close, and is assigned to Task 9.** Task 6's control silently lands an author's number on a descriptor bound: the rebuild journey fills gauge `endAngle` with **405**, `settings-fields.ts:279-280` bounds it at ±360, and `numberField` clamps to the bound it crossed — where the loop `f254259b` replaced wrote the raw value. **The validator bounds no `endAngle` in any family**, so `405` validates today, which makes the descriptor narrower than the format it describes. Task 7 filed it instead of fixing it because which side is wrong is a design decision; Task 9 now owns that decision and the measurement behind it, because `author-journey-rebuild.spec.ts` is already in its file list.
- **`vg-135` is diagnosed to a single line and still open.** Not dead rAF and not a leaked mount: a bare `setTimeout(0)` costs **2 ms before** the View-menu click and **58 592 ms after**, and the frames around it are 18 ms. `BASE_UI_ANIMATIONS_DISABLED` and removing the `getAnimations` stub both leave it slow, so those are ruled out. The next step is timing the synchronous span *inside* the click, not around it.
- **`vg-123`, card-to-card snap granularity, is still open.** Measured: a resized part inside a card lands **956.55** aiming at the part line **960** with **0 guide rows**, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts stays the user's.** The 200-shape acceptance probe was not re-run.
- **Two standing notes that are not ours to chase.** A Playwright 1.63.0 teardown defect: `browserContext.close: ENOENT … traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`); `use.trace: "off"` removes it and the traces with it, not taken. And `vg-129`/`vg-130`, one owner in `scene-fabric/src/persist.ts`: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it. Neither is plan 3's.
- **`vg-116` is ours only as a workaround.** The POSIX drive→volume join is a real defect: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""` and **on macOS and Linux every root volume reports as belonging to no drive** — it passes on Windows only because `C:` has no trailing slash.
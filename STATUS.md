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

- **Every kind answers its own questions.** Task 8 landed as `f0024e0e`: `SELECTION_KINDS` (shape · text · chart · image · group · activeSelection) with a **total** `KIND_QUESTIONS`, so a kind added without a rule fails to compile instead of rendering an empty column. `selectionKindOf` checks `ActiveSelection` before `Group`, because Fabric's `ActiveSelection` *is* a `Group`.
- **The one question no existing gate answered is a container's appearance.** A group and a multi-selection have no ink, no type and no material of their own, so the read-only section reads its children — one line per distinct token, named by the reference's own reader, so a chart child's paint is labelled by its family's field descriptor. A container whose children resolve to nothing still says so.
- **Verified again here**: typecheck exit 0, 288/288 across 38 suites (baseline 259/259 before this task). The agent's own full run was 3025/3025, its browser pass confirmed all ten starter rows render a column in real Chromium, and `runs.ts` carries a zero diff.
- **Two red proofs**: disabling container appearance fails both container cases; removing the shape-geometry spread fails the inventory test. That inventory list was written from a **measured dump of the unmodified column**, not from the new code, which is what stops it agreeing with a bug.
- **Three more plan errors corrected**: the "repo's own source-size check" it was told to satisfy **does not exist** (no script, no test reads a line count — `runs.ts` is held by a zero diff instead); its browser bullet asked it to register captures that belong to Task 10, and a row with no backing action captures nothing; and `isTextObject` is module-private in `index.ts`, which imports the column, so consuming it would be a cycle.

## Next

1. **Execute plan 3, subagent-driven, in task order.** **Phase 1 (Tasks 1–4) and Tasks 7–8 have landed**; **Task 9 is in flight** — the chart answering in its own column with the Data tab retired, which also owns `vg-145`. Tasks 10–11 follow: browser evidence against the built bundle, then the register and the close.
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
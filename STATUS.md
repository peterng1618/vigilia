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

- **Active plan:** the **redesign**, from [authoring a dashboard, not a canvas](docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md). It supersedes [one design, four surfaces](docs/superpowers/specs/2026-10-02-frontend-redesign-design.md), which diagnosed the right thing and then scheduled the fix for it fifth, behind three furniture tasks. Nine plans, sequenced by **what becomes visible**: groups in the starter, the device lens, the per-kind inspector, the composition panel, units alongside primitives, the publish loop, keyboard, player chrome, appearance.
- **The position, and the rule that tests it.** Vigilia is an editor for a phone display that happens to use Fabric. Every decision is judged by one question: *does this remove a step, or does it remove a freedom?* **A card is a fact about the starter, not a rule about themes** — the reference happens to be eight frosted panels; another theme is one photograph and a caption, or two hundred loose shapes. **The device is a lens, not the document** — the artboard keeps whatever dimensions the author chooses.
- **Two cases prove it, both found by driving rather than reasoning.** A quarter-disc bleeding 3/4 off the edge is unconstructible today (no arc in `SHAPE_KINDS`) and the editor does not clip at the artboard, so an author composes against a preview that disagrees with the phone. And the property surface: `settings-fields.ts` is headed "every scalar setting" and mostly is, but `PieSettings.total` and every family's `animation` are unreachable — **filed as `vg-121` and `vg-122`.**
- **Convenience is ordering and grouping, not a smaller surface.** Every authorable setting present, ordered by likelihood, grouped by what it is about, every field with a hint, the obscure ones at the end in a collapsed section. Nothing locked to a default, nothing hidden, and the completeness check is a *test*.
- **KWGT is the reference, not Figma UI3** — the closest thing to this product that exists; its lessons and the one place it is worse than us are in the spec. **The font catalogue plan is on hold**, Task 6 landed and its review failed; its `progress.md` is the resume point.

## Last completed change

- **The lens list is now `ARTBOARD_RATIOS` × `ARTBOARD_ORIENTATIONS` — six previews, derived.** On the owner: *"a few common device aspect ratios, grouped into landscape vs portrait… the author isn't constrained into those."* No second list: `DISPLAY_LENSES` is a `flatMap` over the two owners, so a fourth ratio is a fourth pair of previews with nothing added here.
- **Grouped where both pickers already were.** `displayLensGroups` is the one grouping, read by the display menu (`Menu.Group`) and the new-theme chooser (`<optgroup>`); the artboard's own orientation leads, read through `artboardOrientation`, extracted from `nearestArtboardPreset` so the two cannot drift. A square is not taller than wide and leads with landscape, on the owner's ruling.
- **A portrait id stays the reciprocal, not a second ratio id.** `ArtboardRatioId` is unchanged — widening it would put six shapes into the persisted shape vocabulary for no gain — so `DisplayLensId` is `ArtboardRatioId | Upright<ArtboardRatioId>`, a type-level turn of the same string. Default lens unchanged: 16:9 landscape, still resolved by lookup.
- **Nothing constrains the artboard.** The panel's W/H fields and Custom are untouched, and the new chooser now opens a 4:3 document on the 4:3 preview rather than on Custom — a shape nothing could frame before this change.
- Gates green: typecheck exit 0, biome lint clean, reuse-gate exit 0, **2927 vitest in 205 files**, **8/8 `editor-display.spec.ts`**.

## Next

1. **Plan 3 — the per-kind inspector — is the next work, and it has no plan document yet.** Plans 1 and 2 have landed; 3 through 9 remain. The spec sequences them at `docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md` (~line 473). A fresh session starts by **authoring the plan from the spec**, not by implementing: read `settings-fields.ts` (`CHART_SETTINGS_FIELDS` is the descriptor table the inspector renders from) and `selection-inspector/`, read `docs/architecture/ownership.md` first, and read `vg-121` and `vg-122`, which this plan owns.
2. **Plan 2's acceptance is met and closed.** `vg-046` is `verified` at `b4142af2` on a pixel measurement — the same overhang through the editor and the player for both existing clips, largest disagreement 3.3 scene units, no collision, no repair owed. The workspace is deleted; git is the record.
3. **The plan and spec prose is stale in three places, deliberately.** `docs/superpowers/plans/2026-10-04-the-device-lens.md` lines 137-140 and 169 still name Phone landscape / Phone portrait / Wall panel; the spec's lines 31-32, 269, 289 carry the old device vocabulary. `AGENTS.md` says a plan is annotated rather than rewritten, so this note is the annotation.
4. **The lens changed shape by decision, not only by rename.** Six lenses are now `ARTBOARD_RATIOS x ARTBOARD_ORIENTATIONS` derived, grouped by an `artboardOrientation` predicate lifted out of `nearestArtboardPreset`, and a square takes the landscape group because one predicate is simpler than two.
5. **`vg-129` and `vg-130` are `scene-fabric/src/persist.ts`'s**, one owner: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it.

## Blockers / unverified

- **`vg-135` is diagnosed to a single line and still open.** Not dead rAF and not a leaked mount: a bare `setTimeout(0)` costs **2 ms before** the View-menu click and **58 592 ms after**, and the frames around it are 18 ms. `BASE_UI_ANIMATIONS_DISABLED` and removing the `getAnimations` stub both leave it slow, so those are ruled out. The next step is timing the synchronous span *inside* the click, not around it.
- **`vg-123`, card-to-card snap granularity, is still open.** Measured: a resized part inside a card lands **956.55** aiming at the part line **960** with **0 guide rows**, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts stays the user's.** The 200-shape acceptance probe was not re-run.
- **A Playwright 1.63.0 teardown defect remains unfixed and is not ours to fix**: `browserContext.close: ENOENT … traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`). `use.trace: "off"` removes it and the traces with it; not taken.
- **`vg-116` is ours only as a workaround.** The POSIX drive→volume join is a real defect: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""` and **on macOS and Linux every root volume reports as belonging to no drive** — it passes on Windows only because `C:` has no trailing slash.
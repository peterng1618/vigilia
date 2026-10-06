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

- **`vigiliaBleeds` marks a crop as deliberate; the count and the notice both honour it.** `outsideCount` measured a straddling object's whole rect — right as a measurement, wrong as a verdict, since an author bleeding a quarter-disc was told "1 object outside" by the panel and by a phone.
- **A Fabric custom property, not a `NodeBase` field**, which is the v1 widget tree and reaches no saved theme. Validated beside the name and glass checks; `SceneBox.bleeds` is read once in `sceneBoxesOf`, so the two surfaces cannot drift. Three traps, each found by sabotaging: Fabric drops an unlisted property on save with no error; `false` had to be absence; and a case had to exist **per surface**.
- **A marked group does not speak for its parts**, so a card hanging off the edge reports once per part. A first version suppressed that with the depth watermark; reverted, because it hides a panel genuinely outside the artboard. Open question for the user in ADR-0027.
- **Proved on the real host** with two seeded themes differing in one boolean; Task 4's arc and wedge captured and looked at for the first time. Gates green: typecheck, lint, 2903 vitest in 204 files, 3 host specs.
- **The artboard panel now follows the scene.** It recomputed its figure only on `render()`, so an author marking a bleed saw no change where they read the count. It subscribes to `object:modified` and refreshes the note alone.

## Next

1. **Plan 2's acceptance is not yet met, and two of its items are the plan's, not a task's.** `vg-046` closes only when the artboard clip is **measured** to collide with neither the crop manager's authored per-image clip nor the derived text-box clip — the same overhang put through the editor and the player and compared, because a collision that is not measured is not disproved. The final review confirmed the DOM route avoids the collision in Fabric's source and **that nobody ran the measurement**.
2. **The default lens moved from phone-landscape to wall-panel** in `cb679056`, because the justification for phone-landscape was false — the starter is 1672 × 941, which is 16:9. The plan (line 140) and its Acceptance list still name phone landscape and are now wrong; the plan is a record and should be annotated, not rewritten.
3. **The group/bleed product question is open and is the user's.** A marked card still reports once per part, because a child's box is always inside its group's — so "child outside" and "card overhangs" are the same fact and the plan's protection cannot fire. ADR-0027 records the conditional form the final review proposed and nobody has tried.
4. **`vg-129` and `vg-130` are `scene-fabric/src/persist.ts`'s**, one owner: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it.
5. **Drive the product again.** `vg-139` and the plan's nine second-writer defects were all found by sabotaging, never by reading; the rows still open were read, not driven.

## Blockers / unverified

- **`vg-135` is diagnosed to a single line and still open.** Not dead rAF and not a leaked mount: a bare `setTimeout(0)` costs **2 ms before** the View-menu click and **58 592 ms after**, and the frames around it are 18 ms. `BASE_UI_ANIMATIONS_DISABLED` and removing the `getAnimations` stub both leave it slow, so those are ruled out. The next step is timing the synchronous span *inside* the click, not around it.
- **`vg-123`, card-to-card snap granularity, is still open.** Measured: a resized part inside a card lands **956.55** aiming at the part line **960** with **0 guide rows**, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts stays the user's.** The 200-shape acceptance probe was not re-run.
- **A Playwright 1.63.0 teardown defect remains unfixed and is not ours to fix**: `browserContext.close: ENOENT … traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`). `use.trace: "off"` removes it and the traces with it; not taken.
- **`vg-116` is ours only as a workaround.** The POSIX drive→volume join is a real defect: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""` and **on macOS and Linux every root volume reports as belonging to no drive** — it passes on Windows only because `C:` has no trailing slash.
# Vigilia status

Updated: 2026-10-05
Branch: `claude/superpowers-workflow-cleanup`

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

- **The stage looks through a display, and the display is a lens.** `editor-shell/display-switch.tsx` replaces `zoom-readout.tsx`: one menu offering Fit, the three displays, Zoom to selection and 100 %, opening on a landscape phone. `display-lens.ts` owns the vocabulary and derives each aspect from `ARTBOARD_RATIOS` rather than restating `19.5:9`; `viewport-manager` frames the artboard inside that screen.
- **Review Focus 4 holds, measured.** The serialised scene is byte-identical across every choice and `editor:edit-committed` never fires — checked in the browser with `Date.now` frozen, because the starter's live readings move the document on their own (`51%` became `64%` between two reads).
- **The zoom readout stayed.** The brief says the switch replaces it; putting a display's name on the trigger would have removed the percentage on open, since a display is the default, and two browser specs pin that readout. The display is said by the frame drawn around the stage and by the menu's checkmark.
- **`editor-clip.spec.ts`'s structural assertion moved after its pixels**, per review: it failed on structure under sabotage and never reached them. Re-verified — with the clip deleted the *pixel* assertion fails, which is what the rider was for.
- **`vg-132` still flakes and is not ours.** `editor.spec.ts` "switches chart refresh between 30 and 1 FPS" was red before this change and stayed red.

## Next

1. **Plan 2 continues: the device lens** (`docs/superpowers/plans/`). Tasks 1 and 2 landed — the editor-side clip and the display switch. Task 3 asks a new theme what it is for, and the arc and wedge shapes in `SHAPE_KINDS` are still unconstructible.
2. **`vg-129` and `vg-130` are `scene-fabric/src/persist.ts`'s**, one owner: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it.
3. **`#release` must be read before `Release package`'s verb is decided** — a preserved capability, not a deletable one. It is the last unresolved item from the superseded design.
4. **The catalogue resumes where it stopped**: Task 6's fix round from `task-6-review.md`, clamped badge first, since two tests lock in the wrong behaviour. Task 7 must include the four `data-vigilia-font-face` call sites its report undercounted.
5. **The queued drain is unchanged** and decision-shaped rows are still the user's: vg-023, vg-029, vg-034, vg-035, vg-036, vg-037, vg-040, vg-041, vg-051, vg-056. **`vg-046` drops off this list once player-side parity is measured**, not before — the editor agrees with the phone by construction now, but nothing has put the same overhang in both and compared pixels.

## Blockers / unverified

- **`vg-123`, card-to-card snap granularity, is still open, and now measured.** `snap-manager` enumerates roots. Measured, on the row: a resized part inside a card lands **956.55** aiming at the part line **960** and the card line **700**, with **0 guide rows** — it snaps to nothing, not even to a neighbouring card, while the same gesture between two loose shapes snaps. **Whether parts *should* align to parts is not decided here** and stays the user's. **The 200-shape acceptance probe was not re-run** — it stands on plan 1's run.
- **`vg-131`, `boot-theme.ts` opens whichever theme ran last.** Two live observations, one of them in this pass's own serial run. **Not fixed here deliberately**: the one-line alternative — prefer the starter — deletes the documented round trip that `boot-theme.test.ts` pins, so the row asks for a decision about which store the editor assumes rather than shipping a guess.
- **A Playwright 1.63.0 teardown defect remains unfixed and is not ours to fix**: `browserContext.close: ENOENT … .playwright-artifacts-N/traces/…`, the browser flushing trace files into `tracesDir` after `WorkerHost.onExit` has removed it (`runner/index.js:5478`). It follows worker exit, not assertion failure. Measured this pass: it failed `host-settings.spec.ts:149`, which **passes on its own**, and killed the worker so the file's last 3 tests did not run. `use.trace: "off"` removes it and the traces with it; not taken, and the alternative is not in the runner's API.
- **`vg-115` leaves `src/web/scripts/` ungated for every future agent**, **and `vg-116` is ours only as a workaround** — upstream's registry titles disagree with its own documents in two places. **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive** — it passes on Windows only because `C:` has no trailing slash.
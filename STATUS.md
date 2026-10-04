# Vigilia status

Updated: 2026-10-04
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

- **The display specs saved the wrong document.** `boot-theme.ts` opens the author's most recent save when the URL names no theme, and against the host project's shared store that is whichever fixture ran last — so `Save to library` wrote somebody else's document and the display then asked for `vigilia-demo-dashboard`, which no run had put there. `New from starter` first, and nine host-player failures went with it, including the thumbnail 404 that was reported as its own thing.
- **The asset round trip was never broken; its fixture was.** `editor.spec.ts:2413` replaced a valid PNG with 50 bytes of a truncated one, so the *reopened* document had no image and read as a §75 persistence failure. The saved envelope carries `vigiliaAsset` and no `src`, which is right; Fabric then drops an object it cannot decode. Measured: 60 objects and no image before, 61 and the image after.
- **The e2e harness looks inside groups on the display too.** `canvas-probe.ts`'s reader and `host-player`'s own searches descended roots only, so `cpu-card`, `storage-bar` and every GPU caption read `undefined` for objects the wall was showing.
- **`test.fail` does work on Playwright 1.63.0**, contrary to the prior report: `expected 2, unexpected 0` in `summary.json`. `vg-129`/`vg-130` are recorded as the pinned failures they are, with no change to the marking.
- **A part-level snap measurement for `vg-123`.** A resize of a part inside a card now records which family of lines it joined, as an annotation rather than an assertion — the design question is the user's.

## Next

1. **Plan 2: the device lens** (`docs/superpowers/plans/`), which owns the arc and wedge shapes in `SHAPE_KINDS` and editor-side clipping at the artboard.
2. **`vg-129` and `vg-130` are `scene-fabric/src/persist.ts`'s**, one owner: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it.
3. **`#release` must be read before `Release package`'s verb is decided** — a preserved capability, not a deletable one. It is the last unresolved item from the superseded design.
4. **The catalogue resumes where it stopped**: Task 6's fix round from `task-6-review.md`, clamped badge first, since two tests lock in the wrong behaviour. Task 7 must include the four `data-vigilia-font-face` call sites its report undercounted.
5. **The queued drain is unchanged** and decision-shaped rows are still the user's: vg-023, vg-029, vg-034, vg-035, vg-036, vg-037, vg-040, vg-041, vg-046, vg-051, vg-056.

## Blockers / unverified

- **`vg-123`, card-to-card snap granularity, is still open and still unresolved.** `snap-manager` enumerates roots, so a card snaps to cards but never to a part inside a neighbouring card. A part-level measurement now exists in `snapping.spec.ts` and records which lines a resized part joins; **which family it should join is not decided here** and stays the user's. **The 200-shape acceptance probe was not re-run** — it stands on plan 1's run.
- **`reference-theme.spec.ts`'s frosted-card reading cannot be measured on the surface it reads.** The artboard's background media is a DOM layer *below* the Fabric canvas, so `getImageData` on that canvas cannot see the photograph: a clear-frosted panel measures contrast **0** against a file measuring 7.45. Measured off a capture instead, at this mount: clear-sharp **7.43**, clear-blurred **1.50**, the authored fill **1.07** — every number the test's own header already quotes, so the thresholds were never wrong and the surface was. The probe still reads the canvas and is still red. The same defect is why `host-player`'s display copy of it is red.
- **`FontFace` in jsdom is unverifiable** — jsdom has neither `document.fonts` nor the `FontFace` global, so the specimen cache's suite proves control flow against injected seams and nothing more. Real residency lands in Task 8's browser run, or not at all. **The 261 pinned face URLs are likewise string-shaped; no test contacts jsDelivr.**
- **`vg-115` leaves `src/web/scripts/` ungated for every future agent** (`reuse-gate.mjs:53` resolves its `scripts/` entry against the repo root, matching that directory only; cause established, one owner), **and `vg-116` is ours only as a workaround** — upstream's registry titles disagree with its own documents in two places, and one generator rule stands between the catalogue and shipping a false title. **vg-116 was once dropped from this file by a controller edit and no gate noticed.**
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.
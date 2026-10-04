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

- **A card now maps onto the theme's palette instead of refusing (`vg-128`).** Every card was refused on the host's default two-token palette and on seven of eight on a blank theme — the library was dead where an author meets it first. A reference resolves by exact token, then by role, then by a literal where the format admits one, and every substitution is named through `errorManager`. The refusal survives for a document with no palette at all, which is the case that made it necessary.
- **Entering a group on the canvas expands it in the layer tree.** Derived from the entered context in the projection, not written by the manager, so leaving shuts it again and a group the author opened themselves is never shut behind them.
- **The e2e harness looks inside groups.** One recursive search in `editor-canvas.ts` and one in `editor.spec.ts`, replacing eleven specs that reported `no object with id time-card` for a card the author can see.
- **Four specs were aimed at nothing.** `glass-shapes-visual` used a port this repo never served; `glass-circle-parity` and `glass-shapes-budget` navigated to the *player* and then drove editor affordances, which is why their 240s/300s budgets ran out; `host-player`'s display specs asked the host for a theme nothing in the run had saved.
- **Two vacuous gap pins turned red and were filed as `vg-129`/`vg-130`** — 30 saved text objects carry Fabric's derived `styles` table, and a packaged image saves `crossOrigin`. Both are now marked `test.fail`, which is what their own docblock says it does and which they never did.

## Next

1. **Plan 2: the device lens** (`docs/superpowers/plans/`), which owns the arc and wedge shapes in `SHAPE_KINDS` and editor-side clipping at the artboard.
2. **`vg-129` and `vg-130` are `scene-fabric/src/persist.ts`'s**, one owner: editor-only state reaching a shareable artifact, the same class as the `blob:` src leak beside it.
3. **`#release` must be read before `Release package`'s verb is decided** — a preserved capability, not a deletable one. It is the last unresolved item from the superseded design.
4. **The catalogue resumes where it stopped**: Task 6's fix round from `task-6-review.md`, clamped badge first, since two tests lock in the wrong behaviour. Task 7 must include the four `data-vigilia-font-face` call sites its report undercounted.
5. **The queued drain is unchanged** and decision-shaped rows are still the user's: vg-023, vg-029, vg-034, vg-035, vg-036, vg-037, vg-040, vg-041, vg-046, vg-051, vg-056.

## Blockers / unverified

- **`vg-123`, card-to-card snap granularity, is still open and still unresolved.** `snap-manager` enumerates roots, so a card snaps to cards but never to a part inside a neighbouring card. The two resize specs now resize the card rather than a panel inside it, which is what an author drags; nothing measures part-level targets. **The 200-shape acceptance probe was not re-run** — it stands on plan 1's run: one document, no groups, one viewport, one machine, and it says nothing about a *grouped* 200-shape theme or the phone surface.
- **No row-width measurement was taken in this session.** Every layout number in Task 4 stands on its own run, and re-measuring without `ignoreDefaultArgs: ["--hide-scrollbars"]` would reproduce the 15px error the ledger records. No measurement here needs one, and none is claimed.
- **`FontFace` in jsdom is unverifiable** — jsdom has neither `document.fonts` nor the `FontFace` global, so the specimen cache's suite proves control flow against injected seams and nothing more. Real residency lands in Task 8's browser run, or not at all. **The 261 pinned face URLs are likewise string-shaped; no test contacts jsDelivr.**
- **`vg-115` leaves `src/web/scripts/` ungated for every future agent** (`reuse-gate.mjs:53` resolves its `scripts/` entry against the repo root, matching that directory only; cause established, one owner), **and `vg-116` is ours only as a workaround** — upstream's registry titles disagree with its own documents in two places, and one generator rule stands between the catalogue and shipping a false title. **vg-116 was once dropped from this file by a controller edit and no gate noticed.**
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.
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

- **A repeat's `-2` no longer collides with a genuine `-2` part.** `createWidgetIdAllocator` memoises by key, so a card declaring one id twice *and* carrying a part already named `…-2` put two objects at `card-…-2` — silently, since `nth` is 1 there — and every later save in that session failed. The minted value is now checked against what the copy already issued.
- **Pasting now mints ids through the same allocator the card library uses**, so a pasted rect reads `rect-shape` rather than a uuid and bumps past what the document already holds; two new pins fail when the bump is removed. `createWidgetIdAllocator` has an ownership row, and the seven creation sites that still inline a prefix plus a uuid are named in the map as one job, not two.
- **The `cardBindings` readings limit is stated where a reader meets it.** Only the starter's own four part ids can carry a reading; any other document gets `null` bindings silently. Named in the module docblock and beside the function, because "a duplicated card is still a working card" is a claim about ids everywhere and about readings only in a starter-derived document.
- **`costs no reading` is relabelled a recorded fact, not a pin** — `cardBindings` has no `cpu-card-value-2` entry, so the equality holds under either arm and the mutation cannot touch it. The two real pins at `:564` and `:576` both do catch it.
- **`layer-panel.tsx` no longer claims memoization that does not exist.** `setHovered`/`setFocused` re-render the whole panel; the id-not-boolean choice buys state size and an identity comparison, nothing less.

## Next

1. **`vg-128` is the user's to rule, and this plan introduced it.** Every card is refused on the host's default two-token palette, so the library is unusable where an author most likely starts. Refusing is right — an unresolved reference reaches `snapshot`, which validates and throws. Whether a card should instead *map* onto the theme's palette is a design decision, deliberately not fixed here.
2. **Plan 2: the device lens** (`docs/superpowers/plans/`), which owns the arc and wedge shapes in `SHAPE_KINDS` and editor-side clipping at the artboard.
3. **`#release` must be read before `Release package`'s verb is decided** — a preserved capability, not a deletable one. It is the last unresolved item from the superseded design.
4. **The catalogue resumes where it stopped**: Task 6's fix round from `task-6-review.md`, clamped badge first, since two tests lock in the wrong behaviour. Task 7 must include the four `data-vigilia-font-face` call sites its report undercounted.
5. **The queued drain is unchanged** and decision-shaped rows are still the user's: vg-023, vg-029, vg-034, vg-035, vg-036, vg-037, vg-040, vg-041, vg-046, vg-051, vg-056.

## Blockers / unverified

- **The e2e evidence this plan's merge turned on was destroyed and is being rebuilt.** `src/web/test-results/` held 6 artifacts dated two hours before commit `65843e4e` claimed 47 "survived intact"; a later run overwrote them and the directory is gitignored, so the 37/1/8 split is no longer spot-checkable by anyone. A clean serial HEAD run and a serial run of base `b27cc743` are being taken with artifacts copied out of the tree, and the per-test diff is in the fix report.
- **This box is saturated, and both runners misreport it.** Two of the user's own jest processes have each accumulated ~42,000 CPU-seconds. The superseded parallel figure — "42 failed against 36" — measured a set that shifts with load and is not comparable to anything; only the serial pair counts.
- **`FontFace` in jsdom is unverifiable** — jsdom has neither `document.fonts` nor the `FontFace` global, so the specimen cache's suite proves control flow against injected seams and nothing more. Real residency lands in Task 8's browser run, or not at all. **The 261 pinned face URLs are likewise string-shaped; no test contacts jsDelivr.**
- **`vg-115` leaves `src/web/scripts/` ungated for every future agent** (`reuse-gate.mjs:53` resolves its `scripts/` entry against the repo root, matching that directory only; cause established, one owner), **and `vg-116` is ours only as a workaround** — upstream's registry titles disagree with its own documents in two places, and one generator rule stands between the catalogue and shipping a false title. **vg-116 was once dropped from this file by a controller edit and no gate noticed.**
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.
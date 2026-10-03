# Vigilia status

Updated: 2026-10-03
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

- **Active plan:** the **frontend redesign**, from [one design, four surfaces](docs/superpowers/specs/2026-10-02-frontend-redesign-design.md). The spec is written and reviewed; **planning is the current step.** It decomposes into at least: editor structure, layer panel, keyboard, token system and appearance, save/publish, then display target and player chrome — the editor's phases first, because the rest is judged by whether it serves them.
- **The font catalogue plan is on hold at the user's instruction, not finished.** Task 6 landed and its review **failed** — not approved, not fixed. Its `progress.md` is the resume point.
- **The constraint that governs the redesign: every existing authoring capability is preserved; everything else is free.** The spec carries the full inventory of what the editor does today and where each capability lands, and acceptance is a **walk of that table in a browser, not a diff**. Auditing the first draft against it found three silent losses — the three View settings had no home, `Release package` was written as deletable, and the player's availability reasons would have become click-gated.
- **One defect, four symptoms** is what the observations found: Vigilia has no concept of the display it designs for. A landscape artboard takes 22% of a portrait phone with a LibreHardwareMonitor diagnostic across the top; a phone needs `--host 0.0.0.0` and nothing in the product says so; the layer panel enumerates 52 rows with 165 icons instead of showing a composition; and saving never says where the result went. Reskinning the shell fixes none of them.
- **The frame that still holds:** the editor is **desktop-only** (`tests/e2e/surface.ts`) — the redesign keeps it so. A **phone is the main display type** and the player is the product's face, so the editor's job is to show what that face will look like. The catalogue stays out of the player by construction (`player/src/boundaries.test.ts`).

## Last completed change

- **Portalled popups are themed at last** (`a0784e0`). The palette attribute sat on an inner div while Base UI portals to `document.body`, so every menu rendered with the bare `:root` tokens — a cream popover over a dark shell, on all six palettes. Measured: the popup is now `rgba(11,20,25,0.66)` under graphite, identical to the header's.
- **The scale block is an `@theme` override, not a `:root` rule** (fix `034a2004`). Unlayered beats layered whatever the specificity, so `--text-sm`/`--text-xs`/`--radius-md` on `:root` silently outranked Tailwind's own theme and shipped `text-sm` as 12px on a 14px line height, in three live components. Each `--text-*` now states 1.25, and `@theme **static**` keeps the four tokens nothing references from being dropped at build — plain `@theme` lost them, which is the same resolves-to-nothing defect in a new place.
- **`ember`, `moss` and `plum` have surfaces, edges and text of their own**; they were editorial's byte for byte, so the picker offered four options differing only in a ring. All six palettes are now distinguishable by surface, which a computed-value assertion cannot see — every one of those values was individually legitimate.
- **Editorial's flatness is pinned.** Moving the attribute to `:root` made `:root:not([…editorial])` exclude editorial for the first time — the fix working, recorded by nothing. Pinned on `box-shadow` and `background-image`; **not** on `backdrop-filter`, which an implementer twice reported as a non-discriminator and a re-reviewer then disproved — it computes to `blur(10px) saturate(1.35)` under five palettes and `none` only under editorial.
- **Filed rather than fixed:** `vg-118`, `vg-119`; and from auditing the property surface, `vg-121` (`PieSettings.total` unreachable — the fixed-total donut the renderer already computes a remainder for) and `vg-122` (`animation` unreachable on every family).

## Next

1. **Plan 1 of the redesign is written and Task 1 is next**: the starter's eight cards become eight groups, in `docs/superpowers/plans/2026-10-03-groups-in-the-starter.md`. The task that carries it is converting children to group-local coordinates — wrapping without converting double-applies the group transform on the first move.
2. **`#release` must be read before `Release package`'s verb is decided** — a preserved capability, not a deletable one. It is the last unresolved item from the superseded design.
3. **The catalogue resumes where it stopped**: Task 6's fix round from `task-6-review.md`, clamped badge first, since two tests lock in the wrong behaviour. Task 7 must include the four `data-vigilia-font-face` call sites its report undercounted.
4. **Task 7's landing site may have moved.** It mounts the picker in the type-preset panel, which the redesign moves into the left column's Document tab. Decide the order when the catalogue comes back.
5. **The queued drain is unchanged** and decision-shaped rows are still the user's: vg-023, vg-029, vg-034, vg-035, vg-036, vg-037, vg-040, vg-041, vg-046, vg-051, vg-056.

## Blockers / unverified

- **This box is saturated, and both runners misreport it.** `npm run test:e2e`: 42 failed against 36 on the clean base, in files the change does not touch, the two sets differing in both directions; `shell-appearance.spec.ts` is 6/6 in both and `snapping` + `glass-authoring` in isolation are 40/41 on base, 41/41 here. Vitest's threads pool wedged four times (once at startup, once at 26s CPU over 29 minutes of wall clock); `--pool=forks` runs the same tests green.
- **`FontFace` in jsdom is unverifiable** — jsdom has neither `document.fonts` nor the `FontFace` global, so the specimen cache's suite proves control flow against injected seams and nothing more. Real residency lands in Task 8's browser run, or not at all. **The 261 pinned face URLs are likewise string-shaped; no test contacts jsDelivr.**
- **A mutation harness that collected zero tests reported as "all mutations survived", and "remove the catch" is a syntax error** — it leaves `try` unclosed, so the mutation never applies and an untouched test looks like a survivor. The spelling that propagates is `try/finally`. Both cost a run on this pass.
- **The held catalogue plan carries two standing issues: `vg-115`** leaves `src/web/scripts/` ungated for every future agent (`reuse-gate.mjs:53` resolves its `scripts/` entry against the repo root, matching that directory only; cause established, one owner), **and `vg-116` is ours only as a workaround** — upstream's registry titles disagree with its own documents in two places, and one generator rule stands between the catalogue and shipping a false title. **vg-116 was dropped from this file by a controller edit and no gate noticed: `status:check` passes on a STATUS.md that has quietly lost a blocker.**
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.
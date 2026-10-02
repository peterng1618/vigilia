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

- **A pane bar replaced the editor's rail** (`e0171079`, fix round `69f371f8`; plan 1 task 1). Three labelled segments and a `+`; the stage gains 60px at the same window size, measured 860 → 920.
- **The shell palette moved to the header**, because the rail's Settings pane held nothing else. It renders a swatch plus the palette name and **carries `aria-label="Shell palette: <current>"`** — the old `<select>` was named, and the trigger had briefly lost it.
- **A collapsed pane no longer loses the author's scroll position.** `choosePane` returned before saving, and a `display: none` element's `scrollTop` getter returns 0, so the later save overwrote the real offset with zero.
- **The pin that caught it is proven to bite.** With the bug present and no browser model, all 19 jsdom assertions passed — a jsdom pin alone would have been green either way. Two pins now: one modelling the hidden box, one in a real browser. The re-reviewer reverted the source and watched the jsdom one fail with `expected +0 to be 499`.
- **Filed rather than fixed:** `vg-118` (palette chip paints a token `ember`/`moss`/`plum` never declare) and `vg-119` (two author-journey e2e suites red since 2026-10-02 and excluded from the Playwright config, so nothing runs them).

## Next

1. **Write the plan from the redesign spec**, in the phase order it names. Nine decisions still sit in the spec's open-argument table and are the author's to make; the rest are settled.
2. **Two preconditions belong to the plan, not to the design.** `scripts/reuse-gate.mjs` decides whether the token-system change needs a note under `docs/decisions/` before its first write, and `#release` must be read before `Release package`'s verb is decided — it is a preserved capability, not a deletable one.
3. **The catalogue resumes where it stopped**: Task 6's fix round from `task-6-review.md`, clamped badge first, since two tests lock in the wrong behaviour. Task 7 must include the four `data-vigilia-font-face` call sites its report undercounted.
4. **Task 7's real landing site may have moved.** It mounts the picker in the type-preset panel, which is inside the left column's Document tab after the redesign. Decide the order when the catalogue comes back.
5. **The queued drain is unchanged** and decision-shaped rows are still the user's: vg-023, vg-029, vg-034, vg-035, vg-036, vg-037, vg-040, vg-041, vg-046, vg-051, vg-056.

## Blockers / unverified

- **`FontFace` in jsdom is unverifiable** — jsdom has neither `document.fonts` nor the `FontFace` global, so the specimen cache's suite proves control flow against injected seams and nothing more. Real residency lands in Task 8's browser run, or not at all. **The 261 pinned face URLs are likewise string-shaped; no test contacts jsDelivr.**
- **A mutation harness that collected zero tests reported as "all mutations survived", and "remove the catch" is a syntax error** — it leaves `try` unclosed, so the mutation never applies and an untouched test looks like a survivor. The spelling that propagates is `try/finally`. Both cost a run on this pass.
- **vg-115 leaves `src/web/scripts/` ungated for every future agent** — `reuse-gate.mjs:53` resolves paths against the repo root, so its `scripts/` entry matches the repo-root directory only. Filed, cause established, one owner.
- **vg-116 is ours only as a workaround**: upstream's registry titles disagree with its own documents in two places, and one generator rule stands between the catalogue and shipping a false title.
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.
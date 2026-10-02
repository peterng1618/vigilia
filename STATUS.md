# Vigilia status

Updated: 2026-10-02
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

- **Active plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md), 8 tasks. **Tasks 1–3 are landed and reviewed** (generate the catalogue, serve it from `font-catalog.ts`, the multi-face specimen cache); Task 4 is next. The plan supersedes the author-journey drain, whose 22 open rows stay queued in `docs/product/backlog.jsonl` — that file is the register, and it is not stale.
- **Six rulings came out of reading the plan against the code and against live upstream, and two are live product facts.** The catalogue is **379 trios and 261 faces**, not the spec's 380/238: 379 because upstream's index lists `playfair-display-roboto` twice with one entry titled for a family it does not seed, and 261 because a heading is clamped to the pairing's own `h1` weight rather than a uniform 700. **Ten faces are not OFL** — 7 UFL-1.0 and 3 Apache-2.0, reaching 15 pairings — so `THIRD-PARTY-NOTICES.md` is under-declared until Task 8.
- **The rule this plan earned: a controller's instructions are hypotheses, and every one handed to an implementer was wrong on the merits.** Five were caught by re-derivation, not transcription: 380 vs 379, 1140 vs 1137, 141 vs 146, `fontTrios()[0]`'s identity, and a requested assertion that **could not exist** because a trio holds one face per role so no comparator assertion can fail. **Tell implementers to report a disagreement rather than defer, and check that each new assertion can actually fail before believing it.**
- **Two failure modes were invisible to green suites, and both are the reason the review loop exists.** A `clamped` flag cached on first touch made 9 of 380 trios lie about their weights and marked a body face as a clamp; a licence guard bypassable by `LICENSES["constructor"]` emitted all 261 faces with **no `license` field at all** and exited 0. Neither threw.
- **The frame that matters:** the editor is **desktop-only** (`tests/e2e/surface.ts`); a **phone is the main display type** and the **player is the product's face**. The catalogue stays out of the player by construction — `player/src/boundaries.test.ts` refuses any import path into `@vigilia/editor`.

## Last completed change

- **The specimen cache holds many faces at once and fails without taking the picker down with it** (`font-specimen-cache.ts`, 14 tests). `ensure` always resolves — a fetch that throws, a body that will not read, a payload `FontFace` rejects — and `resident()` is how a caller finds out; the interface comment now says so, because Task 7 wires rows against it.
- **The `catch` had never executed.** Every tested failure *returned* before the risky steps, so only a throw reached it, and the realistic browse-time failures all throw. The one path the whole fallback design rests on had no coverage; it now has one test per source, proven distinct by message-selective rethrow.
- **What the cache hands `FontFace` is pinned** — family, weight, style and bytes per face. Handing every row one family renders all 261 specimens identically while each still reads as resident, so nothing anywhere would have failed.
- **Suite 2595 across 188 files, 0 failures; typecheck, lint and format clean.** Every assertion in this plan's new tests has been watched red against a targeted break.

## Next

1. **Tasks 4–8:** filter/facet/sort the catalogue, favourites in the host, the picker itself, mounting it in the type-preset panel, and the browser proof that closes the documentation.
2. **Task 8 carries two open obligations from earlier tasks:** `THIRD-PARTY-NOTICES.md` must declare all three licences, and **`editor-type-preset` must be re-captured, not annotated** — the CDN stub means its ink was always a fallback, but at 400 it looks closer to correct than at 700, so a reader could conclude the face applied when it did not.
3. **`editor.spec.ts` has never been run in any round of this plan.** It is stubbed at the CDN, so no face URL is proven reachable; that closes in Task 8 or not at all.
4. **The queued drain is unchanged** and decision-shaped rows are still the user's: vg-023, vg-029, vg-034, vg-035, vg-036, vg-037, vg-040, vg-041, vg-046, vg-051, vg-056.

## Blockers / unverified

- **`FontFace` in jsdom is unverifiable** — jsdom has neither `document.fonts` nor the `FontFace` global, so the specimen cache's suite proves control flow against injected seams and nothing more. Real residency lands in Task 8's browser run, or not at all. **The 261 pinned face URLs are likewise string-shaped; no test contacts jsDelivr.**
- **A mutation harness that collected zero tests reported as "all mutations survived", and "remove the catch" is a syntax error** — it leaves `try` unclosed, so the mutation never applies and an untouched test looks like a survivor. The spelling that propagates is `try/finally`. Both cost a run on this pass.
- **vg-115 leaves `src/web/scripts/` ungated for every future agent** — `reuse-gate.mjs:53` resolves paths against the repo root, so its `scripts/` entry matches the repo-root directory only. Filed, cause established, one owner.
- **vg-116 is ours only as a workaround**: upstream's registry titles disagree with its own documents in two places, and one generator rule stands between the catalogue and shipping a false title.
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.
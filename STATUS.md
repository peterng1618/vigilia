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

- **Active plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md), 8 tasks. **On hold at the user's instruction, not finished.** Tasks 1–5 are complete and reviewed; Task 6 is landed and was mid-review; Tasks 7–8 were never dispatched. The ledger at `.superpowers/sdd/2026-09-27-font-trio-catalog/progress.md` is the resume point — read it before this file.
- **Six rulings came out of reading the plan against the code and against live upstream, and two are live product facts.** The catalogue is **379 trios and 261 faces**, not the spec's 380/238: 379 because upstream's index lists `playfair-display-roboto` twice with one entry titled for a family it does not seed, and 261 because a heading is clamped to the pairing's own `h1` weight rather than a uniform 700. **Ten faces are not OFL** — 7 UFL-1.0 and 3 Apache-2.0, reaching 15 pairings — so `THIRD-PARTY-NOTICES.md` is under-declared and stays that way until Task 8 runs.
- **The rule this plan earned: a controller's instructions are hypotheses, and every one handed to an implementer was wrong on the merits.** Caught by re-derivation, never by transcription: 380 vs 379, 1140 vs 1137, 141 vs 146, `fontTrios()[0]`'s identity, a requested assertion that **could not exist** (a trio holds one face per role, so no comparator assertion can fail), and two claims a *reviewer* refuted after I asserted them. **Tell implementers to report a disagreement rather than defer, and check each new assertion can actually fail.**
- **Three defects were invisible to green suites, which is why the review loop exists here.** A `clamped` flag cached on first touch made 9 of 380 trios lie about their weights and marked a body face as a clamp; a licence guard bypassable by `LICENSES["constructor"]` emitted all 261 faces with **no `license` field at all** and exited 0; a record shipped titled "Playfair Display Inter" carrying Roboto faces. None threw. Four gates were reported green and were red.
- **The frame that matters:** the editor is **desktop-only** (`tests/e2e/surface.ts`); a **phone is the main display type** and the **player is the product's face**. The catalogue stays out of the player by construction — `player/src/boundaries.test.ts` refuses any import path into `@vigilia/editor`.

## Last completed change

- **The picker is built** (`font-picker/font-picker.tsx`, 29 tests, `21b86b1a`) — searchable, faceted, virtualised at 15 rows against 261 faces, each specimen rendering in its own family. It found a real bug in itself: a `query` object literal rebuilt every render, so the memo never cached and the loading effect re-ran every render — a 23-minute hang, caught by chasing it rather than calling it flaky.
- **Two rulings kept the brief from shipping defects the repo had already solved.** The favourite toggle is a `lucide-react` `Star` with `aria-hidden` and a real label, not the brief's `★`/`☆` glyph as an accessible name — `layer-panel.tsx:30-33` records that finding once already. And the picker is Tailwind utilities, not the brief's new `.css` file.
- **Task 5, the host favourites store, approved first pass** — 18 anchored mutations, each sha256-verified before running. It lives in `settingsDir` beside `display.ts` and now diffs against it showing three differences.
- **Task 4's facet cap was exported for a test that never reads it.** The two assertions that read the constant were the two tautological ones; the reviewer refuted the export's own justification with the implementer's own fix.

## Next

1. **Resume at Task 6's review verdict**, in `task-6-review.md`. Task 6's code was never touched by it, so closing Task 6 depends only on those findings.
2. **Then Tasks 7 and 8:** mounting the picker in the type-preset panel, and the browser proof that closes the documentation.
3. **Task 8 carries obligations from every earlier task:** `THIRD-PARTY-NOTICES.md` must declare all three licences; the spec's facet sentence must be amended against vg-117; and **`editor-type-preset` must be re-captured, not annotated** — the CDN stub means its ink was always a fallback, but at 400 it looks closer to correct than at 700.
4. **The redesign may moot some of this.** A frontend redesign design is written and awaiting plans — [one design, four surfaces](docs/superpowers/specs/2026-10-02-frontend-redesign-design.md), from driving the editor, host and player at 1512×900 and 390×844 — and it is **not** the active plan; the catalogue still is. Tasks 6–8 touch the type-preset panel, which is exactly what a redesign would replace, so **whether to finish this plan or plan the redesign first is the user's call, and it should be made before Task 7 starts.**
5. **The queued drain is unchanged** and decision-shaped rows are still the user's: vg-023, vg-029, vg-034, vg-035, vg-036, vg-037, vg-040, vg-041, vg-046, vg-051, vg-056.

## Blockers / unverified

- **`FontFace` in jsdom is unverifiable** — jsdom has neither `document.fonts` nor the `FontFace` global, so the specimen cache's suite proves control flow against injected seams and nothing more. Real residency lands in Task 8's browser run, or not at all. **The 261 pinned face URLs are likewise string-shaped; no test contacts jsDelivr.**
- **A mutation harness that collected zero tests reported as "all mutations survived", and "remove the catch" is a syntax error** — it leaves `try` unclosed, so the mutation never applies and an untouched test looks like a survivor. The spelling that propagates is `try/finally`. Both cost a run on this pass.
- **vg-115 leaves `src/web/scripts/` ungated for every future agent** — `reuse-gate.mjs:53` resolves paths against the repo root, so its `scripts/` entry matches the repo-root directory only. Filed, cause established, one owner.
- **vg-116 is ours only as a workaround**: upstream's registry titles disagree with its own documents in two places, and one generator rule stands between the catalogue and shipping a false title.
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.
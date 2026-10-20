# The Backlog Drain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 22 register rows the reproduction pass proved discharged, take the 104 rulings the register is waiting on, and do the 109 rows of real work — leaving `docs/product/backlog.jsonl` smaller and the repo's gates owning what they claim.

**Architecture:** The work is one active plan of eleven phases. Two phases are process — the close procedure and the ruling sessions — and nine are the spec's W1–W9 candidates in §6's order. Every phase edits the register by line, never by parse-and-reserialise, and every close is proved by the register's own checker (`scripts/backlog-check.mjs`) before the row moves.

**Tech Stack:** Node 22–26, Vitest 5, Playwright 1.63, Biome 2.5, TypeScript 7, `src/web/` npm workspace. The register is JSONL under `docs/product/`. No new dependency is added by this plan.

**Spec:** `docs/superpowers/specs/2026-10-12-the-backlog-drain-design.md` — read it with this plan. Its §2 is the coverage arithmetic, §3 is List A (the 22 closes), §4 is List B (the 104 rulings, clusters D1–D11), §5 is List C (the 109 work rows, candidates W1–W9), §6 is the parallelism table, §7 is the browser follow-up's 49 rows, §8 is fifteen corrections, §10 is the drain's instruction list, §11 is what it did not verify. Per-row evidence is not here and not there: it is `docs/product/triage/triage-B1.md` … `triage-B6.md`.

## Global Constraints

- Superpowers owns the workflow. Exactly one implementation plan is active and this is it. `STATUS.md` names the active plan; `.superpowers/sdd/` holds execution state.
- The drain opens no second spec or plan directory, and builds no parallel process.
- Register files: `docs/product/backlog.jsonl` holds what can still be worked; `docs/product/backlog-archive.jsonl` holds `verified` and `withdrawn`. A row leaves the live file the moment it reaches a closed state.
- Register edits are **by line**. Never `JSON.parse` → `JSON.stringify` a register file: a round-trip reformats the spacing on 191 of the 237 rows (`"id": "vg-023"` → `"id":"vg-023"`), so a one-line edit lands as a whole-file diff. Write LF; `.gitattributes` sets `* text=auto eol=lf`.
- The archive is **grepped before filing, not browsed** — the anti-double-report record, not a browse target. Two readers are named and bounded: Task 4.1 makes `scripts/backlog-check.mjs` read it under the live file's rules, and a close's proof reads it scoped to the ids that just closed (Task 0.4 Step 3). A human still greps it.
- A `verified` row needs **both**: a `check` naming a word of its own `title` (`scripts/backlog-check.mjs:63-76` `wordsOf`, comparison at `:124-131`), and `artefacts` as an **array** of shas that each resolve (`git cat-file -e <sha>^{commit}`) and are ancestors of HEAD (`git merge-base --is-ancestor <sha> HEAD`). A bare string instead of an array is read as "no artefact".
- `wordsOf` drops words of 3 characters or fewer, a NOISE list and a VERB list, and stems a small plural list (`charts`→`chart`). A check and a title must share at least one surviving word.
- **Every step that reads "`npm run gate`, then commit" also runs `npm run typecheck`, and a close names both commands with their exit codes.** `gate` is `biome check .. && gates:self-test && design:check && test`, and `test` is `vitest run`, which transpiles without checking types — so **`gate` exits 0 over source the repo's own compiler rejects** (`vg-455`, filed 2026-10-14, carried by no phase). Measured 2026-10-15 against `src/web/package.json`, not inferred from the name. The consequence is not hypothetical: this plan already carries two phases (`5`, `6`) whose close read green while the repo's gate was red, and a type error is the same shape of miss. When `vg-455` lands and `gate` gains the step, this bullet goes.
- W1 owns the fixed preview ports **4173/4174**. One suite at a time; a second concurrent suite produces *false* results, not slow ones. `--workers=1` throughout.
- Browser tests preview **built** bundles: rebuild affected bundles after every source change and after reverting a deliberate break.
- Screenshots need `VIGILIA_CAPTURE=1` and `--workers=1`; they are evidence, not golden files. Only captures registered in `docs/evidence/screenshots/README.md`.
- `STATUS.md` is **replaced**, not appended: ≤6/5/5/5 bullets across active work, last completed change, next and blockers, one item per line, never wrapped. `npm run status:check` from `src/web/`.
- Conventional Commit titles. Stage explicit paths — never `git add -A`, never `git commit -a`. No licence headers in source. 500 lines is a signal and 800 a stop for normal source files.
- The bug rule (`AGENTS.md`): file an issue when the cause is not established, more than one owner could fix it, the fix needs a design decision, it spans subsystems, it blocks the active plan, or it would need a spec; fix on the fly only when the cause is named `file:line`, the fix sits inside one owner, the behaviour is already specified and a regression test is obvious. Filing rides the commit being written, as a `Discovered, not fixed:` trailer.
- `§N` markers are stable and never renumbered; `design:md --cite` fails on a citation naming a number with no marker.
- A verdict this pass reached on live source is not re-opened. Where a row's prose contradicts the source, the source wins (§10 step 5).
- **The spec's own id lists are the authority**, not the older reproduction plan's (§2.2): its lists covered 216 rows and two of those are no longer open. This plan's row lists come from §3, §4 and §5. If a list and the register disagree, re-derive membership the way §2 did — sort the open ids and cut — and say so, rather than trusting either document's prose.
- Scratch files live outside the tree (a sibling temp directory, e.g. `%TEMP%\vigilia-drain\`), never in `D:\git-repos\vigilia`.

## Review Focus

Failure modes this plan's tasks must each pin with a check, most likely first:

1. **A register edit that changes a line it did not mean to.** A whole-file round-trip reformats the spacing on 191 of the 237 rows, and the checker cannot see it — it parses the rewritten file happily. Pinned by Task 0.1 Step 4(a).
2. **A row appended to the archive without being deleted from the live file.** The checker reads only the live file *until Task 4.1 lands*, so a duplicate id passes. Pinned by Task 0.1 Step 4 (the live file's one removed line, the archive's one added line, and id-disjointness across both files).
3. **A close whose `check` passes the tokeniser but whose sha is not an ancestor of HEAD** — after a rebase, or on a branch that was never merged. The checker answers this, but only if it is run *after* the move, and its CLI reads only the live file — so the proof imports `check()` and runs it over the **archive** (Task 0.4 Step 3). Literal `HEAD` always resolves and is trivially its own ancestor, so no gate can catch it; exactly one row uses it, deliberately (decision 3, `vg-328`).
4. **A work row implemented before its ruling exists.** §10 step 2 and the brief rule: no row is scheduled before its ruling. Pinned by a gate step in every task that consumes a ruling (Tasks 2.5, 3.1, 4.3, 6.1, 6.2, 7.3, 8.4, 10.1) — a grep for the marker **format** `RULED <YYYY-MM-DD>:` on the rows the task consumes, never for the word `RULED`, which four live rows carry in prose without the marker.
5. **A close reported as a fix when the surface was rebuilt or the defect refuted.** §3.1 is explicit that these are different closes and must not be substituted: `vg-196` carries the sharpest version. Pinned by Task 0.4 Step 5 (the 22 sorted by shape, in the commit and in the report).

---

# The five decisions this plan makes

## 1. Phase order, and what may run beside the active phase

Eleven phases, in this order:

| # | phase | rows | notes |
|---|---|---|---|
| 0 | Close List A | 22 | register only; starts the drain |
| 1 | Take the rulings (D1–D11) | 104 | user sessions; gating clusters first |
| 2 | W1 — browser follow-up | 38 | **alone on the machine** |
| 3 | W2 — the ownership map's filing pass | 10 | one file |
| 4 | W3 — the repo's own gates and scanners | 9 | gated on D1 |
| 5 | W4 — persisted-scene exclusions | 3 | parallel-safe |
| 6 | W5 — manager protocols and single-owner facts | 5 | gated on D8; `vg-364` is a deadline |
| 7 | W6 — test and evidence instrument hygiene | 19 | partly parallel, by file |
| 8 | W7 — one-owner fixes on the editor surface | 19 | parallel-safe, by file |
| 9 | W8 — structural stops and the plans directory | 4 | parallel-safe |
| 10 | W9 — the unowned mockup-parity plan | 2 | gated on D4 and D3/D6 |

**Thirteen phases were added after that table was written, so the table records the order rather than the
count**: Phase 12 (the 2026-10-14 rulings no phase carried), Phases 13 and 14 (the user's 2026-10-14
GUI list, items 1–9 and 10–18), and **Phases 15, 16 and 17, which are the phases the triage's own
verdicts named** — the `# The rows no phase carries` section rules that a triaged row is fixed *in a
phase named here*, withdrawn or parked, so the rows a measurement pass returned as real work became
Phase 15 (nine instrument gaps), Phase 16 (eighteen behaviour findings) and Phase 17 (the eighteen the
first two left standing). All three are authored from measurements taken on 2026-10-16 rather than from
titles.

**Phases 18 to 23 are the second half of that same rule, and they are authored from the rulings rather
than from measurements**, because the rows they home already carry one. The triage's first pass read the
90 rows no phase named; the second read the **51 rows whose only carrying phase is Phase 1** — a row with
a decision and no phase that will land it, which the census's fourth correction is what made visible.
Each of the 51 was triaged by reading what it was *ruled* to be, and the verdicts came out three ways:
**three closed** (`vg-111`, `vg-256`, `vg-315` — their own rulings ask for no change, so applying a ruling
already taken is not new work), **one whose ruling does not hold** (`vg-163`, whose premise was read
against a file the row never cited — the correction is on the row and its fix is Task 19.5), and **47
homed in six phases grouped by owner**: Phase 18 (twelve, the editor's control set and shell), Phase 19
(six, the surfaces), Phase 20 (seven, tokens and drawings), Phase 21 (six, the repo's own instruments),
Phase 22 (seven, proofs and test configuration) and Phase 23 (ten, the host, the schema and the records).
**Every task in them cites its row's own ruling, and the ruling names the owning symbols** — which is what
separates a phase authored from a measurement from the phase this plan's census explicitly forbids, the
one that carries rows because they exist.

**Phase 24 is the last of the thirteen and the only one whose order is not its number.** It carries the two
`source: user` rows no phase named — `vg-388` (an in-app store) and `vg-405` (the colour picker and the
gradient editor) — and **the user's own ruling puts them ahead of everything the triage touches**:
`vg-405`'s is *"SCHEDULED AHEAD OF THE TRIAGE, and it enters a phase … It and `vg-388` are the two
user-sourced rows among the 95 and both move ahead of the rest."* So it runs **ahead of Phases 15–23 and
behind Phase 12**, and both its tasks are gated on their own spec's acceptance rather than on a
measurement: each row's own text says it takes its own spec and plan rather than a task inside another.

**Rulings open first, work opens at W1.** The close phase precedes everything because it needs no build, no suite and no ruling, and because it is where the register mechanics are exercised before 100+ rows depend on them. The ruling phase precedes the work phases for one reason: D8 gates W5, D1 decides whether W3's gates count, and D4/D3/D6 gate W9. A work phase whose gating cluster is unanswered stays queued — do not start it and hope.

**One phase is active at a time.** Inside a phase, tasks run as parallel seats only to the width the spec's §6 fit column allows: W4, W7 and W8 are one-owner-per-row and can host several seats; W3 and W6 are **partly** — one seat per file, because `backlog-check.mjs`, `design-tokens.mjs`, `ui-copy.test.ts` and `design-md.mjs` each serialise. W1, W2, W5 and W9 are one seat.

**Two exceptions, both narrow.** (a) Register-only bookkeeping that starts no suite — a remaining close, a `§8` correction applied to a row's line — may be done during any phase. (b) **Nothing that builds or drives Playwright runs during Phase 2.** W1 owns 4173/4174 and a second suite there produces false results; a vitest-only task in another phase is a judgement call the active-phase rule already forbids, so the rule stands as stated. W7's `vg-304`/`vg-320` are vitest (`tests/e2e/mockup-values.test.ts`) and still wait for Phase 2 to finish, because they are Phase 8's.

**The eight browser-pinned rulings** (`vg-265`, `vg-270`, `vg-278`, `vg-306`, `vg-308`, `vg-310`, `vg-319`, `vg-324`) cannot be answered without a run, and their runs are Phase 2's. They are ruled at Phase 2's close, in a Phase 1 follow-up session — Phase 2 produces readings, never rulings.

## 2. Where the 104 decisions live, and how one is taken

The decisions are **the register's own rows**. There is no second decision document, no rulings file, no cluster table to keep in sync. D1–D11 are a grouping for the session's agenda, not storage: §4 is explicit that a cluster's lead ruling settles only the members sharing it (D1's covers five of its nine), so the row is the unit.

- **The question asked** is the triage table's decision-question column (`triage-B1.md` … `triage-B6.md`) — or, for a cluster, §4's `the choice` cell plus the row's own sentence.
- **How taken:** one user session per group of clusters (Task 1.2–1.5), led by the cluster's lead question where there is one, then each non-sharing member as its own question. **Never ask eleven questions and call 104 rows done.**
- **Where recorded:** append `RULED <YYYY-MM-DD>: <the answer in the user's words>` to that row's `detail`, **by line**, as its own sentence. The row's `state` does **not** change when the ruling is taken — the ruling authorises a change that has not landed yet.
- **When it closes:** when the change the ruling authorises lands, on the work phase that did it, as `verified` (check + artefacts) — or `withdrawn` where the ruling was that the row should not exist (D9's `vg-109` is the type case; a `withdrawn` row needs no `check` and no `artefacts`).
- **What counts as ruled:** the marker **format** `RULED <YYYY-MM-DD>:`, not the word `RULED` — four **live** rows say the word in prose without the marker (`vg-040`, `vg-195`, `vg-220`, `vg-225`; the seven in the archive that carry it are closed `verified` or `withdrawn`, so whatever their prose says is already settled), and the twelve rulings recorded on 2026-10-12 carry the format itself, normalised to it by Task 1.1's pre-pass after being written as `RULED <date> by the user, …`. The 104 are pre-passed before any session (Task 1.1 Step 2), and a row whose `detail` already answers its own question is not asked again. **Two rows look answered and are not, and both are asked.** `vg-225`'s `RULED to stand by …` settles that the finding is not a nit, not which of the two options its triage question poses. `vg-040`'s `RULED: draft in browser storage` is conditional in its own next clause — `BLOCKED: the asset-ownership question decides where the draft lives` — and its evidence records that decider as unresolved (`triage-B1.md:21`: the asset-ownership spec is `Status: backlog`), so it is a confirmation or a change, not a fresh question, and it is still asked. The other two bare-word rows are not decision rows and no session asks them (`vg-220` is Task 7.4's, `vg-195`'s is a mention of the user's Base UI ruling). [Annotated 2026-10-13: **`vg-220` is no longer live** — Task 8.2a closed it `verified` under the ruling its own text carried ("acceptable as landed, not a defect"), which the controller re-ratified and normalised to the marker format. A session that reads this sentence looking for it will find it in the archive. `vg-195` remains live and unasked.] The marker rule is what made the two visible; the correction is recorded here because this sentence is what a session reads before deciding to skip a row.
- **The refusal is the marker, not the word.** `rule-row.mjs` refuses a second `RULED <YYYY-MM-DD>` on a row that carries one, and prints a notice — not a refusal — when the bare word `RULED` is already present, because the two bare-word rows the sessions ask (`vg-040`, `vg-225`) must not be blocked. A session that meets that notice confirms the row is not answered before proceeding.
- **A row with no ruling is not scheduled.** Every work phase that touches a decision row lists it and greps that row's line for the marker format before starting that task.

## 3. The close procedure, as steps that produce text the checker accepts

Run once per row. Nothing here is editorial; every step is mechanical.

1. **Name the shape** from §3.1 — `fixed`, `refuted`, `surface rebuilt or deleted`, or `discharged by a document or a ruling`. Record it in the commit body. A rebuilt surface is not a fix.
2. **Find the sha.** A row whose §3 table cell already names a commit keeps it (verify it in Step 4 anyway). For the 14 with none, `git log -1 --format=%h -- <path>` over the path in the table's artefact column — and note that `git log` exits 0 with **empty** output for a path that does not exist, so empty is a failure and never written as an `artefacts` entry. `vg-169` carries **two** commits (`2eeb4516`, `b0e2eb73`), so the field takes a list. **`vg-328` has no path** — its artefact cell says "the row's own `detail`", which is not a commit and cannot be one before the close it describes. Its `artefacts` is the literal string `HEAD`: the value `scripts/backlog-check.mjs`'s own self-test passes as its valid positive case, which resolves and is trivially an ancestor of itself. **That one row's artefact is a formality, not a proof — `HEAD` names no commit, and the row's real evidence is the user's ruling recorded in its own `detail`.** No other row may use it, and a close that cannot produce a resolvable ancestor is not a close.
3. **Write the `check`.** Take the §3 table's third column **verbatim**, with one exception: for `vg-113`, `vg-115`, `vg-137`, `vg-169`, `vg-217` and `vg-235`, take §3.2's `write the check as` cell verbatim instead, because the printed text shares no tokenisable word with those rows' titles. **Six rows are reworded; the other sixteen (including `vg-309`, which joined List A by §8.14 after §3.2 was written) pass as printed.** §3.2's arithmetic originally read "the 21 checks", "15 pass", "thirteen with none", because it predated `vg-309`'s move; the spec was corrected on 2026-10-12 to **22 checks, 16 pass, 6 reworded, 14 without a sha**, which the plan's own re-run of `wordsOf` over the List A table confirms.
4. **Prove it before writing it.** `scripts/backlog-check.mjs` exports `parse(text) -> {items, problems}` and `check(items) -> string[]`; `check` returns the problem list and an empty array means valid. `wordsOf` is **not** exported — do not try to import it, use `check([row])`, which also runs the git sha checks. Never eyeball a check.
5. **Move the line.** Rewrite that one line's text and move it between the two files, by line, per §5 below. Then `npm run backlog:check` from `src/web/`.

## 4. Where §8's fifteen corrections attach

Each correction attaches to **the task whose row list names the corrected row**, and is applied to that row's line at the moment the drain closes or works it. Never as a separate pass, never as a new row, never twice. **A correction to a row that is closing is applied before the move**, in the task that closes it, so the archived line is right the first time — that is where `vg-206`, `vg-231` and `vg-328` belong.

| §8 | applies to | applied at |
|---|---|---|
| §8.1 | `vg-140`'s sha becomes `ad94e5ed` | Task 0.2 Step 3 |
| §8.2 | `editor-shell.css` line numbers stale in every citing row — 25 live rows cite one | each row's own task, before it closes: Task 0.2 Step 3 (`vg-206`, `vg-231`); **Task 0.3 Step 2 (`vg-217` — a Task 0.3 row, not one of Task 0.2's 16)**; Task 1.3 Steps 1–4 (D3/D4/D5/D6); Task 2.3 Step 4 (`vg-296`, `vg-313`, `vg-314`, `vg-325`); Task 2.4 Step 4 (`vg-280`, `vg-316`); Task 8.3 Step 3 (`vg-224`); **Task 10.3 Step 2 (`vg-292`)** |
| §8.3 | four collapses — `vg-268`/`vg-283`; `vg-291`/`vg-292`/`vg-293`; `vg-166`/`vg-329`(+`vg-199`); `vg-041`/`vg-188` | applied **once**, at the first member: Task 1.3 Step 5 and Task 1.4 Step 1 — **both applied 2026-10-16**, with the ruling left where it already sat (`vg-268` for the first pair, `vg-041` for the second) and both rows of each pair marked as one question; Task 10.3 Step 1, Task 4.1 Step 1 |
| §8.4 | `vg-329`'s title counts **rows**: **11** `verified` rows carry no valid `artefacts` array — **8** of them as a bare string, `vg-303` among them — where **126** hold one. The **14** is the checker's *problem* count and belongs in Task 4.1's table, not in this sentence; the "15" counts rows with no `artefacts` key across **both** states, and 12 of those are `withdrawn` rows that need none | Task 4.1 Step 7 |
| §8.5, §8.8 | `vg-235`'s census verdict is stale | Task 0.3 Step 2 |
| §8.6 | `vg-320`'s identifier is `RADIUS` at `design-language.spec.ts:2887` | Task 8.1 Step 2 |
| §8.7 | ~~six tracked `.superpowers/sdd/` citations, not four~~ **REFUTED 2026-10-16: the replacement is unverifiable and the count is the wrong instrument.** The row's four is a hand census of four *different* workspaces; a grep for the string returns 25 tracked files, which measures files that *mention* `.superpowers/sdd` rather than documents citing an ignored workspace as evidence. Neither number is the row's, and the row is about a capability rather than a total — the sites are named, no total asserted | Task 1.5 Step 4 (`vg-315`) — **the annotation is applied; the count correction is withdrawn** |
| §8.9 | drifted counts in `vg-262`, `vg-276`, `vg-283`, `vg-199`, `vg-204`, `vg-210`, `vg-284`, `vg-274` | Task 1.2 Step 1 (`vg-262`); Task 9.1 Step 4 (`vg-276`); Task 1.3 Step 5 (`vg-283`); Task 4.1 Step 1 (`vg-199`); Task 2.4 Step 4 (`vg-204`, `vg-210`, `vg-284`); Task 1.3 Step 3 (`vg-274`) |
| §8.10 | ~~`vg-252`'s premise is half-false, the defect is live~~ **REFUTED 2026-10-16 and WITHDRAWN — applying it would write a false statement.** The row's detail measures the opposite of this cell's premise ("the predicate gates EVERY action the shortcut table binds, so Delete, Escape and the rest are swallowed too", verified at source by the controller), and the row's own ruling agrees, going further: the predicate is wrong in *kind*, so what is wrong is which keys a target defers, not how broad the deferral is. The title is accurate as written | Task 1.4 Step 2 — **not applied, deliberately; there is nothing here to correct** |
| §8.11 | stale **owner** paths, in `vg-104`, `vg-109`, `vg-155`, `vg-333`, `vg-314`, `vg-328`, `vg-301`, `vg-235` — measured 2026-10-16 **across all eight and discharged**: every `owner` field resolves, so on `vg-109` and `vg-301` the cell's premise never held and both carry that as a no-drift note; the one genuine mover is `vg-155`, whose prose cited `asset-manager/panel.ts`, deleted by `c8dc0b1a` when the Add pane absorbed the file section, and `vg-104`'s prose had a `.ts`/`.tsx` slip its `owner` field did not. **A stale citation the gate cannot see**: `scripts/backlog-check.mjs` validates a `check`'s `artefacts` against git but never tests whether a path *inside* a `check` exists, so a check naming a deleted file passes — which is why this row needed a measurement and not a run | **Task 3.1 Step 1 (`vg-104`)**; Task 1.5 Step 4 (`vg-109`, `vg-155`) — **applied 2026-10-16**; Task 7.4 Step 4 (`vg-333`); Task 2.3 Step 4 (`vg-314`); Task 0.2 Step 3 (`vg-328`); Task 1.3 Step 2 (`vg-301`); **Task 0.3 Step 2 (`vg-235` — the same step that takes §8.5/§8.8)** |
| §8.12, §8.13 | `vg-359` and `vg-361` misdescribe their own failures | Task 2.2 Step 5, both on the same pass (the fixes predate the plan — `8a86b2b0` — so this task verifies and closes rather than edits the specs) |
| §8.14 | `vg-309` moved from `work` to `closes` | Task 0.2 Step 3 |
| §8.15 | `vg-296`'s row text carries a stale half | Task 2.3 Step 4 |

## 5. How a row moves between the two register files

By line, byte-level, never through a parse. The scratch helper (Task 0.1) does exactly this and nothing else:

```js
// %TEMP%/vigilia-drain/move-row.mjs — scratch, never committed, never imported by the repo
import { readFileSync, writeFileSync } from "node:fs";
const LIVE = "docs/product/backlog.jsonl";
const ARCHIVE = "docs/product/backlog-archive.jsonl";

// The shas are a list: most rows carry one, vg-169 carries two, a withdrawn row none.
const [id, state, checkText = "", ...shas] = process.argv.slice(2);
const artefacts = shas.filter((sha) => sha !== "");
const live = readFileSync(LIVE, "utf8");
const archive = readFileSync(ARCHIVE, "utf8");
// Both files end with "\n" today. Without it the slice below is wrong, so refuse.
if (!live.endsWith("\n") || !archive.endsWith("\n")) throw new Error("a register file has no trailing newline");

// 1. Find the row's line in the live file by byte offsets, not by parsing it.
const at = live.indexOf(`"id": "${id}"`);
if (at < 0) throw new Error(`${id} is not in the live register`);
const start = live.lastIndexOf("\n", at) + 1;
const end = live.indexOf("\n", at) + 1;
const line = live.slice(start, end);           // includes its trailing "\n"

// 2. Rewrite that one line's text. An unguarded state replace is a silent no-op
//    that deletes the row from live and appends it still open, so assert it lands.
if (!line.includes('"state": "open"')) throw new Error(`${id} is not open — refusing to move it`);
if (state === "withdrawn" && (checkText !== "" || artefacts.length > 0))
  throw new Error("a withdrawn row takes no check and no sha");
if (state === "verified" && artefacts.length === 0)
  throw new Error(`${id}: no sha given — find the closing commit before moving it`);
let closing = line.replace('"state": "open"', `"state": "${state}"`);
// A withdrawn row writes neither field; a verified one needs both, as a list.
const fields =
  state === "withdrawn"
    ? ""
    : `, "check": ${JSON.stringify(checkText)}, "artefacts": ${JSON.stringify(artefacts)}`;
closing = closing.replace(/\}\r?\n$/, `${fields}}\n`);

// 3. Delete the old line, append the new one. Every other byte is untouched.
writeFileSync(LIVE, live.slice(0, start) + live.slice(end));
writeFileSync(ARCHIVE, archive + closing);
```

A `withdrawn` row takes the same path with no `check` and no `artefacts`. `JSON.stringify` is used **only on the new field values**, never on a row, and a replacement value is a value — never a `String.replace` *replacement string*, which would read `$&`, `$'` and `` $` `` in it as patterns. Then `npm run backlog:check`.

---

# Phase 0 — Close the 22 (List A)

**Outcome:** the 22 rows of spec §3 move to `backlog-archive.jsonl` as `verified`, each with a `check` its own title can see and an `artefacts` sha that resolves and is an ancestor of HEAD; the two fresh rows §3.2 requires are filed.

**Owners:** `docs/product/backlog.jsonl`, `docs/product/backlog-archive.jsonl`, `scripts/backlog-check.mjs` (the oracle, not edited here).

**Constraints:** register-only — no source file, no build, no suite. The checker passes *after* each move, never before. `§`, non-ASCII bytes and every other row's text survive byte-identical.

**Acceptance:** `npm run backlog:check` exits 0 with the live file at 215 lines (237 − 22) — or 217 once Task 0.5 files its two fresh rows — and the archive at 171. Every one of the 22 has `artefacts` as an array; `vg-328`'s entry is the literal `HEAD`, a formality whose real evidence is the user's ruling in its own `detail` (decision 3), and the other 21 name a commit.

**Failure modes:** a reworded check written from memory instead of copied from §3.2; a sha taken from a branch; a row appended to the archive but not removed from live.

**Verify:** `npm run backlog:check` over the live file; `check()` over the archive scoped to the 22 ids (Task 0.4 Step 3), which is the only proof that can see a closed row; a cross-file id-disjointness check; `git diff --stat` on the register showing only added/removed whole lines.

### Task 0.1: The close mechanics, proved once against one row

**Files:**
- Create: `%TEMP%/vigilia-drain/move-row.mjs` (scratch, outside the repo)
- Modify: `docs/product/backlog.jsonl`, `docs/product/backlog-archive.jsonl`
- Read: `scripts/backlog-check.mjs`

**Interfaces:**
- Consumes: `check(items) -> string[]` and `parse(text) -> {items, problems}` from `scripts/backlog-check.mjs`
- Produces: `node %TEMP%/vigilia-drain/move-row.mjs <id> <state> <checkText> [<sha>...]` — moves exactly one row, starts no build, and **writes nothing when it cannot do it exactly**

- [ ] **Step 1: Write the helper from the corrected §5 snippet above.** It takes the id, the closing state, the check text and the shas **as a list**; it slices the live file by byte offsets, rewrites that one line and appends it to the archive. It throws, having written nothing, on: a live line whose state is not `open`; a `withdrawn` row given a check or a sha; a `verified` row given no sha; and either file without a trailing newline.
- [ ] **Step 2: Dry-run it against `vg-087`** — the first row of §3, whose check passes as printed. Do not commit; the point is the mechanics. Then run each of the four refusals against a scratch copy and confirm the two files are byte-identical afterwards.
- [ ] **Step 3: Prove the check text before the move.** From a scratch script that imports the checker: `check([row])` must return `[]`. Print the returned problems whatever they are.
- [ ] **Step 4: Run the two structural checks** on the dry run and record their output in the phase report: (a) `git diff --numstat` shows exactly one line removed from `docs/product/backlog.jsonl` and no line added, and exactly one line added to `docs/product/backlog-archive.jsonl` and none removed — the archive half is the other half of the failure mode; (b) the live and archive id sets are disjoint — `grep -o '"id": "[^"]*"' <file>` on each and compare.
- [ ] **Step 5: Revert the dry run** (`cmp` the two files against `git show HEAD:<path>`, not `git checkout` — a Windows text-mode write leaves CRLF that git normalises away).
- [ ] **Step 6: Leave the tree clean.** The helper lives outside the repo and this task commits nothing; `git status` shows no change from the dry run.

### Task 0.2: The 16 closes that pass as printed

**Files:**
- Modify: `docs/product/backlog.jsonl`, `docs/product/backlog-archive.jsonl`

**Interfaces:**
- Consumes: Task 0.1's helper and its `check([row])` proof
- Produces: 16 archived rows

Rows: `vg-087`, `vg-112`, `vg-124`, `vg-140`, `vg-179`, `vg-196`, `vg-206`, `vg-209`, `vg-219`, `vg-229`, `vg-231`, `vg-255`, `vg-300`, `vg-309`, `vg-328`, `vg-349`.

- [ ] **Step 1: For each row, take §3's check text verbatim** and, where the artefact cell names a commit, that commit.
- [ ] **Step 2: Find the missing shas** — `git log -1 --format=%h -- <path>` for the artefact column's path, reading an empty result as a failure rather than as an empty entry. `vg-328` is the exception: its `artefacts` is the literal `HEAD`, per decision 3.
- [ ] **Step 3: Apply §8.1, §8.2, §8.11, §8.14 to these rows' lines — before any of them moves** — `vg-140`'s sha becomes `ad94e5ed`; `vg-206` and `vg-231` take §8.2's `editor-shell.css` line numbers (**not `vg-217`**, which is Task 0.3's row and takes §8.2 there); `vg-328`'s §8.11 owner path is corrected, which matters most because it is the row whose artefact is a formality; `vg-309` enters as a close, not work. §8.5/§8.8 apply to `vg-235`, which is Task 0.3's.
- [ ] **Step 4: Prove each with `check([row])`, then move it, then run `npm run backlog:check`.** A red checker stops the batch and the offending line stays in live.
- [ ] **Step 5: Commit** the closes, `docs(product): close sixteen rows the reproduction pass discharged`, naming the four close shapes this batch covers.

### Task 0.3: The 6 closes that need §3.2's reworded check

**Files:**
- Modify: `docs/product/backlog.jsonl`, `docs/product/backlog-archive.jsonl`

**Interfaces:**
- Consumes: Task 0.1's helper
- Produces: 6 archived rows, and `vg-235`'s §8.5/§8.8 correction applied

Rows: `vg-113`, `vg-115`, `vg-137`, `vg-169`, `vg-217`, `vg-235`.

- [ ] **Step 1: Copy each check from §3.2's `write the check as` cell verbatim.** Do not re-derive, do not shorten. These six are the ones whose printed text shares no tokenisable word with their title.
- [ ] **Step 2: `vg-235` additionally takes §8.5, §8.8 and §8.11, and `vg-217` takes §8.2** — `vg-235`'s census verdict predates `248ff08f` and its owner path is stale, so correct the row's own text, not the census; `vg-217` is this task's row and its `editor-shell.css` line numbers are corrected here, not in Task 0.2.
- [ ] **Step 3: Find the three missing shas** — `vg-113`, `vg-115`, `vg-217` have none in §3.
- [ ] **Step 4: Prove with `check([row])`, move, then `npm run backlog:check`.**
- [ ] **Step 5: Commit** the six, naming §3.2 as the source of their wording.

### Task 0.4: Close out — the file-level proof

**Files:**
- Read: both register files

**Interfaces:**
- Consumes: Tasks 0.2 and 0.3
- Produces: the phase's evidence block

- [ ] **Step 1: Count.** Live lines are 237 − 22 = 215; archive lines are 149 + 22 = 171. Read both from the files, never from this plan.
- [ ] **Step 2: Cross-file disjointness** — no id appears in both files.
- [ ] **Step 3: Prove the closed rows in the archive.** `npm run backlog:check` reads only `docs/product/backlog.jsonl`, so it cannot see a row that has left; it stays as the live file's gate. [True of this phase's tree -- and the line number this step cited is now wrong, `backlog-check.mjs:45` having moved. From Task 4.1 the CLI's register set is both files, so this step's scratch read is no longer the only way to see an archived row.] For the 22, import the checker from a scratch script and run `parse` + `check` over `docs/product/backlog-archive.jsonl`, then print every problem whose id is one of the 22 — none may be, and a problem names both the row and the rule it broke. This does not wait for Task 4.1, and it is the only step that catches a close whose sha is not an ancestor of HEAD.
- [ ] **Step 4: Confirm no other line moved** — `git diff HEAD~<n> -- docs/product/backlog.jsonl` shows only deletions and the same diff for `docs/product/backlog-archive.jsonl` shows only additions, and the `§` count is what it was.
- [ ] **Step 5: Record** the 22 by shape (fixed 8, refuted 3, surface rebuilt 5, discharged 6) in the phase report, and replace `STATUS.md`'s completed-change bullets with the close.

### Task 0.5: The two fresh rows §3.2 requires

**Files:**
- Modify: `docs/product/backlog.jsonl`

**Interfaces:**
- Consumes: Task 0.4
- Produces: two `open` rows filed against the current owners

- [ ] **Step 1: Grep the archive before filing** — `grep -o '"title": "[^"]*"' docs/product/backlog-archive.jsonl | grep -i repaint` and `grep -i funnel`. Neither may already own this finding.
- [ ] **Step 2: File one row for `vg-196`'s residual** — the update loop reaching the canvas may now have no coverage at all. The subject is the coverage, not the deleted spec.
- [ ] **Step 3: File one row for `vg-255`'s residual** — where the write funnel lives and how it reaches the closure state it reads, now that `selection-inspector/index.ts` is below the stop only because the funnel was split out.
- [ ] **Step 4: `npm run backlog:check`**, then **commit** with a `Discovered, not fixed:` trailer only if something else was found and not filed.

---

# Phase 1 — Take the rulings (D1–D11, 104 rows)

**Outcome:** every one of the 104 `decision` rows carries a `RULED <date>:` line in its own `detail`, or is closed as `withdrawn` because the ruling was that it should not exist.

**Owners:** `docs/product/backlog.jsonl` (the rows); the user's rulings; `STATUS.md` for what is queued.

**Constraints:** no implementation is scheduled from a ruling here — the ruling authorises work that a later phase does. Gating clusters first: D1 (gates W3), D8 (gates W5), D4 and D3 and D6 (gate W9). The eight browser-pinned rows wait for Phase 2.

**Acceptance:** each of the 104 rows' own lines carries the marker **format** `RULED <YYYY-MM-DD>:` — 96 from Phase 1, 8 from the Phase 2 follow-up — checked as a **set of ids** per cluster and never as a `grep -c` count, because a count over lines is satisfied by one row ruled twice and another not ruled at all. `npm run backlog:check` exits 0. [**The parenthetical split is corrected 2026-10-16 and does not reproduce.** Measured over both registers: **80 of the 104 carry a `2026-10-12` marker and 24 have their earliest marker later** (2026-10-13, 14 or 15). The `8` is Task 1.3 Step 7's **browser-pinned** list — a count of deferred *runs*, not of markers the follow-up supplied — so the split conflated "eight rows were set aside for a browser run" with "eight markers came from the follow-up". **The operative clause is unaffected and is met**: 104 of 104, per cluster.]

**Failure modes:** treating a cluster as one question and marking its non-sharing members ruled; a ruling recorded in a chat instead of on the row's line; a second ruling appended to a row that already carries one; skipping a row on the bare word `RULED` when its own text says the decision is still open (`vg-040`, `vg-225` — both are asked); a ruling that contradicts a `§N` marker without the marker being amended in the same change.

**Verify:** a per-row grep for the marker **format** — not for the word `RULED`, which four live rows carry in prose today — before any work phase starts; the register checker after every batch.

**Four decisions are already taken, and the sessions record them rather than asking again.** The user settled them on 2026-10-12 and each sits on its own rows as `RULED 2026-10-12:`: **D1's lead** (adopt `biome check` as the gate, with `gates:self-test` chained and the `organizeImports` findings fixed in that commit) on `vg-213`, `vg-262`, `vg-372`, `vg-355`, `vg-379`; **D5** (the ratchet's membership rule) on `vg-228`, `vg-267`, `vg-271`, `vg-274`, `vg-286`; **D4** on `vg-291` (it dissolves into `vg-292`); and **D11** on `vg-368` (`.agent-scratch/` leaves the tree). A session's steps below name them where a step would otherwise read as a question; where a step and this paragraph disagree, this paragraph wins and the step is a defect to fix in the same change.

**Closed 2026-10-16, base `2bcfb14d`.** **The Acceptance is met and was verified the way it asks — as a set of ids per cluster, never as a count.** All eleven clusters are at full strength (D1 9/9, D2 4/4, D3 13/13, D4 7/7, D5 5/5, D6 14/14, D7 12/12, D8 9/9, D9 10/10, D10 12/12, D11 9/9), union **104 of 104** carrying `RULED <YYYY-MM-DD>:`, with `npm run backlog:check` **exit 0** (529 items) and `npm run status:check` **exit 0**.

**The set check is what earned its keep, and a count would have hidden exactly this.** Three rows — `vg-265` and `vg-270` (D6) and `vg-319` (D3) — had been *ruled*, and each carried the ruling's substance, but **not in the marker format**: the sentences lived in the drain's ledger rather than on the row's line, which is this phase's own named failure mode ("a ruling recorded in a chat instead of on the row's line"). Each now carries its `RULED <date>:` sentence transcribed from the ledger's ruling — **no decision was made here, only relocated** — and the cost each ruling recorded if it is wrong is carried across with it. A count would have reported 101 and named nothing.

**How the phase closes, and what is deliberately not claimed.** It closes on its **Acceptance**, which is the contract. **It does not close on its step boxes, because those were never maintained**: every step of Tasks 1.1–1.5 still reads `- [ ]`, including ones whose output demonstrably exists — Task 1.1's deliverables are real (`rule-row.mjs`, `task-1-agenda.md`, `task-1.1-report.md`, ledger §1.1) and the 104 markers are on the rows. The rulings were taken in **batches on 2026-10-12, 14 and 15** rather than in the four numbered sessions, so ticking the boxes would assert a session-by-session record this plan does not have. **A later session must not read those unticked boxes as "unrun"** — read the markers, which are the evidence.

**Three clauses of this phase were wrong and are corrected rather than smoothed over.** The Acceptance's parenthetical split does not reproduce (see above). §8.7's replacement and §8.10's premise were **refuted** by measurement and withdrawn. And **two thirds of §8.11 was refuted**: of its three Phase 1 rows, `vg-109` had never drifted and `vg-301` was already discharged by §8.2, leaving `vg-155` the only genuine mover. The pattern across all of them is one thing — **a correction clause is a claim, and a claim about the tree needs measuring, not applying**.

**One register shape was repaired on the way.** `vg-174`'s `detail` was an **array**, the only such row in 529, and the string readers this very Acceptance uses silently coerced it — which is why two of this pass's probes disagreed about whether that row carried a marker. It is normalised to the shape every other row uses, and the checker's failure to test that field's type is filed as `vg-530`.

### Task 1.1: The ruling mechanism, and the row's own line

**Files:**
- Modify: `docs/product/backlog.jsonl`
- Read: spec §4 (all eleven clusters), `docs/product/triage/triage-B1.md` … `triage-B6.md` decision-sentence sections

**Interfaces:**
- Consumes: Task 0.1's by-line edit discipline
- Produces: `RULED <YYYY-MM-DD>: <answer>` appended to a row's `detail`, one line, applied with `String.replace` on that row's line only

- [ ] **Step 1: Build the ruling helper** beside `move-row.mjs`, same scratch directory, same slice-by-offset discipline: it appends the `RULED <YYYY-MM-DD>:` sentence to one row's `detail` and changes nothing else. It does **not** change `state`, and it **refuses** to append a second marker to a row that already carries one, so a re-run cannot double-file a ruling unnoticed; a row that merely mentions the word `RULED` is **not** refused but prints a notice, because both such rows are asked and a word-wide refusal would block a real ruling (Step 2). It proves the composed file before writing — line count unchanged, every line parses, the rewritten line present exactly once — so a failed check writes nothing. Apply the sentence with a `String.replace` **function** rather than a replacement string: a string replacement reads `$&`, `$'`, `` $` `` and `$1` in the appended text as patterns. Neither register file carries such a sequence today, which is why this is a trap for the next one and not a live bug.
- [ ] **Step 2: Pre-pass the 104 for rulings already taken.** Grep each row's `detail` for a ruling sentence in any form and list what comes back. The listed rows carry the word without the marker, and **none of them is skipped on it**: `vg-225`'s `RULED to stand by the controller rather than treated as a nit` settles that the finding is real, not which of the two options its triage question poses, and `vg-040`'s `RULED: draft in browser storage; write on a ~30 s timer and on leaving the page…` is conditional in its own next clause (`BLOCKED: the asset-ownership question decides where the draft lives`, whose decider `triage-B1.md:21` records as `Status: backlog`), so it is a confirmation or a change rather than a fresh question. A row whose own `detail` already answers its question is **not asked again**; the marker — not the word — is what says whether it does.
- [ ] **Step 3: Prove it on `vg-051`** (D11, a ruling that closes nothing), then revert with `cmp`.
- [ ] **Step 4: State the no-schedule rule in the phase report** and in the drain's ledger: a work phase greps its decision rows for the marker **format** `RULED <YYYY-MM-DD>:` and stops if one is missing.
- [ ] **Step 5: Write the batch agenda** — the four sessions below, each naming its clusters and, for D1/D3/D11, that they are question lists rather than one question.

### Task 1.2: Session 1 — D1 and D2 (13 rows)

**Files:**
- Modify: `docs/product/backlog.jsonl`

**Interfaces:**
- Consumes: Task 1.1's helper
- Produces: 13 ruled rows, of which the five D1 lead rows already carry their ruling — 8 new rulings, 5 recorded

Rows: `vg-213`, `vg-262`, `vg-372`, `vg-355`, `vg-379`, `vg-380`, `vg-382`, `vg-386`, `vg-184` (D1); `vg-282`, `vg-147`, `vg-150`, `vg-144` (D2).

- [x] **Step 1: D1's lead question is already answered — record it, do not re-ask it.** The user ruled on 2026-10-12 that `biome check` is the gate, and the ruling sits on `vg-213`, `vg-262`, `vg-372`, `vg-355` and `vg-379`; this session's job is the **four that do not share it**. **§8.9's `vg-262` correction is applied (2026-10-16), and it was not the correction the table described**: the row's 67 is a measurement from 2026-10-10, and the ledger's record of the commit that fixed the findings reads 63 errors, of which 60 are `organizeImports` — so the number *moved* between measurement and fix, and neither is the defect's size. `vg-283`'s citations were corrected in the same pass by dropping the line numbers rather than re-pointing them — **and a clause of this step was wrong and is corrected 2026-10-16**: it read §8.9's replacement (`357` → `379`) as stale at a third value, but that number is `font-picker.tsx`'s *length*, and the file is exactly 379 lines. The third value belonged to `FontControls`' line *position* in `panes/tokens/preset-list.tsx`, which is a different measurement; reading a count as a position is what made a correct replacement look wrong. **The replacement was right and is applied** (Task 1.3 Step 5).
- [ ] **Step 2: Take the four D1 rows that do not share it** — `vg-380`, `vg-382`, `vg-386`, `vg-184` — as their own questions.
- [ ] **Step 3: Take D2's four**, each its own question.
- [ ] **Step 4: Record D1's answer where W3 will find it**, since Task 4.3 cannot start without it. `npm run backlog:check`.

### Task 1.3: Session 2 — D3, D4, D5 and D6 (31 here, 8 after Phase 2)

**Files:**
- Modify: `docs/product/backlog.jsonl`
- Read: `DESIGN.md` §2–§5 (the closed vocabularies D3 amends)

**Interfaces:**
- Consumes: Task 1.1's helper and its pre-pass
- Produces: 31 rows ruled here — 6 of them already carrying their ruling (`vg-291` and D5's five) — with the eight browser-pinned rows handed forward, not ruled here; the D4 rulings that gate W9

Rows: D3 — `vg-201`, `vg-202`, `vg-222`, `vg-223`, `vg-225`, `vg-227`, `vg-261`, `vg-306`, `vg-308`, `vg-310`, `vg-312`, `vg-319`, `vg-334`. D4 — `vg-301`, `vg-324`, `vg-350`, `vg-354`, `vg-291`, `vg-287`, `vg-278`. D5 — `vg-228`, `vg-267`, `vg-271`, `vg-274`, `vg-286`. D6 — `vg-254`, `vg-256`, `vg-260`, `vg-263`, `vg-264`, `vg-265`, `vg-268`, `vg-283`, `vg-269`, `vg-270`, `vg-272`, `vg-289`, `vg-290`, `vg-336`.

**Eight of these 39 cannot be ruled from a reading.** `vg-306`, `vg-308`, `vg-310`, `vg-319` (D3), `vg-324`, `vg-278` (D4), `vg-265`, `vg-270` (D6) need a browser run, their runs are Phase 2's, and they are ruled in the Phase 1 follow-up session there (Task 2.5 Step 4). **31 here, 8 there** — the same split Phase 1's acceptance reads as 96 + 8.

- [ ] **Step 1: Take D3's nine that a reading settles** — `vg-201`, `vg-202`, `vg-222`, `vg-223`, `vg-225`, `vg-227`, `vg-261`, `vg-312`, `vg-334` — as row-level amendment-or-code choices. Three (`vg-222`, `vg-225`, `vg-227`) are the same shape: a rule is silent and the product had to choose. **`vg-225` is asked**: its `detail` carries `RULED to stand by the controller rather than treated as a nit`, which settles that the finding is real rather than the choice its own question poses.
- [ ] **Step 2: Take D4's five that a reading settles** — `vg-301`, `vg-350`, `vg-354`, `vg-287`, `vg-291`. **`vg-291`'s ruling is already taken** (D4, 2026-10-12: it dissolves into `vg-292`) — record it, do not re-ask — and **applying** the collapse is Task 10.3 Step 1's (§8.3 applies a family once, at the task the §8 table names). Apply §8.2's line correction and §8.11's owner-path correction to `vg-301`'s line.
- [ ] **Step 3: D5's five are already ruled, recorded together on 2026-10-12** — `vg-228`, `vg-267`, `vg-271`, `vg-274`, `vg-286` carry the ratchet's membership rule as one answer. Record them; do not re-ask. §8.9's correction to `vg-274` still rides its line — its title's "in no gate" is already false while the design pass it asks for is real, so record what the ruling said about the pass. [Annotated 2026-10-13: **recording D5 is all this step can do, and by this plan's own closing rule that leaves five rows unclosable.** Line 80 says a ruled row closes "when the change the ruling authorises lands, on the work phase that did it" — and **no work phase adopts D5.** Measured over both documents: of the five, `vg-228`, `vg-267`, `vg-271` and `vg-286` appear in no phase list at all (W3, the phase that owns `scripts/design-tokens.mjs`, names `vg-166`, `vg-199`, `vg-323`, `vg-327`, `vg-329`, `vg-332`, `vg-340`, `vg-384`, `vg-385`), and `vg-274`'s only appearance after this phase is §8.9's drift correction, which is this same recording step. So the ratchet's membership ruling landed on 2026-10-12 and produced work no task took — which is why those five are still open rather than done. **And the work cannot be planned from the ruling as worded**: its criterion, "a test file that renders the shell", is not one the checker can evaluate, since a literals-keyed rule gates 275 of 289 test files and 732 violations while an imports-keyed one misses the six `tests/e2e/` specs that are most of `vg-286`'s own measured violators. Pinning that reading is a decision; adopting the result is a task this plan does not have. **How far this generalises, and how far it was checked:** 74 open rows carry a `RULED` marker and 67 appear in neither List A nor List C, but that count is not 67 findings — a ruling can resolve a row with no product change (`vg-271`'s chosen branch is satisfied by the acceptance section's own wording), and deciding which needs a phase means reading each ruling. Only D5 was read, and only D5 is claimed here.]
- [ ] **Step 4: Take D6's twelve that a reading settles** — `vg-254`, `vg-256`, `vg-260`, `vg-263`, `vg-264`, `vg-268`, `vg-283`, `vg-269`, `vg-272`, `vg-289`, `vg-290`, `vg-336` — and apply §8.2's line correction to the rows that cite one.
- [x] **Step 5: Collapse `vg-268`/`vg-283` once, here — APPLIED 2026-10-16** (§8.3 names this task the first member's): both rows now say one ruling covers the pair and that neither closes without the other, with the ruling itself left where it was, on `vg-268`. **§8.9's count correction to `vg-283` is applied and was right**: the title read `357` and `font-picker.tsx` is 379 lines, measured 2026-10-16, with the test unchanged at 984. **A clause of Task 1.2 Step 1 had called that replacement stale and was wrong** — it read the file's *length* as `FontControls`' line *position* — and both that step and `vg-283`'s own note are corrected here. **One further measurement moved while the row sat**: `vg-268`'s consumer grep now also returns `components/ui/control-icon-button.dom.test.tsx`, so the count is three test consumers rather than two — still no product surface, which is the finding. The other three collapses are Tasks 10.3, 4.1 and 1.4's — do not apply them here.
- [ ] **Step 6: `npm run backlog:check`** and commit the session's rows.
- [ ] **Step 7: Hand the eight forward in writing** — name `vg-265`, `vg-270`, `vg-278`, `vg-306`, `vg-308`, `vg-310`, `vg-319`, `vg-324` in the phase report as this session's remainder, read at Task 2.5 Step 3 and ruled by the follow-up session at Task 2.5 Step 4. A task that took D3/D4/D6 whole and reported 39 would be claiming eight rulings that no run has pinned.

### Task 1.4: Session 3 — D7 and D8 (21 rows)

**Files:**
- Modify: `docs/product/backlog.jsonl`
- Read: `docs/architecture/ownership.md`, `src/web/packages/scene-fabric/src/persist.ts`

**Interfaces:**
- Consumes: Task 1.1's helper
- Produces: 21 ruled rows; D8's rulings that gate W5 — the only cluster with a hard downstream phase

Rows: D7 — `vg-023`, `vg-037`, `vg-041`, `vg-111`, `vg-123`, `vg-142`, `vg-188`, `vg-221`, `vg-249`, `vg-252`, `vg-348`, `vg-366`. D8 — `vg-104`, `vg-240`, `vg-241`, `vg-242`, `vg-247`, `vg-248`, `vg-342`, `vg-343`, `vg-381`.

- [x] **Step 1: Collapse `vg-041`/`vg-188` into one question, once — APPLIED 2026-10-16** (§8.3 pairs them, `vg-041`'s own cell says it owns `vg-188`, and both ask which Fabric properties are derived). Both rows now carry the pairing: one ruling covers the pair, it is recorded on `vg-041`, `vg-188` is named as the *measured instance* of the general question rather than a second finding, and neither closes without the other. **The pair was checked rather than assumed** — `vg-188`'s own detail measures `subTargetCheck` and `interactive` reaching the serialized scene through `grouping-manager`'s reachability flags, which is exactly the question `vg-041` asks in general form, so the pairing holds as one question and not two that merely touch.
- [x] **Step 2: `vg-252`'s §8.10 correction is WITHDRAWN (2026-10-16) — there is nothing to correct.** The table claimed its premise was half-false; the row's detail measures the opposite, and its own ruling agrees. Nothing was applied, and the reason is recorded on the row. **The §8.11 corrections that this step does not own are unaffected** and remain where the table names them.
- [x] **Step 3: Take D8's nine — DONE, verified 2026-10-16.** All nine (`vg-104`, `vg-240`, `vg-241`, `vg-242`, `vg-247`, `vg-248`, `vg-342`, `vg-343`, `vg-381`) carry a `RULED 2026-10-12:` marker, and `vg-342` carries two later ones as well, so the ownership answers exist and each names the one owner that survives. Seven of the nine are `verified`; **two stay `open` and for different reasons**: `vg-240` waits on the re-shape its own protocol spec describes, because writing a spec closes nothing, and `vg-342` is the 2026-10-15 ruling that the descriptor route gets a React owner — work that reverses `4dc220c6` and is carried opportunistically rather than by a phase.
- [x] **Step 4: Route D8's answers into W5's gate — DISCHARGED 2026-10-16, by Phase 6 rather than here.** Task 6.1 cannot start until the answers exist, and they did: Phase 6's own Acceptance annotation records that **D8's nine were consumed there as gates** — Task 6.1's protocol spec landed, Tasks 6.2, 6.3 and 6.4 name four rows between them, and Task 6.5 was added mid-flight to land the eight that no task took. So this step's `npm run backlog:check` is the phase's, not a routing left undone. **What is left is not routing but the two rows**: `vg-240`'s re-shape and `vg-342`'s React owner, each stated on its own row.

### Task 1.5: Session 4 — D9, D10 and D11 (31 rows)

**Files:**
- Modify: `docs/product/backlog.jsonl`

**Interfaces:**
- Consumes: Task 1.1's helper
- Produces: 31 rows ruled, of which one (`vg-368`) already carries its ruling

Rows: D9 — `vg-109`, `vg-155`, `vg-159`, `vg-167`, `vg-168`, `vg-182`, `vg-185`, `vg-186`, `vg-191`, `vg-192`. D10 — `vg-029`, `vg-040`, `vg-056`, `vg-163`, `vg-171`, `vg-174`, `vg-190`, `vg-208`, `vg-211`, `vg-214`, `vg-230`, `vg-279`. D11 — `vg-051`, `vg-116`, `vg-178`, `vg-198`, `vg-315`, `vg-352`, `vg-363`, `vg-368`, `vg-373`.

- [ ] **Step 1: Take D9's ten.** Two of them (`vg-109`, `vg-155`) may rule the row **withdrawn**, which closes it here with no `check` and no `artefacts`.
- [ ] **Step 2: Take D10's twelve**, which only a product call settles. `vg-040` is one of the twelve and **is asked**: its own `detail` rules browser storage and then names the asset-ownership spec as the decider, and that spec is still `backlog`.
- [ ] **Step 3: Take D11's eight as independent housekeeping questions** — `vg-051`, `vg-116`, `vg-178`, `vg-198`, `vg-315`, `vg-352`, `vg-363`, `vg-373`. **`vg-368` is already ruled** (2026-10-12: `src/web/.agent-scratch/` relocates outside the tree) — record it, do not re-ask.
- [x] **Step 4: §8.7's `vg-315` count correction is WITHDRAWN (2026-10-16); §8.11's path corrections are APPLIED (2026-10-16).** The row was annotated with the capability instead of a total — a tracked doc can cite execution state no clone carries — because the row's four and the table's six measure different things and a grep measures a third. **§8.11's corrections to this session's rows are now applied, and measuring them refuted the cell for two of the three**: `vg-109`'s `owner` and its `check`'s `index.dom.test.ts:1501` both resolve, and that line lands on the case that verifies the readout, so the row carries a no-drift note rather than an edit; `vg-301` had already taken §8.2's citation correction and its three paths resolve, so the §8.11 half is discharged; only `vg-155` had moved, and its prose now names `panes/add/file-section.tsx` and `AssetManager.placeImage` with the line numbers dropped rather than re-pointed. `vg-328` left the live file in Task 0.2, so its correction was applied *before* the move; the other §8.11 rows are edited in the tasks that own them (`vg-104` Task 1.4 Step 3, `vg-301` Task 1.3 Step 2, `vg-333` Task 7.4 Step 4, `vg-314` Task 2.3 Step 4, `vg-235` Task 0.3 Step 2).
- [ ] **Step 5: `npm run backlog:check`**, then check the marker **format** as a set: **96 of the 104** carry it by Phase 1's close — the twelve ruled on 2026-10-12 plus the 84 these sessions take — and the remaining eight are the Phase 2 follow-up's. Print the ids, not a count.

---

# Phase 2 — W1: the serialised browser follow-up (38 work rows)

**Outcome:** each of the 38 rows is run in its own suite, one at a time, and either fixed, closed, or filed as a fresh row against the owner the run names.

**Scope, and where §5's 38 differs from §7's 49.** §7's follow-up holds 49 rows: these 38 `work` rows, 8 `decision` rows whose choice a run pins (`vg-265`, `vg-270`, `vg-278`, `vg-306`, `vg-308`, `vg-310`, `vg-319`, `vg-324`), 1 parked row (`vg-322`, which stays parked) and 2 rows that close (`vg-328` with Task 0.2, `vg-309` with Task 0.2). This phase **runs** all 49 and **implements** only the 38; the eight readings go to Task 2.5 Step 4 and the two closes happen in Phase 0. **Four further rows are browser-dependent and sit outside the 49** — `vg-037` (a D7 decision, Task 1.4), `vg-260` (a D6 decision, Task 1.3), and `vg-292`/`vg-293` (W9, Phase 10). None is run here; they are named so nothing browser-dependent is lost between the two lists.

**Owners:** the suites under `src/web/tests/e2e/`, `src/web/playwright.config.ts` (ports 4173/4174), `tests/e2e/mockup-values.test.ts` (vitest).

**Constraints:** one suite at a time; `--workers=1`; rebuild before each preview; captures need `VIGILIA_CAPTURE=1`. **Nothing else in the drain builds or drives Playwright during this phase.** **A row closes `verified` only on evidence that could have failed**: a new case needs its red proof (revert the defect's line, watch it fail, revert, `cmp`), and where a case is amended, its re-pointed locator or gesture is demonstrated to fail when the behaviour it addresses is disabled. A green run whose assertions are `toBeGreaterThan`/`not.toBe`, or whose two sides move together, settles nothing — `vg-233`'s first pass closed on exactly that and the review caught it.

**Acceptance:** every one of the 38 rows has a verdict recorded in its own line, and no run reported a result twice from the same build (each suite read from its own JSON report, per the memory that a rewritten stdout is not evidence).

**Failure modes:** two suites on the ports producing false reds; a locator reported stale when the surface moved; a "no gate reads X" row closed on a green suite, which cannot settle it (§11).

**Verify:** each run's JSON report file, read from disk; the register checker after the batch.

### Task 2.1: The four rows that need a new case

**Files:**
- Modify: the spec each row names
- Test: `src/web/tests/e2e/editor.spec.ts` (`vg-346`, and the one case that carries `vg-233` and `vg-370`), `src/web/tests/e2e/host-player.spec.ts` and the `tests/e2e/host-theme.ts` fixture (`vg-347`) — the paths are the triage tables' own cells, not memory

**Interfaces:**
- Consumes: each row's spec path, `--grep` and build command from the triage table
- Produces: **three** new cases for four rows — the triage tables pair `vg-233` and `vg-370` onto one check, so a task reporting four would be counting rows, not cases
- **A case that closes a row must be able to fail on the defect the row names.** Run the red proof before closing: revert the defect's own line, require the case to fail, revert and `cmp`. A case whose assertions are `toBeGreaterThan`/`not.toBe`, or whose two sides move together, passes either way and closes nothing — `vg-233`'s first pass did exactly that.

- [ ] **Step 1: `vg-346`** — the canvas rotation gesture is the one thing no test performs; the deleted block was `shows the rotation-angle indicator beside the pointer mid-rotation`. Write the gesture case.
- [ ] **Step 2: `vg-347`** — build the `host-theme.ts` fixture the case needs, then the case itself: three captures through `openPaused` at a fixed clock, an ink check first, then a byte comparison of two captures required to be `0`. **Then `vg-233` and `vg-370` together** — the tables name the last two as settled by one check.
- [ ] **Step 3: Build, run each alone with `--workers=1`, read each run's JSON report, and run each closing case's red proof.**
- [ ] **Step 4: Record each row's verdict on its own line and close or re-scope it** — a row whose red proof did not fail on its defect stays `open` with what the run established, however green the case reads.
- [ ] **Step 5: Commit** the new cases and the row changes.

### Task 2.2: The four rows whose answer already exists

**All four fixes are already in the tree.** They landed on 2026-10-12 before this plan ran — `8a86b2b0`
(`fix(tests): re-aim three deterministic reds whose surfaces did not move`, red-before and green-after on the built
bundle, three suites 85 passed) for `vg-359`, `vg-360` and `vg-361`, and `48ada839`
(`test(walkthrough): the census asserts section 13.1 in the state the ruling puts it in`) for `vg-362`. **Do not
re-apply them.** This task's work is to rebuild, run each case alone, read each verdict from its own JSON report, and
close or re-scope each row with the row-text corrections §8.12 and §8.13 name.

**Files:**
- Modify: `docs/product/backlog.jsonl` (the four rows' own lines)
- Read: `src/web/tests/e2e/editor.spec.ts` (`vg-359`), `src/web/tests/e2e/glass-authoring.spec.ts` (`vg-360`), `src/web/tests/e2e/reference-theme.spec.ts` (`vg-361`), `src/web/tests/e2e/host-walkthrough.spec.ts` (`vg-362`)

**Interfaces:**
- Consumes: §7's first slice, which answered all four, and the two commits above, which applied the answers
- Produces: four rows closed or re-scoped on a fresh run, with their own text corrected

Rows: `vg-359`, `vg-360`, `vg-361`, `vg-362`.

- [ ] **Step 1: `vg-360` — confirm the locator fix is the one in the tree.** The stale locator wanted
  `ancestor::div[contains(@class, 'ml-auto')]//span[contains(@class, 'font-mono')]`; the well is reached through the
  track instead, at the xpath `ancestor::div[contains(@class, 'items-center')][1]/following-sibling::span[contains(@class, 'font-mono')]`
  (`glass-authoring.spec.ts:327` at `3ca795a9` — carry the string, not the line).
- [ ] **Step 2: `vg-359` — confirm the click is re-aimed at the row's own body.** A centre click landed on the row's
  `Leave group-cpu-card` control, which left the group and removed the part row the case needs next; the case
  (`ships the starter's frosted CPU card, reads it live, and round-trips it`, `editor.spec.ts:1287` at `3ca795a9`)
  now clicks the row's body.
- [ ] **Step 3: `vg-361` — confirm the read moved after the pane opens.** The failure was a read taken while the Add
  pane was active, resolving to the hidden Document control; the pane is opened before the read.
- [ ] **Step 4: `vg-362` — confirm the census reads both states.** `keyboardReach` runs at the opening state and again
  after `selectInPaneByKeyboard`, which is the state the user's 2026-10-12 ruling puts §13.1 in.
- [ ] **Step 5: Apply §8.12 to `vg-359`'s line and §8.13 to `vg-361`'s, rebuild, run each case alone with
  `--workers=1`, read each run's JSON report, close or re-scope each row on that verdict, and commit.**

### Task 2.3: The design-language and chrome suite rows

> **Split by the controller, 2026-10-12.** Two implementers died on the same API stall (`StreamIdleTimeoutError`,
> ~180 s with no stream event — a long foreground Playwright run looks exactly like an idle stream), the second
> leaving a draft in `design-language.spec.ts` and `shell-appearance.spec.ts`. The task is therefore executed as
> **2.3a** — the `design-language.spec.ts` half: `vg-296` ×2, `vg-314`, `vg-325`, `vg-326` — and **2.3b** — the
> `shell-appearance.spec.ts` half plus the measurement row: `vg-313`, `vg-285`. Long commands run in the background;
> a suite is still run one at a time. The steps below apply to each half. The rulings stand unchanged.

**Files:**
- Test: `src/web/tests/e2e/design-language.spec.ts`, `src/web/tests/e2e/shell-appearance.spec.ts`, `src/web/tests/e2e/mockup-values.test.ts`

**Interfaces:**
- Consumes: the triage tables' per-row spec and `--grep`
- Produces: the drawings gate's rules built where the row is `work`, and the readings the ruling rows need

Rows: `vg-285`, `vg-296`, `vg-313`, `vg-314`, `vg-325`, `vg-326` — the five of the 38 whose triage cell names `design-language.spec.ts` or `shell-appearance.spec.ts` (`vg-296`, `vg-313`, `vg-314`, `vg-326`, `vg-285`), plus the two new instruments `vg-314`'s surface inventory and `vg-325`'s product side, which §5.1 files here and Task 2.4 does not. `vg-296`'s two remaining clauses are open exactly as its row says — apply §8.15 to its text, not before.

- [ ] **Step 1: Run the suite rows one at a time**, each read from its own JSON report, and record each verdict.
- [ ] **Step 2: Build the drawings gate's rules that the runs show are missing** — a drawing's `box-shadow` against §3's elevation table, its `border`/`border-*` against §5's vocabulary (`vg-296` ×2), and a rendered row height against §3's 26/30/32 (`vg-326`). Two more of §5.1's rules are new instruments seated here: `vg-314`'s surface inventory (what the product renders that the drawing omits) and `vg-325`'s product side (the inverse of the drawings gate — `editor-shell.css` against the drawings).
- [ ] **Step 3: Note §11's limit in the report** — a green suite cannot carry a "no gate reads X" row. The evidence is the assertion's arms.
- [ ] **Step 4: Apply §8.15 to `vg-296`'s line and §8.2/§8.11's corrections to `vg-296`, `vg-313`, `vg-314` and `vg-325` when they close** — `vg-296` reads as though the drawing were missing, while the file is present at 33.6 KB and frozen by design.
- [ ] **Step 5: Commit.**

### Task 2.4: The remaining suites

> **Split by the controller, 2026-10-12, along the group boundary Step 4 already commits by.** Two implementers died
> on an API stall before the mitigation (long commands in the background) was adopted, and this task is the largest
> in the phase — 23 rows over 16 suites, whose diff would be one review package too big to read. It runs as **2.4a**,
> the twelve rows whose triage cells are B1's and B2's, and **2.4b**, the eleven whose cells are B3's through B6's.
> The two halves are file-disjoint. Steps 1–4 below apply to each half; the ruling that matters is unchanged: a row
> closes only on evidence that could have failed.

**Files:**
- Test: the specs the triage tables name for each remaining row — `editor.spec.ts`, `editor-clip.spec.ts`, `editor-display.spec.ts`, `editor-context-menu.spec.ts`, `inspector-sections.spec.ts`, `composition-panel.spec.ts`, `clip-parity.spec.ts`, `glass-circle-parity.spec.ts`, `host-media.spec.ts`, `host-player.spec.ts`, `host-settings.spec.ts`, `keyboard.spec.ts`, `publish-header.spec.ts`, `publish-loop.spec.ts`, `snapping.spec.ts`, `author-journey-rebuild.spec.ts` and `reference-theme.spec.ts`

**Interfaces:**
- Consumes: Task 2.3's discipline
- Produces: verdicts and fixes for the rest of the 38

**Rows: the 23 of the 38 that Tasks 2.1, 2.2, 2.3 and 2.5 do not seat** — `vg-028`, `vg-138`, `vg-141`, `vg-143`, `vg-156`, `vg-158`, `vg-164`, `vg-172`, `vg-195`, `vg-197`, `vg-204`, `vg-210`, `vg-212`, `vg-257`, `vg-258`, `vg-259`, `vg-266`, `vg-280`, `vg-281`, `vg-284`, `vg-311`, `vg-316`, `vg-376`. Grouped by the spec path in each row's triage cell, so nothing is left to "the rest":

| spec | rows |
|---|---|
| `editor.spec.ts` | `vg-028` |
| `snapping.spec.ts` | `vg-138` |
| `host-media.spec.ts` | `vg-141` |
| `host-player.spec.ts` | `vg-143` |
| `composition-panel.spec.ts` | `vg-158`, `vg-210` |
| `host-settings.spec.ts` | `vg-164` |
| `publish-header.spec.ts` | `vg-172` |
| `editor-context-menu.spec.ts` | `vg-195` |
| `clip-parity.spec.ts` | `vg-197` |
| `keyboard.spec.ts` | `vg-204`, and `vg-284` with its two `.dom.test.tsx` siblings |
| `publish-loop.spec.ts` | `vg-212` |
| `editor-clip.spec.ts` | `vg-257` |
| `editor-display.spec.ts` | `vg-258` |
| `glass-circle-parity.spec.ts` | `vg-259` (the parity config) |
| `author-journey-rebuild.spec.ts` | `vg-280` |
| `reference-theme.spec.ts` | `vg-281` |
| `inspector-sections.spec.ts` | `vg-376` |

**Four of the 23 have no spec in their triage cell at all**, and the tables say why, so what to run is the cell's own venue rather than a path that does not exist: `vg-156` (no spec covers the path — drive the Add pane's file section with several JPEGs on the editor preview), `vg-266` (`document.querySelectorAll('.vigilia-field select')` against the built preview), `vg-311` (the bundle half already reproduces; the browser half reads computed `backdropFilter` on the preview), `vg-316` (the `--muted`-on-`--panel2` reading on the preview, plus a `PARITY` row). `vg-325` and `vg-341` are the other two the cells leave open, and they are Tasks 2.3's and 2.5's.

- [ ] **Step 1: Take each row's spec, `--grep` and build command from its own triage cell** — the table above is the grouping, the cell is the command.
- [ ] **Step 2: Run each group's rows one at a time**, `--workers=1`, after `npm run build`.
- [ ] **Step 3: For each row, decide on the run's evidence:** fixed, closed, or re-filed against the owner the run names. **Cause not established is a filed issue, not a guessed fix** — the bug rule applies.
- [ ] **Step 4: Record and commit** per group, so a red group does not hold a green one. Apply §8.2's line correction and §8.9's count and line-number corrections (`vg-204`, `vg-210`, `vg-284`) as those rows are edited.

### Task 2.5: The capture row, and the eight rulings' readings

**Files:**
- Test: `src/web/tests/e2e/design-language.spec.ts`, `shell-appearance.spec.ts` (the readings — and, for the five rows whose triage cell names no spec, the venue that cell names: the built editor preview)
- Modify: `docs/evidence/screenshots/README.md` if a capture's registered action changes

**Interfaces:**
- Consumes: `VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --workers=1` after `npm run build` and `npm run build:fixture -w @vigilia/editor`
- Produces: `vg-341`'s captures, and eight readings handed to a Phase 1 follow-up session

- [ ] **Step 1: Grep `vg-213`, `vg-262`, `vg-372`, `vg-355` and `vg-379`'s lines for the marker format** — D1 decides whether the fixture's eight literal strings are in scope at all, and no ruling means no row filed here. Then re-check §9's exemption against what is deployed: `build:fixture` writes `control-fixture.html` into the same `packages/editor/dist` the host serves, so the fixture's eight literal strings are reachable on any host that ran it. If D1's ruling widened the copy rule, this is the moment to file the one row §9 names.
- [ ] **Step 2: Run `vg-341`'s capture** for the seven captures; note that six sit at `7efea17f` and `editor-shell-add-desktop-chromium.png` at `f069e56c` (§8.5's count correction rides `vg-341`'s own line).
- [ ] **Step 3: Take the eight readings** — `vg-265`, `vg-270`, `vg-278`, `vg-306`, `vg-308`, `vg-310`, `vg-319`, `vg-324` — each exercised on the built bundle, each recorded as a *reading* on the row's line, not as a ruling. Five of the eight (`vg-265`, `vg-270`, `vg-306`, `vg-319`, `vg-324`) have no registered spec in their triage cell, so the reading is taken on the preview the cell names; the other three name `design-language.spec.ts` or `shell-appearance.spec.ts`.
- [ ] **Step 4: Hand the eight to a Phase 1 follow-up session**, which records the `RULED <YYYY-MM-DD>:` sentences and brings the marker set to 104. Grep the format, and print the ids.
- [ ] **Step 5: Commit** the captures (inspected before staging) and the row changes.

---

# Phase 3 — W2: the ownership map's filing pass (10 rows)

**Outcome:** `docs/architecture/ownership.md` names every domain the census names and the census reads.

**Owners:** `docs/architecture/ownership.md`; `docs/architecture/manager-census.md` as evidence; `scripts/ownership-sweep.mjs` and `scripts/ownership-overlap.mjs` as the instruments.

**Constraints:** one file, one seat — the map is the instrument the census reads, so two seats editing it disagree by construction. Entries are derived from `manager-census.md` and the live modules, never from the rows' own prose (§8.11's path drift is what prose costs).

**Acceptance:** `npm run ownership:sweep` and `npm run ownership:overlap` run clean over the new rows; each of the 10 rows is closed against the map row that now exists. [Annotated 2026-10-13 at the phase's close: **eight** of the ten closed — `vg-162`, `vg-236`, `vg-237`, `vg-238`, `vg-243`, `vg-244`, `vg-246`, `vg-369` — and `vg-234` and `vg-245` stay `open`, each with a reading naming what the map row discharged and what it did not: a refused rename is still silent at `editor-shell/bridge.ts:341-352` and reported at `selection-inspector/view.ts:440-450`, and nothing yet compares the schema's two hand-spelled asset-path patterns (`theme-document.schema.json:113`, `:123`) to `ASSET_PATH_PATTERN`. Both closable rows would have been false `verified`s; the ruling and its evidence are in the plan's ledger under "Task 3.3: complete, and Phase 3 closes".]

**Failure modes:** a row closed against a map row that says something *nearby* — the false-landed shape the checker exists to catch.

**Verify:** the two sweep scripts, plus each row's `check` naming a word of its own title.

### Task 3.1: Derive the missing rows

**Files:**
- Read: `docs/architecture/manager-census.md`, `src/web/packages/editor/src/**` and `src/web/packages/scene-fabric/src/**` for the live modules
- Modify: `docs/architecture/ownership.md`

**Interfaces:**
- Consumes: Task 1.4's D8 rulings, which name surviving owners
- Produces: map rows keyed by concept, each naming one owner module

- [ ] **Step 1: Grep D8's nine rows for the marker format.** No ruling on a concept, no map row for it — an ownership row written before the ruling is the prose the ruling exists to replace. Then read the census's unmatched domains and list them against the map's existing rows. Apply §8.11's owner-path correction to `vg-104`'s line.
- [ ] **Step 2: For each, read the module** and write the row naming the one owner — not the consumer.
- [ ] **Step 3: Do not add a row for a concept a decision row is still deciding** (`vg-104`, `vg-240`, `vg-241`, `vg-242`, `vg-247`, `vg-248`).
- [ ] **Step 4: Commit** the additions with the rows they close, one commit.

### Task 3.2: The stale sentence, and the rows the census got wrong

**Files:**
- Modify: `docs/architecture/ownership.md`
- Modify: `docs/product/backlog.jsonl`

**Interfaces:**
- Consumes: Task 3.1
- Produces: `vg-244`'s deletion and the rest of the 10 rows

- [ ] **Step 1: Delete the stale sentence** `vg-244` names — a deletion, not a rewrite.
- [ ] **Step 2: Correct each remaining row's cited path where §8.11 applies** — the subject exists, the path moved.
- [ ] **Step 3: `npm run ownership:sweep`, `npm run ownership:overlap`.**
- [ ] **Step 4: Commit.**

### Task 3.3: Close the 10

**Files:**
- Modify: both register files

**Interfaces:**
- Consumes: Tasks 3.1 and 3.2
- Produces: 10 archived rows

- [ ] **Step 1: For each row, write a `check` naming the map row it closed on**, with a word of the row's own title in it.
- [ ] **Step 2: For each, find the sha** — the commit that added the map row.
- [ ] **Step 3: `check([row])` each, move each, then `npm run backlog:check`.**
- [ ] **Step 4: Commit.**

---

# Phase 4 — W3: the repo's own gates and scanners (9 rows)

**Outcome:** the three gate owners each read what their rows claim, and the register's own checker reads the archive.

**Owners:** `scripts/backlog-check.mjs` (`vg-166`, `vg-199`, `vg-329`), `scripts/design-tokens.mjs` (`vg-327` ×2, `vg-332`, `vg-340`), `package.json` scripts and `.github/workflows/ci.yml` (`vg-323`, `vg-384`, `vg-385`). [Annotated 2026-10-13: Task 4.4 closed **ten** rows — these nine plus `vg-282`, whose two `test:*` scripts and `slow-suites` job Task 4.3 built and which no task in this plan owned the close of. The ruling, its reason and its cost are in the ledger.]

**Constraints:** gated on D1 — its ruling decides *whether* these gates count, not what they read. One seat per file. A gate whose self-test is not chained into `gates:self-test` is not built yet.

**Acceptance:** the seven verdict cells that end in a gate but sit outside §5.1's rule table are not lost here — `vg-313`, `vg-316` (W1), `vg-317` (W7), `vg-333`, `vg-335`, `vg-338`, `vg-339` (W6) land with their owners and are named in the report so nothing goes missing. [Annotated 2026-10-13: Task 4.4 named all seven in its report with the phase that owns each — `vg-313`/`vg-316` Phase 2, `vg-317` Phase 8, `vg-333`/`vg-335`/`vg-338`/`vg-339` Phase 7 — and closed the phase's rows in `9739f6e6`: ten `verified`, each `check` proved against `scripts/backlog-check.mjs` before the move.]

**Failure modes:** widening a checker until it reports a count, not a set; a gate that runs green because its self-test was never chained in.

**Verify:** `npm run gates:self-test`, `npm run design:check`, `npm run backlog:check`. [Annotated 2026-10-13: the list above is a restatement, and a restated gate list is exactly the artifact that rots (`vg-384`) — read the steps from `.github/workflows/ci.yml`, which is the authority for what "green" means. What that job runs now is `npm run gate` for all four of these — `biome check`, `gates:self-test`, `design:check` and the unit suite — beside the steps it already had. `design:check` joined the chain on 2026-10-13 (`vg-435`), because it had run only as a separate CI step and a local gate therefore read green over a verdict CI would have failed; its own CI step went with it, so no step runs it twice.]

### Task 4.1: `backlog-check.mjs` reads the archive, and the 14 archived rows it finds are repaired

**Files:**
- Modify: `scripts/backlog-check.mjs`
- Modify: both register files (`vg-329`'s count correction; the 14 archived rows)

**Interfaces:**
- Consumes: `check(items)` and `parse(text)` as they stand
- Produces: an archive read under the live file's rules, landing as an **error** — the phase may not go green by narrowing it to a warning — and the 14 problems repaired, most in place and any whose closing commit cannot be found returned to the live file as `unverified`; `vg-166` and `vg-329` collapsed into one hole with `vg-199` as its data half (§8.3)

A same-rules read over the 149 archived rows produces **14 problems** today, and they are this named set rather than a count:

| what the same-rules read finds | rows |
|---|---|
| `verified` with no `artefacts` at all | `vg-030`, `vg-064`, `vg-076` |
| `verified` with a bare string where an array belongs | `vg-157`, `vg-173`, `vg-176`, `vg-180`, `vg-187`, `vg-294`, `vg-295`, `vg-303` |
| a `check` sharing no tokenisable word with its own title | `vg-068`, and `vg-076` for this too |
| an `artefacts` entry that is not a sha | `vg-136` (`--close`) |

- [ ] **Step 1: Collapse `vg-166`/`vg-329` once** — both are `backlog-check.mjs` never reading the archive, found in two batches. §8.9's correction rides `vg-199`'s line (5 → 8 bare-string rows).
- [ ] **Step 2: Make the checker read `backlog-archive.jsonl` under the same rules, as an error.** A checker that tolerates the 14 is the false green the register's rule exists to prevent, so the repair is this task's work (Steps 5–6), not a widened read.
- [ ] **Step 3: Normalise the `artefacts` shape** so a bare string is rejected, not silently read as absent.
- [ ] **Step 4: Extend `--self-test`** with a case for each new rejection — a bare-string `artefacts`, a non-sha entry — and confirm each fails when its rule is disabled.
- [ ] **Step 5: Repair the 14, by line.** The eight bare strings are already shas that resolve and are ancestors of HEAD (measured), so wrapping each in a one-element array is the whole change. For `vg-030`, `vg-064`, `vg-076` and `vg-136`, find the commit that closed the row — `git log --format=%h -S<the symbol its check names>` over the path the check names — and write it. **Where no commit exists the row is not closed, so it returns to `docs/product/backlog.jsonl` as `unverified` with a `note` naming what was searched for and not found** — it does **not** stay in the archive demoted, because the archive holds `verified` and `withdrawn` and nothing else (149 rows today: 136 and 13, zero others). A row that cannot show its close is an open row. **Restate the live count when this happens** — `237 + however many returned` — and say so in the phase report, since the spec's 237 is a snapshot at `564f8dcf` and not a constant. Reword `vg-068`'s and `vg-076`'s `check` so it names a word of the row's own title, the way §3.2 rewords List A's six. A returned row needs no `check` and no `artefacts`; the checker's `unverified` rule asks only for a `note`.
- [ ] **Step 6: Re-run the read — 0 problems over the archived rows — then `npm run backlog:check`, and the checker's own self-test suite.** Steps 2–4 leave the gate red on purpose; Step 5 clears it in the **same commit** as the rule, so no commit lands a permanently red `backlog:check`. **This step is where the CLI stops being the live file's gate alone:** from here `backlog:check` covers both files, so the archived-row count moves from 149 to `149 − however many Step 5 returned`, and any sentence written before this phase saying the checker reads only the live file is true only of Phase 0's tree.
- [ ] **Step 7: Commit**, applying §8.4's correction to `vg-329`'s line — **and mind which number belongs to which sentence.** Its title counts *rows*: **11** `verified` rows carry no valid `artefacts` array, **8** of them as a bare string with `vg-303` among them, where **126** hold one. The **14** is this task's own *problem* count and belongs in the table above, not on `vg-329`'s line; §8.4's older "11 + 15" mixed a live-state count into a verified-row claim, and 12 of that 15 are `withdrawn` rows that need no artefacts at all.

### Task 4.2: `design-tokens.mjs`'s two rules

**Files:**
- Modify: `scripts/design-tokens.mjs`
- Test: its `--self-test` cases

**Interfaces:**
- Consumes: Task 4.1's shape (a checker reports a set, never a count)
- Produces: `vg-327`'s two rules — the violation set rather than its count, and an exemption keyed on the site as well as the text — plus `vg-332` and `vg-340`

- [ ] **Step 1: `vg-327` rule one** — report the violation set, not its count, so a changed violation is visible.
- [ ] **Step 2: `vg-327` rule two** — key an exemption on the site as well as the text, so a new site cannot inherit an old exemption.
- [ ] **Step 3: `vg-332` and `vg-340`**, each its own rule in the same scanner. [Ruled otherwise when the task ran: the two rows are ONE rule -- an allowlist entry no gated file consumes -- because both name the same defect in the same list. Ruling and evidence are in the ledger's Task 4.2 entry.]
- [ ] **Step 4: Add a self-test case per rule, and one that fails if the rule is disabled.**
- [ ] **Step 5: `npm run design:check`, `gates:self-test`, commit.**

### Task 4.3: `package.json` and CI

**Files:**
- Modify: `src/web/package.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: D1's ruling from Task 1.2
- Produces: `vg-323` (a test run in the gate list), `vg-384`, `vg-385`

- [ ] **Step 1: Grep D1's rows for the marker format.** None, no task.
- [ ] **Step 2: If D1 ruled the gate is `biome check`**, add the CI step and whatever `vg-384`/`vg-385` name; if it ruled `format:check` + `lint` is the surface, record that as the decision instead — the work is the same either way.
- [ ] **Step 3: `vg-323`** — the brief a dispatch names must match what the gate runs; correct the brief and the script together.
- [ ] **Step 4: Run CI's job list locally** where it can be run (`gates:self-test`, `design:check`, `backlog:check`, `status:check`). [Annotated 2026-10-13: read the list from `.github/workflows/ci.yml`, which is its owner — this sentence is now the restatement `vg-384` warns about, and Step 2's ruling landed as `biome check` (`vg-213`, `vg-262`, `vg-372`, `vg-355`, `vg-379`).]
- [ ] **Step 5: Commit**, naming D1's ruling as the warrant.

### Task 4.4: Close the 9

**Files:**
- Modify: both register files

**Interfaces:**
- Consumes: Tasks 4.1–4.3
- Produces: 9 archived rows

- [ ] **Step 1: `check` each against its own title**, naming the scanner and the rule.
- [ ] **Step 2: Find each sha.**
- [ ] **Step 3: Prove, move, `npm run backlog:check`.**
- [ ] **Step 4: Name the seven stray gate cells in the report** so their owners' phases pick them up.

---

# Phase 5 — W4: persisted-scene exclusions (3 rows)

**Outcome:** the two omissions from `SCENE_PERSISTED_PROPERTIES`' companion strip list are stripped, their `test.fail` pins become real assertions, and a discarded validation result reaches its caller.

**Owners:** `src/web/packages/scene-fabric/src/persist.ts`, `src/web/packages/host/src/themes/store.ts`.

**Constraints:** persist authored state only — a derived property that reaches the file is a bug, not a preference. A `test.fail` pin that starts passing is a failure, so the pin is removed in the same commit as the fix.

**Acceptance:** the two pins at `tests/e2e/reference-theme.spec.ts` are gone and their cases assert the strip; `vg-110`'s caller sees the validation result. [Annotated 2026-10-13 at the phase's close: all three rows are `verified` — `vg-129`/`vg-130` against `f3999695` and `vg-110` against `a50870b5`. The strip landed in `serialiseScene` as two passes (`removeDerivedTextStyles`, `removeImageCrossOrigin`) and the pins were removed in the same commit, their two stale inner messages with them; `vg-110`'s fix runs the whole HTTP boundary under **ADR-0043**, so a present-but-invalid theme is a `422` carrying the validator's issues and a discriminated `BootThemeOutcome` at the editor, not a `404` reported as success. Three dispositions from Task 5.3's review, all in the closing commit: the `publish` → `own-host` project rename propagated to the four artifacts that still named it (the group now holds `editor-invalid-theme.spec.ts`, which is not a publish spec); a dated re-measurement note on `vg-129`'s 30-vs-28 object count; and the residual the reviewer judged still live — an over-large `theme.json` still answered as absent — filed as `vg-409` rather than fixed here, because whether a size refusal is a third answer is a decision, not a task. Rulings and evidence: the ledger, "Task 5.3: complete, and Phase 5 closes". **Corrected 2026-10-13: this close did not run the repo's own `npm run gate`, and that gate was red at `a50870b5` and stayed red for the whole of Phase 6.** The close entry names exactly two gates it ran (`backlog:check`, `design:check`); `gates:self-test` was not among them, and `a50870b5` had made it fail — `BootThemeOutcome` was exported from `boot-theme.ts`, which is `dead-code-sweep.mjs`'s negative fixture, with no production importer, so the self-test's "the negative case is absent from every kind" went red on the commit `vg-110` was closed against. Fixed at the consumer in `b1383446`; `npm run gate` then exits 0 with 251 files / 3315 tests passed. The Acceptance above is unaffected — all three rows were and remain `verified` — but **a close that says "gates run" without naming the command and its exit code is what let this survive four task closes and a phase close**, and the phase's own Verify line named only `ownership:sweep`, `typecheck` and the row checks.]

**Failure modes:** a strip that removes a property the scene needs (over-stripping); leaving the pin in place so a red suite hides the fix.

**Verify:** the two vitest/Playwright cases; `npm run typecheck`.

### Task 5.1: `styles` is derived and is serialised

**Files:**
- Modify: `src/web/packages/scene-fabric/src/persist.ts`
- Test: `src/web/tests/e2e/reference-theme.spec.ts` (the pin at the row's cited line)

**Interfaces:**
- Consumes: the existing strip handlers for `text`, `clipPath`, `height`, `src` and group flags
- Produces: a `styles` handler beside them

- [ ] **Step 1: Read the failing pin** and confirm it asserts the strip, not something nearby.
- [ ] **Step 2: Add the handler** in the same shape as its siblings.
- [ ] **Step 3: Remove the `test.fail` pin** and run the case.
- [ ] **Step 4: Commit** with the row's close in the same change.

### Task 5.2: `crossOrigin` is derived and is serialised

**Files:**
- Modify: `src/web/packages/scene-fabric/src/persist.ts`
- Test: `src/web/tests/e2e/reference-theme.spec.ts`

**Interfaces:**
- Consumes: Task 5.1's handler shape
- Produces: a `crossOrigin` handler

- [ ] **Step 1: Confirm the pin, add the handler, drop the pin, run it.**
- [ ] **Step 2: Run the sibling strip cases** to prove the new handler did not over-strip.
- [ ] **Step 3: Commit.**

### Task 5.3: `vg-110`'s discarded validation result

**Files:**
- Modify: `src/web/packages/host/src/themes/store.ts`, `src/web/packages/editor/src/boot-theme.ts`

**Interfaces:**
- Consumes: the store's `validation` result
- Produces: a caller that reports the validation issues instead of a bare 404

- [ ] **Step 1: Write the failing case** — an invalid theme must not present as success.
- [ ] **Step 2: Carry the validation result to the caller** and decide the editor's report from it.
- [ ] **Step 3: Run the case, then commit the three rows' closes.**
- [ ] **Step 4: Note the spec half** — D7's `vg-041`/`vg-188` ruling owns which properties are derived in general; this task fixes two instances and does not pre-empt it.

---

# Phase 6 — W5: manager protocols and single-owner facts (5 rows + Task 6.5's eight)

**Outcome:** the session and the managers name one owner per fact, and `vg-364`'s deadline is checked rather than worked.

**Owners:** the session, the managers, and a spec for `vg-240`'s protocol if D8 ruled one is owed.

**Constraints:** **gated on D8's rulings** (Task 1.4) — do not start before they exist. `vg-364` is a deadline, not a task: its subject is `vg-232`…`vg-248`, so it closes when they do.

**Acceptance:** `vg-365` and `vg-367` each name one owner for their one concept in two modules; `vg-232` and `vg-239` land on the owner D8 named; `vg-364` closes only against the closed set. [Annotated 2026-10-13, when the phase opened, by two rulings. **(1) The eight ruled rows nothing lands.** D8's nine were consumed here as gates — Tasks 6.2, 6.3 and 6.4 name four rows between them (`vg-365`, `vg-367`, `vg-232`, `vg-239`) — and no task anywhere in this plan names `vg-104`, `vg-241`, `vg-242`, `vg-247`, `vg-248`, `vg-342`, `vg-343` or `vg-381`, each of which the user **ruled** on 2026-10-12 and each of which carries an implementation decision (*one function in the token owner*, *the repair moves to the chart descriptor owner*, *scene-fabric owns the fact*, *migrate the inspector's column to it*, *retire the mount path and the clamp together*, *remove the inert option*). A ruling no task implements is the residue the drain exists to end, so **Task 6.5 lands them**, and the phase's row count is 5 + 8. **(2) Task 6.2's `vg-365` half is ordered after `vg-247`.** That row's surviving half is `hasUnlockedSelection` stating ClipboardManager's and DeletionManager's refusal from outside both modules, and its own corrected text says the half *"defers to rank 1 and `vg-247`"*: the restatement is a `locked` test, so it can only ask the predicate once `vg-247`'s ruling has given that predicate a home. The dependency is real, not stylistic — a `vg-365` closer that lands first would re-spell the predicate a fourth time. **(3) Annotated 2026-10-13 at the phase's close: 11 of the 13 rows are `verified` and 2 stay `open`, and `vg-364` does not close.** Verified: `vg-247`, `vg-248` (`9eec23db`, `89896156`), `vg-365`, `vg-367` (`7a70a0cb`), `vg-232`, `vg-239` (`54189f6b`), `vg-104` (`d386a6ce`), `vg-241` (`95201730`), `vg-242` (`82e08e74`), `vg-343` (`f75edc3e`), `vg-381` (`678efef9`). Open: **`vg-240`**, which waits on the re-shape its protocol spec describes — writing a spec closes nothing, and the plan's own Acceptance says so — and **`vg-342`**, which Task 6.5b declined to close rather than close dishonestly: migrating the inspector's per-kind column to `settingsField` is a rendered-surface rewrite that would reverse `4dc220c6` and needs a browser run, so the row keeps both its named remedies. **Task 6.4 is discharged as the reading it always was** — `vg-364`'s span is 14 `verified` / 3 `open` (`vg-234`, `vg-240`, `vg-245`), so its Step 2 fires and the deadline outlives the phase, which the plan recorded before the phase ran. **Two things the phase produced that its Acceptance did not anticipate, both recorded rather than smoothed over:** its two closes each had a `verified` check falsified by review, in the claim's *scope* rather than in the fact it named (`vg-247`'s "no module spells the test itself", `vg-367`'s "the one walk of every object at any depth"), and **the repo's own `npm run gate` was red for the whole phase** — it had not been run at any close since Phase 5, and running it here found `biome` errors in Task 6.5b's files plus a Phase 5 regression in `dead-code-sweep`'s negative fixture, whose cause and correction are on Phase 5's Acceptance above (`a50870b5` → `b1383446`). Four rows were filed from the phase's findings rather than folded into it: `vg-411`, `vg-412`, `vg-413`, `vg-414`.]

**Failure modes:** implementing a protocol re-shape D8 declined; closing `vg-364` while any of `vg-232`…`vg-248` is still open.

**Verify:** `npm run ownership:sweep`, `npm run typecheck`, and the row-level checks.

### Task 6.1: The protocol spec, if D8 owed one

**Files:**
- Create (only if ruled): a spec under `docs/superpowers/specs/`
- Modify: `docs/product/backlog.jsonl`

**Interfaces:**
- Consumes: D8's ruling on `vg-240` — "a spec, or the duplicate axis stays"
- Produces: either a spec the later tasks argue from, or a ruled row with no spec

- [ ] **Step 1: Grep `vg-240`'s line for the marker format.** No marker, no task.
- [ ] **Step 2: If the ruling owes a spec**, write it in `docs/superpowers/specs/` in the repo's own shape and link it from `vg-240`'s line. If it does not, record that and take the next task.
- [ ] **Step 3: Commit.**

[Annotated 2026-10-13: **this task took four attempts, and what was tried belongs in the record.** Attempts 1 and 2 (one seat, resumed once) were each terminated by a gateway stream idle timeout — `StreamIdleTimeoutError`, two stream events and then nothing for 180 s — and left nothing on disk: no spec file, no `vg-240` edit, no commit. Two failures with the same shape were read as a context-size problem, so attempt 3 was a *fresh* seat scoped to write in stages; it landed `13d5c73e` (scaffold) and `b7fafcdc` (the protocol and the axis question) and then died the same way, which refuted that diagnosis: the fresh seat's first stream event arrived after 7.3 s and then the stream went silent, so the delay was never the agent's accumulated context. The variable that differed from the seats that ran clean all session was the **model**, and the three failures were all on one; attempt 4 therefore runs on another and is scoped to finish the partial document rather than rewrite it. The partial spec is the useful residue: sections 1–3 are written and its four stub sections are marked "Pending", so a fifth attempt would not start from nothing either.]

### Task 6.2: One concept, two modules

**Files:**
- Modify: the two modules each row names

**Interfaces:**
- Consumes: D8's ownership answers
- Produces: one owner per fact

Rows: `vg-365`, `vg-367`.

- [ ] **Step 1: Grep D8's nine rows for the marker format** — the phase is gated on the cluster's answers (`vg-104`, `vg-240`, `vg-241`, `vg-242`, `vg-247`, `vg-248`, `vg-342`, `vg-343`, `vg-381`), so a missing marker stops this task rather than changing these files. Then for each row read both modules and write the case that fails today: the two spendings of one fact disagree.
- [ ] **Step 2: Delete the second spending.** Convergence by re-spelling is the failure the ownership map exists to prevent.
- [ ] **Step 3: Run the case, then `npm run ownership:sweep`.**
- [ ] **Step 4: Commit.**

[Annotated 2026-10-13 at the task's close, and the annotation is about the step's premise rather than its outcome. **Step 1's premise was wrong for both rows, and the case it asks for cannot exist.** `vg-365` and `vg-367` do not disagree today — the report measured it before choosing its evidence, and each row's two spellings are reachable without the other, so no input makes them contradict and no case can fail first on a disagreement. What the task closed on instead is **mutation**: the shared walk re-spelled root-only failed four cases, and eligibility losing its lock term failed `expected [ 'copy', true ] to deeply equal [ 'copy', false ]`. Both rows are `verified` against `7a70a0cb`; `sceneObjects` (`asset-manager/index.ts:421`) is now the one at-any-depth walk, spent by `assetReferencedBy` and `editor-shell.ts:137`, and `editor-shell.ts`'s own comment records that it must not re-spell the depth rule. **A review diff for this task is `34fd00c6..d69840fb`, not `BASE..HEAD`**: the agent recorded its base as `0223c7f5` and nine other-seat commits landed between that base and its first commit, so the range and `HEAD~2` both name someone else's work. Two rows it found and could not file are in as `vg-411` (`arrangeEligible` restating `canArrange`'s refusal from a pure `ObjectTarget`, the same asymmetry this row's own text records) and `vg-412` (the asset-reference union split between `asset-manager` and `editor-session.ts`); a third concern, `#holdsAsset` as a third spelling, was refuted from its own docstring before filing. **Its task review then falsified a claim inside `vg-367`'s own archived `check`** — `sceneObjects` was called "the one walk of every object at any depth", and the recursion survives in eight other modules for other questions, three of which the controller read. The check is scoped to the walk *this question reads* (which is what the task fixed) and **`vg-413` files the surviving fact**, because whether the depth rule is one fact behind one helper used read-side and write-side is a design decision. The lesson is this row's own: a `verified` row's `check` is a claim like any other, and both of this phase's closes have now had one falsified by review.]

### Task 6.3: The two manager rows

**Files:**
- Modify: the manager rows `vg-232` and `vg-239` name

**Interfaces:**
- Consumes: Tasks 6.1 and 6.2
- Produces: two landed rows

- [ ] **Step 1: `vg-232`** — implement the owner D8 named. [Ruled 2026-10-13: **no ruling names an owner for this row** — it is not one of D8's nine and carries no `RULED` marker, so "the owner D8 named" is a dangling reference in this plan. The owner comes from the row's own text, which is what this step means: `editor-session.ts` decides the receiver list inline, once per setter, and the lists disagree (`#setPalette` `:1145-1158` calls six owners, `#setTypes` `:1187-1194` three, `#deleteType` `:1219-1235` two). The fix is one receiver list the setters share rather than three spellings of it — the owner is `editor-session.ts` and no further ruling is owed.]
- [ ] **Step 2: `vg-239`** — same, on its own manager. [Ruled 2026-10-13: the row states its own owner — *"OWNER: `editor-session.ts`. SEVERITY: low"* — because `#save` spells `(await this.#capture(options)) ?? this.#thumbnail` inline at `:723` while `#picture` (`:734-738`) is what `#writeLibrary` (`:802`) calls. The fix is to call `#picture` from `#save`; no further ruling is owed.]
- [ ] **Step 3: Run the focused suites for both, then `npm run ownership:overlap`.**
- [ ] **Step 4: Commit.**

### Task 6.4: `vg-364` as a deadline

**Files:**
- Modify: `docs/product/backlog.jsonl`

**Interfaces:**
- Consumes: the state of `vg-232` … `vg-248`
- Produces: a closed `vg-364`, or a stated reason it stays open

- [ ] **Step 1: Check the 17 rows `vg-232`…`vg-248`** — every one closed, in either register file.
- [ ] **Step 2: If any is open, leave `vg-364` open and say so** in the phase report. It closes with them, not before.
- [ ] **Step 3: If all are closed, close it** with a `check` naming the manager protocol set, and commit.

[Ruled 2026-10-13, before this task runs: **Step 2 fires, and three of the seven open rows do not close anywhere in this plan.** The span is 17 ids — measured as a **set**, because an earlier reading of the same span said 9 open / 8 closed and today's says 7 / 10, the movement being Task 6.5a's two. Task 6.3 and Task 6.5b close four (`vg-232`, `vg-239`, `vg-241`, `vg-242`); the three that remain are not this phase's to close — **`vg-240`** waits on the re-shape its protocol spec describes, since writing a spec closes nothing, and **`vg-234` and `vg-245`** are held open by Phase 3's own ruling, each carrying a reading that names what its map row discharged and what it did not. So this task is dispatched as a **reading, not a close**: its outcome is Step 2's stated reason, and `vg-364` carries into a later phase. The rule the reading obeys is D1's — a set of ids, never a count over lines.]

### Task 6.5: The eight rows D8 ruled and nothing lands

**Files:**
- Modify: whichever module each ruling names — `vg-104` the token owner, `vg-241` the editor's own fit, `vg-242` the chart descriptor owner, `vg-247` a lower shared module, `vg-248` scene-fabric, `vg-342` the inspector's per-kind column, `vg-343` the legacy mount path, `vg-381` `importImage`
- Test: one focused case per ruling, in the module that gains the owner
- Modify: `docs/product/backlog.jsonl` / `backlog-archive.jsonl` (eight rows)
- Modify: `docs/architecture/ownership.md`, for the concepts whose owner moves

**Interfaces:**
- Consumes: the eight `RULED 2026-10-12` sentences in those rows' own `detail`
- Produces: eight `verified` rows, each `check` naming the capability its ruling decided

- [ ] **Step 1: `vg-247` and `vg-248` first, together** — both rulings put a Fabric fact in a lower shared module (*"a lower shared module owns the predicate"*, *"scene-fabric owns the fact"*), so they land as one change in that layer, and Task 6.2's `vg-365` half waits on the first of them.
- [ ] **Step 2: Then the six whose owner is already named** — `vg-104` (one function in the token owner, each caller passing its own filter), `vg-381` (remove the inert `scale` option), `vg-239`'s sibling shape in `vg-343` (retire the mount path and the clamp in one commit), `vg-342` (re-point the per-kind column at `settingsField`), `vg-242` (move the repair to the chart descriptor owner), `vg-241` (the editor's contain rule gains the refusals `renderer-core` already has).
- [ ] **Step 3: A row closes only on evidence that could have failed** — the case is written before the change, run red, then green; a removal (`vg-381`, `vg-343`) proves the removal by the case that would have caught the option being read.
- [ ] **Step 4: Run `npm run ownership:sweep`, `npm run ownership:overlap`, `npm run typecheck`, then close the eight rows.** The map is corrected in the same commit wherever a ruling moved an owner, because a map that still names the old owner is the contradiction the next session reads.

---

# Phase 7 — W6: test and evidence instrument hygiene (19 rows)

**Outcome:** the two single-file instruments that serialise are fixed, and the independent rows are fixed by file.

**Owners:** `src/web/packages/editor/src/ui-copy.test.ts` (`vg-335`, `vg-338`), `src/web/packages/editor/src/ui-copy.ts` (`vg-337`), `scripts/design-md.mjs` (`vg-356`), and one file each for the rest.

**Constraints:** the copy walk and `design-md.mjs` are one seat each. `vg-337` is a copy table's exemption from the 800-line stop, so it is the one place a line-count rule is discussed rather than obeyed.

**Acceptance:** every one of the 19 has a run recorded against it; the two serialising files each have one author.

**Failure modes:** fixing a vacuous assertion by making it assert what the code already does; a line-count row closed by moving lines rather than by the exemption it asks for.

**Verify:** the focused vitest file per row; `npm run design:md` after the `design-md.mjs` change; `npm run backlog:check` at the batch's end.

**Closed 2026-10-13, base `720daa22`.** All twenty rows the phase owned are decided: nineteen `verified`, and the twentieth is `vg-175`, which was closed on a falsified premise and **reopened `open`** by its own review (`614265de`) — the row's finding is that a test whose verdict depends on what else is running is evidence neither way, so a green run on an idle box measures the opposite of the condition the row records, and its named twin `vg-164` stayed `open` on exactly that reasoning. **Four of the closes are refutations, not fixes** — `vg-135`, `vg-186`, `vg-215` and `vg-333` did not reproduce at HEAD — and each carries a dated `RULED 2026-10-13` correction on its archived line so a later session does not re-investigate a gap that is not there. `vg-215` is the one of the four that landed an artefact anyway: the close assertion the row said could not be written under jsdom is written (`24f8dd96`). `vg-337` closed the way Step 3 asks — the exemption is written down in `ui-copy.ts`'s own header rather than satisfied by moving lines — and neither of the phase's two failure modes occurred. Four rows came out of the phase's reviews instead of being lost: `vg-415`, `vg-416`, `vg-417`, `vg-418`. The two serialising files each had one author, and every one of the twenty has a commit recorded against it.

**The gate, run by the controller at `614265de` from `src/web/`:** `npm run gate` **exit 0** — `biome check` 629 files with no fixes applied, `gates:self-test` with all ten self-tests passing, and the unit suite 252/252 files and 3326/3326 tests. `npm run design:check` **exit 0** (lint clean, `DESIGN.md` and `editor-shell.css` in sync, 307 citation sources clean) and `npm run backlog:check` **exit 0** (418 items across both registers, all valid).

### Task 7.1: The copy walk's two rows

**Files:**
- Modify: `src/web/packages/editor/src/ui-copy.test.ts`
- Modify: `docs/product/backlog.jsonl`

Rows: `vg-335`, `vg-338`.

- [ ] **Step 1: Read each row's finding** in `triage-B5.md` — both are the sweep over the copy table and its surface.
- [ ] **Step 2: Fix the walk, add the case, then apply §8.7's citation correction if the row cites `.superpowers/sdd/`.**
- [ ] **Step 3: Run the file, commit.**

### Task 7.2: `design-md.mjs` and the citation rows

**Files:**
- Modify: `scripts/design-md.mjs`
- Modify: the files `vg-371` and `vg-377` name

Rows: `vg-356`, `vg-371`, `vg-377`.

- [ ] **Step 1: `vg-356`** — the fix `design-md.mjs`'s row names.
- [ ] **Step 2: `vg-371` and `vg-377`** — the line-citation and comment rows; §8.2's stale `editor-shell.css` line numbers are the same defect class and are corrected here where these rows cite them.
- [ ] **Step 3: `npm run design:md`, commit.**

### Task 7.3: The jsdom stall

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

Rows: `vg-135`, `vg-186`.

- [ ] **Step 1: Grep `vg-186`'s line for the marker format.** No ruling, no change to this file.
- [ ] **Step 2: Reproduce the 50–90 s stall** with `npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx`.
- [ ] **Step 3: Apply the mechanism D9's `vg-186` ruling named** — DOM isolation, a separate file, or the leak.
- [ ] **Step 4: Run it, commit.**

[Ruled 2026-10-13, read before this phase runs, and the two corrections are about reading the ruling rather than following it. **(1) The mechanism is not a menu of three.** `vg-186`'s ruling chose **DOM isolation** — "tear down the earlier menu inside the test that opened it, so no test in the file depends on where it sits" — and rejected the other two in its own words: *"A separate file is rejected because it MOVES the dependency instead of removing it — the stall follows the pair into whichever file holds both — and chasing the leak is the same unestablished hypothesis with a longer investigation."* Step 3 lists all three as live choices, so following it literally could land a rejected remedy. **The ruling's proof condition is also fixed and must be the evidence**: "the proof that isolation worked is the sheet test running FIRST in the file and still passing; until that is shown the ordering guard stays" — so the case is the sheet test moved first, not merely a green file. **(2) `vg-186` joins this task's rows.** Step 3 already applies that row's own ruled mechanism to that row's own file, and a mechanism applied while its row stays open is the residue Task 6.5 was added to end — the same shape as the eight ruled rows no task landed. **If the applied isolation does not in fact fix the unmount stall, `vg-186` stays `open` and the report states the reading rather than the task reaching for the close**, which is Step 2's shape in Task 6.4. `vg-135` and `vg-186` are one file and one root — two Base UI surfaces stalling the same jsdom frame state — and Phase 1 took `vg-186`'s ruling, not its close.]

### Task 7.4: The independent single-file rows

**Files:**
- Modify: the file each row names

Rows: `vg-175`, `vg-177`, `vg-181`, `vg-215`, `vg-216`, `vg-251`, `vg-273`, `vg-288`, `vg-333`, `vg-337`, `vg-339`, `vg-378`, `vg-383`.

- [ ] **Step 1: `vg-177`** — a NUL byte in a source file; `vg-181` a duplicated doc comment; `vg-216` a missing `outputDir`; `vg-383` a minute-boundary flake. Each is a one-file fix with its own case.
- [ ] **Step 2: `vg-251`** — vacuous converted-surface cases: the fix is a case that can fail.
- [ ] **Step 3: `vg-337`** — the copy table's exemption from the 800-line stop: write the exemption down against the rule, rather than moving lines to satisfy a count.
- [ ] **Step 4: `vg-333`, `vg-339`, `vg-378`, `vg-273`, `vg-288`, `vg-215`, `vg-175`** — the naming audit, the View-menu case, and the rest; each closed against its own file's check, and `vg-333`'s line takes §8.11's stale-owner-path correction as it closes.
- [ ] **Step 5: Run the focused files together, commit per file group.**

---

# Phase 8 — W7: one-owner fixes on the editor surface (19 rows)

[Annotated 2026-10-13 at the phase close: **the 19 does not add up from this phase's own task lists, and the discrepancy is real rather than a miscount here.** Task 8.1 lists two rows, Task 8.2 ten, Task 8.3 six and Task 8.4 two (`vg-331` and `vg-334`, per its Step 1) — twenty. Task 8.3's own sentence says its six are "the six of the 19", which fixes the total at nineteen and leaves Task 8.4 owing exactly one. The reading the phase ran on, and the one that matches the register, is that **`vg-334` is the nineteenth**: it is the half Task 8.4 actually seated, it carries two `RULED` markers, and `vg-331` carries none. So `vg-331` was never one of the nineteen and its brief's inclusion of it was the error. Phase 8 therefore closes **seventeen**, the nineteen less `vg-133` and `vg-154`.]

**Outcome:** nineteen rows with a named single owner and no open ruling are fixed, two of them by a vitest gate rather than a browser run.

[Annotated 2026-10-13 at the phase close: **two of the nineteen leave the phase and are not fixed here.** `vg-133` was seated on the premise that it has "a named single owner and no open ruling"; it has neither, and building it means settling what a lens's inset is, per device, and whether the safe area masks or only overlays — decisions the spec does not make and `display-lens.ts`'s own comment refuses to invent ("a shape, never a size… silently settling a second thing nobody asked about"). It stays open for the device-lens work that follows the drain. `vg-154` was reopened during the phase by its own review — its replace half is unmet, and recording a gap is not building the capability — and it is not a file-safe seat here. The phase's Outcome is therefore **seventeen rows**, with both departures recorded on their own lines.]

**Owners:** one file per row. `vg-304` and `vg-320` are the `PARITY` reader in `src/web/tests/e2e/mockup-values.test.ts` (vitest). `vg-331` is a `§4` clause plus six palette values in `DESIGN.md` and the palettes.

**Constraints:** parallel-safe **by file** — several seats, no shared file. `vg-304`/`vg-320` are the parity reader's two rules and pair with W1's design-language rows as one gate, but are not deferred and run under vitest.

**Acceptance:** each row's own check; `vg-320`'s identifier is `RADIUS` at `design-language.spec.ts:2887` (§8.6), not `SCALE` at `:2541`. [Annotated 2026-10-13 at the phase close: that line number is **wrong and was measured wrong by Task 8.1's seat** — at HEAD `const RADIUS` is at `:3085` and its test at `:3075`, roughly two hundred lines from the number this plan states, which reads like a transposition of `RADIUS_DEGENERATE` at `:3087`. The seat corrected the archived row to the measured lines and the row is `verified` on them; this sentence keeps the wrong number only so the correction has a referent.]

**Failure modes:** two seats on one file; a `§4` clause added without the six palette values that satisfy it.

**Verify:** the focused vitest file or the browser case per row; `npm run gates:self-test` after the parity reader changes.

[Annotated 2026-10-13 at the phase close: **the phase's evidence, named as commands with their exit codes rather than as the claim that "gates run".** From `src/web/` at `3a368c6a`: `npm run build` exit 0; **`npm run gate` exit 0** (`biome check ..` + `gates:self-test` + `vitest run`: 254 files, 3353 tests, 95.77 s); **`npm run test:e2e` exit 1** — 273 passed, 18 failed, 214 skipped, 0 flaky (533 s). The browser pass is named separately because **`gate` does not run it**: `gate`'s `test` is `vitest run`, so every browser case this phase produced, including the three-surface destructive-paint case that carries `vg-226`, lives behind `test:e2e` alone.

**The 18 were triaged by comparison rather than by diagnosis, and the comparison is the record.** Re-run alone and serial at the same commit, **13 of the 18 passed** — the load the config itself names ("oversubscription is what turned the long `clock.runFor` waits into 30 s timeouts under load"), not a defect. The remaining 5 were then run against this phase's base `614265de` with the wave's 18 production files reverted and HEAD's tests left in place: **2 are this phase's** — `editor-rail.spec.ts:372`, whose selected-slot accent bar the §5-rule-6 resting `border: 1px solid transparent` moved 1px off the rail's inner edge (the test's own reconstruction then counted that border twice; both are fixed here), and `glass-lifecycle.spec.ts:25`, whose `> 10` repaint floor `97264e6c` deleted and which is filed as `vg-431` because repairing the instrument is a measurement decision rather than a patch — and **3 are pre-existing**, failing identically at base: `design-language.spec.ts:437`, whose fixture page is not a vite input and so is absent from every built `dist/`, and the two phone-`chromium` `editor-display.spec.ts` cases. **Corrected 2026-10-13: that is two, not three.** `design-language.spec.ts:437` fails whenever the run's build did not include `build:fixture`, and the case is not pre-existing, not a product defect and not a design-language violation: at `aa16a2c5`, with `npm run build` then `npm run build:fixture -w @vigilia/editor`, the same case **passes** in a whole-suite run (desktop-chromium, 15.4 s) — measured, and `packages/editor/dist` holds `control-fixture.html` after the second build and not after the first. Failing "identically at base" was the recipe's absence in both runs rather than a property of the code, so the misclassification is filed as `vg-438`; the two phone cases stand as the only pre-existing failures (`vg-258`).

**Row accounting: 17 of 21, not 19 of 19.** The denominator the header states was never the phase's; the four that stay open — `vg-133`, `vg-154`, `vg-308` and `vg-331` — each carry their reason on their own line rather than as an omission here.]

### Task 8.1: The parity reader's two rules

**Files:**
- Modify: `src/web/tests/e2e/mockup-values.test.ts`
- Modify: `docs/product/backlog.jsonl`

[Annotated 2026-10-13 at the phase close: **this list is incomplete and the seat edited the right files anyway.** `PARITY` and both new functions live in `tests/e2e/mockup-values.ts`, the reader beside the test; only the cases are in `.test.ts`. The seat's edits and the task review's findings both sit in the `.ts` file, which is what `vg-420` measures at 1512 lines.]

**Interfaces:**
- Consumes: `PARITY` (35 rows) and the drawings under `docs/design/mockups/current/`
- Produces: a rule proving a `PARITY` row's property is in the set its selector declares; a rule comparing a copied element's declarations with the original's in `docs/design/mockups/editor-shell.html`

- [ ] **Step 1: `vg-304`** — the `PARITY` row's property against its selector's declared set.
- [ ] **Step 2: `vg-320`** — a named copied-element list, current drawing against the original. Apply §8.6 to the row's line: `RADIUS` at `:2887`.
- [ ] **Step 3: Run the file under vitest**, and confirm both rules fail when disabled before trusting them.
- [ ] **Step 4: Commit.**

### Task 8.2: The editor-surface fixes, first half

**Files:**
- Modify: the file each row names

Rows: `vg-107`, `vg-117`, `vg-133`, `vg-154`, `vg-160`, `vg-170`, `vg-189`, `vg-203`, `vg-218`, `vg-220`.

- [ ] **Step 1: `vg-107`** — the whole-canvas redraw per chart repaint; both parts, including the author's `chartRefreshRate` control.
- [ ] **Step 2: `vg-117`** — the font catalogue spec contradicts the shipped query; the spec is wrong and the code is right, so the spec is amended and the browser gate moves.
- [ ] **Step 3: `vg-133`, `vg-154`, `vg-160`, `vg-170`, `vg-189`, `vg-203`, `vg-218`, `vg-220`** — one file each, each with its own case.
- [ ] **Step 4: Run the focused cases, commit per file so a red one does not hold the rest.**

### Task 8.3: The editor-surface fixes, second half

**Files:**
- Modify: the file each row names

Rows: `vg-224`, `vg-226`, `vg-317`, `vg-344`, `vg-353`, `vg-357` — the six of the 19 that Tasks 8.1, 8.2 and 8.4 do not own. `vg-317` and `vg-344` are the dialog's shared rules and are *adjacent* to Task 8.1's two, which own `vg-304` and `vg-320`: that task owns both gate rows, and this one never names them.

- [ ] **Step 1: `vg-317` and `vg-344`** — the dialog's shared rules, which §5.1 files under owners already named.
- [ ] **Step 2: The rest, one file each**, each closed against its own check.
- [ ] **Step 3: Apply §8.2's line-number and §8.11's path corrections** to any row in this phase whose cited line or path moved (`vg-224` cites an `editor-shell.css` line).
- [ ] **Step 4: Run, commit.**

### Task 8.4: §4's clauses and the palette derivation case

**Files:**
- Modify: `DESIGN.md` (§4), the six palettes, and the derivation case

**Interfaces:**
- Consumes: D3's rulings on `vg-308`, `vg-331` and `vg-334`
- Produces: one `§4` clause for the second-highlight role plus its six palette values; §4's minimum luminance separation if `vg-308` ruled one; the interior colour role `vg-334` names

- [ ] **Step 1: Grep `vg-308`, `vg-331` and `vg-334`'s lines for the marker format.** §5.1 files two of the fifteen rules on "§4 and the palette derivation case", and this is that seat; a ruled row with no clause is a rule still unbuilt. `vg-308` is browser-pinned and is ruled by Task 2.5 Step 4, so this seat takes `vg-331` and `vg-334` and waits for `vg-308`. [Annotated 2026-10-13 at the phase close: **this sentence is wrong in both halves and the seat ran accordingly.** Task 2.5 closed with **readings, not rulings** — it produced `vg-308`'s five luminance triples and wrote no marker — so `vg-308` is still open and unruled, and `vg-331` carries no marker either (its ruling was to come from the user's Task 1.3 session, which is unrun). A row with no `RULED` marker is not a row this phase may close, so **Task 8.4 runs only its `vg-334` half**, which is ruled twice on 2026-10-12. `vg-331` and `vg-308` stay open and are named in the phase's close.]
- [ ] **Step 2: Write each clause** as a small spec, not an edit — `vg-331` is a role, not a value.
- [ ] **Step 3: Add the values and the derivation case that proves them**, including `vg-308`'s ladder magnitude if it ruled a floor exists.
- [ ] **Step 4: `npm run design:check`, then commit** with the rows' closes.

---

# Phase 9 — W8: structural stops and the plans directory (4 rows)

**Outcome:** two files past the 800-line stop are split with the split's warrant re-established, and the plans directory answers "what is executable" truthfully.

**Owners:** `src/web/packages/editor/src/editor-shell/shell-layout.tsx` (986), `src/web/packages/editor/src/editor-session.ts` (1077), `docs/superpowers/plans/` and its `README.md`.

**Constraints:** independent of everything else in the drain — parallel-safe. A split must be by responsibility, not by line count: the vendored-source exception does not apply here, and neither does moving lines to fit.

**Acceptance:** both files are below the stop with a named responsibility per resulting file; the README's rule and `AGENTS.md`'s rule agree, and every plan under `docs/superpowers/plans/` is executable.

**Failure modes:** a split that leaves one 700-line file and three shims; moving a plan to `archive/` while something still depends on it.

**Verify:** `npm run typecheck`, the affected suites, and a re-read of the plans directory's contents against the README.

### Task 9.1: Split `shell-layout.tsx`

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Create: the split's files

Rows: `vg-276`.

- [ ] **Step 1: Map the file's responsibilities** and name the resulting files before editing.
- [ ] **Step 2: Split by responsibility**, moving tests with their subject.
- [ ] **Step 3: Run the DOM suite for the shell, then `npm run typecheck`.**
- [ ] **Step 4: Close `vg-276`** — a `check` naming the split and the line count the row claims, an `artefacts` sha for the split's commit, and the move to the archive. Apply §8.9 to its line first: the count of 916 has drifted to **986**.
- [ ] **Step 5: Commit.**

### Task 9.2: Split `editor-session.ts`

**Files:**
- Modify: `src/web/packages/editor/src/editor-session.ts`

Rows: `vg-374`.

- [ ] **Step 1: Map the responsibilities** — note that the save protocol's warning subsystem has already left this file (`vg-373`, which is D11's rename decision, ruled in Task 1.5), so the split does not owe it a home.
- [ ] **Step 2: Split by responsibility**, keeping the session's public surface unchanged.
- [ ] **Step 3: Run the session's suites, `npm run typecheck`.**
- [ ] **Step 4: Close `vg-374`** — a `check` naming the split, an `artefacts` sha for the split's commit, and the move. Its line count (1077) is current.
- [ ] **Step 5: Commit.**

### Task 9.3: The plans directory

**Files:**
- Modify: `docs/superpowers/plans/README.md`, the directory's contents

Rows: `vg-152`, `vg-161`.

- [ ] **Step 1: List what is in `docs/superpowers/plans/`** and which of those are executable; anything closed or superseded moves to `archive/`, once no active or queued plan depends on it.
- [ ] **Step 2: Reconcile the README's unconditional rule with `AGENTS.md`'s conditional one** — which of the two is the rule, written once.
- [ ] **Step 3: Re-read the directory** and confirm the README is now true.
- [ ] **Step 4: Commit**, closing `vg-152` and `vg-161` against the README's own text.

---

# Phase 10 — W9: the unowned mockup-parity plan (2 rows)

**Outcome:** the settings modal's thirteen failing measured regions are fixed against the drawing, under a parity gate that no longer accepts any reason for a divergence.

**Owners:** the parity gate (`tests/e2e/mockup-values.test.ts` / `design-language.spec.ts`), `docs/design/mockups/current/`, the settings modal's own components.

**Constraints:** **gated on D4 and D3/D6** — `vg-291`'s ruling decides whether these two rows are one row or one plan, and D3/D6 settle the treatments the modal is being brought to. No plan owns this today; the drain's phase does. `vg-292` and `vg-293` would each be *pinned* by a capture rather than closed by one (§7), so the fix is the work, not the capture.

**Acceptance:** the settings modal passes the drawing comparison on the regions the gate measures; the gate's reason policy is a rule, not a per-row allowance.

**Failure modes:** repainting the product to a drawing nobody ruled on; a gate reason so broad it accepts the failure it was written to catch.

**Verify:** the parity suite on a built bundle, one suite at a time (`--workers=1`).

### Task 10.1: The gate's reason policy

**Files:**
- Modify: the parity gate's reason handling

**Interfaces:**
- Consumes: D4's ruling on `vg-291` and D3/D6's treatment rulings
- Produces: a gate that accepts a reason only when a rule licences it

- [ ] **Step 1: Grep D4's rows for the marker format.** `vg-291` decides whether this phase owns one row or two; D3/D6 decide the treatments.
- [ ] **Step 2: Reproduce the gate's acceptance of any reason** — a divergence with a reason passes today.
- [ ] **Step 3: Bound the reason to a licensed rule**, per D4's ruling.
- [ ] **Step 4: Run the gate, then commit.**

### Task 10.2: The settings modal's thirteen regions

**Files:**
- Modify: the settings modal's components and the values they compose

- [ ] **Step 1: Run the comparison** and list the thirteen failing regions from the run's own report.
- [ ] **Step 2: Fix them region by region**, taking each region's drawn value from `docs/design/mockups/current/` and its palette from the ruled derivation — Task 8.4's clauses where they apply.
- [ ] **Step 3: Rebuild and re-run the comparison**; the count is evidence, not the goal.
- [ ] **Step 4: Commit per region group.**

### Task 10.3: Close, and collapse the family

**Files:**
- Modify: both register files

**Interfaces:**
- Consumes: Tasks 10.1 and 10.2
- Produces: `vg-292` and `vg-293` closed; the `vg-291`/`vg-292`/`vg-293` family collapsed once (§8.3)

- [ ] **Step 1: If D4's `vg-291` ruling made this one row**, close the pair as one and say so on both lines.
- [ ] **Step 2: Apply §8.2 to `vg-292`'s line, then `check` each against its own title, find each sha, prove, move, `npm run backlog:check`.** Its `editor-shell.css` citation is stale like the other 24, and the correction lands before the move so the archived line is right the first time — this is the only step that owns it.
- [ ] **Step 3: State the end state in `STATUS.md`** — the drain's phase list complete, the register's open count, and the parked pair still parked.
- [ ] **Step 4: Commit.**

---

## 11. The ruled work no phase took

**D5's ruling of 2026-10-12 produced work this plan never carried.** Measured on 2026-10-13 (`vg-228`, `vg-286`): none of D5's five rows appears in any phase list, and the plan's closing rule lets a ruled row close only on the phase that lands its change. The criterion the ruling left open — what "a test file that renders the shell" means to a checker — was put to the user on 2026-10-13 and answered: **everything that renders or drives the shell**. Phase 11 exists to land that, and its rows are D5's three the criterion settles (`vg-228`, `vg-267`, `vg-286`).

The other two are not in it, and the reason is written on them: `vg-271`'s question is the Acceptance item's wording, and `vg-274`'s is whether `editor-shell.css` joins the gated list — neither is a membership question, so neither is answered by the criterion.

### Task 11.1: The membership rule, and the test files that render the shell

**Files:**
- Modify: `scripts/design-tokens.mjs`, `scripts/design-tokens.gated.json`
- Test: the checker's own self-test, `node scripts/design-tokens.mjs --self-test`

**Interfaces:**
- Consumes: the 2026-10-13 criterion as recorded on `vg-228`
- Produces: a gated set whose test half is derived on every run; the selection the later two tasks convert

- [ ] **Step 1: Derive the test half of the gated set.** Every `*.dom.test.tsx` under `src/web` (a test file that renders the shell) and every Playwright spec under `src/web/tests/e2e/` that opens the editor preview (a test file that drives it) joins the set the checker scans; the test-file entries leave `design-tokens.gated.json`, which keeps its source files, so the rule is test membership's single owner. The existing empty-set guard covers the derived half: a rule that selects nothing fails rather than passing.
- [ ] **Step 2: Extend the self-test over both halves** on a scratch tree — a selected file is scanned and an unselected one is not — so the rule's firing is proved without the repo's own files being the proof.
- [ ] **Step 3: Red-proof the rule.** A literal planted in a `*.dom.test.tsx` and in a driving spec reads red naming both; the same tree with the rule removed reads green, which is what says the rule is what caught it.
- [ ] **Step 4: Make the selected `*.dom.test.tsx` files clean**, which is 10 files and 44 literals today. Fixture data moves to a fixture module beside its test — the repo's existing pattern (`glass-fixture.ts`, `host-theme.ts`) — and an assertion that pins a rendered product value reads that value's owner rather than restating it. No literal is silenced by a comment and no assertion is weakened to pass.
- [ ] **Step 5: Run `npm run gate`, then commit** with the counts: files the rule selects, files converted, literals converted.

**Acceptance:** the selection is derived on every run and printed by the checker; every selected `*.dom.test.tsx` is clean, so the gate's exit code is the evidence; the self-test covers both halves of the rule.
**Failure modes:** a rule that selects nothing and passes; a fixture moved to dodge the rule while the product value it pins stays unowned; an assertion deleted rather than re-owned.

### Task 11.2: The driving specs, and what a spec may restate

**Files:**
- Modify: the Playwright specs that open the editor and carry literals

**Interfaces:**
- Consumes: Task 11.1's rule
- Produces: every driving spec clean; `vg-286`'s six measured violators among them

- [ ] **Step 1: Convert the driving specs' literals** — 12 files and roughly 102 literals at Task 11.1's landing, `design-language.spec.ts` the largest by far. Fixture data moves to a fixture module; a spec that pins a rendered value reads the owner of that value.
- [ ] **Step 2: Where a spec's literal is the drawing's own value** (`design-language.spec.ts` compares the product to `docs/design/mockups/`), the value comes from the drawing reader rather than from a second copy of the number, so the instrument keeps one source.
- [ ] **Step 3: Run the affected specs one file at a time** on a rebuilt bundle (`--workers=1`), then `npm run gate`.
- [ ] **Step 4: Commit**, naming the files converted and the literals removed.

**Acceptance:** the gate is green with the rule in place and no spec skipped, narrowed or deleted to get there.
**Failure modes:** a spec weakened into passing; a parity comparison that stops comparing; fixtures moved wholesale so the rule's coverage reads wider than it is.

### Task 11.3: Close D5's three

**Files:**
- Modify: both register files, `STATUS.md`

- [ ] **Step 1: Close `vg-228`, `vg-267` and `vg-286`** as `verified`, each with a `check` naming a word from its own title and `artefacts` naming Task 11.1's and 11.2's commits.
- [ ] **Step 2: Leave `vg-271` and `vg-274` open**, and say on each line which question survives — the Acceptance item's wording, and the stylesheet's membership.
- [ ] **Step 3: `npm run backlog:check`, `npm run status:check`, commit.**

**Acceptance:** the three carry a check that names their own subject and a resolvable ancestor sha; the two left open say why in their own lines.

---

# Phase 12 — the 2026-10-14 rulings no phase carried (13 rows, and `vg-330`'s spec)

**Created by a ledger ruling of 2026-10-14 and run under it** — `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`,
"Session 2's rulings taken on 2026-10-14" → "Ruling: the drain runs Phase 10 first, then a new Phase 12
for the ruled work". **Its first two groups were dispatched as named groups rather than numbered
tasks, so until 2026-10-15 this plan referenced "Phase 12" in five places without containing it.**
Written here so a session arriving through `STATUS.md` — which says *"Phase 12 continues"* — can find
it at all. That gap is the reason this section exists; it is not a re-plan of ruled work.

**Every row here carries its ruling in its own `detail`, in the `RULED 2026-10-14:` marker format.**
That is where the decision lives, and this phase states only the order and what each task owes.

| group | rows | state |
|---|---|---|
| 1 the two drawing corrections | `vg-306`, `vg-436` | **landed** — both `verified` |
| 2 the self-contained product fixes | `vg-109`, `vg-182`, `vg-185`, `vg-029` landed; `vg-155`, `vg-040` open | part-landed |
| 3 the ones needing a measurement | `vg-037`, `vg-450`, `vg-190`, `vg-447` | not started |
| 4 the wide ones | `vg-230`, `vg-269`, `vg-274`, `vg-023`, `vg-056`, `vg-123` | not started |
| then `vg-330`'s spec | `vg-330` | not started, and it is a brainstorm → spec → plan of its own |

**Group 1 had to land first** because `vg-306` and `vg-436` change the drawings every other row in this
phase is read against. It has. **Group 3 runs before group 4** because each of its four rows needs a
measurement taken before its fix can be judged, and a measurement taken after a wider change is a
measurement of the wider change.

**Constraints on this phase.** `vg-274` is `editor-shell.css` joining the gated list — a ratchet
conversion of 94 values — and Task 13.1 has since edited that stylesheet, so its row's count is a
count taken before that edit and must be re-taken rather than trusted. `vg-330`'s unparking redraws
the settings *drawing* as a panel, and Phase 10 fixes the settings *modal* against the drawing as it
is drawn today: **the ruling is that Phase 10 does not wait**, because the pane spec is unwritten and
the drawing is the instrument Phase 10 is measured against until then.

**Restated as `### Task` headings on 2026-10-15, having run as `- [ ]` items until then.** The plan's own
counting method reads a row as carried when a `### Task` block names it, and as `- [ ]` items this
section sat inside *Phase 10's* last task block — everything before the next heading of that form belongs
to it — so **these 13 rows counted as Phase 10's**, and Phase 10 would have appeared to own thirteen rows
it never had. The tasks are the same tasks, in the same order, with the same rulings on the same rows;
only the form changed, and it is now the form every other phase uses.

### Task 12.1: The two drawing corrections

- [ ] Landed. `vg-306` and `vg-436` separately, one commit each, the drawings README split by hunk.

### Task 12.2: The self-contained product fixes

- [ ] `vg-109`, `vg-182`, `vg-185` and `vg-029` landed, one commit each. **`vg-155` and `vg-040` remain**
      and are this task's open half: the pane must say which of the two things an import did, and the
      draft must survive a crash with recovery offered.

### Task 12.3: The four that need a measurement

- [ ] `vg-037`, `vg-450`, `vg-190`, `vg-447`. Each is a different owner — `vg-450` names
      `editor-shell/controls/tooltip.ts`; the other three's owning landmark is **read from the row's own
      `RULED` marker and its measured section rather than named here**, because this section was written
      from the ruling's grouping and not from the rows, and naming a file this session has not read is
      the mistake two briefs already made. Take each measurement first and record it on the row; a fix
      judged without it is the failure mode.

### Task 12.4: The six wide ones

- [ ] `vg-230`, `vg-269`, `vg-274`, `vg-023`, `vg-056`, `vg-123`. Same rule on landmarks, same reason.
      These reach several panes each, so **they are grouped by file ownership when this task is written**
      — as Phase 13's tasks were — rather than run as one dispatch, which is the arrangement that cost
      13.2 a split record. **Written 2026-10-15, from the rows read against the tree rather than from
      their titles**, and the grouping is:

- [ ] **12.4a `vg-056`, 12.4b `vg-230`, 12.4c `vg-269` — the serial cluster.** They share
      `editor-shell/bridge.ts` (`vg-056`'s additive selection, `vg-230`'s object total),
      `editor-shell/shell-layout.tsx` (`vg-230`'s status footer, `vg-269`'s four `Pane` mounts) and
      `panes/composition/composition-pane.tsx` (`vg-056`'s row click, `vg-269`'s Composition count), so
      **one writer per file per step and they run in that order** — `bridge.ts` and `shell-layout.tsx`
      each get exactly one author at a time.
- [ ] **12.4d `vg-123` — `snap-manager/index.ts` and `snap-manager/movement-snap-candidates.ts`**, with
      `tests/e2e/snapping.spec.ts` as its case. The measurement instrument already landed (`95e24b1f`),
      so this is the change the instrument was built to pin. Independent of the cluster.
- [ ] **12.4e `vg-274` — `editor-shell/editor-shell.css` plus the ratchet it joins**:
      `scripts/design-tokens.gated.json`, `scripts/design-tokens.mjs`'s `CEILINGS` entry, and
      `tests/e2e/design-language.spec.ts`. **It owns `editor-shell.css` outright**, so it runs after
      Task 12.3d's edits there have landed, which they have.
- [ ] **12.4f `vg-023` — the canvas dim.** **Dispatchable** — its brief was written 2026-10-15 and
      quotes the row's ruling verbatim (the dim is a view-layer effect the renderer draws at draw time
      and never object opacity). Its layer half already landed as `vg-058` at `b5e2f798`, so what
      remains is the canvas half plus the `DESIGN.md` §7 entry the dim has to have. It runs after
      12.4d's fix round, because the browser serves one shared `dist`.

### Task 12.5: `vg-330`'s spec

- [ ] **Step 1: `vg-330`'s spec is WRITTEN and awaiting the user's review (2026-10-16)** — `docs/superpowers/specs/2026-10-16-settings-pane-design.md`, and it answers the three questions the user ruled (the section headings become a vertical list, the pane is named `Editor Settings`, `vg-322` closes with the change) plus the four that were left open, each marked as a recommendation with its reversal cost. **The phase's Acceptance is not met by the spec alone** — it requires `vg-330` to have "its spec **and its own plan**" — so this step completes when the user approves the spec and its plan is written by `writing-plans`, and **Phase 12 closes on that, not on this commit.** Runs after 12.3 and 12.4, since it redraws the drawing the others are measured against. A brainstorm → spec → plan of its own, not a task in this plan.

**Acceptance for the phase:** every row closes on the phase that lands its change, each with a `check`
naming a word from its own `title` and `artefacts` naming a resolvable ancestor sha; no row closes on a
source reading where a measurement was the ruling; `vg-330` has its spec and its own plan.
**Failure modes:** a row's ruling re-argued instead of applied; `vg-274`'s 94-value count trusted after
Task 13.1 edited the stylesheet it counts; a wide row run as one dispatch across several panes.

# Phase 13 — the user's 2026-10-14 GUI list (9 rows, items 1–9)

**Why this phase runs ahead of Phase 12.** The list is the user's own, written while testing the
editor, and on 2026-10-15 they set it first: *"Once the items I reported are filled, prioritize
addressing them."* Priority is theirs to set, so these tasks dispatch ahead of Phase 12's and
Phase 12 resumes when they land. **No ruling is required before a task here** (§10 step 2 binds
ruled rows): each item's authority is the user's own sentence, which the brief carries verbatim.

**Two of the nine reverse a verified decision, and moving the surface is not enough.** `vg-463`
moves the eight arrange actions out of the canvas dock, and the dock is exactly what `vg-016`
(verified, `source: user`) recorded as the reason the Arrange menu could go. `vg-465` hides the
glass section where a subject cannot be frosted, and withholding it is what `vg-006` (verified,
`source: user`) recorded as the mistake. Neither needs a new ruling — the author is the same party
and has just changed their mind — but **each task moves the decision, not only the surface**: the
contradicting sentence in the archived row, the module docstring that states the old behaviour, and
any test pinning it, in the same commit.

**Where this phase meets Phase 12, and who waits.** `vg-037` (Phase 12) owns the glass *control's
rendered value*; Task 13.4 owns whether the section is offered at all, so `vg-037` waits.
`vg-274` (Phase 12) is `editor-shell.css` joining the gated list; Task 13.1 edits that stylesheet,
so `vg-274` waits. Nothing else in the two lists shares a file.

**One root cause is filed twice, deliberately.** Items 7 and 9 are the same mistake — a boundary
drawn by two owners — in two mechanisms (`vg-464`, `vg-466`). Task 13.1 fixes both, so the pair
closes together rather than one waiting on the other.

### Task 13.1: One owner per boundary, and scrollbars the shell draws (items 1, 7, 9)

**Files:**
- Modify: `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/components/ui/control-well.tsx`
- Test: the affected `*.dom.test.tsx`; one spec that renders a focused field

**Interfaces:**
- Produces: a focus boundary with one owner; the three scrollbar tokens' one consumer

- [ ] **Step 1: Give the focus boundary one owner.** `control-well.tsx:83` draws it rounded on the
      well; `editor-shell.css:1432-1441` draws a second, square one on the input and wins, because
      that rule is unlayered while the input's `outline-none` utility sits inside `@layer utilities`
      (measured in `vg-278`). The boundary stays on the well, which follows the control's radius,
      and the shell's rule stops drawing a second one — including for `control-text.tsx` and
      `control-select.tsx`, which are the same shape in the same cascade.
- [ ] **Step 2: The header's two rules become one (item 9).** `inspector.tsx:70`'s
      `border-b border-edge` and `inspector-section.tsx:58`'s `border-t border-edge` are adjacent
      owners drawing one boundary; the subject block keeps the rule and the first section does not
      draw a second. The same task adds the kind's glyph before the name (`inspector.tsx:71-77`),
      reading the per-kind map at `icons.ts:174-180` rather than a second table.
- [ ] **Step 3: Consume the scrollbar tokens.** `editor-shell.css:115-117` declares
      `--vigilia-scrollbar-thumb`, `-thumb-hover` and `-track` and nothing reads them; the panel and
      inspector scrollers (`:1115-1118`) take `scrollbar-width`/`scrollbar-color` and the
      `::-webkit-scrollbar` family from those three values. **No new paint value is introduced.**
- [ ] **Step 4: Red-proof each half** — restore the shell's outline rule and the boundary reads
      doubled; unset the scrollbar properties and the scroller reads platform-painted; restore the
      first section's `border-t` and the doubled rule returns. Confirm each restore byte-for-byte
      with `cmp`, not with `git`.
- [ ] **Step 5: Rendered evidence on a rebuilt bundle** (`--workers=1`): a focused input shows one
      boundary, the inspector header shows one rule below it and an icon before the name, and a
      scrolling panel's scrollbar draws in shell paint.
- [ ] **Step 6: `npm run gate` (exit code read from `$?`, redirected to a file), then commit.**

**Acceptance:** one outline per focused control and one rule below the header, both measured in the
browser; the three tokens have a consumer; the gate green.
**Failure modes:** the second outline removed from one input and left on the others; a scrollbar
themed with a new hard-coded colour; a header icon read from a second per-kind table; a browser
claim taken from a stale `dist`.

### Task 13.2: One mark per layer kind, from the one icon family (item 2)

**Files:**
- Modify: `packages/editor/src/panes/composition/kind-mark.tsx`, `packages/editor/src/editor-shell/icons.ts`
- Possibly modify: `packages/editor/src/panes/add/add-pane.tsx` (the shape glyphs it draws)

**Interfaces:**
- Consumes: `icons.ts`'s glyph vocabulary as the single icon family
- Produces: one representative glyph per layer kind

- [ ] **Step 1: One glyph per kind, drawn from the vocabulary.** Today `kind-mark.tsx` draws four
      different pictures — the object's own words (`:78`), a paint swatch (`:102`), an image
      thumbnail (`:115`), a chart family glyph (`:94`) and `STACK_GLYPH` (`:128`). A text row
      becomes a `T` in a rounded-rectangle outline at the chrome's own weight; a shape row becomes
      that shape type's glyph as the add panel identifies it.
- [ ] **Step 2: Settle the Lucide question in the open, not by assumption.** `add-pane.tsx:158-170`
      records that Lucide has no `wedge` or `arc`, which is why those tiles are hand-authored SVG.
      The user's rule is that every GUI icon is Lucide, so **the mark for a shape Lucide cannot draw
      is the nearest Lucide glyph naming the same family**, and the hand-authored geometry stays in
      the add panel where it depicts the shape being created rather than standing for a kind. If a
      shape has no defensible Lucide counterpart, say so on `vg-459` rather than inventing one.
- [ ] **Step 3: Correct `icons.ts:47`'s claim** that it is the only module reading lucide —
      `object-actions.ts:1-23` reads it too — or make the claim true.
- [ ] **Step 4: Rendered evidence**: a capture of the layer list showing every kind's mark at once,
      which is the reading this item asks for and cannot be replaced by a source read.
- [ ] **Step 5: `npm run gate`, then commit.**

**Acceptance:** one representative icon per kind, drawn from the one family, verified on a rendered
layer list rather than by reading `kind-mark.tsx`.
**Failure modes:** the object's own words left on the text row at 8px; a colour-carrying swatch kept
for shapes; a hand-authored glyph claimed as Lucide; the item's "every icon anywhere in the GUI"
read as discharged by the layer list alone, which no check in this task establishes.

### Task 13.3: The layer list's actions and its drag (items 3, 4, 5)

**Files:**
- Modify: `packages/editor/src/editor-shell/layer-panel.tsx`, `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/panes/composition/composition-pane.tsx`, `packages/editor/src/panes/composition/row-affordances.tsx`
- Possibly modify: `packages/editor/src/object-actions.ts`

**Interfaces:**
- Consumes: `OBJECT_ACTIONS` and `objectActionsFor` as the one owner of which actions exist
- Produces: a footer whose content does not depend on a selection; a row that can be dropped into a
  group; a name reached by double-click alone

- [ ] **Step 1: The footer's actions stop depending on a selection.** `shell-layout.tsx:358` already
      passes the footer unconditionally and `layer-panel.tsx:27-28` maps `objectActionsFor`, but
      every entry is selection-gated (`object-actions.ts:105-116`, `:140`), so the row is empty with
      nothing selected. **The item does not ask for a footer that is present; it asks for one that is
      usable**, so the actions that need no selection (new text, new shape, new group — whatever the
      panel's own construction verbs are) are available at all times, and the registry gains a way to
      say which those are rather than the panel re-deriving it.
- [ ] **Step 2: Remove the rename pen** (`row-affordances.tsx:62`, `:67-71`) — double-click already
      opens the name (`composition-pane.tsx:511-514`), so the item is a removal. Keep the rename
      reachable by keyboard, and read `vg-389` and `vg-234` before removing it, since both are open
      on that same field.
- [ ] **Step 3: Let a dragged row land inside and outside a group.** `composition-pane.tsx:451-454`
      refuses by construction (`sameLayerParent`), only a landing slot calls `preventDefault`
      (`:458`), and `onDrop` bails without `before` (`:495-502`). A row dragged into a group's
      interior must have a drop target and must move the object's parent; the same for dragging out
      to the root. `vg-099` (verified) left "deliberate intent or implementation limit" open and this
      item answers it: the limit is lifted.
- [ ] **Step 4: Red-proof the drag** — with `sameLayerParent` restored, the new case fails; the
      gesture cannot be captured in a browser, so the case drives the drop handlers directly and the
      rendered reading is the layer list's nesting after a synthetic drag.
- [ ] **Step 5: `npm run gate`, then commit.**

**Acceptance:** the footer offers its construction actions with nothing selected, measured in the
browser; no pen is rendered and the name still opens for typing; a row can be dropped into a group
and out of one, with the tree reflecting it.
**Failure modes:** the footer made "always visible" by offering actions whose manager would refuse
them; the pen removed while the keyboard route to rename breaks; a drop target added that reorders
without reparenting.

### Task 13.4: The glass section, and the arrange actions' one home (items 6, 8)

**Files:**
- Modify: `packages/editor/src/selection-inspector/glass.ts`, `packages/editor/src/selection-inspector/index.ts`, `packages/editor/src/editor-shell/canvas-dock.tsx`
- Possibly modify: `packages/editor/src/selection-inspector/per-kind-column.ts`

**Interfaces:**
- Consumes: `per-kind-column.ts`'s total membership rule for which sections a selection gets
- Produces: two moved decisions, each carried on its row

- [ ] **Step 1: Withhold the glass section where the subject cannot be frosted (item 8).**
      `glass.ts:164-175` always returns the field with a `refused` state and `:149-163` records the
      reason: withholding it "left nothing anywhere saying so". **The ruling the section reverses is
      `vg-006`'s**, so the explanation moves rather than vanishes — the shape's inability is stated
      where the author meets it (the section's own absence is not self-explanatory for a Group), and
      `glass.ts`'s docstring records the new decision in the same commit.
- [ ] **Step 2: The eight arrange actions get their single home (item 6).** They render only in the
      dock (`canvas-dock.tsx:158-168`), and the inspector panel offers nothing (`selection-inspector/`
      has no arrange match). Two or more selected objects or groups show them at the top of the
      inspector. **This is the reversal `vg-016` obliges**: the dock stops carrying them, so the
      reason the Arrange *menu* was removed — the toolbar above the canvas already had all eight —
      stops being true, and the commit says where the one owner now lives rather than leaving two.
- [ ] **Step 3: Read `vg-396` before moving them** (open: entering and leaving a selection inside a
      scaled or rotated group moves its members, so align and distribute misbehave). If the move
      makes that defect more reachable, it lands with this task or the task says why it does not.
- [ ] **Step 4: Rendered evidence** for both: the inspector on a two-object selection shows the
      eight; a Group's inspector shows no glass section, and the explanation is where Step 1 put it.
- [ ] **Step 5: `npm run gate`, then commit, naming both reversed rows.**

**Acceptance:** the inspector hosts the arrange actions for a multi-selection and the dock does not,
verified rendered; a subject that cannot be frosted is offered no glass section and is told why
somewhere it will meet.
**Failure modes:** the eight duplicated in both surfaces; the glass explanation deleted with the
section; `vg-016`'s sentence left standing in contradiction to the tree.

### Task 13.1b: The two sentences in `DESIGN.md` that describe what this commit replaced

**Added 2026-10-15 by the scoped review of `3328ae33`**, which found no code defect and two
contradictions between the code and the contract it implements. **Not a fix round: the code is the
side that is right**, and the user's own items 1 and 9 are the newer authority.

**Files:**
- Modify: `DESIGN.md`
- Modify: `packages/editor/src/editor-shell.control-rules.test.ts`
- Modify: `packages/editor/src/editor-shell/editor-shell.css` (one comment)

- [ ] **Step 1: §7.7.** It reads *"Use native scrollbars and reserve their gutter where necessary; no
      custom scrollbar or scroll-jacking owner."* `editor-shell.css:1124-1143` now makes
      `.editor-shell-panel` and `.editor-shell-inspector` exactly that owner — `scrollbar-width`,
      `scrollbar-color` from the two tokens, and four `::-webkit-scrollbar*` rules — and the tokens
      were declared and read by nothing until `3328ae33` consumed them, which is the state the
      sentence was true of. **Move the sentence rather than delete it**: the rule it states still
      binds everything else, so it now excludes scrollbar *paint* by the shell's own tokens, and says
      why the shell is allowed this one.
- [ ] **Step 2: §7.4.** It reads that the column *"opens with the subject: its name at `--text-md`,
      and one line naming its kind"*. After `3328ae33` there is no line naming the kind — the kind is
      the name row's own glyph (`inspector.tsx:81-82`) and the second line carries the binding key and
      is present only when one is bound (`:91-92`). `uiCopy.inspectorFields.subjectKind` was deleted
      with it, so the sentence has no implementation anywhere. Rewrite it to describe what the column
      now opens with, citing the user's item 9 as the reason the description changed.
- [ ] **Step 3: `control-rules.test.ts:210-211`'s comment** says the `@layer base` block "declares no
      colour of any kind" while it declares `outline: 2px solid var(--shell-accent)`. The claim's
      substance holds — `PAINTS_COLOUR` keys on `color:`, and an outline colour cannot beat the
      marker's `color` — but the sentence is imprecise. Make it say what is true.
- [ ] **Step 4: `editor-shell.css`'s comment above `.editor-shell-dock`**, which `13.4` reported as a
      `Discovered, not fixed:` trailer and left alone. It still says the dock carries "the arrange
      actions it is too small to enable" and that "the arrange half greys before a selection" — false
      since `4927f2f0` moved those eight into the inspector, so it now describes a surface that no
      longer exists. **This is the third piece of text in the phase that describes behaviour the phase
      replaced**, which is why it rides here rather than in a row: the file that states the rule, the
      file that reads it, and the test that pins it all move in one commit.
- [ ] **Step 5: `npm run design:check` and `npm run gate`, then commit.** A `§N` marker is stable and
      is never renumbered; `design:md --cite` fails on a citation naming a number with no marker, so
      if a rewritten sentence moves a marker, the citations to it move in the same commit.

**Constraints:** runs after Task 13.4 has landed — `DESIGN.md` is dirty from its own `vg-463` edit at
the time of writing, and this task is a second writer on that file.

**Acceptance:** neither sentence contradicts the tree; `design:check` exits 0; the `§7.4`/`§7.7`
markers are unchanged and their citations still resolve.
**Failure modes:** the sentence deleted rather than moved, so the rule stops binding where it still
applies; a marker renumbered; the `text` decision the code made described in the doc as the old one.

### Task 13.2b: One vocabulary for every icon, the add pane included (item 2's unmet half)

**Added 2026-10-15 by the scoped review of `a7745cc7`**, which found that 13.2 discharged one of the
two owners `vg-459`'s own title names. **`vg-459` stays open until this lands.**

**Files:**
- Modify: `packages/editor/src/panes/add/add-pane.tsx`
- Modify: `packages/editor/src/editor-shell/icons.ts`, `packages/editor/src/editor-shell/icons.test.tsx`
- Modify: `packages/editor/src/panes/composition/kind-mark.tsx`, `kind-mark.dom.test.tsx`

**Interfaces:**
- Consumes: `KIND_GLYPHS` and the `CHART_*_GLYPH` family 13.2 built, which are now the one vocabulary
- Produces: no hand-authored glyph left in the add pane, and every layer kind distinguishable by its mark

- [ ] **Step 1: The add pane's shape tiles read the one vocabulary.** `add-pane.tsx:158-182` draws them
      by hand and `:158-170` records the reason: Lucide has no `wedge` or `arc`. **That reason is the
      obstacle this row has to answer rather than restate**, and it is why the item's two halves — a
      shape row drawn "as the add panel draws it" and every icon Lucide — cannot both hold while the
      pane draws its own. Bringing the tiles into the vocabulary is what makes them agree by
      construction instead of by being copied.
- [ ] **Step 2: De-collide `wedge` from `pie`.** `icons.ts:172` and `:137` are the same component, so a
      wedge shape row and a pie chart row render the identical class and the mark stops naming the
      kind. Decide which side moves and name the owner in the commit — the wedge is the shape family's
      own primitive and the pie belongs to the chart family, so moving the chart's glyph is allowed
      only if the user's "group and chart icons are right" survives it.
- [ ] **Step 3: `text`'s mark, decided rather than left.** The user asked for a `T` in a
      rounded-rectangle outline and no installed `lucide-react` glyph is one — `SquareText` is a
      rounded square with three text rules and no `square-type` exists. Either the box is dropped and
      the commit says the user's wording yields to the one-family rule, or the rule gains a named
      exemption. **Do not draw a second hand-authored glyph to satisfy the box**: that reinstates the
      defect this row exists to end.
- [ ] **Step 4: Distinguishability is asserted, not read.** Add a case that every kind's mark differs
      from every other kind's — the case that would have caught Step 2 by itself, and the one
      `kind-mark.dom.test.tsx:136-139` does not have, since it compares `rect` against `wedge` alone.
- [ ] **Step 5: `kind-mark.dom.test.tsx:42-45`'s comment.** It claims the expectations are read off the
      vocabulary "rather than written as a literal" while `:120` and `:125` assert the literals
      `lucide-gauge` and `lucide-chart-line`. The assertions are defensible; the comment is untrue.
      Make one of them change.
- [ ] **Step 6: `npm run gate`, then commit**, naming the kinds whose glyph is an approximation, the
      side that moved in Step 2, and the side taken in Step 3.

**Constraints:** runs after Task 13.4 has landed, because it edits `icons.test.tsx`'s exemption list
and the add pane while 13.4 holds the tree.

**Acceptance:** no hand-authored glyph renders in the add pane, verified rendered; every kind's mark
differs from every other's, asserted; the approximations, the de-collision and the `text` decision are
each named in the commit.
**Failure modes:** a second hand-authored glyph added to draw the box; `wedge` de-collided by moving a
glyph the user called right; the `text` decision taken silently; distinctness claimed from reading the
vocabulary rather than from a case.

### Task 13.5: The two cases the phase owes, and the pass that reads them

**Files:**
- Modify: `tests/e2e/shell-appearance.spec.ts`, `tests/e2e/design-language.spec.ts`
- Read (do not modify): every e2e spec the six landed items' rendered claims live in

- [ ] **Step 1: Item 1's case, which does not exist.** A grep over the whole e2e suite for
      `scrollbarColor`, `scrollbar-color` and `scrollbarWidth` returns **nothing**, so `vg-458` has no
      browser assertion at all and cannot carry a `check` that runs. `shell-appearance.spec.ts:141`
      already enumerates the shell's surfaces against the `--vigilia-*` tokens that paint them — that
      case's own subject — so the pair is asserted there rather than in a new file. **Assert the
      computed values on both scrollers, not the declaration**: the point of the row is that the tokens
      were declared and consumed by nothing, so a case that reads the stylesheet text would have passed
      before the fix.
- [ ] **Step 2: Item 7's case, which exists but cannot catch the defect.** `design-language.spec.ts:952-987`
      measures the focused control's outline and its contrast, and it would keep passing with the
      doubled square outline still drawn inside the rounded one — which is exactly what `vg-464` was.
      Add what that case cannot see: **one boundary, not two**, on a focused control inside a well.
      `keyboard.spec.ts:78-105` reads `outlineStyle`, `outlineWidth` and `outlineColor` off a focused
      element and is the closer model for the shape of the reading. **(This step read "item 6" until
      2026-10-15. The row id was always right and the plan's own headings agree — 13.1 is items 1, 7, 9
      and 13.4 is items 6, 8 — so the doubled outline is item 7.)**
- [ ] **Step 3: Red-prove both**, by reverting the fix each pins — `editor-shell.css`'s scrollbar rules
      for Step 1 and the `@layer base` wrapper for Step 2 — and confirming each new case fails.
      **Restore and confirm with `cmp`, not `git checkout`**: a Windows text-mode write leaves CRLF and
      git normalises, so only `cmp` sees the difference.
- [ ] **Step 4: The controller's serial browser pass**, on a rebuilt bundle (`vite preview` serves
      `dist`, so a source change needs a rebuild first), `--workers=1`, covering the rendered claims of
      items 1, 2, 6, 7, 8 and 9 together. Record the exit code beside the command. **This is the only
      rendered evidence those six rows will have**, so a row whose reading is missing stays open rather
      than closing on a source reading. Item 2's reading waited on Task 13.2b, which has landed, so all
      six are read here rather than five.

**Constraints:** runs after 13.1b and 13.2b have landed, because the bundle this pass reads is built
from the tree and a second writer during the build makes the reading unattributable.

**Acceptance:** both new cases fail when the fix they pin is reverted, and pass at HEAD; the browser
pass's exit code is recorded beside the command that produced it; the pass covers items 1, 2, 6, 7, 8 and
9, item 2's deferral having ended when Task 13.2b landed.
**Failure modes:** a case that reads the stylesheet text rather than the rendered control, so it would
have passed before the fix; a reading taken on a stale bundle; a pass reported as green while a
project in it is red — `desktop-host` is expected red here and the exit code alone does not say which.

### Task 13.6: Close the eight, and set what item 2 could not settle

**Files:**
- Modify: both register files, `STATUS.md`

- [ ] **Step 1: Close `vg-458` and `vg-460`–`vg-466`** as `verified`, each with a `check` naming a word
      from its own `title` and `artefacts` naming the commit that landed it. **`vg-459` is not among
      them and does not close here** — the scoped review of `a7745cc7` of 2026-10-15 found that
      `vg-459`'s title names two owners and the commit discharged one, so it closes with **Task
      13.2b**, whose own close must name a word from the add pane's half.
- [ ] **Step 2: Record the two moved decisions** — `vg-016` and `vg-006` keep `verified` and gain a
      line naming where the decision moved, so the next reader finds the current answer from either.
- [ ] **Step 3: `npm run backlog:check`, `npm run status:check`, commit.**

**Acceptance:** every close carries a check naming its own subject and a resolvable ancestor sha; the
two reversed rows point at the new home; the count of live rows is what the two commands report.
**Failure modes:** a check whose wording names a capability near the row rather than the row's own
subject; a close reported while Task 13.5's rendered reading is missing.

---

# Phase 14 — the user's 2026-10-14 GUI list (9 rows, items 10–18)

**The second half of the same list, and it runs behind Phase 13 by the same priority.** Items 10–18
were verified in the same pass and are filed as `vg-467`–`vg-475`. Three of them are not new
decisions and their tasks say so rather than re-deciding:

- **`vg-469` (item 12) is an existing verified rule's unfinished application.** `vg-007` (archived,
  `source: user`) owns "a bounded number field clamps onto its bound and carries a native slider";
  five fields implement it and rotation, corner radius, panel border and the shadow's blur and
  offset do not. The task applies the rule and cites it; it does not argue it again.
- **`vg-470` (item 13) moves a recorded decision.** Position's collapsed default is deliberate and
  `per-kind-column.ts:55-58` says why, so the rationale is revised in the same commit as the
  surface — a surface changed without it leaves the code asserting the opposite of what it does.
- **`vg-472` (item 15) removes a pinned string.** `layer-panel.dom.test.tsx:1174` asserts the line,
  so the removal and the assertion change together.

**Two items are already half-true and the rows say which half is left.** `vg-471` (item 14): the
right alignment exists and is measured, the File and Edit menus carry their chords, and the one
remaining surface is the canvas context menu, which draws none. `vg-473` (item 16): 26 sites name
Fabric, and exactly one is visible on screen — the footer status line the user quoted.

**The sweep item grew after the census, and one row joined this phase from the user's own
testing.** `vg-469`'s min/max list was five examples and is now the full census the user asked for
on 2026-10-15 (25 fields, three render sites), which is why Task 14.1 carries a fourth step and a
ruling about where a slider's maximum comes from. **`vg-478` lands with Task 14.1**: the corner
radius stores any value while `fabric/src/shapes/Rect.ts:93-94` renders `Math.min(rx, w / 2)`, so
its bound is half the smaller *drawn* dimension. That is the same question as the seven pixel
measures Step 4 rules on, and the same shape as `vg-109`, so the two are answered together rather
than twice.

### Task 14.1: The slider's well, its wheel, and the rule's remaining fields (items 10, 11, 12)

**Files:**
- Modify: `packages/editor/src/components/ui/control-slider.tsx`
- Modify: `packages/editor/src/selection-inspector/panel.ts`, `packages/editor/src/selection-inspector/per-kind-column.ts`
- Possibly modify: `packages/editor/src/selection-inspector/view.ts` (the `slider` arm of `FieldView`)

**Interfaces:**
- Consumes: `ControlNumber`'s inline form, which `control-pair.tsx` already composes as a layout
- Produces: a slider whose value can be typed and wheeled, and one set of fields that all carry it

**Pointers checked 2026-10-15 and all of them resolve:** the three render sites are the
`control: "number"` sites the step names; `control-slider.tsx`'s well is a `<span>` at `:157-161` with
the decision sentence above it at `:30-31`; and `settings-fields.ts` carries 27 numeric descriptors.
**Recorded because the same pass found Task 14.2's citations did not resolve** — a task whose pointers
have been checked should say so, or the next reader re-derives it and cannot tell the two apart.

- [ ] **Step 1: The well becomes an input (item 10).** `control-slider.tsx:157-161` renders a
      `<span>`; `:30-31` states the decision being reversed in the module's own words, so that
      sentence changes in the same commit. The well becomes `ControlNumber` in its inline form, so
      the draft, the validation and the commit rule stay in the control that owns them rather than
      being re-derived — which is why `control-pair.tsx` composes two halves the way it does.
- [ ] **Step 2: The wheel moves the value (item 11).** A wheel event over the control moves it by
      the slider's own step, and **the step is read from the slider rather than invented**, so the
      gesture and the drag cannot disagree. The viewport's wheel handler
      (`viewport-manager/navigation.ts:124`) is a different subject and does not change.
- [ ] **Step 3: Apply `vg-007`'s rule to the fields that lack it (item 12)** — the corner radius,
      the panel border, the shadow's blur and offset (`panel.ts:200-212`, `:244-263`, `:281-299`)
      and rotation (`per-kind-column.ts:312-326`). The census covered the selection column, so
      **sweep every bounded number in the inspector**, not the five named: the row's list is a lower
      bound. `vg-469` carries the full census — 25 fields, and **exactly three render sites** decide
      how any of them draws (`selection-inspector/panel.ts:207`, `per-kind-column.ts:318`,
      `chart-manager/panel.ts:167`), so the sweep is small in code and wide in reach.
- [ ] **Step 4: The chart settings, where the census found the bulk of it.** Of
      `renderer-core/src/charts/settings-fields.ts`'s 27 numeric descriptors, **10 carry both
      bounds already and need no decision** — `animation.durationMs`, `animation.appearMs` (0–5000),
      `startAngle`/`endAngle` (−360–360, four descriptors), `gradientSegments` (2–256),
      `categoryGapPercent` (0–100), `innerRadiusPercent`, `outerRadiusPercent` (0–100); their slider
      takes those numbers. The other eleven are ruled as follows, and **the ruling is that a bound
      comes from its owner rather than from a constant chosen here**:
      - `padAngle` (slice gap, degrees) — **max 360**: a full turn is the ceiling the unit itself gives.
      - `thickness`, `lineWidth`, `markerSize`, `barWidth`, `cornerRadius` (bar), `cornerRadius`
        (pie), `trackCornerRadius` — every one is a pixel measure that cannot exceed **the chart's
        own drawn box**, and a radius cannot exceed **half** of it, which is `vg-478`'s finding in
        the selection column. So the bound is read from the same owner the renderer reads its box
        from, not written as a number here. If that box is not available where the field is
        projected, the field keeps a typed number and the task says why — it does not get a
        guessed ceiling.
      - `windowSeconds`, `maxPoints`, `total.value` — **these get no slider.** The first two are
        bounded by the sample store and the third is the chart's own data domain; a slider would
        offer a range that the store or the data does not honour, which is the defect this step
        exists to end rather than to spread. Say so on `vg-469`.
- [ ] **Step 5: Red-proof each** — the typed value fails to commit with the input reverted to a
      span; the wheel does nothing with the listener removed; a swept field renders a typed-only
      well with its slider removed.
- [ ] **Step 6: `npm run gate`, then commit**, naming the fields the sweep converted and the three
      the ruling leaves typed.

**Acceptance:** a value can be typed into the well and committed, and the wheel moves the control,
both verified rendered; every bounded number in the inspector carries the pair.
**Failure modes:** a second validation route built beside `ControlNumber`'s; a wheel that moves the
value without a history boundary or without a preview; the sweep converting the five named fields
and leaving the rest, which is the defect this row exists to end.

### Task 14.2: The inspector's section list (items 13, 17)

**Files:**
- Modify: `packages/editor/src/selection-inspector/per-kind-column.ts`, `packages/editor/src/ui-copy.ts`
- Modify: `packages/editor/src/panes/document/references.tsx` — **the path this task named until
  2026-10-15 (`selection-inspector/references.tsx`) does not exist.** The panel's owner is
  `createDocumentReferencesPanel` in `panes/document/`, and `panes/document/references.dom.test.tsx`
  drives it.
- Possibly modify: `packages/editor/src/editor-session.ts`, which composes that panel

**Interfaces:**
- Consumes: the total membership rule `per-kind-column.ts` already enforces by construction
- Produces: a section list with no read-only residue, and Position's default stated as its reason

**Line numbers in this task were re-checked on 2026-10-15 and several did not resolve** — a blank line,
a neighbour's entry, and a test name a few lines out. They are replaced by symbol names and selectors,
which is the rule the plan's preamble states and what every other task already does. **A citation that
resolves to the wrong thing reads exactly like one that resolves to the right thing**, and an implementer
following the old form would have opened a file that is not there.

- [ ] **Step 1: Position opens by default (item 13).** `per-kind-column.ts`'s `defaultOpenOf` returns
      false for `"position"`, and the comment above it gives the reason; both change together, and the
      new reason says why the asymmetry is gone rather than being deleted.
- [ ] **Step 2: Remove the Spends section (item 17, first owner)** — `per-kind-column.ts`'s
      `spendsBody`, its `["spends", …]` entry in the section list, and the `readOnly: id === "spends"`
      flag beside it. It is section-list entries, so its removal is contained; the section is the one
      `[data-vigilia-section="spends"]` names.
- [ ] **Step 3: Remove the This document section (item 17, second owner)** — the document-references
      sub-panel: `ui-copy.ts`'s `documentStyle` label ("This document"), `panes/document/references.tsx`,
      and `editor-session.ts`'s `this.#documentReferences = createDocumentReferencesPanel(`. **This is a
      sub-panel rather than an entry**, and its removal reaches Playwright. **Find those cases by
      grepping the specs for the panel's own selector rather than from a line number** — the three this
      step carried did not resolve, and the Spends case sits in `editor.spec.ts` beside its
      `[data-vigilia-section="spends"]` locator. Cases that exist only to drive a panel that no longer
      renders are removed with it, and each one's removal is named.
- [ ] **Step 4: Rendered evidence** on a rebuilt bundle: the inspector opens with Position expanded
      and shows neither read-only section, on the selections that used to carry them.
- [ ] **Step 5: `npm run gate`, then commit.**

**Acceptance:** Position renders expanded; neither read-only section renders anywhere; the specs
that drove them are gone rather than skipped, and the remaining suite is green.
**Failure modes:** the rationale deleted with the flag so the file explains nothing; a spec skipped
or narrowed instead of removed; the Spends section removed in one panel and left in another.

### Task 14.3: The context menu's chords (item 14)

**Files:**
- Modify: `packages/editor/src/editor-shell/canvas-context-menu.tsx`

**Interfaces:**
- Consumes: the `item` helper's chord route in `shell-menu-bar.tsx`, and `shortcutLabel`
- Produces: one surface drawing chords the way the other two do

- [ ] **Step 1: Draw the chord on each row that has one.** `canvas-context-menu.tsx:79-91` renders
      no chords for the same Duplicate/Copy/Cut/Delete the Edit menu draws, so the context menu
      reads the shared label route rather than restating a chord. **The four File rows with no
      binding are not part of this** — `vg-185` (verified, ruled 2026-10-14 "teach the File chords")
      left them deliberately chordless because the table binds nothing for them, and this task does
      not reopen it.
- [ ] **Step 2: Red-proof** — with the label route bypassed the case fails on a row's own chord.
- [ ] **Step 3: Rendered evidence**: the canvas context menu on a selected object shows the same
      chords the Edit menu shows, right-aligned by the existing rule.
- [ ] **Step 4: `npm run gate`, then commit.**

**Acceptance:** every context-menu row with a binding prints it, verified rendered, and the
alignment comes from the one existing rule rather than a second one.
**Failure modes:** a chord restated in the context menu rather than read from the binding; the
right alignment re-implemented locally; a chord taught for an action whose row runs a different call.

### Task 14.4: The author-facing copy (items 15, 16)

**Files:**
- Modify: `packages/editor/src/ui-copy.ts`, `packages/editor/src/panes/composition/composition-pane.tsx`
- Modify: `packages/editor/src/editor-main.ts`, `packages/editor/src/editor-shell.ts`
- Possibly modify: `packages/renderer-core/src/theme/fabric-envelope-validate.ts`, `packages/scene-fabric/*`

**Interfaces:**
- Consumes: nothing from an earlier task in this phase
- Produces: no user-facing string naming the renderer, and no helper line above the layer tree

- [ ] **Step 1: Remove the layer helper line (item 15)** — `ui-copy.ts`'s `panels.reorderRule` key, the
      long string about dragging into or out of a group, rendered at `composition-pane.tsx:333`.
      **It is pinned by `layer-panel.dom.test.tsx`'s assertion that the rule's text equals
      `uiCopy.panels.reorderRule` — it pins the *key*, not a literal — so the assertion is removed
      with the key rather than reworded, and the commit names it.** *(The row and this step both
      quoted "reorder it within its group" and both cited `:1174` until 2026-10-15. That wording is
      the pre-13.3 copy — reparenting rewrote the string — and `:1174` is a drop-line assertion, so
      the step's own failure mode, a string the product no longer prints, was true of its premise.)*
- [ ] **Step 2: The footer says "Editor ready" (item 16).** The user's own example, and the only one
      of the 26 sites visible on screen: `editor-main.ts`'s status line, the `status.textContent` that
      reads `"Fabric editor ready"` today. **Not `editor-shell.ts`, which this step named until
      2026-10-15** — that file carries the two "Invalid Fabric theme" messages in Step 3 and no status
      line.
- [ ] **Step 3: The remaining author-facing sites.** `editor-main.ts:290` — the "Fabric theme saved"
      message, `:442` belonging to Step 2 — and `editor-shell.ts:432` and `:579` (`:425` is a dev-mode
      error and stays a developer's message). **The eighteen validation messages in
      `renderer-core/src/theme/fabric-envelope-validate.ts` are a decision this task must take rather
      than assume**: they are the author's own errors, so if they keep the renderer's name the task
      says why, and if they lose it the task says what they say instead. `scene-fabric`'s three sites
      (`glass.ts:250`, `object-asset.ts:20`, `persist.ts:260`) are read the same way. The source
      comments (`ui-copy.ts:67` and `:285`, `per-kind-column.ts:170`) are not user-facing and are left
      alone — **the `ui-copy.ts:290` this step named until 2026-10-15 is `documentStyle`, a
      user-facing string and a site of the kind the step above is about, so it was the one entry in
      this list whose exclusion was wrong.**
- [ ] **Step 4: Red-proof** at the one visible site: restore the string and the rendered status line
      reads "Fabric editor ready" again.
- [ ] **Step 5: `npm run gate`, then commit**, naming the sites changed and the ones deliberately
      kept.

**Acceptance:** the footer reads "Editor ready", verified rendered; every site the task keeps is
named with its reason; no test asserts a string the product no longer prints.
**Failure modes:** a blind find-and-replace that renames the renderer in code where it is the
correct name; a message left saying "Fabric" on screen while the footer is fixed; the validation
messages changed without the task saying which side it took.

### Task 14.5: The rotation pivot (item 18), and the phase's close

**Files:**
- Modify: `packages/editor/src/selection-inspector/index.ts`
- Modify: both register files, `STATUS.md`

- [ ] **Step 1: Rotate about the centre.** The `case "angle":` arm of the inspector's write funnel
      calls `object.set({ angle })` — **`selection-inspector/index.ts:349`, found by the arm's own
      name**, which is how it must be found: this step cited `:333-334` when it was written and those
      lines are now the `height` case, since the funnel grew two arms above it. The write rotates
      about the object's own origin at left/top (`new-object-defaults.ts:170-178`); Fabric's own route
      rotates about the centre through the `centeredRotation` branch, which this version of Fabric
      has (`fabric/dist/index.js`). The funnel uses the centred route, so the inspector and the canvas
      gesture agree.
- [ ] **Step 2: Red-proof it on the measured case** — `group-cpu-card` (left/top at 421,187 with its
      centre at 561,340.5) turned by 45° pivot about (421,187) before the fix and about its centre
      after; the case asserts the centre's own position rather than the angle property.
- [ ] **Step 3: Close `vg-467`–`vg-475`** as `verified`, each with a `check` naming a word from its
      own `title` and `artefacts` naming the commit that landed it. `vg-469`'s check cites `vg-007`'s
      rule as the thing applied.
- [ ] **Step 4: `npm run backlog:check`, `npm run status:check`, commit**, and record Phase 13's and
      Phase 14's landing in the ledger together.

**Acceptance:** a group rotated from the inspector keeps its centre, measured rendered on the case
above; every close carries a check naming its own subject and an ancestor sha.
**Failure modes:** the angle set through a second route so the two surfaces disagree; a case that
asserts the angle property, which was already correct; a close reported while the rendered reading
is missing.

---

# Phase 15 — W10: the instrument gaps the triage decided

**This is the phase the triage's own verdicts name**, and it exists because the plan's
`# The rows no phase carries` section rules that a triaged row is either **fixed in a phase named
here**, withdrawn, or parked — and nine rows the triage has now measured are real work with no home.
It is authored from measurements taken on 2026-10-16 rather than from titles, which is the line that
section draws: a task names owning symbols and a landmark, and a landmark cannot be written from a
title.

**Outcome:** the four instruments that were silent about a class of defect are no longer silent, and
the two files past the stop have a named responsibility each.

**Owners:** the parity gate (`src/web/tests/e2e/mockup-values.ts` and the `design-language-*.spec.ts`
files Task 15.4 split, over `design-language-readers.ts`), the token ratchet
(`scripts/design-tokens.mjs` with `scripts/design-tokens.gated.json`), the reference reader, and the
two spec files Task 15.4 split.

**Constraints:** **queued behind Phase 12**, because one phase is active at a time and Phase 12 is the
only phase that has not closed. Task 15.2 and Task 15.3 edit `scripts/`, which is on
`scripts/reuse-gate.mjs`'s watchlist, so **each lands a note under `docs/decisions/` before its first
write** — note `0047` is the precedent and records the cost knowingly. Task 15.5 is browser work and
therefore runs alone on the machine, one suite at a time, against a rebuilt bundle.

**Acceptance:** each row's own `check` passes and is recorded on its line; the four instruments each
refuse a case they currently accept, proved by disabling the new check and showing it red before the
fix is trusted; `npm run gate` exit 0 with its exit code named in the close commit.

**Annotated 2026-10-16, at the phase's close: every task has run, and the phase's thirteen rows stand at
ten `verified`, one `withdrawn` (`vg-482`) and two still open — `vg-442` and `vg-402`.** Each was refused
for the same reason and it is the reason this phase's Acceptance exists: **the close would have claimed a
check that was not built.** `vg-442`'s own
premise was false — the shorthand refusal it describes did not exist, and the instrument was reading the
drawing's *silence* as `0`; the refusal is now real and the comparison is still absent. `vg-402`'s
documentation half landed and its title's claim — that nothing re-shoots the captures beside the
drawings — is still exactly true, so it is homed in Task 21.3 rather than closed on a README edit. **Both
rows carry their measurement on the row itself, so neither is an exception anyone has to rediscover.**
`npm run gate` is exit 0 on every close commit in the phase, read from `$?` into a file, and the parity
suite ran on a built bundle for Tasks 15.1 and 15.5. **Phase 16 is the next phase.**

**Failure modes:** an instrument widened until it accepts the failure it was written to catch; a check
over prose whose unit is undefined, which is the shape `vg-529` records; a file split into pieces that
each still exceed the stop.

**Verify:** `npm run gate` (its exit code read from `$?` into a file, never through a pipe), plus the
parity suite on a built bundle for Tasks 15.1 and 15.5.

**Annotated 2026-10-16, when Task 15.4 closed: the task's own framing was two rows short.** Task 15.4
was "the two files past the stop" and named `design-language.spec.ts` and `shell-appearance.spec.ts`.
The ledger's own note at that close measured **`ui-copy.test.ts` at 1039 lines and
`tests/e2e/mockup-values.ts` at 1512**, both past the stop and both carrying their own register rows
(`vg-415` and `vg-420`) — so the framing was a count of the files the task happened to know about, not
of the files that breach. **Both rows are among the 44 the eighth census correction found named only by
a phase the SDD ledger records closed**, which is the state this plan exists to end, so **Task 15.6
homes them** rather than leaving a measured breach in the same class as a closed task's own subject.

### Task 15.1: The parity instrument's unread directions

**Files:**
- Modify: `src/web/tests/e2e/mockup-values.ts` (the `PARITY` rows and `assertParityRowProperty`)

**Interfaces:**
- Consumes: `mockupSilence`'s existing marker semantics
- Produces: `vg-419` closed (a property a drawing declares that no row reads), `vg-456` closed (the shell drawing's view cluster), `vg-442` closed (a pane surface's rendered type)

- [ ] **Step 1: Measure the reverse direction first.** `vg-419`'s claim is that a drawing can grow a declaration nobody compares; list the declarations in `docs/design/mockups/current/shell.html` that no `PARITY` row reads, and record the count you computed rather than an estimate.
- [ ] **Step 2: Add the region `vg-456` names** — the three zoom/fit squares in the view cluster, whose 26px is currently pinned only by the drawings README's prose.
- [ ] **Step 3: Take `vg-442`'s type half** as far as the drawing's shorthand allows, and record on the row what the shorthand still refuses rather than claiming it whole.
- [ ] **Step 4: Disable each new check and show it red**, then re-enable, rebuild, and run the parity suite.
- [ ] **Step 5: Close the three rows against this task's commits.**

**Annotated 2026-10-16, at the task's close: two of the three rows are `verified` and `vg-442` is
not, and the reason is the task's most useful result.** `vg-419` (`b950c1ad`) took the row's second
candidate — a declared allow-list, because the rule needs 123 rows nobody asked for — and
`tests/e2e/parity-unread-declarations.ts` fails both ways so the list cannot rot into stale
exemptions. `vg-456` added the two view-cluster `PARITY` rows. **`vg-442`'s own premise was false**:
`SHORTHANDS_SETTING` named no font longhand, so a `font-size` question against the drawings' `font`
shorthand returned the drawing's *silence* — which the parity table reads as `0` — rather than the
deliberate refusal the row describes. The refusal is now real; **the comparison is not, so the row's
subject is still exactly true and a `verified` close would have claimed a check that was not built.**
The row is updated rather than closed, and it is the task's residual: no check yet compares a drawing's
drawn type to the product's. **Task 15.1's Acceptance therefore holds for two of its three rows and
the third is a recorded exception rather than a silent one.**

### Task 15.2: The ratchet's missing measure

**Files:**
- Modify: `scripts/design-tokens.mjs`; `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: the gated list's existing meaning (a listed file must be clean)
- Produces: `vg-426` closed — the ratchet can say what is left, not only that the list grows

- [ ] **Step 1: Land the decision note** claiming `scripts/design-tokens.mjs` — the gate refuses the write without one.
- [ ] **Step 2: Report the remainder.** Measured 2026-10-16: `gated` holds 60 entries and the editor's source tree holds 341 files, and no instrument states either number or the ratio.
- [ ] **Step 3: Give the measure a target rather than only a count** — a remainder with no finish is the failure the row names.
- [ ] **Step 4: Run the self-test and `npm run design:check`, then commit.**

### Task 15.3: References that resolve to nothing

**Files:**
- Modify: the reference reader named in `vg-434`'s own measurement; the broken references themselves

**Interfaces:**
- Consumes: `vg-482`'s withdrawal, which left the file-reference half with this row
- Produces: `vg-434` closed — a reference into `docs/superpowers/plans/` resolves or the check refuses

- [ ] **Step 1: Land the decision note** if the reader is under `scripts/`.
- [ ] **Step 2: Re-derive the counts the row reports** (55 register rows and 32 of 82 path references) rather than restating them; the numbers move with every commit.
- [ ] **Step 3: Repair the references that have a correct target**, and record on the row the ones that have none, as `vg-403` did for the deleted design file.
- [ ] **Step 4: Add the check**, and prove it red against a deliberately broken reference.

### Task 15.4: The two files past the stop

**Files:**
- Modify: `src/web/tests/e2e/design-language.spec.ts`; `src/web/tests/e2e/shell-appearance.spec.ts`

- [ ] **Step 1: Split by surface, not by line count.** Measured 2026-10-16, the two are 3743 and 1044 lines against `AGENTS.md`'s 800 stop — both grown since their rows were filed (3550 and 868).
- [ ] **Step 2: Name each piece's responsibility** in its own header; a split with no responsibility per file is the failure mode this phase names.
- [ ] **Step 3: Prove the suite still collects what it collected** — the test count before and after is evidence, not a goal.
- [ ] **Step 4: Close `vg-394` and `vg-395` against this task's commits**, each naming its own file.

### Task 15.5: The two browser readings

**Files:**
- Modify: the Line-endpoint geometry field's probe (`vg-401`); the mockup captures under `docs/design/mockups/current/` (`vg-402`, `vg-504`)

- [ ] **Step 1: Settle `vg-401`'s two readings** with one browser probe: whether the field was in a refused state (a mundane `readOnly` explanation, no defect) or not (an untypeable field, a real one). The row says the reading was never taken; take it.
- [ ] **Step 2: Re-shoot the three captures `vg-402` names** — `shell-capture-graphite.png`, `settings-capture-graphite.png` and `settings-capture-editorial.png` — whose last-touch commits are ancestors of Task 2's weight collapse `ef81b183`. **`vg-504`'s remaining half is the same act on the same three files** — its drawing is fixed and its captures are not — so it lands here rather than in a task of its own. **Corrected 2026-10-16, at the task's close: this sentence had the ancestry backwards, and the task's own seat measured it.** `ef81b183` is an *ancestor of* `64871ccd` and of `e412c98d`, not the other way round — those commits came after the collapse, so neither is an ancestor of it. The relation the row needs is the one `vg-504`'s own measurement uses and it is the sound one: the captures' last-touch commit predates the commit that changed the string they show. **The re-scope to `vg-504`'s three shell files is the correct one and `vg-402`'s settings pair was not in this task's scope.**
- [ ] **Step 3: Rebuild the affected bundles first**, since Playwright's `webServer` is `vite preview` and reads `dist`.
- [ ] **Step 4: Close both rows**, or close `vg-401` as a non-defect if the first reading holds — which is a legitimate outcome and must say so on the row.

**Annotated 2026-10-16, at the task's close: `vg-401` and `vg-504` are `verified` and `vg-402` is not.**
**`vg-401` closed as a non-defect, and neither of the row's two readings was the one taken**: `fill`
completes in 42 ms with `readOnly: false`, so no actionability check fails, and the control refuses the
draft itself on blur (`aria-invalid`, `not a number`) rather than being untypeable. **Structurally the
field cannot be refused on this surface** — `refused` is set only by the chart manager, and
`control-number.tsx` is `readOnly={refused !== undefined}` — so the 2026-10-12 observation was the
probe's rather than the product's. The close carries a browser case proved red by planting
`readOnly={true}`. **`vg-504`'s three captures were re-shot** and the controller verified all eleven
drawings-adjacent pairs byte-identical to their evidence twins with `cmp`. **`vg-402` stays open**: its
documentation half landed (the README now states the copy step and carries the eleven pairs, and its
three false "produced by the registered actions" passages are corrected) but **its title's claim is
still true** — nothing re-shoots them — and the mechanism is Task 21.3's, so the row is homed there.

### Task 15.6: The two files past the stop, second half

**Added 2026-10-16**, when Task 15.4's own framing was found to be two rows short (see the annotation
above). Same class, same failure mode, and the same rule: **split by reading or by surface, never by
line count.**

**Files:**
- Modify: `src/web/packages/editor/src/ui-copy.test.ts`
- Modify: `src/web/tests/e2e/mockup-values.ts`

**Interfaces:**
- Consumes: Task 15.1's edits to `mockup-values.ts`'s `PARITY` table and its assertions
- Produces: `vg-415` closed (the copy walk's four added surfaces), `vg-420` closed (the e2e instrument)

**Ordered after Task 15.1**, which edits the same file, and after Task 15.4, whose split is the
precedent for the shape rather than for the cut.

- [ ] **Step 1: Re-measure both files.** The register's numbers (1039 and 1512) are stale; `mockup-values.ts` read **1784** at `da6f1f31`. A count carried from a row is a claim about a past tree.
- [ ] **Step 2: `vg-415`'s remedy is named on its own row** — a `*.test-stage` bridge fixture shared with `shell-layout.dom.test.tsx`, and the four surface reads divided so each file stays under the stop. The bridge fixture is the large shared chunk; **whether it is one module or belongs with an existing owner is the decision the row says it is**, and it goes on the row rather than into a header comment.
- [ ] **Step 3: `vg-420` is explicitly NOT a line-count split.** Its reader is one module with one export surface and the `PARITY` table follows it, so the split is **by reading** — values, declared sets, copied elements — with the table's own halves going with the reading that serves them. Say which readings the file actually holds before cutting it.
- [ ] **Step 4: Name each piece's responsibility in its own header**, and prove the collection is comparable rather than merely countable: the test titles before and after, with the missing and added counts.
- [ ] **Step 5: Re-run the red proof of every arm that moved** — a moved assertion that was not re-proved is not the same evidence — unless the bodies are verbatim slices of the original, in which case say so and compare them line by line, as Task 15.4's second half did.
- [ ] **Step 6: Close both rows**, each naming its own file.

---

# Phase 16 — W11: the behaviour findings the triage measured

**Outcome:** the eighteen rows a measurement pass reproduced at HEAD are fixed, and the two it could not
settle are settled by a run rather than by another reading.

**This phase exists because the pass changed what the remainder looks like.** Of the 66 orphan rows four
agents measured on 2026-10-16, **22 parked** with the options they wait on, **3 were withdrawn** because
their subject was gone, and **18 came back real and still true**. A real finding with no home is the one
state the plan's `# The rows no phase carries` section exists to end, so they get a phase rather than a
position statement.

**Owners:** the shell stylesheet (`src/web/packages/editor/src/editor-shell/editor-shell.css`), the
control primitives (`src/web/packages/editor/src/components/ui/`), the drawings
(`docs/design/mockups/current/`), and the session's own write paths (`editor-shell/bridge.ts`,
`grouping-manager/index.ts`, `panes/composition/kind-mark.tsx`, `selection-inspector/`).

**Constraints:** **queued behind Phases 12 and 15**, because one phase is active at a time. Every row
here was measured by a pass that read the tree and **ran nothing**, so a task's first step is to
reproduce its own case rather than trusting the pass's line numbers — several rows cite lines that have
moved, and `vg-487` cites the wrong file for the hook it names (the removal hook is
`SelectableCanvas.ts`, not `Canvas.ts`). **Task 16.3 changes drawings or `DESIGN.md`, which is a
design-language act**: where a drawing and the design language disagree, the drawing loses unless the
user has ruled otherwise, and `vg-496` and `vg-498` are two rows of exactly that shape.

**Acceptance:** each row's own `check` passes and is recorded on its line; the four instrument-shaped
rows (`vg-491`, `vg-492`, `vg-494`, `vg-499`) each carry a case that fails when the fix is disabled;
`npm run gate` exit 0 with its exit code named in the close commit, and the browser suite named
separately because `gate`'s `test` is `vitest run`.

**Failure modes:** repainting a drawing to match a product bug; a fix that makes the product agree with a
drawing the design language contradicts; treating a pass's line number as a landmark.

**Annotated 2026-10-16, at the phase's close: every task has run, the phase's fifteen rows stand at
thirteen `verified`, one `withdrawn` and one still open, and the Acceptance's instrument clause is met by
two of the four rows it names.** Phase 16's rows closed across Tasks 16.1–16.5 — `vg-479`, `vg-480`,
`vg-491`; `vg-483`, `vg-493`, `vg-494`, `vg-498`; `vg-496`, `vg-497`, `vg-492`; `vg-484`, `vg-486`,
`vg-489`, `vg-499`; `vg-487`, `vg-495` — and the two that do not close here are stated rather than
smoothed: **`vg-490` stays `open`, narrowed**, and `vg-499` is `withdrawn`.

**The Acceptance's four instrument-shaped rows, taken one at a time, because two of them cannot carry the
case it asks for and a close that claims four would be false.**

- **`vg-494` and `vg-492` carry it, and both were proved red.** `vg-494` fails at the out-of-range note
  while its two disagreement assertions above it pass, so the proof shows the note is what the case reads;
  `vg-492` reddens at `expected [ '1', '2', '3', '4' ] to deeply equal [ '1', '2', '3' ]` when the arm is
  put back.
- **`vg-491`'s fix was a deletion, so the clause cannot be taken in the direction it is written.** The row
  measured that deleting the four `::-webkit-scrollbar*` rules **reddens three existing cases** rather than
  leaving every check green — which is the same evidence with the sign flipped, and it also falsified two
  of the row's own claims. There is no fix to disable: the rules were dead declarations no browser this
  repo runs would read.
- **`vg-499` was `withdrawn`, so it owes no case at all.** Its measurement made the row's second clause
  false — the Tokens pane already derives and names the selection's preset — and a `verified` row whose
  title asserts an absence that does not exist would have needed a `check` for a capability that was never
  gone. **The phase's instrument clause should not be read as having been met four times.**

**Two of the phase's rows were falsified by the work rather than fixed by it, and both are on the row.**
`vg-496`'s cascade clause — that raising a drawing pulls its capture — is wrong, because a capture beside a
drawing is a copy of the built product and the product was already right; and `vg-499`'s premise is wrong
outright. **Three of the phase's briefs carried a pointer the seat falsified**: `vg-496`'s two drawings
were three, `vg-492`'s `editor-shell.css:2339` was `:2441`, and Task 16.5's `inspector-sections.spec.ts:1055`
was `:1102`. `vg-489`'s premise held and `vg-487`'s citation did not, which is the pass's correction being
right about a file the row named wrongly.

**The phase's Verify line was run as written**: `npm run gate` exit 0 with its code read from `$?` into a
file at every close — 261 files and 3444, 3448, 3450, 3454 tests across the five tasks, the count rising as
each added cases — and the browser suite named separately for 16.1, 16.3 and 16.5 on rebuilt bundles with
`control-fixture.html` present.

**Verify:** `npm run gate` (exit code read from `$?` into a file, never through a pipe), plus the
browser suite for Tasks 16.1, 16.3 and 16.5 on a rebuilt bundle.

### Task 16.1: The shell's scrollbars

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`; `src/web/tests/e2e/shell-appearance.spec.ts`

**Interfaces:**
- Produces: `vg-479`, `vg-480` and `vg-491` closed

**Annotated 2026-10-16, at the task's close: all three closed, and `vg-491` was wrong on three
measured counts.** The `Files:` line above named `shell-appearance.spec.ts`, which **Task 15.4 split at
`81426c44`** into `shell-palette-tokens.spec.ts` and `shell-palette-appearance.spec.ts` — the case lives
in the first. **`vg-479` took the row's second option, derived rather than six new per-palette values**:
`--vigilia-scrollbar-thumb` is `color-mix(in srgb, var(--shell-text) 24%, transparent)`, so one
declaration follows every palette and adds no literal. **`vg-480` names the two portalled classes in a
scrollbar-only rule** while the layout half keeps its two selectors, because the shared `overflow: auto`
would turn the popup's own `overflow-y: auto` into horizontal scrolling — and the class it names is
shared by four menus, not the row's two surfaces. **`vg-491` is deleted rather than pinned, and the row
was wrong three times**: deleting the four `::-webkit-scrollbar*` rules **reddens three cases** in
`editor-shell.control-rules.test.ts` rather than leaving every case green, the standard pair was already
the whole paint so deletion moves no pixel, and the pseudo-element read is not the trap the row
describes. **The measurement that makes the deletion right** is that either standard property being
non-`auto` disables the family, so the 10px width, the radius and the hover colour were declarations no
browser this repo runs would read — and the stylesheet's own comment claimed the reverse, which is
corrected in the same commit. `--vigilia-scrollbar-thumb-hover` went with them: `scrollbar-color` states
a thumb and a track, so a hover colour is what the pair cannot express.

- [ ] **Step 1: `vg-479` — the three `--vigilia-scrollbar-*` tokens are declared once on `:root` as literals** (`#c9c2b1`, its hover, `transparent`), and no palette block declares them, so a dark OS resolves the light thumb. Move them into the palette set.
- [ ] **Step 2: `vg-480` — the two portalled scrollers keep the platform scrollbar.** `.editor-shell-menu-popup` and `.editor-shell-dialog` both set `overflow-y: auto` and neither class is in the scrollbar rule, which names only `.editor-shell-panel` and `.editor-shell-inspector`.
- [ ] **Step 3: `vg-491` — the four `::-webkit-scrollbar*` rules are read by nothing.** The browser case reads the standard `scrollbarWidth`/`scrollbarColor` pair, so deleting the pseudo-element family leaves it green. Give them a case or delete them, and say which.
- [ ] **Step 4: Rebuild, run the appearance suite, and close the three.**

### Task 16.2: The control primitives' own contract

**Files:**
- Modify: `src/web/packages/editor/src/components/ui/`

**Interfaces:**
- Produces: `vg-483`, `vg-493`, `vg-494` and `vg-498` closed

- [ ] **Step 1: `vg-483` — `ControlWell` declares `describedById` and `ControlIconButton` never reads it**, so the prop is inert on the one control that draws a reason.
- [ ] **Step 2: `vg-493` — the gradient stop's offset is a bounded `ControlNumber`**, a text box where the sibling spacing controls carry a track.
- [ ] **Step 3: `vg-494` — the wheel handler returns early out of range while the thumb clamps to `max` and the well reads the stored value**, so the two halves of one control disagree about what it holds.
- [ ] **Step 4: `vg-498` — code pads 6, both drawings pad 6, and `DESIGN.md`'s §3 table says 4.** The table is the side that moves; say so on the row.
- [ ] **Step 5: Prove each of the four with a case that fails when the fix is disabled.**

### Task 16.3: The drawings against the design language

**Files:**
- Modify: `docs/design/mockups/current/controls.html`, `controls-editorial.html`, `shell.html`; `DESIGN.md`; `src/web/packages/editor/src/editor-shell/editor-shell.css`

**Interfaces:**
- Consumes: the drawings README's refresh rule
- Produces: `vg-496`, `vg-497` and `vg-492` closed

- [ ] **Step 1: `vg-496` — both control drawings draw the well at 36 where `DESIGN.md` §5 says 40.** Decide which is the intent and move one, recording why on the row; this is the one step in the phase that may change a drawing.
- [ ] **Step 2: `vg-497` — an unauthored precision renders 0 on the slider while the renderer draws at most one decimal**, so the field shows a value the scene does not hold.
- [ ] **Step 3: `vg-492` — the layer row's fourth-button arm is unreachable** (the row draws at most three), and the prose beside it still says "a row that draws four". Delete the arm and correct the sentence.
- [ ] **Step 4: Rebuild, run the design-language suite, and close the three.**

**Annotated 2026-10-16, at the task's close: all three rows are `verified` and the task's own Step 1 was
one drawing short.** It says *both* control drawings; there are **three** — `current/shell.html:323` draws
the same slider row (`Opacity %`) at the same 36px on the shell ground's tokens, which this task's own
`Files:` line names, so the third site was expected even though the step and the row both counted two.
`vg-496`'s title is corrected in the register and the three drawings now read 40.

**`vg-496`'s cascade clause was wrong and the measurement is what shows it.** The row said raising the
drawing pulls *its capture* behind it; a capture beside a drawing is a copy of the **built product**, and
the product's well has been 40 since `vg-469`'s item 10 (`dc0fa28d`, re-shot `2ce8ef1e`). `cmp` reads both
control-set pairs byte-identical, so **no capture moved and the drawing was the only 36** — which is why
the step's own *decide which is the intent* had one answer rather than two.

**`vg-497` took the row's first candidate, and `0049`'s ruling is why.** The track draws the renderer's
fallback and the well reads empty: `ControlNumber` — which the well **is** — already owns absence for every
other optional field, and a fourth control state would be a second vocabulary for one fact three lines
from the first. The track cannot hold the state (MDN's range input is never empty, ARIA requires
`aria-valuenow` for `slider`, Base UI clamps a number), so the disagreement is allowed to stand and is
stated where it can be. Note `0050` carries **all seven rungs with rung 4 run** — four ecosystem answers —
where `0049` recorded its rung 4 as unrun for want of a web search.

**`vg-492`'s third clause is discharged, and two of its three parts were discharged before the task ran.**
`vg-447` is `verified`, not open, and its 2026-10-15 re-measurement already carried the correction
verbatim; `vg-260` is `withdrawn`. Both now carry a dated clause naming the sentences that describe the
retired four-control row, and neither row's arithmetic was rewritten — a withdrawn row's figures are a
dated record, so the repair is a marker rather than new numbers.

**One row was filed rather than folded in** (`vg-539`): the mark slot's own comment, four lines up the same
stylesheet, still states the attended four-control row's numbers and still waits on a ruling that landed
2026-10-13. It is the same family of stale prose and a different comment about a different subject, so
`vg-492`'s close would have claimed more than the row names.

### Task 16.4: The silent paths

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/bridge.ts`; `grouping-manager/index.ts`; `panes/composition/kind-mark.tsx`; `selection-inspector/`

**Interfaces:**
- Produces: `vg-484`, `vg-486`, `vg-489` and `vg-499` closed

- [ ] **Step 1: `vg-484` — the footer's route through `bridge.run` is unwrapped**, so a construction refusal (no palette token) is silent; `constructing()` now lives in `new-object-panel.ts`, not in `add-pane.tsx`.
- [ ] **Step 2: `vg-486` — `group()` removes each member with `canvas.remove`**, and `scene-fabric/src/adapter.ts` disposes any `object:removed` target, so grouping disposes the objects it groups.
- [ ] **Step 3: `vg-489` — an unknown chart family falls back to the bar glyph**, which is the bar kind's own mark, so two kinds draw the same mark.
- [ ] **Step 4: `vg-499` — the inspector's reveal button and all its wiring are gone** and no scroll-to-preset route replaced it; either restore the route or record that the affordance was retired deliberately.
- [ ] **Step 5: Close the four**, saying for `vg-499` which of the two it was.

**Annotated 2026-10-16, at the task's close: three rows are `verified`, `vg-499` is `withdrawn`, and the
task's Step 1 pointer was right.** Two decision notes landed before the first write to each watchlisted
path — `0051-a-construction-refusal-is-reported-by-the-session-facade.md` and
`0052-the-party-that-removes-disposes.md` — in one commit (`a01b27b2`), and `0051` claims `bridge.ts` on
the basis of a comment rather than a behaviour change, which is stated on the row because a note claiming
a watched path should not be read as a change to it.

**`vg-484` took the row's first candidate**: the session façade owns a construction's refusal, and
`constructing` (`new-object-panel.ts:227`) is now exported and delegated to by `addText`, `addShape` and
`addChart`. The Add pane keeps its own call because it reaches `insertNewText`/`insertNewShape`
**directly** rather than through the façade, so no path is wrapped twice; `insertCard` is unwrapped
because the document already reports it at its own owner.

**`vg-486` is the phase's largest change and the row's re-review is why.** The adapter's
`object:removed` subscription is deleted and **six sites now dispose what they remove**;
`deletion-manager` gained a disposal it was missing (a member removed from a group leaves the root without
firing the event, so that leak never announced itself). One existing case changed with the behaviour it
read: `bridge.dom.test.ts`'s parity reference now disposes explicitly.

**`vg-489` took *a neutral chart glyph* over *no mark at all***, on the row's own comparison — the shape
arm already falls back to the kind's generic mark, and an empty slot would make the mark vanish rather
than abstain. The fix moves `KIND_GLYPHS.chart` as well as the fallback, because they were one constant
and that identity *is* the collision the row names.

**`vg-499` is `withdrawn` because the measurement makes its second clause false, not because the work was
deferred.** `preset-list.tsx:139` derives the preset it browses from `stage.selectionPresetId` and `:176`
prints *the selection is set to <name>*, so the Tokens rail slot is one click and the pane opens on the
selection's own preset — the capability the row says nothing offers. The ruling is the row's own third
candidate (**nowhere**), with the Content-section row and the panel's own search declined rather than
overlooked. **`verified` was not available to it**: the title asserts an absence that does not exist, so a
`verified` row would have to carry a `check` asserting a capability that was never gone.

**Two browser reds were re-measured at the base commit with this task's changes stashed and rebuilt**, and
neither is this task's: `inspector-sections.spec.ts`'s *gives every kind a column* belongs to `vg-519`,
which already records that file as a third instance of its shape, and `editor.spec.ts:4012`'s
*Ctrl-resizes near a neighbour…* is added to `vg-519` as evidence rather than filed as a row, **because
whether it is that row's second case or a canvas-mount defect is not established** — the discriminator is
the page snapshot, which the run did not capture.

### Task 16.5: The readings the passes could not take

**Files:**
- Modify: nothing until the runs answer; then whatever each row names

**Interfaces:**
- Produces: `vg-487`, `vg-490` and `vg-495` closed or refiled on what the runs show

- [ ] **Step 1: `vg-487` — Fabric's `_hoveredActualTarget` is never cleared on removal.** The pass corrected the row's citation: the removal hook is `SelectableCanvas.ts`, not `Canvas.ts`. Establish whether the leak is reachable from this product before fixing an upstream fact.
- [ ] **Step 2: `vg-490` — the pass could not settle the negative claim** ("no browser case") item by item, and found one item already falsified: a browser case asserting the section header's trailing rule exists at `inspector-sections.spec.ts:1055` and predates the row. Re-read the row against that, then either narrow it or close it.
- [ ] **Step 3: `vg-495` — the claim is a runtime ordering one** (red in the full suite, green alone) that a read-only pass cannot reproduce. One run settles it.
- [ ] **Step 4: Rebuild, run each case alone and then in the suite**, and close or refile on what the two samples show — a single sample of a flaky spec is not a measurement.

---

# Phase 17 — W12: the rows the measurement passes left standing

**Outcome:** the eighteen rows the 2026-10-16 measurement passes reproduced at HEAD — and which neither
Phase 15 nor Phase 16 homes — are fixed, and the parity and register instruments stop reading green over
the gaps they were written to catch.

**Why a third phase rather than more tasks in the other two.** Phase 15 homed the instrument gaps and
Phase 16 the behaviour findings the passes returned *first*; these eighteen came back from the same
passes and were left when those phases were scoped. Adding them to either would push a phase past the
plan's own 3–5 task shape, and their owners are different again: the editor's boot path, the glass and
capture path, the parity instrument, and the register's own checker.

**Owners:** `src/web/packages/editor/src/editor-main.ts` with `draft-store.ts` and
`scene-fabric/src/chart-refresh.ts`; `src/web/packages/scene-fabric/src/glass.ts` with
`editor/src/thumbnail-capture.ts`; `src/web/tests/e2e/`; and `scripts/backlog-check.mjs`.

**Constraints:** **queued behind Phases 12, 15 and 16**, because one phase is active at a time.
**Task 17.4 edits `scripts/backlog-check.mjs`, which is on `scripts/reuse-gate.mjs`'s watchlist**, so it
lands a decision note before its first write — and note that `vg-535` records the gate's hook not
blocking, so the note is owed on the merits rather than enforced. **Every row here was measured by a pass
that ran nothing**, so each task reproduces its own case first: several rows cite lines that have moved,
and the pass corrected `vg-487`'s file for the same reason.

**Acceptance:** each row's own `check` passes and is recorded on its line; the four instrument rows
(`vg-391`, `vg-398`, `vg-502`, `vg-514`) each carry a case that fails when the fix is disabled;
`npm run gate` exit 0 with its exit code named in the close commit, and any browser run named separately.

**Failure modes:** widening an instrument until it accepts the failure it was written to catch — which is
`vg-502`'s and `vg-514`'s whole subject; treating a pass's line number as a landmark; and closing a row
on "the case passes" where the case could not have failed.

**Verify:** `npm run gate` (exit code read from `$?` into a file, never through a pipe), plus the browser
suite for Tasks 17.1, 17.2 and 17.3 on a rebuilt bundle.

**Annotated 2026-10-16, at the phase's close: all five tasks have run, the phase's eighteen rows stand at
eighteen `verified`, and its Acceptance is met.** `npm run gate` **exit 0** (262 files, 3463 tests), read
from `$?` into a file; **the browser suite named separately as `npx playwright test --workers=1` over all
projects, exit 1 — 334 passed / 253 skipped / 3 failed, 20.6 minutes — and all three reds are rows the
register already owns, matched by the case each row names**: `glass-lifecycle.spec.ts:25` is `vg-431`,
`editor-display.spec.ts:659` is `vg-258`, and `publish-loop.spec.ts:349` is `vg-212` down to the
`Received: "e2e-publish-loop"` its own detail quotes. **The Acceptance's instrument clause was
verified row by row rather than taken from the reports**: `vg-391`'s case was cut four ways and only
cutting *both* repaint calls turns it red, `vg-398`'s instrument was red-proved by the controller inside
Task 17.3, and `vg-502`'s and `vg-514`'s cases are `backlog-check.mjs`'s own self-test cases — disabling
rule 9 reddens *a row that vanished from both registers fails*, and disabling rule 10 reddens *a check on
an open row fails* and two more, each restored byte-identically with `cmp`. **This phase is where the
drain's own verification rule was written**: Task 17.3's implementer reported a red proof that was a race
rather than the cut it had made, so every red proof in this phase is re-run by whoever closes the row —
and the eight that predated the rule were re-run at `3adfb8bf`, five of them rebuilding `dist` for the cut
and rebuilding it back. **One of them corrected a row's premise rather than confirming it**: `vg-519`'s
second case passes with its fix disabled. **The close owes no re-homing** — the four rows the phase owned
are all closed, and the twelve it merely names were homeless before it named them (the tenth correction),
so a census taken after this close will report them as newly homeless when nothing was lost.

### Task 17.1: The editor's boot and draft lifecycle

**Files:**
- Modify: `src/web/packages/editor/src/editor-main.ts`; `draft-store.ts`; `src/web/packages/scene-fabric/src/chart-refresh.ts`

**Interfaces:**
- Produces: `vg-510`, `vg-511` and `vg-512` closed

- [ ] **Step 1: `vg-510` — `pagehide` disposes the chart refresh under `{ once: true }` and stops the publisher, and no `pageshow` restarts either**, so a restored page keeps a disposed refresh; `startChartRefresh` returns `setRate` and `dispose` with `disposed` never reset.
- [ ] **Step 2: `vg-511` — a failed draft restore writes its message and `bootTheme` then overwrites the same status element**, so the author is told the draft failed and then told something else.
- [ ] **Step 3: `vg-512` — the draft's single slot is written whenever the document is dirty with no transition gate**, so a theme switch can persist the outgoing document's draft over the incoming one's.
- [ ] **Step 4: Close the three**, each against the commit that fixes it.

**Annotated 2026-10-16, at the task's close: all three rows are `verified`, and two of the three took
none of the shapes their row sketched.**

**`vg-510`'s three sketched candidates were all declined.** The loop gained **`stop()`/`start()` beside a
one-way `dispose()`**, because `dispose` is called by the player's own mount teardown
(`player/src/main.ts:203`) — so making it reversible makes the name a lie and lets a stray call revive a
torn-down loop — and re-creating the loop would mean `editor-main` holding the `refresh` callback and
`onError` for a second construction. The `{ once: true }` goes with it, which is the clause the row itself
identified as making a second firing moot. The state is three lifetimes rather than two
(`running`/`stopped`/`disposed`), and the idiom is the one this repo already fixed this defect with:
`DraftAutosave.start`/`stop` on `4a8e339b`.

**`vg-511`'s ruling is that the refusal reports on the shell's diagnostic line, not the status line.** The
status element is last-writer-wins by design and the boot writes it last, so any ordering fix is undone by
the next writer; the diagnostic line is held until the first committed edit, which is exactly as long as
the refusal is true. Decision `0051` is the precedent — *a toast would be a second message surface for a
refusal that already has one* — so this adds no surface. `error-manager/index.ts` gained a `draft`
category.

**`vg-512` changed no store behaviour, and the row says so rather than being glossed.** Its
WHAT-WOULD-CLOSE-IT asked for a ruling and *the store changed to match it*; the ruling is that the slot
owes **the announcement, not a different slot**, so the store needed no change and the announcement is what
changed — it rides `vg-511`'s message, which names the draft, the reason, and the fact that editing the
document replaces it. All three of the row's candidates are rejected on the row's own ground: a second slot
reverses `vg-040`'s decision 1, and a pin or a refusal-to-draft both leave the document the author **is**
editing undrafted, which the row calls strictly worse. **No red proof, and none is claimed** — the change
is a ruling plus a characterisation case that passes at HEAD by design.

**Step 3 and `vg-512` did not describe the same symptom, and the gap is filed rather than closed.**
Step 3's own subject is *a theme switch can persist the outgoing document's draft over the incoming one's*,
which is a draft the build **can** read; `vg-512` is a draft it **cannot**. So **`vg-541`** records the
un-gated transition the step names, with the mechanism read rather than measured: the autosave is
constructed once (`editor-main.ts:99`, from a `start()` called once at `:583`), so it survives a document
switch, and its single `dirty` flag then describes the outgoing document while `writeNow` reads the
incoming one. **The observable outcome is unmeasured**, and the row names the one tick that would settle
it.

**The task's own third trailer is filed too**: **`vg-540`** — the player tears its whole mount down on
`pagehide` under `{ once: true }`, so a display restored from the back/forward cache is frozen until a
reload, and *reload versus re-arm* is a bigger ruling than it looks.

**The pointers moved by six to twenty lines, and the row's numbers are the stale ones.** `vg-510` cites
`editor-main.ts:426-428` for the hook (actual 431) and `draft-store.ts:169-180` for `bindDraftAutosave`
(actual 189-200); `vg-511` cites `:465-470`/`:476`/`:488-489` (actual 470-474, 481, 494); `vg-512` cites
`editor-main.ts:465` (actual 477) and `draft-store.ts:146`/`:147` (actual 150-157).

### Task 17.2: The glass and capture paths

**Files:**
- Modify: `src/web/packages/scene-fabric/src/glass.ts`; `src/web/packages/editor/src/thumbnail-capture.ts`

**Interfaces:**
- Consumes: `vg-023`'s settled two-paint-context ruling
- Produces: `vg-515`, `vg-516`, `vg-505` and `vg-527` closed

- [ ] **Step 1: `vg-515` — `blurRadius` scales by `Math.hypot(own[0], own[1])`**, which at angle 0 is `|scaleX × viewport × retina|` with `scaleY` absent, while the inspector's Size arms write both scales.
- [ ] **Step 2: `vg-516` — the glass-circle parity probe's two readings differ by 3.6% and its own report says "Cause not established"**; the 462 rim pixels are named at rows 236–239 and 319–320, columns 52–54 and 201–203. Establish the cause or record the reading as the instrument's limit.
- [ ] **Step 3: `vg-505` — the host-player strip case at `host-player.spec.ts:1280` was red in the Phase 14 boundary pass and no row named it.** The pass confirmed the case, both assertions and the conditional strip exist unchanged; the red itself was never re-run, so reproduce it before fixing.
- [ ] **Step 4: `vg-527` — nothing lifts the entered-group dim on the capture path**, so a package saved while a group is entered stores a dimmed thumbnail; the 2026-10-15 ruling is implemented nowhere.
- [ ] **Step 5: Rebuild and run each case alone, then close the four.**

**Annotated 2026-10-16, at the task's close: all four rows are `verified`, and two of the four were closed
by refuting the row rather than by satisfying it.**

**`vg-515` took the decision the row said was missing, and took it on an invariance rather than on taste.**
`blurRadius` was the matrix's x row alone — `Math.hypot(own[0], own[1])`, which is `scaleX` — and is now
`Math.sqrt(Math.abs(own[0] * own[3] - own[1] * own[2]))`, **the determinant's root**. A filter takes one
length and the draw is at identity, so two scales have to become one number; the equal-area scale is the
only rotation-independent choice that is **unchanged whenever the scale is uniform**, which keeps every
uniformly scaled panel painting exactly as it did. Decision `0053` landed before the first write to the
watchlisted file. **Red-proved twice**: the unit cases read `blur(96px)` for 4×1 and `blur(24px)` for 1×4
where 48 is required, and the browser parity case read **2.375 against 9.164** with the fix off against
**6.000 against 6.075** with it on — the pair is asserted close rather than equal, because two panels'
own rasterisation differs by a fraction at one blur.

**`vg-516`'s 462 px is NOT reproduced, and the row is closed on a rebuilt measurement rather than on its
own.** The row's two harnesses no longer exist, so the 3.6 percent was re-taken from baselines rebuilt
in-tree: both the bare page and the circle-frosted page read **11,631 px, 0 px differing**. **What the
probe records for the original number is the same class of effect at a different capture scale, marked as
inference** — a later reader who needs the 462 needs harnesses no commit holds. The cause found is real
and is **the cache, not the frost**: attaching the treatment calls `uncacheChain`, so a frosted page's
rect paints uncached where a bare page's paints through its cache; lifting the treatment on one page moves
11,631 → 11,620 with **all 53 px on the frost's own outline**, and a bare page with only `objectCaching`
off lands on the same 11,620 with 0 px between them. So the rim is a threshold effect at a soft edge, the
instrument's limit is written where the number is (the outermost 2–4 px of a thresholded frost box is not
a measurement of the frost), and the frame measure moved to `tests/e2e/frame-diff.ts` so one instrument
serves both questions.

**`vg-505`'s premise is refuted, and the refutation was the work.** The row says the case *finds no
connection strip to assert*; the case in fact **never refused the stream** —
`page.route("**/ws")` is globbed against the whole URL and the stream's is `…/ws?keys=…&session=…`, so the
route matched nothing and the case caught the ordinary *Connecting to the host — 1 sensors requested*
strip at about 250 ms. **So this was a defect in the case rather than in the player**, which is why the
ordered-suite red and the isolation red were identical: the isolation re-run the row leans on could not
tell a product defect from a setup that never ran. Fixed with `url.pathname.endsWith(SAMPLE_STREAM_PATH)`.
**The row's three neighbours (`vg-431`, `vg-258`, `vg-212`) are not this row and stay red.**

**`vg-527` implemented the 2026-10-15 ruling rather than re-taking it**, after settling the row's own
unmeasured clause first: *whether the thumbnail is regenerated on exit rather than only on save* — it is
the **save** that captures, so the defect is reachable in the common path and not in a corner.
`grouping-manager` gains `suspendDim()` returning a release; `captureCanvas`/`captureThumbnail` take it and
hold it **across `toCanvasElement` alone**, so the live canvas keeps its dim and only the captured pixels
are undimmed. Red-proved on both halves: the unit case read `['shot']` where `['lift','shot','restore']` is
required, and the browser case read alpha **115** in the capture where the document's paint is **255**,
with the live canvas correctly 115 in both runs.

**Two rows filed rather than folded in.** **`vg-542`** — `host-player.spec.ts:550`'s palette case read ink
**496** against a floor of **500** in the ordered run and passed twice alone, so the floor is one sample
from a load-sensitive red; it is filed rather than fixed because the two remedies (lower the floor, or stop
the read racing the first paint) are opposite products of a question the row that set 500 does not answer.
**`vg-543`** — two more specs still carry their own frame-decode helpers now that `frame-diff.ts` is the
shared owner, which is how `vg-516`'s class of finding comes back.

**`glass.ts` is 854 lines and was already over the 800 stop before this task** (846 at `5ad08048`), so the
task added 8 lines to a file that is already one of `vg-536`'s *33 named by no row* — **no new row is owed
and none was filed**. An independent recount of files over 800 lines at `5ad08048` returns **exactly 47**,
reproducing `vg-536`'s stated census. `thumbnail-capture.ts` is 101 lines and `frame-diff.ts` 159.

### Task 17.3: The parity instrument's remaining gaps

**Files:**
- Modify: `src/web/tests/e2e/`

**Interfaces:**
- Produces: `vg-391`, `vg-393`, `vg-398`, `vg-421` and `vg-451` closed

- [ ] **Step 1: `vg-391` — no spec requires a sample to repaint the artboard**, and the surviving player case requires two paused frames to be byte-identical. **Its supporting claims are corrected on the row**: `openPaused` does have a caller, at `host-player.spec.ts:923`, and `installFixedClock`'s sites are `editor.spec.ts:5188` and `:5271`.
- [ ] **Step 2: `vg-393` — the resize case's numbers reproduce from the retained report** (sub-unit ask 118.4, landed 145.2285, `renderedWidth` 27.2285), and the cause is still unestablished; the row is a browser investigation, not a patch.
- [ ] **Step 3: `vg-398` — the triage documents' `--grep` values are not all case titles.** `vg-028`'s cell greps `"playback"`, which matches no case title in `editor.spec.ts`, and `vg-259`'s pattern occurs only as an assertion message. Sweep the 36 occurrences and correct or drop each.
- [ ] **Step 4: `vg-421` — the font catalogue's facet filter keeps untagged entries reachable** and the plan's step asserts it; decide whether the filter or the assertion is the intent.
- [ ] **Step 5: `vg-451` — `${solidOf.background}` is interpolated into a `setContent` document with no guard**, and the neighbouring assertions cannot fail on an absent key.
- [ ] **Step 6: Rebuild, run the affected suites, and close the five.**

**Annotated 2026-10-16, at the task's close: all five rows are `verified`, and the task's most useful
finding is one the controller's own verification produced rather than the implementer's.**

**`vg-391` got the case rather than the *coverage not wanted* close**, so the first of the two options its
own text leaves open was taken. `host-player.spec.ts:802` screenshots `#artboard canvas.lower-canvas`,
waits for a consumed batch, polls for a painted clock reading, and requires a second sample to move both
the reading **and the pixels** (`Buffer.compare(...) !== 0`). A screenshot rather than the text property,
because the property moves whether or not anything repaints.

**THE ROW'S OWNER POINTER IS INCOMPLETE, AND NO SINGLE CUT DISABLES THE REPAINT.** The row names
`player/src/main.ts`'s `refresh()` as the owner. But `refreshBoundText` ends with an unconditional
`canvas.requestRenderAll()` (`scene-fabric/src/fabric-text.ts:397`) **and** the player calls it again at
`main.ts:174`. Measured over four rebuilds: the player's call cut alone → **green**; the helper's call cut
alone → **green**; **both cut → red**, on the pixel assertion. Either call subsumes the other.

**That measurement exists because the implementer's red proof was wrong, and the wrongness is the phase's
own failure mode arriving from the other side.** The new case read the clock **once** after the connection
strip disappeared; the strip disappearing says a batch was **consumed**, not that the repaint carrying the
reading has been scheduled and run, so the read raced that frame and saw the placeholder `—`. It passed at
1.5 s and failed at 319 ms — about two runs in three. **So a case that failed on a single cut failed for
the race, not the cut**, and the cut does not produce that failure. The controller found it on the first
independent re-run, fixed it in place at `2f5bd37c` with a poll (the idiom the two assertions three lines
below already use), and re-ran the four-way cut measurement. **The lesson is not *a case that could not
have failed* but its mirror: a red read as the red you were looking for.** Every red proof in this phase
should be re-run by whoever closes the row.

**Two line numbers in Step 1 above are stale, and the row's own 2026-10-16 correction carries the same
stale ones.** `installFixedClock`'s sites are **`editor.spec.ts:5251` and `:5334`**, not `:5188`/`:5271`,
and `openPaused`'s caller is **`host-player.spec.ts:925`**, not `:923` (`openPaused` is defined at
`clock.ts:124`). The claim the correction was making — that the surviving player case asserts frame
*equality* rather than repaint — holds, and the new case now asserts the repaint beside it.

**`vg-393` closed on an established cause, so the row's second candidate is refuted rather than left
open.** The trace, against the built preview with `getScenePoint` and the object's `set` instrumented: the
12-step drag runs scene 455.371 → **117.034** in 28.19-unit steps, and the ask (`left + 0.4` = 118.4) is
**0.17 client px** at this zoom where a whole client px is 2.35 scene units — so Chromium's rounded pointer
lands **left of the object's own left edge at 118**, where Fabric's `changeObjectWidth` refuses a pointer on
the far side of the origin, and the width left behind is **the previous step's**. Candidate 2 (*the editor
re-derives the width after `guardBoxWidth`*) is refuted: every traced write's requested value equals the
value left behind. Candidate 1's shape is right but its mechanism is **the previous step of the same drag**,
not another frame. **This settles what `vg-370` was blocked on**: the box the `value < 1` refusal would floor
is **unreachable by a pointer at this zoom**, not skipped. The controller reproduced the row's numbers
against the retained report (`145.22846441947564` and `27.228464419657`); the implementer's run reproduced
both while landing on a different Fabric width (36.137 against 35.637) because its drag ran at `scaleX`
0.73319 rather than 0.74320 — reported rather than smoothed.

**`vg-398`'s scale is 27 commands, not 36, and the row understated the prose by seven.** Of the 36 `--grep`
occurrences, **nine are prose or a column header** (the row said two), leaving 27 command values, 26
distinct. Three collect nothing and each is recorded on its own cell: `vg-028` (`"playback"` — and no title
anywhere carries it, so the repro needs a new case), `vg-259` (a value that is an assertion **message**;
Playwright matches titles) and `vg-360` (its case was rewritten). Two more were loose and corrected:
`vg-281` (`"New"` matched two titles) and `vg-284` (`"sheet"` matched three). **The instrument is
`tests/e2e/triage-cells.test.ts`** (3 cases) and it is the answer to *how many of the rest collect nothing
is NOT established* — it fails when a value matches no title and the cell does not say so. **The controller
red-proved it independently**: breaking a corrected value makes it fail with
`triage-B2.md:62 vg-204 --grep "…"`, naming both the file and the row, restored byte-identically by `cmp`.

**`vg-421` is documentary and has no red proof, which is said rather than manufactured.** The plan's step
was the stale side: its title, its comment and its assertion all now state the shipped rule, and the
assertion changed from `toBeGreaterThanOrEqual` — **which passed under either rule** — to `toBe(tagged.length)`,
which is false under a union. That is the whole defect: a step that could not fail, fixed by making it able to.

**`vg-451` took the assertion rather than the throwing reader**, and the reason is a boundary rather than a
preference: `shell-tokens.ts`'s `themeToken` throws because it parses a **stylesheet** where an absent name
is a reader bug, while this value comes from a **product module** with exactly one consumer, so the guard
belongs at the point of use. `reference-theme.spec.ts:1401` binds `const backdrop = solidOf.background` and
`:1402` asserts `toMatch(/^\S+$/)` before `:1404` interpolates the local. **The row's *worth a look
wherever a product value is templated into CSS text* is answered, not implied**: three sites in the browser
suite write CSS text and this is the only one interpolating a product value.

### Task 17.4: The register's and the context menu's own instruments

**Files:**
- Modify: `scripts/backlog-check.mjs`; `src/web/tests/e2e/editor-context-menu.spec.ts`; `src/web/tests/e2e/editor.spec.ts`

**Interfaces:**
- Produces: `vg-502`, `vg-503`, `vg-514` and `vg-519` closed

- [ ] **Step 1: Land the decision note** claiming `scripts/backlog-check.mjs`.
- [ ] **Step 2: `vg-502` — the checker validates membership and not continuity**, so a row that vanishes passes and the printed "all valid" is the only set-level number. Decide what continuity means before writing the rule.
- [ ] **Step 3: `vg-514` — the `check`/`artefacts` rules are gated on `state === "verified"`**, so an open row can carry a check nothing validates; refuse it or say why it is allowed.
- [ ] **Step 4: `vg-503` — both empty-canvas helpers return unrounded fractions** where the object-menu helper rounds, so two helpers in one file disagree about what a point is.
- [ ] **Step 5: `vg-519` — one of a pair of reload cases carries the dismiss fix and the other is untouched**, and no sweep of the other reloads happened. Sweep them.
- [ ] **Step 6: Prove each rule with a case that fails when it is disabled, then close the four.**

**Annotated 2026-10-16, at the task's close: all four rows are `verified`, and the task's premise about
`vg-519` did not survive its re-run.** `vg-503` takes the first of the two candidates the row names — both
helpers round the candidate and probe at that rounded point — and claims no red proof, because the
helpers' own 0.02 grid lands on no fractional point whose rounding is not also empty; the hazard is real at
a 0.002 step and the seat measured three concrete points. **`vg-519`'s red is one case, not two**: with the
dismiss removed, `inspector-sections.spec.ts`'s case times out with the draft dialog in the snapshot, while
`editor.spec.ts`'s own case passes alone and in its file and the missing dismiss breaks a *later* case
instead — twice identically, at `captures the theme-library chooser over a stubbed library for visual
review`, which passes alone at HEAD. `answerDialogIfShown`'s own owner records why: the dirty guard
resolves before it asks, so some rounds ask and some do not. The four affected files read **130 passed,
exit 0**. Steps 1–3's two rules were red-proved here as well — see the phase's annotation.

### Task 17.5: The two design-language residues

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`; `docs/design/mockups/current/settings.html`; `src/web/tests/e2e/design-language.spec.ts`

**Interfaces:**
- Produces: `vg-509` and `vg-440` closed

- [ ] **Step 1: `vg-509` — the palette pane's heading is drawn as a `12px/1` sentence-case heading** where the other settings tabs draw the `10px/.11em/uppercase` eyebrow, and the product styles one `<h3>` as the eyebrow. `DESIGN.md` §2 reserves uppercase for a region eyebrow, so decide which side the pane heading is.
- [ ] **Step 2: `vg-440` — the about drawing's page body declares `font: 12px/1.45`** and the comparison reads no `line-height`, so the value is unmeasured; `vg-437` settled the companion at 1.4, which makes the drawing the stale side by the drawings README's own rule.
- [ ] **Step 3: Rebuild, run the design-language suite, and close the two.**

**Annotated 2026-10-16, at the task's close: both rows are `verified`, and this task's Files line named a
file that does not exist.** `src/web/tests/e2e/design-language.spec.ts` was split into
`design-language-*.spec.ts` before the task ran, and `editor-shell.css` was not touched — the fix is the
drawings'. **`vg-509` has no red proof, and the reason is narrower than the brief guessed**: the drawings
gate holds a size to §2's six and both 12px and 10px are on that list, so it cannot tell the two drawings
apart — and `mockup-parity.ts` has no row addressing that heading, so nothing compares it with the product
either. That absence is not filed as a row: the parity instrument samples the drawings rather than pinning
every element. **`vg-440` met both halves of its condition**, and its re-shoot clause was measured rather
than assumed — the frames beside the drawings are product captures, not renders of them
(`settings-capture-graphite.png` is 408x304 where the drawn modal is 560px wide), so nothing was re-shot
and `vg-402` is untouched. **What the correction overrode is recorded on the row**: 25 eyebrows drawn `/1`,
a 1.5 reading rhythm, a 13px/1.2 section title and a 13px/1 brand mark carried deliberate per-element
ratios and now state §2's companion; the row's condition is literal about that and §2 is normative, but no
gate reads the property, so nothing else will catch a disagreement. `vg-326`'s clause reading the furniture
as stating a ratio is falsified by this and corrected in place.

---

# Phase 18 — W13: the editor's control set, its copy, and the states it expresses

**Outcome:** the twelve ruled rows whose owner is the editor's control set and shell are landed — the
control set stops printing hardcoded English, gains a channel for an invalid-but-editable value, and the
shell's keyboard and chip rules match what their own comments claim.

**Why a phase of its own.** These twelve share one owner (`components/ui/` and `selection-inspector/`)
and one subject: a shared control expressing its states the way the rest of the product does. Phase 16
homed behaviour findings *in the panes*; these are the controls those panes are built from.

**Owners:** `src/web/packages/editor/src/components/ui/` (`control-*.tsx`, `dialog.tsx`),
`src/web/packages/editor/src/selection-inspector/` (`index.ts` — `style.ts` was deleted at `aa5edf96`
and `scripts/reuse-gate.mjs`'s watchlist still names it), the editor shell's shortcut
manager and identity chip, `src/web/packages/editor/src/ui-copy.ts`, `host/src/themes/store.ts` and
`editor/src/boot-theme.ts` for the tie-break.

**Constraints:** **queued behind Phases 12 and 15–17**, because one phase is active at a time.
**`components/ui/` is on `scripts/reuse-gate.mjs`'s watchlist**, so Task 18.1 lands a decision note before
its first write — landed as `0056`, which also found that the channel `vg-263` asks for already exists in
`ControlNumber`. **The watchlist's second editor entry, `selection-inspector/style.ts`, is a dead path**
(deleted at `aa5edf96`), so Task 18.5 owes no note for it and its subject is `index.ts`'s field funnel.
**Every row here was ruled in Phase 1
on 2026-10-12 and none has been measured since**, so each task reproduces its own case first: several
rulings cite line numbers taken that day. **The same is true of this phase's own `Files:` lines and
premises — re-read at `eb705a9f`, four named paths did not exist and two of Task 18.2's premises were
false**; the corrections are annotated on the tasks themselves.

**Acceptance:** each row's own `check` passes and is recorded on its line; the copy rows name the census
key they added or moved; `vg-252` and `vg-290` each carry a case that fails when the fix is disabled;
`npm run gate` exit 0 with its exit code named in the close commit, and the browser suite named
separately for Tasks 18.3, 18.4 and 18.5.

**Failure modes:** moving a string into `uiCopy` and leaving the hardcoded one in place; a control-set
state added as a prop no consumer reads; widening `RESERVED_LETTERS` by guess rather than by the browser
measurement the ruling asks for.

**Verify:** `npm run gate` (exit code read from `$?` into a file, never through a pipe); the browser suite
for the chip, the slider preview and the picker tracks, on a rebuilt bundle.

**Closed 2026-10-16, base `6508ac42`.** **The Acceptance is met and every clause was checked rather than
assumed.** All **twelve** rows the phase produces are `verified` and each carries a `check` on its own line —
`vg-264`, `vg-336`, `vg-263` (`ee82150a`); `vg-289`, `vg-272` (`f5788e86`); `vg-252`, `vg-290` (`c0b0ceb7`);
`vg-223`, `vg-279` (`5da31012`); `vg-254`, `vg-249` (`6508ac42`); `vg-363` (`e836a9ee`) — and all six
`artefacts` shas resolve and are ancestors of HEAD. **The copy-rows clause was not met when it was first
read and is met now**: `vg-264` named `uiCopy.controls`, the key it added, but `vg-336` named only the table
it read from; `ee82150a`'s `ui-copy.ts` diff is **+22 lines and is entirely these nine keys**, so both rows
name them (`ce265904`). **`vg-252` and `vg-290` each carry a case that fails when the fix is disabled, and
both were re-run by the controller rather than taken from the reports.** `npm run backlog:check` **exit 0**
(548 items, 136 open). `npm run gate` **exit 0** — 262 files, **3474 tests**, and `typecheck` across all
seven workspaces. **The browser suite is named separately, because `gate`'s `test` is `vitest run` and never
runs Playwright**: `npx playwright test --workers=1` reads **exit 1, 336 passed / 3 failed / 255 skipped in
22.7m**, and **all three reds are rows the register already owns** — `vg-431`
(`glass-lifecycle.spec.ts:25`, desktop-chromium), `vg-258` (`editor-display.spec.ts:659`, phone-chromium)
and `vg-212` (`publish-loop.spec.ts:349`, own-host). No new red. **What the phase found about itself is
worth more than its rows**: **five of its own premises were false or stale and every one was caught by the
seat that had to implement it** — `dialog.tsx` declares no `ACTION_BUTTON` and there were four declarations
rather than three; `vg-279`'s manifest carried no product version at all; `vg-223`'s breakpoint had moved
from 640x360 to 560x360; `vg-252`'s breadth was overstated because the deferral is action-scoped; and
`vg-254`'s `aria-valuenow` half had already been fixed by `vg-449`. **Four briefs in a row carried a pointer
that was not read off the disk**, which is the brief-facts rule failing in the seat that writes the briefs;
the last two briefs read every pointer off the disk and still lost one (`control.dom.test.tsx:659-676`).
**Two rows were filed from the landings rather than lost** — `vg-545` and `vg-548` — and one watchlist entry
was found dead (`selection-inspector/style.ts`, deleted at `aa5edf96`, filed as `vg-544`).

### Task 18.1: The control set's copy and its invalid-value channel

**Files:**
- Modify: `src/web/packages/editor/src/components/ui/control-*.tsx`; `src/web/packages/editor/src/ui-copy.ts`; the copy census test beside it; `src/web/packages/editor/src/panes/tokens/paint-list.tsx` (Step 3's rewiring — the row and this plan both say `panes/add/`, and the file is under `panes/tokens/`)

**Interfaces:**
- Produces: `vg-264`, `vg-263`, `vg-336` closed

- [ ] **Step 1: `vg-264` — the control set's refusal copy comes from `uiCopy`.** The React control set prints its refusals in hardcoded English; `uiCopy` is the repo's one owner for user-visible strings and carries a copy census, so the control set gains a copy dependency and each consumer supplies its strings through the locale the shell already sets. The row's other half is corrected rather than ruled: the panes' own invalid-value copy was never unreachable because it never existed.
- [ ] **Step 2: `vg-336` — the picker's four tracks announce their names.** They announce their `data-testid`, so a screen reader reads a CSS-selector-shaped string; they announce Saturation, Hue, Alpha and Value from `uiCopy` and keep their current testids, so the specs that address them do not move.
- [ ] **Step 3: `vg-263` — an invalid-but-editable value becomes a named member of the control set**, rather than the platform's `reportValidity()` carrying it, so the state is expressed and reviewed the way every other control state is.
- [ ] **Step 4: Close the three**, each naming the census key it added or moved.

**Annotated 2026-10-16, at the task's close: all three rows are `verified` at `ee82150a`.** **Step 3's
premise was the phase's most useful correction: the channel the row asked the set to invent already
existed**, in `ControlNumber` since `e3b19da4` — `aria-invalid`, an `aria-describedby` reason, the field
left editable — so the work was generalising it onto `ControlProps` rather than designing it. **Step 1
owes no red proof and says so**: the five words are unchanged, so a case can only redden against a changed
literal, never against the indirection the ruling asked for. **Step 2 is red-proved** (2 failed, exit 1,
with the fix disabled) and keeps the copy walk's skip rule untouched, which was the row's condition.
**Step 3's close condition was verified in Chromium** — `editor.spec.ts:981`'s palette case, rebuilt
bundle, 1 passed exit 0 — because jsdom cannot see the platform bubble the row is about; the spec's
locator moved off the deleted `data-vigilia-palette-error` onto the `aria-invalid` + described-by pair,
which is the honest replacement: the old assertion was that a sibling existed, the new one is that the
field is described. **One defect this landing made visible is filed rather than fixed** — `vg-545`: the
reason is sticky when the author edits back to the value already held, because `ControlText` declines to
report a commit that changes nothing and `invalid` is a prop it cannot clear; the fix is a design decision
about who owns a repairable refusal, so it is not this task's.

### Task 18.2: One owner for the two button idioms

**Files:**
- Modify: `src/web/packages/editor/src/components/ui/dialog.tsx`; `new-document-chooser.tsx`; `persistence-manager/replace-document-prompt.tsx`; `theme-library-dialog.tsx`; `panes/tokens/paint-list.tsx`; `panes/tokens/preset-list.tsx`

**Interfaces:**
- Produces: `vg-289`, `vg-272` closed

- [ ] **Step 1: `vg-289` — the shared dialog primitive owns `ACTION_BUTTON`.** **Corrected 2026-10-16: the primitive does not declare it today** — the three declarations are `new-document-chooser.tsx:41`, `persistence-manager/replace-document-prompt.tsx:13` and `theme-library-dialog.tsx:51`, and `dialog.tsx:43` is a line inside `DialogPrimitive.Root`. What is already true is the second half: all three dialogs import that primitive, and **the three declarations were already drifting** — the first two are byte-identical while the third carries `enabled:hover:` and `disabled:text-faint`. So the token moves into the primitive the three already depend on and their own copies are deleted. A new `components/ui` module is rejected — the primitive every consumer already depends on is the owner it already has.
- [ ] **Step 2: `vg-272` — one shared class token for the plain-button idiom, owned by the control set.** **Corrected 2026-10-16: it is three copies and one different string, not four of one.** `paint-list.tsx:132`, `:349` and `preset-list.tsx:458` are identical (`text-text`); **`paint-list.tsx:401` is `text-hot` with a `disabled:text-faint` variant** — a second idiom that already has behaviour, which is the case this step's own "revisit only if the button acquires behaviour" clause excludes. So the three import the token and stop carrying their own, and `:401` is left as its own idiom and said to be. Revisit only if the button acquires behaviour (disabled, aria, a variant).
- [ ] **Step 3: Close the two.**

**Annotated 2026-10-16, at the task's close: both rows are `verified` at `f5788e86`, and the task found a
third false premise — `ACTION_BUTTON` was declared four times, not three.** `draft-recovery-prompt.tsx:15`
carried a fourth copy, byte-identical to the chooser's and the replace prompt's, and neither Step 1, nor
this task's `Files:` line, nor `vg-289`'s own title named it; **`vg-289`'s title is corrected to four** and
the fourth was folded in, because leaving it would have left the drift the row names live. **The shared
string is the drifted copy's, and the reason is that it is the superset**: the library chooser's copy
carried `enabled:hover:` and `disabled:text-faint`, its delete button is the only one ever disabled, and
`enabled:hover:` is `hover:` on a button that is never disabled — so taking the majority literal would have
stripped the disabled delete's colour. **No test read either class string**, so nothing was extended: the
copy nets read words rather than class names, and three cases were added that read the *rendered* button's
class list. **The red proof was re-run by the controller rather than taken from the report**: cutting the
token's horizontal pad reads 40/43 with exactly the three new cases failing, restored byte-identically with
`cmp`, green at 43/43 exit 0. **Step 2's fourth site is filed, not folded** — `preset-list.tsx:450`
composes the shared token with `text-hot`, so two conflicting colour utilities on one element resolve by
stylesheet order; that is `vg-547`.

### Task 18.3: The shell's keyboard rules

**Files:**
- Modify: the editor shell's shortcut manager (its text-entry predicate and `RESERVED_LETTERS`)

**Interfaces:**
- Produces: `vg-252`, `vg-290` closed

- [ ] **Step 1: `vg-252` — the predicate answers "does this target consume this key", not "is this a text-entry target".** A text field consumes everything printable, so the coarse question happens to work there; a range consumes its own navigation keys and nothing else. The predicate is `isTextEntryTarget` at `shortcut-manager/index.ts:237` (the row cites `:192-213`, which is stale). The repair is a consumption rule per target shape, **enumerated as data beside the control set**. **Corrected 2026-10-16, after the task ran: the rule as first written here — "a text-like target consumes printable keys, a range consumes exactly the four arrows, Home, End, Page Up and Page Down, and every other control consumes nothing" — cannot be implemented literally, because three existing cases fail against it** (`index.dom.test.ts:214` Delete on a textarea, `:382` Escape, `:323` ArrowLeft). The implemented rule is **"a text field consumes every key the table binds"** — printable characters are its own, and Delete, the arrows and Escape are its editing keys — which is the honest reading of why the coarse question happened to work there. What keeps the camera keys on a focused slider and gives `Ctrl+Z` back is unchanged: a range consumes its own keys and no modifier chord whatever the key.
- [ ] **Step 2: `vg-290` — `RESERVED_LETTERS` becomes two sets.** It is at `shortcut-manager/bindings.ts:75` and the refusal that reads it at `:302`, both as the row says. The blanket `shift !== true` exclusion was never a measurement; it is an assumption that Shift makes a chord safe, and three of the four chords most likely to be tried are exactly the Shift variants the browser keeps. Membership is measured against Chromium's documented page-unreachable accelerators — `Ctrl+Shift+N`, `Ctrl+Shift+R`, `Ctrl+Shift+T`, `Ctrl+Shift+W` — and Firefox is checked against them, because the host opens the editor in the author's own browser. **The comment carries the browser and the date it was measured against**; a reserved set with no provenance is the claim-without-a-reason shape this row already names.
- [ ] **Step 3: Close the two**, each with a case that fails when the fix is disabled.

**Annotated 2026-10-16, at the task's close: both rows are `verified` at `c0b0ceb7`, and both red proofs
were re-run by the controller rather than taken from the report.** Cutting the deferral back to the coarse
predicate reads 1 failed / 70 passed exit 1, and the browser case that presses `Ctrl+Z` with the track still
focused reads 1 unexpected; collapsing the two reserved sets back into the old `shift !== true` rule reads
1 failed / 70 passed exit 1, failing the right way — `Ctrl+Shift+N` came back as `taken`/`file.new`, so the
old rule blamed another binding for a chord the browser owns. Each restored byte-identically with `cmp`,
green at 71 passed exit 0. **The shape the brief asked about, and the answer is not the obvious one**: the
consumption rule became the deferral's owner, the coarse predicate was left for the camera, and
`activatesOnSpace` was given its own stated rule — because **the third call site was not asking a third
question**. `viewport-manager/navigation.ts:56`'s `!isTextEntryTarget(target)` was unreachable behind a
tautology, since the guard at `:182-186` tests the same target first, so it is now `return true` with the
reason written down and no camera behaviour moved. **Two claims this task corrected**: `vg-252`'s breadth
("every shortcut the manager owns is swallowed") is overstated — the deferral is action-scoped for modified
chords, so only the four `MODIFIED_KEY_DEFERRED_ACTION_IDS` actions' chords plus every unmodified binding
were swallowed; and `editor.spec.ts`'s blur block, whose comment explained that a focused range swallowed
the chord, **was already a no-op** because `typeIntoControl` fills *and blurs* a range
(`control-set.ts:225-227`). **`vg-290`'s provenance is a documentation check and is recorded as one**: the
seat's headless Chromium probe delivered every chord to the page including `Ctrl+W`, so a headless browser
cannot observe its own accelerators and no Firefox is installed on this box; the comment names Chrome's
shortcut list and Firefox's `browser-sets.inc` and the date, which is what the ruling asked for.

### Task 18.4: The identity chip and the version line

**Files:**
- Modify: the editor shell's identity chip; the About tab; the Vite config's `define`
- Read: `src/web/package.json`

**Interfaces:**
- Produces: `vg-223`, `vg-279` closed

- [ ] **Step 1: `vg-223` — the chip loses its unsaved-changes marker and keeps the coloured indicator dot.** The marker was the fixed part that overflowed once the name truncated, and the dirty state is already carried by the status bar; the chip loses the text rather than dropping, shortening, wrapping or accepting a clip. Neither `vg-219` nor `vg-230` is absorbed.
- [ ] **Step 2: `vg-279` — the workspace manifest's `version` is the product's version, and both readers take it from there.** **Corrected 2026-10-16, before the task ran: the manifest has no product version to own.** Every manifest in the workspace reads `0.0.0` — `src/web/package.json` and all seven packages — there is no root manifest, and the only real version string in the tree is the host's hardcoded `const VERSION = "0.1.0"` at `packages/host/src/main.ts:34`. So the product version had to be *chosen* before it could be given an owner; the task took the incumbent `0.1.0` into `src/web/package.json`, which invents no number. The host reads `src/web/package.json` at run time; the editor bundle takes it through Vite's `define` at build time. Two things the fix must not do: `SUPPORTED_SCHEMA_VERSION` stays a separate fact and the About tab keeps labelling it as what it is, and the open document's release version is never presented as Vigilia's own.
- [ ] **Step 3: Close the two.**

**Annotated 2026-10-16, at the task's close: both rows are `verified` at `5da31012`, and both red proofs
were re-run by the controller.** Restoring the chip's marker reads 1 failed / 2 passed exit 1; cutting the
`define` reads 5 failed / 13 passed exit 1 with `ReferenceError: __VIGILIA_VERSION__ is not defined`; each
restored byte-identically with `cmp`, green at 21 passed exit 0. **Step 1's premise moved rather than held**:
the clip does not reproduce at 640x360 any more — the layout has moved about 10px and the marker fits with
5.8px to spare — and it reproduces one step narrower, at 560x360, where the marker painted 65px past the
chip's right edge. The row's numbers are corrected on the row. **Step 2's decision is recorded because the
row assumed it away**: the product version is `0.1.0`, owned by `src/web/package.json`, and `define` feeds
the bundle while the host reads the manifest at run time — three levels up from either `src/` or `dist/`,
which is why one path serves both. **The step's two prohibitions held**: the schema version and the open
document's release version stay separate facts with their own labels, and the About tab's new row was
verified in a re-taken capture showing `Product version 0.1.0` beside `Schema version 2` and no release row,
because this fixture's document carries none and §9's missing reading is a gap stated by absence.
`docs/architecture/ownership.md` gained the row, which is what that map is for when a concept has two readers.

### Task 18.5: The selection column's live-value paths

**Files:**
- Modify: `src/web/packages/editor/src/selection-inspector/index.ts` (the field funnel, `writeOpacity` beside it); the inspector's text-run reconciliation

**Interfaces:**
- Produces: `vg-254`, `vg-249` closed

- [ ] **Step 1: `vg-254` — a slider previews while dragging and commits on release.** The field funnel gains a preview and a cancel path, and **the preview writes no history entry** — the release commits exactly one value, which is what the one-undo-boundary rule asks. A control that shows nothing until release is one whose value the author cannot see while choosing it, and the same renderer draws every slider in the column, so the fix is one path rather than one field.
- [ ] **Step 2: `vg-249` — the persisted text-run model gains no per-run id, and the inspector reconciles survivors at mutation time as `vg-044` did.** An id added to persisted runs is editor bookkeeping written into the theme file, which is the line `AGENTS.md` draws.
- [ ] **Step 3: Close the two.**

**Annotated 2026-10-16, at the task's close: `vg-254` and `vg-249` are `verified` at `6508ac42`.** **Step
1 landed as one funnel rather than one field** — `SelectionEdits` gains `preview` and `cancelPreview` beside
`commit`, mirroring the sibling `CropEdits`, and all three go through `writeField` plus `applyField`, so only
`commit` records history. A preview does not re-publish the column, which is what keeps `field.value` at the
gesture's start, and a frame does not call `refreshGlass` — the glass case reddens otherwise, twice per
keyboard step, while a drag would walk the scene sixty times a second. **`vg-254`'s own measurement was
stale**: its `aria-valuenow` and well half was already fixed by `vg-449` (`f849c425`), so the surviving
subject is the document; unwiring the preview reads **2 failed / 19 passed exit 1**,
`the document did not follow the pointer: 1, 1, 1`, restored byte-identically with `cmp` and rebuilt to **21
passed exit 0**. **Step 2's precedent clause could not be honoured as written and the seat said so**: `vg-044`
reconciles with a pure function of (previous, next), and **no pure function of the run array can do this job**
— two literal runs sharing a preset are the same fields, so a content key is ambiguous and a repeat counter
is positional. The identity is therefore the run's own object in a runtime `WeakMap`
(`selection-inspector/run-identity.ts`), handed across each write, so **the reconciliation is at mutation
time as ruled while no id is persisted**; disabling the carry reads **1 failed / 4 passed exit 1** with focus
on `<body>`, restored with `cmp` to **5 passed exit 0**. **A fourth brief pointer was wrong**: the `onPreview`
case is `control.dom.test.tsx:828-849`, not `:659-676`, which is `ControlNumber`'s copy-table refusal case.
**`vg-548` is filed from the landing**: a gesture ending with neither a commit nor a cancel leaves the
previewed value in the document with no history entry. **`selection-inspector/index.ts` is 796 lines**, past
the 500-line signal and under the 800-line stop; the seat trimmed comments rather than splitting it.

### Task 18.6: The theme list's tie-break, pinned

**Files:**
- Modify: a test beside `host/src/themes/store.ts` or `editor/src/boot-theme.ts`
- Read: `host/src/themes/store.ts` (`list()`); `editor/src/boot-theme.ts` (`latestOwnTheme`)

**Interfaces:**
- Produces: `vg-363` closed

- [ ] **Step 1: Reproduce the ruling's own reading.** `store.list()` sorts by `a.id.localeCompare(b.id)` with no recency term, and `latestOwnTheme` reduces with `entry.updatedAt > best.updatedAt` — strictly greater, so on a tie the first entry wins. Composed, those give exactly what the ruling asked for: max `updatedAt`, ties by id ascending.
- [ ] **Step 2: Add the case the triage named, because a source reading is not the measurement this plan's Acceptance requires.** One case that saves two themes with the same `updatedAt` and asserts the mount opens the lower `id`, after which the answer is pinned rather than incidental.
- [ ] **Step 3: Do not add a persisted save counter** — it would add a column to every theme document to cover two saves inside one millisecond, and `id` is already stable, unique and persisted.
- [ ] **Step 4: Close it against that case.**

**Annotated 2026-10-16, at the task's close: `vg-363` is `verified` at `e836a9ee`.** **Step 1's
composition held, so nothing normative was wrong** — the ruling's answer is real, it is just **composed
from two files rather than written in the one the ruling named**, which is why a source reading could not
close the row. **Step 2's case is the whole deliverable and it pins both halves**: cutting the reduce to
`>=` and reversing the store's sort each read **1 failed exit 1**, `expected 'theme-b' to be 'theme-a'` —
the assertion rather than a compile error — restored byte-identically with `cmp` to **87 passed exit 0**.
**The Files line above was corrected by the landing**: the case went to `host/src/themes/store.test.ts`,
inside the suite's existing `tmpDir` harness, **because `packages/editor/tsconfig.json` carries no
`@types/node`** (the `renderer-core` shim has no `node:fs/promises`), so the host is the one program where
the real store and the real mount are both reachable — a relative import of `boot-theme.js` and a
three-line why-comment. **Step 3 held**: no persisted field and no save counter. **One claim on the row was
stale and is corrected on the row** — `seedHostTheme` writes **eleven** fixture themes, not ten. **What the
row never measured is still unmeasured and the row says so**: whether the two original runs straddled two
milliseconds is not recoverable, so what closed is the tie-break, not that race. **This task ran in
parallel with Task 18.5** on disjoint scopes — the phase's first parallel dispatch.

---

# Phase 19 — W14: the surfaces the editor has not wired, and the ones it draws wrong

**Outcome:** the six ruled rows whose owner is a product surface rather than a control are landed —
`FontPicker` reaches the field it was written for, the artboard's crop figure tracks the drag, a pane's
chrome stops scrolling with its body, the Add pane's shape controls get their own scope, and the spec
stops promising a primitive the product cannot deliver.

**Why a phase of its own.** Five of the six are one-surface changes under `panes/`, the artboard and the
pane frame, and the sixth (`vg-163`) is a sentence in a spec. They share an owner — the surfaces
themselves — and none is an instrument, a token or a control.

**Owners:** `src/web/packages/editor/src/panes/` (the shapes section, the asset file section); the
selection inspector's text face field; the artboard panel's crop figure; the pane frame
(`shell-layout.tsx`, `layer-tree.ts`, the per-pane scroll body and `choosePane`'s offset restore);
`src/web/tests/e2e/`; and `docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md`.

**Constraints:** **queued behind Phases 12 and 15–18.** **`shell-layout.tsx` and `layer-tree.ts` are on
the reuse gate's watchlist**, so Task 19.3 lands a decision note before its first write. **`vg-163`'s
Phase-1 ruling named the wrong file** — the correction is Task 19.5 Step 1, and it is recorded on the row
before anything is fixed.

**Acceptance:** each row's own `check` passes and is recorded on its line; `vg-208`'s restructure changes
`shell-layout-scroll.dom.test.ts` in the same commit as the structure it pins; `vg-211`'s four locators
point at the new scope hook; the browser suite is named separately for Tasks 19.1–19.4.

**Failure modes:** wiring `FontPicker` to a field that does not exist rather than building the field the
ruling names; treating `vg-208` as a one-line fix, which its own ruling says it is not; correcting
`DESIGN.md` for `vg-163` when the sentence is in the spec.

**Verify:** `npm run gate` (exit code read from `$?`); the browser suite for Tasks 19.1–19.4 on a rebuilt
bundle.

**Annotated 2026-10-16, at the phase's close: all five tasks have run and the phase's six rows stand at
six `verified` — `vg-268` and `vg-283` (`055c7ecc`), `vg-142` (`be181f68`), `vg-208` (`46e022ae`),
`vg-211` (`014d38b3`), `vg-163` (`b2c4f1e7`) — but its Acceptance is met only in part, and the part it
misses is a regression the phase itself caused.** `npm run gate` **exit 0** (263 files, 3481 tests), read
from `$?` into a file. **The browser suite named separately as `npx playwright test --workers=1` over all
projects: exit 1 — 338 passed / 4 failed / 258 skipped, 23.7 minutes.** Three of the four reds are rows the
register already owns and were matched by the case each row names: `glass-lifecycle.spec.ts:25` is
`vg-431`, `editor-display.spec.ts:659` is `vg-258`, `publish-loop.spec.ts:349` is `vg-212`. **The fourth
is new, it is this phase's, and it is filed rather than smoothed**: `host-walkthrough.spec.ts:516` (§13.1's
nine interactions on the real host) fails at step 5 with `nothing matched in 200 presses`. It is
**bisected, not guessed** — the case passes at `b2c4f1e7` and fails at `055c7ecc` (Task 19.1) and at every
commit after it, each point rebuilt — and then **measured**: with `TAB_BOUND` raised to 2000 and the case's
clock to 600 s it passes (exit 0, 4.4 m) and prints its own census, in which step 5's sweep to the pane is
**1058 presses**. Task 19.1's mount put `FontPicker` in the inspector, and `font-picker.tsx:355-376`
renders all 379 trios unwindowed — 758 tab stops — while the face list above it is windowed to 15. Filed as
**`vg-551`** and **not fixed here, because the correct behaviour is not already specified**: the `WINDOW`
docblock gives the face list's reason as `FontFace` objects to keep rather than tab stops, and the picker
carries no `role`, no `tabIndex` and no key handling, so the fix is a decision about the picker's keyboard
model for a 379-row list — a spec, not a task. **The Acceptance's own `vg-211` clause is a count and it is
wrong**: it says "four locators" and the measured set at close is 12 shape call sites through `insert` and
`addButton` across `author-journey-rebuild.spec.ts`, `inspector-sections.spec.ts`, `rebuild-composition.ts`
and `rebuild-driver.ts`, plus three in-file sites in `editor.spec.ts`; the clause's **substance holds** —
every shape reach is scoped to `data-vigilia-add-group="shape"`, and the pane-wide form survives only for
the Text row and the chart families, which Task 19.4's trailer records as the same hazard left standing.
**Two stale claims the close corrected rather than inherited.** The phase's `Owners:` line names
`layer-tree.ts`, and **no Phase 19 commit touched it** (`git log 591e2954..HEAD -- layer-tree.ts` is
empty): Task 19.3's owner was `pane.tsx`, `editor-shell.css` and `shell-layout.tsx`. And **the gate was red
inside this phase** — `npm run gates:self-test` stood at 21/22 on `dead-code-sweep.mjs`'s
test-only-consumer case, which pinned `font-picker.tsx`, the very file Task 19.1 legitimately mounted, so
the check was asserting the bug two rows existed to fix; fixed at `58c1cb14` under decision note `0058`,
with the residual filed as `vg-550` and Phase 21's new Task 21.8. **Every red proof on this phase's rows,
and the new red, were re-run by the controller rather than taken from a report** — each green, then cut,
then red, then restored and proved byte-identical with `cmp`, then green again.

### Task 19.1: `FontPicker` reaches the field it was written for

**Files:**
- Modify: the selection inspector's text section (the new text face field)
- Read: `src/web/packages/editor/src/font-picker/font-picker.tsx` (**corrected 2026-10-16 at `e2897f16`: this line said `components/ui/font-picker.tsx`, and the component has never lived there — `FontPickerProps` is at `:95` and `FontPicker` at `:119` of the path above**)

**Interfaces:**
- Produces: `vg-268`, `vg-283` closed

- [ ] **Step 1: Build the field `vg-268` names as the owner.** The capability is choosing a text object's font face, no other control provides it, and the control is the font catalogue plan's own output — so the mount is the fix and deleting it would discard a shipped implementation of a live capability.
- [ ] **Step 2: Do not delete the control, and leave the test consumers alone.** The consumer grep returns three test mounts, including `components/ui/control-icon-button.dom.test.tsx`; no product surface renders it, which is the finding.
- [ ] **Step 3: Close the two together** — they file one question, ruled once, and neither closes without the other.

**Annotated 2026-10-16, at the task's close: `vg-268` and `vg-283` are `verified` at `055c7ecc`.** **Step 1
landed as the ruling's own reasoning rather than a literal reading**: the field is a **fifth `ExtraView`
member** (`kind: "fontFace"`), not a `FieldView`, because a `FieldView` select would be **a second face
picker**, which the ruling forbids. The extra carries only `presetId`, and **the write goes to the preset
rather than the object** — a text object has no face of its own, a run names a preset and the preset carries
the face — through the Tokens pane's existing `TypePresetFontActions`. **Step 2 held**: nothing was deleted
and the three test consumers are untouched. **Both red proofs were re-run by the controller**: dropping
`fontFace` from `rendersExtra` reads **1 failed / 330 passed exit 1**, and disabling the `contentBody` emit
reads **1 failed / 21 passed exit 1** in the browser; each restored byte-identically with `cmp`, green at
**331 passed** and **22 passed exit 0**. **Three things the plan did not know.** (i) **The control's star and
its "Favourites only" box need a favourites client, and the host already served `/api/font-favorites` with no
editor-side reader** — so `favorites-client.ts` was built as the catalogue plan's own unbuilt **Task 7**
artifact, without which the mount would have shipped a dead star. (ii) **The copy census needed a carve-out**:
`spokenIn` reads every button and a face row's text is catalogue data, so the two rows are carved out exactly
as `ui-copy-panels.test.ts:246-247` already carves the same two attributes out of its own net. (iii) **"No
other control provides it" holds at object level only** — `preset-list.tsx`'s `FontControls` chooses a face
for a preset, and the object-level field is the gap. **`vg-549` is filed from the landing**: `applyPresetFace`
writes family, weight and `face.assetId` while the Tokens pane leaves family and weight editable. **Not
verified**: the browser does not exercise the write a face row makes, because applying a face downloads font
bytes from a CDN the suite does not own.

### Task 19.2: The artboard's crop figure tracks the drag

**Files:**
- Modify: the artboard panel's crop figure

**Interfaces:**
- Produces: `vg-142` closed

- [ ] **Step 1: Subscribe to `object:moving`,** so the figure tracks during the drag rather than catching up on release. A figure that only catches up on release is the same defect `vg-254` rules on for sliders: the author cannot see what they are choosing.
- [ ] **Step 2: Coalesce the recompute to the animation frame** the canvas already paints rather than dropping the event, and measure the drag's frame budget. If the per-frame recompute costs it, the answer is a cheaper recompute, not a return to release-only tracking.
- [ ] **Step 3: Close it.**

**Annotated 2026-10-16, at the task's close: `vg-142` is `verified` at `be181f68`.** **Step 1's premise is
the phase's fifth stale row description**: there is no `sizeNote.textContent` at `artboard-panel.ts:336` and
no `refreshNote` writer — the file is **145 lines** and the note is React-rendered (`sizeNote` is a pure
function at `panes/document/artboard-fields.tsx:236`, rendered at `:198` from `boxes`, which
`artboard-panel.ts:98` reads from `sceneBoxes()` at the moment of the draw). **The subject reproduces exactly
and the mechanism is the subscription alone**: `on("object:modified", draw)` was the only canvas
subscription, and Fabric fires that on release. The mid-drag reading with the button still down was the rule
text alone before and the figure after. **Step 2 landed as coalescing rather than dropping**, and
**`destroy()` cancels the armed frame** as well as releasing the listener. **Step 3's frame-budget clause was
measured and does not fire**: the recompute reads **2.3–3.2 ms median against a 16.7 ms frame**, with the
callback split proven on a no-subscription build, so no cheaper recompute is owed. **Red-proved and re-run by
the controller**: cutting the subscription reads **1 failed / 24 passed exit 1**,
`one recompute for the frame: expected 1 to be 2`; restored byte-identically with `cmp` to **25 passed exit
0**, and the browser case reads **1 passed exit 0**. **One stale pointer in this task's brief was the
controller's own** — it cited `bleed.ts` for the `object:modified` write, and that file is 62 lines with no
fire in it; the write and its comment are `selection-inspector/index.ts:414` and `:417-419`. **Not verified**:
the drag was desktop-only, the frame numbers are one machine's, and the cross-batch repaint comparison is not
trustworthy.

### Task 19.3: A pane's chrome stops scrolling with its body

**Files:**
- Modify: the pane frame (`shell-layout.tsx`, `layer-tree.ts`); `shell-layout-scroll.dom.test.ts`; the per-pane offset restore in `choosePane`

**Interfaces:**
- Produces: `vg-208` closed

- [ ] **Step 1: The BODY element owns the scroll, and the title bar and footer sit outside it**, per `DESIGN.md:332`. The plan's Global Constraint that made the aside the single scroller was an implementation shortcut taken so `choosePane` could restore a per-pane offset through one element, and a shortcut taken for a mechanism does not outrank the intent it broke.
- [ ] **Step 2: Restore the per-pane offset and disclosure state through the body**, and change `shell-layout-scroll.dom.test.ts` in the same commit as the structure it pins.
- [ ] **Step 3: Close it.** The ruling names this restructure as the row's owner and records why it is not a one-line fix; the severity stays low for behaviour, since the footer is still reachable by scrolling.

**Annotated 2026-10-16, at the task's close: `vg-208` is `verified` at `46e022ae`.** **Step 1 landed as
ruled**, and the row's ruling is what it implements: the pane's frame is a flex column, the title bar and the
footer are `flex: none` so a tall body's shrink cannot squeeze them, the body takes `min-height: 0` because a
flex child's `min-height` is `auto` — without it the body refuses to shrink and the column grows instead,
which is the same defect wearing the fix — and the column takes `overflow: hidden` while keeping the 12px
padding, so the chrome keeps the inset it had (`editor-shell.css:2186-2197`). **Step 2's "restore through the
body" was the whole of the work rather than a follow-on**: `choosePane` reads and writes each pane's offset
off the box that scrolls, so `paneBody` now names the body it was always called after, through an optional
`bodyRef` on `Pane` that only the showing pane attaches — the other three are `hidden`, and a `display: none`
box answers `scrollTop` 0, which is what would write the author's place back as the top of the list; the save
still runs before the column is hidden. `shell-layout-scroll.dom.test.ts` changed in the same commit as the
structure it pins, as the ruling requires. **Step 3's severity clause held**: the defect was measured on the
base bundle first — at `607c9623` the column overflows by 1026px and a 300px scroll moves the title bar 54 →
-246 and the footer 1643 → 1343, the footer resting 949px below the column's own bottom edge — and after, the
body carries the overflow (1026 over a 534px client, the column 0 over 652) with both holding at 54 and 617.
**Red-proved and re-run by the controller**: `editor-rail.spec.ts:117` reads **1 passed exit 0**; the body
rule's `overflow: auto` cut to `visible` reads **1 failed exit 1** on the case's own mechanism assertion,
`the pane's column is still a scroller, so §7.7's rule is still on the wrong box: expected 0, received 300`;
restored byte-identically with `cmp`, rebuilt and re-run, **1 passed exit 0**. **One clause of the row was
falsified and corrected on the row**: it cites `layer-panel.tsx:809-810` for the "toolbar stays put while the
list scrolls beneath it" comment, and that file is **60 lines** with no such text — the claim is
`layer-panel.dom.test.tsx:628`, in the case asserting the tree draws no action footer of its own. **This
task's `Files:` line names `editor-shell/layer-tree.ts` and nothing in the task touches it** — 433 lines with
no scroll code and no scroll comment; the plan's two citations of `.editor-shell-panel` and
`.editor-shell-inspector` as the owner of the scrollbar rule (Task 13.1b step 1, Task 16.1 step 2) are left
standing, both sitting inside tasks that are complete. **Not verified**: the browser reading is
desktop-chromium only, the offsets are one machine's, and the case reads which box overflows, whether setting
its `scrollTop` moves it and where the chrome is before and after, so the numbers say which box is the scroll
owner rather than the case saying it.

### Task 19.4: The Add pane's shape controls get their own scope

**Files:**
- Modify: `src/web/packages/editor/src/panes/add/` (the shapes section); `src/web/tests/e2e/` (the four add-pane locators)

**Interfaces:**
- Produces: `vg-211` closed

- [ ] **Step 1: One stable scope hook on the shapes section**, and the four locators that today scope the whole pane point at it. A locator any unrelated surface can invalidate by gaining a label is the flake class this repo has already paid for, and the churn is cheaper than the first misdiagnosed ambiguity.
- [ ] **Step 2: Do not rename the asset host's labels** — changing product copy to suit a test is explicitly not the fix.
- [ ] **Step 3: Close it**, with the spec churn in the same commit.

**Annotated 2026-10-16, at the task's close: `vg-211` is `verified` at `014d38b3`.** **Step 1's "four
locators" is a count and not a measurement, and the measured set is larger.** Measured at `5a16aad4`:
**15 whole-pane control reaches**, of which **10 reach a shape** — `rebuild-driver.ts`'s `addButton`/`insert`
(the row's own named hazard), `editor.spec.ts`'s `insertShape`, its shapes count, its `Line` count of 2 and its
`Arc`/`Wedge`, plus **five the controller's brief did not list** (`host-player.spec.ts:491`,
`inspector-sections.spec.ts:1183`, `reference-theme.spec.ts:425`, `:541`, `:700`) — and **12 shape call sites
of the shared helper**. All ten moved to the hook and **no assertion changed anywhere**. **The hook is
`data-vigilia-add-group="<kind>"` on each labelled group's `fieldset` (`add-pane.tsx:72`), and its owner is
`InsertGroup.kind` (`new-object-panel.ts:99`)** — the merge already compared the heading, and since the
heading is copy the merge now compares `kind` (`new-object-panel.ts:144-155`) with `groupOf` returning the
heading alone. The pane's own alternative (reading `group.objects[0].kind`) was refused: it infers the group's
identity from a member under a homogeneity invariant stated only in a comment. **Step 2's constraint held** —
the asset host's labels are untouched. **No CSS was owed and that is confirmed rather than assumed**: no rule
mentions the new attribute, and every rule on `data-vigilia-panel` is `="layers"` (`editor-shell.css:2054`,
`:2100`, `:2107`, `:2113`). **The row's own pointers are all stale (read 2026-10-09)**: `rebuild-driver.ts:139`
is `:150-153` and uses `getByRole`, not `hasText /^label$/`, `editor.spec.ts:31/789/838` have moved, and
**`asset-manager/panel.ts:30-35` no longer exists** — the host is `panes/add/file-section.tsx:208`, `:215`,
`:222`. **Red-proved and re-run by the controller**: `editor.spec.ts:1350` reads **1 passed exit 0**; deleting
the hook reads **1 failed exit 1** at `expected 8, received 0` for
`locator('[data-vigilia-add-group="shape"]').getByRole('button')` — the hook's own absence rather than a
missing draw; restored byte-identically with `cmp`, rebuilt and re-run, **1 passed exit 0**. **The row's
hazard is closed for shapes and left standing for everything else**, which the row says rather than implying a
whole fix: the chart-family `insert(page, chart.family)` (`rebuild-driver.ts:462`), the Text row, the
chart-group locators and the pane-visibility uses keep the whole-pane scope. **Not verified** by this task:
`npm run gate` and the full browser suite, which are the controller's phase-boundary job. **One sentence of
the task's own comment was corrected by the controller before landing**: `addButton`'s docblock said the group
is omitted "only for the Text row", and the chart-family insert omits it as well.

### Task 19.5: The spec stops promising video

**Files:**
- Modify: `docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md` (the §5 primitives bullet)
- Read: `src/web/packages/editor/src/panes/add/file-section.tsx` (`isPlaceable`); `docs/adr/0008-video-is-background-media.md`

**Interfaces:**
- Produces: `vg-163` closed

- [ ] **Step 1: Correct the premise before anything is fixed.** `vg-163`'s Phase-1 ruling reads the row against the bible `docs/design/design-language.md`, which `DESIGN.md` replaced on 2026-10-10 — but the row's own detail cites the **spec**, and that sentence is still on disk: `2026-10-03-dashboard-authoring-design.md`'s §5 primitives bullet reads "text, shape, chart, image, video, exactly as today". The ruling's grep read the wrong file, so the defect it retired reproduces. Record the correction on the row, with both paths and both greps.
- [ ] **Step 2: Correct the sentence to the primitives that exist.** `isPlaceable` (`panes/add/file-section.tsx:266`) is the two-element allowlist image or svg, and `ADR-0008` decided video is background media rather than a scene object — so the sentence drops video, rather than the product gaining a video object kind, which is `vg-154`'s question and not this row's.
- [ ] **Step 3: Close it** against the corrected sentence, with a check naming the row's own problem rather than the retired premise.

**Annotated 2026-10-16, at the task's close: `vg-163` is `verified` at `b2c4f1e7`.** **Step 1's correction is
stronger than this task stated and the measurement is the difference.** The step says
`docs/design/design-language.md` "was replaced by `DESIGN.md`"; **the file does not exist at all** — deleted
at `db000c40`, and `docs/design/` now holds only `mockups/` — so the ruling's `grep -i video DESIGN.md` read
a file that never held the sentence, and the last on-disk version of the file it *did* name has no `video`
either. **The conclusion is unchanged and the reason is cleaner: the retirement was never valid, because the
row cited the spec and the spec was never edited.** **A second citation on the row was stale and is
corrected on the row**: it names `isPlaceable` at `asset-manager/panel.ts:232-236`, and that directory holds
only `index.ts` and `index.dom.test.ts` — the allowlist is `panes/add/file-section.tsx:266`, called at
`:111`. **Step 2 landed as written**: the sentence drops video and the product gains no object kind.
**`DESIGN.md` carries neither `Primitives` nor `video`**, which is why the fix is in the spec — the phase's
own failure mode. **`npm run docs:check` exit 0**, and **no test or browser run is claimed**, because the
Acceptance names the browser suite for Tasks 19.1–19.4 only.

---

# Phase 20 — W15: the design tokens and the drawings they came from

**Outcome:** the seven ruled rows whose owner is the token vocabulary or a drawing are landed — one
elevation ladder survives, `--shell-warm` is readable in every palette, `--shell-flat` goes, and the
drawings agree with the product where they had invented or drifted. **[Annotated 2026-10-16: two of the
seven cannot land as their rulings read, so Tasks 20.5 and 20.6 are blocked on decisions their own rulings
declined to make and both are annotated in place below; Tasks 20.1–20.4 are the dispatchable work, and
**Task 20.7 was added mid-phase** for `vg-552`, which a seat found while doing 20.2.]** **[Closed in part
2026-10-16: Tasks 20.1, 20.2 and 20.3 landed as `b9566db1`, `ed4d6ee8` and `0c1f559e`, closing `vg-261`,
`vg-201` and `vg-312`. All three red proofs were re-run by the controller rather than taken from the seat's
report — except 20.1's, which could not be run because **the deletion it makes has no guard**; that is
`vg-553`, homed on Task 20.7. Task 20.2's ruling turned out to have an inert half: `--vigilia-accent` does
alias `--shell-warm`, but no rule reads it, so *"let the canvas accent move with it"* moves nothing — that
is `vg-552`, also Task 20.7.]** **[Closed in part further 2026-10-16: Task 20.4 landed as `5ea10439`, closing `vg-301` on its
chord half and `vg-202` with no edit owed — the `5px 8px` wells the ruling wanted corrected exist only in
the two frozen originals. The segmented control's half of `vg-301` did not reproduce, so it is split out as
`vg-554` and homed on a new **Task 20.8**.]** **[Task 20.7 closed the same day at `7874e879` and `150ad617`,
retiring all ten unread `--vigilia-*` declarations and adding the first assertion in the token test that
fails on an ADDITION rather than a removal. Its measurement corrected `vg-201`'s ruling: the canvas accent
is the theme document's `palette.accent`, so no CSS custom property can move it, and that clause is
unreachable rather than merely inert.]** **[Task 20.8 closed 2026-10-17 at `e4785eaa`, redrawing the
segmented control's four rows in all three `current/` drawings that draw it to the product's composed
treatment — eight declarations, not the six `vg-554` named — and answering the capture clause with "none is
owed". Its two trailers are `vg-555` and `vg-556`, homed on a new **Task 20.9**.]** **[Phase 20 closed
2026-10-17 on its Acceptance, carrying three rows rather than closing them — `vg-556`, `vg-350` and
`vg-354` — and Task 20.9 is where the phase's own sentence about the drawings turned out to be the
defect. It is annotated here so it is not re-used: "the drawings agree with the product where they had
invented or drifted" is **true only where a DESIGN.md rule positively requires the product's
treatment**, which is `README.md:102`'s exception and what licensed Tasks 20.4 and 20.8. Where §5 is
silent the same README's default runs the other way — *"the drawing governs and the product is the
defect"* (`:102`), *"never redrawn from the product"* (`:124`) — and Task 20.9's Step 2 was briefed and
implemented on the unqualified sentence before being reverted at `e0e7624b`. `vg-557` is the general
case.]**

**Nine rows closed in this phase and seven filed within it** — `vg-261`, `vg-201`, `vg-312`, `vg-301`,
`vg-202`, `vg-552`, `vg-553`, `vg-554` and `vg-555` closed; `vg-552`–`vg-556`, `vg-557` and `vg-558`
filed by its own tasks. **The three it carries are carried for two different reasons**: `vg-350` and
`vg-354` are Tasks 20.5 and 20.6, whose own rulings decline to make the decision their outcome needs,
so they wait on the user's word; `vg-556` needs the product changed, and no open phase owns the
editor's control set.

**Why a phase of its own.** Six of the seven edit `editor-shell.css` or a drawing under
`docs/design/mockups/`, and the seventh edits the design-language reader. They are one subject: what the
design language declares, and what the drawings show.

**Owners:** `src/web/packages/editor/src/editor-shell/editor-shell.css`; its token test
(`editor-shell.tokens.test.ts`); `tests/e2e/design-language-readers.ts` (`PINNED_FLOOR` — corrected
2026-10-16: this line named `design-language.spec.ts`, which is not on disk); `docs/design/mockups/`;
`scripts/design-md.mjs` and the `--sync` reader.

**Constraints:** **queued behind Phases 12 and 15–19.** **`renderer-core/src/theme/` is on the reuse
gate's watchlist** where a token crosses into the renderer; the shell's own CSS is not. **`vg-201`'s
`PINNED_FLOOR.invalid` values (ember 1.9, moss 1.35, plum 1.35) are the pinned floor being deleted**, so
the contrast spec changes in the same commit as the value it pins.

**Acceptance:** each row's own `check` passes; **every contrast claim is a measured ratio, not an
asserted one**; each drawing correction names the file and the element it touches; `npm run gate` and
`npm run design:check` both exit 0 with their codes named.

**Failure modes:** deepening `--shell-warm` in one palette and not the other two; breaking the
`--vigilia-accent` alias instead of moving the value it aliases; correcting a drawing to a value nobody
ruled.

**Verify:** `npm run gate` (exit code read from `$?`); `npm run design:check`; the parity captures for the
corrected drawings, rebuilt.

### Task 20.1: One elevation ladder

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`; the two `--shadow-raised` consumers

**Interfaces:**
- Produces: `vg-261` closed

- [ ] **Step 1: One ladder survives.** `--elev-1`, `--elev-2` and `--elev-3` stay; `--shadow-raised` and `--shadow-overlay` are deleted, and the two `--shadow-raised` consumers are re-pointed to the nearest ladder step **in the same commit**. The duplicate is what reproduces: `--shadow-overlay`'s declared depth is `--elev-2`'s, so the surviving vocabulary is the one the design language names.
- [ ] **Step 2: Correct the row's count.** It does not reproduce: measured in source with `dist` and `node_modules` excluded, each `--elev-N` has one consumer, `--shadow-raised` two and `--shadow-overlay` none — not three unconsumed of five. Record the measurement on the row.
- [ ] **Step 3: Close it**, with the two surfaces that shift by a step checked in the browser.

**Annotated 2026-10-16 before dispatch, because Step 2's corrected count is itself wrong and the ruling's is
too.** Measured by the controller at `58be6688` in `editor-shell.css`: `--shadow-raised` declared `:510`,
consumed `:791` and `:881` (**two**); `--shadow-overlay` declared `:511`, consumed by nothing (**zero**);
`--elev-1` declared `:512`, consumed `:675` and `:2548` (**two**); `--elev-2` declared `:513`, consumed by
nothing in that file; `--elev-3` declared `:514`, consumed `:1625` (**one**). So the ruling's *"each of
`--elev-1/2/3` has one consumer"* and this step's *"each `--elev-N` has one consumer"* are both refuted —
`--elev-1` has two and `--elev-2` has none here (the ledger records it reaching
`components/ui/control-select.tsx:183`; the seat re-sweeps `packages/` and `tests/`). The ruling's line
citation `:465` for `--elev-2`'s value has moved to `:513` with the value unchanged. **The operative decision
is unaffected** — one ladder survives and both old names go — so only the counts are corrected, on the rows
and not by rewriting ruling text. **And the two consumers are `.editor-shell-publish-popup` (selector `:781`,
shadow `:791`) and `.editor-shell-menu-popup` (selector `:863`, shadow `:881`)** — so "nearest ladder step" is
a judgement between the numerically nearest and the semantically nearest.

**CORRECTED 2026-10-16 at the task's close, and the error was the controller's brief rather than the plan's
step.** This annotation first read that the second consumer was `.editor-shell-publish-label` and that the
comment at `:778-780` was stale because "the menu popup rides `--elev-3`". **Both halves were wrong.** The
second consumer is `.editor-shell-menu-popup`, and `--elev-3` is `.editor-shell-dialog`'s (`:1624`); the
comment — *"`--shadow-raised` is the menu popup's own lift, so the two portalled surfaces float the same
way"* — was **true**, and it is the reason the two popovers took the same step. The seat refused the brief's
claim rather than following it, which is what kept a true invariant from being deleted; the cause was a
controller reading two concatenated `sed` ranges and assigning the wrong selector to the second one. **The
seat also found two test sites the brief's sweep would have missed** — `editor-shell.tokens.test.ts`'s
`@theme` value pin and not-on-`:root` list, and `shell-palette-tokens.spec.ts`'s theme sample — and both
**throw** on an absent token rather than passing vacuously, so a `grep` for `var(--shadow-raised)` was not the
sweep the deletion needed.

**CLOSED 2026-10-16 at `b9566db1`, Phase 20's Task 20.1, `vg-261` verified.** The surviving step is
**`--elev-2` and not the numerically nearer `--elev-1`**: DESIGN.md §3's row 2 is *"Menus, popovers,
tooltips"*, which is what both consumers are, and taking `--elev-1` would have left `--elev-2` declared and
consumed by nothing — the state the block's own comment says the ratchet exists to shrink. Both re-pointed
surfaces, `.editor-shell-publish-popup` and `.editor-shell-menu-popup`, resolve
`rgba(0, 0, 0, 0.6) 0px 18px 44px 0px` in the browser against the real host. **This is the one task of the
three whose red proof could not be run, and the reason is itself a finding: the deletion is unguarded.**
The `@theme` value pin is `expect(Object.fromEntries(values)).toMatchObject({ … })`, which is
non-exhaustive, so re-declaring `--shadow-raised` in `@theme static` reddens nothing; the not-on-`:root`
list is a forbidden list over the type scale, and `design-tokens.mjs` checks literals rather than the
vocabulary. Filed as **`vg-553`** and homed on Task 20.7 below.

### Task 20.2: `--shell-warm` is readable in every palette

**Files:**
- Modify: `editor-shell.css` (ember, moss and plum); `design-language.spec.ts` (`PINNED_FLOOR`); the `--vigilia-accent` alias

**Interfaces:**
- Produces: `vg-201` closed

- [ ] **Step 1: Deepen `--shell-warm` to at least 4.5:1** against each palette's own `--shell-surface` and against the glass overlay.
- [ ] **Step 2: `--vigilia-accent` aliases `--shell-warm` on the canvas side**, so the readable value moves the canvas accent rather than the alias being broken.
- [ ] **Step 3: Delete `PINNED_FLOOR.invalid`'s three values and replace them with the 4.5:1 minimum**, and close it with the measured ratios named for all three palettes and the overlay.

**Annotated 2026-10-16 before dispatch: this task's `Files:` line names a file that does not exist.**
`tests/e2e/design-language.spec.ts` is not on disk — `PINNED_FLOOR` is declared at
**`tests/e2e/design-language-readers.ts:119`** and read by `tests/e2e/design-language-contrast.spec.ts` at
`:9`, `:47` and `:739`. `PINNED_FLOOR.invalid` is `{ ember: 1.9, moss: 1.35, plum: 1.35 }`, so the ruling's
values are right and only the path is stale. **Measured at `58be6688`**, the six palettes' own pair:
editorial `:206` `#fffdf7`/`#8a5a2b`; graphite `:278` `#12161c`/`#f3aa64`; ember `:327` `#f7e2d2`/`#ff7e6e`;
moss `:360` `#e4efd9`/`#e8c56a`; plum `:390` `#ece3f7`/`#ffb2a1`; light `:420` `#eff9f2bf`/`#8a5a2b`.
`--vigilia-accent: var(--shell-warm)` is **already the alias**, declared once at `:114`, so the ruling's
"let the canvas accent move with it" is met by keeping it rather than by adding one; and `--warn:
var(--shell-warm)` appears in every palette block, so those inherit the fix. The seat measures all six
palettes rather than assuming only the three the row names move.

**CLOSED 2026-10-16 at `ed4d6ee8`, Phase 20's Task 20.2, `vg-201` verified.** Measured on `--shell-surface`:
ember `#b81400` **5.34:1**, moss `#7a5800` **5.47:1**, plum `#b82100` **5.19:1**; the browser probe is 8
passed, exit 0. **The controller ran the red proof itself**, green → cut → red → `cmp`-identical restore →
green: with ember's `--shell-warm` back at the pastel `#ff7e6e`, `design-language-contrast.spec.ts` fails
`ember: invalid is 1.98:1, below 4.5:1 — rgb(255, 126, 110) on rgb(247,226,210)` (1 failed, 7 passed, exit
1), and the restored tree re-runs 8 passed exit 0. **Step 2's clause is inert and is recorded as such rather
than closed as met**: `--vigilia-accent: var(--shell-warm)` is declared (`:115`), but the token is read by
no rule, so deepening `--shell-warm` moves no canvas accent at all. That is **`vg-552`**, filed from this
task's trailer, expanded by the controller to **ten** unread `--vigilia-*` tokens rather than the two the
seat named, and homed on Task 20.7.

### Task 20.3: The token that lies goes

**Files:**
- Modify: `editor-shell.css`; `editor-shell.tokens.test.ts`

**Interfaces:**
- Produces: `vg-312` closed

- [ ] **Step 1: `--shell-flat`'s two declarations and its `NOT_A_COLOUR` entry are deleted in one commit.** The flat treatment is selector-driven, so a per-palette flag no `var()` reads is a knob that lies: changing it moves nothing and fails nothing.
- [ ] **Step 2: Confirm it is not one of `ADR-0040`'s three roles declared ahead of a consumer** — those are named and this is not among them.
- [ ] **Step 3: Close it.**

**Annotated 2026-10-16 before dispatch: Step 1's count is stale by a factor of four, and the test names the
token in four places rather than one.** `--shell-flat` is declared **eight** times at `58be6688` — `:71`,
`:172`, `:220`, `:291`, `:344`, `:374`, `:404`, `:442` (values `1`, `0`, `1`, `0`, `1`, `1`, `1`, `1`) — not
the two the ruling and this step both state. Two further mentions are **prose**, at `:275` and `:324`, and
`:324` reads *"Each names `--shell-display` and `--shell-flat` at the values it used to …"*, so that sentence
becomes false when the declarations go and is part of this task. The test names it at `:78` (prose), `:234`,
`:277` (a list) and `:459` (`NOT_A_COLOUR`, read at `:464`) — the ruling's `:398` is stale, **this step's
`:459` is right**, and the ruling's `:78` is right. The seat re-verifies the crux itself: that nothing reads
`var(--shell-flat)` and that the flat treatment is selector-driven.

**CLOSED 2026-10-16 at `0c1f559e`, Phase 20's Task 20.3, `vg-312` verified.** All eight declarations, all
four test mentions and the five prose sites go in one commit. **The controller ran the red proof itself**,
green → cut → red → `cmp`-identical restore → green: re-adding `--shell-flat: 1;` to the bare `:root` block
fails `the exclusion set is hiding a colour: expected [ '--shell-surface', …(11) ] to have a length of 11 but
got 12` at `editor-shell.tokens.test.ts:456` (1 failed, 12 passed, exit 1), and the restored file re-runs
13/13 exit 0. **This is the phase's only guard of its shape, and it is incidental rather than designed**:
the `NOT_A_COLOUR` exclusion set is a length assertion, so it happens to notice an addition.
`vg-553` asks for the deliberate version.

### Task 20.4: The drawings agree with the product's composed paint

**Files:**
- Modify: `docs/design/mockups/` (the segmented control, the in-button chord, the well padding)

**Interfaces:**
- Produces: `vg-301`, `vg-202` closed

- [ ] **Step 1: `vg-301` — the product's composed values stand as the drawings' values.** The segmented control and the in-button chord keep the composed paint — the chip border as `color-mix(currentColor 45%)` — and the drawings are corrected where they differ, rather than a drawn value being ruled for them.
- [ ] **Step 2: `vg-202` — the well's horizontal padding stays 6px**, and the mockup's `5px 8px` wells are the half that is corrected. Section 3's 4px is the step inside a control rather than this row's horizontal padding, and the drawing's own well already draws `4px 6px` for the same element.
- [ ] **Step 3: Close the two**, each naming the file and the element its correction touches.

**Annotated 2026-10-16 before dispatch: Step 2's premise is refuted by the drawings' own README, and the
step as written would have edited a frozen file.** The `5px 8px` wells exist in exactly **two** files —
`docs/design/mockups/inspector-controls.html` (9 occurrences) and `docs/design/mockups/inspector-language.html`
(6) — and **both are originals**, which `docs/design/mockups/README.md:29-33` calls *"not the current target"*
and *"never edited again — not to correct a value, not to remove a specimen, not to follow a ruling"*, with
`:48` adding *"The originals are never corrected, by this rule or any other."* The target file,
`current/controls.html` (`README.md:24`, *"The inspector column as it renders … wells, a slider, segmented
rows"*), **contains no `5px 8px` at all** and already draws `4px 6px` for the same element (2 occurrences,
also present once in each original) — which is the value the ruling names as agreeing with the product. So
**`vg-202` closes with no drawing edit owed**, and Step 2's *"the mockup's `5px 8px` wells are the half that
is corrected"* is corrected to say what is actually done. **Step 1's subject is product-only**: `color-mix`
appears in **no** drawing and `45%` in none of the three either, so *"the drawings are corrected where they
differ"* first requires measuring what `current/controls.html` and `current/controls-editorial.html` actually
draw for the segmented control's chip border and the in-button chord — and if they draw no border there, the
step has nothing to correct and says so rather than inventing an edit. This is the plan's own failure mode
(*"correcting a drawing to a value nobody ruled"*) caught before it was dispatched.

### Task 20.5: One ground per palette

**Files:**
- Modify: the settings drawing's light preview bar; the parity reader

**Interfaces:**
- Produces: `vg-350` closed

- [ ] **Step 1: The light palette's bar becomes a solid `background-color` like the other five**, so one ground per palette and one rule in the reader.
- [ ] **Step 2: Do not grow the reader a gradient comparator** plus a ruling on which stop is the ground. `vg-322` still owns which role a palette preview ground bar depicts and is not absorbed.
- [ ] **Step 3: Close it**, with the parity check reading all six bars.

**Annotated 2026-10-16 before dispatch: the ruling's action cannot produce the ruling's outcome, and the step
is BLOCKED on the one decision the ruling declined to make.** `vg-350` says *"THE LIGHT PALETTE'S BAR BECOMES
A SOLID `background-color` LIKE THE OTHER FIVE. One ground per palette and one rule in the reader, so the
drawing is corrected to the shape the other five already have rather than the parity reader growing a
gradient comparator plus a ruling on which stop is the ground."* **The reader compares the product's rendered
value, not the drawing's.** `.editor-shell-palette-swatch` paints `background: var(--shell-backdrop)`
(`editor-shell.css:973-976`), which under `light` is `linear-gradient(145deg, #d8ebe4, #afd4d1)` (light's
block, `:420`), so the product's computed `background-color` is `rgba(0, 0, 0, 0)` — and that is precisely
what `tests/e2e/mockup-parity.ts:437-450` already records, with the reason light is deliberately absent from
the five colour rows: *"a colour row would fail on a surface that is correct"*. So making the **drawing**
solid leaves the mismatch exactly where it was and moves it to the other side; it cannot give *"one rule in
the reader"*. **The only reading that satisfies the ruling's own outcome is that the light palette's product
ground becomes one solid colour and the drawing follows** — which is the decision the ruling's own sentence
refuses (*"rather than … a ruling on which stop is the ground"*). The row stays `open` and the task is not
briefed until the light palette's ground colour is decided. **One stale citation comes with it**:
`mockup-parity.ts:443` cites `editor-shell.css:281` for light's ground, and `:281` is inside graphite's block
(graphite's selector is at `:278`); light's block is `:420`. The measurement is recorded on `vg-350`.

### Task 20.6: `DESIGN.md`'s front matter and the CSS agree

**Files:**
- Modify: `DESIGN.md` front matter; `scripts/design-md.mjs` (`--sync`, the linter)
- Read: `editor-shell.css` (`--shell-display`)

**Interfaces:**
- Produces: `vg-354` closed

- [ ] **Step 1: The front matter's `fontFamily` syncs against the shell's default display stack.** The shell already declares `--shell-display` per palette, so `--sync` compares them and the linter requires the key — one fact declared once, rather than a field no consumer reads.
- [ ] **Step 2: The change sits inside the existing `--sync` reader**, so no new module and no new dependency.
- [ ] **Step 3: Close it with both directions proved**: a front matter that disagrees fails the sync, and one that agrees passes.

**Annotated 2026-10-16 before dispatch: Step 1 cannot be implemented as written, and it is BLOCKED pending a
re-decision rather than briefed.** `vg-354`'s ruling says *"the shell already declares its display stack per
palette (`--shell-display`), so the front matter's `fontFamily` syncs against the shell's default display
stack"*. **The premise is true and the inference from it is false.** Measured at `58be6688`:
`--shell-display` is declared **eight** times — `:70` on bare `:root` (the default,
`ui-serif, Georgia, "Times New Roman", serif`), `:171` in the dark base and `:290` graphite
(`system-ui, sans-serif`), and `:219`, `:343`, `:373`, `:403`, `:441` (`ui-serif, …`) — and its three
consumers are **display surfaces**: `:773`, `:1238`, `:1651`. The front matter's six `typography` entries
(`2xs`, `xs`, `sm`, `md`, `lg`, `xl`) are the **text scale**, and the CSS declares that scale as size and
line-height only (`--text-2xs` … `--text-xl` at `:498-506`) with **no family at all**; `:root`'s own comment
at `:60-68` calls the pair it holds *"a display face and a flatness flag"*. So the six entries are not a
transcription of `--shell-display`: syncing them against it would make the normative document declare the
serif display stack as the family of six UI text steps, which is a claim the CSS does not make and which the
row itself already says is *"CORRECT TODAY"*. **And the front matter is not sourced from the CSS at all**,
which the same reading found: **`DESIGN.md`'s own §2 (Typography)** declares the three families, the first
being *"UI sans (`system-ui` stack) — Everything a person reads as language: Labels, menus, headings, panel
copy"*, and the six entries carry exactly that string. `--shell-display` is a **different fact** — the
palette's display face, serif under editorial, graphite, ember, moss and plum and `system-ui` under light and
the dark base — and §2's table names **no serif family at all**, so the front matter transcribes §2's prose
rather than a CSS token and the ruling's target is the wrong owner. **Two mechanisms survive, and choosing
between them is a decision about what DESIGN.md normatively says about typography, so it is not taken here**:
(a) the shell declares a token for the UI sans stack and `--sync` compares the front matter against it, which
also gives §2's first family a CSS owner; or (b) the front matter stays a transcription of §2 and the linter
requires the key to equal §2's declared UI sans string — a prose-to-front-matter check rather than a CSS one.
Neither is the mechanism the ruling names, and the ruling's own rejected alternative (drop the key from the
six entries) is a third. **A third finding comes with it and is not this row's**: §2 names no serif family
while `--shell-display` applies one to chrome headings at three sites, so the CSS declares a face the
normative table does not list. **`vg-354` stays `open` and the re-decision is recorded on it**; Task 20.6 is
not dispatched until it is answered.

### Task 20.7: The shell's `--vigilia-*` vocabulary is read or retired

**Added 2026-10-16 mid-phase**, homing `vg-552`, which the seat doing Task 20.2 filed as a
`Discovered, not fixed:` trailer naming two tokens and which the controller expanded by measurement to
**ten of the fifteen** the control block declares. It belongs to this phase for Task 21.7's reason: it was
found by a measurement rather than by a ruling, and its subject is the token vocabulary. **It carries a
second row, `vg-553`, added the same day at Tasks 20.1–20.3's close**: nothing guards the `@theme static`
block's *absences*, so a retired name can be declared again with every gate green — which is why Task 20.1's
red proof could not be run at all.

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`; `editor-shell.tokens.test.ts`; and
  whatever reads the tokens that stay

**Interfaces:**
- Produces: `vg-552` and `vg-553` closed

- [ ] **Step 1: Re-run the measurement; the negative is searched, not assumed.** Per token by name,
      `grep -rn "var(--vigilia-<t>)" src/web --include=*.ts --include=*.tsx --include=*.css` with `dist/`
      and `node_modules/` excluded: `canvas-bg` 1, `control-bg` 5, `subdued` 1, `scrollbar-thumb` 3,
      `scrollbar-track` 3 — and **zero** for `text`, `panel-bg`, `panel-border`, `control-border`,
      `input-bg`, `muted`, `selection-bg`, `accent`, `accent-dim` and `guide`. The four things that make the
      negative hold are part of the measurement rather than a footnote: the block is on a plain `:root` and
      **not** inside `@theme`, so Tailwind generates no utility from these names; there is no `setProperty`
      for a theme token anywhere in `src/web`; no template constructs a `--vigilia-…` name; and a sweep for
      `vigilia-` not preceded by `--` returns only DOM element ids.
- [ ] **Step 2: Decide per token, with evidence, and do not accept a comment as the reason.** The block's own
      comment at `:91-99` describes live jobs for tokens nothing reads — `--vigilia-input-bg` is "a text
      field's own white", `--vigilia-accent` is "the control layer's highlight". Each of the ten is either
      retired the way `--shell-flat` was, or wired to the surface its comment names. **A token kept because a
      comment describes it is not a decision**; the reason has to be a rule that reads it or a surface that
      will.
- [ ] **Step 3: Land the disposition and close `vg-552` naming the count before and after and the same
      measurement command.** Note that `vg-201`'s ruling's *"let the canvas accent move with it"* is inert
      while `--vigilia-accent` has no reader, so whichever way this lands, that half of the ruling is
      discharged or corrected in the same commit.
- [ ] **Step 4: `vg-553` — the vocabulary's absences get a guard, and its granularity is the decision.**
      Today the surviving guard is one-directional: `shell-palette-tokens.spec.ts`'s `themeToken()` throws on
      an absent token, so a *removal* is caught and an *addition* never is, while the `@theme` value pin is
      `toMatchObject` and the not-on-`:root` list is a forbidden list over the type scale. An exhaustive
      assertion over the whole `@theme static` block is **not** the fix — the block also carries the
      `--color-*` aliases and the type scale, so it would redden on every legitimate addition. Choose the
      granularity (a closed set per family, a per-retirement absence assertion, or something else), land it,
      and **prove it red** by re-declaring a name this phase retired.

## Task 20.7 — closed 2026-10-16

**CLOSED at `7874e879` (`vg-552`) and `150ad617` (`vg-553`). All ten tokens are retired and none is wired**,
because the seat checked each named surface against the product and **none exists**: the five plain aliases
duplicate `--shell-*` roles every surface already reads directly; `--vigilia-input-bg`'s "text field's own
white" has no white surface, the field being `bg-transparent` inside `ControlWell`, which is `bg-panel-2`
inside `border-edge`; `--vigilia-selection-bg` has no reader because the selected layer row paints
`color-mix(in srgb, var(--shell-text) 14%, transparent)`; and `--vigilia-guide` has no reader because guides
are Fabric's `GUIDE_COLOR`. **The footprint was one declaration each**, unlike `vg-312`'s eight — every one
declared once in the `:root` block, no test mention, no mockup mention — plus two prose sites corrected in
the same commit.

**`vg-201`'s ruling's second clause is UNREACHABLE THROUGH THIS MECHANISM, and that is a stronger finding
than the row's "inert".** The alias `--vigilia-accent: var(--shell-warm)` was real and read by nothing, but
the reason no wiring could fix it is structural: the canvas is Fabric-painted from the theme document, whose
accent is **`palette.accent`** — a persisted theme value read by `renderer-core` (`scene/plan.ts`,
`charts/chart-paint.ts`) and not by any stylesheet. **No CSS custom property can move the canvas accent,
whatever reads it.** What the ruling did land is the half that mattered: `--shell-warm` is deepened and
every `--warn` text moved with it. **What is left open and is not this row's**: whether the shell's warm
should also move the theme document's `palette.accent` is a question about persisted theme data, and nobody
has ruled on it. Recorded as a dated note on `vg-201`'s archived row.

**The guard is a per-retirement list, and the controller re-ran its red proof on one name per retirement
commit** rather than trusting the seat's sweep of thirteen: `--shadow-raised` (20.1), `--shell-flat` (20.3)
and `--vigilia-accent` (20.7) each read **exit 1** with the case's own message, baseline is **14/14 exit 0**,
and every restore is `cmp`-identical. **An exhaustive assertion over `@theme static` was refused with a
reason**: that block also carries the type scale and the `--color-*` aliases, so a closed set over it would
redden on every legitimate addition. `RETIRED_TOKENS` is the vocabulary this phase closed, and a name joins
it when it is retired — the one moment the fact is known.

**One pointer in this plan is stale and is corrected here rather than in the closed tasks that carry it:**
`tests/e2e/shell-appearance.spec.ts` **is not on disk** — it was split at `81426c44` into
`tests/e2e/shell-surfaces.spec.ts` and `tests/e2e/shell-palette-appearance.spec.ts`. The name appears in
Tasks 2.3, 2.5, 13.5 and 15.x, where it is **accurate history** for work those tasks did at the time, so
those lines are left as written; what changes is that a live reader now has the current names here.
`docs:check` does not catch this and is not meant to — `scripts/check-doc-references.mjs` resolves
`plans/*.md` references only. **Fixed on the fly rather than filed**: the cause is named, the fix sits in
one document, and no test could assert a prose pointer.

### Task 20.8: The segmented control's drawn treatment, and the capture that never shows it

**Added 2026-10-16 at Task 20.4's close**, homing `vg-554`, which Task 20.4's seat filed as a
`Discovered, not fixed:` trailer on `5ea10439` rather than redrawing a control the ruling described as one
declaration away. It belongs to this phase for the phase's own reason: its subject is a drawing and the
treatment the design language gives a control.

**Files:**
- Modify: `docs/design/mockups/current/controls.html`, `current/controls-editorial.html` **and
  `current/shell.html`** — corrected 2026-10-17 at the task's close: this line named two drawings and
  **`current/shell.html` draws the same four segmented rows**, so leaving it would have had the current set
  draw one control two ways; and whatever the capture registry's owner is, for the second clause

**Interfaces:**
- Produces: `vg-554` closed

- [ ] **Step 1: The ruling settles the direction; the SCOPE is what is open.** `vg-301`'s ruling reads
      *"the drawings are corrected where they differ, rather than a drawn value being ruled for them"*, so
      the product's composed treatment is the target and the drawings move — **the seat doing Task 20.4 was
      right to stop short of it, but not because the direction is undecided**: what it could not settle from
      the ruling is that the difference is **six declarations** rather than the one the ruling names, and
      that correcting one of them is entangled with a second defect. **The ruling's named difference does
      not exist here**: the segmented chip draws no border at all, and the container's `--well-edge` equals
      `--shell-edge` under graphite, so *"the chip border as `color-mix(currentColor 45%)`"* is
      `.editor-shell-primary-key`'s rule and not this control's. Record the scope before editing, and if a
      seventh declaration turns out to be entangled with a value nobody ruled, **stop and report rather than
      extending the redraw** — that is this phase's named failure mode.
- [ ] **Step 2: Re-measure with the palette settled.** `.editor-shell button` carries a 140 ms
      `background-color` transition, so an unsettled probe returns an **interpolated** colour — the seat's
      first two reads gave `rgb(11,14,18)` and `rgb(155,154,150)` for the same chip. Settle before reading.
      Note the entanglement the seat found: under editorial `--well` is already `#f5f1e8` and equals
      `--stage`, and that drawing's `--bg`/`--panel2` are swapped against the product's editorial palette,
      so the pressed fill cannot be corrected alone.
- [ ] **Step 3: The capture clause.** No registered capture shows the header's publish trigger at all —
      `shell-capture-add.png`, `shell-capture-graphite.png` and `shell-capture-glyphs.png` are taken on the
      editor preview, where `PublishControl` returns `null` because no host answers `/api/hosting`. Decide
      whether a capture is owed, and **if one is, it goes through the registry in
      `docs/evidence/screenshots/README.md`** rather than being added here. Rebuilding the three PNGs
      unchanged is clock-dependent churn and is not the fix.

**Verify:** `npx vitest run tests/e2e/mockup-values.test.ts`; `npx playwright test
tests/e2e/design-language-drawings.spec.ts --workers=1`; the parity captures rebuilt **only** if Step 3
registers one.

**CLOSED 2026-10-17 at `e4785eaa`, Phase 20's Task 20.8, `vg-554` verified — and the row's own count was
wrong.** The drawn treatment differed in **eight** declarations, not the six the row named: the two the
brief told the seat to settle were the middle chips' **`border-left`/`border-right` hairlines**, which the
product does not draw at all, and the pressed chip's **`font:500`**, which is the drawing's invention —
DESIGN.md §5's Segmented row names the lift as the fill and no weight, so the product's `400` stands. The
redraw is grounded in a normative source rather than in the product's CSS alone, which is what keeps it out
of this phase's failure mode: §5's row at `DESIGN.md:465` reads *"A `--panel-2` well holding 2–4 labels,
the active one lifted to `--stage`"*, and the drawings' token table maps `--panel2` to
`--shell-surface-strong` and `--bg` to `--shell-backdrop` (`mockup-values.ts`'s `SHELL_ROLES`), so no token
was added and no value invented. **A third drawing was corrected and this task's `Files:` line did not name
it** — see the correction above. **No capture is owed for either clause**, and both reasons are measurements:
the product is unchanged by a drawing correction, `control-set`'s registered action already photographs the
product's segmented treatment beside `controls.html`, and no registered action reaches the header's publish
trigger, which needs a host answering `/api/hosting` — that registry is Task 21.3's. **Two findings are
split out rather than extended into**: the editorial twin's palette table (`vg-555`) and the drawn chip
widths (`vg-556`), both homed on Task 20.9 below.

### Task 20.9: The editorial twin's table, and the drawn chip widths

**Added 2026-10-17 at Task 20.8's close**, homing `vg-555` and `vg-556`, both filed as
`Discovered, not fixed:` trailers on `e4785eaa` rather than extended into the redraw. They share a file set
and a subject — what a `current/` drawing claims the product renders — which is this phase's own subject.

**Files:**
- Modify: `docs/design/mockups/current/controls-editorial.html`; and the three drawings' segmented rows for
  the second clause

**Interfaces:**
- Produces: `vg-555` closed, `vg-556` carried open, and `vg-557` and `vg-558` filed

- [ ] **Step 1: `vg-555` — the editorial twin's token table, and the question is whether its ground is the
      product's.** Its `--bg` and `--panel2` are **swapped** against the roles `SHELL_ROLES` assigns them, so
      the two fills Task 20.8 landed render inverted; `--edge` and `--accent` diverge from the product's
      editorial values too, and `--well-edge` has no counterpart to compare against. `README.md:25` says the
      file is *"the same column on the editorial ground — the same file with the token table swapped, so a
      hard-coded colour cannot hide in it"*, which is what makes the swap a defect rather than a style —
      **but confirm that reading before correcting a palette-wide table**, because the alternative is that
      the ground is hand-drawn and the table is deliberate.
- [ ] **Step 2: `vg-556` — the chip widths.** The product's chips are `flex: 0 1 auto` and hug their labels
      (**34.1px "Left", 48.1px "Center" in a 170px group**); all three drawings give every chip `flex:1`.
      `mockup-values.test.ts` compares declared values and has no row over a flex factor, so nothing catches
      this. Decide whether the drawings follow the product or the divergence is documented.
- [ ] **Step 3: Close both**, naming the file and the element each correction touches.

**[Closed 2026-10-17: Step 1 landed and `vg-555` is `verified` at `22d9f91a`; Step 2's change was
reverted at `e0e7624b` and `vg-556` stays open with the direction reversed; Step 3's "close both" did
not hold, because one of the two rows turned out to be a question about what the drawings are for
rather than a drawing defect. `vg-557` and `vg-558` are filed from it.]**

**Step 2 was briefed in the wrong direction by the controller, and the seat said so.** The brief
asserted the drawing should follow the product and told the seat to confirm or refuse it; the seat
made the change, and its own commit recorded the counter-reading. The revert rests on three
sentences in `docs/design/mockups/README.md` against one in this phase's Outcome: `:102` *"Where the
written rules are silent, the drawing governs and the product is the defect"*, `:124` *"**The
treatment is the target and is never redrawn from the product** … When the product differs, the
product is the defect"*, and `:119`, which forbids drawing a surface *"in a treatment of the
product's devising"*. `DESIGN.md:465`'s Segmented row names the well and the lift and is silent on a
chip's width, so §5 licenses nothing here. **The Outcome's sentence is the weaker authority and is
annotated below rather than left to be re-used.**

**Step 1's licence was not the one the task named, and the stronger one was found in the product.**
The editorial palette block aliases §4's whole vocabulary per palette, so it declares the drawing's
own names — `--bg: var(--shell-backdrop)`, `--panel-2: var(--shell-surface-strong)`, `--edge:
var(--shell-edge)`, `--accent: var(--shell-accent)`. The twin's table is therefore not merely *meant
to be* editorial's; the product states the mapping, and two declarations contradicted it.
**`vg-436`'s ruling was read before the correction was accepted**, because it says the drawing's
token table stays editorial and nothing is redrawn: its rejected option (a) was a redraw against
`light`'s mint, and its stated cost was that a redraw *"would change what the parity instrument
checks for that row in exchange for fixing a name"*. This correction moves the table toward the
editorial reading `vg-436` chose and changes no instrument row, so it is not contravened.

**The seat refuted five premises of its brief, and four of the five hold on re-reading.** The brief's
"no product counterpart" list is wrong three ways — `--edge2` *is* mapped (`SHELL_ROLES` `:190`), and
`--well`/`--well-edge` do have counterparts (`wellClasses`' `bg-panel-2 border-edge` and §5's Well row
at `DESIGN.md:458`), which makes them mismatches to report rather than values with nothing to compare
against. The brief's "each is an equal third" describes the drawing and not the product, whose `Align`
group holds two chips, not three. And `vg-436` had already measured this table and refused the
redraw, which is why that ruling is quoted above.

**Carried out of this task, all three on the record rather than silently:** `vg-556` stays open with
the product as the defect and **no home in an open phase**, because Phase 18 owned the editor's
control set and closed with all twelve of its rows `verified`; `vg-557` files the README's own
`current/`-is-the-target-versus-as-it-renders-today tension, which is what made Step 2 arguable at
all; and `vg-558` files the twin's four remaining stale declarations, of which `--accent` is the one
`vg-436` left knowingly and needs the user's word.

**Verify:** `npx vitest run tests/e2e/mockup-values.test.ts` exit 0 (31 passed); `npx playwright test
tests/e2e/design-language-parity.spec.ts --workers=1` exit 0 (1 passed, 1 skipped); `npx playwright
test tests/e2e/design-language-drawings.spec.ts --workers=1` exit 0 (4 passed); a browser reading of
the corrected twin against the built fixture, palette settled — the twin's group fill
`rgb(255,253,247)` and pressed chip `rgb(245,241,232)`, matching the product's editorial, where both
were inverted before.

---

# Phase 21 — W16: the repo's own instruments

**Outcome:** the six ruled rows whose owner is a script or a registry are landed — the reuse gate's path
claim becomes a file claim, the citation check declares its sources, the capture registry owns a freshness
check, and the sweep's three tiers report what they claim — **and Task 21.7 adds a seventh, `vg-536`,
which no ruling named: the 800-line stop gets an instrument.** **Task 21.8 adds an eighth, `vg-550`,
added 2026-10-16 at Phase 19's close: the sweep's self-test stops pinning live source files, because
two of the four it pins have already been invalidated by work the product wanted.** **Task 21.9 adds a
ninth, `vg-551`, added the same day: the shell walk's budget becomes a measurement rather than a round
number, and the font picker's 758 tab stops are the reason it has to be.** **Task 21.10 adds a tenth,
`vg-544`, added 2026-10-17 at Phase 20's close: the watchlist names a path that is gone.**

**Phase 21 opened 2026-10-17 with Task 21.1 at `4a8c4d12` and decision note `0059`**, closing `vg-144` —
the gate's `covers()` is now an exact-file match, and the 14 notes that claimed a directory now claim
their files. **`vg-425` closed with it**, which this phase's task list did not name: its park waited on
exactly that convention, so it is discharged by work that landed rather than by a task authored for it.

**Task 21.2 landed the same day at `c536b25a` with decision note `0060`**, closing `vg-352` — the
citation namespace is now declared by source, six prefixes beside `CITE_NUMBERS`, and no bare `§N` from a
self-numbering document claims a `DESIGN.md` marker. It filed `vg-560`: the redesign spec is in the set
and numbers its own `§1`–`§13`, so its own `§2`, `§6` and `§7` still claim, which is `vg-352`'s shape one
document over and is recorded as a known limit in `0060` and in `CITE_SOURCES`' docblock.

**Task 21.3 landed the same day at `6952bad4` with decision note `0061`**, closing `vg-287` — **the registry
owns a capture's freshness, and the check is a recorded sha against the surface it depicts**. The manifest
is the README's own copy table widened by two columns rather than a `registry.json` beside it, because a
second file would be the same eleven captures twice and adding one would mean editing two files, which is
the drift the instrument exists to catch. **Its first live run is a finding and the seat reported it rather
than tuning it green: 11 registered captures, 11 stale, 0 broken, exit 1** — every one moved by
`editor-shell.css` (17 commits, newest `7874e879`) because **Phase 20's own token and elevation work is the
cause**. The eleven are left alone: re-shooting is the action owner's job. **`vg-402` stays open and this is
the phase's one deliberate half-close** — the row's question is answered on the instrument side and its
closing condition (*"each stale capture re-shot"*) is not, so the measurement is written onto the row rather
than the row closed around it. Two gaps are filed rather than left in the note: **`vg-561`** (the same
README claims the two copies are the same bytes and nothing checks it) and **`vg-562`** (the three shell
captures' surface sets omit the package that paints the stage they show).

**Task 21.4 landed the same day at `137bfeb3` with decision note `0062`**, closing `vg-380` — **the reverse
direction is in scope, and the selector instrument widens to class writes**. **Its own `Files:` line named a
thing that does not exist**, and correcting that is what the task turned out to be about: the instrument was
a one-off `node -e` command pasted into `docs/architecture/dead-selectors.md`, so Step 3's case — which a
pasted command cannot carry — forced the question of where it lives. It is now
`scripts/dead-selectors.mjs`, self-test chained into `gates:self-test`, live run left a command. **The row's
own measurement was off by ten and the seat measured it rather than inheriting it**: the reverse direction
reports **eleven** classes production source writes that neither stylesheet defines, not the one the row
names, and none is a visible defect at HEAD. The forward direction's `PRODUCT` column is now keyed on
**writes** rather than spellings, which is the ruling's second clause, and the document's stale §3 table
(135 at `a7ef0c3a`, **130** at HEAD) is corrected with it. One gap filed: **`vg-563`**.

**Task 21.5 landed the same day at `c76b9445` with decision note `0063`**, closing `vg-382` — **a declaration
is not a use**: the self-use test now excludes the declaration site, an import or export specifier, and an
object key, so a symbol kept alive only by its own key or its own re-export reads as dead. **Its Step 2
answer is the empty set and that is a measurement**: the two instances the row names are already gone, and a
base-to-HEAD diff of the sweep's `--json` report shows the four tier counts identical with 0 rows added, 0
removed and 0 evidence numbers changed. **The row's own text carried two false claims and both are corrected
on the row**: its *"CORRECTION TO THE TRAILER"* overrode a correct quote with a wrong one and named a
function that never existed, and its *"typecheck is the backstop"* names the wrong owner — no tsconfig
enables `noUnusedLocals`, and the rule that fired is Biome's `noUnusedVariables`. **The seat's stated red
recipe did not reproduce and the controller re-ran it in place**; the result does. One finding filed:
**`vg-564`**, the fourth instance of documents citing line numbers that rot.

**Task 21.6 landed the same day at `24abe87a` with decision note `0064`**, closing `vg-386` — the
`barrel-only-export` tier now means **no production consumer other than the barrel, with test consumers
disclosed**, and the fix is one condition: the file's own barrel no longer counts as a production consumer
of the shape the branch exists to report. **Its measurement is the one this phase's Acceptance asks for by
name**: `node scripts/dead-code-sweep.mjs --json <path>` reports **253** rows where the base reported 121 —
`barrel-only-export` **0 → 132**, the other four kinds identical at 11 / 6 / 99 / 5, so the 132 are pure
additions. **Step 2's adjudication is grouped by package barrel with its warrant stated**, 132 rows across
38 files and 5 packages, and **nothing was deleted**. The two comments that recorded the branch as
*"unreachable by construction"* were rewritten and **`vg-386` is named in neither**, because the case
beneath them exercises `barrelRoutes` and nothing would have reddened. **Three brief premises were false and
the seat measured all three** — the report is hand-authored rather than generated, its *"has never fired in
this tree"* phrase had already left before the base, and the row's 133 and its 76/57 split are 132 and 105/27
at HEAD.

**Task 21.7 landed the same day at `d4089b0d` with decision note `0065`**, closing `vg-536` — **`AGENTS.md`'s
800-line stop now has an instrument**, `scripts/oversize-files.mjs` with a stored 45-path ceiling, chained as
the 14th `gates:self-test` step. **The ceiling fails on an addition only**, which is what makes it not the
one-row-per-file policy in a new coat: a breach that is split clears the failure with **no edit at all**,
because the path was never in the ceiling. **The re-measurement at HEAD is 667 tracked files, 46 over the stop
before the cut, 45 authored over it, 9 named by a row title against 37 named by none** — and two
disagreements with the controller's cross-check were reconciled rather than picked, both being fault lines in
the row's own method. **The cut is authored versus generated** and lets an unmarked generated file land *in*
the set, visible, rather than dropping it by a convention nothing enforces. **The closest prior art was found
and rejected on shape**: Biome 2.5.14 ships `style/noExcessiveLinesPerFile`, whose escape hatch is one
`biome-ignore` per file — this row's defect relocated into the linter config. **The plan's own `Files:` line
for this task was stale by two** (`"the other eleven"` where the chain held thirteen) and is corrected in
place.

**Task 21.10 landed the same day at `a5a2d0ab` with decision note `0066`**, closing `vg-544` — **the
watchlist's dead entry is repointed and every entry is now proved to exist.** The entry named
`editor/src/selection-inspector/style.ts`, deleted at `aa5edf96`, and it now names
`editor/src/selection-inspector/view.ts` — the live selection-inspector owner `ownership.md` calls a mechanism
boundary, and **no note claims it**, so the entry actually refuses (exit 2) where the dead path reads exit 0.
**The dead entry was inert twice over, which the row stated only half of**: the path is gone *and* note `0030`
still claimed it, so restoring the file would not have made the entry fire — and `aa5edf96` deleted `0030`'s
whole subject, so that decision **dissolved rather than relocating**. Rejected and recorded: `appearance.ts`
and `index.ts` (neither has an ownership row), **a bare deletion**, and a wider rescope to
`editor-document.ts`. **The durable half is the row's own FIX line** — *"every watchlist entry names a path
that exists"*, read against the **live `WATCHLIST` rather than a synthetic array** and **by the rule each
entry matches by** (`0025`: anchored by `existsSync`, bare by a tracked-path segment at any depth), which
took `--self-test` from 12 cases to 16. **Both red proofs were re-run by the controller**, patched in place
and restored byte-identical under `cmp`. **One brief premise was false and the seat caught it**: a naive
`existsSync(entry)` does *not* red on the non-path entries — 19 of the 20 resolve as root paths — though the
check was made shape-aware anyway, because a bare entry's *matching* rule differs from a root-path reading
and a future bare entry with no root instance would red falsely and invite narrowing the list. **One row is
filed from this task**: `vg-565`, the notes' own `Paths:` claims, which nothing reads.

**Task 21.9's Steps 1 and 2 landed the same day at `6a9f3141`** — **the walk reports the presses it reached
and the regions it saw**, where `tabUntil` read `nothing matched in 200 presses` and nothing else;
`seenRegions` was already in scope at that line and discarded. **`walkthrough-shell.ts` was deliberately left
alone** against this block's `Files:` line, because its hand-rolled loops all run *after* a `tabUntil` has
landed focus in the target region. **The census reproduced with one mislabel**: rail 6 and 53, pane 5,
inspector 34 and step 5's 1058 hold, while *"step 6 102"* is step 9's File-menu walk and step 6 measures 65.
**And Step 3 cannot close as written** — see the correction on that step: the picker is 758 of step 5's 1058
presses, so the best model leaves 301 and the walk stays red at a bound of 200. **`vg-551` stays open on the
user's review of `2026-10-17-font-picker-keyboard-design.md`**, whose §5.1 asks for the bound ruling.

**Task 21.8 landed the same day at `b7b5c29d` with decision note `0067`**, closing `vg-550` — **the
kind-fires checks run against a fixture tree the tool owns and both real-tree walks stay**, which is the
split the row asked for rather than the replacement its Step 3 refuses. **The fixture is analysed by running
the sweep again over a temp root** (`--root <tmp> --json`), so the child is the same program and there is
nothing to drift from — that is the honesty question `0058` left open. **The row's `NOT ESTABLISHED` is now
measured**: the child costs **66–73 ms** against the real tree's **406–433 ms**, so `--self-test` is
**458–538 ms** and the second walk is **~16%**. **Five checks moved, not the four this block names**, and
**the real-tree candidate report is byte-identical to the base** — verified by the controller with a
`git worktree` at `07dd4676`, which is also what proves a false positive the seat introduced and fixed is
gone. **One row is filed from this task**: `vg-566`, the sweep's own report naming itself as a
file with an unresolved import.

**Why a phase of its own.** All six edit `scripts/` or a registry under `docs/evidence/`, and the three
sweep rows (`vg-380`, `vg-382`, `vg-386`) are **one instrument read three ways** — its selector direction,
its `redundant-export` tier and its `barrel-only-export` tier. Phase 15 homed instrument gaps a
measurement pass found; these six were ruled in Phase 1 and never scheduled. **Task 21.7 is the same
kind of arrival as Phase 15's rows — found by a measurement rather than by a ruling — and it is seated
here rather than in Phase 15 because Phase 15 fixed instruments that were silent, while this one did not
exist.**

**Owners:** `scripts/reuse-gate.mjs` (`claimedPaths`, `covers`); `scripts/design-md.mjs` (`--cite`);
`docs/evidence/screenshots/README.md` and its registry; the sweep script and its report.

**Constraints:** **queued behind Phases 12 and 15–20.** **`scripts/` is on the reuse gate's own
watchlist**, so every task here lands a decision note before its first write — and `vg-535` records that
the gate's hook does not block, so the note is owed on the merits rather than enforced. **`vg-386`'s
re-run is a sweep of its own**: the newly visible rows are adjudicated, not reported and left.

**Acceptance:** each row's own `check` passes; `vg-144`, `vg-380` and `vg-382` each carry a case that
fails when the fix is disabled; `vg-386`'s re-run count is recorded as a measurement with its command.
**[Corrected 2026-10-17: `vg-352` carries one too, and this line did not name it. Task 21.2's brief read
the omission as an instruction and was wrong to — the case landed because the row's own failure shape
needs one, which is the right reason and not this line's. The list is widened rather than left to
mislead the next seat.]** **[Corrected again the same day, when Task 21.3 landed `vg-287` with one and this
line still did not name it: **the rule is that every row in this phase whose failure shape permits a red
case carries one, and the three names above are instances of it rather than the set.** The list has now
been widened twice for the same reason, so it is stated as the rule and left incomplete on purpose — a
seat that reads a list of three as an exhaustive contract is reading it wrong, and the row's own failure
shape is what decides.]**

**Failure modes:** widening the reuse gate until it refuses the tree, which `vg-144`'s own ruling rejects
— the blunt presence-only reading stays and only the *unit* a claim is made in changes; a citation source
set that over-excludes; treating a tier's count as the finding rather than the rows behind it.

**Verify:** `npm run gate`; each script's own `--self-test`; the sweep re-run with its output read from a
file, never through a pipe.

### Task 21.1: A note claims the file, not the directory

**Files:**
- Modify: `scripts/reuse-gate.mjs` (`claimedPaths`, `covers`); the decision notes' `- **Paths:**` bullets

**Interfaces:**
- Produces: `vg-144` closed, and **`vg-425` closed with it** — its park waited on exactly this
  convention, so it is discharged here rather than left parked on work that has landed

- [ ] **Step 1: A path claim matches the file being written rather than a directory prefix**, so `0005`'s claim on `charts/` stops licensing every later change in it and the gate answers the question it appears to answer. The blunt, presence-only reading stays; what changes is the unit a claim is made in.
- [ ] **Step 2: A trailing `/` claim currently matches everything beneath it.** Re-point the notes that rely on one, **in the same commit**, or the gate refuses paths it used to allow.
- [ ] **Step 3: Close it**, with a case proving a sibling file under a formerly-claimed directory is now refused — and note that a test which picks a path some note *does* claim proves nothing, so the case must use a watchlisted path no note claims.

**[Closed 2026-10-17 at `4a8c4d12`, decision note `0059`. Phase 21 opens with it.]** `covers()` is now
`claimed.some((c) => rel === c)` — a claim names the file being written and only that file. **Both
suspect branches were deleted rather than narrowed, and both were measured before the deletion**: the
trailing-slash branch's `rel.startsWith(base)` has no separator, so a claim on `charts/` would also have
covered a sibling named `chartsomething`, and no such sibling exists, which makes it real in code and
unreachable in fact; the non-slash arm's `startsWith(base + "/")` was **dead**, checked pairwise over all
63 claims, none of which is a prefix-directory of another. **Step 2 is the half that could have gone
wrong and did not**: 14 notes carried 15 directory claims and now carry 80 distinct file claims and no
directory claim at all, each list read from the note and the commit that landed it rather than guessed.

**The brief's expected probe value was wrong and the seat said so rather than working around it.** It
predicted `charts/settings-fields.ts` would return EXIT=2 after the fix; it returns EXIT=0, and correctly
— `0028` is the note whose decision IS the descriptor table in that file, and it claims that file after
the re-point. The fix's effect is visible on `charts/grid.ts`, which no note claims: EXIT=0 before,
EXIT=2 after. **The controller re-ran the red proof rather than taking the seat's**: with `covers()`
reverted, the self-test reports `FAIL refuses a file under a directory claim (expected 2, got 0)` at exit
1, and the file restored byte-identical before the green re-run.

**`vg-425` closes with it and is not named by this task's Interfaces line.** Its park waited on exactly
this convention — a per-file claim a directory entry cannot satisfy, and a self-test that can see the live
registry — so both halves landed here. **Its park's own count was re-derived rather than inherited**: the
park recorded that the 16-of-20 measurement could not be re-derived because the probe lived outside the
tree and is gone, and a fresh probe puts a brand-new file under each of the five directory entries and
gets EXIT=2 five times out of five, where the trailing-slash branch allowed all five. **`vg-535` is not
discharged by this** — it measures the hook not blocking at all, which is a different defect.

**Verify:** `node scripts/reuse-gate.mjs --self-test` exit 0 (12 cases, from 10); the row's own
`printf … | node scripts/reuse-gate.mjs` probe; `npm run gate` exit 0 (263 files, 3482 tests).

### Task 21.2: The citation namespace is declared by source

**Files:**
- Modify: `scripts/design-md.mjs` (`--cite`, where the canonical range is declared)

**Interfaces:**
- Produces: `vg-352` closed

- [ ] **Step 1: The check takes a SOURCE SET** — the documents whose `§N` are design-language citations, declared where the canonical range is declared. `requirements.md` is not in it, because a document about the product's requirements is not a document about the design language and its numbers belong to itself.
- [ ] **Step 2: State the two consequences so they are not rediscovered:** `DESIGN.md` is the target and never a source, and the sweep's guard stands — a `requirements.md` `§N` is not re-pointed as though it were a bible citation. Over-exclusion is the risk the row names, and the set bounds it: a document joins by being *about* the design language, which a reviewer can check, unlike a number.
- [ ] **Step 3: Close it, proving both directions**: a `requirements.md` §7 passes as its own number, and a design-language document's §7 still cites `DESIGN.md`.

**[Closed 2026-10-17 at `c536b25a`, decision note `0060`.]** `CITE_SOURCES` is declared beside
`CITE_NUMBERS`, as the ruling says it must be, and `isCitationSource` is the set's one rule applied to
the path each citation was read from. **Six prefixes**: `src/`, `scripts/`, `docs/decisions/`,
`docs/design/`, `docs/superpowers/`, `docs/product/triage/`. **The near-misses are the evidence the set
was argued rather than guessed** — `requirements.md` (the ruling's own exclusion), `tester-runbook.md`
(its own `## 0.`–`## 6.`), `docs/product/probes/README.md` (cites the runbook's §0),
`docs/architecture/` (both censuses number their own `## 1.`–`## 4.`), `docs/evidence/` (no in-range `§N`
at all), the registers (already out by `CITE_EXTENSIONS`), `DESIGN.md` and `CITE_EXCLUDE`'s two files.

**Step 3's first direction is proved and its reproduction on the real tree is impossible, which is a
measurement rather than a gap.** §7 carries 179 claims, so removing all but `requirements.md`'s is not a
tree edit; what replaced it is the count that makes the point — **193 tracked files carry an in-range
`§N` and nine documents number their own sections and carry one, yet 0 of the 18 markers is claimed only
by one area**, so every candidate set passes today and the set has to be argued. The delta is recorded:
§7 179→178, the one dropped being `requirements.md:20`'s own heading, and no marker lost all its claims.
**The controller re-ran the red proof rather than taking it**: disabling `isCitationSource` reddens three
self-test cases at exit 1, restored byte-identical, green again.

**Two premises of this task's brief were false.** `docs/design/design-language.md` — the brief's first
"obvious in" — **does not exist**; it was deleted at `db000c40`, retired for `DESIGN.md`. And the brief's
claim that *"a case that fails when the fix is disabled is Phase 21's Acceptance for `vg-352`
specifically"* is **false**: the phase's Acceptance names `vg-144`, `vg-380` and `vg-382` only, so the
case landed because the row's failure shape needs one, not because the phase asked. **The Acceptance is
corrected below rather than left to mislead the next seat.**

**A third premise is a genuine tension inside the row and is recorded rather than smoothed.** `vg-352`'s
detail names the redesign spec as a *foreign-numbering* document whose `§N` must not count; the ruling
names the redesign spec as a member of the set. The task resolved toward the ruling, because excluding a
document that genuinely cites `DESIGN.md` is the over-exclusion the row names as the risk, and the
residual — the spec's own `§2`, `§6` and `§7` still claim — is `vg-560`.

**The sweep guard holds, measured**: no `DESIGN.md`/bible attribution to a `requirements.md` number ≥31
exists anywhere in `docs/`, `src/` or `scripts/`.

**Verify:** `node scripts/design-md.mjs --cite` exit 0; `node scripts/design-md.mjs --self-test` exit 0
(44 cases); `npm run docs:check` exit 0; `npm run gate` exit 0 (263 files, 3483 tests).

### Task 21.3: The capture registry owns a freshness check

**Files:**
- Modify: `docs/evidence/screenshots/README.md` and the registry; add a scanner under `scripts/`

**Interfaces:**
- Produces: `vg-287` closed, and **`vg-402`'s mechanism half** — added 2026-10-16, when Task 15.5 landed `vg-402`'s documentation half at `2ce8ef1e` (the README now states the copy step and carries the eleven name pairs) and left the row open because **its title's claim is still true**: writing a step down is not an instrument. **And one measurement narrows what this check can be**: two runs of `captures the settings modal's three tabs` on one bundle produce different bytes at identical dimensions, so a byte-diff scanner reports that capture stale on every run — the check keys on geometry or on the recorded commit, not on bytes.
- [ ] **Step 1: Each registered capture records the commit it was taken at and the surface paths it shows**, and the scanner reports a capture whose surface paths have commits after that sha, so a stale image is a finding rather than a habit.
- [ ] **Step 2: Both READMEs today name an action and a file and nothing about the product generation** — which is how the shell-palette and keyboard-reference images could contradict the product for two plans with every gate green.
- [ ] **Step 3: Close it**, with the scanner's own `--self-test` and one deliberately stale capture reported.

**[Closed 2026-10-17 at `6952bad4`, base `ed6b32d7`, decision note `0061`. `vg-287` closes; `vg-402` does
not, and the half it leaves is named below.]** The ruling's shape is what landed: **the registry owns a
capture's freshness, and the check is a recorded sha against the surface it depicts** —
`scripts/capture-freshness.mjs` (309 lines) reads each capture's `Taken at` sha and `Surfaces` paths, runs
`git log <sha>..HEAD -- <path>` per surface, and exits 1 on a finding.

**The manifest is the copy table itself, and the argument for that is the row's own cost-if-wrong.** The
README's table gained two columns — `Taken at` (the commit that last wrote the action's own file) and
`Surfaces` (backticked repo-relative paths) — rather than a `registry.json` beside it. A second file would
be the same eleven captures twice, and adding a capture would mean editing two files, which is exactly the
drift the instrument exists to catch. **The table does not re-list the actions either**: those are
Playwright titles in `src/web/tests/e2e/*.spec.ts`, which the capture workflow's `grep` input names, so a
manifest repeating them would be a third list that can disagree with two.

**Bytes are never compared, and that is the measurement the brief carried rather than a preference.** Two
runs of `captures the settings modal's three tabs` on one bundle produce different bytes at identical
dimensions, so a byte-diff scanner reports that capture stale on every run and the instrument becomes
noise. The check keys on the recorded commit and the surface paths.

**The first live run is the finding, and it was reported rather than tuned green.** `node
scripts/capture-freshness.mjs` exits **1** with **11 registered captures, 11 stale, 0 broken**. Every one
is moved by `editor-shell.css` (17 commits since the recorded sha, newest `7874e879` — Task 20.7's token
retirement) and by `editor-shell/` and `components/ui/`, so **Phase 20's own token and elevation work is
the cause**. The eleven are left alone: re-shooting is the action owner's job and needs built bundles, one
worker and `VIGILIA_CAPTURE=1`, and this task is not a re-shoot.

**The self-test is chained into `gates:self-test`** (`src/web/package.json:40`) rather than left as a
script nobody runs. The live run is a **command rather than a gate step**, because gating on it would hold
every commit red until the eleven are re-shot — the same distinction Task 21.7 states for its own
instrument.

**The red proof was re-run by the controller rather than taken from the seat.** With `commitsAfter`
returning `[]`, the self-test reddens the named case at exit 1 (`FAIL reports a stale capture (expected
exit 1 and "1 stale", got exit 0: … 0 stale, 0 broken)`) and the live run goes silent at `0 stale`, exit 0
— which is the defect itself — and the file was restored byte-identical before the green re-run.

**`vg-402` stays open and this is a deliberate half-close, not an omission.** The row's question is
*whether it becomes a checked instrument or a scheduled act*, and only the instrument half is answered:
its title's claim (*"nothing in the repo re-shoots the captures beside the drawings"*) is still true and
its closing condition (*"each stale capture re-shot"*) is unmet. The measurement is written onto the row —
11 of 11 stale — rather than the row closed around it, and **whether a re-shoot becomes a scheduled act is
a scheduling ruling the scanner deliberately does not make.**

**Two gaps are filed from this task rather than left in the note.** **`vg-561`**: the same README states
that each capture's two copies are the same bytes and stay that way, and nothing checks it — a *copy* of a
committed file is byte-comparable even though a *render* is not, so it is a cheap second instrument.
**`vg-562`**: the three shell captures' `Surfaces` sets omit `scene-fabric`, which paints the stage those
frames show, so a renderer change leaves them reported **fresh** — the unsafe direction. The seat recorded
that rather than writing a plausible list, because the stage shows a *scene* and the honest bound is not a
directory list; it is stated in `0061`'s limits and in the README's prose so it is not rediscovered as a
defect.

**Verify:** `node scripts/capture-freshness.mjs --self-test` exit 0 (5 cases); `npm run gate` exit 0;
`npm run docs:check` exit 0; `npm run backlog:check` exit 0 (562 items).

### Task 21.4: The sweep reads class writes

**Files:**
- Modify: the selector instrument — **[corrected 2026-10-17: this line read "Modify: the sweep script's
  selector instrument", which names a thing that does not exist.** `scripts/dead-code-sweep.mjs` contains
  0 occurrences of `selector`, `className`, `classList` or `class=`; the instrument was a one-off `node -e`
  command pasted into `docs/architecture/dead-selectors.md`. The task's real question was therefore *where
  the instrument lives*, and it is answered in `0062`: `scripts/dead-selectors.mjs`.**]

**Interfaces:**
- Produces: `vg-380` closed

- [ ] **Step 1: Read `className` and `classList` writes alongside `class=` literals**, so a class production writes that no stylesheet defines becomes visible and the PRODUCT column stops depending on whether a name happens to appear in prose.
- [ ] **Step 2: Record the one measured instance in the report rather than dropping it** — it is harmless by accident, which is why the gap is closed before an instance arrives that is not.
- [ ] **Step 3: Close it**, with a case that fails when the widened reading is disabled.

**[Closed 2026-10-17 at `137bfeb3`, base `caa7ee86`, decision note `0062`. `vg-380` closes.]** The ruling's
shape is what landed: **the reverse direction is in scope, and the selector instrument widens to class
writes.** The instrument is now `scripts/dead-selectors.mjs` (423 lines) — **and the `Files:` line above
named a thing that does not exist**, which is the task's real finding. Step 3 asks for a case that fails
when the widened reading is disabled, and a pasted command cannot carry a fixture, which is what forced
the question of where the instrument lives. The document keeps its reasoning and loses its command, so
there is one executable copy; `--self-test` (7 cases) is chained into `gates:self-test`, and the live run
is a **command** because it exits 1 at HEAD.

**This row's own measurement was wrong and the seat measured it rather than inheriting it.** The row says
`vigilia-field-hint` *"occurs exactly ONCE in the entire checkout"* — true of the **string**, not of the
**direction**. The reverse reading reports **eleven** classes; the other ten had never been counted. All
eleven are real DOM writes, none is defined in either stylesheet, and none is a visible defect at HEAD:
four are unstyled hooks a test queries, two are painted inline, one is hidden by inline `cssText`, and
four carry Tailwind utilities on the same element. **A task that finds its own premise off by ten is the
reason the ruling was written as a direction rather than as an instance.**

**The forward direction's second clause landed too**: the `PRODUCT` column is keyed on **writes** rather
than spellings, and its bucket is corrected so `.html`/`.htm` under `src/web` counts as `PRODUCT` — a host
page writing `class="hint"` is the product applying it — which removes the `.hint`/`.lead`/`.elsewhere`/
`.theme-list` hand-clearing the document had recorded as its own limit. The shipped report is **5 of 130
unapplied: the same five `data-*` attributes as before, and 0 of 97 classes**.

**The narrowing is a judgement and is recorded as one.** 331 classes are written by production source and
234 are undefined, so the reading is narrowed to the stylesheets' own namespaces (`editor-`, `vigilia-`,
`theme-`): **11 named, 223 counted**. The prior art (`cssguard`, `gulp-check-unused-css`, `blok`) all needs
a hand-kept list, and a report with 234 findings is one nobody reads. `data-*` deliberately keeps the
spelling reading, because the ruling names classes and `dataset`'s camelCase form has no single write
shape; the asymmetry is in `0062`.

**The document was also stale where it was read as current**, and the seat measured it rather than
inheriting it: §3's table is 84+32+17+2 = 135 at `a7ef0c3a` and **130** at HEAD (80+31+17+2), because
Phase 20's token work retired four classes and one attribute, and `editor-shell.css` is 2,826 lines rather
than the 2,558 it states.

**The red proof was re-run by the controller rather than taken from the seat**: with `classWrites`
returning no writes, **5 of the 7 self-test cases fail at exit 1**, and the two survivors are the attribute
half and the unreadable-stylesheet case, which do not depend on the widening. One gap is filed rather than
left in the report: **`vg-563`** (three passes in that document and only one of them is a script).

**Verify:** `node scripts/dead-selectors.mjs --self-test` exit 0 (7 cases); `npm run gate` exit 0 (263
files, 3483 tests); `npm run docs:check` exit 0; `npm run backlog:check` exit 0.

### Task 21.5: A declaration is not a use

**Files:**
- Modify: the sweep script's `redundant-export` tier

**Interfaces:**
- Produces: `vg-382` closed

- [ ] **Step 1: The self-use test excludes declaration-shaped occurrences**, so an object key or a re-export stops counting as a read of the name it declares, and the tier reports a symbol kept alive only by its own declaration.
- [ ] **Step 2: Re-run the sweep and record the newly reported symbols** as rows, not as a count.
- [ ] **Step 3: Close it.**

**[Closed 2026-10-17 at `c76b9445`, base `3eacbdfd`, decision note `0063`. `vg-382` closes, and its `Files:`
line was accurate this time — unlike Task 21.4's.]** The ruling's shape is what landed: **a declaration is
not a use**. `readsOutsideDeclaration` excludes exactly three shapes, each one that structurally cannot be
a read of the binding — the declaration site, a specifier in an import or export list (the re-export
instance), and an object key, whose `:` is the whole guard because without it `case name:` and
`cond ? name : x` are swallowed. **The false-positive cost is the unsafe direction and the note states it**:
the two export tiers take opposite remedies, so an exclusion firing on a read moves a live symbol onto the
removal list.

**Step 2's answer is the empty set, and it is measured rather than asserted.** The two instances the row
names are already gone (`panel` deleted at `93bb2c5f`, the re-export at `c9ed9dcc`), and a base-to-HEAD diff
of the sweep's own `--json` report shows the four tier counts identical — dead-export 6, redundant-export
99, test-only-consumer 11, unreachable-branch 5 — with **0 rows added, 0 removed and 0 evidence numbers
changed**; 105 evidence *sentences* were reworded, which is the fix's own text and not a finding. The
classifier was proved against the two historical file contents instead: `panel` at `93bb2c5f^` goes 3
occurrences → **0 reads**, and `countable` and `EDGE_TOLERANCE` at `c9ed9dcc^` each go 2 → **0**.

**The two self-test cases the brief flagged as a trap were handled rather than weakened.** `a redundant row
reports uses, not occurrences` passes unchanged; `every redundant row's number is its use count` became
`...its read count`, asserting `readsOutsideDeclaration(...)` where it asserted `usesIn(...) - 1` — **the old
assertion was the wrong one**, because it counted a declaration-shaped occurrence as a use. The self-test
went from 22 cases to 25.

**The row's own text carried two false claims, corrected on the row rather than left for the next reader.**
Its *"CORRECTION TO THE TRAILER"* asserts the scanner prints 1 where the trailer quoted 2, *"because
`usesDeclaration` subtracts the import specifier"* — but **`usesDeclaration` never existed in this repo**,
and the pre-fix body printed 2, so the trailer was right and the correction that overrode it was wrong. And
its *"typecheck is the backstop"* names the wrong owner: **no tsconfig enables `noUnusedLocals`**; the rule
that fired on `panel` is Biome's `noUnusedVariables` (`biome.json:14`), whose sibling `noUnusedImports`
(`:15`) covers the re-export class the same way — so the backstop holds for both classes, and it fires one
commit *after* the wrong remedy is applied.

**The red proof was re-run by the controller, and the seat's stated recipe does not reproduce.** A copy of
the script outside the repo cannot find the tree — the sweep resolves its root from its own directory — so
the copy reddens 14 of 25 cases for the wrong reason. Patched **in place** the result reproduces exactly:
**22 of 25 pass, exit 1**, the three failures being the three new fixtures, and the file was restored
byte-identical before the green re-run.

**One finding is filed rather than left in the commit**: **`vg-564`** — four documents cite line numbers into
`scripts/dead-code-sweep.mjs` that were already off by three before this change, and this is the fourth
instance of a shape three archived rows (`vg-371`, `vg-432`, `vg-517`) each fixed once by re-pointing the
number.

**Verify:** `node scripts/dead-code-sweep.mjs --self-test` exit 0 (25 cases); `npm run gate` exit 0 (263
files, 3483 tests); `npm run docs:check` exit 0; `npm run backlog:check` exit 0.

### Task 21.6: The barrel-only tier means no production consumer

**Files:**
- Modify: the sweep script's `barrel-only-export` tier

**Interfaces:**
- Produces: `vg-386` closed

- [ ] **Step 1: The tier means no production consumer other than the barrel, with test consumers disclosed** — 133 candidates, not the plan's literal sole-importer shape's 76. A test importing a barrel export is disclosed in the report and does not hide the export from the tier, because a survivor costs a ticket and a deleted live symbol costs the product, so the bias stays on detection.
- [ ] **Step 2: The newly visible rows are adjudicated as a sweep of its own**, not reported and left.
- [ ] **Step 3: Close it**, with the count recorded as a measurement and its command.

**[Closed 2026-10-17 at `24abe87a`, base `89c9a035`, decision note `0064`. `vg-386` closes.]** The ruling's
shape is what landed: **the tier means no production consumer other than the barrel, with test consumers
disclosed.** **The fix is one condition** — `consumers.filter((file_) => !isTestFile(file_))` became
`... && file_ !== barrel`, and the branch's now-vacuous `prodConsumers.length === 0 &&` clause was dropped
with it.

**The measurement this Acceptance asks for**: the command is `node scripts/dead-code-sweep.mjs --json
<path>`, and at `89c9a035` it reports **253** rows against the base's 121 — `barrel-only-export` **0 → 132**,
with the other four kinds **identical at 11 / 6 / 99 / 5**, so **0 rows were added outside the tier and 0
removed**. By package: editor 1, fake-source 2, host 21, renderer-core 90, scene-fabric 18. The row's 133
is historical; HEAD is 132 because the tree moved.

**Step 2's adjudication is grouped and its warrant is stated**: every row is a name its package's
`src/index.ts` re-exports and no production file imports, so the grouping is by package barrel — 132 rows
across 38 files and 5 packages. A word-boundary name search found **8 collisions, all dismissed on
inspection**; a quoted-string and kebab-case search found **none** of the string-resolved shapes the sweep's
header lists. Per row: **85 live in their own file and test-consumed, 26 live with no consumer, 20 declared
and read by nothing but a test (named in §3.4), and 1 with no reader at all** — `host/src/server.ts`'s
`HostingPeer`. **Nothing was deleted**, which the row's own text demands. The invisibility limit is stated in
§3.4 rather than implied.

**The two comments that recorded the unreachability were rewritten and `vg-386` is named in neither.** Both
asserted the branch *"is unreachable by construction"* and cited this row by name, and **nothing would have
reddened to say so**, because the case beneath them exercises `barrelRoutes` rather than the tier. A file
that still claims its own branch is unreachable is a worse artefact than the bug. A new case pins the fix —
`barrel-only-export fires` — as a **count rather than a pinned file**, so Task 21.8 can still move the
kind-fires checks.

**The report is hand-authored and was corrected in place**, which was itself a false premise in this task's
brief: nothing generates `docs/architecture/dead-code-candidates.md`. §1.1, §1.3 and §3.4 were rewritten and
§4's `ROOT`-pinned recipe removed. **Two further brief premises were false and the seat measured them**: the
report's *"has never fired in this tree"* phrase is **absent at HEAD** (it left before the base), so what was
actually stale was the present-tense *"the tier cannot fire"* claim; and the brief carried the row's 133 and
its 76/57 test-consumed split as current, where HEAD is **132** and **105/27**.

**The red proof was re-run by the controller**: with the filter reverted in place, `--self-test` is **25 of
26, exit 1**, failing exactly `barrel-only-export fires`, and the file was restored byte-identical before the
green re-run (26 of 26).

**Two documents were deliberately left alone and the reasoning is recorded**: `docs/product/triage/triage-B6.md`
and the plan's own design spec still say *"today it reports zero"*, and both are dated records of this row's
state at the sha they describe rather than current-truth documents.

**Verify:** `node scripts/dead-code-sweep.mjs --self-test` exit 0 (26 cases); `npm run gate` exit 0 (263
files, 3483 tests); `npm run docs:check` exit 0; `npm run backlog:check` exit 0.

### Task 21.7: The 800-line stop gets an instrument

**Added 2026-10-16**, homing `vg-536`, which was filed that day while Task 15.6 was homing `vg-415` and
`vg-420`. It belongs to this phase rather than to Phase 15 because it is a **new instrument over the
repo's own source**, which is what Phase 21 is for — Phase 15 fixed the four instruments that were
silent about a class of defect, and this one did not exist at all.

**Files:**
- Modify: `scripts/` (a new check, chained into `gates:self-test` the way the other twelve are) — **[the
  count read "the other eleven" and was stale by two when Task 21.7 ran: the chain held thirteen scripts
  before it and fourteen after, `capture-freshness.mjs` and `dead-selectors.mjs` having joined earlier in
  this phase. Corrected 2026-10-17 rather than filed, because it is this plan's own text.]**

**Interfaces:**
- Produces: `vg-536` closed

- [ ] **Step 1: Land the decision note** claiming the new script's path — `scripts/` is on the reuse gate's own watchlist, and `vg-535` records that the hook does not block, so the note is owed on the merits rather than enforced.
- [ ] **Step 2: The measure reports the over-stop set, not a row per file.** `vg-536` measured **47 tracked `src/web` files past the 800-line stop, 33 of them named by no register row** at `5ad08048`, and the finding is not the count: the one-row-per-file policy closed `vg-209`'s file while `layer-panel.dom.test.tsx` grew to 1968 unnamed and `vg-374`'s while `editor-session.dom.test.ts` reached 1707. **A filing per file per growth does not converge**; a reported set with a ceiling that falls does.
- [ ] **Step 3: The cut is authored versus generated, not product versus test.** `vg-426`'s token ratchet excludes tests and fixtures because a test asserting a hex is a test *about* a literal — but this stop applies to test files too (`vg-415`, `vg-420`, `vg-394`, `vg-395` are all test files), so a measure that excluded them would not have seen four of its own rows. `font-trios.generated.ts` (28284) is the case the other cut exists for.
- [ ] **Step 4: Give the ceiling a finish, and prove it red** by growing a file past it, then close.

**[Closed 2026-10-17 at `d4089b0d`, base `5742a071`, decision note `0065`. `vg-536` closes, and no row is
filed from it.]** The instrument is `scripts/oversize-files.mjs` with `scripts/oversize-files.ceiling.json`
(45 paths), chained into `gates:self-test` as its **14th** step.

**The ceiling is a set ratchet that fails on an addition only** — a path over the stop that the ceiling does
not name exits 1, while a ceiling entry no longer over the stop is **reported and never required to be
removed**. **That is what makes it not Step 2's *"edit on every split"***: a breach that is split clears the
failure with **no edit at all**, because the path was never in the ceiling, so the ceiling does not grow with
the codebase. Rejected and recorded: a **count ratchet** (splitting one file and growing another keeps it
flat, so the next breach is a discovery — this row's own failure) and **report-only** (nothing makes anyone
run it).

**The re-measurement is 667 tracked files, 46 over the stop before the cut, 1 generated, 45 authored over it,
109 past the 500 signal — and 9 named by a row title against 37 named by none.** Two disagreements with the
controller's cross-check were reconciled rather than picked, and both are fault lines in the row's own
method: the named/unnamed split is 9/37 and not 10/36, because `shell-layout.dom.test.tsx` is named by no
title while `vg-276`'s carries `shell-layout.tsx`, so a stem reading counts it — **the row is internally
inconsistent on that one file**; and every line count is one lower than the row's, because a trailing newline
is not a line.

**The cut is authored versus generated**, as Step 3 requires: a file is generated when its first five lines
carry **both** a generation claim and a do-not-edit notice, and the generator emits that header, so the rule
is self-maintaining. **What it lets through is the point** — an unmarked generated file lands *in* the
over-stop set, visible, rather than being silently dropped by a filename convention nothing enforces.
**Both `AGENTS.md` numbers are computed**: the stop as a set, the 500 signal as a count only.

**The closest prior art was found and rejected on shape, not on absence.** Biome 2.5.14 ships
`style/noExcessiveLinesPerFile` (added 2.3.12, declared source ESLint's `max-lines`); it is per-file and
all-or-nothing at lint time, its escape hatch is one `overrides` entry or `biome-ignore` per file — **which is
this row's defect relocated into the linter config** — and it reads `AnyJsRoot` only, so `.css` is outside its
reach and it has no notion of generated. `0065`'s rung 4 records the search.

**The red proof is two ways and neither touches a tracked file**: an empty `--ceiling` reports **45 `NEW`
rows at exit 1**, and a fixture git repo holding a 700-line file passes at exit 0 and is named at exit 1 once
grown to 900. The controller re-ran both.

**Verify:** `node scripts/oversize-files.mjs --self-test` exit 0 (9 cases); the live run exit 0 (45 accepted,
0 additions); `npm run gate` exit 0 (263 files, 3483 tests); `npm run docs:check` exit 0; `npm run
backlog:check` exit 0.

### Task 21.8: The sweep's self-test stops pinning live files

**Added 2026-10-16 at Phase 19's close**, homing `vg-550`, which the controller filed there after running
`npm run gate` and reading `gates:self-test` **21/22 passed**, `failed: ['test-only-consumer lands on
font-picker.tsx']`. It belongs to this phase for Task 21.7's reason: it is a new instrument over the
repo's own source, and this one did not exist rather than having gone silent.

**Files:**
- Modify: `scripts/dead-code-sweep.mjs` (the self-test block and its fixture tree)

**Interfaces:**
- Produces: `vg-550` closed

- [ ] **Step 1: Land the decision note** claiming the paths this writes — `scripts/` is on the reuse gate's
      own watchlist. **`0058` already carries the searches** (rungs 1–6, including the ecosystem one the
      row turns on), so this is a note that supersedes or extends it rather than a fresh search.
- [ ] **Step 2: A synthetic fixture tree owns the kind-fires checks**, so a case that proves
      `test-only-consumer` fires names a file the *test* owns — which is what the field does (`repowise`'s
      `tests/fixtures/ts_sample`, `pruneguard`'s per-fixture `expected.json`, `locrin`'s `fixture(...)`,
      `astro-cli` planting a dead function and reading the gate fail).
- [ ] **Step 3: The real tree keeps the invariants.** `no test file is ever a candidate`, `no package
      barrel is a no-importer-file` and `no ambient .d.ts is a candidate` are claims about *this* tree and
      are vacuous against a synthetic one, so both walks stay. **A self-test that replaced one with the
      other would trade a fragile pin for a check that proves nothing.**
- [ ] **Step 4: The other three file-pinning checks move with it** — `settings-field.ts`, `card-library.ts`
      and `boot-theme.ts`, the last of which is the first instance of this shape (Phase 5's Acceptance).
      **Corrected 2026-10-17 at Task 21.8's close: five checks moved, not four.** The four bindings were read
      by five checks, because `card-library.ts` was pinned **both** by `at("redundant-export", …)` and by
      `a redundant row reports uses, not occurrences`; both moved. **A sixth live-path pin was deliberately
      left in place** — `a barrel's re-export is followed as a route` names `charts/settings-fields.ts`
      inline, and it asserts a route mechanism rather than a kind firing, which neither `vg-550` nor this
      step names.
- [ ] **Step 5: Prove it red both ways** — a fixture's expected finding removed, and a real-tree invariant
      broken — then close.

### Task 21.9: The walk's budget is a measurement, and the picker's tab order is why

**Added 2026-10-16 at Phase 19's close**, homing `vg-551`, which the controller filed there after diagnosing
the browser suite's fourth red. It belongs to this phase for Task 21.7's and Task 21.8's reason: it is an
**instrument that reported wrongly** — the shell walk — and what it reported wrongly was a count nobody had
measured.

**Files:**
- Modify: `src/web/tests/e2e/walkthrough-focus.ts` (`TAB_BOUND`, `tabUntil`)
- Write: `docs/superpowers/specs/` (the picker's keyboard model, commissioned here)
- Modify: `src/web/packages/editor/src/font-picker/font-picker.tsx` and its dom test

**Interfaces:**
- Produces: `vg-551` closed

- [ ] **Step 1: The walk reports the count it reached.** `TAB_BOUND = 200` is a round number no measurement
      derives, and when a walk exceeds it the failure reads `nothing matched in 200 presses`, which says
      nothing about how far it got. Phase 19's close measured the real census — rail 6 and 53, step 2's pane
      5, step 4's inspector 34, **step 5's pane 1058**, step 6 102 — so the bound is derived from the shell's
      own stop count, and a walk that still does not match reports the presses it took and the regions it saw.
      **One census figure is corrected at Task 21.9's Step 1 landing: "step 6 102" mislabels the step** — the
      walk's own log maps 1:1 to its 7 `tabUntil` and 13 `tabToMark` calls, and step 6 measures **65** while
      the real **102** is step 9's File-menu `tabUntil`; all six figures exist in the walk and one was
      attributed to the wrong step. **"So the bound is derived from the shell's own stop count" is the
      sentence Step 3's correction turns on** — read against the clause under *What this task does not do*,
      the two say different things.
      **`tabUntil` also refuses to continue past an element it has already marked**, so the count is a
      one-sweep distance rather than a cycle, and the report says which.
- [ ] **Step 2: The reason is the font picker's trio list, and its keyboard model is a decision rather than a
      task.** `font-picker.tsx` renders `visibleTrios` in full — 379 trios, a favourite button and a row
      button each, **758 tab stops** — while the face list directly above it windows to `WINDOW = 15`; the
      picker carries no `role`, no `tabIndex` and no key handling at all. **Commission the spec**:
      `docs/superpowers/specs/<date>-font-picker-keyboard-design.md`, naming the two candidate models (window
      the trio list as the faces are windowed; or a roving tabindex / listbox model) with the keyboard
      consequence of each, and **get it reviewed before implementing** — the answer changes the control's
      keyboard contract, which is why `vg-551` was filed rather than fixed on the fly.
- [ ] **Step 3: Land the chosen model and close `vg-551` against the measurement, not against a pass** — the
      number that closes it is step 5's press count in the shell walk, before and after. **Corrected
      2026-10-17 at Task 21.9's Step 1 landing: this acceptance cannot be met while the bound stays 200, and
      the contradiction is with the clause below rather than with the measurement.** Step 5 is **1058**
      presses and the picker's trio list is **758** of them, so the best model leaves **301** (roving
      tabindex) or **330** (windowing) — both still over the budget, because the remaining ~300 presses are
      the shell's own tab order. **So a Step 3 that lands a model and leaves `TAB_BOUND = 200` leaves step 5
      red and `vg-551` unclosable.** The two readings and the ruling they need are stated at
      `docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md` §5.1, and **that ruling is the
      user's, because it decides what this task's acceptance means**; it is asked for with the model rather
      than after it.

**What this task does not do:** it does not widen `TAB_BOUND` to make the red go away. The row says in terms
that the walk's fixed budget is the same finding's other face, and raising it would hide the defect rather
than fix it. **Annotated 2026-10-17 at Step 1's landing: as written this clause and Step 1's *"the bound is
derived from the shell's own stop count"* cannot both hold, and the measurement is what shows it.** Fixing
the picker completely still leaves step 5 at 301–330 against a 200 budget, so honouring this clause means
`vg-551` cannot close on this task at all. **Both readings, and which measurement each closes the row on, are
at the spec's §5.1**; the ruling is the user's and is asked for with the model.

**One judgement Step 1's landing made and recorded, against this block's `Files:` line.** The line names
`walkthrough-focus.ts` alone, and `TAB_BOUND` is hand-rolled into `walkthrough-shell.ts`'s own loops
(`focusLayerRow`, `editFieldThenCancel`'s field search). **Those loops were deliberately left alone**: each
runs *after* a `tabUntil` has already landed focus in the target region, so a region census there would print
one region and add nothing, and each already names the bound it exhausted. The failure the task is about is
`tabUntil`'s, reached from `walkthrough-shell.ts`'s `enterGroup`.

### Task 21.10: The watchlist names a path that is gone

**Added 2026-10-17 at Phase 20's close**, homing `vg-544`, filed by the controller on 2026-10-16 while
opening Phase 18 and left named by no task since. It is Phase 21's by its owner — a script — and by nothing
else.

**Files:**
- Modify: `scripts/reuse-gate.mjs` (`WATCHLIST`)

**Interfaces:**
- Produces: `vg-544` closed

- [ ] **Step 1: The watchlist's editor entry names a file that no longer exists.** `scripts/reuse-gate.mjs:56` lists `src/web/packages/editor/src/selection-inspector/style.ts`, deleted at `aa5edf96`, so the gate can never refuse a write to it and the list reads as covering an owner it does not. Re-read the file before editing: the entry's line number is this plan's, not the file's.
- [ ] **Step 2: Decide the entry's replacement rather than deleting it.** The list's own comment records the opposite failure — a pass that found it covered no editor path at all while the editor is where most of these decisions now live — so the row's second half is which live editor path takes the dead entry's place, and a deletion with nothing put back re-opens that finding. **Corrected 2026-10-17 at Task 21.10's close: the stated reason does not hold as written.** Five editor entries would have remained after a deletion, so deleting could not have re-opened *"covered no editor path at all"*; the replacement was still made, because a genuine live boundary exists (`selection-inspector/view.ts`) and because the row's own FIX line offers repointing as the better half of *"drop the dead entry or repoint it"*.
- [ ] **Step 3: Close it**, with the gate's own `--self-test` and one case proving a write to the replacement path is refused.

---

# Phase 22 — W17: the proofs the plans owe, and the test configuration

**Outcome:** the seven ruled rows whose owner is a test or a test config are landed — one project timeout
covers the rebuild journey, the json reporter takes its path from the environment, `tests/e2e/` joins a
typecheck program, and three assertions and bullets that cannot fail are replaced by ones that can.
**Tasks 22.9 and 22.10 add two more, added 2026-10-17 at Phase 20's close: the copy walk's keyed
functions and its four unmounted surfaces (`vg-417`, `vg-418`), and the fixture page a `build`-only
bundle lacks (`vg-438`).** **[Closed in part 2026-10-18: Tasks 22.1–22.6 and 22.8–22.10 have landed,
closing `vg-147`, `vg-150`, `vg-192`, `vg-167`, `vg-168`, `vg-159`, `vg-537`, `vg-417`, `vg-418` and
`vg-438` — ten of the phase's eleven rows. **Task 22.7 cannot run as written and stays obstructed**: Task
25.7 removed the crop notice, so its fixture can no longer raise the two gaps it was written to raise, and
`vg-191` is the user's to withdraw or re-point rather than an agent's. The phase's acceptance is otherwise
met: every closed row's own `check` passes, `vg-167`, `vg-168` and `vg-159` each carry a case or a
corrected claim that fails when the fix is disabled, and the new tsconfig's coverage was shown by a
deliberate type error in a spec and reverted with the restore proved byte-for-byte. **Five rows were
filed by this phase's last two tasks rather than absorbed**: `vg-591`, `vg-592`, `vg-593` and `vg-594`
from Task 22.9's review and seat, and `vg-595` from the controller's own verification of Task 22.10, where
a stale preview server on the shared 4174 port served another worktree's `dist` and made a red proof read
green.]**

**Why a phase of its own.** Every row here is a claim about **evidence** rather than about product
behaviour, and three of them (`vg-167`, `vg-168`, `vg-159`) are the same finding: an assertion or a
verification bullet that cannot fail for the reason it claims to check. Phase 16 homed behaviour findings;
these are the proofs those findings were supposed to come from.

**Owners:** `playwright.rebuild.config.ts`; `playwright.config.ts`; a new `tsconfig.e2e.json` and the
`typecheck` script; `layer-tree.test.ts`; `bridge.dom.test.ts`; `src/web/tests/e2e/` fixtures; and the
verification bullets of the plan `vg-159` names.

**Constraints:** **CLOSED IN PART 2026-10-18: Tasks 22.1–22.6 and 22.8–22.10 have landed and only Task 22.7 remains, obstructed and unable to run as written — see its own note and the closure annotation above.** Previously: ACTIVE AGAIN 2026-10-18, when Phase 25 completed and Tasks 22.6–22.10 resumed; SUSPENDED 2026-10-17 by scheduling ruling, when the user prioritised their own 2026-10-17 reports; before that, **Active 2026-10-17 by scheduling ruling: Phases 12 and 21 are suspended, not closed, on user spec review; Phases 15–20 are closed.** Phase 21's font-picker model and `TAB_BOUND` ruling remain untouched; one phase runs at a time. **`vg-192` wires the new project into `typecheck`
in the same commit, or the project exists and nothing runs it** — and `gate` runs `typecheck`, so the
wiring is what makes the check real. **`vg-147` and `vg-150` change how the browser suites run**, so no
other task in this phase runs a browser suite concurrently — both are closed, so that constraint is spent.

**Acceptance:** each row's own `check` passes; `vg-167`, `vg-168` and `vg-159` each carry a case or a
corrected claim that fails when the fix is disabled; the new tsconfig's coverage is shown by a deliberate
type error in a spec and then reverted, with the restore proved byte-for-byte.

**Failure modes:** replacing a tautology with a source-shape assertion, which `vg-168`'s ruling
explicitly rejects; authoring a nested group into the starter instead of constructing a document; a
project timeout so wide it hides a real hang.

**Verify:** `npm run gate` (exit code read from `$?`); the rebuild journey for Task 22.1;
`npm run typecheck` before and after Task 22.3, with a deliberate error in a spec as the proof.

### Task 22.1: One budget for the rebuild journey

**Files:**
- Modify: `playwright.rebuild.config.ts`

**Interfaces:**
- Produces: `vg-147` closed

- [ ] **Step 1: A project-level timeout covers the whole journey.** The memory-rings test takes 45–52 seconds against Playwright's 30-second default, and the three siblings measured 27.0–27.9 seconds — so a loaded box reddens them for no defect. `test.slow()` on individual tests is not the mechanism.
- [ ] **Step 2: The memory-rings test's existing `test.slow()` call becomes redundant** rather than load-bearing once the project budget lands.
- [ ] **Step 3: Close it**, naming the measured sibling times that decided the budget and the budget chosen.

### Task 22.2: The json reporter's path comes from the environment

**Files:**
- Modify: `playwright.config.ts`

**Interfaces:**
- Produces: `vg-150` closed

- [ ] **Step 1: Drop `outputFile` from the config**, so the environment variable applies unconditionally and an instruction naming only the variable cannot be obeyed wrongly.
- [ ] **Step 2: The shared one-path collision ends** rather than being documented in every instruction: every session's report lands where the variable says.
- [ ] **Step 3: Close it**, showing two runs landing in two paths.

### Task 22.3: `tests/e2e/` joins a typecheck program

**Files:**
- Add: `tsconfig.e2e.json`
- Modify: the `typecheck` script; `src/web/tests/e2e/`

**Interfaces:**
- Produces: `vg-192` closed

- [x] **Step 1: `tests/e2e/` joins a tsconfig program as its OWN project**, not by folding into the editor's — the e2e project needs Playwright's types and the DOM, and pulling those into the editor's program would trade one missing check for a weaker one.
- [x] **Step 2: Wire it into `typecheck` in the same commit**, or the project exists and nothing runs it.
- [x] **Step 3: Prove it with a deliberate type error in a spec** — `npm run typecheck` exit 1 — then revert it and prove the restore byte-for-byte, because a Windows text-mode write leaves CRLF where git normalises, so `cmp` sees it and `git diff` does not.
- [x] **Step 4: Close it**, naming both exit codes.

### Task 22.4: The nested-group stamp walk

**Files:**
- Modify: `layer-tree.test.ts` (the walk beside the group filter)

**Interfaces:**
- Produces: `vg-167` closed

- [x] **Step 1: The assertion the row names is structurally empty.** It filters `row.kind === "group" && row.depth > 0` and expects length 0, which can only fail if the starter gains a nested group by accident, so it asserts nothing about the stamp rule it sits beside.
- [x] **Step 2: Walk the projection against a CONSTRUCTED document containing a nested group**, and keep the starter out of it — the starter is product content and its shape is not a test's to choose.
- [x] **Step 3: Close it**, having shown the new case fails when the stamp walk is disabled.

### Task 22.5: The card-library tautology goes

**Files:**
- Modify: `layer-tree.test.ts` (the `uiCopy.cardLibrary` comparison)
- Read: `new-fabric-theme-cards.ts` (the library it compares against)

**Interfaces:**
- Produces: `vg-168` closed

- [x] **Step 1: Remove the tautology.** `uiCopy.cardLibrary` compared against the library resolves one object on both sides, so the comparison holds for every value that object could ever take: it cannot fail for the reason it claims to check.
- [x] **Step 2: Do NOT replace it with a source-shape assertion.** Source-reading is rejected: this suite's business is behaviour, and an assertion over a builder's spelling pins the text of a file rather than what the product does.
- [x] **Step 3: Keep the two assertions the break proved real** — the stamp is present at all, and its `widgetId` — and leave the cross-path comparison as the one that covers agreement.
- [x] **Step 4: Close it.**

### Task 22.6: The bullets plan 4 wrote are discharged

**Files:**
- Modify: the plan whose verification bullets these are; `bridge.dom.test.ts`; the offset-survival surfaces

**Interfaces:**
- Produces: `vg-159` closed

- [x] **Step 1: The offset-survival case is ADDED for the surfaces the bullet claimed.** `DESIGN.md` §7.7 specifies preserving per-pane offsets and disclosure state across routine updates, so a proof that exists for the layer list alone is a proof of one surface's luck rather than of the rule. **Done**: `editor-rail.spec.ts`'s "each pane comes back to the offset it was left at" walks all four slots and reads each offset back off the element, so a pane that fits its box fails with the slot named rather than passing on a `0` that survived. Read on the integrated tree at `--project=desktop-chromium --workers=1` against a rebuilt bundle: 15 passed, `pane-offsets {"Composition":300,"Add":93,"Tokens":300,"Document":168}`. **One pointer in this task was wrong and is corrected here**: the brief named `editor-pane-bar.spec.ts`, which the rail replaced at `c6ee8d32`; the case it meant is `editor-rail.spec.ts`'s "shows the theme's own panel in the left column, and swaps away from it". The Assets pane the bullet names also no longer exists as a slot — the declared-asset library renders inside the **Add** pane's body — so the case proves the surviving host rather than the pane the bullet named, which the annotation says.
- [x] **Step 2: The once/twice case is PROVED as the bridge stands.** `bridge.dom.test.ts` carries no such case at all, and an unproved verification bullet is the defect whether or not the behaviour is fine — and if reading the bridge's contract shows it no longer carries entering-twice, the bullet is annotated as superseded rather than a test invented for a contract that is gone. **Done, and it is the supersession path**: `bridge.ts`'s `enterGroup` is one hop and holds no context, so the bridge has no guard to defeat, and the property is the manager's — `setContext([entry])` is single-element by construction, so a two-copy context is unrepresentable rather than refused. It is proved where it lives, at `entered-group-state.dom.test.ts`'s "leaves one level when the same group is entered again".
- [x] **Step 3: The selection bullet is DISCHARGED by the browser case that already covers it**, and the bullet is annotated to name where its proof lives, because a unit test is not owed where the panel cannot accept a selection by construction. **Done, and the bullet had two halves rather than one**: the with-a-selection half is `composition-panel.spec.ts`'s "keeps the document's own controls reachable while a card is selected", which selects `group-cpu-card`; the tokens-and-presets half is not an unowned gap but a capability the user removed, gone with the archived `verified` row `vg-474`, which the annotation now records.
- [x] **Step 4: Close it.** A bullet is a claim, and a claim is discharged by pointing at its proof or by correcting the claim — never by leaving it standing. **Done**: all three annotations are additive on the archived plan, the bullets still read as written, and the independent review's four findings were all about the notes' precision — a supersession that read as denying a guard that exists, a pane named as covered without saying it had been dissolved, a half-bullet left looking unowned, and three overflow heights a second measurement contradicted, now removed because the case's own guard is the load-bearing claim. `vg-159` is verified.

### Task 22.7: One fixture raises both gaps

**OBSTRUCTED 2026-10-18 by the user's own ruling in Phase 25 — do not execute this as written.** Task 25.7
removed the crop notice and the bleed mark, because the user ruled "BOTH, EVERYWHERE". So a document that
bleeds no longer raises a strip at all: the composition gap this task exists to make legible has no surface
left to be legible on, and "one fixture raises both gaps" cannot be built. `vg-191` therefore lost its
subject rather than half of it, and it is the **user's** to withdraw or re-point (STATUS carries it as a
pending decision) — an agent may not withdraw a register row. What is left of the row is its data-gap half,
which Task 22.9's neighbours and the existing fixtures already cover. **This task resumes only if the user
re-points `vg-191` at a surface that still exists**; until then Phase 22 runs 22.6, 22.8, 22.9 and 22.10 and
skips this one.

**Files:**
- Modify: `src/web/tests/e2e/` fixtures

**Interfaces:**
- Produces: `vg-191` closed — **no longer achievable as written**; see the note above.

- [ ] **Step 1: Add one document that both bleeds and binds a key the host cannot report.** The requirement's rationale is that an unreadable sensor and a cropped object must be legible as DIFFERENT things, which is why two strips may be on screen at once.
- [ ] **Step 2: Today's two-strip assertion passes with a transport gap standing in for the composition gap**, which is a different pair — so the fixture inventory is the entry it is missing, against a requirement that already exists.
- [ ] **Step 3: Close it**, with the fixture shown to raise both strips at once.

### Task 22.8: The insert driver names the family it inserts

**Added 2026-10-16**, homing `vg-537`, which was filed the same day by Task 15.5's seat. It belongs to
this phase because it is a **test driver**, and the phase's own subject is the proofs the plans owe.

**Files:**
- Modify: `src/web/tests/e2e/rebuild-driver.ts` (`insert`)

**Interfaces:**
- Produces: `vg-537` closed

- [x] **Step 1: The code and its comment disagree, and the comment is the wrong one.** `insert` takes `button.last()` when a label matches twice, while the comment above says *"'Line' is a shape and a chart, and the legend above each is what tells them apart"*. **Taking the last match is an ordering assumption, not the legend** — a caller asking for the shape's Line silently gets the chart family's, and the helper's own poll is satisfied either way because the scene grew by one. **Done, and the seat read the pane first**: `insertGroups()` emits groups by `kind`, `AddPane` renders each as a `<fieldset data-vigilia-add-group={kind}>` with a legend, and the order is Cards, Text, Shapes, Charts — which is exactly why `.last()` returned the chart. Text is the exception, drawn in no fieldset because its `groupOf` returns `undefined`.
- [x] **Step 2: Address the tile by its legend or its group**, so the family is named rather than inferred — or take the family as a parameter and make the ambiguous call a type error. **`.first()` is not the fix**: it has the same defect mirrored. **Done, by the parameter route**: `insert(page, label, group: AddGroup)` and `addButton` now require the group, so `tsconfig.e2e.json` — wired into `typecheck`, which `gate` runs — enforces it rather than merely intending it. The legend is copy (`uiCopy.panels.*`) and `data-vigilia-add-group` is the stable hook, so the group is the thing that can be named.
- [x] **Step 3: Read the Add pane's structure rather than reordering its tiles**, and prove the driver red by asking for the shape's Line and asserting the inserted object's kind. **Done, and the red proof fails on the kind rather than a count** — which is the whole point, since a count is what the defect satisfied either way: with the addressing reverted the case reports `Expected: ["line","vigiliachart"]` against `Received: ["vigiliachart","vigiliachart"]`, on the Fabric type tag, while the driver's own scene-grew-by-one poll passed. The fix also caught a **live instance**: `addChart` was inserting through the ambiguous path, and `inspector-sections.spec.ts`'s Line-endpoint case had been hand-rolling the click to work around it. Every call site was found tree-wide — `tests/e2e/` sits outside every package, so a `packages/`-scoped search would have missed them.
- [x] **Step 4: Close it.** **Done, with the one gap the review found written down rather than left in a report**: the `"text"` scope is the whole pane, because text is the one object drawn in no fieldset, so a card ever labelled `Text` would give the lookup two matches — and it would fail **loudly**, as a Playwright strict-mode violation, rather than as the silent wrong insert this row was about. The note names the mechanism, the failure and what holds it today (`uiCopy.cardLibrary` carries no `Text`). `AddGroup` is a documented hand-copy of `InsertableObject["kind"]`, which the review confirmed is the right trade: the editor exports only its barrel, a deep import is `TS2307`, and the relative path breaks the e2e program on `lucide-react`'s `.mjs` icons. `vg-537` is verified.

### Task 22.9: The copy walk probes the functions it cannot enumerate, and mounts four surfaces it does not read

**Added 2026-10-17 at Phase 20's close**, homing `vg-417` and `vg-418`. Both were found by Task 7.1's
review on 2026-10-13 and both are the copy walk's — one instrument, two holes — which is why they are
one task and not two.

**Files:**
- Modify: `src/web/packages/editor/src/ui-copy.ts` (the refused kinds, exported), `src/web/packages/editor/src/ui-copy-readers.ts` (the probe and the reader), `src/web/packages/editor/src/ui-copy.test.ts` (the table's rules), `src/web/packages/editor/src/ui-copy-surfaces.test.ts` (the surface walk)

**Path corrected 2026-10-18 by the controller, before the seat ran**: this task and both rows named a single
`ui-copy.test.ts`, which is the table's own rules (sentence case, pictographs, menu rows) and neither hole.
The walk is three files — `ui-copy-readers.ts` holds `copy()`, `ui-copy-surfaces.test.ts` holds the surface
walk and the header stating the four unmounted surfaces, `ui-copy-panels.test.ts` holds the imperative panels
and the picker. The plan's path (`editor-shell/ui-copy.test.ts`) does not exist; the rows' OWNER field is
stale in the same direction. Neither row's defect is affected — `vg-417` is still `copy()`'s argument list and
`vg-418` is still the four unmounted surfaces. **The landed commit touches four files**, and the list above is
the corrected one: `ui-copy-panels.test.ts` needed no change, and `ui-copy.ts` and `ui-copy.test.ts` did.

**Interfaces:**
- Produces: `vg-417` and `vg-418` closed

- [x] **Step 1: `vg-417` — the probe, not the module.** `copy()` calls each exported copy function with generic arguments to enumerate the strings a surface could print, and a function whose result depends on a key cannot be enumerated that way: `glassRefusals` and `chartFamilyLabels` take a key and are never collected. The consequence's direction is the safe one — a surface printing one of those strings reads as a literal with no owner, so the walk goes falsely **red**, not falsely green — which is why the row is low and why it still needs fixing: a net that reddens on a correct surface is one a reader learns to ignore. **Done, and the row's second function was stale**: `chartFamilyLabels` is `uiCopy.chartFamilies`, so the object walk already collects `Gauge`, `Line`, `Bar` and `Pie`. The fix is a second pass over `glassRefusalKinds`, exported from `ui-copy.ts` as `Object.keys(glassRefusals)` — derived from the table, not a second list — so a kind added to the table is probed without anyone remembering to add it. The red proof is the strings, not a count: with the pass disabled, `ui-copy.test.ts` exits 1 on `AssertionError: Polyline: expected [ 'Vigilia', 'Editor panes', …(452) ] to include 'A Polyline is an open path, so there …'`. **And the review found the same defect one paragraph above the fix**, for arity rather than keys: the probe passes one argument, so `panels.artboardOutside` and `draftRecovery.lead` are collected by nothing — widening the pool cannot close it, because a sentence interpolating the theme's own name can never equal a probe's output, so `copy()`'s docblock now states that limit instead of claiming a superset, and the hole is filed as `vg-592`.
- [x] **Step 2: `vg-418` — the four surfaces the walk does not mount.** It mounts the shell, the Settings Appearance/Keyboard/About tabs, the canvas context menu, the opened menu popups and the colour picker, and not the `?` shortcut sheet, the publish popover, the library dialog or the new-document dialog. A literal in one of those is owned by nothing. **The header is not the fix** — it now states these four are not mounted, and a comment can vanish silently where a mount cannot. **Done, all four mounted** through `READ_SURFACES`, each read over `body` where a `Dialog` and a `Popover` portal, each asserting non-empty before its words are compared so a mount that renders nothing reddens rather than agreeing with nothing, and the list's length guarded so a dropped mount takes its read with it. **All four were reachable in jsdom** — `vg-215`'s finding is about a popover's close, not its open — which answers the row's own "not established". The vocabulary grew to reach them: `spokenIn` now reads `h1`–`h6` and `dt`, which is how the sheet's heading, its six group names and every row label are read. **One limit is stated rather than implied and is filed as `vg-591`**: the popover is mounted and read for two words only, because its warning is a bare `<span>` no reader reads and its trigger carries the `aria-controls` the button rule skips.
- [x] **Step 3: Close both**, with a case that fails when the keyed enumeration is disabled and one that fails when a mount is removed. **Done, both reproduced on the integrated tree and restored with `cmp` and a SHA-256 rather than with git**: disabling the keyed pass reddens `ui-copy.test.ts`; dropping the new-document entry reddens the surfaces case with `expected [ { …(2) }, { …(2) }, { …(2) } ] to have a length of 4 but got 3`; and emptying the library mount reddens it with `the library dialog: expected [] to not deeply equal []`. `npm run gate` exit 0 on the integrated tree — 264 test files, 3487 tests. Both rows verified. The review's three further findings are filed as `vg-591` (the reader's vocabulary), `vg-592` (the one-argument probe) and `vg-593` (the selection lead's refusal paragraph, which prints a table sentence no net reads); the seat's own finding about the library dialog's literals is `vg-594`.

### Task 22.10: A built bundle has no fixture page, and the drawings specs read that as a product regression

**Added 2026-10-17 at Phase 20's close**, homing `vg-438`, found by the controller on 2026-10-13 while
reading the acceptance section's verdicts.

**Files:**
- Modify: the build scripts, or the fixture-mounting specs' own precondition

**Interfaces:**
- Produces: `vg-438` closed

- [x] **Step 1: The trap, measured rather than argued.** `npm run build -w @vigilia/editor` exit 0 leaves `packages/editor/dist` holding `assets/`, `favicon.svg` and `index.html`; `npm run build:fixture -w @vigilia/editor` exit 0 then adds `control-fixture.html`. So a whole-suite browser run against a bundle built by `build` alone fails the fixture-mounting `design-language-*.spec.ts` specs as a missing page and reads as a product regression. **Reproduced on the integrated tree, and the row's own premise corrected**: the failure is not a 404 — `vite preview` defaults to `appType: 'spa'` and answers `/control-fixture.html` with **200** and `text/html` serving `index.html`, measured as `has #control-fixture: false`, `has #app: true`. So a status check would have been a guard that cannot fail, and the check keys on the fixture's own `#control-fixture` marker instead — static markup `index.html`'s `#app` is not.
- [x] **Step 2: The cause is deliberate and documented**, in `packages/editor/vite.config.fixture.ts`: the fixture is a second invocation rather than a second `rollupOptions.input` so the production build emits exactly the bundle graph it emitted before the fixture existed and does not ship test scaffolding. **So the fix is not to fold the fixture into the production build** — it is to make the missing page say so, or to make the run produce it. **Taken: make it say so, in the one opener.** `openFixture` in `tests/e2e/design-language-readers.ts` is the single opener all three fixture-mounting specs share (`design-language-contrast`, `-controls` and `-layout`, through `prepareControls`), so the check is scoped to exactly the specs that need the page. The process-wide `tests/e2e/global-setup.ts` was rejected with the reason: it would refuse every spec including host, player, snapping and glass specs that never open the fixture. **`glass-authoring` and `snapping` are not consumers** — each defines its own local `openFixture` that builds its own page into the root preview.
- [x] **Step 3: Close it**, by running the whole suite against a `build`-only bundle and reading what the fixture-mounting specs report. **Done on the integrated tree, against a `dist` built by `npm run build` alone**: `npx playwright test tests/e2e/design-language-controls.spec.ts --project=desktop-chromium --workers=1 --grep "the control set renders in the design language"` exits 1 with the named cause and the recipe, thrown at `openFixture` through `prepareControls`; after `npm run build:fixture -w @vigilia/editor` the same command exits 0 with 1 passed. `npm run gate` exit 0. `vg-438` is verified. **The verification itself produced a finding**: the first red-proof attempt read `1 passed` because a preview server left running by the seat's own worktree was answering the shared 4174 port over *that* worktree's `dist` — `reuseExistingServer: true` — so the controller measured somebody else's bundle. Killing it and re-running reddened correctly. That is filed as `vg-595`, and it is the second time this phase has caught a false result by re-running rather than by reading.

---

# Phase 23 — W18: the host, the schema, the persisted model, and the records

**Outcome:** the ten ruled rows whose owner is the host, the published schema, the persisted model or a
document are landed — `lanAddress` prefers the default-route interface, a LAN move cannot deadlock, the
schema refuses an empty theme name, the chart validator refuses at the envelope boundary, and five records
say what they were ruled to say. **Task 23.11 adds an eleventh, `vg-409`, added 2026-10-17 at Phase 20's
close: an over-large theme file is answered as absent.**

**Why a phase of its own.** Nine of the ten are one of two things: a `host/src/` behaviour, or a document
stating a fact the repo relies on. They share no file with Phases 18–22, and two of them (`vg-171`,
`vg-174`) are the only host rows in the whole triage.

**Owners:** `host/src/cli/net.ts`; `host/src/cli/hosting.ts`; `schema/theme-document.schema.json` and the
loader's migration; `renderer-core/src/charts/` (the validator, with `settings-fields.ts` read as the
owner); `docs/architecture/ownership.md`; `THIRD-PARTY-NOTICES.md` and
`docs/engineering/dependencies.md`; `docs/adr/README.md` and `docs/decisions/README.md`; a new decision
note for `vg-366`; and wherever the live indicator's contract is written.

**Constraints:** **queued behind Phases 12 and 15–22.** **`host/src/server.ts` and
`renderer-core/src/charts/` are on the reuse gate's watchlist**, so Tasks 23.2 and 23.4 land a decision
note before their first write. **[Corrected 2026-10-18: the pairing is wrong for Task 23.2 and right for
23.4.** Task 23.2's files are `cli/hosting.ts` and `cli/net.ts`, neither on the watchlist, and `covers()`
matches exact paths — so its writes went through clean and no note was owed; the review proved it by piping
a `tool_input` naming `cli/hosting.ts` into `scripts/reuse-gate.mjs` and reading exit 0, with
`providers/clock.ts` exiting 2 as the control. `server.ts` is still watchlisted, and nine existing notes
already claim it, so a correction *to* it is free — Task 23.2's seat believed otherwise and left a stale
comment standing until the review measured the gate.**]** **`vg-221` must not make a document that validates today unloadable**: the
schema refuses an empty name and the loader names what it finds unnamed, in one commit. **`vg-174`'s fix
is decided by the repo's own rule rather than by taste** — answering from `state()` before the move
settles would have the host assert something it knows to be stale.

**Acceptance:** each row's own `check` passes; `vg-171`'s ranking is data beside the function and logs the
alternatives when two candidates survive; `vg-174`'s deadlock has a case that fails when the fix is
disabled; `vg-221`'s migration is proved against a stored document carrying an empty name.

**Failure modes:** deleting a decision that still governs (`vg-198`); widening the ownership sweep instead
of correcting its claim (`vg-184`); making the schema refuse a document the loader then cannot read.

**Verify:** `npm run gate` (exit code read from `$?`); the host's own tests for Tasks 23.1 and 23.2; the
schema's sync test for Task 23.3.

### Task 23.1: `lanAddress` prefers the default-route interface

**Files:**
- Modify: `host/src/cli/net.ts` (the ranking as data beside the function)

**Interfaces:**
- Produces: `vg-171` closed

- [x] **Step 1: The rule, in order.** Drop loopback, link-local and internal candidates; drop interfaces whose name matches a virtual-adapter pattern (Hyper-V and `vEthernet`, WSL, Docker and `br-`, VirtualBox, VMware, and the tunnel adapters a VPN installs), because those are exactly the ones a phone cannot reach; among what remains prefer the interface carrying the default IPv4 route, since that is the address the phone's own traffic leaves by. **Done, and the review attacked the pattern list rather than reading it**: 37 real adapter names tried, zero over-drops, and the `tun|tap|utun|ppp|wg` entry is anchored so it matches whole tokens only — but it found four measured **under**-drops (Windows' virtual Wi-Fi adapters, its ISATAP/Teredo/6to4 pseudo-interfaces, Linux's `tunl0` and its other kernel tunnel stubs), which the fix round added as four lines and four cases. **The route is read through `systeminformation`, already a shipped host dependency** — Node exposes no routing table, and the review confirmed Node exposes no interface index either, so "lowest interface index" is forced to mean "first enumerated" rather than chosen.
- [x] **Step 2: When two candidates survive and neither carries the route, keep the choice DETERMINISTIC** (lowest interface index) and log the alternatives — the failure this row describes is invisible on the machine that makes it, so the alternatives being on the record is what makes a wrong pick findable without a phone. **Done — and the review refuted the guarantee behind it.** The docblock claimed a failed route query yields `undefined`; measured with `execSync` blocked, `systeminformation` returns a **name of its own** (this machine: `"Npcap Loopback Adapter"`), so `readLanSource` cannot tell a read route from a fallback and the warning is suppressed on exactly the machine where a wrong pick is invisible. The docblock now states that measured mechanism and claims no detection, and the gap is filed as `vg-596`. The cost is filed too: that read is an `execSync` `netstat -r` — 126-149 ms of blocked event loop plus a child process — on every `GET /api/hosting` (`vg-597`). The fix round also made `readLanSource` **total**, since `HostBinding.state` is async now and `server.ts` reaches it through `void handle(...)` with no catch, so a throw there was an unhandled rejection rather than a refusal.
- [x] **Step 3: The pattern list is data, owned beside the function**, so a new virtual adapter is a one-line addition rather than a new heuristic. **Done**: `VIRTUAL_ADAPTER_PATTERNS` is fourteen anchored patterns beside `rankLanAddresses`, each with the adapter family it names, and the fix round's four additions are exactly the one-line shape the ruling asked for.
- [x] **Step 4: Close it.** **Done, with the proof a fixture rather than the machine**: `rankLanAddresses` takes a `LanSource` and `readLanSource` is the only reader of the real OS, so the cases carry a virtual switch and a link-local pseudo-adapter ahead of a physical NIC, a default route that is not the first candidate, a tie-break that names its alternatives, the single-adapter no-regression case and the console warning. With the ranking swapped back to the old loop, `npx vitest run packages/host/src/cli/net.test.ts` exits 1 with **5 failed / 9 passed of 14**, reproduced by the controller on the integrated tree with the restore proved by `cmp` and a SHA-256. `npm run gate` exit 0 — 265 test files, 3501 tests. `vg-171` is verified, and the seat's trailer about four e2e specs carrying their own copy of the old rule is `vg-598`.

### Task 23.2: The LAN move does not wait on a request

**Files:**
- Modify: `host/src/cli/hosting.ts` (`move()`)

**Interfaces:**
- Produces: `vg-174` closed

- [x] **Step 1: Destroy the remaining connections rather than letting `server.close` wait for them.** `move()` calls `closeIdleConnections()` and then `server.close(cb)`, and close waits for ACTIVE connections — so a GET arriving during the move blocks the callback, the move blocks the GET, and the host never listens again. That is a deadlock reachable by any second client, not a race. **Done — `closeAllConnections()` replaces `closeIdleConnections()` and nothing else about the move changed.** **The reachability argument the seat offered was refuted by the review, which then built the case**: a socket mid-request at the move moment is *spared* by `closeIdleConnections()`, goes idle-and-alive, and a **second** request on it parks on `idle()` — so the row's mechanism is reachable after all, and the case reproduces it. **No decision note was needed and none was written**: `cli/hosting.ts` and `cli/net.ts` are not on the watchlist, `covers()` is exact-path, and every write went through the gate clean — which is the proof. The Phase 23 constraint pairing `server.ts` with this task is wrong for it.
- [x] **Step 2: Accept the trade `vg-173` already measured**: whichever request was unlucky gets an empty reply, and its bounded re-read recovers. Do **not** answer from `state()` before the move settles — that would have the host assert something it knows to be stale. **Done, and the trade is smaller than the comment it replaced claimed**: the move starts on `response.once("finish")`, so the asking PUT's bytes are already with the OS before any socket is destroyed, and its `200` arrives with the fix absent too. The review measured that rather than reading the assert, and also measured a pipelined PUT+GET on one socket arriving whole. The rejected branch was not taken.
- [x] **Step 3: Close it**, with a case that fails when the fix is disabled. **Done, and the case was replaced once the review showed the first one proved a weaker thing.** The landed case parks a second request on the socket the move spared, and the proof is that arrangement failing when the fix is disabled: reproduced by the controller on the integrated tree, `npx vitest run packages/host/src/server.test.ts -t "does not leave a request parked"` exits 1 with `AssertionError: expected { ended: false, controlAnswered: true } to match object { ended: true }` — the socket alive and dispatching while `/api/hosting` never answers — and the restore is proved by `cmp` and a SHA-256. `npm run gate` exit 0 — 265 test files, 3502 tests. `vg-174` is verified, and what it leaves is filed: `vg-599` (the pruning machinery is production-dead and decision 0070's paragraph justifies a capability nothing invokes) and `vg-600` (whether a display's SSE stream still ends gracefully, since the move destroys the socket just after the stream closes).

### Task 23.3: The schema refuses an empty theme name

**Files:**
- Modify: `schema/theme-document.schema.json`; the loader's migration

**Interfaces:**
- Produces: `vg-221` closed

- [x] **Step 1: `metadata.name` gains `minLength: 1`**, because a theme with an empty name cannot be presented in the library. **Done — `$defs/metadata/properties/name` reads `{type: string, minLength: 1, maxLength: 200}`, and the sibling definitions it was inconsistent with are unchanged.** The bound was unguarded until this task: the review measured that `envelope-keys-disagreement.test.ts` compares key sets alone and `fabric-envelope-schema-sync.test.ts` had never asserted this property, so a case in the latter now pins both bounds. **Nothing in this repo runs the schema** — no `ajv` anywhere in `package-lock.json`, and the only in-repo readers of the file are test files — so the bound is a contract for tools outside the repo, which is `vg-601`.
- [x] **Step 2: The loader names what it finds unnamed** — from the file, or a generated label — because a stored document that validates today is not allowed to become unloadable. **Done, and both halves are in one commit.** The owner is `namedEnvelope` in `renderer-core/src/theme/envelope-semantics.ts`, applied by `validateFabricThemeEnvelope` — the place a document becomes an envelope whatever brought the bytes, which the review traced through the host's stored `theme.json`, its list and document routes, the player's `loadHostedTheme`, package import/export and the editor's mount. **The label is the document's own `id`**, persisted with the document and so stable across loads, and the `stableId` behind it is what the validator already requires (the review measured `no-id`, `empty-id` and `space-id` all failing validation), so the label can never be empty. **The cost is accepted as the ruling states it, with one difference worth naming: this is a repair, not a refusal** — a PUT carrying `name: ""` is stored with the id, so the host's behaviour and the published contract differ. That is `vg-601`.
- [x] **Step 3: Close it**, with the migration proved against a stored document carrying an empty name. **Done — the case writes a real `theme.json` with `name: ""` into a temp library and reads it back through `store.read` and `store.list`, and it fails when the naming is disabled**: reproduced by the controller on the integrated tree, exit 1 with `AssertionError: expected '' to be 'nameless'`, restore proved by `cmp` and a SHA-256 rather than by git. **The review found the first version of the migration threw on `name: null`** — `metadata.name !== undefined` lets `null` through and `null.length` throws out of the loader, which is the same "a document that validated before does not load now" failure the migration exists to prevent, and `ThemeStore.list`'s catch turned one such document into an empty library beside a valid one — so the guard reads the name as a string, its own case reddening the same way (`TypeError: Cannot read properties of null (reading 'length')`). Three comments asserting the schema permits an empty name were corrected with it, and the migration case's own comment, which claimed the library line named the theme by its id before the migration existed when `entryFor`'s `??` does not fall back on `""`. `npm run gate` exit 0 — 265 test files, 3506 tests. `vg-221` is verified; the runtime's missing twin of both bounds is filed as `vg-601`.

### Task 23.4: The chart validator refuses at the envelope boundary

**Files:**
- Modify: `renderer-core/src/charts/` (the validator)
- Read: `charts/settings-fields.ts` as the owner of each scalar's range

**Interfaces:**
- Produces: `vg-348` closed

- [x] **Step 1: The validator READS `settings-fields.ts`'s own `min`** (`windowSeconds` 1, `maxPoints` 2, `lineWidth` and `markerSize` 0) rather than re-deciding it, which is what the deleted v1 validator did — deleting it removed the refusal without moving the ownership anywhere. `settings: ["windowSeconds"]` is the third shape of the same rule: the allowed key set is the descriptor table's own reading, not a list the validator keeps. *(Landed: `theme/fabric-envelope-validate.ts` `chartSettings`/`chartScalars` read `CHART_SETTINGS_FIELDS`/`CHART_PAINT_FIELDS`; the allowed key set is `path?.[0] ?? property` over both tables. `lineWidth: -1`, `windowSeconds: 0` and `maxPoints: -5` refused; a non-object `settings` refused as `wrong-type`, an unknown key as `unknown-field`. Decision note `0082`, and `settings-fields.ts`'s own header section now states the same thing — "The validator reads this table" — with a dated pointer added to `ADR-0028`, whose `:78-80` position this reverses.)*
- [x] **Step 2: The relational cases are the pair's own descriptor.** `min` above `max`, and `innerRadiusPercent` at or above `outerRadiusPercent`, are a PAIR the family's descriptor owns, so they are refused where the pair is complete rather than by a range on either half. *(`scalarPairs` asks whether the family declares **both** a `min` and a `max` descriptor — gauge, bar **and `line`**, the table's reading rather than a family list — and refuses the crossed pair only when both halves are present and finite; pie's `innerRadiusPercent` ≥ `outerRadiusPercent` is the one pair with two names of its own. `pieTotal` adds the fixed-total value: absent is `missing-field`, non-finite is `wrong-type`. The `line` widening was re-measured against every `theme.json` on disk: no verdict changed.)*
- [x] **Step 3: The pie's render-time clamp STAYS** as defence for the in-memory path that never passes through the envelope, but it stops being the only thing between an impossible document and a drawing — a clamp at render is the authored-versus-derived disagreement made invisible. *(`charts/pie.ts`'s `clampPercent` untouched; no comment added because none there claims to be the guarantee.)*
- [x] **Step 4: Close it**, with a document carrying `min` above `max` refused on load. *(Register rows `vg-348` and `vg-674` moved to `backlog-archive.jsonl` as `verified`; regression cases in `fabric-envelope-validate.test.ts`, red when the refusal is reverted (5 failed / 39 passed, restore confirmed with `cmp`); every `theme.json` on disk re-validated with the same verdict as before.)*

### Task 23.5: The indicator's staleness is stated as a boundary

**Files:**
- Modify: wherever the live indicator's contract is written (the `HostingStore` docblock and the editor's host-connection notes)

**Interfaces:**
- Produces: `vg-214` closed

- [ ] **Step 1: Record the ruling where the contract lives.** No poll — the host pushes, or the editor is the session's only writer; an editor polling the host would be a timer the host owns, per this repo's own boundary, and it would race the editor's own writes. The editor is the only in-session writer by design.
- [ ] **Step 2: Name the direction for when the staleness is judged worth fixing**: the host announces the change on the connection the editor already holds, and the store re-reads. The editor never polls.
- [ ] **Step 3: Close it.** This is a stated boundary, not a feature.

### Task 23.6: `locked` gets the record it lacks

**Files:**
- Add: a decision note under `docs/decisions/`
- Modify: the ownership map's entry for `scene-fabric/src/persist.ts`

**Interfaces:**
- Produces: `vg-366` closed

- [ ] **Step 1: The behaviour is already decided and stated in code** — `object-lock-manager/index.ts:92-94` says undo rebuilds the scene, so a revived locked object is a new instance at Fabric's defaults, `locked` is the persisted state, and the transform flags are re-derived from it rather than persisted alongside it. `onHistoryLoaded` is the re-derivation. **The missing thing is the RECORD, not the behaviour.**
- [ ] **Step 2: `selectable` and `evented` beside it in `SCENE_PERSISTED_PROPERTIES` are NOT covered and are not the same case** — the lock writes `hasControls` and the `lock*` flags and never those two. Name that question in the map entry rather than answering it.
- [ ] **Step 3: Close it against the note.**

### Task 23.7: The provenance files declare their convention

**Files:**
- Modify: `THIRD-PARTY-NOTICES.md`; `docs/engineering/dependencies.md`

**Interfaces:**
- Produces: `vg-178` closed

- [ ] **Step 1: Declare whether the rows are direct dependencies only or the installed closure**, in the file that owns the convention, and apply it to whichever dependency ships next. The risk has not gone with the dependency the row was filed on: the next shipped package arrives with the same unstated rule.
- [ ] **Step 2: Record that the row's original premise is discharged** — `grep -rn radix` over every `package.json` in the workspace returns nothing, because `ADR-0038` took the popover and its eighteen siblings out of the manifest. The row closes on the convention, not on the removal.
- [ ] **Step 3: Close it.**

### Task 23.8: `docs/adr/` is a closed series

**Files:**
- Modify: `docs/adr/README.md`; `docs/decisions/README.md`

**Interfaces:**
- Produces: `vg-198` closed

- [ ] **Step 1: A header in `docs/adr/README.md`** saying the series closed at 0010 on 2026-09-25 and its numbers are its own. **Do not merge, remove or renumber**: the two series collide across 0001–0010 and both hold a 0004 on a different decision, so a merge renumbers one and breaks every citation to the other.
- [ ] **Step 2: A citation convention that always writes the directory** (`adr/0004` against `decisions/0004`), and one line in `docs/decisions/README.md` accounting for the 0011–0018 gap so the next reader does not go looking for it.
- [ ] **Step 3: Close it.**

### Task 23.9: The ownership sweep's claim is corrected

**Files:**
- Modify: `docs/architecture/ownership.md` (the sweep's description, beside the lesson at `:48`)

**Interfaces:**
- Produces: `vg-184` closed

- [ ] **Step 1: Do NOT widen the sweep.** `ownership.md` says it finds every exported id vocabulary when it cannot see a type union or a dotted id, and that reads as verification while being none — the same shape as `vg-111` and `vg-380`.
- [ ] **Step 2: The doc states the boundary instead**, because a gate widened to flag most of the tree is ignored, which `:48` already records as the hard-won lesson.
- [ ] **Step 3: Close it.**

### Task 23.10: The scratch directory leaves the tree

**Files:**
- Move: `src/web/.agent-scratch/` (eight files) to a location outside the tree

**Interfaces:**
- Produces: `vg-368` closed

- [ ] **Step 1: Relocate the directory outside the tree**, so the filesystem skew ends for every scanner at once — a gitignore rule hides a directory from git, not from a walk.
- [ ] **Step 2: The eight files — browser probes, screenshots and a vitest report that may be the only copy — are kept rather than deleted.**
- [ ] **Step 3: Close it**, showing a filesystem walk no longer sees the directory.

### Task 23.11: An over-large theme file is answered as absent

**Added 2026-10-17 at Phase 20's close**, homing `vg-409`, found by Task 5.3's reviewer on 2026-10-13.

**Files:**
- Modify: `src/web/packages/host/src/themes/store.ts` (`readStored`, `readStoredOrAbsent`)

**Interfaces:**
- Produces: `vg-409` closed

- [ ] **Step 1: The cause is established and its landmarks were re-read at this task's authoring.** `readStored` (`:494`) returns `undefined` when the file exceeds `MAX_THEME_FILE_BYTES` (`:163`, 32 MiB) — before validation runs — and `readStoredOrAbsent` (`:522`) folds that into the same absence the listing and the write path use. So `bootTheme` returns `none` and the editor mounts the template under a success report over a theme it never opened: the visible defect `vg-110` fixed, one trigger over.
- [ ] **Step 2: The size bound's own comment says the choice is deliberate** — "an over-large document is not a validation failure, and naming it one here would be a different decision" — so the fix is not to reclassify it as one. What the choice costs is that a refusal by size is indistinguishable from a file that is not there, and the task is to make the two distinguishable without changing which one it is.
- [ ] **Step 3: Close it**, with a case that fails when the size branch is folded back into absence, and one browser reading of the editor booting against an over-large file.

---

# Phase 24 — W19: the two rows the user ordered ahead of the triage

**Outcome:** the only two open rows no phase named — `vg-388` (an in-app store) and `vg-405` (the colour
picker and the gradient editor) — each have a phase, a spec and the design decision their own rulings say
they need before code.

**Why these two and no others, and why they are numbered last but run first.** They are the two
`source: user` rows among the orphans, and **the user's own words put them ahead of everything else the
triage touches**: `vg-405`'s ruling is *"SCHEDULED AHEAD OF THE TRIAGE, and it enters a phase. It is a
defect rather than a wish … so it is fixed, not parked. It and `vg-388` are the two user-sourced rows
among the 95 and both move ahead of the rest."* The number is an identifier rather than a position, the
same way task numbers are — the order is stated here and in §1.

**Both are gated on their own spec's acceptance, and neither is gated on anything else.** `vg-405`'s own
route is explicit: *"the rebuild touches `DESIGN.md`'s section 5 control vocabulary, so it needs a design
decision before code, and it is not part of the active plan (the backlog drain), so it takes its own spec
and plan rather than a task inside another."* `vg-388`'s spec says the same of itself: *"not accepted
work: `STATUS.md` alone decides acceptance, and nothing here is the active plan."* **So each task's first
step is the user's word on a written spec, and the drain does not write either plan before it.**

**Owners:** `docs/superpowers/specs/2026-10-12-theme-store-design.md` and
`docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md`; then, after acceptance, the
store's own packages and `DESIGN.md` §5's control vocabulary with the picker and gradient-editor
components.

**Constraints:** **ordered ahead of Phases 15–23 and behind Phase 12**, and one phase is active at a
time. **Neither spec is accepted, so neither task may start with code.** A task that touches
`DESIGN.md` §5 needs a decision note before its first write, and `vg-405`'s rebuild does. **The store's
three kinds are already decided** — the user ruled on 2026-10-15 that the store carries dashboard themes,
widget presets and editor themes, and that v1 ships the dashboard theme only because it is the only kind
with an exchange unit.

**Acceptance:** each row closes on the phase that lands its change, with a `check` naming a word from its
own `title` and `artefacts` naming a resolvable ancestor sha; `vg-388`'s store carries all three kinds as
specified rather than the theme half alone; `vg-405`'s rebuild carries the research pass the row asked for
as its own evidence rather than as a verdict.

**Failure modes:** starting either build before its spec is accepted; reading `vg-388` as the theme half
only, which the 2026-10-16 revision explicitly supersedes; treating `vg-405`'s usability verdict as a
measurement, when the row's own text says the user *"gave a verdict, not a measurement"*.

**Verify:** the spec review is the user's; after acceptance, each task names its own gate command and
that command's exit code, and the browser suite separately on a rebuilt bundle.

### Task 24.1: The store, and the three kinds it carries

**Files:**
- Read: `docs/superpowers/specs/2026-10-12-theme-store-design.md`
- After acceptance: the store's own packages; `host/src/themes/store.ts` as the existing bounds owner

**Interfaces:**
- Produces: `vg-388` closed

- [ ] **Step 1: The user accepts the spec, or names what changes.** It is `Status: draft`, revised 2026-10-16 after the `hydralauncher/hydra-themes` study, and it is scoped **storefront-now, kinds-follow**: v1 ships the dashboard theme because it is the only kind with an exchange unit today.
- [ ] **Step 2: Its plan is written by `writing-plans`, not here** — the same rule Phase 12's `vg-330` runs under, and the reason this phase's tasks are gated rather than scheduled.
- [ ] **Step 3: The two addenda are its remaining design work, and each is a decision rather than a build.** A widget preset is a theme envelope minus the artboard — a scene subtree plus its `bindings`, `globals` and `assets` — and `§139` still defers widget packages until an authoring workflow exists. **An editor theme has no artifact at all today**, and that is a decision rather than a gap: `§35` separates editor-shell theming from authored dashboard theme globals, so its addendum must settle what the artifact is before the store can carry it.
- [ ] **Step 4: Close `vg-388`** when the store lands, with a check naming the row's own subject.

### Task 24.2: The picker and the gradient editor, rebuilt

**Files:**
- Read: `docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md`
- After acceptance: the picker and gradient-editor components; `DESIGN.md` §5's control vocabulary

**Interfaces:**
- Produces: `vg-405` closed

- [ ] **Step 1: The research pass the row asked for is the spec, and it is written.** The row's own closing terms are a research pass naming what established tools do, an assessment of each component against that set with `file:line` evidence, and then the rebuild or the amendments that follow. **The user accepts the spec, or names what changes.**
- [ ] **Step 2: The rebuild touches `DESIGN.md` §5's control vocabulary, so it lands a decision note before its first write** — the row's own route, and the reason it takes its own spec and plan rather than a task inside another.
- [ ] **Step 3: One sub-claim is already corrected on the row and must not be re-fixed**: `gradient-editor.tsx`'s raw literal is gone (`61e33eef` moved the ring to `var(--edge)`), so that instance no longer stands — the usability verdict and the rebuild ask do.
- [ ] **Step 4: Close `vg-405`** when the rebuild lands, with a check naming the row's own subject.

---

# The rows no phase carries — the drain's own by-products (90 open, re-measured 2026-10-15)

**Counted rather than estimated, because the count is the point of this plan.** The register holds
**196 open rows**. This plan names **145** of them — 141 by id and 4 by item number alone (`vg-461`,
`vg-462`, `vg-468`, `vg-474`) — and **51 are named by no phase at all: `vg-388` through `vg-482`.**

**The method, stated so the next measurement is comparable rather than merely different — and it took
three takings to get right, which is why it is written down.** **A row is *carried* when a `### Task`
block names it**, by `vg-` id, or when a Phase 13/14 task heading carries it by item number (the four:
`vg-461`, `vg-462`, `vg-468`, `vg-474`). **Prose outside a task carries nothing** — not this census, not
Global Constraints, not a phase annotation, not the five decisions — **because naming a row is not owning
it.**

**The first method failed exactly there, and by my own hand.** It counted any mention above this section,
which was adequate until the 2026-10-15 Global Constraints bullet named `vg-455` as an unowned gate hole:
the count fell from 51 to 50 **because the plan described the problem**, and a measure that improves when
you write about it is not a measure. The task-scoped method returns 51 with the same register, so the
number never moved — only the definition of it did.

**The register grew by six rows on 2026-10-15** (`vg-476`, `vg-477`, `vg-479`–`vg-482`), which is the
whole of the 45 → 51 difference between the first taking and this one.

**Re-measured at `e421d897`: 204 open, 114 named, 90 named by no phase.** The taking above is kept as
the dated record it is; what moved is that the phases kept landing (Phase 12's first three wide rows,
Phase 13's and Phase 14's whole pass) while the work filed faster than it carried, so the unnamed count
rose from 51 to 90 even as the named-and-open count fell from 145 to 114. **The third correction to the
method is the one worth carrying forward, because it is the trap this section sets for its own
re-measurement: the section *lists the orphans*, so a census that reads past this heading counts the
list as a carry.** A recount taken here reported 81 rather than 90 for exactly that reason, until the
two were diffed; the cut is this heading. The regenerated index is
`.superpowers/sdd/2026-10-12-the-backlog-drain/orphan-triage-index.md`.

**They are the drain's own by-products, and that is the finding.** 49 of the 51 are `source: agent` —
rows a phase of this plan filed while doing something else, then left behind. `STATUS.md` sets the rule
that puts them there: *"file it if you found it and it is not the task you are doing"*. The rule is
right and this is its cost, unpaid: **a plan that files faster than it carries does not drain**, and the
open count is the measure. Two are `source: user` and are not in the same lane — `vg-388` (an in-app
theme store) and `vg-405` (the colour picker and gradient editor, in the user's own words after using
them, "barely usable"). **User rows outrank agent rows, and those two are the user's own words.**

**No phase carries these and none is invented here.** Writing 51 tasks from row titles alone is the
mistake this plan's own §"Plans are contracts" forbids and that two of today's briefs already paid for:
a task names owning symbols and a landmark, and a landmark cannot be written from a title. So this is a
position rather than a phase, exactly as the parked rows below are:

- **They are not abandoned and they are not parked.** A parked row has a named reason and an owner who
  will unpark it; these have neither, which is the state this section exists to end.
- **They enter a phase by triage, and the triage is the next plan-authoring work** — after Phase 12,
  13 and 14 land, because triage reads code and the three phases are editing it now.
- **Triage decides one of three things per row, and writes which on the row**: fix it in a phase named
  here; **withdraw** it, with the reason on the row, because a LOW finding that is not worth doing is
  a row that should stop being counted; or **park** it with what it waits on. `vg-386`'s sweep (133
  candidates, none proven dead) is the model for how a withdrawal is argued, and `vg-434`'s measurement
  is the model for how a count is taken rather than guessed.
- **What is explicitly not the answer:** a phase that carries all 51 because they exist. That converts
  a queue into a backlog again.

**The triage is now running, and Phases 15, 16 and 17 are where its fix-verdicts went.** Batches A–K on
2026-10-16 decided **58 rows — seventeen closed, five withdrawn, thirty-six parked** — and the rows whose
verdict was *real work with no home* became three phases authored from those measurements rather than
from titles: **Phase 15** (nine instrument gaps), **Phase 16** (eighteen behaviour findings) and
**Phase 17** (the eighteen those two left standing). **So this section's rule is no longer a plan for
later; it has phases, and the parks and withdrawals are recorded on the rows themselves.**

**The fifth correction to the method, measured 2026-10-16, is that a parked row is not a homeless one.**
The census counts "named by no phase", and after the triage most of the rows in that count are **parked**
— their home is the park, and decision `0045` exists precisely so the census can tell "known, not
scheduled" from "to do". Counting them as homeless overstates the gap in the direction that makes the
drain look unfinished. Measured with the park held out:

| | rows |
|---|---|
| open | **190** |
| parked — known, not scheduled | 36 |
| carried by an implementing phase | 101 |
| **ruled only** — Phase 1 names it, so it has a decision and no home | **51** |
| named by no phase at all | **2** (`vg-388`, `vg-405`, both the user's own and both already ordered ahead of the triage) |
| **no home** | **53** |

**So the drain's remaining structural work is the 51 ruled-only rows**, and it is a different job from the
one just done: each carries a ruling, so triaging one means reading what it was ruled to be — fix, park or
withdraw — rather than measuring whether its subject still exists. The pair that was 207/150 is now
**190/53**, and the second number fell by 97 while the first fell by 17.

**That job is done, and the sixth correction is what it returned.** The 51 were read one at a time — each
row's ruling was extracted and read as the verdict it is — and the same measurement taken afterwards:

| | rows |
|---|---|
| open | **187** |
| parked — known, not scheduled | 36 |
| carried by an implementing phase | **151** |
| **ruled only** | **0** |
| named by no phase at all | **0** |
| **no home** | **0** |

**The arithmetic is exact and it is the evidence:** 101 + 48 + 2 = 151 carried, 51 − 48 = 3 ruled-only and
those three closed, 190 − 3 = 187 open. The two are `vg-388` and `vg-405`, the only `source: user` rows
among the orphans, and **they are Phase 24's because the user's own ruling put them ahead of everything
the triage touches** rather than because a phase was invented to reach zero — the census's own rule
against a phase that carries rows because they exist is why they waited for a phase that a ruling
already required. **The three verdicts the triage's own rule allows came out three ways, and the fourth
shape is the one worth recording.**

- **Three closed by applying a ruling already taken** (`vg-111`, `vg-256`, `vg-315`). Each row's own
  ruling asks for **no** change — the published contract is a ceiling and says so; the opacity guard stays
  and no test seam is added; a citation into git-ignored execution state is provenance only. Applying a
  ruling is not new work, so these needed no phase, and each closed `verified` with a `check` that was
  **run** rather than assumed and an artefact naming the commit that took the ruling.
- **One ruling does not hold, and it was found by reading the row against the file it names.** `vg-163`'s
  Phase-1 ruling retires the row's premise by grepping `DESIGN.md` for video and finding none — but the
  row cites the **spec**, `2026-10-03-dashboard-authoring-design.md`, and that sentence is still on disk
  reading "text, shape, chart, image, video, exactly as today". The ruling's grep is true and answers a
  different question: the bible it names is gone and the row never cited it. **So the defect reproduces
  where the row said it was**, the correction is recorded on the row, and its fix is Task 19.5. This is
  the shape to watch in any ruling that quotes a file the row does not: a retired premise is only retired
  for the file that was read.
- **47 were real work with no home, and became six phases grouped by owner.** Phases 18–23, authored from
  the rulings rather than from titles — each ruling names the owning symbols, which is the measurement
  this section requires and the thing a title cannot supply.
- **The last two are the user's own, and they are Phase 24's.** `vg-388` and `vg-405` are the only
  `source: user` rows among the orphans, and the user ruled on 2026-10-15 that **both are scheduled ahead
  of the triage and each enters a phase** — `vg-405` in as many words (*"It is a defect rather than a
  wish … so it is fixed, not parked"*). Both are gated on their own spec's acceptance, which is why
  Phase 24 is ordered ahead of Phases 15–23 and behind Phase 12 rather than by its number.

**The seventh correction, measured 2026-10-16 at `566a3665`, and it says the sixth was measuring the
wrong thing: a phase the ledger records *closed* is not a home.** The sixth counted a row as carried when
any phase names it. **Thirteen of the plan's phases have closed** — 0–10, 13 and 14, each with a closing
entry in `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md` (the plan has no Phase 11) — so a row
whose only named phase is one of those is carried by work that will never run. Measured over the open
rows, **with the closed set taken from the ledger rather than from the plan's own `- [ ]` boxes**, which
are essentially unticked — Phase 1 reads 7 of 25 and every other phase 0, because the ledger and not the
plan owns completion, so a box is not evidence either way:

| | rows |
|---|---|
| open | **185** |
| parked — known, not scheduled | 35 |
| carried by a phase the ledger records **open** | **102** |
| **carried only by phases the ledger records closed** | **50** |
| named by no phase at all, outside the park | **0** |

**So the second number is 50, not 0.** The 33 rows named nowhere are exactly the parked set, which is what
the fifth correction predicted and why this one does not re-count them. The 50 are spread over the closed
phases as **76 namings** — 26 by Phase 2, 13 by Phase 1, 9 by Phase 6, 7 by Phase 8, 6 by Phase 7, 5 by
Phase 4, 4 by Phase 13, 3 by Phase 3, 2 by Phase 9 and 1 by Phase 5, a row named by two closed phases
counting in both — and **every one comes from the 101 rows the triage found already carried, never from
the 48 it homed**, which is why the sixth correction could not see them.

**Four of the 50 were read rather than counted, and none is a deferral with a forward pointer.**
`vg-133`'s ruling ends *"this row is the first candidate for the device-lens work that follows the drain"*;
`vg-389`'s names no phase at all, only *"whoever owns the composition row's own focus"*; `vg-396`'s
WHAT-WOULD-CLOSE-IT is a browser reading no phase holds; `vg-326`'s subject is unchanged and unowned.
**A closed phase's ruling that defers a row forward does not name the phase it defers to**, so this census
cannot see the pointer even where one exists — the same shape as the fourth correction, where Phase 1's
tasks turned out to be rulings and not homes.

**What that makes the next structural job:** reading the 50 one at a time, as the sixth did for its 51 —
each row's ruling read as the verdict it is, and each either homed in a phase that will run, parked, or
withdrawn. **The count is 185/50, from 207/150**, and the sixth correction's 187/0 is corrected rather
than superseded: its arithmetic was right about what it measured, and what it measured was "named by a
phase" rather than "named by a phase that will run".

**That job is done, and the eighth correction is what it returned: reading them was worth six rows, not
fifty, and the other forty-four are real work rather than triage.** Measured 2026-10-16 over all 50:

- **Five closed by applying a ruling already taken** (`vg-213`, `vg-262`, `vg-355`, `vg-372`, `vg-379`).
  They were one ruling's, not five problems: D1's of 2026-10-12, *"adopt `biome check` as the gate, chain
  every `scripts/*.mjs` self-test into `gates:self-test`, run both from CI"*, applied by a single commit
  `8477e70a` whose `.github/workflows/ci.yml` Gate step names all five rows in its own comment. **They
  stayed open because nothing re-read them after the ruling landed** — the shape this correction found 50
  times over, at one remove.
- **One parked by its own ruling** (`vg-133`), which reads *"the row LEAVES PHASE 8 and is not built in
  this drain"* — decision `0045`'s park, so the census can tell "known, not scheduled" from "to do".
- **Nine more carry a ruling and were read against the tree rather than trusted.** **None is discharged**:
  `vg-308`'s own assertion in `design-language-palettes.spec.ts` still reads `bg < panel && panel <
  panel2` and its comment still says *"How far apart the rungs must sit is `vg-308`"*, so a ladder
  collapsed to `0.0001` steps still passes — the row's defect reproduces; `vg-310`'s light is still
  translucent (`--shell-surface: #eff9f2bf`, and `CHROME_NOT_YET_OPAQUE` still holds `"light"`); `vg-324`'s
  seventh drawing is absent (`docs/design/mockups/current/` holds six HTML drawings and the README still
  says six); `vg-373`'s label is still `controls` (`editor-main.ts` still calls `manager.warn("controls",
  …)`); `vg-342` is blocked on a conflict with the redesign's settled architecture; `vg-240`'s ruling was
  *"SPEC IT NOW"* and the spec landed, but the re-shape it specifies is unbuilt; `vg-278`'s two fixtures
  are unbuilt; `vg-175`'s own ruling reverses a close to keep it open.
- **A reproduction pass over the 36 unruled rows found no withdrawal candidate at all** — every one cites
  at least one path that still exists (34 of 36 cite a live path; `vg-331` and `vg-389` cite no path and
  cannot be judged this way). **So the pass is not the instrument, which is what the earlier triage found
  twice**; these 44 are fixes, and they belong in a phase rather than in a triage pass.

**The count is 178/44, from 207/150.** The sixth correction's 187/0 was right about what it measured, and
what it measured was "named by a phase" rather than "named by a phase that will run".

**The count is now 187/0, from 207/150.** The first number fell by 20 and the second by 150, and **the
second is the one this section exists to keep visible**: every open row now carries a phase, a park, or a
ruling that says it is the user's. **The drain's structural work on the register is finished**, and what
remains is the work the phases carry — nine of them queued behind Phase 12, which waits on the user's
review of `vg-330`'s spec, plus Phase 24's two spec acceptances. **Four things now wait on the user's
word and nothing else does**: Phase 12's settings-pane spec, Phase 24's two specs, and `vg-023`'s
cancelled review.

**The measure of the drain is therefore two numbers, and both belong in the final report:** the open
count, and how many of those no phase carries. Re-measured 2026-10-15 they are **204** and **90** —
**196** and **51** at this section's first taking. **The second number is
the one that moves**, and it is the one this section exists to keep visible: the open count falls when a
phase lands, and rises again by however many rows that phase's own work files — `vg-481` and `vg-482`
were filed by 13.1b's review on the morning this count was taken.

**The fourth correction to the method, measured 2026-10-16 at `0c5db3fe`, and it is the largest one:
"named by a `### Task` block" is not "has a home".** The census counts a row as carried when a task
block names it, and **Phase 1's task blocks are the ruling sessions** — its Outcome is that every one of
the 104 decision rows carries a `RULED <date>:` line, and its tasks are "Session 2 — D3, D4, D5 and D6".
So a row Phase 1 names has a **decision**, not a phase that will implement it. Measured over the live
register:

| | rows |
|---|---|
| open | **207** |
| named by a `### Task` block | 110 |
| **named only by Phase 1, the ruling phase** | **53** |
| named by a phase that implements something | **57** |
| named by no phase at all | **97** |
| **open with no home** (97 + 53) | **150** |

**So the second number is 150, not 97, and the first is 207, not 204.** Every one of the 53 carries a
`RULED <date>:` marker, which is what makes them invisible to the orphan count and why this correction
matters: the census's own instrument reports them as carried while no phase will ever land them. **The
plan's closing rule is what put them there** — a ruled row closes only on the phase that lands its
change — so a ruling taken in Phase 1 with no adopting phase is a row the plan cannot close and the
orphan count cannot see. **The two kinds are not the same and the triage must take them differently:**
the 97 need a decision, and the 53 already have one and need a home. `vg-051` and `vg-116` were the two
of the 53 whose own ruling asks for **no** change, so they closed on 2026-10-16 by applying a ruling
already taken rather than by inventing a phase; `vg-041`/`vg-188`, `vg-268`/`vg-283`, `vg-271` and
`vg-363` name work and are the shape the rest are.

**Triage pass 1 and 2, run 2026-10-16, and both came back negative — which is the result that matters.**
The plan's second option is "**withdraw** it, with the reason on the row", and `vg-386`'s sweep is the
model for how a withdrawal is argued. Two measurable shapes of withdrawal were swept over the 97:

- **The row's subject is gone.** Of the 97, **27 name a path or a backticked symbol in their own
  title**; of those, exactly **one** (`vg-391`) has no named path that resolves — and reading it shows
  the path is *where the missing assertion should live*, not the row's subject, so it is not a
  withdrawal. **Zero rows are provably dead.**
- **The row's subject is already owned.** No orphan's title shares a backticked identifier with any
  archived row: **zero duplicates.**

**So the withdraw option has no bookkeeping yield, and that is the finding worth carrying**: these 97
are real, distinct, open findings rather than a queue that can be shrunk by tidying. It also repeats
`vg-386`'s own shape a second time — 133 candidates swept, none proven dead — which suggests the
sweep is not the instrument that will drain them. What is left is the honest one: **each row read on
its own**, which is the work the triage is, and it is why the triage is plan-authoring rather than a
script. The two sweeps' limits are recorded with them: pass 1 reads **titles**, not `detail`, so a row
whose title is prose is invisible to it, and pass 2 matches only on backticked identifiers, so two rows
describing one defect in different words are not caught.

**The eighth correction to the method, measured 2026-10-16 at `6517346e`, and it is that the second number
is partly manufactured by the drain itself.** Re-derived with the plan's own carry rule — a row is carried
when a `### Task` block names it, and the count is cut at this section's own heading — and with phase
closure read from the ledger rather than from the `- [ ]` boxes:

| | count |
|---|---|
| open rows | **152** |
| named by no phase at all | **39** |
| named only by phases the ledger records closed | **39** |
| named by at least one live phase | **74** |
| **open with no live home** (39 + 39) | **78** |

**The open count fell from 185 to 152 and the homeless count rose from 50 to 78, and the two are not
unrelated.** **A phase that closes while still carrying open rows turns those rows homeless**: Phase 16
closed on 2026-10-16 carrying `vg-490` and `vg-539`, and Phase 15 closed carrying `vg-442` — three of the
78 are rows whose home was a phase this drain closed, and the same will happen to every row Phase 17 leaves
standing. **So the second number rises with every close, and a census that re-derives it without saying so
will read as the drain going backwards while it is going forwards.** The rule this implies is one line:
**re-home a phase's still-open rows at its close**, which is the same rule Phase 12's Acceptance already
states for a different purpose (*every row closes on the phase that lands its change*), applied to the rows
that phase does not close.

**Two extraction traps, both of which changed the answer, and both are the fourth correction's lesson
again** — the count is only as good as the form it reads. **`Phase 16 closes (2026-10-16)` is present
tense**, so a `/Phase N .* closed/` regex misses the most recent close in the ledger. **`Phase 12 is
suspended, not closed` is a negation**, so the same regex counts it *as* a close — which would have
reported a suspended phase as done and hidden its rows. A first pass over this same ledger made both
mistakes at once and returned 34 / 44 / 74; the corrected extractor returns 39 / 39 / 74. **The five rows
that moved are the difference between counting a mention anywhere in a phase and counting one inside a
`### Task` block** — correction (i)'s rule, which a phase's own Outcome, Owners, Constraints and Acceptance
lines otherwise violate.

**What this correction does not claim:** that the 39 named by no phase are 39 findings without a subject —
the triage's two negative passes already showed that reading is wrong. It claims only that their *home* is
a phase the ledger records closed, so nothing will land them, and that the number is now 78 rather than the
50 this section last recorded.

**The ninth correction to the method, measured 2026-10-16 at `7da6f1c3`, and it is that the eighth
correction's own extractor is broken by the sentence that documents its trap.** The eighth excluded a
suspended phase with a pre-pass that deleted any phase whose number sat within 80 characters of a word
starting `suspend`. The ledger holds a line whose whole job is to warn about that trap — *"`Phase 16
closes` is present tense and a `/closed/` regex misses it, and `Phase 12 is suspended`"* — and the pre-pass
read the warning as evidence, so **Phase 16, which the ledger closes at `# Phase 16 closes (2026-10-16)`,
was counted open.** Two open rows moved with it: `vg-490` and `vg-539` have Phase 16 as their only home, and
with Phase 16 read as live they counted as carried by work that will run. **The corrected census is
147 open / 39 named by no phase at all / 36 named only by phases the ledger records closed / 72 named by at
least one live phase**, against the 147 / 39 / 34 / 74 this section recorded at `6517346e`: **the open
count is unchanged and the rows with no live home are 75, not 73.** The repaired extractor keeps only the
pattern whose parts are in the right order — the phase number, then the close word, on one line, with a
negation guard inside the window — and it was checked against the ledger's own headings (`# Phase 16
closes`, `## Phase 15 closed; Phase 16 opened`, `## Phase 1 CLOSES`) and against the task-status banner,
which agree on 0–11 and 13–16 closed, 12 suspended by ruling and 17 active. **What the repair does not fix
is stated rather than left as an impression of proof: most of its own evidence lines are still false
positives that happen to agree** — *"Phase 3 closes the rows the map now answers"* closes rows and not the
phase, and *"Phase 8 close — the checklist, written before it is run"* is a checklist written ahead of a
close that landed 250 lines later. **The set is right because the headings say so, not because the
derivation proves it**, and a census reporting the set without the headings is reporting a coincidence.

**The tenth correction to the method, measured at the same commit, and it is that a `### Task` block which
names a row in order to disclaim it is counted as carrying it.** The carry rule is *a row is carried when a
`### Task` block names it*, and **Phase 17's five `Produces:` lines name 18 rows — 14 closed and 4 open —
while the phase names 16 open rows in total.** The other twelve are named and not owned: Task 17.2's block
reads *"The row's three neighbours (`vg-431`, `vg-258`, `vg-212`) are not this row and stay red"*, three
rows named to say they are **not** the task's, and the same phase names `vg-542` and `vg-543` as *filed
rather than folded in*, `vg-536` as the census a line count reproduces, `vg-540` and `vg-541` as the two
trailers its own work filed, and `vg-204`, `vg-259`, `vg-281` and `vg-370` as the triage documents' examples
and as what an earlier step unblocked. **So those twelve are not made homeless by Phase 17 closing — they
were homeless before it named them**, and a census taken after the close will show the homeless count rise
by twelve for no change in the register. **This compounds with the eighth correction rather than repeating
it**: the eighth says a close turns a carried row homeless, and this one says *carried* includes rows the
phase never owned, so **part of the rise a close produces is bookkeeping rather than loss.** What the close
owes is therefore narrower than the eighth implied: **the four rows Phase 17 owns are the ones to re-home**,
and the twelve it merely names need the carry rule to stop counting a disclaimer — which is a plan edit,
not a phase's work.

**The eleventh correction to the method, measured 2026-10-16 at `d0d23c57`, and it is that the rows named
nowhere are no longer exactly the parked set.** Re-derived with the carry rule cut at this section's own
heading: **132 open / 41 named by no task block at all / 52 named only by phases that have closed / 39 with
a live home — so 93 homeless, of which 35 are parked, leaving 58 to home.** The parked split is the fifth
correction's rule, and it is now the difference between a 93-row job and a 58-row one. **The claim at the
end of the fifth correction — *"The 33 rows named nowhere are exactly the parked set"* — no longer holds**:
34 of the 41 are parked and **seven are not** — `vg-409`, `vg-417`, `vg-418`, `vg-438`, `vg-538`, `vg-544`
and `vg-546` — each filed or raised by a task that then closed without re-homing it, which is the eighth
correction's rule failing in the one place it was not applied. **None of the seven fits a task that already
exists**, so homing them is an authoring pass rather than an edit of a list. **Two extraction traps are
recorded with the numbers**: the cut is this section's **heading**, and the phrase also appears in prose
above it, so a first-occurrence `indexOf` truncates the plan and finds no phase headings at all; and a task
block's phase is **its own major number**, not the nearest preceding `# Phase N` heading, because there is
no `# Phase 11` and its three tasks sit physically under Phase 10's. **What this correction does not
claim**: its phase-closure set is hard-coded from `STATUS.md`'s phase states rather than derived from the
ledger, so it is a weaker derivation than the ninth correction's repaired extractor and is declared rather
than presented as proved.

**The twelfth correction, measured 2026-10-17 at `d4147298`, and its contribution is a negative one worth
having: the homeless total is invariant while both of its halves move.** Re-derived with the same cut:
**129 open / 94 named by a task block / 58 named only by closed phases / 36 with a live home / 35 named
nowhere, of which 32 are parked — so 93 homeless and 56 unparked, leaving 56 to home.** The eleventh's 93 is
unchanged and its 58 is now 56, because the register shrank while the split moved by more. **The eleventh's
seven nowhere-and-unparked rows are down to two**: `vg-544` closed, `vg-417`, `vg-418`, `vg-438` and `vg-409`
were homed at Phase 20's close, `vg-538` was parked on 2026-10-17, and **`vg-546` and `vg-559` remain** —
`vg-559` filed after the eleventh was taken. **A triage of all 35 nowhere rows ran the same day and closed
none of them**: 32 were already parked, `vg-538` was parked, and the two that remain are real with **no open
phase whose Outcome reaches their owner** — `vg-546`'s is the editor's copy (Phase 18's subject, closed) and
`vg-559`'s is `scripts/check-status.mjs` together with the `AGENTS.md` sentence that bounds it, which is
user-owned. **So the authoring pass is still 56 rows rather than the two**, and the two are the subset that is
also unowned *and* unscheduled.

**Phase 11 is the trap the extraction rule would catch and it is worth naming here**: it has no `# Phase 11`
heading, so a heading-only extractor assigns its three tasks to Phase 10 — **and its three rows (`vg-228`,
`vg-267`, `vg-286`) are all closed, so nothing open turns on it.**

# Parked rows — held, not a phase

**`vg-330` was parked by the user on 2026-10-11 and UNPARKED by the user on 2026-10-14**, and this
section read only the first half until 2026-10-15: the ruling is "**UNPARKED. The spec is
commissioned** — settings becomes a pane opened from the rail's gear, the settings drawing is redrawn
as a panel, and the pane's frame gains a PARITY row so the next divergence is visible." **So it is not
a parked row and Task 12.5 is not waiting on the user** — it is the remaining work of Phase 12, and the
row stays `open` with its closing terms unchanged (the spec and its plan land, with the redrawn drawing
committed beside the shipped pane). **Nothing here waits for permission that was given on 2026-10-14.**
`vg-322` is parked transitively on it — that reading still holds — and two rows whose subjects the
change invalidates are revisited **inside that spec rather than before it**: `vg-318`'s scrim
measurement measures a container that will not exist, and `vg-322`'s whole subject is the modal's width.
**No phase owns them.** `vg-322`'s rule in §5.1's owner table stays unbuilt until `vg-330` is unparked, and W9's `vg-292`/`vg-293` are independent of it. They are named in the drain's final report so the count is legible: 22 closed, 0 withdrawn unless a D9 ruling withdraws one, 109 worked, 2 parked.

---

# Phase 25 — W20: the user's 2026-10-17 reports

**Outcome:** the five things the user found while testing their own machine are landed — the layer
footer keeps its own commands greyed rather than the Add pane's constructions, the player's warning
banner clears itself after three seconds, the phone player gains tap-revealed chrome (fullscreen,
keep-awake and a dimmer) with an honest unsupported path, the player installs as a PWA, and the live
line chart's edge and the phone's re-fit are measured before either is changed — and the crop notice and
the bleed toggle are gone, which the user ruled in the same session.

**Why its own phase, ahead of Phase 22's remainder.** Every row here is a user report from one
session of testing on 2026-10-17, and the user ordered them ahead of the remaining proof repairs the
same day. Phase 22 is suspended, not closed, and resumes after this phase; Phase 21's and Phase 12's
suspensions are untouched by this one.

**Owners:** `editor/src/object-actions.ts` with `editor-shell/layer-panel.tsx`; `player/src/chrome.ts`,
`player/src/main.ts`, `player/src/availability-notice.ts`, `player/index.html`, `player/src/ui-copy.ts`
and `player/public/`; `host/src/serve/static-path.ts`; `renderer-core/src/data/live-source.ts` with
`renderer-core/src/charts/line.ts`.

**Constraints:** one implementation seat at a time. **`vg-571` and `vg-572` each begin with a
measurement, not a fix**: both need a per-frame reader of the artboard's box, the canvas
`viewportTransform` and the chart's own rect, against a rebuilt bundle, and neither may be closed by
re-running an existing case — `vg-028`'s notice case already passes and does not cover a viewport
change. A browser run needs rebuilt bundles, `--workers=1` and its own JSON report. **Task 25.6's
first write into `host/src/serve/static-path.ts` is refused by `scripts/reuse-gate.mjs` until a
decision note claims that path**, so the note lands before the content type does.

**Acceptance:** each row's own `check` passes; `vg-570`'s footer shows the registry's commands
disabled with nothing selected and carries no construction button; `vg-569`'s banner is gone three
seconds after it is raised with the composition unmoved; `vg-568`'s controls are reachable by tap,
toggle, auto-hide, and explain themselves where the client cannot honour them; `vg-577`'s player
installs and its service worker caches no telemetry; `vg-578`'s removal leaves no crop notice on the
display, no bleed toggle in the inspector, and no saved theme stranded by the persisted key; `vg-580`
settles the origin, so keep-awake and the PWA either work on a phone or are ruled absent there rather
than presented as controls that cannot work; `vg-571` and `vg-572` each carry a measurement that names
what moved before any code changed.

**Failure modes:** reverting `vg-460` silently by deleting the constructions and leaving the row
empty; a three-second timer that also hides a refusal a reader still needs; chrome that is dead on
iPhone Safari rather than honest about it; a dimmer described as device brightness, which a browser
cannot set; a service worker that caches the live stream, so an offline display shows old numbers as
though they were current; deleting the bleed mark without settling what happens to a theme that already
carries it, which strands authored work rather than removing an unreachable branch; treating a single
sample of a flaky browser case as a measurement.

**Verify:** focused unit and DOM cases during implementation; the browser cases each task names,
against a rebuilt bundle with `--workers=1`; `npm run gate` with its exit code read from `$?` at the
phase boundary.

### Task 25.1: The layer footer keeps its commands, greyed

**Files:**
- Modify: `object-actions.ts`; `editor-shell/layer-panel.tsx`; `layer-panel.dom.test.tsx`; `pane.dom.test.tsx`; `tests/e2e/snapping.spec.ts`

**Interfaces:**
- Produces: `vg-570` closed

- [x] **Step 1: The constructions leave the footer.** `CONSTRUCTION_ACTIONS` was added to `LayerActions` by `e572c302` to answer `vg-460`'s open question, and the user has ruled that answer wrong.
- [x] **Step 2: With nothing selected the footer draws the registry's object commands disabled** — not absent, and not empty. That is the ruling the user gave when asked directly. Whether ineligible commands also grey while a selection exists is not ruled, and the registry's documented rule is that an action the selection cannot run is absent rather than greyed, so the minimal reading is the no-selection state alone.
- [x] **Step 3: The tests that pin the footer's set move to the new rule** — `vg-460`'s check compares the footer against the Add pane's tiles and must be rewritten rather than left contradicting the ruling — and the bridge's construction exemption is assessed: `vg-484` is about a construction reaching the session façade unwrapped through this path, so if the footer was its only caller that exemption becomes dead code rather than a live defect.
- [x] **Step 4: Close it**, with a case that fails when the no-selection footer is emptied again.

### Task 25.2: The player's warning banner clears itself

**Files:**
- Modify: `player/src/chrome.ts`; `player/src/main.ts`; `player/src/availability-notice.ts`; `player/src/chrome.dom.test.ts`

**Interfaces:**
- Produces: `vg-569` closed

- [x] **Step 1: The availability warning clears three seconds after it is raised**, and the composition does not move when it does: the strip already overlays, so the dismissal is the change and the overlay is the invariant to keep.
- [x] **Step 2: The crop notice is not given the same treatment — it is being removed instead.** SUPERSEDED 2026-10-18 by the user's ruling (`vg-578`, Task 25.7): the crop notice and the bleed toggle are to be gone, so this task neither dismisses the crop notice nor preserves it as a standing requirement. Leave `showCropNotice` exactly as it is and give it no shared helper a later caller could inherit; its removal is Task 25.7's, with its own propagation, because decision 0027 and the plans that built the notice all rest on it.
- [x] **Step 3: The resize half is closed by the user, not by a reproduction.** They confirmed on 2026-10-18 that the strip does not resize the artboard, so the report named a bundle built before `476d8db7` and this task makes no placement change. The artboard's box not moving is the invariant the dismissal must preserve, not a fault to repair — and if the seat's own browser run shows it moving, that is a finding to report rather than a reason to change placement.
- [x] **Step 4: Close it**, with the browser case showing the banner absent after the delay and the artboard's box unchanged.

### Task 25.3: The phone player's chrome controls

**Files:**
- Modify: `player/index.html`; `player/src/chrome.ts`; `player/src/main.ts`; `player/src/ui-copy.ts`

**Interfaces:**
- Produces: `vg-568` closed

- [x] **Step 1: Semi-translucent chrome in the top-right, revealed by tap and hidden again after three seconds**, which is what the user asked for on 2026-10-17; the three-second duration and the auto-hide exclusion for keyboard focus are the design presented rather than separately ruled.
- [x] **Step 2: Three controls, no settings modal.** Ruled by the user on 2026-10-17 when they answered the settings-panel question: fullscreen, keep-awake and a brightness control live in the chrome instead, and `vg-576` stays open until all three exist.
- [x] **Step 3: Entering and leaving fullscreen is one control's toggle**, and the chrome never takes room from the composition.
- [x] **Step 4: Keep-awake is a re-acquiring loop, not a switch, and it may not exist at all on the origin a phone uses.** The Screen Wake Lock API releases its lock whenever the page is hidden, so the control re-requests on `visibilitychange` and reports the lock it actually holds; a control that claims a lock it lost is the failure here. It is also gated on a secure context (`vg-580`, Task 25.8), and the host serves plain http, so on a LAN address the API is absent — the control says so rather than appearing broken, and a proof that ran on `localhost` proves nothing about the phone it is for.
- [x] **Step 5: The brightness control is a dimming overlay over the rendered display, and says so.** A browser cannot set a device's panel brightness, so the honest control is an alpha over the composition — never labelled as the device's own brightness, and never persisted.
- [x] **Step 6: Capability is detected and the unsupported case explains itself**, because iPhone Safari does not expose arbitrary-element fullscreen; Task 25.6's standalone mode is that client's honest path, so the refusal may name it.
- [x] **Step 7: Close it**, with the browser case naming what the client it ran on can actually do.

### Task 25.4: The live line chart's edge

**Files:**
- Modify: `renderer-core/src/charts/line.ts`; `renderer-core/src/scene/plan.ts`; `renderer-core/src/scene/plan.test.ts`; `renderer-core/src/index.ts`; `editor/src/chart-manager/index.ts`; `playwright.config.ts`; `docs/decisions/`
- Add: `tests/e2e/live-chart-edge.spec.ts`
- **The measurement moved the owners, which is the point of Step 1**: this task originally named `renderer-core/src/data/live-source.ts` and `player/src/main.ts`, and neither was touched — the defect was in the window the chart asks the source for, not in the timestamp the source writes.

**Interfaces:**
- Produces: `vg-571` closed

- [x] **Step 1: Measure before deciding.** The row's source reading is that `createLiveSource` overwrites every sample's `presentationTimestamp` with the browser clock at batch arrival, so a batch's points share one x while the axis slides every frame. The host's cadence and the half-second figures the user reported are unmeasured. **Measured, and the reading was refuted**: the host sends one sample per key per batch, so a batch cannot put several points of one series on one x.
- [x] **Step 2: Name which symptom the measurement shows** — a right edge that trails and jumps, a left edge that drops points together, or both — because the fix differs between the timestamp and the window. **Both, and they are two defects with two owners**: the left edge was the window (fixed here) and the right edge is the overscan gutter, filed as `vg-582`.
- [x] **Step 3: Fix the cause the measurement names**, keeping `toSeriesPoints`' gap preservation and the playback delay's purpose intact.
- [x] **Step 4: Close it**, with the before and after probe readings.

### Task 25.5: The display re-fit on a phone viewport

**Files:**
- Modify: `player/src/main.ts`; `player/src/chrome.ts`; `player/index.html`

**Interfaces:**
- Produces: `vg-572` closed

- [x] **Step 1: Run the measurement `vg-028` asked for and never took.** A per-frame reader of the artboard's box, the canvas `viewportTransform` and the object's rect, on a phone-sized viewport whose height changes under the page, for longer than the thirty seconds that failed to reproduce the original. **Taken**: `tests/e2e/host-viewport-refit.spec.ts`, opt-in behind `VIGILIA_VIEWPORT_PROBE`, two 54 s recordings per orientation on the built player at 60 fps.
- [x] **Step 2: The leading candidate is the viewport rather than a notice** — a phone's browser chrome showing or hiding changes the host's height and the `ResizeObserver` re-fits the scene — but the trigger is not established, so it is measured rather than assumed. **Measured, and the candidate is refuted**: a height change cannot move a width-limited composition horizontally at all — portrait `scale` 0.609375 and `offsetX` 0 stay fixed, every object's `sx` span is 0 across 3249 frames — and on a height-limited landscape composition it contracts symmetrically about the centre instead of sliding one way.
- [x] **Step 3: Do not close this with `vg-028`'s notice case**, which already passes and covers a different mechanism.
- [x] **Step 4: Close it — or, if the measurement shows the re-fit is correct behaviour for a viewport change, correct the claim instead.** A row's subject is a claim, and this one's claim is that the slide is a defect. **The claim is corrected and the row stays open**: the viewport is refuted as the mechanism, but a chrome strip still takes room from the artboard by design, and this task's own recording contains the crop strip moving `stray-quarter` 30.61 px at mount — excluded from the reading only because its baseline was captured after the strip settled. `vg-572` now names `player/src/chrome.ts`, and Task 25.7's removal of the strip is the event that closes it.
### Task 25.6: The player installs as a PWA

**Files:**
- Modify: `player/public/`; `player/index.html`; `player/src/main.ts`; `host/src/serve/static-path.ts`; `host/src/server.ts`; `docs/decisions/`

**Interfaces:**
- Produces: `vg-577` closed

- [x] **Step 1: The decision note lands first.** `host/src/serve/static-path.ts` is a mechanism boundary in `scripts/reuse-gate.mjs`, so the note at `docs/decisions/NNNN-<slug>.md` claims the path before the content type is added, and it records what was searched rather than three libraries. **Done**: `docs/decisions/0071` claims both `static-path.ts` and `server.ts`, with all seven rungs recorded including the ones that found nothing.
- [x] **Step 2: A manifest and its icons**, served with a content type browsers accept — `.webmanifest` is not in `CONTENT_TYPES` today, so it would arrive as `application/octet-stream` and every browser would refuse it. `display: standalone` is the point, not a detail: it is what draws without browser chrome on a client that has no fullscreen API. **Installability needs a service worker and a secure context, so Task 25.8 gates this step** — a manifest served over plain http to a LAN address yields no install prompt, whatever it contains. **Done, and the premise in this step is refuted by measurement**: `.webmanifest` is now mapped to `application/manifest+json` and served that way, but Chromium 153 accepts `application/octet-stream` and `text/plain` for a manifest with `installabilityErrors: []` and a prompt — so "every browser would refuse it" is true of the spec and of stricter engines rather than of the client this was measured on. The gating half held: no install without the secure context. The installability table is decision 0071's rung 6.
- [x] **Step 3: A root-scoped service worker that caches the shell and never the telemetry.** The player is served at the host's root, so `/` scope is available; `/api/**` and the event stream are excluded, because an offline display showing old numbers as though they were live is the fabrication the project forbids. **Done, with one correction the review forced**: `/sw.js` and `/manifest.webmanifest` joined `server.ts`'s bundle-asset allowlist, because the browser fetches both itself and a `register()` call carries no session — the same rule the assets beside them already followed. The cached document is keyed by the document rather than by the URL that asked for it, since that URL carries the display's `?session=` token and a cache outlives clearing history and is unreachable from the host on revoke.
- [x] **Step 4: Close it**, with the install path exercised on a real client and the offline behaviour named — including, if the honest answer is that offline shows nothing, that nothing is what it shows. **Done, and the honest answer is worse than "nothing" in one direction and better in another**: offline the shell draws and the player's own failure page says the theme could not be loaded, with `/api/**` refused and no cache entry under it — while an **installed** app launches at `start_url: "/"`, which the host refuses to an unpaired reader with 403, so it is usable offline and refused online. That is `vg-588`, and its answer is the pairing spec's, which the user ruled owns how a display obtains a session; omitting `start_url` is not the alternative, since Chromium then reports `start-url-not-valid` and fires no install prompt. The cache also grows with every build and nothing evicts an entry (`vg-589`). Reading on the integrated tree: `https://192.168.2.56:4235`, Chromium 153.0.8010.12, scope `/`, controller `/sw.js`, `application/manifest+json`, `display: standalone`, both error lists empty. No phone was available, so every iOS and Android statement is documentation.


### Task 25.7: The crop notice and the bleed toggle are gone

**Files:**
- Modify: `player/src/chrome.ts`; `player/src/artboard-crop.ts`; `renderer-core/src/theme/bleed.ts`; `renderer-core/src/theme/fabric-envelope-validate.ts`; `scene-fabric/src/artboard-crop.ts`; `editor/src/selection-inspector/bleed.ts`; `docs/decisions/`; `docs/superpowers/specs/`

**Interfaces:**
- Produces: `vg-578` closed, `vg-191` narrowed or withdrawn, decision 0027 superseded

- [x] **Step 1: The mark goes, and with it the toggle.** `VIGILIA_BLEEDS_PROPERTY`, `objectBleeds` and `isBleedMark` leave `renderer-core/src/theme/bleed.ts`; the envelope validator stops pinning the mark; `SceneBox.bleeds` and the `bleeds` term in `countable` leave `scene-fabric/src/artboard-crop.ts`; `selection-inspector/bleed.ts` and the Position row that renders it are deleted. Nothing is marked any more, so every overhang counts as cropped. **Done, and the count proves it**: the group case moved `counted: 2` → `counted: 3`, because the group no longer carries a mark for `countable` to skip.
- [ ] **Step 2: The display stops saying it.** `cropNoticeText` and `showCropNotice` go, with the `vigilia-crop` strip and the rules that paint it. This is the half that removes a signal a reader currently gets, so the browser reading that closes it is the display showing a cropped composition and saying nothing about it. **It is also the event `vg-572` waits on**: the crop strip is the last strip that takes room from the artboard, Task 25.5 measured it moving the composition 30.61 px when it arrives, and this row cannot close until a reading shows the composition holding still where a strip would have taken room. **Done, and `vg-572` closed on it**: after the removal the composition holds one transform, one painted height and one `sy` per object across 539 portrait and 538 landscape mounted frames — including the mount frames where the strip used to arrive — against two values of each before, with no frame carrying a `vigilia-crop` strip.
- [x] **Step 3: The persisted key is RULED gone, and the evidence that made it safe is already gathered.** The user ruled on 2026-10-18: remove `vigiliaBleeds` from the published schema (`schema/theme-document.schema.json`, at the repo root), from `envelope-keys.ts`'s hand-maintained keys and from every existing theme. **This step's original pointer was wrong and is corrected here**: it named `renderer-core/src/theme/validate.ts`, which does not exist, because ADR-0041 retired schema v1 by deletion. The decider is `envelope-keys.ts` (ADR-0023) for the closed bags, with the published schema and `fabric-envelope-validate.ts` covering the object shape — and `fabricObject` is deliberately in neither key list, because the schema publishes that shape with `additionalProperties: {jsonValue}` rather than `false`. That is exactly why retiring a key there is a schema deletion rather than a migration, and an independent review drove it end to end: a document carrying the key still loads through the host's own route, with a JSON-identical envelope. No authored work is stranded by it — `git grep` finds the key in the schema, the source, decision 0027 and the tests, and in no tracked theme file; the only two theme files carrying it are gitignored and written by the specs that exercise the notice; and the author's own app folder (`~/.vigilia/themes/`, four themes) carries none. `fabric-envelope-schema-sync.test.ts` is the case that keeps the schema and `validate.ts` in step, so it is what proves the two moved together. Record the consequence rather than leaving it to be discovered: with the mark gone the count cannot exclude a deliberate bleed, so an object that runs off the edge on purpose reads as a fault for as long as it stands, and the user ruled the count stays anyway because it is actionable.
- [x] **Step 4: Propagate in one pass, not three.** Decision 0027 is superseded by a note of its own; the plans and specs that require the notice or the mark are corrected where they are current truth and left alone where they are dated records; `vg-191`'s subject loses one half, so the row is narrowed or withdrawn rather than left asking for a fixture that no longer describes anything. **Done, with one piece deliberately left open**: 0027 is superseded by 0069, and `vg-191` turned out to lose its subject rather than half of it — with the notice gone a bleeding document raises no strip at all, so the pair its ruling asked a fixture for cannot be raised, and the remaining data-gap half is already covered. Withdrawal is the user's decision, so the row is corrected with its disposition recorded as pending. `vg-586` was filed for the two exports the removal left without a production consumer. The artboard panel's crop figure STAYS — ruled by the controller, open to the user — because it is the editor's own count on the surface where the figure is actionable; what changes there is that nothing is excluded from it.

### Task 25.8: The host serves a secure origin, or the two features it gates are ruled absent

**Runs before Task 25.6**, which cannot register a service worker without it, and before Task 25.3's keep-awake step is anything but an honest refusal.

**Files:**
- Modify: `host/src/cli/hosting.ts`; `host/src/server.ts`; `host/src/tls/`; `host/src/cli/net.ts`; `host/src/cli/args.ts`; `host/src/main.ts`; `player/src/ui-copy.ts` and `player/src/display-controls.ts` on the receiving end. **Two pointers corrected on close**: the first was written `host/src/hosting.ts` and the file is `host/src/cli/hosting.ts`; the second named `player/src/chrome.ts`, which carries the strips and not the keep-awake control — `vg-576`'s copy lives in `player/src/ui-copy.ts` with its feature detection in `player/src/display-controls.ts`.

**Interfaces:**
- Produces: `vg-580` closed

- [x] **Step 1: Establish the origin a display actually uses, and prove the loss before fixing it.** `navigator.wakeLock` and `navigator.serviceWorker` are both gated on a secure context, and the host is plain `http.createServer` on a LAN port, so a phone gets neither. **`localhost` is a secure context, which is the trap**: a seat testing on the host machine sees both present and concludes the feature works. Every proof for this task, for Task 25.3's keep-awake and for Task 25.6 must name the origin it ran against, and a `localhost` run proves nothing about a phone. **Done, and it changed the decision**: the loss was re-established at the LAN address against `localhost` reporting both, and the measurement that removed one of the three options is that a bypassed self-signed certificate earns `isSecureContext: true` and a granted wake lock and still **refuses** `serviceWorker.register` with `SecurityError`, while the same certificate made valid via `--ignore-certificate-errors-spki-list` registers. The user then ruled a local CA (the mkcert shape), and every reading since names its origin.
- [x] **Step 2: The certificate is a decision with a per-device cost, so it is made rather than assumed.** A self-signed certificate earns a browser warning per device and per browser profile until it is trusted by hand; a local CA (the mkcert shape) removes the warning at the cost of a setup step on each display; plain http means ruling keep-awake and the PWA absent on a phone, which is the honest reading of the host today. The task records which was chosen and what it costs a user adding a second display. **Done, ruled by the user on 2026-10-18: a local CA.** The host mints one root at `<settingsDir>/tls/ca.key` (mode 0600, outside the tree, regenerated rather than refused when unreadable) and re-issues a leaf in memory at every start over every non-internal interface address plus `localhost`, `127.0.0.1`, `::1` and `os.hostname()` — so a second display installs the same root and a changed DHCP address costs a restart, not a re-install. `node-forge` 1.4.0 is the one new runtime dependency, licence and advisory recorded; the decision note is `docs/decisions/0070`.
- [x] **Step 3: Whatever is decided reaches the surfaces that depend on it.** If the origin becomes secure, Task 25.3's keep-awake control holds a real lock and Task 25.6 installs; if it does not, both say so where a reader meets them rather than presenting controls that cannot work, and `vg-576` and `vg-577` are corrected to match rather than left claiming a capability the origin forbids. **Done, with a boundary the user drew mid-flight**: the origin became secure, the keep-awake copy now names both the scheme and the missing root, and the console prints the two addresses as two steps — the root fetched over plain http so no warning is in the way, then the `https://` origin to reload. **The six surfaces that advertise how to connect were left untouched**, not even to change the scheme: the user ruled that pairing and connection management belong to the per-display-themes spec, and `vg-587` carries the handoff, the four false spec claims the split left behind, and what that spec needs from this task.
- [x] **Step 4: Close it**, with the proof naming the origin, the client, and what that client reported for each of the two APIs. **Done**: `https://192.168.2.56:4233`, Chromium 153.0.8010.12, `isSecureContext` true, `wakeLock.request("screen")` granted with `sentinel.type` `screen`, `serviceWorker.register` registered at scope `.../assets/`. Two cases fail when the change is disabled — the leaf-only chain (`net::ERR_CERT_AUTHORITY_INVALID`) and the port's mid-response guard, which an independent review found was a no-op over TLS and which is now keyed by the connection's four-tuple rather than by object identity. No phone was available, so every iOS and Android statement is documentation, and the reading allowlists the root rather than installing it in a trust store. `vg-580` is verified.

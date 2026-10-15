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

**Four phases were added after that table was written, so the table records the order rather than the
count**: Phase 12 (the 2026-10-14 rulings no phase carried), Phases 13 and 14 (the user's 2026-10-14
GUI list, items 1–9 and 10–18), and **Phase 15, the instrument gaps the triage decided** — which is the
phase the `# The rows no phase carries` section's own rule names, authored from measurements taken on
2026-10-16 rather than from titles.

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

**Owners:** the parity gate (`src/web/tests/e2e/mockup-values.ts` and `design-language.spec.ts`), the
token ratchet (`scripts/design-tokens.mjs` with `scripts/design-tokens.gated.json`), the reference
reader, and the two spec files.

**Constraints:** **queued behind Phase 12**, because one phase is active at a time and Phase 12 is the
only phase that has not closed. Task 15.2 and Task 15.3 edit `scripts/`, which is on
`scripts/reuse-gate.mjs`'s watchlist, so **each lands a note under `docs/decisions/` before its first
write** — note `0047` is the precedent and records the cost knowingly. Task 15.5 is browser work and
therefore runs alone on the machine, one suite at a time, against a rebuilt bundle.

**Acceptance:** each row's own `check` passes and is recorded on its line; the four instruments each
refuse a case they currently accept, proved by disabling the new check and showing it red before the
fix is trusted; `npm run gate` exit 0 with its exit code named in the close commit.

**Failure modes:** an instrument widened until it accepts the failure it was written to catch; a check
over prose whose unit is undefined, which is the shape `vg-529` records; a file split into pieces that
each still exceed the stop.

**Verify:** `npm run gate` (its exit code read from `$?` into a file, never through a pipe), plus the
parity suite on a built bundle for Tasks 15.1 and 15.5.

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
- [ ] **Step 2: Re-shoot the three captures `vg-402` names** — `shell-capture-graphite.png`, `settings-capture-graphite.png` and `settings-capture-editorial.png` — whose last-touch commits are ancestors of Task 2's weight collapse `ef81b183`. **`vg-504`'s remaining half is the same act on the same three files** — its drawing is fixed and its captures are not — so it lands here rather than in a task of its own.
- [ ] **Step 3: Rebuild the affected bundles first**, since Playwright's `webServer` is `vite preview` and reads `dist`.
- [ ] **Step 4: Close both rows**, or close `vg-401` as a non-defect if the first reading holds — which is a legitimate outcome and must say so on the row.

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

**The triage is now running, and Phase 15 is where its fix-verdicts went.** Batches A–G on 2026-10-16
decided 27 rows by measurement — fourteen closed, two withdrawn, eleven parked — and the nine rows whose
verdict was *real work with no home* became **Phase 15**, authored from those measurements rather than
from titles. **So this section's rule is no longer a plan for later; it has a phase.** The parks and the
withdrawals are recorded on the rows themselves, which is where a ruling lives.

**Re-measured 2026-10-16 after Phase 15 was authored, at `37e72f0a` plus that edit: 195 open, 118 named
by a `### Task` block, 77 named by no phase, and 128 with no home** (77 unnamed + 51 named only by
Phase 1). The pair moved for three different reasons at once and each is worth separating: the open
count fell by twelve (fourteen closes, two withdrawals, and two rows filed), **Phase 15 homed nine**,
and the unnamed count fell by twenty for the same reason — so a census that reported only the open count
would have shown a smaller improvement than the one that happened.

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

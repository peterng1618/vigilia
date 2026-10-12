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
- **What counts as ruled:** the marker **format** `RULED <YYYY-MM-DD>:`, not the word `RULED` — four **live** rows say the word in prose without the marker (`vg-040`, `vg-195`, `vg-220`, `vg-225`; the seven in the archive that carry it are closed `verified` or `withdrawn`, so whatever their prose says is already settled), and the twelve rulings recorded on 2026-10-12 carry the format itself, normalised to it by Task 1.1's pre-pass after being written as `RULED <date> by the user, …`. The 104 are pre-passed before any session (Task 1.1 Step 2), and a row whose `detail` already answers its own question is not asked again. **Two rows look answered and are not, and both are asked.** `vg-225`'s `RULED to stand by …` settles that the finding is not a nit, not which of the two options its triage question poses. `vg-040`'s `RULED: draft in browser storage` is conditional in its own next clause — `BLOCKED: the asset-ownership question decides where the draft lives` — and its evidence records that decider as unresolved (`triage-B1.md:21`: the asset-ownership spec is `Status: backlog`), so it is a confirmation or a change, not a fresh question, and it is still asked. The other two bare-word rows are not decision rows and no session asks them (`vg-220` is Task 7.4's, `vg-195`'s is a mention of the user's Base UI ruling). The marker rule is what made the two visible; the correction is recorded here because this sentence is what a session reads before deciding to skip a row.
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
| §8.3 | four collapses — `vg-268`/`vg-283`; `vg-291`/`vg-292`/`vg-293`; `vg-166`/`vg-329`(+`vg-199`); `vg-041`/`vg-188` | applied **once**, at the first member: Task 1.3 Step 5, Task 10.3 Step 1, Task 4.1 Step 1, Task 1.4 Step 1 |
| §8.4 | `vg-329`'s title counts **rows**: **11** `verified` rows carry no valid `artefacts` array — **8** of them as a bare string, `vg-303` among them — where **126** hold one. The **14** is the checker's *problem* count and belongs in Task 4.1's table, not in this sentence; the "15" counts rows with no `artefacts` key across **both** states, and 12 of those are `withdrawn` rows that need none | Task 4.1 Step 7 |
| §8.5, §8.8 | `vg-235`'s census verdict is stale | Task 0.3 Step 2 |
| §8.6 | `vg-320`'s identifier is `RADIUS` at `design-language.spec.ts:2887` | Task 8.1 Step 2 |
| §8.7 | six tracked `.superpowers/sdd/` citations, not four | Task 1.5 Step 4 (`vg-315`) |
| §8.9 | drifted counts in `vg-262`, `vg-276`, `vg-283`, `vg-199`, `vg-204`, `vg-210`, `vg-284`, `vg-274` | Task 1.2 Step 1 (`vg-262`); Task 9.1 Step 4 (`vg-276`); Task 1.3 Step 5 (`vg-283`); Task 4.1 Step 1 (`vg-199`); Task 2.4 Step 4 (`vg-204`, `vg-210`, `vg-284`); Task 1.3 Step 3 (`vg-274`) |
| §8.10 | `vg-252`'s premise is half-false, the defect is live | Task 1.4 Step 2 |
| §8.11 | stale owner paths in `vg-104`, `vg-109`, `vg-155`, `vg-333`, `vg-314`, `vg-328`, `vg-301`, `vg-235` | **Task 3.1 Step 1 (`vg-104`)**; Task 1.5 Step 4 (`vg-109`, `vg-155`); Task 7.4 Step 4 (`vg-333`); Task 2.3 Step 4 (`vg-314`); Task 0.2 Step 3 (`vg-328`); Task 1.3 Step 2 (`vg-301`); **Task 0.3 Step 2 (`vg-235` — the same step that takes §8.5/§8.8)** |
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

**Acceptance:** each of the 104 rows' own lines carries the marker **format** `RULED <YYYY-MM-DD>:` — 96 from Phase 1, 8 from the Phase 2 follow-up — checked as a **set of ids** per cluster and never as a `grep -c` count, because a count over lines is satisfied by one row ruled twice and another not ruled at all. `npm run backlog:check` exits 0.

**Failure modes:** treating a cluster as one question and marking its non-sharing members ruled; a ruling recorded in a chat instead of on the row's line; a second ruling appended to a row that already carries one; skipping a row on the bare word `RULED` when its own text says the decision is still open (`vg-040`, `vg-225` — both are asked); a ruling that contradicts a `§N` marker without the marker being amended in the same change.

**Verify:** a per-row grep for the marker **format** — not for the word `RULED`, which four live rows carry in prose today — before any work phase starts; the register checker after every batch.

**Four decisions are already taken, and the sessions record them rather than asking again.** The user settled them on 2026-10-12 and each sits on its own rows as `RULED 2026-10-12:`: **D1's lead** (adopt `biome check` as the gate, with `gates:self-test` chained and the `organizeImports` findings fixed in that commit) on `vg-213`, `vg-262`, `vg-372`, `vg-355`, `vg-379`; **D5** (the ratchet's membership rule) on `vg-228`, `vg-267`, `vg-271`, `vg-274`, `vg-286`; **D4** on `vg-291` (it dissolves into `vg-292`); and **D11** on `vg-368` (`.agent-scratch/` leaves the tree). A session's steps below name them where a step would otherwise read as a question; where a step and this paragraph disagree, this paragraph wins and the step is a defect to fix in the same change.

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

- [ ] **Step 1: D1's lead question is already answered — record it, do not re-ask it.** The user ruled on 2026-10-12 that `biome check` is the gate, and the ruling sits on `vg-213`, `vg-262`, `vg-372`, `vg-355` and `vg-379`; this session's job is the **four that do not share it**. Apply §8.9's count correction to `vg-262`'s line as it stands: 60 `organizeImports` findings, not the 67 it reads.
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
- [ ] **Step 3: D5's five are already ruled, recorded together on 2026-10-12** — `vg-228`, `vg-267`, `vg-271`, `vg-274`, `vg-286` carry the ratchet's membership rule as one answer. Record them; do not re-ask. §8.9's correction to `vg-274` still rides its line — its title's "in no gate" is already false while the design pass it asks for is real, so record what the ruling said about the pass.
- [ ] **Step 4: Take D6's twelve that a reading settles** — `vg-254`, `vg-256`, `vg-260`, `vg-263`, `vg-264`, `vg-268`, `vg-283`, `vg-269`, `vg-272`, `vg-289`, `vg-290`, `vg-336` — and apply §8.2's line correction to the rows that cite one.
- [ ] **Step 5: Collapse `vg-268`/`vg-283` once, here** (§8.3 names this task the first member's), saying on both lines that one ruling covers the pair, and apply §8.9's count correction to `vg-283` (357 → 379). The other three collapses are Tasks 10.3, 4.1 and 1.4's — do not apply them here.
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

- [ ] **Step 1: Collapse `vg-041`/`vg-188` into one question, once** — §8.3 pairs them, `vg-041`'s own cell says it owns `vg-188`, and both ask which Fabric properties are derived. One ruling, two rows marked.
- [ ] **Step 2: Apply §8.10 to `vg-252`** — its premise is half-false (deferral is action-scoped, not "every action") while the titled defect reproduces; rule on the live source.
- [ ] **Step 3: Take D8's nine** as ownership answers. Each names a fact two or more modules spell themselves, so each answer names the one owner that survives.
- [ ] **Step 4: Route D8's answers into W5's gate** — Task 6.1 cannot start until they exist. `npm run backlog:check`.

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
- [ ] **Step 4: Apply §8.7 to `vg-315`** — six tracked `.superpowers/sdd/` citations, not four — and §8.11's path corrections to this session's rows (`vg-109`, `vg-155`) as they are edited. `vg-328` left the live file in Task 0.2, so its correction was applied *before* the move; the other §8.11 rows are edited in the tasks that own them (`vg-104` Task 1.4 Step 3, `vg-301` Task 1.3 Step 2, `vg-333` Task 7.4 Step 4, `vg-314` Task 2.3 Step 4, `vg-235` Task 0.3 Step 2).
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

**Verify:** `npm run gates:self-test`, `npm run design:check`, `npm run backlog:check`. [Annotated 2026-10-13: the list above is a restatement, and a restated gate list is exactly the artifact that rots (`vg-384`) — read the steps from `.github/workflows/ci.yml`, which is the authority for what "green" means. What that job runs now is `npm run gate` (`biome check`, `gates:self-test`, the unit suite) and `design:check`, beside the steps it already had.]

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

**Acceptance:** the two pins at `tests/e2e/reference-theme.spec.ts` are gone and their cases assert the strip; `vg-110`'s caller sees the validation result.

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

# Phase 6 — W5: manager protocols and single-owner facts (5 rows)

**Outcome:** the session and the managers name one owner per fact, and `vg-364`'s deadline is checked rather than worked.

**Owners:** the session, the managers, and a spec for `vg-240`'s protocol if D8 ruled one is owed.

**Constraints:** **gated on D8's rulings** (Task 1.4) — do not start before they exist. `vg-364` is a deadline, not a task: its subject is `vg-232`…`vg-248`, so it closes when they do.

**Acceptance:** `vg-365` and `vg-367` each name one owner for their one concept in two modules; `vg-232` and `vg-239` land on the owner D8 named; `vg-364` closes only against the closed set.

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

### Task 6.3: The two manager rows

**Files:**
- Modify: the manager rows `vg-232` and `vg-239` name

**Interfaces:**
- Consumes: Tasks 6.1 and 6.2
- Produces: two landed rows

- [ ] **Step 1: `vg-232`** — implement the owner D8 named.
- [ ] **Step 2: `vg-239`** — same, on its own manager.
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

---

# Phase 7 — W6: test and evidence instrument hygiene (19 rows)

**Outcome:** the two single-file instruments that serialise are fixed, and the independent rows are fixed by file.

**Owners:** `src/web/packages/editor/src/ui-copy.test.ts` (`vg-335`, `vg-338`), `src/web/packages/editor/src/ui-copy.ts` (`vg-337`), `scripts/design-md.mjs` (`vg-356`), and one file each for the rest.

**Constraints:** the copy walk and `design-md.mjs` are one seat each. `vg-337` is a copy table's exemption from the 800-line stop, so it is the one place a line-count rule is discussed rather than obeyed.

**Acceptance:** every one of the 19 has a run recorded against it; the two serialising files each have one author.

**Failure modes:** fixing a vacuous assertion by making it assert what the code already does; a line-count row closed by moving lines rather than by the exemption it asks for.

**Verify:** the focused vitest file per row; `npm run design:md` after the `design-md.mjs` change; `npm run backlog:check` at the batch's end.

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

Rows: `vg-135`.

- [ ] **Step 1: Grep `vg-186`'s line for the marker format.** No ruling, no change to this file.
- [ ] **Step 2: Reproduce the 50–90 s stall** with `npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx`.
- [ ] **Step 3: Apply the mechanism D9's `vg-186` ruling named** — DOM isolation, a separate file, or the leak.
- [ ] **Step 4: Run it, commit.**

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

**Outcome:** nineteen rows with a named single owner and no open ruling are fixed, two of them by a vitest gate rather than a browser run.

**Owners:** one file per row. `vg-304` and `vg-320` are the `PARITY` reader in `src/web/tests/e2e/mockup-values.test.ts` (vitest). `vg-331` is a `§4` clause plus six palette values in `DESIGN.md` and the palettes.

**Constraints:** parallel-safe **by file** — several seats, no shared file. `vg-304`/`vg-320` are the parity reader's two rules and pair with W1's design-language rows as one gate, but are not deferred and run under vitest.

**Acceptance:** each row's own check; `vg-320`'s identifier is `RADIUS` at `design-language.spec.ts:2887` (§8.6), not `SCALE` at `:2541`.

**Failure modes:** two seats on one file; a `§4` clause added without the six palette values that satisfy it.

**Verify:** the focused vitest file or the browser case per row; `npm run gates:self-test` after the parity reader changes.

### Task 8.1: The parity reader's two rules

**Files:**
- Modify: `src/web/tests/e2e/mockup-values.test.ts`
- Modify: `docs/product/backlog.jsonl`

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

- [ ] **Step 1: Grep `vg-308`, `vg-331` and `vg-334`'s lines for the marker format.** §5.1 files two of the fifteen rules on "§4 and the palette derivation case", and this is that seat; a ruled row with no clause is a rule still unbuilt. `vg-308` is browser-pinned and is ruled by Task 2.5 Step 4, so this seat takes `vg-331` and `vg-334` and waits for `vg-308`.
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

# Parked rows — held, not a phase

`vg-330` is parked by the user (2026-10-11) and `vg-322` is parked transitively: it closes when `vg-330` does and carries no independent work. **No phase owns them.** `vg-322`'s rule in §5.1's owner table stays unbuilt until `vg-330` is unparked, and W9's `vg-292`/`vg-293` are independent of it. They are named in the drain's final report so the count is legible: 22 closed, 0 withdrawn unless a D9 ruling withdraws one, 109 worked, 2 parked.

# The Backlog Reproduction Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sort all 216 open register rows at HEAD into *closes with evidence*, *needs a user decision* and *real work*, so the drain gets a spec instead of a session of ad-hoc fixes.

**Architecture:** Six parallel triage tasks, each owning a fixed, gapless batch of row ids, then one synthesis task. **The batches below were cut from the register as it stood at 215 rows; `vg-362` was filed during this plan's writing and belongs to B6.** If the register grows again before the pass runs, the batches are re-derived from `docs/product/backlog.jsonl` rather than trusted — a frozen id list silently stops covering the register the moment anything is filed. **This plan fixes nothing.** It reads, reproduces and classifies; every output is a verdict about a row plus the evidence for it. The batches are cut by id coverage rather than by theme, so that "every row was looked at" is provable — thematic grouping happens once, at synthesis, where all six tables are visible at once.

**Tech Stack:** `docs/product/backlog.jsonl`, the repo at HEAD, and a browser only where a row's own claim is about a red or flaky spec.

**Spec:** the user's ruling of 2026-10-11 is the binding authority here — the drain opens with a reproduction pass, and the "no rule reads X" rows are first-class work rather than deferred. The register's own rules are in `AGENTS.md`.

## Global Constraints

- **Nothing is fixed, closed, withdrawn or edited.** Rows keep their state. A row that no longer reproduces is reported as closable **with its evidence**, and closing happens later, in the drain proper. `docs/product/backlog.jsonl` and `backlog-archive.jsonl` are **read-only** in this plan.
- **A verified row needs two things, and neither substitutes for the other**: a `check` naming a word from the row's own `title` — so a check of a capability *nearby* is not a check of this row — and an `artefacts` sha that resolves **and is an ancestor of HEAD**.
- **A row's wording being unchanged says nothing.** The redesign moved underneath these rows; days-old text about live code is exactly what this pass exists to test. Triage at HEAD, never from the row's prose.
- **A negative claim needs its search named.** "No gate reads X" is only worth what the recorded search is worth. Name the command and its result.
- **Browser reproductions serialise.** `--workers=1`, never two Playwright suites at once (strictPort 4173/4174), and **show the test count** — a `--grep` matching nothing exits 0 having run zero tests.
- **Build before browser runs**: `npm run build`, then `npm run build:fixture -w @vigilia/editor`.
- **Do not touch** plugins, skills, hooks, MCP servers, Claude/Codex settings, `AGENTS.md`, `STATUS.md` or `DESIGN.md`.
- **Read-only does not mean unverified.** Every verdict carries the command or file that produced it.

## Review Focus

The five ways this pass could produce a confident-looking table that is wrong. Each gets its guard written into the batch it belongs to.

1. **A row closed because its *symbol* moved** — the grep is empty, so the row looks dead, but the behaviour is alive under a new name. A `verified` close needs the *behaviour* checked, not the string.
2. **A row classified as real work when it is a decision** — the fix is obvious once someone rules, and no amount of triage replaces the ruling. The decision class is the one that should be *small and sharp*.
3. **A chromium-only reproduction reported as universal** — flags and edge cases may be involved.
4. **A flake reported as a defect, or a defect as a flake** — one sample is not a measurement. Anything that fails must be re-run before it is called either.
5. **A batch that quietly skips rows.** The id list is the contract; a batch that reports 34 verdicts from 36 ids has a hole, and the hole is invisible unless the count is asserted.

---

### Task 1: Triage batch B1 — `vg-023` … `vg-154`

**Files:** none modified. Read: `docs/product/backlog.jsonl`.

**Interfaces:**
- Consumes: the row ids `vg-023 vg-028 vg-029 vg-037 vg-040 vg-041 vg-051 vg-056 vg-087 vg-104 vg-107 vg-109 vg-110 vg-111 vg-112 vg-113 vg-115 vg-116 vg-117 vg-123 vg-124 vg-129 vg-130 vg-133 vg-135 vg-137 vg-138 vg-140 vg-141 vg-142 vg-143 vg-144 vg-147 vg-150 vg-152 vg-154`.
- Produces: `triage-B1.md`, whose shape every later batch matches.

- [ ] **Step 1: Write `triage-B1.md` with one row per id, and a verdict for each.** Sections, one line each: the id; the verdict — `closes` / `decision` / `work`; the evidence (the exact command or `file:line`); one phrase of theme; and for `decision`, the single sentence the user would have to answer.

- [ ] **Step 2: Triage oldest-first, and expect the oldest to be the most changed.** These rows predate the redesign entirely. A claim about the editor's old layout may now be about a surface that was rebuilt — which makes it closable, *not* because it was fixed but because its subject is gone. Say which of the two it is; "the surface was rebuilt" and "the defect was fixed" are different closes.

- [ ] **Step 3: For anything about a browser spec, reproduce it.** Build, then run the one spec with `--workers=1` and **report the test count**. Re-run before calling it a flake (Review Focus 4). If it fails, say whether it fails in isolation as well as in the suite.

- [ ] **Step 4: Assert the batch's own coverage.** The file must carry **36** verdicts for 36 ids. State the count in the file and in your report.

- [ ] **Step 5: Commit.** `docs(drain): triage B1 of the reproduction pass` — explicit paths only. No register edit.

---

### Task 2: Triage batch B2 — `vg-155` … `vg-199`

**Files:** none modified. Same interfaces and steps as Task 1, with these ids:
`vg-155 vg-156 vg-158 vg-159 vg-160 vg-161 vg-162 vg-163 vg-164 vg-166 vg-167 vg-168 vg-169 vg-170 vg-171 vg-172 vg-174 vg-175 vg-177 vg-178 vg-179 vg-181 vg-182 vg-184 vg-185 vg-186 vg-188 vg-189 vg-190 vg-191 vg-192 vg-195 vg-196 vg-197 vg-198 vg-199`

- [ ] **Steps 1–5 as Task 1**, producing `triage-B2.md`, **36 verdicts for 36 ids**.
- [ ] **Note for this batch:** it carries the repo-wide ones — `vg-192` (`tests/e2e/` in no tsconfig) and `vg-198`/`vg-199` (docs map, archive rows). For these, the question is not "does it reproduce" but **"is it still the right row"**: a row saying a whole family is unchecked should be checked against the family as it exists now, not as it existed when filed.

---

### Task 3: Triage batch B3 — `vg-201` … `vg-238`

**Files:** none modified. Same interfaces and steps as Task 1, with these ids:
`vg-201 vg-202 vg-203 vg-204 vg-206 vg-208 vg-209 vg-210 vg-211 vg-212 vg-213 vg-214 vg-215 vg-216 vg-217 vg-218 vg-219 vg-220 vg-221 vg-222 vg-223 vg-224 vg-225 vg-226 vg-227 vg-228 vg-229 vg-230 vg-231 vg-232 vg-233 vg-234 vg-235 vg-236 vg-237 vg-238`

- [ ] **Steps 1–5 as Task 1**, producing `triage-B3.md`, **36 verdicts for 36 ids**.
- [ ] **Note for this batch:** it opens the two families that dominate the register — **design-language conformance** (`vg-201`…`vg-231`, each a claim that a surface contradicts a rule) and **the ownership map's gaps** (`vg-232`…`vg-238`). For a conformance row, check the surface at HEAD against the rule's current text in `DESIGN.md`, because several rules were themselves amended during the redesign. For an ownership row, check if the code moved.

---

### Task 4: Triage batch B4 — `vg-239` … `vg-276`

**Files:** none modified. Same interfaces and steps as Task 1, with these ids:
`vg-239 vg-240 vg-241 vg-242 vg-243 vg-244 vg-245 vg-246 vg-247 vg-248 vg-249 vg-251 vg-252 vg-254 vg-255 vg-256 vg-257 vg-258 vg-259 vg-260 vg-261 vg-262 vg-263 vg-264 vg-265 vg-266 vg-267 vg-268 vg-269 vg-270 vg-271 vg-272 vg-273 vg-274 vg-275 vg-276`

- [ ] **Steps 1–5 as Task 1**, producing `triage-B4.md`, **36 verdicts for 36 ids**.
- [ ] **Note for this batch:** it holds the **line-count rows** (`vg-209`, `vg-255`, `vg-276`), which are the cheapest in the register to check — the file is either past the stop or it is not — and the **dead-symbol rows**, which are the easiest to get wrong (Review Focus 1: an empty grep means the *string* moved, not that the behaviour died).

---

### Task 5: Triage batch B5 — `vg-278` … `vg-324`

**Files:** none modified. Same interfaces and steps as Task 1, with these ids:
`vg-278 vg-279 vg-280 vg-281 vg-282 vg-283 vg-284 vg-285 vg-286 vg-287 vg-288 vg-289 vg-290 vg-291 vg-292 vg-293 vg-296 vg-300 vg-301 vg-304 vg-306 vg-308 vg-309 vg-310 vg-311 vg-312 vg-313 vg-314 vg-315 vg-316 vg-317 vg-319 vg-320 vg-322 vg-323 vg-324`

- [ ] **Steps 1–5 as Task 1**, producing `triage-B5.md`, **36 verdicts for 36 ids**.
- [ ] **Note for this batch — the most important one.** It holds most of the **"no rule reads X"** rows, which the user ruled are **first-class work to be built during the drain, not deferred and not waived**. Each of these is a *gate that does not exist yet*, so the verdict is rarely `closes`: say what the gate would read, what owns it, and whether it is one rule or several. **Do not merge them into one row** — several are separate holes and the user ruled they are separate work.

---

### Task 6: Triage batch B6 — `vg-325` … `vg-361`

**Files:** none modified. Same interfaces and steps as Task 1, with these ids:
`vg-325 vg-326 vg-327 vg-328 vg-329 vg-330 vg-331 vg-332 vg-333 vg-334 vg-335 vg-336 vg-337 vg-338 vg-339 vg-340 vg-341 vg-342 vg-343 vg-344 vg-346 vg-347 vg-348 vg-349 vg-350 vg-352 vg-353 vg-354 vg-355 vg-356 vg-357 vg-358 vg-359 vg-360 vg-361 vg-362`

- [ ] **Steps 1–5 as Task 1**, producing `triage-B6.md`, **36 verdicts for 36 ids**.
- [ ] **Note for this batch:** it is the newest and the least settled — it includes rows filed today, whose subjects were verified hours ago, and **three rows (`vg-359`, `vg-360`, `vg-361`) that are known to reproduce** because the capture run reproduced them. For those, `closes` is not available; the useful output is what each needs. It also holds `vg-330` (**parked by the user** — verdict `parked`, not `work`), `vg-331` (a decision the user already named), and `vg-353` (a dependency advisory).

---

### Task 7: Synthesis — the triage that becomes the drain's spec

**Files:**
- Create: `docs/superpowers/specs/2026-10-12-the-backlog-drain-design.md`

**Interfaces:**
- Consumes: `triage-B1.md` … `triage-B6.md`. Produces: the spec the drain is planned from.

- [ ] **Step 1: Prove the coverage before reading for meaning.** 216 verdicts for 216 ids, no id twice — **re-derived from the register at run time, not from this plan's lists**, which were cut at 215. **State the count.** A synthesis over six files with a hole inherits the hole and launders it.

- [ ] **Step 2: Write the three lists.** Every row appears in exactly one:
  - **closes with evidence** — with its `check` and its `artefacts` sha, both already verified as resolving and ancestor-of-HEAD;
  - **needs a user decision** — one sentence per row, and what changes under each answer. This list is short and sharp or it is not a decision list;
  - **real work** — grouped into themed candidates, each with the rows it owns and whether it is a fix, a gate to build, or a design change.

- [ ] **Step 3: Check every `closes` against the `check` naming a word from its own `title`.** A check of a capability *nearby* is not a check of this row; those two false "landed" reports were both caught by the user testing, not by the register.

- [ ] **Step 4: Write the spec**, and mark each themed candidate as fitting `AGENTS.md`'s one-active-plan rule — several will not be parallel-safe, and saying which is part of the spec.

- [ ] **Step 5: Commit.** `docs(drain): the reproduction pass's triage, and the spec it produces`.

---

## Out of scope

- **Closing a row.** This plan classifies; the drain proper closes, and closing needs the user's rulings on the decisions list.
- **Fixing anything.** A defect found *by* this pass is filed as a new row, not repaired — the pass's value is that it changes no source, so its verdicts cannot be invalidated by its own edits.
- **The keyboard walkthrough.** It is written and queued; `STATUS.md` names this plan as active while it waits.

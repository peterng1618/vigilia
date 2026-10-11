# The Dead-Code Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The repo loses the code nothing uses — modules, exports, branches, selectors and stale docs left behind by several rounds of refactoring — and the register rows that named them are discharged rather than duplicated.

**Architecture:** Review each manager's role and redistribute what it is not mapped to own, then build the reference picture, then remove by owner. **The hard part is not deleting, it is deciding what is dead**, and this repo makes that unusually easy to get wrong: `data-vigilia-*` attributes, `--vigilia-*`/`--shell-*` custom properties, `KIND_*` registries and Fabric JSON keys are all resolved by *string*, and four gate scripts read the source tree as **data**. So Phase 2 produces a candidate report with its searches recorded, Phase 3 verifies and removes one owner at a time, and no candidate is deleted on the strength of an empty `grep` alone.

**Four phases, in the order the user set on 2026-10-12 — managers, then dead code, then the register.** Phase 1 redistributes the manager layer (Tasks 8–9), Phase 2 builds the reference picture (Tasks 1–3), Phase 3 verifies and removes by owner (Tasks 4–6), Phase 4 makes the register agree with the tree (Task 7). The three removal phases are judged by what disappeared; Phase 1 is judged by what *moved* without moving anything else.

**Task numbers are stable identifiers, not positions, and the plan does not renumber them.** Task 1's scanner is already built and verified, and every ledger entry, task brief, review package and dispatch record cites tasks by number — so a renumbering would silently repoint a dozen existing references at the wrong task. The phase headings carry the order.

**Why managers go first, and it is not just preference.** A redistribution moves code between owners, so it changes the tree a dead-code scan reads: running the sweep first would produce a candidate set that redistribution then invalidates, and Phase 3 would have to be redone against the settled structure. The scanner is re-run at the start of Phase 2 for exactly that reason. Manager work touches no deletion and deletion touches no ownership, so the order costs nothing in either direction.

**Phase 1 is a different kind of change and is marked as one.** The manager layer's review and redistribution (requested by the user) turned out on measurement to contain **no dead code at all** — all 20 managers have production references — so it is a behaviour-preserving ownership refactor whose acceptance is that *nothing* changes, not that something disappeared. It sits in this plan because the user asked for it here, and it is separated because judging it by the removal phases' standard would be judging it backwards.

**Tech Stack:** node (`node:fs`, no new dependency), the TypeScript compiler already in the workspace, and the repo's own gate scripts.

**Spec:** the user's instruction of 2026-10-12 is the authority — *"the app has been through multiple rounds of refactoring on both backend & frontend. Do a deep sweep to remove dead/stale codes throughoutly."* The binding constraints are `AGENTS.md`'s **Reuse before build** and **Architecture guardrails** sections.

## Global Constraints

- **All seven packages are `private: true`.** There is no published surface, so "it might be public API" is not a defence for keeping an unreferenced export, and `AGENTS.md` permits pre-release internals to break cleanly.
- **A register claim is not evidence.** `vg-283` saying FontPicker has no production mount is a claim to reproduce at HEAD, not a licence to delete. Every removal re-establishes its own fact first, and records the command that did.
- **Empty `grep` is not proof of death.** This repo has a documented case of a symbol *moving* rather than dying, and the vocabulary below is resolved by string. A candidate is dead when the search is named **and** the reason that search is sufficient is stated.
- **The bias is toward keeping, and the user set it: *"I want a clean codebase but be careful to not overdo it and break the app"* (2026-10-12).** A candidate that survives the sweep costs a later ticket; a live symbol deleted costs a broken product and a hunt through git. **No candidate is removed on one detection signal**, and when a finding has two opposite remedies behind one name, it is unresolved — report it, do not pick. Every removal names the gate or the behaviour that would have caught it if it were wrong.
- **String-resolved vocabulary — the false-positive engine.** `data-vigilia-*` attributes (read by specs *and* CSS), `--vigilia-*` and `--shell-*` custom properties (read by `design-tokens.mjs` and the palettes), `KIND_*`/descriptor registries keyed by string, Fabric JSON property names (the persisted scene), CSS classes composed by template literal, and palette/token names.
- **A file's content can be load-bearing with nothing importing the file.** `design-md.mjs`, `design-tokens.mjs`, `ownership-sweep.mjs` and `reuse-gate.mjs` read the source tree as data. Deleting a token name or a `§N`-bearing comment can redden a gate that never imports anything.
- **Discovery is an edge.** Vitest globs the 244 `*.test.ts(x)`, Playwright globs the 48 specs, and neither is imported by anything. Every test file is an entry point; a detector that misses this reports the whole suite as dead.
- **Entry points to exclude:** `packages/*/index.html`, `packages/player/src/main.ts`, `packages/host/src/main.ts`, `packages/host/bin/vigilia.js`, the vite/playwright/vitest configs, `scripts/*.mjs` and `src/web/scripts/*.mjs`.
- **Dynamic import is real but narrow** — `packages/host/src/providers/library.ts`'s `await import("systeminformation")`, and test-module factories (`vi.mock`, `importOriginal`). Not handling it produces live code reported as dead.
- **`.mjs` is in no gate at all.** Biome's `files.includes` is `src/web/**/*.{ts,tsx,json,css}`, so the ten `scripts/*.mjs` and `src/web/scripts/*.mjs` are neither linted nor formatted, and no tsconfig includes them.
- **`dist/**` is build output** and is never scanned or edited. It is correctly ignored, and **zero build output is tracked** — checked, so no task needs to spend time on that lane.
- **`.superpowers/` is untracked as of 2026-10-12 (the user's ruling) and ignored at `.gitignore:90`.** It was 744 files on disk of which 20 were tracked despite a bare `*` in `sdd/.gitignore` — an ignore rule and a tracked set that contradicted each other. **It is still not the sweep's to scan, clean or delete.** Untracked is not disposable: the ledgers are the only *local* home of rulings that were never promoted into `docs/decisions/`, and a reference sweep that treats "not in git" as "safe to remove" would destroy them. The sweep does not touch that tree at all.
- **Deleting is not a licence to restructure.** Remove what is dead; do not reorganise what is alive. 500 lines signals and 800 stops for anything that survives.
- **Read a run's own report, and apply its `incomplete` marker.** Three traps land on the same habit. `src/web/test-results/summary.json` reads green for the walkthrough's deliberately-red census because it is *another project's* run — so no dispatch cites it, and every browser run names its own report path and the project it ran. The scanner's two report files carry `incomplete: true` from start-up, because a run that crashes used to leave the previous run's pass on disk; the endorsed predicate is `isCompletePass` in the script, and a bare `passed === total` reads a `0/0` marker as a vacuous pass. And the exit code alone is not the answer either — a red `desktop-host` project is expected here (the walkthrough's census), so an agent that reads only the exit code reports its own damage where there is none.
- **Do not touch** plugins, skills, hooks, MCP servers, Claude/Codex settings, `AGENTS.md`, `STATUS.md` or `DESIGN.md`.

## Review Focus

The five ways this sweep deletes something alive.

1. **A symbol whose name is composed at runtime** — a `data-vigilia-${kind}` attribute, a class from a template literal, a token read via `getPropertyValue`. The grep for the literal is empty and the code is live.
2. **A test-only module that a specified feature will mount.** FontPicker is the case in the register: no production mount, but a 984-line test. Deleting it may destroy intended work — so it is a **decision**, and this plan reports it as one rather than settling it.
3. **A file a gate reads as data.** The gates walk the tree; a "dead" constant can be the thing `design-tokens.mjs` asserts against.
4. **A stale *reference* mistaken for stale *code*** — a doc naming a deleted module (`vg-275`) is a docs fix, not a deletion, and the two have opposite remedies.
5. **Removing the code and leaving the register row open**, so the next session re-finds it as a fresh defect.

---

---

### Phase 1 — the manager layer's review and redistribution

**`vg-364` owns this phase, and its history was recovered from the transcripts rather than assumed.** The request is **from 2026-10-09, not 2026-10-12**, and it has already been partly done:

- **2026-10-09, the original ask:** *"Does any domain managers need some clean up? I.e. same domain ownership spread across a few managers. A domain under another manager needs to become a manager of its own. Etc"* — and an hour later, **the reverse:** *"does any manager turned out to be too small/narrow of a concept to stand on it own and should be folded into another?"* What prompted both, in the user's words: *"the fact that we now have several files crossed the 500 lines threshold."*
- **A read-only survey was run and filed 17 rows, `vg-232`–`vg-248`**, all still open three days later. The user then said *"File the manager issues in the backlog for now then"*, and the cleanup was **deferred to plan 3's close** (commit `47d47d32`, with the ordering recorded in `STATUS.md`).
- **That condition has long passed** — plan 3 closed, and the redesign programme with it — and nothing picked the work up. That is why the user re-raised it on 2026-10-12, and then had to ask whether it was tracked at all.

**Two of the three questions therefore have answers already, and this phase must not re-open them:**

- **The reverse question is answered: no manager is too small to stand on its own.** Measured on 2026-10-09 by reading the bottom of the size list in full — `layer-manager` (68 lines) owns Fabric's membership trap in `ownerOf`; `deletion-manager` (62) owns *"a removal that found nothing is not a deletion"*; `object-lock-manager` (129) owns the transform-flag derivation, including that undo revives a locked object at Fabric's defaults. Each is small and owns a decision nobody else owns. **A merge now needs a new argument, not a size threshold.**
- **The size question is a signal with a corpus already attached**, and the numbers have *improved*: 35 files over 500 and 15 over the stop on 2026-10-09, against 32 and 12 at HEAD on 2026-10-12.

**And the instrument is not the line count — the survey said so at the time.** `ownership.md` carries its own test, which is the spine of Task 8:

> *for each row, find the code that would reject a wrong value for that concept — the guard, the validator, the `refuse` — and ask whether it lives in the module the map names. A guard in an unnamed module is a missing row or a wrong owner.*

**That is what found `vg-232`–`vg-246`; a line count never would have.**

**So this is a review of ROLE, not just of the map's accuracy, and it has two named questions rather than one:**
- **A manager that has grown too big may own a concept that deserves to be an independent manager** — the split case. `snap-manager` is the size case, and **the census is the measurement rather than this sentence**: `docs/architecture/manager-census.md` measured it at 30 non-test files, four of them past the 800 stop. Against one map row — *"Drag-time snapping and smart guides"* — that is one name for *snapping*, *spacing* **and** *scale-gesture projection*.

  **And the census demotes it anyway, which is the part this plan had backwards.** `snap-manager` is reached by **one** external production module (`editor-session.ts`), so its blast radius is internal and its fix is a protocol re-shape needing a spec, not an extraction. **It ranks last of ten candidates.** The plan previously called it the worked example of the split, which would have sent Task 9 at the largest and least tractable candidate first. See Task 9's ordering rule.
- **A concept may be spread across several managers** — the consolidation case. The register already holds the evidence without ever having filed it as this: `vg-240` (one acquire-hold-plan-verify protocol implemented twice), `vg-247` (the lock manager owns *writing* the `locked` flag but not *testing* it, so nine files across seven managers spell the predicate), `vg-237` (`controls-manager` owns a Line's four document scalars and a text box's height), and `vg-232`–`vg-248` generally.

**What the size measurement found, at HEAD on 2026-10-12, and re-measured by the census:** 32 non-test files at or past 500 lines and 12 past the 800 stop — the two figures that reproduce exactly under every scope variant tried. **Four earlier numbers were wrong and are corrected here** — this plan said `snap-manager` was "eight files and roughly 7,000 lines" where the census measures 30, a ledger ruling recorded 5,978 across five, a denominator of "317 non-test of 610 source files" was written into this plan and a register row without ever stating what was scanned, and `snap-manager`'s lines were cited as 10,671 where the census says 10,701. None was a lie and none was the same measurement. **Two counting conventions are why:** top-level and recursive counts differ by more than a factor of two here, and a line total depends on whether a file's trailing newline is counted as a line. **So this phase cites the census's file counts and never its line totals** — a bare count is not evidence. Two exceptions are not defects and must not be split to satisfy a number — `font-trios.generated.ts` (28,284 lines) is **generated**, and `editor-shell.css` (2559) is already owned by `vg-274`. The four per-file rows already on file (`vg-209`, `vg-255`, `vg-276`, `vg-337`) are this phase's evidence, not its scope.

**It is still not a deletion lane.** All 20 managers have production references; none is dead. Reading this as dead code would produce a plan to delete live modules, which is the failure the sweep exists to avoid.

**And it is not a line-count chore.** `AGENTS.md` calls 500 a signal and 800 a stop, so **the count is what found this, not what fixes it.** Splitting a file until both halves sit under the threshold while both go on owning the same concept is the failure mode, and it is the one move this phase forbids. The unit of work is a *concept and its owner*, never a line budget.

**Acceptance inverts against the other three phases: nothing may change behaviour.** The 13,200 lines of manager tests are the harness, and a change that turns one of them red is a defect rather than a refactor. Removal phases are judged by what disappeared; this one is judged by what moved without moving anything else.

### Task 8: The manager census against the ownership map

**Files:** none modified. Reads `src/web/packages/editor/src/*manager*/**`, `docs/architecture/ownership.md`, and the register's ownership rows.

- [ ] **Step 1: Use `ownership.md`'s own guard test, which is the instrument that already worked.** For each map row, find the code that would **reject a wrong value** for that concept — the guard, the validator, the `refuse` — and ask whether it lives in the module the map names. *A guard in an unnamed module is a missing row or a wrong owner.* That is what found `vg-232`–`vg-246` on 2026-10-09, and it found things a line count could not. Take the inventory from the code, not the table: **a register claim is not evidence** (Global Constraints).
- [ ] **Step 2: Answer the user's two questions explicitly, one manager at a time.** For each of the 20: **(a)** does it own more than one concept, such that one of them deserves an independent manager? **(b)** is any concept it owns also decided by another manager? Answer both for every manager and print the two lists, including the managers where the answer is no — a census that only lists problems makes its own clearance rate invisible.
- [ ] **Step 3: Bring the size measurement in as a signal, and say where it points and where it does not.** The measured set is 32 files at or past 500 lines, 12 past the 800 stop. **A file's length is a hint about a concept boundary, not the boundary itself** — `snap-manager`'s five files are the case where the two agree, and `font-trios.generated.ts` (28,284 lines, generated) is the case where length means nothing. Name which over-limit files are a concept problem and which are merely long.
- [ ] **Step 4: Rank the candidates by blast radius, not by line count.** `snap-manager` holds four of the twelve files past the stop. **The reach figure this step originally gave was wrong, and the census corrected it:** it said "reached by 11 production modules", which is a *fork's* feature-scope count from `docs/superpowers/specs/2026-09-25-snapping-fidelity.md` restated as importers — `snap-manager/` also happens to hold eleven test files, a second way to land on the same wrong number. It is reached by **one** production module (`editor-session.ts`). A manager owning one stray scalar is a smaller move. Say which candidates are a clean extraction and which are cross-cutting.
- [ ] **Step 5: Fold in the register rather than re-finding it.** `vg-232`–`vg-248` already name most of this family. Each citation is re-established at HEAD, and the census says which rows it confirms, which it contradicts, and which it found that no row names. `vg-364` is this phase's own row and `vg-209`, `vg-255`, `vg-276` and `vg-337` are its per-file evidence.
- [ ] **Step 6: Report the dead-or-over-owning question separately.** A manager that has production references may still contain a *dead method*; that is Task 1's scanner's job (Phase 2), not this task's, and the census does not duplicate it.
- [ ] **Step 7: Commit.** `docs(sweep): the manager census against the ownership map`.

### Task 9: Redistribute the confirmed mismatches, one owner at a time

**Files:** `src/web/packages/editor/src/**` and `docs/architecture/ownership.md`.

**Task 9 consumes `docs/architecture/manager-census.md` and orders its candidates by the census's SHAPE LABELS, not by its rank numbers — this is the ordering rule and it is not optional.** The census lists ten candidates and marks each *clean extraction* or *cross-cutting*. **The rank numbers are stable identifiers, not a priority** — exactly as this plan's task numbers are. **The census review found its §6 ordering is not the descending-reach order its header claims**: its own Reach column reads 9, 4, 6, 3, 1, 2, 2, 7, 1, 0, so rank 8 holds the second-highest reach, the column mixes units across rows (modules in one, "owners" in another, "sites" in a third), and rank 5's position is justified by **size**, which this phase forbids. **Ordering by rank would therefore reproduce the precise mistake this rule exists to prevent**, so the numbers stay as identifiers and the labels do the ordering:

- **Ranks 4, 5, 6 and 9 are clean extractions and go first** — the three `vigiliaText.box` writers (`scene-fabric/src/authored-box.ts` already claims the job), the save protocol base (~250 lines out of `editor-session.ts`, the largest single reduction available and the one move that *creates* a manager), `controls-manager`'s document writes, and `object-actions`' eligibility agreement. Each has a named owner already, so the move relocates a decision rather than inventing one.
- **Ranks 1, 2, 3 and 7 are cross-cutting and each waits on a decision that has not been made.** Rank 1 (the `locked` predicate, 11 sites across 9 files and 7 managers — the census says "modules" where it means "files") needs its owner settled — the import-graph ordering between `object-lock-manager` and its readers is the question `vg-247` has waited on, and **the census did not compute a topological order, so that is work Task 9 must do before it moves anything**. Rank 7 (the contain rule) may be a deliberate second rule rather than a drifted copy, which is a decision rather than a read. **Do not start with a cross-cutting candidate because it carries a low rank** — reach is the reason to be careful, not the reason to be first.
- **Rank 8 is a map row and rank 10 is documentation** — no code moves.
- **`snap-manager` is not a candidate for extraction at all**, despite being the largest code problem: one external production module reaches it, and its fix is a protocol re-shape needing a spec. Splitting it is not this task's, and the census says so.

- [ ] **Step 1: One manager per commit, and one concept per commit within it.** A move that relocates three concepts at once cannot be reviewed, and this phase's whole risk is an invisible behaviour change.
- [ ] **Step 2: Move the decision, not the code.** The rule is `AGENTS.md`'s one owner per concept: after the move the *old* site stops deciding, and reads the owner's answer instead. A redistribution that leaves both sites deciding has added a second owner, which is worse than the mismatch it set out to fix.
- [ ] **Step 3: Update the map in the same commit as the move.** A map that lags its code is how `vg-244` came to contradict itself on z-order, grouping and locks.
- [ ] **Step 4: Run the manager tests and report the count, before and after.** `vg-239` records that a save-picture expression is written twice; a redistribution that makes the two sites agree by changing one of them silently is the failure mode.
- [ ] **Step 5: An extraction creates an owner, so it updates the map, the barrel and the importers in the same commit.** A new manager that no document names is a concept with no declared owner, which is the state `vg-246` records as a "named gap that reads as unfilled".
- [ ] **Step 6: Do not merge a manager on size, and do not introduce an abstraction over them.** The reverse direction was **measured on 2026-10-09 and found no candidate** — `layer-manager`, `deletion-manager` and `object-lock-manager` are the three smallest and each owns a decision nobody else owns — so **a merge needs a new argument about a concept, never a line count**, and re-answering that question from scratch is re-doing work already done. The *count* of managers is not the defect either, and a `BaseManager` is the framework-rebuild this repo's Reuse section exists to prevent. The defect is a manager owning a concept that is not its own — a bigger manager is not the fix for a manager that is too big.

---

---

### Phase 2 — the reference picture

### Task 1: The reference scanner

**Files:**
- Create: `scripts/dead-code-sweep.mjs`
- Test: `scripts/dead-code-sweep.test.mjs` — **the repo's scripts are untested today; this one carries its own self-test**, or `--self-test` in the same file if a sibling test is the wrong shape.

**Interfaces:**
- Produces: `node scripts/dead-code-sweep.mjs` → a report to stdout and, with `--json <path>`, to a file. Every candidate carries `{ kind, file, symbol?, evidence }`.

- [ ] **Step 1: Build the importer graph.** Walk every `.ts`/`.tsx` under `src/web/packages/*/src`, `src/web/tests`, `src/web/scripts` and `scripts/`. For each file extract static `import`/`export … from` specifiers, **dynamic `import(...)`**, and test-module factories. Resolve each specifier to a path (`@vigilia/*` → the package's `src/index.ts` per the tsconfig paths; `./x.js` → `./x.ts`).

- [ ] **Step 2: Emit six candidate kinds**, each recording the search that found it:
  - **`test-only-consumer`** — a module or export whose *only* importers are test files. **This is the class this repo actually produces**: several rounds of refactoring leave a surface mounted by no product code but kept alive by its own test. It is neither "no importer" nor "no production caller", so a scanner with only those two finds nothing here — and `font-picker.tsx` is the worked case.
  - **`no-importer-file`** — a module nothing imports, excluding every entry point and every file vitest/Playwright discovers by glob.
  - **`dead-export`** — exported, and the name appears nowhere else **including its own file**. The symbol is dead, and the action is to delete the declaration.
  - **`redundant-export`** — exported, but **every use is inside its own declaring file**. The symbol is alive and only the `export` keyword is unnecessary, so the action is to delete one word, not the code.
  - **These two are separate kinds because they have opposite remedies**, and the Tier-1 review that split them is the reason: a removal agent budgeting against a single "dead exports" count would break files or claim a reduction that never materialises, when the honest action for most of them is deleting a keyword. Each row's `evidence` states its tier, and the tier is the name counted in its own file **outside quoted strings** — a JSDoc mention does not keep a symbol alive, and a type named only in another export's signature in the same file does.
  - **No count from this step is an invariant, and two measurements disagree.** The review measured 33 dead / 260 redundant by raw text; the scanner measures 14 / 279 by the rule above, the difference being type declarations named in a sibling export's signature and one JSDoc mention. **The disagreement is the point rather than a problem to paper over** — the anchors are the worked cases, which both agree on: `settingsField()` is `dead-export`, `instantiateCard` is `redundant-export`. A task that needs a number takes it from a fresh run, never from this plan.
  - **`barrel-only-export`** — a name whose only importer is its own package's `index.ts`.
  - **`unreachable-branch`** — a discriminant or error variant no input can produce (the `vg-344` shape), reported only where the graph or a closed union makes it mechanical to see.

- [ ] **Step 3: A candidate is not a verdict — say so in the output.** Print each with the searches run, in the shape `ownership-sweep.mjs` already established ("Candidates, not verdicts"), and never delete anything.

- [ ] **Step 4: Prove the scanner separates known cases, in both directions.** **A scanner that reports everything, or nothing, has told you nothing.** Assert it lands on:
  - **`test-only-consumer`** for `packages/editor/src/font-picker/font-picker.tsx`, whose only importers are tests (`vg-268`, `vg-283` — the same finding filed twice, which Task 7 merges). **The path is `font-picker/`, not `editor-shell/`** — the false directory was in this plan's first draft *and* in the Task 1 dispatch prompt. The plan names no path at all, so the implementer followed the tree rather than the dispatch; the correction is recorded here because the error was the controller's, not the brief's.
  - **`dead-export`** for `settingsField()` in `packages/editor/src/editor-shell/controls/settings-field.ts` (`vg-342`), which has zero production callers.
  - **nothing at all** for a module on the live path — pick one the editor mounts at boot, and show it absent from every kind. A scanner with no negative case is untested.

- [ ] **Step 5: Commit.** `feat(sweep): the reference scanner for unused modules and exports`.

### Task 2: The selector reachability check

**Files:** none modified. Reads `src/web/packages/editor/src/editor-shell/editor-shell.css` (2558 lines) and `src/web/packages/host/public/vigilia-page.css` (254).

**Interfaces:**
- Produces: `<plan workspace>/dead-selectors.md`, consumed by Task 5's removal.

- [ ] **Step 1: Note why this lane needs naming at all.** Only **two** CSS files exist, so this does not want a scanner framework or a new task of its own weight — but `editor-shell.css` is the largest file in the repo, `vg-274` records it as being in **no gate**, and `vg-266` records two selectors in it that match nothing. Dead selectors are invisible to `typecheck`, to Biome (which parses CSS but has no unused-selector rule) and to every test.

- [ ] **Step 2: Extract every class and `data-*` attribute selector, then search the tree for each.** For each, the evidence is a named search over `.ts`/`.tsx`/`.html`/`.md`, and the report states why that search is sufficient. **Prefer one documented command over a script** — this is two files, and a re-runnable recipe in the report is worth more than another `scripts/*.mjs` that nothing runs.

- [ ] **Step 3: Treat a templated or composed name as live.** `data-vigilia-${kind}`, a class built from a variant, and anything reached through `classList` are Review Focus 1 — the literal is absent and the selector is live. Say which selectors you cleared for this reason, because a report that only lists hits makes the clearance rate invisible.

- [ ] **Step 4: Keep the `--vigilia-*`/`--shell-*` custom properties out of scope.** They are design tokens with their own owner and their own gate (`design-tokens.mjs`), and `vg-357` already owns an open defect in them.

- [ ] **Step 5: Commit.** `docs(sweep): the dead-selector report`.

### Task 3: Run both, and make the numbers reproducible

**Files:**
- Create: `<plan workspace>/candidates.md` — the run's report, committed beside the plan's ledger.

- [ ] **Step 1: Run at HEAD and record the counts by kind and by package.** A count recorded as evidence that a case was collected is an invariant; a count predicted before the code exists is not.

- [ ] **Step 2: Account for the two systematic holes before trusting any number.** `src/web/tests/e2e/**` is in no tsconfig (`vg-192`) and `.mjs` in no gate, so the scanner is those trees' *only* reader — say what it can and cannot see there.

- [ ] **Step 3: Commit.** `docs(sweep): the candidate report at HEAD`.

---

### Phase 3 — verify, then remove

Each task below owns one group of packages and follows the same contract: **for each candidate, re-establish the fact at HEAD; if it is dead, remove it and its test; if it is a decision, do not touch it and record the question; if it is live, say what the scanner missed.** A task that removes nothing is a valid outcome and must say so.

### Task 4: The editor package

**Files:** `src/web/packages/editor/**` — 322 source files, the largest and most refactored surface.

- [ ] **Step 1: Verify each candidate**, checking the string-resolved vocabulary (Review Focus 1) and the gate-input surface (Review Focus 3) before every removal.
- [ ] **Step 2: Remove the confirmed-dead, with their tests, in one commit per coherent group** — not one commit per symbol.
- [ ] **Step 3: Report the decision cases without settling them.** A module with no production mount but a substantial test is Review Focus 2, and the register already holds two such rows (`vg-268`, `vg-283`) — link them rather than opening a third.
- [ ] **Step 4: Run the gates and the affected tests, and report the counts.** `npm run typecheck`, `npm run lint`, the touched package's vitest run.

### Task 5: The host, player and shared packages

**Files:** `src/web/packages/{host,player,renderer-core,scene-fabric,theme-package,fake-source}/**`.

- [ ] **Step 1: Note the asymmetry before starting.** `host` is Node with `types: ["node"]`; the others are browser bundles where `@types/node` is *deliberately* absent. A removal that pulls a `node:` import into a browser package is a new defect, not a cleanup.
- [ ] **Step 2: Verify and remove as Task 4**, with the same evidence rules.
- [ ] **Step 3: Check the persisted-scene boundary explicitly.** In `scene-fabric` and `renderer-core`, a Fabric JSON property that nothing reads *in TypeScript* may still be the persisted scene's schema — that class is a decision, never a removal.
- [ ] **Step 4: Run the gates and the touched packages' tests, and report the counts.**

### Task 6: The ungated trees and stale references

**Files:** `src/web/tests/e2e/**`, `scripts/*.mjs`, `src/web/scripts/*.mjs`, and the docs that name deleted modules.

- [ ] **Step 1: These trees have no gate, so the sweep is their first reader** — treat a finding here as more likely to be real, and a *removal* here as more likely to be load-bearing to something outside the type system.
- [ ] **Step 2: Separate stale code from stale reference** (Review Focus 4). `vg-275`'s three decision records naming the deleted `PaletteMenu.choose`, and `vg-198`'s docs map, are prose fixes; they go in their own commit so code and docs are reviewable apart.
- [ ] **Step 3: Verify and remove as Task 4**, and run `gates:self-test` plus `design:check` — the gate scripts are themselves in scope, so their own gate must be green afterwards.

### Phase 4 — discharge the register

This phase removes nothing, and it is separated from Phase 3 because its acceptance is different: Phase 3 is judged by what disappeared from the tree, and this one by whether the register ends up agreeing with the tree. It runs last among the removal work because a `verified` row needs an `artefacts` sha, and a sha can only be cited once the removal that earns it exists.

### Task 7: Discharge the register rows this sweep settles

**Files:** `docs/product/backlog.jsonl`, `docs/product/backlog-archive.jsonl`.

- [ ] **Step 1: Grep the archive before touching either file** — it is the anti-double-report record.
- [ ] **Step 2: For each row the removals actually discharge, close it `verified`** with a `check` naming a word from its own `title` and an `artefacts` sha that resolves **and is an ancestor of HEAD**. Neither substitutes for the other.
- [ ] **Step 3: Report the duplicate pair rather than merging it silently.** `vg-268` and `vg-283` describe the same missing FontPicker mount, filed from two different plans. **Withdrawal is the user's decision, not the agent's** — `AGENTS.md` says a row is withdrawn only having reasoned with them. Report the pair with both titles side by side and leave both open until ruled on.
- [ ] **Step 4: Edit the two registers by raw line, never by a JSON round-trip** — a round-trip rewrites every row holding a `§` escape.
- [ ] **Step 5: Run `npm run backlog:check` from `src/web/`.**
- [ ] **Step 6: Commit.** `docs(backlog): the rows the dead-code sweep discharges`.

---

## Out of scope

- **The decision cases.** A module with no production mount that a specified feature may yet use is the user's call; this plan reports them with the question stated and does not settle them.
- **The other 138 open rows.** The drain's reproduction pass is written and queued (`2026-10-12-the-backlog-reproduction-pass.md`) and owns them; this plan touches only rows its own removals discharge.
- **A permanent gate.** The scanner is built to be re-runnable and is worth keeping, but turning it into a CI gate is a separate decision with its own false-positive budget — `ownership.md` already refuses a gate that flags 84% of rows, and a no-importer check on a pre-release codebase may be that shape.
- **The keyboard walkthrough**, which stays queued behind the drain.

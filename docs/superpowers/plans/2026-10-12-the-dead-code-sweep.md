# The Dead-Code Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The repo loses the code nothing uses — modules, exports, branches, selectors and stale docs left behind by several rounds of refactoring — and the register rows that named them are discharged rather than duplicated.

**Architecture:** Build the reference picture first, then remove by owner. **The hard part is not deleting, it is deciding what is dead**, and this repo makes that unusually easy to get wrong: `data-vigilia-*` attributes, `--vigilia-*`/`--shell-*` custom properties, `KIND_*` registries and Fabric JSON keys are all resolved by *string*, and four gate scripts read the source tree as **data**. So Phase 1 produces a candidate report with its searches recorded, Phase 2 verifies and removes one owner at a time, and no candidate is deleted on the strength of an empty `grep` alone.

**Tech Stack:** node (`node:fs`, no new dependency), the TypeScript compiler already in the workspace, and the repo's own gate scripts.

**Spec:** the user's instruction of 2026-10-12 is the authority — *"the app has been through multiple rounds of refactoring on both backend & frontend. Do a deep sweep to remove dead/stale codes throughoutly."* The binding constraints are `AGENTS.md`'s **Reuse before build** and **Architecture guardrails** sections.

## Global Constraints

- **All seven packages are `private: true`.** There is no published surface, so "it might be public API" is not a defence for keeping an unreferenced export, and `AGENTS.md` permits pre-release internals to break cleanly.
- **A register claim is not evidence.** `vg-283` saying FontPicker has no production mount is a claim to reproduce at HEAD, not a licence to delete. Every removal re-establishes its own fact first, and records the command that did.
- **Empty `grep` is not proof of death.** This repo has a documented case of a symbol *moving* rather than dying, and the vocabulary below is resolved by string. A candidate is dead when the search is named **and** the reason that search is sufficient is stated.
- **String-resolved vocabulary — the false-positive engine.** `data-vigilia-*` attributes (read by specs *and* CSS), `--vigilia-*` and `--shell-*` custom properties (read by `design-tokens.mjs` and the palettes), `KIND_*`/descriptor registries keyed by string, Fabric JSON property names (the persisted scene), CSS classes composed by template literal, and palette/token names.
- **A file's content can be load-bearing with nothing importing the file.** `design-md.mjs`, `design-tokens.mjs`, `ownership-sweep.mjs` and `reuse-gate.mjs` read the source tree as data. Deleting a token name or a `§N`-bearing comment can redden a gate that never imports anything.
- **Discovery is an edge.** Vitest globs the 244 `*.test.ts(x)`, Playwright globs the 48 specs, and neither is imported by anything. Every test file is an entry point; a detector that misses this reports the whole suite as dead.
- **Entry points to exclude:** `packages/*/index.html`, `packages/player/src/main.ts`, `packages/host/src/main.ts`, `packages/host/bin/vigilia.js`, the vite/playwright/vitest configs, `scripts/*.mjs` and `src/web/scripts/*.mjs`.
- **Dynamic import is real but narrow** — `packages/host/src/providers/library.ts`'s `await import("systeminformation")`, and test-module factories (`vi.mock`, `importOriginal`). Not handling it produces live code reported as dead.
- **`.mjs` is in no gate at all.** Biome's `files.includes` is `src/web/**/*.{ts,tsx,json,css}`, so the ten `scripts/*.mjs` and `src/web/scripts/*.mjs` are neither linted nor formatted, and no tsconfig includes them.
- **`dist/**` is build output** and is never scanned or edited. It is correctly ignored, and **zero build output is tracked** — checked, so no task needs to spend time on that lane.
- **`.superpowers/` is untracked as of 2026-10-12 (the user's ruling) and ignored at `.gitignore:90`.** It was 744 files on disk of which 20 were tracked despite a bare `*` in `sdd/.gitignore` — an ignore rule and a tracked set that contradicted each other. **It is still not the sweep's to scan, clean or delete.** Untracked is not disposable: the ledgers are the only *local* home of rulings that were never promoted into `docs/decisions/`, and a reference sweep that treats "not in git" as "safe to remove" would destroy them. The sweep does not touch that tree at all.
- **Deleting is not a licence to restructure.** Remove what is dead; do not reorganise what is alive. 500 lines signals and 800 stops for anything that survives.
- **Do not touch** plugins, skills, hooks, MCP servers, Claude/Codex settings, `AGENTS.md`, `STATUS.md` or `DESIGN.md`.

## Review Focus

The five ways this sweep deletes something alive.

1. **A symbol whose name is composed at runtime** — a `data-vigilia-${kind}` attribute, a class from a template literal, a token read via `getPropertyValue`. The grep for the literal is empty and the code is live.
2. **A test-only module that a specified feature will mount.** FontPicker is the case in the register: no production mount, but a 984-line test. Deleting it may destroy intended work — so it is a **decision**, and this plan reports it as one rather than settling it.
3. **A file a gate reads as data.** The gates walk the tree; a "dead" constant can be the thing `design-tokens.mjs` asserts against.
4. **A stale *reference* mistaken for stale *code*** — a doc naming a deleted module (`vg-275`) is a docs fix, not a deletion, and the two have opposite remedies.
5. **Removing the code and leaving the register row open**, so the next session re-finds it as a fresh defect.

---

### Phase 1 — the reference picture

### Task 1: The reference scanner

**Files:**
- Create: `scripts/dead-code-sweep.mjs`
- Test: `scripts/dead-code-sweep.test.mjs` — **the repo's scripts are untested today; this one carries its own self-test**, or `--self-test` in the same file if a sibling test is the wrong shape.

**Interfaces:**
- Produces: `node scripts/dead-code-sweep.mjs` → a report to stdout and, with `--json <path>`, to a file. Every candidate carries `{ kind, file, symbol?, evidence }`.

- [ ] **Step 1: Build the importer graph.** Walk every `.ts`/`.tsx` under `src/web/packages/*/src`, `src/web/tests`, `src/web/scripts` and `scripts/`. For each file extract static `import`/`export … from` specifiers, **dynamic `import(...)`**, and test-module factories. Resolve each specifier to a path (`@vigilia/*` → the package's `src/index.ts` per the tsconfig paths; `./x.js` → `./x.ts`).

- [ ] **Step 2: Emit five candidate kinds**, each recording the search that found it:
  - **`test-only-consumer`** — a module or export whose *only* importers are test files. **This is the class this repo actually produces**: several rounds of refactoring leave a surface mounted by no product code but kept alive by its own test. It is neither "no importer" nor "no production caller", so a scanner with only those two finds nothing here — and `font-picker.tsx` is the worked case.
  - **`no-importer-file`** — a module nothing imports, excluding every entry point and every file vitest/Playwright discovers by glob.
  - **`no-importer-export`** — a top-level exported name no other file imports or re-exports.
  - **`barrel-only-export`** — a name whose only importer is its own package's `index.ts`.
  - **`unreachable-branch`** — a discriminant or error variant no input can produce (the `vg-344` shape), reported only where the graph or a closed union makes it mechanical to see.

- [ ] **Step 3: A candidate is not a verdict — say so in the output.** Print each with the searches run, in the shape `ownership-sweep.mjs` already established ("Candidates, not verdicts"), and never delete anything.

- [ ] **Step 4: Prove the scanner separates known cases, in both directions.** **A scanner that reports everything, or nothing, has told you nothing.** Assert it lands on:
  - **`test-only-consumer`** for `packages/editor/src/editor-shell/font-picker.tsx`, whose only importers are tests (`vg-268`, `vg-283` — the same finding filed twice, which Task 6 merges).
  - **`no-importer-export`** for `settingsField()` in `packages/editor/src/editor-shell/controls/settings-field.ts` (`vg-342`), which has zero production callers.
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

### Phase 2 — verify, then remove

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

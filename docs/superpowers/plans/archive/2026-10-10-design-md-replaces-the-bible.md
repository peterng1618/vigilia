# DESIGN.md Replaces the Bible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire `docs/design/design-language.md` for a root `DESIGN.md` in the
google-labs-code format, with each section's old `§N` kept as a marker in the
body so all 1487 existing citations keep resolving.

**Architecture:** `DESIGN.md` carries a YAML front matter of the theme-independent
scales (transcribed from `editor-shell.css`'s `@theme static`, which is
normative at runtime) and the bible's prose under the standard's canonical
headings, each followed by `<!-- §N -->`. Three checks gate it: the upstream
linter, a sync check holding the front matter to the CSS, and a citation check
holding every `§N` to a marker. All three live in `scripts/design-md.mjs` and run
inside `design:check`.

**Tech Stack:** Node 22+ ESM scripts (no new runtime dependency), `@google/design.md`
0.4.0 as a devDependency, Vitest for the script's own tests, the existing
`design-tokens` ratchet and `check-status` gate scripts.

**Spec:** `docs/superpowers/specs/2026-10-10-design-md-replaces-the-bible-design.md`

## Global Constraints

- **No runtime value changes.** Every scale, colour and size stays what it is;
  the front matter is transcribed from the CSS, never the other way round.
- **No token renames.** `--space-6` stays `--space-6`; the exporter's canonical
  vocabulary is not adopted.
- **No citation is re-pointed.** `§5` and `§7.3` keep meaning what they mean
  today; the only prose that changes is the word "bible".
- **The redesign spec's `§1`–`§172` are not touched**, and `AGENTS.md`'s rule
  about them stays in force.
- **`@google/design.md` is 0.4.0, Apache-2.0**, and a dependency is not shipped
  until `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` name it.
- **The gate must not pass vacuously.** A check that looked at nothing is the
  defect `scripts/design-tokens.mjs`'s header names; every check here has a
  `--self-test` and is shown to fail on a real break before it is trusted.
- **`grep -rin "bible" docs src scripts` is empty of meaning at the end.**
- Run from `src/web/`; the scripts are `package.json`'s. Stage explicit paths;
  never `git add -A`. Conventional Commit titles.
- Comments are 1–3 lines and explain *why*. No licence headers.

## Review Focus

1. **A marker dropped in the merge, leaving a citation pointing at nothing.**
   The bible's ten sections become eleven headings and `§3` splits in three; an
   implementer who transcribes by hand can lose a marker, and every `§N` that
   named it then silently resolves to a rule that moved. → Task 1 and Task 2.
2. **The lint gate passing because it linted nothing.** A wrong path, a file that
   moved, or a linter invoked without its argument exits 0 on an empty input. →
   Task 3.
3. **The sync check comparing the wrong halves** — reading Tailwind's own
   defaults or the unlayered `:root` block rather than the `@theme static` block
   the ratchet calls the design language. → Task 2.
4. **The sweep over-reaching into the redesign spec's citations**, which share
   the `§` character and would be corrupted by a careless global replace. →
   Task 4 and Task 5.
5. **The front matter drifting after a later theme change** — the check must fail
   when the CSS moves and the file does not. → Task 2.

---

### Task 1: The file — front matter, canonical headings, markers

**Outcome:** `DESIGN.md` exists at the repository root, lints with 0 errors and 0
warnings, and carries every marker the bible's numbering declares.

**Files:**
- Create: `DESIGN.md`
- Modify: nothing. `docs/design/design-language.md` stays until Task 5 deletes it.

**Interfaces:**
- Produces: the marker set `§1`–`§10` and `§7.1`–`§7.8`, each as an HTML comment
  on the line directly after its heading; the front matter groups `spacing`,
  `rounded`, `typography`, `omitted`. Task 2 reads both.

- [ ] **Step 1: Transcribe the front matter**

Copy the values from `src/web/packages/editor/src/editor-shell/editor-shell.css`'s
`@theme static` block (`:287–320`) — not from the spec's listing, which is
already a copy of it. `spacing` takes `--space-4`…`--space-32` as
`4: 4px … 32: 32px`; `rounded` takes `--radius-sm/md/lg/xl`; `typography` takes
each `--text-*` with its `--text-*--line-height` companion as `lineHeight`.
`name: Vigilia`, `version: alpha`, and the two `omitted` entries with the spec's
reasons verbatim for `colors` and `components`.

`fontFamily` is required by the format's `Typography`: measure what the CSS
declares for the UI sans and UI mono stacks and state it per entry, or state the
stack inline where the CSS declares no token — say which in the commit.

- [ ] **Step 2: Move the bible's sections under the canonical headings**

Use the spec's mapping table. The headings are `## Overview`, `## Colors`,
`## Typography`, `## Layout`, `## Elevation & Depth`, `## Shapes`,
`## Components`, `## Do's and Don'ts`, then `## Density and disclosure` and
`## Copy` after them (unknown headings are preserved and cost no warning). The
prose moves unchanged — this is a move, not a rewrite. Keep the bible's
sub-structure as named `###` headings.

- [ ] **Step 3: Place the markers**

Directly after each heading, exactly one HTML comment:

```markdown
## Layout

<!-- §7 -->
```

`§3` sits under `### The scales` in Layout (the spacing steps the ratchet reads);
`### Radius` and `### Elevation` carry no marker. The full set to place:
`§1 §2 §3 §4 §5 §6 §7 §7.1 §7.2 §7.3 §7.4 §7.5 §7.6 §7.7 §7.8 §8 §9 §10`.

- [ ] **Step 4: Lint it**

Run: `cd src/web && npx --yes @google/design.md@0.4.0 lint ../../DESIGN.md --format text`
Expected: **0 errors, 0 warnings**. `info` lines are permitted; record what they
say in the commit. A `section-order` warning means a canonical section is out of
sequence; a front-matter warning means the YAML did not parse.

- [ ] **Step 5: Prove the marker set is complete**

Run: `grep -c '<!-- §' DESIGN.md`
Expected: **18** — the count in Step 3, neither more nor fewer.

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md
git commit -m "docs(design): DESIGN.md, with the bible's sections and their markers"
```

---

### Task 2: The checks — `scripts/design-md.mjs`

**Outcome:** One script holds the sync and citation rules, with a self-test that
proves each rule fires on a fixture, and each rule shown to bite in the real
tree.

**Files:**
- Create: `scripts/design-md.mjs`
- Test: `src/web/tests/scripts/design-md.test.ts`

**Interfaces:**
- Consumes: `DESIGN.md` (Task 1's markers and front matter),
  `src/web/packages/editor/src/editor-shell/editor-shell.css`'s `@theme static`
  block.
- Produces: the CLI `node scripts/design-md.mjs --sync | --cite | --self-test`,
  exit 0 on pass and 1 on failure, one line per finding naming the token or the
  citation; the exported functions `checkSync(read, opts)` and `checkCitations(read, opts)`
  returning `readonly Finding[]`, where `Finding` is
  `{ readonly what: string; readonly why: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/web/tests/scripts/design-md.test.ts
it("fails a scale the stylesheet and the front matter disagree on", () => {
  const read = fixture({ css: "--space-16: 15px;", design: "spacing:\n  16: 16px\n" });
  const findings = checkSync(read);
  expect(findings.map((f) => f.what)).toEqual(["space-16"]);
});

it("fails a declared marker that the file no longer carries", () => {
  const read = fixture({ design: "## Copy\n\nNo marker here.\n" });
  expect(checkCitations(read).map((f) => f.what)).toContain("§9");
});

it("fails a marker no citation in the repo claims", () => {
  const read = fixture({ citations: ["§5"], design: "<!-- §1 -->\n<!-- §5 -->\n" });
  expect(checkCitations(read).map((f) => f.what)).toContain("§1");
});

it("reads the @theme static block, not :root", () => {
  const read = fixture({
    css: "@theme static {\n  --space-16: 16px;\n}\n:root {\n  --space-16: 99px;\n}\n",
    design: "spacing:\n  16: 16px\n",
  });
  expect(checkSync(read)).toEqual([]);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/scripts/design-md.test.ts`
Expected: **FAIL** — the module does not exist.

- [ ] **Step 3: Implement the script**

`--sync` parses the front matter's `spacing`, `rounded` and `typography` and the
`@theme static { … }` block only (not `:root`, not Tailwind's defaults),
deriving the CSS name per group: `spacing` → `--space-<key>`, `rounded` →
`--radius-<key>`, `typography` → `--text-<key>` and `--text-<key>--line-height`.
A name present in one and absent from the other is a finding; so is a value that
differs.

`--cite` holds the canonical list `["1".."10", "7.1".."7.8"]` in the script —
**not** read from the file, or deleting a marker would shrink the range it is
checked against. Three rules: every number in that list has a marker in
`DESIGN.md`; every repo citation matching `§(\d+)(\.\d+)?` whose number is in the
list resolves to a marker; and every marker is claimed by at least one citation,
except the numbers listed in the script's `UNCITED_OK` with a reason — record
there any section the sweep finds genuinely uncited rather than dropping the
rule. A number outside the list is the redesign spec's and is ignored.

`--self-test` runs both checks over inline fixtures and asserts each rule fires,
including the three in Step 1.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/scripts/design-md.test.ts`
Expected: PASS, output pristine.

- [ ] **Step 5: Red-proof both rules in the real tree**

Change `--space-16: 16px` to `15px` in `editor-shell.css`; run
`node scripts/design-md.mjs --sync`; expected **FAIL naming `space-16`**.
Restore. Then delete `<!-- §9 -->` from `DESIGN.md`; run
`node scripts/design-md.mjs --cite`; expected **FAIL naming `§9`**. Restore and
confirm both are clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/design-md.mjs src/web/tests/scripts/design-md.test.ts
git commit -m "feat(scripts): the DESIGN.md sync and citation checks, with their self-test"
```

---

### Task 3: The tool, the gate, and the licence

**Outcome:** The linter is a pinned devDependency and all three checks run inside
`design:check`, so conformance cannot regress unnoticed.

**Files:**
- Modify: `src/web/package.json` (devDependency, `design:md`, `design:check`,
  `gates:self-test`), `src/web/package-lock.json` (by `npm install`, never by
  hand), `THIRD-PARTY-NOTICES.md`, `docs/engineering/dependencies.md`

**Interfaces:**
- Consumes: `scripts/design-md.mjs` (Task 2).
- Produces: `npm run design:md` — lint + both checks, exit 1 on any failure.

- [ ] **Step 1: Add the dependency and prove the gate bites**

`npm install --save-dev @google/design.md@0.4.0` from `src/web/`. Wire
`design:md` to run the linter (0 errors **and 0 warnings** is the pass
condition, not just a clean exit) and then `node ../../scripts/design-md.mjs
--sync` and `--cite`; add it to `design:check` and to `gates:self-test`.

Then break the file deliberately: move `## Colors` after `## Typography`; run
`npm run design:check`; expected **FAIL with a `section-order` warning**.
Restore.

- [ ] **Step 2: Record the dependency**

Verify the licence from the installed package metadata (Apache-2.0), then add it
to `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` with its
version and what it is for.

- [ ] **Step 3: Run the gate green**

Run: `npm run design:check && npm run gates:self-test`
Expected: both pass; the self-test runs every gate's own self-test.

- [ ] **Step 4: Commit**

```bash
git add src/web/package.json src/web/package-lock.json THIRD-PARTY-NOTICES.md docs/engineering/dependencies.md
git commit -m "chore(gates): the DESIGN.md linter is a pinned devDependency and a gate step"
```

---

### Task 4: The prose sweep — docs

**Outcome:** Every document that names the bible names `DESIGN.md`, and the
redesign spec's own citations are untouched.

**Files:**
- Modify: every `.md` under `docs/` that mentions the bible (57 files carry it
  across docs, src and scripts; this task takes the docs half —
  `docs/README.md`, `docs/design/mockups/README.md`, the ADRs, the specs and the
  plans)

**Interfaces:**
- Consumes: Task 1's file. Produces: the doc references Task 5 does not repeat.

- [ ] **Step 1: Sweep by reading, not by replacing**

`grep -rn "bible" docs` and change each mention to `DESIGN.md`, keeping the
`§N` that follows. **Do not touch a `§N` that resolves into
`docs/superpowers/specs/2026-10-08-editor-design-language-design.md`** — that
document keeps its own numbering, and a blind replace corrupts it.

- [ ] **Step 2: Re-point the normative lines**

`docs/README.md`'s map row, `docs/design/mockups/README.md`'s "they are the
design language, drawn" link, and every plan's **Normative companion** line
(Task 5 handles the queued plans' prose if it is not reached here).

- [ ] **Step 3: Verify**

Run: `grep -rn "design-language.md" docs` — expected: only the two
`docs/superpowers/specs/2026-10-08-*` files that reference themselves and the
plans Task 5 still owns, each named in the commit.
Run: `cd src/web && npm run status:check` — expected: pass.

- [ ] **Step 4: Commit**

```bash
git add docs/README.md docs/design/mockups/README.md docs/decisions docs/superpowers
git commit -m "docs: the design language is DESIGN.md, everywhere prose names it"
```

---

### Task 5: The code sweep, the ratchet's key, and the retirement

**Outcome:** Nothing in `src/` or `scripts/` calls it the bible, the ratchet's
key names what it holds, and the old file is gone.

**Files:**
- Modify: `src/web/packages/editor/src/**` comments and the tests that cite it,
  `scripts/design-tokens.mjs`, `scripts/design-tokens.gated.json`, `AGENTS.md`
- Delete: `docs/design/design-language.md`

**Interfaces:**
- Consumes: Tasks 1–4. Produces: the finished state the acceptance list checks.

- [ ] **Step 1: Sweep the code and the tests**

`grep -rn "bible" src scripts`, and the same read-don't-replace rule as Task 4.
`src/web/packages/editor/src/editor-shell/editor-shell.tokens.test.ts:154` calls
the bible's scales normative — that sentence becomes `DESIGN.md §2–§3`.

- [ ] **Step 2: Rename the ratchet's key**

`biblePx` in `scripts/design-tokens.gated.json` and its reader in
`scripts/design-tokens.mjs` become a name that says what the list holds; the
file's "Bible §3" comments become `DESIGN.md §3`. Run
`npm run design:check` — expected: pass, with the ratchet's self-test green.

- [ ] **Step 3: Rewrite `AGENTS.md`'s rule**

Keep "`§N` requirement markers are stable; never renumber them" and add where
they live and what enforces them: the markers are in `DESIGN.md`, and
`design:md --cite` fails when a citation names a number with no marker.

- [ ] **Step 4: Delete the bible**

```bash
git rm docs/design/design-language.md
```

The rule that a file leaves when its last consumer moves is what makes this the
last step: by now nothing reads it.

- [ ] **Step 5: Verify the retirement**

```bash
grep -rn "bible" docs src scripts        # nothing that means this document
grep -rn "design-language.md" docs src   # nothing
cd src/web && npm run design:check && npm run build && npm run typecheck
```
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add scripts src AGENTS.md
git commit -m "refactor(design): the bible is DESIGN.md, and the old file is gone"
```

---

### Task 6: The close — status, register, and the plan's own evidence

**Outcome:** The plan's acceptance list is verified end to end, `STATUS.md`
hands the next session the truth, and the workspace is the ledger's record.

**Files:**
- Modify: `STATUS.md`, `docs/product/backlog.jsonl` (if the sweep found anything
  worth a row)

**Interfaces:**
- Consumes: everything above. Produces: the handoff.

- [ ] **Step 1: Walk the spec's acceptance list, line by line**

Read `docs/superpowers/specs/2026-10-10-design-md-replaces-the-bible-design.md`'s
Acceptance section and record the evidence for each of the eight items —
8 is `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` naming
0.4.0. Anything you cannot evidence is reported as unverified rather than
asserted.

- [ ] **Step 2: File what the sweep found**

The sweep reads 1487 citations and 308 mentions; it will find drift — a stale
citation, a value that no longer matches, a section nothing cites. File each as
a register row (`docs/product/backlog.jsonl`, next free `vg-NNN`) with its
provenance in `detail`, then `npm run backlog:check`.

- [ ] **Step 3: Replace `STATUS.md`'s Last completed change and Next**

Five bullets at most in each, one line per bullet, then `npm run status:check`.

- [ ] **Step 4: Commit**

```bash
git add STATUS.md docs/product/backlog.jsonl
git commit -m "docs(status): DESIGN.md has replaced the bible"
```

---

## Out of scope

- **No runtime value changes and no token renames** — the front matter is
  transcribed from the CSS.
- **No citation re-pointing.** The markers exist so the 1487 `§` references keep
  their meaning.
- **`vg-261`** (the elevation ladder declared twice as `--elev-1..3` and
  `--shadow-raised`/`--shadow-overlay`) is filed, not fixed: the format has no
  elevation token group, so this plan cannot answer it.
- **The redesign spec's numbering** is untouched, and so is the spec's own text.

## Self-review

Run before the plan is handed over: every spec section reaches a task (D1–D6 and
the acceptance list are covered by Tasks 1–6); every step names one thing to
write or one command to run; the names in Task 2's interface match Task 3's use
of them (`scripts/design-md.mjs`, `--sync`, `--cite`, `--self-test`).

# The backlog drain — design

**Status:** reviewed, fixed and closed; the drain is planned from it. Design id:
`2026-10-12-the-backlog-drain-design`.
**Produced by:** Phase 7 of
[`docs/superpowers/plans/archive/2026-10-12-the-backlog-reproduction-pass.md`](../plans/archive/2026-10-12-the-backlog-reproduction-pass.md),
the synthesis over six triage tables.
**Inputs (tracked, at `564f8dcf`):** [`docs/product/triage/triage-B1.md`](../../product/triage/triage-B1.md)
… `triage-B6.md`, [`docs/product/backlog.jsonl`](../../product/backlog.jsonl) (237 open rows),
[`backlog-archive.jsonl`](../../product/backlog-archive.jsonl) (149 closed rows).

This document is what the drain is **planned from**. It classifies; it does not close a row and it does
not change source. The six tables are the evidence; this is the decision surface over them, so where a row
needs its evidence, its verdict cell and not this file.

## 1. Scope, and the one rule that governs the drain's first slice

- 237 open rows, each with exactly one of four verdicts: `closes`, `decision`, `work`, `parked`.
- The register is **read-only** for the pass that produced this. Nothing closed, nothing withdrawn, no row
  edited, and no new row filed — a row filed mid-pass would belong to no batch and would break the coverage
  arithmetic in §2. The drain is where rows start closing.
- 49 rows are deferred to a **serialised browser follow-up** (§7). Its scope is a list, not a search.
- The two parked rows are `vg-330` (parked by the user 2026-10-11) and `vg-322`, which closes only when
  `vg-330` does.

## 2. Coverage: the six batches partition the register, and no row has two verdicts

Step 1 of the plan requires two numbers that agree, printed rather than assumed. Re-derived here from the
register and the six tables, not carried from the plan's own lists — which are stale (§2.2).

**Number A — open rows in `docs/product/backlog.jsonl` at `564f8dcf`: 237** (every row's `state` is
`open`). **Number B — ids carrying exactly one verdict across the six tables: 237.** The sets are
identical: no open row is unclassified, no verdict names a non-open row, and no id appears in two batches.

| Batch | Rows | First | Last |
|---|---|---|---|
| B1 | 40 | `vg-023` | `vg-159` |
| B2 | 40 | `vg-160` | `vg-210` |
| B3 | 40 | `vg-211` | `vg-251` |
| B4 | 39 | `vg-252` | `vg-293` |
| B5 | 39 | `vg-296` | `vg-343` |
| B6 | 39 | `vg-344` | `vg-386` |
| **Total** | **237** | | |

The batches are contiguous **slices of the sorted open list** — B1 is the first 40 ids by sorted order,
B6 the last 39 — which is why each batch's id range is sparse in id-number space: the archive holds the
closed rows in between. Each table also prints its own row count and verdict count and the two agree per
batch (40/40, 40/40, 40/40, 39/39, 39/39, 39/39).

### 2.1 Verdict set

| Verdict | Rows |
|---|---|
| `closes` | 22 |
| `decision` | 104 |
| `work` | 109 |
| `parked` | 2 |

Per batch, as the tables cut them: B1 7/18/15/0, B2 5/18/17/0, B3 5/16/19/0, B4 1/25/13/0, B5 2/12/23/2,
B6 1/15/23/0. **One row has moved since the tables were written, and it is the only one:** `vg-309` (B5) was
classified `work` and closes on §7's second slice, so B5 reads **3/12/22/2** in this spec where
`triage-B5.md` says 2/12/23/2. The move is carried in §8.14 rather than applied to the table, because the
tables are the pass's evidence and the drain is what acts.

### 2.2 Why the plan's own id lists are not the authority

The plan's lists covered 216 rows; 2 of those are no longer open and 23 open rows appeared in no list — the
range `vg-363`…`vg-386` is 24 ids and `vg-375` is archived, so the 23 is right and the range as written is
not. A per-batch instruction to a seat is not the register's shape; a later reader re-derives membership the
way §2 did — sort the open ids and cut.

## 3. List A — closes with evidence (22)

A close here means **the claim no longer holds**: a landed commit fixed it, the measurement was refuted,
the surface it named was rebuilt or deleted, the document it asked for now exists, or the user already
ruled. Closing is the drain's act, not this pass's — each row below is a row the drain may close on the
listed check.

| id | what closed | the check that closes it | artefact |
|---|---|---|---|
| `vg-087` | the drag/drop claim was false as filed | `bridge.ts` `reorderLayer` consumes `draggable`; `bridge.dom.test.ts` proves sibling reorder. Residual cross-group refusal is `vg-099` (verified) | `editor/src/panes/composition/composition-pane.tsx` |
| `vg-112` | stale coordinate cache | `authored-box.ts` `markBoxWritten` sets `dirty` and `setCoords` where the pass restores the box | `bc3696c7` |
| `vg-113` | four English strings are not a localisation defect | `ui-copy.ts` `unitDisplayOptions` is the one owner both panels read; §35 puts product copy out of localisation | `editor/src/ui-copy.ts` |
| `vg-115` | reuse gate missed `src/web/scripts/` | `matchesDirectory` matches a bare watchlist entry at any depth; probe exits 2 | [ADR 0025](../../decisions/0025-a-bare-watchlist-entry-matches-at-any-depth.md) |
| `vg-124` | `group()` left cached boxes stale | `member.setCoords()` follows `new Group(members)` on both paths | `a374cff4` |
| `vg-137` | tests read the camera as a constant | the band floor and the guide rows derive from the same measurement | `4faaecb2` |
| `vg-140` | the fit-contain ink intermittent | `display-fabric.spec.ts` is deleted and the assertion string is gone; **the deletion commit is `ad94e5ed`** (§8.1) | `ad94e5ed` |
| `vg-169` | the `+` popover | `insert-popover.tsx` is deleted; no `InsertPopover` survives | `2eeb4516`, `b0e2eb73` |
| `vg-179` | two wrappers over one popover primitive | `colour-picker.tsx` imports `@base-ui/react/popover`; no `@radix-ui` import in the editor | `editor/src/components/ui/colour-picker.tsx` |
| `vg-196` | the repaint check's standing red | `display-fabric.spec.ts` deleted by `ad94e5ed`; no `page.clock` caller remains. **See §3.3** | `ad94e5ed` |
| `vg-206` | `data-visible`'s false state | the base rule is `display: none` and only `[data-visible="true"]` flexes it — no defect | `editor-shell.css` |
| `vg-209` | an 838-line file past the stop | `layer-panel.tsx` is now 41 lines: the file was split | `editor/src/editor-shell/layer-panel.tsx` |
| `vg-217` | the status strip was never listed as a difference | the Task 10 difference list records it and rules it defensible | [`2026-10-08-the-shell-and-the-rail.md`](../plans/archive/2026-10-08-the-shell-and-the-rail.md) |
| `vg-219` | the identity chip's three differences | the same list records all three | same file |
| `vg-229` | a blanket capture claim | the README now scopes `?static=1` to player captures and says why the editor cannot | [`docs/evidence/screenshots/README.md`](../../evidence/screenshots/README.md) |
| `vg-231` | inset, off-scale body regions | the body grid has no gap and no padding; no `border-radius: 12px` remains; the file records the decision | `editor-shell.css` |
| `vg-235` | a domain with no ownership row | `248ff08f` extracted `theme-library-manager/` and added the map row; **`manager-census.md`'s verdict on this row predates it** (§8.5) | `248ff08f` |
| `vg-255` | a line-count constraint | the file is 707 lines, below the stop, and the only warrant left is an archived plan's own 540 | `selection-inspector/index.ts` |
| `vg-300` | "recording a difference as deliberate" | the mockups README now requires fixed or licensed-by-a-predating-rule | `516327f1` |
| `vg-309` | a token declared outside the drawing's token table being invisible to the assertion that exists to catch it | `design-language.spec.ts:3160` "the shell drawing declares its token table at one site" reads **every** custom-property declaration in the drawing, keys them by kind and owner, asserts there is exactly one site, and carries a positive control — so a `:root` or child declaration reddens it. **Moved here from `work` on §7's second slice; see §8.14** | `design-language.spec.ts` |
| `vg-328` | the drawing's eyebrow vs the product's title | the user ruled it: one name, and §2 already licenses the title role | the row's own `detail` |
| `vg-349` | the drag-snap path question | one `object:moving` binding serves every drag; `startGesture`'s only branch is selection eligibility | `scene-fabric`… `editor/src/snap-manager/index.ts` |

### 3.1 The four shapes of a close, and why the drain should say which one it is doing

- **fixed** — `vg-112`, `vg-115`, `vg-124`, `vg-137`, `vg-231`, `vg-235`, `vg-300`, `vg-309` (the gate that
  was blind to a declaration outside the table now reads every one).
- **refuted** — the defect was never real as filed: `vg-087`, `vg-113`, `vg-206`.
- **surface rebuilt or deleted** — the subject is gone, not repaired: `vg-140`, `vg-169`, `vg-179`,
  `vg-196`, `vg-209`.
- **discharged by a document or a ruling** — `vg-217`, `vg-219`, `vg-229`, `vg-255`, `vg-328`, `vg-349`.

A "surface rebuilt" close is not a fix and must not be reported as one; `vg-196` carries the sharpest
version of that.

### 3.2 Step 3 — every close against its own title, run through the checker's own function

The register's rule is mechanical, not editorial: [`scripts/backlog-check.mjs`](../../../scripts/backlog-check.mjs)
refuses a `verified` row when no word of its `check` appears in its own `title` (`wordsOf` at `:63-76`, the
comparison at `:124-131`). Running the 22 checks above through that function against their own rows' titles:
**16 pass as the check text stands and 6 do not.** All 22 name their row's subject — no check is of a
capability merely *nearby* — but the six do so in words the tokeniser cannot bridge, so the drain must write
the wording below rather than the text as printed above:

| row | why the printed check fails | write the check as |
|---|---|---|
| `vg-113` | `unitDisplayOptions` reaches the tokeniser as one word, so nothing in the check is in the title | the unit display options are four hardcoded English strings in `ui-copy.ts`, the one owner both panels read |
| `vg-115` | the check shares no word with a title about the reuse gate and a script directory | `matchesDirectory` matches a bare watchlist entry at any depth, so the reuse gate covers a script directory under `src/web/`; probe exits 2 |
| `vg-137` | the check shares no word with a title about tests reading the camera as a constant | the camera's band floor and the guide rows derive from the same measurement; no test reads it as a constant |
| `vg-169` | the check shares no word with a title about the plus and the chooser it opened | `insert-popover.tsx` is deleted and with it the chooser the plus opened; no `InsertPopover` survives |
| `vg-217` | the check shares no word with a title about the status strip's background | the Task 10 difference list records the status strip's background against the mockup and rules it defensible |
| `vg-235` | the check shares no word with a title about a stored-document domain and its save protocol | `248ff08f` extracted `theme-library-manager/` and added the ownership map row for the stored-document base and the save protocol gated on it |

Each of the six still owes the §3.3 sha, and the rewording does not supply it: `vg-113`, `vg-115` and
`vg-217` are three of the fourteen with none yet, while `vg-137`, `vg-169` and `vg-235` keep `4faaecb2`,
`2eeb4516`/`b0e2eb73` and `248ff08f`.

Three residuals, all stated rather than hidden:

- **`vg-137`** — the title says "five more tests" and the fix commit says "in all three places". The
  reworded check names the row's subject (the camera as a constant), so the close holds; the count was never
  reconciled.
- **`vg-196`** — the close is on a deletion, and the coverage the row named (the update loop reaching the
  canvas) may now be absent entirely. Closing this row leaves a possible hole in repaint coverage. The
  drain should close it and file a *fresh* row against the current owner if the coverage is wanted, rather
  than reading the coverage out of a row whose subject was deleted.
- **`vg-255`** — the same shape, and B4 recommends the same remedy. The close is on a line count, and
  splitting the write funnel out of `selection-inspector/index.ts` means deciding where the write path
  lives and how it reaches the closure state it reads — a real design question the close drops. No open row
  tracks that ownership today, so the drain should close `vg-255` and file a *fresh* row against the funnel
  and its owner, exactly as with `vg-196`.

### 3.3 What closing costs: 14 of the 22 carry no sha

`AGENTS.md` requires a `verified` row to carry a `check` **and** an `artefacts` sha that resolves and is an
ancestor of HEAD. **8** of the 22 closes cite a commit (`bc3696c7`, `a374cff4`, `4faaecb2`, `ad94e5ed`,
`2eeb4516`/`b0e2eb73`, `248ff08f`, `516327f1`); **14** cite a file at HEAD, an ADR, an archived plan or a
user ruling instead (`vg-087`, `vg-113`, `vg-115`, `vg-179`, `vg-206`, `vg-209`, `vg-217`, `vg-219`,
`vg-229`, `vg-231`, `vg-255`, `vg-309`, `vg-328`, `vg-349`). All twelve distinct shas this spec itself cites
— the eight the closes name, `c145598a` (§8.1), `7efea17f` and `f069e56c` (§8.5) and `564f8dcf` (the input
header) — were verified to resolve and to be ancestors of HEAD. The drain finds a sha for each of the 14 at
close time (`git log -1 -- <path>` for the document and file closes); a close that cannot produce one is
not a close.

**`vg-328` is the one whose artefact column names no path at all** — it reads "the row's own `detail`",
because its close is a user ruling of 2026-10-11 rather than a code change. Its sha is the commit that
records the close, reached through the file the ruling is written in: `git log -1 --
docs/product/backlog-archive.jsonl`, taken at that commit. `scripts/backlog-check.mjs` accepts `HEAD` as a
resolving ancestor by its own self-test, so the rule is satisfiable either way; the archive path is named
because it is the honest referent, not because the checker needs it.

## 4. List B — needs a user decision (104)

Step 2 asks for a list that is "short and sharp or it is not a decision list". 104 rows is not short, so
this list is **organised as rulings**: eleven clusters, grouped by the decision surface their rows share,
with a per-row line saying what changes under each answer.

**A cluster is a grouping, not one question.** A cluster's lead ruling settles only the members that share
it; every other member is its own row-level answer. Only D1 claims that one ruling settles named members
together, and it covers five of its nine; D3 says it outright ("Each row is an amendment-or-code choice");
D8 says each row names its own fact; and D11 states no ruling line at all — for those, the table is the
question list. So the drain must **not** read List B as answered by eleven answers: the count of answers is
larger, much closer to the per-row count, and the row is the unit the drain acts on. Eight of the 104 need a
browser run to pin the choice (§7).

### D1 — What the repo's gate is (9)

**The ruling:** is `biome check` — and each scanner's own self-test suite — part of the gate, run by CI or a
hook, or is the gate exactly `format:check` + `lint` plus a set of scripts run by hand? One ruling settles
`vg-213`, `vg-262`, `vg-372`, `vg-355` and `vg-379` together. The other four — `vg-380`, `vg-382`,
`vg-386`, `vg-184` — do not share it and are row-level answers.

| id | the choice | what changes |
|---|---|---|
| `vg-213` | adopt one `biome check` gate, or is `format:check` + `lint` the surface | adopt: a CI step, and `organizeImports` is enforced; keep: import order is declared out of scope |
| `vg-262` | add `biome check` and fix the 60 `organizeImports` findings in that commit, or delete the expectation | 60 files touched once, or the expectation deleted |
| `vg-372` | `biome check` is the gate, or `lint` + `format:check` are the whole gate | CI job, or a toolchain that is red locally and unreported forever |
| `vg-355` | CI (or a hook) runs `design:check` and `gates:self-test`, or they stay manual | a CI step, or an explicit "manual, by design" record beside the `design-tokens` ratchet |
| `vg-379` | `gates:self-test` owns every `scripts/*.mjs` self-test (add `dead-code-sweep`, `ownership-enforcement`), or the exclusion is written down | two chain entries, or one documented exception |
| `vg-380` | is the reverse direction — a class production writes that no stylesheet defines — in scope for the sweep at all | a new instrument, or a stated boundary of the sweep |
| `vg-382` | does the `redundant-export` self-use test exclude declaration-shaped occurrences, or is the tier a pre-filter for `typecheck` | a narrow self-use fix, or the tier re-described |
| `vg-386` | which `barrel-only-export` definition the tier means: the literal sole-importer shape (76 rows) or no production consumer other than the barrel (133) | either number becomes the tier's report; today it reports zero |
| `vg-184` | does the ownership sweep widen to union/dotted vocabularies, accepting the precision cost | coverage with false positives, or `ownership.md`'s claim stays false |

### D2 — What a command runs, and how it is invoked (4)

**The ruling:** which suites a session's own commands must run, and how an instruction names a run.

| id | the choice | what changes |
|---|---|---|
| `vg-282` | wire a script/CI step for the rebuild and display suites (paying ~11 min of display every session), or leave them hand-run | a red in either suite becomes visible to a gate, or stays invisible |
| `vg-147` | a project-level timeout in `playwright.rebuild.config.ts`, or `test.slow()` per journey test | one config line, or nine call sites |
| `vg-150` | name `--reporter=json` in every instruction, or drop `outputFile` from the config | instructions corrected, or the env var becomes authoritative |
| `vg-144` | per-change claim, a staleness rule, or leave the reuse gate as a first-change latch | the gate's claim is scoped, expired, or accepted as a latch |

### D3 — The design language's closed vocabularies and ladders (13)

**The ruling:** §2/§3/§4/§5 are closed vocabularies with no entry for several things the product ships.
Each row is an amendment-or-code choice; three of them (`vg-222`, `vg-225`, `vg-227`) are the same shape —
a rule is silent and the product had to choose.

| id | the choice | what changes |
|---|---|---|
| `vg-201` | what `--shell-warm` becomes on ember/moss/plum so warnings reach 4.5:1 | a hue, then one value per palette; it aliases `--yunari-accent`, so the canvas accent moves too |
| `vg-202` | a well's horizontal padding: the bible's 4, the mockup's 8, or 6 | one number, then every well; the control set owns it |
| `vg-222` | which cluster treatment is the product's, and what editorial does about elevation when it is deliberately flat | one ladder entry plus the flat-palette clause; the dock/view cluster and the identity chip reconcile |
| `vg-223` | when the name is gone and a fixed marker still overflows: drop, shorten, wrap, or accept the clip | the identity chip's last line of defence, then the rule |
| `vg-225` | §5 gains an entry for a value display that opens a list, or the readout gains a well and a chevron | a bible amendment, or a control change that keeps `chooseDisplay()` working |
| `vg-227` | the rail slot moves into §5's 26–30px, or `designLanguagePx` and §5 gain 34 | one control resized, or two authorities widened |
| `vg-261` | which of `--shadow-*` and `--elev-*` survives | one ladder; three of five names are consumed by nothing today |
| `vg-306` | is §5's 26–30px the floor for every glyph square in a drawing (so the drawing's 22px buttons move) | the drawings move, or the bound gains an exception |
| `vg-308` | does §4 state a minimum luminance separation between `--bg` and the panel above it, and at what value | a rule and a derivation check, or "order alone" written down |
| `vg-310` | does light keep translucent chrome and its named exemption, or get an opaque value the derivation produces | six palettes uniform, or five plus one stated exception |
| `vg-312` | is `--shell-flat` a per-palette flag declared ahead of a consumer, or are its declarations and `NOT_A_COLOUR` entry deleted | a consumer is owed, or three lines go |
| `vg-319` | does §5 rule 2's 74px label column bind a dialog's read-only `dl`, or is the shared grid the control rows' alone | the About and Appearance panels share a grid, or diverge |
| `vg-334` | is the gradient stop's 1px outline §4's boundary role or an `--elev-*` role | one token replaces a raw `#000` |

### D4 — The drawings' authority and the parity instrument (7)

**The ruling:** where a drawing is silent, wrong or absent, what governs — the product's own composed
values, a new drawn value, or a named exemption.

| id | the choice | what changes |
|---|---|---|
| `vg-301` | do the segmented control and the in-button chord take the product's own composed values as the drawings' | two drawn values blessed, or two controls repainted to a drawing nobody ruled on |
| `vg-324` | does the `?` shortcut sheet get its own drawing, or is its treatment wholly inherited | one drawing plus a comparator, or an explicit inheritance claim |
| `vg-350` | does the light preview bar become a solid colour like the other five, or does the reader grow a gradient comparator | one drawing edit, or a comparator plus a ruling on which stop is the ground |
| `vg-354` | does the shell gain a `--font-*` token the front matter syncs against, or is `fontFamily` declared `omitted` with a reason | a token and a sync, or an omission with a reason |
| `vg-291` | does it dissolve into `vg-292`'s instrument row, or stay as the stale-file record | one row or two; the two are one plan (§8.3) |
| `vg-287` | who owns a capture's freshness, and what check enforces it | a registry field and a check, or staleness stays undetected |
| `vg-278` | measure a portalled surface with a second fixture outside `.editor-shell`, or with a browser case on the real modal | a fixture, or a browser case; the current fixture proves the shell's rule, not the control's |

### D5 — The ratchet's membership and instruments (5)

**The ruling:** which files the design-tokens ratchet covers and what it counts, so membership stops being
"whichever task happened to add it".

| id | the choice | what changes |
|---|---|---|
| `vg-228` | does every converted surface's `.dom.test.tsx` join the gated list, or none | a rule in the checker; today 11 test files are gated and 35 exist |
| `vg-267` | which test files belong in the gated list — an expressed rule, or file-by-file | one rule, or a per-conversion judgement forever |
| `vg-271` | reword the Acceptance item to what the instrument proves, or keep the debt recorded | an honest acceptance, or a recorded debt |
| `vg-274` | is a per-element browser assertion the right instrument for a stylesheet of layout dimensions, or does the file join the gated list | the instrument, or the file; the title's "in no gate" is already false (§8.4) |
| `vg-286` | are `*.dom.test.tsx` and `tests/e2e` ratchet material — a rule in the checker — or out of scope | four files with violations become checked, or are declared out |

### D6 — The control set, the copy, and the panes' layout (14)

**The ruling:** what the control set owes a caller — an invalid-but-editable channel, one message source,
one button idiom — and what a pane does when its content does not fit the rail's column.

| id | the choice | what changes |
|---|---|---|
| `vg-254` | may a slider preview through the write funnel, and how does a preview that writes nothing meet the one-undo-boundary rule | live preview with a preview channel, or release-only values |
| `vg-256` | add a test seam for `writeOpacity`, or accept the guard as CI-invisible | the column's only 0–100 enforcement gets a test, or stays unproven |
| `vg-260` | narrow the mark slot, shorten the role copy, reserve less room, or accept the attended row's clip | a layout change, or a stated clip |
| `vg-263` | add an invalid-but-still-editable channel to the control set, or keep the platform's `reportValidity()` | a control-set mechanism, or a screen-reader silence accepted |
| `vg-264` | `ControlNumber` takes its refusals from `uiCopy`, or the copy key is retired and the strings promoted | one message vocabulary, or two |
| `vg-265` | reserve the slot's width in the row, take the state out of the role's tail, or move it | a row layout change; the state is *covered*, not clipped |
| `vg-268` / `vg-283` | delete FontPicker and its test consumers, or wire it to the surface it was written for | **one row, filed twice** (§8.3); either answer is one change |
| `vg-269` | what each pane's count prints, and where the number comes from | the chrome's slot gains a caller, or the requirement is dropped |
| `vg-270` | truncate the value, shorten the trio name, or stack the label | the Tokens pane stops overflowing by 205px |
| `vg-272` | give the plain button a `ControlButton` on the control set, or one shared class token | one owner for four copies |
| `vg-289` | where the single `ACTION_BUTTON` declaration lives — a new `components/ui` module or the dialog primitive | one owner for three drifting copies |
| `vg-290` | which chords the editor's browser matrix reserves, and how the list is maintained | `RESERVED_LETTERS` gains its Shift variants, or the list is stated as unmaintainable |
| `vg-336` | do the four picker tracks announce `Saturation`/`Hue`/`Alpha`/`Value` from `uiCopy`, keeping their test ids | four `aria-label`s; a screen reader stops reading a selector |

### D7 — Fabric facts, persisted state and the scene model (12)

**The ruling:** what is authored and therefore persisted, what is derived and must never be, and what the
canvas does to reachability.

| id | the choice | what changes |
|---|---|---|
| `vg-023` | does the canvas dim on entering a group, given the dim would be non-serialised view state | a view-state channel, or the asymmetry stays |
| `vg-037` | is a Circle's authored size being a radius (vs a Rect's width) acceptable, or must they reconcile | a glass formula change, or a documented asymmetry |
| `vg-041` | which Fabric properties are derived, and how serialisation excludes them — a spec answer | the spec this row asks for; it owns `vg-188`, `vg-366`, `vg-129`, `vg-130` |
| `vg-111` | accept the partially-describing published contract as a ceiling, or give the other 16 shapes a check | a schema addition or a stated ceiling |
| `vg-123` | should a card snap to parts inside a neighbouring card, or only to other cards' outlines | the snap candidate walk widens, or stays roots-only |
| `vg-142` | subscribe to `object:moving` and take the per-frame recompute, or track on release | per-frame cost, or a lagging figure accepted |
| `vg-188` | which Fabric properties are derived/editor-only, and how serialisation excludes them | the same spec as `vg-041` |
| `vg-221` | is an empty `metadata.name` schema-legal, or does `name` gain `minLength: 1` and start rejecting documents that validate today | a compatibility break with a version, or a stated legality |
| `vg-249` | does the persisted text-run model gain a per-run id, or does the inspector reconcile survivors as `vg-044` did | a model change with a migration, or a mutation-time reconcile |
| `vg-252` | which modified chords a non-text control still defers — the exclusion set, the action set, or both | the slider case is fixed and the sets are stated; the titled defect reproduces today |
| `vg-348` | is a chart scalar bound refused at the envelope, or clamped at render the way pie already clamps | one validation path; today no path validates a chart scalar |
| `vg-366` | is an object's `locked` state authored (and persists), or derived from the transform flags | `SCENE_PERSISTED_PROPERTIES` gains an owning row, and one of the two behaviours |

### D8 — Module ownership and protocol shape (9)

**The ruling:** one owner per concept. Each row names a fact that two or more modules spell themselves.

| id | the choice | what changes |
|---|---|---|
| `vg-104` | do the three token-list builders collapse into one function, and what does it owe a caller on an unresolvable token | one function, three call sites |
| `vg-240` | is the snap-manager protocol re-shape worth a spec now, given it is the largest family and not an extraction candidate | a spec, or the duplicate axis stays |
| `vg-241` | is the editor's fit deliberately a different rule from `computeArtboardTransform`, or a copy that drifted | a guard and a row, or one function made shared |
| `vg-242` | does the paint-repair move to the chart descriptor owner, or does the declaration say the editor enforces it | one enforcement site, or an honest declaration |
| `vg-247` | which module owns the `locked` predicate, given the import-graph ordering was never computed | a shared Fabric-facts module, or one manager above its readers |
| `vg-248` | which module owns "which collection holds this object" — `layer-manager` or `scene-fabric` | one contract replaces three return shapes |
| `vg-342` | delete `settingsField` now that it has no production caller, or migrate the inspector's column to it | a deletion, or a migration |
| `vg-343` | is `mount.ts` being retired too — delete `computeMaxLines`, its barrel entry and its five cases together, or does a builder return | a deletion or a restore |
| `vg-381` | was `importImage`'s `scale` meant to drive the object, the decoded image, or to be removed | the option becomes live or goes |

### D9 — Tests as evidence (10)

**The ruling:** what a test may assert, and what a suite does when its instrument cannot see the surface.

| id | the choice | what changes |
|---|---|---|
| `vg-109` | withdraw the row as a false measurement, or keep it recorded | one row leaves the register, or stays with its correction |
| `vg-155` | is the indistinguishable two-outcome import a defect, or should the row be withdrawn | a defect with an owner, or a withdrawal |
| `vg-159` | for each of plan 4's three undelivered bullets: write the test, or amend the plan's wording | three tests, or three plan edits |
| `vg-167` | should the stamp coverage walk a document that actually contains a nested group | one test case; groups are skipped today |
| `vg-168` | does the suite want source-shape assertions, or is the tautology acceptable | a new assertion kind, or an accepted tautology |
| `vg-182` | should a context-only binding be labelable at all | `NAMED_KEYS` gains `Escape`, or the cap is deleted |
| `vg-185` | should the File menu rows teach their chords | six rows become nine; the plan's own rule yields 9, not 6 |
| `vg-186` | which mechanism fixes the jsdom ordering stall: DOM isolation, a separate file, or the leak | one of three mechanisms; it also settles `vg-135` |
| `vg-191` | should a fixture that both bleeds and binds an unreportable key be added | a fixture, or the pair stays measured as two strips |
| `vg-192` | should `tests/e2e/` join a tsconfig program, given the DOM/Node lib conflict | 33 specs become typechecked, or stay unchecked |

### D10 — The shell's product behaviour (12)

**The ruling:** what the product does that only a product call can settle.

| id | the choice | what changes |
|---|---|---|
| `vg-029` | is the preview meant to look like a real PC, and at what cadence | a number in the fake provider, or a stated intent |
| `vg-040` | does the draft live in browser storage or on the host | the asset-ownership spec's `Status: backlog` unblocks, or the row is re-scoped |
| `vg-056` | does a click in the layer panel add to the selection, or does grouping move to a reachable surface | multi-select, or a different grouping affordance |
| `vg-163` | does §5's primitive list drop "video", or does video gain an object kind | a spec edit, or an object kind |
| `vg-171` | which network interface `lanAddress()` prefers, and how three plausible addresses rank | one order; the header either names a reachable address or does not |
| `vg-174` | on a LAN move, destroy in-flight connections or bound the GET's wait | one of two asymmetric hazards |
| `vg-190` | what a wall display does when a theme rejects after it has mounted | keep the drawn display, or replace it with the failure |
| `vg-208` | does the pane frame move to a fixed header/footer with a scrolling body, against the single-scroller constraint | a layout rework, or the constraint restated |
| `vg-211` | scope the Add pane's locators away from the asset host now, or accept the collision as a stated risk | spec churn now, or a stated risk |
| `vg-214` | should the editor poll the host for out-of-band changes, or is the editor the only in-session writer | a poll, or a design statement |
| `vg-230` | what the status bar's object count reads, where the scene total comes from, and whether the diagnostic keeps its span | a snapshot source and a layout decision |
| `vg-279` | do the host and the editor share one product version string, and from where | one injected constant, or the About tab names no version |

### D11 — Repo housekeeping and provenance (9)

**No single ruling:** these nine are independent housekeeping choices — the register's queue, a licence
closure, a directory merge, a claim filter — so the table below is nine separate questions.

| id | the choice | what changes |
|---|---|---|
| `vg-051` | keep the register as the queue, or adopt a second framework beside it | the register stays the only queue, or a second one is governed |
| `vg-116` | keep the shipped upstream workaround as the permanent answer, or file the upstream fix request | an upstream issue, or the ADR stays final |
| `vg-178` | do the two licence files list direct dependencies only, or the installed closure | a rule in both files and in the check that reads them |
| `vg-198` | is `docs/adr/` merged into `decisions/`, kept as a second class, or removed | one decision register, or two classes |
| `vg-315` | where a closed plan's evidence lives, given six tracked sites cite untracked `.superpowers/sdd/` | the census a gate argues from moves under `docs/evidence/`, or the citations become provenance |
| `vg-352` | which documents' `§N` may claim a DESIGN.md marker | a claim filter in `design-md.mjs`, or a wider namespace |
| `vg-363` | how two themes saved in the same millisecond are ranked | id, name, or a stored counter — the run's start document becomes reproducible |
| `vg-368` | delete `src/web/.agent-scratch/`, relocate it, or exclude it from each walker | a gitignored directory inside `src/web` skews every filesystem walk until one is chosen |
| `vg-373` | should the save protocol's warning subsystem be renamed now the code has left `editor-session.ts` | one user-visible label string changes, or the misnomer stays |

**Parked (2, not a decision list entry):** `vg-330` is parked by the user, and `vg-322` is parked
transitively — it closes when `vg-330` does and carries no independent work.

## 5. List C — real work (109)

Nine themed candidates. Every `work` row is in exactly one; **38 of them are the browser follow-up (§7)**
and are held only by W1 so that no row is counted twice. "Kind" is a fix, a gate to build, or a design
change; "fit" says whether the candidate can run beside another plan task under `AGENTS.md`'s one-active-
plan rule.

### W1 — The serialised browser follow-up (38 work rows; kind: measurement; fit: no, serialised)

Rows: `vg-028`, `vg-138`, `vg-141`, `vg-143`, `vg-156`, `vg-158`, `vg-164`, `vg-172`, `vg-195`, `vg-197`,
`vg-204`, `vg-210`, `vg-212`, `vg-233`, `vg-257`, `vg-258`, `vg-259`, `vg-266`, `vg-280`, `vg-281`,
`vg-284`, `vg-285`, `vg-296`, `vg-311`, `vg-313`, `vg-314`, `vg-316`, `vg-325`, `vg-326`, `vg-341`,
`vg-346`, `vg-347`, `vg-359`, `vg-360`, `vg-361`, `vg-362`, `vg-370`, `vg-376`.

(`vg-309` was in this list as a `work` row until the second slice; it closes instead — §8.14.)

Owner: one seat, one suite at a time — the fixed preview ports (4173/4174) make a second concurrent suite
produce *false* results rather than slow ones. Each row's table cell carries its spec path, `--grep` value
and build command; the follow-up runs the list. It cannot run beside a plan that also drives Playwright.

### W2 — The ownership map's filing pass (10 rows; kind: bookkeeping; fit: no, one file)

Rows: `vg-162`, `vg-234`, `vg-236`, `vg-237`, `vg-238`, `vg-243`, `vg-244`, `vg-245`, `vg-246`, `vg-369`.

Owner: [`docs/architecture/ownership.md`](../../architecture/ownership.md). The map is the instrument the
census reads and it is missing rows the census names. `vg-244` is a deletion of one stale sentence; the rest
are additions derived from `manager-census.md` and from the live modules. One file, so one seat.

### W3 — The repo's own gates and scanners (9 rows; kind: gate to build; fit: partly — one seat per file)

Rows: `vg-166`, `vg-199`, `vg-323`, `vg-327`, `vg-329`, `vg-332`, `vg-340`, `vg-384`, `vg-385`.

Owners, one file each: [`scripts/backlog-check.mjs`](../../../scripts/backlog-check.mjs) (`vg-166`,
`vg-199`, `vg-329` — the archive is read by nothing and its `artefacts` shape is unnormalised);
[`scripts/design-tokens.mjs`](../../../scripts/design-tokens.mjs) (`vg-327` two rules, `vg-332`,
`vg-340`); `package.json` scripts and
[`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) (`vg-323`, `vg-384`, `vg-385`). D1's ruling
decides *whether* these gates count; the work is the same either way.

### W4 — Persisted-scene exclusions (3 rows; kind: fix + spec; fit: yes)

Rows: `vg-110`, `vg-129`, `vg-130`. Owner:
[`scene-fabric/src/persist.ts`](../../../src/web/packages/scene-fabric/src/persist.ts) and
[`host/src/themes/store.ts`](../../../src/web/packages/host/src/themes/store.ts). `vg-129` and `vg-130`
are two omissions from `SCENE_PERSISTED_PROPERTIES`' companion strip list, with `test.fail` pins already at
the assertion sites; `vg-110` is a discarded validation result. The spec half is D7's `vg-041`/`vg-188`.

### W5 — Manager protocols and single-owner facts (5 rows; kind: design change; fit: after its spec)

Rows: `vg-232`, `vg-239`, `vg-364`, `vg-365`, `vg-367`. Owner: the session, the managers, and a spec for
`vg-240`'s protocol. `vg-364` **is a deadline, not a task**: its subject is the 17 manager rows
`vg-232`…`vg-248`, all still open, so it closes when they do. `vg-365` and `vg-367` are one concept each
decided in two modules. Do not start this before D8's rulings land.

### W6 — Test and evidence instrument hygiene (19 rows; kind: fix; fit: mostly — one seat per file)

Rows: `vg-135`, `vg-175`, `vg-177`, `vg-181`, `vg-215`, `vg-216`, `vg-251`, `vg-273`, `vg-288`, `vg-333`,
`vg-335`, `vg-337`, `vg-338`, `vg-339`, `vg-356`, `vg-371`, `vg-377`, `vg-378`, `vg-383`.

Two owners are single files that serialise: the copy walk
([`ui-copy.test.ts`](../../../src/web/packages/editor/src/ui-copy.test.ts), `vg-335`, `vg-338`) and
`design-md.mjs` (`vg-356`). The rest are independent: a NUL byte in a source file (`vg-177`), a duplicated
doc comment (`vg-181`), a missing `outputDir` (`vg-216`), vacuous converted-surface cases (`vg-251`), a
minute-boundary flake (`vg-383`), `ui-copy.ts` at 869 lines (`vg-337`), and the two line-citation and
comment rows (`vg-371`, `vg-377`).

### W7 — One-owner fixes on the editor surface (19 rows; kind: fix; fit: yes, by file)

Rows: `vg-107`, `vg-117`, `vg-133`, `vg-154`, `vg-160`, `vg-170`, `vg-189`, `vg-203`, `vg-218`, `vg-220`,
`vg-224`, `vg-226`, `vg-304`, `vg-317`, `vg-320`, `vg-331`, `vg-344`, `vg-353`, `vg-357`.

Each has a named single owner and no open ruling. `vg-304` and `vg-320` are **gate rules proved by vitest**
(a `PARITY` row naming a property its drawing selector does not declare; a copied element's declarations
against the original's) — they belong with W1's design-language rows as members of one gate but are not
deferred (`tests/e2e/mockup-values.test.ts` runs under vitest). `vg-331` is the second-highlight role: a
§4 clause plus six palette values, so it is a small spec, not an edit.

### W8 — Structural stops and the plans directory (4 rows; kind: refactor/bookkeeping; fit: yes)

Rows: `vg-152`, `vg-161`, `vg-276`, `vg-374`. `shell-layout.tsx` 986 lines and `editor-session.ts` 1077
lines are both past `AGENTS.md`'s stop with the split's warrant gone (their plans closed); `vg-152` and
`vg-161` are the plans directory answering "what is executable" untruthfully.

### W9 — The unowned mockup-parity plan (2 rows; kind: design change; fit: no)

Rows: `vg-292`, `vg-293`.

One plan, whose third member (`vg-291`) is a ruling rather than work and sits in D4. The parity gate
accepted any reason for a divergence, and the settings modal fails the drawing on 13 of 19 measured
regions. **No plan owns this**; both parity plans are archived. It is the drain's largest single piece of
product work.

### 5.1 The fifteen rules over thirteen rows

B5 holds the rows whose closure is a **gate that does not exist**, and they are **separate holes and separate
work and are not merged** (`vg-296` and `vg-327` each carry two rules). The class has two counts in the
tables, and they differ, so **the drain plans by owner and not by a count**:

- B5's rule table names **sixteen rules over fourteen rows** — the figure this spec started from.
- A re-count of B5's *verdict cells* finds a gate named in more rows than that: `vg-313`, `vg-316`,
  `vg-317`, `vg-333`, `vg-335`, `vg-338` and `vg-339` all end their cells with a gate and none is in the rule
  table's fourteen. The rule table's fourteen is therefore a floor, not the class.

By owner — this is the mapping the drain plans from. It follows the rule table's owner column, with **two
relabels** and no new hole:

- **`vg-320`** — the table's owner is "new, with a named copied-element list"; it is filed here under the
  parity reader (`mockup-values.ts`, vitest), which is where the table itself notes the case is vitest-able.
- **`vg-334`** — the table's owner is "the control set's owner"; it is filed here under §4 and the palette
  derivation case, which is what settles a gradient stop's role.

The remaining owner strings are the table's, lightly qualified where the drain needs a file or a suite to
seat — "the drawings gate" carries its spec, and the table's two `new` instruments are named here:

| owner | rules | rows |
|---|---|---|
| the drawings gate (`design-language.spec.ts`) | 3 | `vg-296` (×2), `vg-326` |
| the parity reader (`mockup-values.ts`, vitest) | 2 | `vg-304`, `vg-320` |
| the token scanner (`design-tokens.mjs`) | 2 | `vg-327` (×2) |
| §4 and the palette derivation case | 2 | `vg-308`, `vg-334` |
| new instruments | 2 | `vg-314` (a surface inventory), `vg-325` (the product side of a comparison) |
| the register checker (`backlog-check.mjs`) | 1 | `vg-329` |
| the parity table, parked with `vg-330` | 1 | `vg-322` |
| `package.json` scripts and the dispatch briefs | 1 | `vg-323` |
| the repo's own guardrail | 1 | `vg-337` |

Plus the seven rows the cells name and the rule table omits, each of which lands under an owner already
above (`vg-313` and `vg-335` and `vg-338` on the suites that walk the surface; `vg-316` and `vg-317` on the
dialog's shared rules; `vg-333` on the naming audit; `vg-339` on the View-menu case). Their per-rule detail
is `triage-B5.md`'s rule table; this spec names the owners so the drain can plan one seat per owner rather
than one per rule.

**One of B5's sixteen is discharged, and the table above reflects that.** `vg-309`'s rule — the reader
walking the drawing's whole style block — is **already enforced**: `design-language.spec.ts:3160` reads
every custom-property declaration in the drawing, keys them by kind and owner, and asserts exactly one site,
so a `:root` or child declaration reddens it. That makes `vg-309` a row the drain **closes** rather than a
rule it builds, which is why it sits in List A (§3) and why the parity-reader row above reads two rules, not
three. The class is therefore **fifteen rules over thirteen rows**.

## 6. Parallelism under the one-active-plan rule

| candidate | fit | why |
|---|---|---|
| W1 browser follow-up | **no** | owns the preview ports; one suite at a time |
| W2 ownership map | **no** | one file |
| W3 gates | **partly** | three owners in three files; one seat each |
| W4 persisted scene | **yes** | one module, no shared surface |
| W5 manager protocols | **after its spec** | needs D8's rulings; `vg-364` closes with `vg-232`…`vg-248` |
| W6 test instruments | **partly** | the copy walk and `design-md.mjs` serialise; the rest are independent files |
| W7 editor surface fixes | **yes** | one owner per row, no shared file |
| W8 structural stops | **yes** | independent of everything here |
| W9 parity plan | **no** | one plan over the shared design language and the settings modal |

Rule of thumb the drain should keep: **one plan active, W1 as its own phase** (it cannot share a machine
with anything that drives Playwright), and within a phase the W7/W8 rows are the parallel-safe set.

## 7. The browser follow-up — a list, not a search (49 rows)

38 `work` rows (in W1), 8 `decision` rows whose choice a run pins (`vg-265`, `vg-270`, `vg-278`, `vg-306`,
`vg-308`, `vg-310`, `vg-319`, `vg-324`), 1 parked (`vg-322`) and 2 `closes` (`vg-328` and, after the second
slice, `vg-309` — §8.14). Per batch: B1 6, B2 6, B3 2, B4 11, B5 16, B6 8.

**This is the deferred set the tables define, not every browser need.** Four further rows are
browser-dependent and classified outside it: `vg-037` (D7), whose residual fact `triage-B1.md` records as
needing the browser and "**not run — deferred**", and `vg-260` (D6), `vg-292` and `vg-293` (W9), which
`triage-B4.md` records would each be *pinned* by a capture rather than closed by one, so they stay in the
lists that own them — `vg-037` and `vg-260` decisions, `vg-292` and `vg-293` work. Read the 49 as the
follow-up's scope; the four are named here so nothing browser-dependent is lost between the two.

The four rows needing a **new** case rather than an existing suite — `vg-346`, `vg-347`, `vg-233`,
`vg-370` — are implementation work and belong to the drain's plan, not to a reproduction slice. `vg-370`
and `vg-233` are the two the tables name as jointly settled by one check (a scaled text resized by a side
handle).

**First slice, reported:** `vg-359`, `vg-360`, `vg-361`, `vg-362` — whose suites already exist and whose
deterministic reds also hold a redesign acceptance item open. Each ran alone with `--workers=1`, sampled
twice on the same build, and all four are deterministic. Their first question was not the fix but **whether
the surface moved or the locator went stale**, and **none of the four is a missing surface:**

- **`vg-359` — neither.** The frosted CPU card and its 17 part rows render, and the card's own row still
  selects it. What moved is the click point: the row spans x 58–279 and its centre is x=168.5, while the
  entered, selected row's four-control `.yunari-layer-state` slot begins at x=155 — so the click lands on
  the row's own **Leave** control and the tree collapses before the assertion. Clicking x=88 keeps the
  context. The capture cannot be regenerated until the click is re-aimed, so
  `editor-starter-cpu-card-desktop-chromium.png` is still the 2026-10-05 frame. The row's text misdescribes
  it (**§8.12**).
- **`vg-360` — locator stale**, as the row's own evidence hypothesised. The well exists carrying `16`; the
  xpath needs a `div` carrying `ml-auto`, and every `ml-auto` in source sits on a `span`. The sibling case
  that drives the same slider passes on the same build.
- **`vg-361` — neither.** The control does become visible, and the same locator is asserted correct 20 lines
  earlier in the run; the failure is `reference-theme.spec.ts:2488`, where the ids are read while the Add
  pane is mounted but `hidden`. The row's text misdescribes it (**§8.13**).
- **`vg-362` — the census is red as its own spec documents.** The inspector is never reached, so the walk
  closes on `body`, and §13.1's populated-region ruling makes the select-first rewrite the owed fix the row
  already names.

So the per-row answer exists for all four, and two of the four answers are register corrections, carried in
§8.12 and §8.13.

**Second slice, reported:** fourteen rows over five suites that already exist — `design-language.spec.ts`'s
four greps and `shell-appearance.spec.ts`'s one — after a single build, run serially, each read from its own
JSON report, none carrying an `incomplete` marker, and the three short suites sampled twice with identical
results. **Twelve of the fourteen claims hold today; one is answered rather than owed, and one is open
exactly as its row says:**

- **`vg-309` — refuted, and it moves from `work` to `closes` (§8.14).** Its row says a token declared at
  `:root` or on a child "is invisible to the assertion that exists to catch it", and calls the gap "a ceiling
  rather than a live miss". The run shows the assertion is no longer blind: `design-language.spec.ts:3160`
  reads **every** custom-property declaration in the drawing, keys them by kind and owner, asserts exactly one
  site, and carries a positive control, so a declaration outside the table reddens it. Nothing is owed here,
  which is why it leaves B5's rule table (§5.1) and enters List A.
- **`vg-296` — its two remaining clauses are open, as its own row says.** The three `#0007` shadows and the
  bordered follow-the-system row are read by no row; the radius clause has its mechanism. And the drawing's
  *original* is not a missing file: `docs/design/mockups/editor-shell.html` is present at 33.6 KB and frozen
  by design — the row's own detail says it "stays as it was", and the checked set is `current/`. A copied
  element's original is therefore still there to compare against (`vg-320`). The row's own text does carry a
  stale half when it is closed (it reads as though the drawing were missing); **§8.15** records it.
- **The other twelve hold**, including the two that decide a design question directly: `vg-308`'s ladder is
  asserted as order with no magnitude floor, so the rule D3 asks for is still missing; and `vg-310`'s
  exemption is **live, not historical** — the chrome suite is green because `CHROME_NOT_YET_OPAQUE` still
  names `light`, which is exactly the exemption the decision is about.

**A green run cannot carry a "no gate reads X" row.** Eight of these rows claim that no mechanism reads
something, and a passing suite shows only that the suite did not notice: the evidence is whether any
assertion's arms read the property, which is a reading of the gate and not of its colour. The slice's own
numbers are of that shape and are carried rather than interpreted — suite 1 prints **29** `parity` records
against a `PARITY` table of **35** rows, and the difference between those two is not established here.

## 8. Corrections carried, not filed

The pass may not edit the register, so these ride this spec and the drain applies them at close time. None
is a new row.

1. **`display-fabric.spec.ts`'s shas.** B1 cited `c145598a` as its last touch; B2 cited `ad94e5ed` as its
   deletion. B2 is the precise one: `git log --diff-filter=D` names `ad94e5ed`, and `c145598a` is the last
   commit that *modified* the file before deletion. Both verdicts are `closes`; the correction changes the
   sha `vg-140` carries, not its verdict.
2. **`editor-shell.css` line numbers are stale in every row that cites one.** The checked instances moved
   non-uniformly (`+13` to `+103`): rows cite `:1400` for what is `:1503`, `:45`/`:136` for `:72`/`:149`,
   `:1353-1357`/`:1368` for `:1470-1476`/`:1480-1486`.
3. **Two duplicate families collapse rather than count twice:** `vg-268`/`vg-283` (one FontPicker),
   `vg-291`/`vg-292`/`vg-293` (one mockup-parity plan). A third the tables did not pair: **`vg-166` and
   `vg-329`** are one hole — `backlog-check.mjs` never reads the archive — found in two batches, and
   `vg-199` is that hole's data half. Ruling wanted at planning time. Related and worth the same ruling:
   D7 lists `vg-041` and `vg-188` as two decision rows while `vg-041`'s own cell says it owns `vg-188`, and
   both cells ask the same question — a general/instance pair the collapse list does not name.
4. **`vg-329`'s "about twelve"** is 3 verified rows with no `artefacts` (`vg-030`, `vg-064`, `vg-076`) and 8
   carrying a bare string rather than an array — 11 of the 136 `verified` rows against 126 holding a valid
   array, which is the row's own shape. The archive has another 15 rows with no `artefacts` key at all, and
   **12 of those are `withdrawn`, which need none**; counting them into this row would overstate the rule's
   reach by twelve. Verified, and the distinction is what the correction must preserve.
5. **`vg-341`'s "all seven captures at `7efea17f`"** is six there and one —
   `editor-shell-add-desktop-chromium.png` — at `f069e56c`. Verified.
6. **`vg-320`'s identifier** is `RADIUS` at `design-language.spec.ts:2887`, not `SCALE` at `:2541`.
   Verified verbatim.
7. **`.superpowers/sdd/` citations are six sites, not four** (two in `mockup-values.ts`, one in
   `design-language.spec.ts`, one ADR, one spec, one `.github` file). Verified.
8. **`manager-census.md`'s `vg-235` verdict is stale** — `248ff08f` postdates it. Verified by ancestry.
9. **Counts that drifted without changing a verdict:** `vg-262` (67 → 60 organizeImports findings),
   `vg-276` (916 → 986 lines), `vg-283` (357 → 379), `vg-199` (5 → 8 bare-string rows), `vg-204`/`vg-210`
   and `vg-284`'s moved line numbers. `vg-274`'s *title* is false ("in no gate") while the design pass it
   asks for is real.
10. **`vg-252`'s premise is half-false** — deferral is action-scoped now, not "every action" — while the
    titled defect (Ctrl+Z on a focused slider) still reproduces. Triage on the live source, not the prose.
11. **Stale owner paths** in `vg-104`, `vg-109`, `vg-155`, `vg-333`, `vg-314`, `vg-328`, `vg-301`,
    `vg-235`'s census row: the subjects exist, the cited lines and directories moved.
12. **`vg-359`'s row text misdescribes its own failure.** It reads "the starter's frosted CPU card never
    appears"; the card and its 17 part rows do render, and a click point that now lands on the row's Leave
    control is what collapses the tree (§7). A fixer reading the row alone looks in the wrong place, and
    `editor-starter-cpu-card-desktop-chromium.png` cannot be recaptured until the click is re-aimed.
13. **`vg-361`'s row text misdescribes its own failure.** It reads "the background-media row never becomes
    visible"; the control does become visible and the same locator is asserted correct in the same run, at
    `:2467-2470` against a failure at `:2488`. The failure is a read attempted at
    `reference-theme.spec.ts:2488` while the Add pane is the active one (§7), which is a stale step order
    rather than a missing surface.
14. **`vg-309` moves from `work` to `closes` on a run rather than on a reading.** `triage-B5.md` classifies it
    `work`, one rule for the parity reader, on the strength of `mockup-values.ts` resolving the drawing's
    token table through a single element. The second slice's run shows the row's actual claim — that a token
    declared outside that table is "invisible to the assertion that exists to catch it" — is false at HEAD:
    `design-language.spec.ts:3160` reads every custom-property declaration in the drawing, keys them by kind
    and owner, asserts exactly one site and carries a positive control. So B5 reads 3 closes / 12 decisions /
    22 work / 2 parked where its table says 2/12/23/2 (§2.1), B5's rule table holds fifteen rules over
    thirteen rows rather than sixteen over fourteen (§5.1), and the drain closes `vg-309` on §3's check. This
    is the one triage verdict the browser follow-up changed, and it changed in the direction the follow-up
    exists to find.
15. **`vg-296`'s row text carries a stale half.** Its two remaining clauses are open exactly as it says (§7),
    but the row reads as though `docs/design/mockups/editor-shell.html` were missing; the file is present at
    33.6 KB and frozen by design. Correct the row when the drain closes it — not before, since the run's own
    reading of the prose is not what the row's `detail` says.

## 9. The copy boundary: `control-fixture.tsx`

B5 found literal copy in
[`src/web/packages/editor/src/control-fixture.tsx`](../../../src/web/packages/editor/src/control-fixture.tsx)
— `aria-label="Shell palette"` and seven `InspectorSection` `title` props — in a fixture the copy walk does
not mount. It was deliberately left unfiled, because a row filed mid-pass would belong to no batch.

**The boundary decision, stated:** the copy rule's scope is **the product bundle**, and this fixture is not
in it. It is built by its own `vite` invocation — `vite build --config vite.config.fixture.ts` (`npm run
build:fixture -w @yunari/editor`), a second invocation with `emptyOutDir: false` — and is served at
`control-fixture.html` for the design-language evidence run; the product build (`vite build`) emits exactly
the bundle graph it emitted before the fixture existed, so the fixture is **exempt by name** and the
exemption is recorded here rather than left as a hole.

**What the exemption does not say.** The fixture command is a second invocation whose `emptyOutDir: false`
writes `control-fixture.html` **into the same `packages/editor/dist`** the host serves
([`packages/host/src/main.ts`](../../../src/web/packages/host/src/main.ts)), and CI runs it before previewing
that tree. So the exemption is true of the *build command*, not of everything the served tree can contain —
the fixture page is reachable on any host that has run `build:fixture`.

**The other answer, and what it costs:** if the rule is meant to cover every tracked source file, the
fixture becomes in scope and the drain files **one** row — the eight literal strings move behind `uiCopy`
accessors. The state that would flip the decision is the fixture entering a shipped bundle, and by the
paragraph above that is closer to met than the `vite build` argument suggests: `build:fixture` already lands
the page and its assets in the `dist` the host serves. What decides it is a build-config change rather than
a code one, so the exemption should be re-checked against what is actually deployed when that config
changes (W1's `vg-341` capture work touches it).

## 10. What the drain must do with this

1. **Close the 22** in List A with a `check` naming a word from each row's own `title` and an `artefacts`
   sha that resolves and is an ancestor of HEAD — 14 of them need that sha found at close time, and **six
   need the check reworded** as §3.2 prints it, because the register's own tokeniser rejects the text as
   the table above writes it.
2. **Take D1–D11's rulings**; a cluster's lead ruling settles only the members that share it — D1's covers
   five of its nine — and every other member is a row-level answer. So the user session is larger than
   eleven questions, much closer to the per-row count, and List B is not finished by eleven answers.
3. **Plan W1…W9 as phases**, one active plan, with W1 its own phase (it cannot share a machine with any
   Playwright work) and W7/W8 as the parallel-safe set.
4. **Apply §8's corrections at the moment each row closes**, and collapse the duplicate families once.
5. **Not re-open a verdict** this pass reached on live source. Where a row's prose contradicts the source,
   the source won here and should win in the drain.

## 11. Unverified, and where this spec is weakest

- **Eighteen of the 49 deferred rows have now been run, in two slices, and none of them turned out to be a
  missing surface** (§7). The first slice settled four — two stale gestures or locators, one stale step
  order, one documented red — and the second settled fourteen: twelve claims hold, `vg-309` closes on a gate
  that already exists (§8.14, the one triage verdict a run changed), and `vg-296` is open exactly as its own
  row says. **Thirty-one rows are still classified by reading rather than by a run**, and so are the
  browser-dependent rows §7 names outside the 49. That is ruling B's accepted cost, and two slices of it
  have been paid.
- **A "no gate reads X" row cannot be settled by a green run at all.** Eight of the second slice's rows are
  of that shape, and their evidence is the assertion's arms rather than the suite's colour (§7). Any later
  slice will meet the same limit, so its verdicts should be read as readings of the gate.
- **Two numbers from the second slice are carried uninterpreted**, because the run does not explain them:
  suite 1 prints 29 `parity` records against a `PARITY` table of 35 rows, and the chrome suite's green
  depends on an exemption set that still names one palette.
- **§4's eleven clusters are my grouping, not the user's.** A cluster that turns out not to be one ruling
  reverts to its own members as separate questions — D3's thirteen, D11's nine — not to eleven; nothing else
  in the spec moves.

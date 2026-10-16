# 0066 — A watchlist entry is checked by the rule it matches by, so a dead one cannot read as coverage

- **Date:** 2026-10-17
- **Status:** accepted
- **Paths:** `scripts/reuse-gate.mjs`
- **Task:** Phase 21.10 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (row `vg-544`)

## The problem

`WATCHLIST` named `src/web/packages/editor/src/selection-inspector/style.ts`,
deleted at `aa5edf96`. The shape of the problem is not the one deleted line: it
is that **an entry is a name, nothing checks that the name still resolves, and
an entry that stops resolving goes on reading as coverage the list does not
have**. The row's own words — *"the gate can never refuse a write to that path,
and the list reads as covering an owner it does not"* — are one defect seen from
two sides.

Two measurements make the first side sharper than the row states. The dead entry
is inert **twice over**: the gate answers `0` for that path both because the file
is gone *and* because `0030` still claims it, so even restoring the file would not
make the entry fire. A dead entry is therefore not merely a missed refusal; it is
an entry no future change can ever make live.

The second half is a decision rather than a repair. `0030` is the note that
claimed the dead path, and its decision was **one read-only surface per resolved
answer**. `aa5edf96` deleted both surfaces it ruled on — the selection's Spends
section and the Document pane's This document section — so that decision's subject
is gone. The replacement is therefore not "where `0030` went" but "which live
editor mechanism owner the entry's slot should gate".

## Rung 1 — Vigilia

Searched: `WATCHLIST`, `isWatched`, `matchesDirectory`, `covers`, `claimedPaths`
and the `--self-test` block in `scripts/reuse-gate.mjs`; decisions `0025`
(how deep a bare entry matches), `0030` (the claiming note), `0031`, `0059` (a
claim names the file); the commit that added the editor entries (`bb4b575b`, "the
editor joins the reuse-gate watchlist"); the deletion commit `aa5edf96`;
`docs/architecture/ownership.md`'s editor table; and **every** `- **Paths:**`
bullet in `docs/decisions/*.md`, extracted with the gate's own reader.

Found:

- **20 watchlist entries, 1 dead.** A naive `existsSync` over all 20 at
  `6d8ee0f4` reports 19 present and one missing: the dead one. No other entry is
  dead, and no entry is a bare name with no root instance.
- **The dead entry is inert twice.** `style.ts` through the gate answers `0` —
  the path is gone *and* `0030` claims it. Either cause alone would keep it from
  firing.
- **No note claims the replacement**, so an entry on it would actually refuse a
  first write — which is the property the dead entry has lost.
- **11 notes claim paths that no longer exist** (`validate.ts`, `serialize.ts`,
  `qr-code.tsx`, `popover.tsx`, `style.ts`, and five more). A stale claim is
  therefore a tolerated state in this repo, not a finding of this row — recorded
  here so the next reader does not re-derive it, and `0030` is left as it is.
- **`ownership.md` names five selection-inspector owners**: `panel.ts`,
  `per-kind-column.ts`, `view.ts` (`editRefusal`), `glass.ts` and
  `selection-lead.tsx`. `view.ts`'s row is *"**The refusal a document edit
  earns** — stale, locked, unknown or invalid, decided before anything is
  written"*.
- The gate's own comment records the failure from the other direction: the list
  once *"covered no editor path at all while the editor is where most of these
  decisions now live"*, and the six editor entries were added on the user's
  ruling that the scope is mechanism owners only.

## Rung 2 — dependencies

Searched: `scripts/reuse-gate.mjs`'s imports, the other `scripts/*.mjs`, and
`scripts/oversize-files.mjs`'s `trackedFiles` (`:51`).

Found: `node:fs`, `node:path`, `node:url` and nothing else in the gate — no glob
or policy package exists in the workspace and none is proposed. The repo's own
walker for "every path in the tree" is **`git ls-files`**, used by
`oversize-files.mjs` and `dead-code-sweep.mjs`. Reused rather than written a
second one; nothing to discharge.

## Rung 3 — platform

Searched: `fs.existsSync`, `fs.statSync`, `fs.readdirSync({ recursive: true })`.

Found: `existsSync` answers for **one path**, and gives no notion of *"a name
that occurs at any depth"*, which is exactly the bare entry's shape (`0025`).
`readdirSync` with `recursive` can enumerate, but from the root it walks
`node_modules` and `.git` on every self-test. So the platform supplies the
primitive — does this path exist — and leaves the shape rule to us. This is the
rung that decides the check's form, and it cannot answer it.

## Rung 4 — ecosystem

The searches are the evidence. One query was run through the Exa web search:
**`CI check that a policy list of file paths names files that still exist,
failing when a path is deleted`**.

**Found, and it is the same defect arrived at independently: BerriAI/litellm PR
#37608**, *"test(ci): reject coverage-allowlist entries that no longer match a
file"*. Its `assert-ci-coverage` gained exactly this check for a coverage
allowlist, and the PR states our row's consequence in its own words: *"the
allowlist keeps 20 paths that cannot exist, and reads to the next person as
coverage the repo does not have"*. **The transferable finding is its rule**, and
it is shape-aware: *"Every allowlist path must match at least one file the census
looks at… A directory entry stays valid while any file below it survives… A
dockerfile entry must match exactly, since that is how those exempt."* Its
`--self-test` cases cover "missing files, valid paths, directories, globs,
Dockerfiles, and the repository's current allowlist" — the same spread this
decision's check needs.

Also read: **Runfusion/Fusion's `scripts/check-test-inventory.mjs`**, whose stale
explicit-registration check ("`skip-list references a non-existent file`") is a
*soft* error so "the lists don't rot" — the same intent, weaker enforcement; and
**microsoft/waza's `file` grader** (`must_exist` / `must_not_exist`), which shows
the general shape but has no per-entry matching rule to keep in step.

**How the shapes compare.** litellm's allowlist is a *match set* — an entry
exempts by matching, so its existence test is "does it match anything". Ours is a
*write gate* — an entry claims a path, so its test is "does the path exist". The
one thing both must do is **read each entry by the same rule the entry is used
by**, which is the decision taken below and the single thing a naive
`existsSync(entry)` gets wrong.

## Rung 5 — comparison

**(a) The dead entry's replacement.**

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **Repoint at `selection-inspector/view.ts`** | the live selection-inspector owner `ownership.md` names as a boundary — the refusal a document edit earns, decided before anything is written — and the column-as-a-value that `0030`'s ADR-0039 clause protects; no note claims it, so the entry fires | 1 entry, 1 comment clause | the entry now gates a file whose first write is a decision, which is what the list is for | **chosen** |
| Repoint at `selection-inspector/appearance.ts` | `0030`'s Decision names it as the *surviving value owner* ("the six helpers keep their signatures") | 1 entry | its failure mode — two surfaces resolving a token differently — needs a *second* file to be wrong, and `ownership.md` gives it no row; a boundary that only misfires in company is not this list's unit | rejected |
| Repoint at `selection-inspector/index.ts` | the plan's Phase 18 prose names it as Task 18.5's subject | 1 entry | it is the column's *composition* — `ownership.md` gives it no row — and the same prose says Task 18.5 owes no note; the plan's own line relies on the entry being dead | rejected |
| Delete it, put nothing back | `0030`'s subject is gone, so the entry has no owner | 1 deletion | the plan's Step 2 asks for a replacement rather than a deletion, and the comment's own history — a list that covered no editor path at all — is the failure a silent deletion moves back toward | rejected |
| Repoint at `editor-document.ts` | a stronger boundary than `view.ts` (the document's every write and its fan-out) | 1 entry | it is not the dead entry's *neighbourhood*, and this row is about the selection-inspector slot the user ruled in; a wider re-scoping of the list is a different decision with its own note | rejected |

**(b) What "exists" means for an entry.**

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **Shape-aware: anchored → `existsSync`; bare → a tracked path has that segment** | reads each entry by the rule `isWatched` matches it by (`0025`), which is litellm's rule too | ~8 lines, one `git ls-files` | a bare name that is live only below the root is read correctly rather than reddened | **chosen** |
| `existsSync(entry)` for every shape | 2 lines, no subprocess | none | a bare entry is a *kind*, not a root path (`0025`), so the check would red on a live entry and the obvious "fix" is to narrow the list — the wrong repair, and the one the brief forbids | rejected |
| `readdirSync(ROOT, { recursive: true })` for the bare shape | no `git` | a walk of `node_modules` and `.git` from the root on every self-test | slow on the hook's own gate for no extra truth | rejected |
| Check only the anchored shape, leaving bare entries unchecked | no subprocess | a bare entry could go dead unread | the defect survives in one of the two shapes | rejected |

## Rung 6 — probe

Measured on 2026-10-17 at `6d8ee0f4` (base sha confirmed with `git log -1`), by
running the gate and its self-test rather than by reading them:

| Measurement | Value | How |
|---|---|---|
| Naive `existsSync` over the 20 entries | **19 exist, 1 missing** (`selection-inspector/style.ts`) | `node -e` over `WATCHLIST` parsed from the script |
| The dead path through the gate | **exit 0** (allowed) | `printf '{"tool_input":{"file_path":"…/style.ts"}}' \| node scripts/reuse-gate.mjs` |
| The replacement through the gate, before | **exit 0** | same, `…/view.ts` |
| `--self-test`, before | **12 cases, all pass, exit 0** | `node scripts/reuse-gate.mjs --self-test` |
| `--self-test`, after | **16 cases, all pass, exit 0** | same |

The dead path's `exit 0` is the row's own claim reproduced, and it is why the
existence case is the fix rather than the repoint alone: the gate cannot see a
dead entry from the write side, so only a case that reads the list itself can.

## Decision

**Two, and the second is the one that makes this a fix rather than an edit.**

**1. The dead entry is repointed at
`src/web/packages/editor/src/selection-inspector/view.ts`**, and the comment's
sixth clause is rewritten to name it. The reason is not that the list should stay
long: it is that `view.ts` is the live selection-inspector owner `ownership.md`
names as a mechanism boundary — *the refusal a document edit earns, stale,
locked, unknown or invalid, decided before anything is written* — so a first
write to it is a decision someone should have recorded, which is the list's own
test for membership. A wrong decision there is invisible in the list's sense:
nothing fails, the edit either lands when it should have been refused or is
refused with no visible cause. `appearance.ts` and `index.ts` were the plausible
alternatives and both fail that test for the reason recorded in rung 5.

**2. `--self-test` gains an existence case, and it reads each entry by the rule
that entry matches by.** An anchored entry must exist at its path; a bare entry
must occur as a path segment **at any depth**, which is what `0025` says the entry
means. The reason is that a check which contradicts the matcher would red on a
live entry and invite the wrong repair — narrowing the list — and litellm's
directory rule is the same conclusion reached independently. The case is read
against the live `WATCHLIST`, not a synthetic array, because a synthetic list
cannot see a dead path; and two cases beside it prove the check can fail — a name
that is nowhere in the tree, and a bare name found only below the root — so the
whole-list case is not vacuous.

**Cost of being wrong.** The repoint's failure mode is a refusal of a write to
`view.ts` that a decision note then unblocks, which is loud and cheap. The check's
failure mode is a false red on a bare entry whose name has no root instance; that
is loud too, and it is one edit away from a correct anchored entry rather than a
silent lapse — the opposite of the defect it catches.

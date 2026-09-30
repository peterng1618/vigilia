# GitHub Issues Backlog Implementation Plan

> **Superseded 2026-10-01 — do not execute.** This plan ran on 2026-09-27
> (`fea0aee`, `docs/bugs/` removed and `docs/README.md` repointed at Issues), and
> the system it installed was then overtaken by the in-repo register in
> [ADR-0019](../../decisions/0019-the-backlog-is-two-files-split-by-state.md).
> Its 32 unchecked boxes were never ticked and are **not** work outstanding — the
> boxes record the plan's own tracking convention, not the state of the repo. The
> design record is the
> [spec](../specs/2026-09-27-github-issues-backlog-design.md); the current rules
> are in [`AGENTS.md`](../../../AGENTS.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-repo `docs/bugs/` registry with GitHub Issues, in a
shape that lets an agent file a defect during development and a human file one
during testing, and that keeps one owner per fact.

**Architecture:** `STATUS.md` keeps sole ownership of the active plan and queue
order; issues own the backlog. Filing is a judgement about size — complex or
large defects become issues on sight, small ones are fixed on the fly — with the
signals written into `AGENTS.md` so the judgement is repeatable. The issue form
and a repo body template share one shape, carried over from the bug records that
already earn their keep.

**Tech Stack:** `gh` CLI 2.101 (authenticated as `peterng1618`, `repo` scope),
GitHub issue forms (`.github/ISSUE_TEMPLATE/*.yml`). No new dependency, no
runtime code, no build change.

**Spec:** [GitHub Issues as the backlog](../specs/2026-09-27-github-issues-backlog-design.md)

**State:** not started. The spec's "do not run while a plan is active" rule is
**overridden by the user on 2026-09-27**, with the risk named and managed below
rather than ignored.

## Global Constraints

- `STATUS.md` is not modified by this plan. It already names the queue; the
  backlog is not its business.
- Nothing cites an issue number before that issue exists. Repointing runs after
  filing, and uses the numbers Task 2 prints.
- Scratch files for issue bodies go **outside the repo** — a temp directory such
  as `$TMPDIR/vigilia-issues/`. Nothing transient is written into the tree.
- Only the four existing bug records migrate. No new issue is invented.
- Closed issues record the commit that closed them, so "did we already try this?"
  stays answerable by search.
- The archived snapping plan keeps its history; only its broken link is repointed.
- `src/web/**` is the running plan's territory. This plan does not edit product
  source, with the one exception in Task 6, which is deferred for that reason.

## Review Focus

The failure modes this migration invites, most likely first:

1. **A guessed cause recorded as a cause.** The next agent trusts it and repairs
   the wrong subsystem. `cause not established` must be a first-class answer.
2. **A closed issue with no reason.** The decision is lost and the same request
   returns next quarter. Declining owes a reason, in the closing comment.
3. **A small defect repaired three times**, because nothing obliged a record.
   The judgement rule has no teeth unless the third attempt forces one.
4. **A repointed link that resolves but no longer says what the citing text
   claims.** The comment survives the move and quietly rots.
5. **The registry deleted while the subagent is mid-Task 5**, whose brief and two
   source comments point at a file that no longer exists.

## File/ownership map

| Path | Change | Owner |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.yml` | new — the human bug form | this plan |
| `.github/ISSUE_TEMPLATE/request.yml` | new — the human request/feedback form | this plan |
| `AGENTS.md` | the bug rule is replaced | this plan |
| `docs/README.md` | the bugs row repoints to Issues | this plan |
| `docs/bugs/**` | deleted at the end | this plan |
| `docs/superpowers/specs/2026-09-27-author-journey-proof-design.md` | finding protocol repointed | this plan |
| `docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md` | its one `docs/bugs/` citation repointed | this plan |
| `docs/superpowers/plans/archive/2026-09-25-snapping-fidelity.md` | its closed-bug link repointed | this plan |
| `src/web/tests/e2e/glass.spec.ts`, `glass-fixture.ts` | citations repointed **after** the running plan's Task 5 lands | deferred, see Task 6 |
| `.superpowers/sdd/2026-09-26-reference-theme-fidelity/` | a note for the running agent | this plan, Task 6 |

---

## Phase 1 — Create the backlog

Nothing in the repo changes in this phase, so a failure here costs nothing.

### Task 1: Create the three labels

**Outcome:** `needs-triage`, `blocked` and `feedback` exist with the meanings the
spec gives them.

**Constraints:** `bug`, `enhancement`, `wontfix` and `duplicate` already exist as
GitHub defaults and are reused unchanged. No `queued` label — an accepted request
closes its issue, so nothing would carry it. Colours are 6-hex, no `#`. Use
`--force` so the task is idempotent on re-run.

- [ ] Create each label with the spec's description, for example:

```bash
gh label create needs-triage \
  --description "Filed, not yet judged or accepted" --color d4c5f9
gh label create blocked \
  --description "Waiting on a named plan or decision" --color fbca04
gh label create feedback \
  --description "An observation or preference, not a requested change" --color c2e0c6
```

- [ ] Confirm all three: `gh label list` shows them, and no `queued` label exists.
- [ ] Commit: nothing to commit. Report the label list instead.

**Verification:** `gh label list` shows the three with their descriptions. A
label whose description does not match the spec is a defect — the description is
what a future reader has to go on.

**Failure mode:** if `gh label create` fails on an existing label, re-run with
`--force`. Do not delete and recreate; the description is being updated, not
replaced with a different meaning.

### Task 2: File the four migration issues

**Outcome:** the two open bugs exist as open issues and the two closed bugs as
closed issues, each preserving its record.

**Constraints:** Bodies are built from the existing markdown in
`docs/bugs/`, in a temp directory outside the repo. Bodies are not rewritten to
suit the new shape — the shape is a floor, and these records already meet it.
`gh issue create` has no `--state`, so closing is a second call. Record the four
issue numbers; Tasks 4–6 cite them.

- [ ] Create the temp directory and copy the four records into it:

```bash
mkdir -p "$TMPDIR/vigilia-issues"
cp docs/bugs/open/delete-inside-a-group-is-unreachable.md   "$TMPDIR/vigilia-issues/"
cp docs/bugs/open/host-cannot-serve-packaged-assets.md       "$TMPDIR/vigilia-issues/"
```

  Add one line to the top of each body giving the origin:
  `Migrated from \`docs/bugs/\` on 2026-09-27.`

- [ ] File the two open bugs, keeping their titles:

```bash
gh issue create --title "Delete cannot remove an object that lives inside a group" \
  --body-file "$TMPDIR/vigilia-issues/delete-inside-a-group-is-unreachable.md" \
  --label bug,needs-triage
gh issue create --title "Hosted themes cannot load their packaged assets in the player" \
  --body-file "$TMPDIR/vigilia-issues/host-cannot-serve-packaged-assets.md" \
  --label bug,needs-triage
```

- [ ] File the two closed bugs. Their `Status: resolved` line is replaced by a
  closing line naming the commit that resolved them — `1fc22b7` for BR-001 and
  `6ea5314` for BR-002. Create each, take the number `gh` prints, then close it:

```bash
gh issue create --title "Task 9 browser matrix" \
  --body-file "$TMPDIR/vigilia-issues/BR-001-task-9-browser-matrix.md"
gh issue close <the number just printed> --reason completed \
  --comment "Resolved by 1fc22b7. Migrated from docs/bugs/closed/ on 2026-09-27."
```

  Repeat for BR-002, whose closing comment names `6ea5314`.

- [ ] Record the four numbers in the plan ledger workspace for Tasks 4–6.
- [ ] Read each back with `gh issue view <n>` and confirm the body rendered and
  the labels are set.

**Verification:** the two open issues are open and carry `bug` and
`needs-triage`; the two closed ones are closed as `completed` and name their
commit. A closed bug whose body still says "Status: open" is a defect — fix the
body before moving on.

**Failure mode:** `gh issue create` exits non-zero but still prints a URL when
attachments fail. Read the printed URL before retrying, or the bug gets filed
twice.

### Task 3: Add the issue forms

**Outcome:** a human can file a bug and a request from the browser, reaching
every part of the judgement without reading the spec.

**Constraints:** GitHub issue forms are YAML in `.github/ISSUE_TEMPLATE/`. A
malformed form makes GitHub silently ignore the whole file, so validate by
opening the new-issue page, not by reading the YAML. The bug form's fields are
the five body sections plus the two judgement answers; the request form is
deliberately shorter.

- [ ] Create `.github/ISSUE_TEMPLATE/bug.yml` with: `What happens` (textarea,
  required), `Why` (textarea, required, whose help text names
  `cause not established` as a valid answer), `Why it is not <adjacent
  subsystem>` (textarea, optional), `Evidence` (textarea, required), `Next
  pickup action` (textarea, required, whose help text says declining to choose
  an owner is a valid answer), and a `Size` dropdown whose options are the
  spec's "file it" signals.
- [ ] Create `.github/ISSUE_TEMPLATE/request.yml` with `What`, `Which journey
  it breaks`, `Evidence` and `What done would look like`, labels
  `enhancement,needs-triage`.
- [ ] Point `config.yml` in the same directory at both, with blank issues
  allowed off.
- [ ] Verify by loading the repository's new-issue page and confirming both forms
  render, every required field is marked, and submitting a bug with
  `cause not established` is accepted.

**Verification:** open the new-issue page in a browser. A form GitHub rejected
shows no template at all, which is indistinguishable from "not configured" —
this check is the only one that works.

**Failure mode:** a `dropdown` whose options list is empty renders as an
unusable control. Every option must be a real signal from the spec, verbatim.

---

## Phase 2 — Repoint the repo

### Task 4: Replace the `AGENTS.md` bug rule

**Outcome:** the agent-facing rule is the size judgement, and `docs/bugs/`
appears nowhere in it.

**Owners:** the `## Process and documentation` section, and the bug paragraph
that currently sits three lines into it.

**Constraints:** This is a user-owned file and the change is explicitly
authorised. The rule must be short enough to follow while debugging — the
current three-attempts paragraph is the length model. State which side of the
judgement was taken and where it is recorded.

- [ ] Replace the three-attempts paragraph with: file a bug when any of the
  spec's "file it" signals holds; fix on the fly when all of the "fix on the
  fly" signals hold; say in the commit which was chosen and why; nothing goes
  three attempts unrecorded; close the issue with the fixing commit; do not
  duplicate a finding in specs, status or reports.
- [ ] Add the roadmap lifecycle, which the bug paragraph does not cover: a
  filed request is `needs-triage` until it is judged; an accepted request
  closes with a link to the spec or plan that now owns it; a declined one closes
  as `not planned` with the reason, never silently. Name `STATUS.md` as the
  thing that decides acceptance, so the queue keeps one owner.
- [ ] Point at the issue form rather than restating its fields, and at
  `gh issue create --body-file` for the agent path.
- [ ] Confirm no `docs/bugs/` string survives: `rg -n "docs/bugs" AGENTS.md`
  returns nothing.
- [ ] Commit with `docs/AGENTS.md` as the only path.

**Verification:** read the new paragraph as an agent debugging at 2am. If it
does not settle the common case, it is too long.

**Failure mode:** a rule that keeps the three-attempts bar alongside the
judgement is worse than either alone, because the agent waits for permission to
write something down.

### Task 5: Repoint the map, the specs and the archived plan

**Outcome:** `docs/README.md` and every non-in-flight document point at Issues.

**Constraints:** use the numbers recorded in Task 2. The archived snapping plan
keeps its text; only its link changes.

- [ ] In `docs/README.md`, replace the bug row with a row pointing at the
  repository's issues, and drop the `bugs/README.md` link.
- [ ] In `docs/superpowers/specs/2026-09-27-author-journey-proof-design.md`,
  confirm the finding protocol already names the backlog spec rather than a
  `docs/bugs/` path. *(Already done in the spec-review commit; verify, do not
  rewrite.)*
- [ ] In `docs/superpowers/plans/archive/2026-09-25-snapping-fidelity.md`, repoint
  both `../../bugs/closed/BR-002-...` links at the BR-002 issue, leaving the
  surrounding sentences alone.
- [ ] Confirm: `rg -n "docs/bugs" docs/README.md docs/superpowers/specs/` finds
  nothing.
- [ ] Commit the three paths together.

**Verification:** follow every link in the changed files and confirm each
resolves. A link that resolves to the issue but no longer supports the sentence
around it is a defect — the sentence is what a reader trusts.

### Task 6: Repoint the running plan and leave the subagent note

**Outcome:** the active plan's citation points at the issue, and the running
agent knows where the record went before it needs it.

**Constraints:** This is the override the spec warned against, so it is managed
rather than waved through. The reference-theme-fidelity plan is in flight and its
Task 5 subagent is writing `src/web/tests/e2e/glass-fixture.ts` and
`glass.spec.ts` right now — one is untracked, so editing it could lose work
that is not yet committed anywhere.

- [ ] In `docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md`,
    repoint the single `docs/bugs/open/host-cannot-serve-packaged-assets.md`
    citation at the issue. Keep the amendment's meaning intact: the player's
    media is blocked, so the blur half is proved in the editor mount and the
    foreground-text half moves to Task 11.
- [ ] Write `.superpowers/sdd/2026-09-26-reference-theme-fidelity/bug-registry-moved.md`:
    one paragraph saying the bug registry moved to GitHub Issues on 2026-09-27,
    the issue number for the hosted-asset defect, and that
    `glass.spec.ts` and `glass-fixture.ts` still carry the old path in their
    comments and must be repointed in Task 5's follow-up. That file is ignored
    execution state, which is the right home for a note to a running agent.
- [ ] **Do not edit** `glass.spec.ts` or `glass-fixture.ts`. Record the deferred
    repoint as a checkbox on Task 5 of the active plan so it survives
    compaction, and say in the report that it is deliberately outstanding.
- [ ] Commit the plan file only.

**Verification:** `rg -n "docs/bugs" docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md`
returns nothing, and the note file exists. Confirm the two e2e files are still
intact and still uncommitted — if the subagent has landed them, repoint those
comments in this task instead of deferring.

**Failure mode:** editing a file the subagent is mid-write produces a conflict
the controller will not attribute. Deferring costs one stale comment; clobbering
costs the task.

---

## Phase 3 — Retire the registry

### Task 7: Delete `docs/bugs/` and verify the move

**Outcome:** the registry is gone and nothing live points at it.

**Constraints:** delete only after every reference is repointed, so the tree is
never in a state where a citation resolves to nothing. The archived plan's link
is repointed, not left to rot.

- [ ] `git rm -r docs/bugs/`
- [ ] Confirm the whole-repo sweep: `rg -n "docs/bugs" .` finds nothing outside
  the two e2e files deferred in Task 6 and any `archive/` history you judged not
  worth changing.
- [ ] Confirm the four issues are readable: `gh issue list --state all --limit 10`
  shows them with the right states.
- [ ] Confirm the agent path works end to end: `gh issue view <n>` on an open
  migration issue renders the body with its sections intact.
- [ ] Commit the deletion alone, so the delete is reviewable as its own change.
- [ ] Update the spec's `Status:` line to `implemented` in the same commit,
  recording what was observed — labels exist, four issues exist, forms render,
  no live reference remains. Per `docs/superpowers/specs/README.md` the status
  and its evidence move together.

**Verification:** the repository-wide sweep is the gate. A single surviving
`docs/bugs` reference outside the two deferred comments is a failure, and the
deferred comments are named in the report rather than forgotten.

**Failure mode:** deleting before repointing leaves the archived plan and the
active plan citing a path that no longer resolves, and git history will not save
a reader who has not checked out an old commit.

## Verification cadence and commands

This plan touches no product source and needs no build. Its checks are the
GitHub surface and the repository sweep.

```bash
npm run status:check                 # from src/web/ — STATUS.md is untouched
gh label list
gh issue list --state all --limit 10
gh issue view <n>
rg -n "docs/bugs" .                 # must be empty apart from the two deferred
```

Run the broad gate only if product source is touched, which this plan does not
do. If the deferred e2e repoint happens in Task 6 because the subagent landed
first, run `npm run typecheck` and `npm run lint` from `src/web/` before
committing, since those are comment-only edits in a test file.

## Review and execution handoff

Review Focus item 5 is the one that is not closed by a passing check: the
override of the spec's sequencing rule is a judgement the reviewer should
confirm rather than a fact the plan proves. The rest of the plan either creates
a GitHub object that can be read back, or leaves a repository-wide absence that
a single search proves.

This plan is a single tightly-ordered sequence: Tasks 4–6 cite issue numbers
Task 2 prints, and Task 7 deletes what Task 5 repointed. It suits native
execution, where the numbers stay in one context, over subagent dispatch, which
would have to carry them across a handoff.

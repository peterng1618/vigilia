# GitHub Issues as the backlog

- **Status:** superseded by [ADR-0019](../../decisions/0019-the-backlog-is-two-files-split-by-state.md).
  Implemented as written on 2026-09-27, then overtaken: the register it dissolved was
  rebuilt in-repo as `docs/product/backlog.jsonl` plus `backlog-archive.jsonl`, and the
  defect queue it installed was never the one the project actually worked from.
- **Date:** 2026-09-27
- **Queue:** independent of the feature queue. Runs when the active plan closes.

> **Read this as history, not as the current design.** Every statement below describes
> what was true on 2026-09-27. The current rules are in
> [`AGENTS.md`](../../../AGENTS.md) and ADR-0019: an issue is an input surface, the
> in-repo register is the source of truth, and a finding not fixed in the task that
> found it rides that commit as a trailer. The reasoning here — one owner per fact,
> issues as the thing both a human and an agent can write to — still holds, and the
> reason it did not survive is recorded in ADR-0019's rung 4.

## Intent

Bugs, feature requests and feedback live in one place both the agent and the
human can write to, in a shape that helps whoever picks the item up next —
usually an agent with no memory of how it was found.

This replaces the in-repo bug registry. It does **not** replace
`STATUS.md`, which keeps sole ownership of the active plan and the queue order.

## What replaces what

| Today | Becomes |
|---|---|
| `docs/bugs/open/*.md` | open issue, `bug` + triage state |
| `docs/bugs/closed/*.md` | closed issue, resolving commit in the body |
| `docs/bugs/README.md` | deleted; `docs/README.md` row repoints to Issues |
| Requests and feedback not yet scheduled | `enhancement` / `feedback` issue |
| `STATUS.md` active plan and queue | **unchanged** |

Nothing else moves. Specs, plans, requirements, ADRs, ownership and the
Superpowers ledger stay in the repo, because they are design record rather than
backlog, and `docs/README.md` already forbids a parallel system elsewhere.

## When a defect becomes an issue

A judgement about size, made once at observation. Not a count of attempts.

**File it** — any one of these holds:

- The cause is not established.
- More than one owner could plausibly fix it.
- The fix needs a design decision, not a decision already recorded somewhere.
- It spans subsystems or owners.
- It blocks, or puts at risk, the active plan.
- It would need a spec rather than a task.

**Fix on the fly** — all of these hold:

- The cause is named, with `file:line`.
- The fix sits inside one owner.
- The correct behaviour is already specified; nothing has to be decided.
- A regression test is obvious from the cause.
- No work is lost and no data is misrepresented.

The agent states which side it took and why, in the commit that does the work.
A small fix that recurs graduates to an issue. Nothing is attempted three times
unrecorded — at the third, file it and say what was tried.

## Issue format

Two entry points, one shape. Humans file through the issue form; agents run
`gh issue create --body-file`. Both produce the same sections, because the
current in-repo records already carry them and they are what makes a record
worth keeping.

**Bug:**

- **What happens** — the precise symptom, not the diagnosis.
- **Why** — root cause with `file:line`, or `cause not established` stated
  outright. A guess labelled as a cause is worse than no cause.
- **Why it is not \<adjacent subsystem\>** — the section that stops the next
  agent repeating an investigation already completed. Omit it only when there
  genuinely is no adjacent candidate.
- **Evidence** — reproduction, test names, commit.
- **Next pickup action** — and the option to decline choosing, as the existing
  delete-in-group record does, when the choice between owners is itself the
  design question.

**Request and feedback:** what, which journey it breaks, evidence, and what
"done" would look like. Shorter by design — an item that needs the bug shape is
a bug.

## Labels and state

Two custom labels over GitHub's defaults:

| Label | Meaning | Set by |
|---|---|---|
| `needs-triage` | filed, not yet judged or accepted | both issue forms |
| `blocked` | waiting on a named plan or decision | the agent, per `AGENTS.md` |

Reuse `bug`, `enhancement`, `wontfix` and `duplicate` unchanged.

A `queued` label is deliberately absent. An accepted request closes its issue
with a link to the spec, so no issue carries queue state. Labels that nothing
ever sets are a second, wrong source of truth — which is why there is no
`feedback` label: a GitHub issue form cannot map a dropdown answer to a label,
so it would have had no writer, and the form's own `Kind` question already
records it.

## Roadmap lifecycle

1. Filed as `needs-triage`, human or agent.
2. Judged: complex or large becomes an issue; small and simple is fixed on the
   fly; a request is accepted into the queue or declined.
3. Accepted: `STATUS.md` names it, and the issue **closes** with a link to the
   spec or plan that now owns it.
4. Declined: closes with the reason. Silence is not a decline; a closed
   roadmap issue says where it went or why it is not going.

Feedback stays open until acted on or declined. Blocking findings from the
author journey proof are bugs, not feedback.

## Sequencing: the active plan

**Do not delete `docs/bugs/` while a plan is running.** The active
reference-theme fidelity plan cites the hosted-asset defect — now
[#3](https://github.com/peterng1618/vigilia/issues/3) — and two e2e files
comment on the same record, one of which a subagent is editing right now.
Deleting under it breaks a pointer a running task depends on.

Migration runs after the active plan closes. It is a few minutes of work when
that is true and a broken reference when it is not.

**Overridden on 2026-09-27, and completed.** The user authorised migration while
reference-theme fidelity was still active. The deferral this section called for
turned out not to be needed: the Task 5 subagent had already landed the two e2e
files, so all three citations — the plan's, `glass.spec.ts`'s and
`glass-fixture.ts`'s — were repointed at the issue. Nothing was deferred and
nothing is outstanding. A note in the plan's execution workspace tells that
subagent the registry is gone and where the defect went.

## Repo changes

- `AGENTS.md`: the three-attempts bullet becomes the judgement rule above, plus
  filing, closing and the no-duplication rule restated for issues.
- `.github/bug-report-template.md`: the body an agent posts with. The form a
  human fills asks the same questions; both are needed because `gh` cannot post
  an issue form.
- `docs/README.md`: the bug row repoints to Issues; `bugs/README.md` is deleted.
- `docs/bugs/`: deleted, with the running plan's citation repointed first.
- `docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md` and the two
  e2e comments: repointed at the hosted-asset issue before the deletion, so the
  tree was never in a state where a citation resolved to nothing.
- `docs/superpowers/plans/archive/2026-09-25-snapping-fidelity.md`: links the
  closed bug file it closed. Repointed to the issue number; its history is not
  edited.

The author-journey proof spec needed no change: its finding protocol already
named this spec rather than a bug path.

## Migration

Four issues, created once and never touched again:

- The two open bugs, as open issues, preserving their bodies.
- The two closed bugs, as closed issues carrying the commit that closed them,
  so "did we already try this?" stays answerable by search.

Then delete `docs/bugs/`. No sync rule afterwards: an issue is either the record
or it is not there.

## Not claimed

- **No offline backlog.** Issues need the network and are not in git history. An
  agent without `gh` access sees the queue in `STATUS.md` and no backlog detail.
  Accepted for a solo repository; it is the cost of one owner per fact.
- **No public process.** The repository is public, so issue bodies are public.
  Nothing here is sensitive, but bug reports will be readable by strangers.
- **No GitHub Projects board.** Ordering lives in `STATUS.md`; a second ordered
  list would be a second owner.
- **No automation.** Nothing polls Issues, syncs them into the repo, or triages
  on a schedule.

## Acceptance

- `docs/bugs/` is gone, and `docs/README.md` points at Issues.
- `AGENTS.md` states the judgement rule, the filing and closing duty, and no
  longer mentions `docs/bugs/`.

**Observed 2026-09-27, both met.** `docs/README.md` pointed at Issues until
2026-10-01, when ADR-0019 repointed it at the in-repo register; that is the
supersession, not a failure of this spec.
- Every live reference to a `docs/bugs/` path is repointed, including the two
  e2e comments and the active plan; the archived plan's link resolves to its
  issue.
- The two custom labels exist with the meanings above, and each has a writer.
- The four migration issues exist, the two open ones open and the two closed
  ones closed with a commit that changed source.
- The bug issue form covers every section of the bug shape, including
  `cause not established` and the option to decline choosing an owner.

## Verification

Proven by use, not by test. File a real defect as an agent and read the result
back through `gh issue view`; file one through the web form as the human. The
form's dropdowns must make the judgement reachable without reading this spec.

The repointing is verified by searching the repository for `docs/bugs/` and
finding no live reference, and by following every link in the changed files.
Whether the judgement rule is *well-judged* is not verifiable here — it is
improved by the first few times an agent takes the wrong side, and corrected in
`AGENTS.md` when it does.

### What was observed on 2026-09-27

- Two labels created with the descriptions above, read back through
  `gh label list`; no `queued` label exists. A third, `feedback`, was created
  and then **deleted** — a GitHub issue form cannot map a dropdown answer to a
  label, so it had no writer, which this spec calls a second source of truth.
- All four records are issues: #2 and #3 open with `bug` + `needs-triage`,
  #4 and #5 closed as `completed`. Their bodies name `a3d1eca` and `6ea5314`,
  each checked to have changed something under `src/` — the first migration
  named the commit that only rewrote the bug record, which would have answered
  "did we already try this?" with nothing.
- `AGENTS.md` carries the size judgement and the request lifecycle, and names
  no `docs/bugs/` path.
- The repo-wide sweep went from six bug-file citations to zero. The remaining
  mentions of `docs/bugs/` are in this spec, its plan and `STATUS.md`, which
  describe its removal.
- **Not verified:** the two forms' rendered check. GitHub reads issue forms from
  the default branch, so they could only be validated structurally (schema,
  required fields, non-empty dropdowns) until they reach `main`. A form GitHub
  rejects shows no template at all, indistinguishable from "not configured".

## Related

[author journey proof](2026-09-27-author-journey-proof-design.md) — its finding
protocol moves with the bug rule, and its Findings table stays in the plan until
Phase 1 decides which entries graduate to issues.

Agent rules: [`../../../AGENTS.md`](../../../AGENTS.md). Documentation map:
[`../../README.md`](../../README.md).

Next gate: review this written spec. Only afterward write the implementation
plan; do not run it while a plan is active.

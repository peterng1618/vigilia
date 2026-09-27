# GitHub Issues as the backlog

- **Status:** queued spec; awaiting written-spec review. Plan: not yet written.
- **Date:** 2026-09-27
- **Queue:** independent of the feature queue. Runs when the active plan closes.

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

Three custom labels over GitHub's defaults:

| Label | Meaning |
|---|---|
| `needs-triage` | filed, not yet judged or accepted |
| `blocked` | waiting on a named plan or decision |
| `feedback` | an observation or preference, not a requested change |

Reuse `bug`, `enhancement`, `wontfix` and `duplicate` unchanged.

A `queued` label is deliberately absent. An accepted request closes its issue
with a link to the spec, so no issue carries queue state. Labels that nothing
ever sets are a second, wrong source of truth.

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

**Overridden on 2026-09-27.** The user authorised migration while
reference-theme fidelity is still active, with the risk managed rather than
waited out: the plan's citation is repointed at the issue, a note goes to the
Task 5 subagent in its execution workspace, and the two e2e comments are
deliberately left stale rather than edited under a subagent that is writing
them — one of them untracked, so an edit could lose work that exists nowhere
else. The follow-up repoint is recorded as a checkbox on that plan's Task 5.

## Repo changes

- `AGENTS.md`: the three-attempts bullet becomes the judgement rule above, plus
  filing, closing and the no-duplication rule restated for issues.
- `docs/README.md`: the bug row repoints to Issues; `bugs/README.md` is deleted.
- `docs/bugs/`: deleted once the active plan closes.
- `docs/superpowers/specs/2026-09-27-author-journey-proof-design.md`: its
  finding protocol names `docs/bugs/open/`; repointed to the issue.
- `docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md` and the two
  e2e comments: repointed in the same commit as the deletion.
- `docs/superpowers/plans/archive/2026-09-25-snapping-fidelity.md`: links the
  closed bug file it closed. Repointed to the issue number; its history is not
  edited.

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
- Every live reference to a `docs/bugs/` path is repointed, including the two
  e2e comments and the author-journey spec; the archived plan's link resolves
  to its issue.
- The three custom labels exist with the meanings above.
- The four migration issues exist, the two open ones open and the two closed
  ones closed with their resolving commit.
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

## Related

[author journey proof](2026-09-27-author-journey-proof-design.md) — its finding
protocol moves with the bug rule, and its Findings table stays in the plan until
Phase 1 decides which entries graduate to issues.

Agent rules: [`../../../AGENTS.md`](../../../AGENTS.md). Documentation map:
[`../../README.md`](../../README.md).

Next gate: review this written spec. Only afterward write the implementation
plan; do not run it while a plan is active.

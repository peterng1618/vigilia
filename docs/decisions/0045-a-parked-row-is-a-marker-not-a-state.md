# 0045 — A parked row is a dated marker, not a fourth state

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `scripts/backlog-check.mjs`

## The problem

The user ruled on 2026-10-15 that a real-but-low-value finding found during the
drain is **parked, not closed**: it stays `open` and **marked**, so the census can
separate "known, not scheduled" from "to do" rather than shrinking its count by
forgetting. `withdrawn` stays reserved for a row whose subject is gone.

The policy is worthless without a representation. The triage of the 94 rows no
phase carries is the next work after Phase 12, and it decides each row by
**fixing**, **parking** or **withdrawing** it — so "parked" has to be a thing the
register can express and the checker can find, or triage cannot be run at all and
the count it is meant to protect keeps lying.

What made this non-obvious is that the register has a **closed** set of states and
a hand-rolled checker, so "add a state" is the first shape that suggests itself —
and it is the wrong one, for the reason below.

## Rung 1 — Vigilia

**Searched:** the two registers and every script for `parked|deferred|postponed|
shelved|blocked`; the `state` values actually in use across both files.

**Found:** nothing to reuse in the register — no row carries a deferred concept,
and the only hits are prose (one row's own text saying it was parked, and a
`design-md.mjs` comment about a parked impostor, both unrelated). The states in use
are exactly three, and the register is **closed** over them:

| State | Rows |
|---|---|
| `verified` | 307 |
| `open` | 206 |
| `withdrawn` | 17 |

**But the project already solved this shape one surface over.** The repo's issue
register has a **`blocked` label** — its own description is "Waiting on a named
plan or decision" — and `AGENTS.md` states the rule as "When an issue waits on a
named plan or an unanswered decision, set `blocked` and say what it waits on." So
this project's own convention for *waits, do not close* is **a mark on an item that
stays open**, not a state. That is the precedent, and it was chosen here for the
same reason the register is being asked to choose now.

## Rung 2 — dependencies

**Searched:** `src/web/package.json` and every `packages/*/package.json` for a
tracker-shaped dependency (`jira|linear|tracker|issue|todo|backlog`).

**Found:** nothing. The only hits are this repo's own npm scripts
(`backlog:check`, `gates:self-test`). The register is hand-rolled JSONL plus one
checker; no installed dependency models a row's state, and adding one for a
marker would be the dependency-for-a-few-lines case.

## Rung 3 — platform

**Searched:** what JSON, Node or git natively give a "row state".

**Found:** nothing, and this is the rung that misleads here. JSON has no notion of
a state, so the register's three states are a *convention the checker enforces*
rather than something the format provides. That means the cost of a fourth state is
not one value — it is a new branch in every reader, and `checkPlacement`'s rule 6
(the split by state, which refuses a live row in the archive) is written as a
two-way test that a third closed state would silently widen.

## Rung 4 — ecosystem

**Searched: COULD NOT BE RUN.** No web search or fetch tool is available in this
session, so this rung has no evidence and is recorded as **not run** rather than as
"nobody has solved this shape" — the two are different claims and only one of them
is true here.

**What stands in its place, and why that is weaker:** rung 1's `blocked` label is
this project's own answer to the same question, which is real evidence but is
*internal*. The general expectation — that issue trackers with only open/closed
states push "deferred" onto a label, while trackers with richer workflows make it a
status — is **not verified here** and is deliberately not written as a finding.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| A fourth `state: "parked"` | Reads as first-class; a census filters by state | Every reader gains a branch; `checkPlacement`'s two-way closed test widens; `verified`/`withdrawn` rows move files while `parked` would not, so the split-by-state rule needs a third clause | The register's own rule 6 becomes conditional, and the archive's meaning ("what is closed") gains an exception | **Rejected** — and the repo already answered it: `blocked` is a label precisely so the issue's state stays open |
| A `parked` field (`true` or a date) | Trivial to query | A second mechanism for "a dated decision attached to a row", where `detail` already carries `RULED <date>:` | Two ways to say a thing, and the reader has to know both | **Rejected** |
| A `PARKED <YYYY-MM-DD>:` marker in `detail` | The register's existing convention for exactly this: a dated decision attached to a row **without changing its state**. Parallel to `RULED <date>:`, and parallel to the repo's own `blocked` label | The checker must validate the marker, because a marker nothing validates is the thing it exists to prevent | None found | **Chosen** |

## Rung 6 — probe

Measured rather than asserted, over both registers at 2026-10-16:

- **530 rows**, states `verified` 307 / `open` 206 / `withdrawn` 17 — three values,
  no fourth in use and none in the checker's accepted list.
- **No row carries `PARKED`** in any spelling, so the rule below lands on a
  register where it currently matches nothing and cannot retroactively reinterpret
  a row.
- The precedent's own shape, read at source: `gh label list` shows `blocked` —
  "Waiting on a named plan or decision" — beside `covered`, `undecided` and
  `needs-triage`. **Four of this repo's labels are states of a *wait*, and none of
  them closes the issue.**

## Decision

**A parked row stays `open` and carries a `PARKED <YYYY-MM-DD>:` marker in its
`detail`.** The specific reason: the register's convention for attaching a dated
decision to a row is a marker in `detail` — `RULED <date>:` already works that way
— and the repo's own issue register attaches "this waits" as a **label on an open
item** rather than as a state. Reusing the convention means no reader gains a
branch, rule 6's split by state stays a two-way test, and a parked row is found the
same way a ruled one is: by grepping a marker, which is how the drain already finds
rulings.

**What the checker owes, and why it is not optional.** A marker that nothing
validates is exactly the failure this note's own rungs describe: `PARKED 2026-10-16`
without the colon, or `PARKED soon`, would read as parked to a human and as nothing
to the census — parking a row by making it invisible, which is the outcome the
policy exists to prevent. So `scripts/backlog-check.mjs` gains three rules, each
for a distinct way the marker can lie:

1. **A near-miss is refused.** Any `PARKED`-shaped token that is not
   `PARKED <YYYY-MM-DD>:` is a problem, so a malformed marker fails the gate rather
   than passing as prose.
2. **A parked row must be `open`.** Parking a `verified` or `withdrawn` row is a
   contradiction — the row is already closed, so there is nothing to defer.
3. **The count is reported**, so the census can separate "known, not scheduled"
   from "to do" without re-deriving it, which is the whole point of the policy.

---
name: vigilia:spec-driven-development
description: Keeps Vigilia implementation and specs in sync. Use when implementing a feature that has a spec in .agents/specs/, writing a new spec, verifying code against a spec, or updating a spec after a behaviour change.
---

# Spec-driven development

Specs live in [`.agents/specs/`](../../specs/README.md). Read that README for the
file convention and for how specs differ from gate evidence and ADRs.

## The precedence order

1. **The design document** — [`.agents/design/plan.md`](../../../.agents/design/plan.md).
   User-authored, revision 9, the top-level spec. It wins.
2. **A spec in `.agents/specs/`** — refines the design document for one feature.
   It never contradicts it.
3. **The code.**

When you find a conflict between levels, **stop and get a human decision.** Do
not encode the disagreement in a spec, and do not silently implement whichever
you prefer — §164 requires human review for scope changes, and a contradiction
between the design document and a spec is exactly that.

## Starting work on a feature with a spec

1. Read the spec **and** the design-document sections it cites. The spec is a
   refinement; reading it alone loses the constraints.
2. Check `Status`. A `draft` spec has not been agreed — confirm before building
   to it.
3. Identify which acceptance criteria already have tests. Per §33 an untested
   criterion is not met, regardless of what the code appears to do.

## Writing a new spec

Write one when behaviour is worth pinning down beyond the design document: a
schema shape, a state machine, an error taxonomy, a set of edge cases. Do not
write one for a change whose behaviour is obvious from the diff.

The **edge cases and error states are the valuable part.** The happy path is
usually inferable from the code; the exhaustive list of what happens when a
sensor disappears mid-render, or a theme references a deleted global, is not.

Always fill `Out of scope`. It is what stops the same question being
re-litigated in three months.

## Keeping a spec honest

When implementation diverges:

- **Behaviour intentionally changed** → update the spec in the **same commit**.
  A stale spec is worse than none, because the next reader trusts it.
- **Spec was wrong or unachievable** → update it, and record *why* in the spec
  so the constraint is not rediscovered later.
- **Spec superseded** → mark `Status: superseded` and point at its replacement.
  Do not delete it; the reasoning stays useful.
- **Engine or platform cannot do what the spec requires** → this is a §85-style
  gap. Record the gap explicitly, propose alternatives, and get human agreement
  before committing to one. The gauge-gradient gap in `.agents/decisions.md` is
  the worked example.

## Verifying code against a spec

Work criterion by criterion and, for each, name the observable behaviour and the
test that proves it. Report three outcomes distinctly:

- **Met** — behaviour exists and a test covers it.
- **Implemented but untested** — say so. This is not met.
- **Not implemented.**

Never report a criterion as met on the strength of reading the code. And do not
claim you ran the .NET tests unless an SDK is actually installed — currently none
is.

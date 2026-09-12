# Specs

A **spec** records the intended behaviour of a feature and is kept in sync with
the code. It is committed and durable.

## How this differs from the other two planning locations

| Location | Holds | Lifetime |
|---|---|---|
| `.agents/specs/` | What a feature should do, and its acceptance criteria | Lives with the feature |
| `docs/gates/` | Gate acceptance **evidence** — measurements, observations, probe results | Append-only record |
| `docs/decisions/` | An ADR: one decision, its context, its consequences | Immutable once accepted |

A spec says *what the thing does*. A gate entry says *what we measured*. An ADR
says *why we chose this*. If you are about to duplicate content between them, the
content belongs in exactly one and the others should link to it.

Throwaway implementation plans do **not** belong here — keep those out of the
repository.

## When to write one

Write a spec when a feature has behaviour worth pinning down beyond what the
design document already says: a schema shape, a state machine, a set of edge
cases, an error taxonomy. Do not write one for a change whose behaviour is
obvious from the diff.

The design document ([`docs/pc-stats-display-agent-plan.md`](../../docs/pc-stats-display-agent-plan.md))
is the top-level spec and takes precedence. A spec here **refines** it for one
feature; it never contradicts it. If you believe the design document is wrong,
say so and get a human decision — do not encode the disagreement in a spec.

## File convention

`<NNNN>-<kebab-name>.md`, numbered in creation order.

```markdown
# <NNNN> — <Feature name>

- **Status:** draft | accepted | implemented | superseded
- **Design document sections:** §NN, §NN
- **Specs superseded:** none

## Problem
What is not currently true, and why it matters.

## Behaviour
The observable contract. Enumerate edge cases and error states explicitly —
these are the part worth writing down.

## Out of scope
What this deliberately does not do, so nobody re-litigates it later.

## Acceptance
Observable behaviour plus the test that proves it. Per §33, a checklist item
without a test is not acceptance.
```

## Keeping specs honest

When implementation diverges from a spec, **update the spec in the same commit**
or mark it `superseded`. A stale spec is worse than no spec: the next reader
trusts it. `vigilia:spec-driven-development` covers the sync discipline.

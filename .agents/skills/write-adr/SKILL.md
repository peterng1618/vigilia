---
name: vigilia:write-adr
description: Record or revise a current architecture decision in .agents/decisions.md.
---

# Writing decisions

`.agents/decisions.md` contains **current positions only**. When a decision is
reversed, rewrite it in place. Git history preserves the old reasoning.

## Put the right thing in the right file

| Content | File |
|---|---|
| Lasting architecture choice | `.agents/decisions.md` |
| Feature behaviour / edge cases | `.agents/specs/` |
| Current progress / test counts | `.agents/status.md` |
| Product requirement | `.agents/plan.md` |

## Format

Use a claim as the `###` heading, then keep the entry short:

1. decision;
2. reason that materially forced it;
3. important consequences or constraints;
4. what would reopen it, if useful.

Normally this is **one short paragraph plus bullets**. Do not preserve rejected
alternatives as a narrative unless their difference is essential to understand
the current constraint. Do not paste debugging chronology, test sabotage, or
session history.

Record `**Decided by:**` only when authority matters. Use `*Supersedes: …*` when
replacing an earlier named position.

## Rules

- The product plan outranks architecture decisions.
- Product taste, scope expansion and external effects require human review.
- Architecture, schema design and sequencing are agent-owned unless the user has
  already directed them.
- Propagate a reversed decision to contradictory specs, status, comments and
  tests in the same change.
- Preserve reusable lessons in `.agents/lessons.md`, not inside the old decision.
- If a measurement is the reason for the decision, record only the number that
  changes the choice and the test/probe that produced it.

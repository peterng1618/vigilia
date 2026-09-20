---
name: vigilia:spec-driven-development
description: Keep Vigilia specs and implementation aligned. Use when writing, implementing, reviewing, or updating a spec in .agents/specs/.
---

# Spec-driven development

Read `.agents/plan.md` first, then the relevant active spec. The plan sets
product requirements; a spec refines incomplete/current work.

## Write a spec only when needed

Use a spec for behaviour that is not obvious from the diff: persisted shapes,
state transitions, edge cases, error handling, engine gaps or multi-stage work.
Do not write one for routine implementation detail.

A good spec contains only intent, current contract, required edge cases,
out-of-scope, acceptance and sequencing when needed. Git stores chronology.

## Keep the active set small

- Once a spec is fully implemented and its durable rules are represented by the
  plan, architecture, tests or code ownership, delete the spec. Git is the
  archive.
- Do not keep separate specs solely as historical behaviour references.
- If a replaced implementation leaves potentially useful behaviours that no
  longer exist, collect only those missing behaviours in a **review backlog**
  like spec 0014. They are not requirements until explicitly retained.
- Do not copy completed behaviour into multiple docs for safety.

## While implementing

1. Read cited `§N` requirements.
2. Confirm the spec is active/accepted rather than review-only.
3. Identify observable behaviour and evidence for each criterion.
4. Implement at the existing owner/boundary.
5. Update the spec with intentional behaviour changes in the same change.
6. If an engine cannot express a requirement, record the gap and get the needed
   product decision instead of silently approximating it.

## Verification language

Use only:

- **Met** — observed behaviour plus a test.
- **Implemented, unverified** — code exists but runtime evidence does not.
- **Not implemented**.

Do not claim runtime behaviour from source inspection alone.

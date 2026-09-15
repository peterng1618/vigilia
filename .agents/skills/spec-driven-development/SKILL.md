---
name: vigilia:spec-driven-development
description: Keep Vigilia specs and implementation aligned. Use when writing, implementing, reviewing, or updating a spec in .agents/specs/.
---

# Spec-driven development

Read `.agents/design/plan.md` first, then the relevant spec. The plan sets product
requirements; the spec refines one feature; code follows both.

## Write a spec only when needed

Use a spec for behaviour that is not obvious from the diff: persisted shapes,
state transitions, edge cases, error handling, engine gaps, or multi-stage work.
Do not write one for routine implementation detail.

A good spec contains only:

- problem / intent;
- current decision;
- required behaviour and edge cases;
- out of scope;
- acceptance evidence;
- migration stages when sequencing matters.

**Do not write a chronological work log.** Git stores history. Measurements that
matter to a decision belong in `decisions.md`; transient run counts belong in
`status.md`.

Target **≤400 lines / ≤20 KB**. If an edited spec is already much larger, compact
it before adding more. Prefer tables and short bullets over narrative.

## While implementing

1. Read the cited `§N` requirements.
2. Check whether the spec is accepted or draft.
3. Identify the observable behaviour and test for each criterion.
4. Implement at the existing owner/boundary.
5. If behaviour changes intentionally, update the spec in the same commit.
6. If the engine cannot express a requirement, record the gap and get the
   required product decision instead of approximating silently.

Do not keep superseded alternatives inline. State the current decision and rely
on git history for the old one.

## Verification language

Use only:

- **Met** — observed behaviour plus a test.
- **Implemented, unverified** — code exists but evidence does not.
- **Not implemented**.

Do not claim runtime behaviour from source inspection alone.
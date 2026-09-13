---
name: vigilia:write-adr
description: Writes a Vigilia architecture decision record in .agents/decisions, and decides whether a change is an ADR at all rather than a spec or a gate entry. Use when recording a decision, choosing between options with lasting consequences, revisiting or superseding an earlier decision, or when asked why something was chosen.
---

# Writing an ADR

`.agents/decisions.md` holds one decision per file: what was decided, the context
that forced it, and what it costs. An ADR is **immutable once accepted** —
correct it by superseding it, never by rewriting it.

## Is this actually an ADR?

| You are recording | Write it in |
|---|---|
| A decision with lasting consequences, and the alternatives rejected | `.agents/decisions.md` |
| What a feature should do, and its edge cases | `.agents/specs/` |
| A measurement or observation | `.agents/decisions.md` (`vigilia:gate-evidence`) |

If the answer to "what would change this?" is "nothing, it is just how the code
works", it is not an ADR. Do not write one for a choice the diff explains.

The design document (`.agents/design/plan.md`) outranks every ADR
and is **user-authored — do not rewrite its prose**. An ADR may supersede its
*sequencing* (ADR-0006 did) but never its content or acceptance criteria without
a human decision.

## File convention

`<NNNN>-<kebab-name>.md`, numbered in creation order, named for the decision
rather than the topic — `0005-own-the-editor-layer.md`, not `0005-editor.md`.

```markdown
# ADR-NNNN — <The decision, as a claim>

- **Status:** Proposed | Accepted | Superseded
- **Date:** YYYY-MM-DD
- **Supersedes:** <link, or "none">
- **Decided by:** <who, and on what authority>

## Context
What forced the decision. Include the evidence that exists **now** and did not
exist before — that is usually why the decision is being made or revisited.

## Decision
The choice, stated plainly.

## Consequences
What this costs, what it forecloses, and what now becomes true. Include the
consequences you dislike.

## What would change this decision
The observation that would reopen it. An ADR without this is a preference.
```

## Rules that matter here

**`Decided by` is not decoration.** §164 reserves schema breaks, major
dependency changes and scope expansion for human review. If you decided
something in that class, record the authority explicitly — ADR-0005 does, and
names the date the user granted it. If you do not have that authority, write the
ADR as **Proposed** and say what you need.

**Record the rejected options and why**, with the specifics that drove it —
versions, pins, measured numbers. "We chose X because it is better" is not a
record; ADR-0003 pinning LibreHardwareMonitorLib exactly is.

**Never edit an accepted ADR to change its meaning.** Two legitimate moves:
supersede it with a new one that links back, or append a dated **Addendum**
recording what changed and whether the decision still holds. ADR-0005 has one.
Clerical fixes — a broken link, a typo — are fine.

**Superseding is a two-file change.** The new ADR sets `Supersedes`; the old
one's `Status` becomes `Superseded` with a link forward. An ADR that is silently
obsolete is worse than none, because it still reads as current.

**Propagate the consequence.** A decision that contradicts `AGENTS.md`, a
skill, `THIRD-PARTY-NOTICES.md` or a package comment leaves the contradiction
live until you fix those too — in the same commit. ADR-0005 rejected Fabric, so
"do not add Fabric" belongs everywhere a foundation is mentioned; a leftover
"foundation not yet chosen" sends the next agent to install one.

---
name: vigilia:write-adr
description: Writes a Vigilia architecture decision record in .agents/decisions.md, and decides whether a change is an ADR at all rather than a spec or a gate entry. Use when recording a decision, choosing between options with lasting consequences, revisiting or superseding an earlier decision, or when asked why something was chosen.
---

# Writing an ADR

`.agents/decisions.md` is **one file holding every decision at its current
position only**. A reversed decision is *rewritten in place*; the dead reasoning
is deleted rather than left to read as current guidance, and the full original
text stays in git history if it is ever needed.

**This is not a per-file, immutable-ADR scheme, and this skill used to say it
was**, which is how a spec came to link at a path that had not existed for a
day. There is no `.agents/decisions/` directory; the numbered per-file ADRs
`0001`–`0007` live only in git history under `docs/decisions/`. `ADR-000N`
citations remain scattered through the source, so **cite an old decision by
number where the code already does, and a new one by its heading**.

## Is this actually an ADR?

| You are recording | Write it in |
|---|---|
| A decision with lasting consequences, and the alternatives rejected | `.agents/decisions.md` |
| What a feature should do, and its edge cases | `.agents/specs/` |
| A measurement or observation | `.agents/decisions.md` (`vigilia:gate-evidence`) |

If the answer to "what would change this?" is "nothing, it is just how the code
works", it is not an ADR. Do not write one for a choice the diff explains.

The design document (`.agents/design/plan.md`) outranks every ADR
and is **agent-owned** as of revision 10 — keep it current rather than
proposing changes to it. An ADR may supersede its
*sequencing* (ADR-0006 did) but never its content or acceptance criteria without
a human decision.

## Convention

An `###` heading under `## Settled`, **named as the claim it makes** — "The host
is Node/TypeScript, shipped as a CLI", not "The host". Then prose: what forced
it, what was decided, what it costs, and what would reopen it. No status
front-matter — a decision is in the file because it is current.

Two elements are not optional:

- **`**Decided by:**`** where the authority matters (see below).
- **`*Supersedes: …*`** as the closing italic line whenever this replaces an
  earlier position. Name the old decisions, and say in parentheses which parts
  of them survive. The pattern to copy:

  ```markdown
  *Supersedes: target .NET 10; sequence-the-.NET-host-after-the-frontend (whose
  ordering stands — the host was built last and took a different runtime
  entirely, which would have been a rewrite on top of three milestones of
  dependent work).*
  ```

Two other sections exist: `## Open — need a human` for a question that is
genuinely unanswered, and `## Resolved by a later spec` for a decision a spec
has since settled. Gate measurements are append-only observations and belong to
`vigilia:gate-evidence`, not here.

## Rules that matter here

**`Decided by` is not decoration.** §157 reserves **scope expansion, anything
with external effect, and product taste** for human review; architecture, schema
design and sequencing are yours. If a decision sits in the reserved class, or if
the user directed it themselves, record who decided and when — the manager
architecture decision does exactly that. If you need authority you
do not have, say plainly in the decision what you are waiting for and put it
under `## Open — need a human` instead.

**Record the rejected options and why**, with the specifics that drove it —
versions, pins, measured numbers. "We chose X because it is better" is not a
record; ADR-0003 pinning LibreHardwareMonitorLib exactly is.

**Rewriting is the whole move, and it is destructive on purpose.** Replace the
heading and the reasoning; do not strike the old text through, keep it in a
"previously" paragraph, or leave two positions side by side. A decision that
still reads as current is worse than none. Where a position changed more than
once, record only where it landed and why — the intermediate steps are noise
that future readers mistake for nuance.

**A surviving lesson outlives its decision.** When a rejection is reversed, the
thing it *taught* often still holds — "test a foundation against the constraint
that would disqualify it, first" is worth keeping whatever happens to the
foundation. Move it to [`../../lessons.md`](../../lessons.md) rather than
deleting it along with the reasoning.

**Propagate the consequence.** A decision that contradicts `AGENTS.md`, a
skill, `THIRD-PARTY-NOTICES.md`, a package comment, a source comment or a
**test** leaves the contradiction live until you fix those too — in the same
commit. Expect a reversal to have more copies than you think: a prohibition
tends to be restated wherever the topic comes up, including in package-manifest
comments beside the very dependency block a future agent would edit. **Grep for
the claim, not just the topic**, and count a live test as guidance — it is the
one copy that fails loudly instead of quietly misleading someone.

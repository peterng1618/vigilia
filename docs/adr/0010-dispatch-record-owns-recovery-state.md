# ADR-0010: A live dispatch record owns recovery state

**Status:** Accepted

## Context

Subagent-driven execution keeps its dispatch state — which agent is working,
against which base commit — only in the controller's context. The SDD ledger
records rulings and completions, never what is running, so after compaction a
resumed controller cannot distinguish an agent still running from one that
finished from one whose work was lost. That ambiguity produced a working-tree
edit nobody could account for.

Claude Code's `PreCompact` cannot make the model take a turn, so state cannot be
requested from the controller at compaction time. `SessionStart` stdout does
reach context, so the read-back half can be an injection.

## Decision

- Recovery state is the live dispatch record, not a heuristic over other files.
  **The active plan is the workspace holding a live dispatch record.** Ledger
  mtime and `STATUS.md` parsing both create a second, weaker definition of
  "active"; neither is used.
- The record is written by the controller, one file per in-flight agent, under
  the plan's git-ignored SDD workspace. `SubagentStart`/`SubagentStop` carry
  `agent_id` and `agent_type` but not the task, plan or base commit, so lifecycle
  hooks cannot author the record — they can only audit it.
- Controller-oriented recovery hooks no-op inside a subagent. Project hooks run
  in subagents, so a worker that compacts must not receive instructions about
  reconciling other agents. `agent_id` presence is the discriminator.
- Recovery state stays inside the SDD workspace, which is self-ignoring. It is
  scratch, not tracked project content.

## Consequences

Queued and completed plans cannot be mistaken for active, and a live dispatch
stays recoverable regardless of how long its ledger has been quiet.

The one failure recovery cannot repair is a dispatch the controller never
recorded. A `SubagentStop` audit for unrecorded agent ids is the only mechanism
that could catch it, and is not implemented.

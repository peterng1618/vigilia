# Compaction Recovery Review

Review of commits `78767408` and `55215f6e`, following the controller's
self-diagnosis of the previous long multi-agent session.

## Verdict

**Keep the idea, revise the implementation before relying on it.**

The diagnosis is sound: after context compaction, the root controller can lose
the distinction between a subagent that is still running, one that completed,
and one whose work was lost. Persisting dispatch state before compaction and
re-injecting it afterward directly addresses that failure.

The Claude Code hook choices are also valid. Current Claude Code supports
`PreCompact`, `SessionStart` with source `compact`, and additional context
from `SessionStart` hooks. See <https://code.claude.com/docs/en/hooks>.

The remaining issues are in the recovery state model, not the hook concept.

## Corrections and accepted changes

- The edits to `.claude/settings.json`, `AGENTS.md` and the hook script were
  explicitly requested by the user. They do **not** violate the
  user-owned-environment rule.
- Narrowing the plan rule around test counts is correct: measured counts can be
  useful evidence that tests were actually collected; predicted future counts
  are brittle.
- Removing `skills-lock.json` is correct after the local skill copies it
  described were removed.

## Findings

### 1. One `dispatch.md` is underspecified for parallel workers

The workflow allows several independent workers inside one active phase, but the
new convention names one `<workspace>/dispatch.md` and says to rewrite it at
dispatch/completion. It does not define how multiple simultaneous dispatches are
represented or updated without overwriting each other.

**Recommendation:** store a collection keyed by stable `agent_id`, with at
least task, base SHA, state and timestamps. Updates should be atomic and
idempotent.

### 2. Dispatch lifecycle still relies too much on controller memory

The failure being fixed is loss of controller memory, but the durable half still
depends on the controller remembering to write `dispatch.md` correctly at each
dispatch and completion.

Claude Code exposes `SubagentStart` and `SubagentStop` hook events and
supplies `agent_id`. Those events can mechanically maintain lifecycle state,
while the controller records the semantic mapping from task to agent when it
dispatches.

**Recommendation:** automate start/stop state transitions where hooks expose
enough information. Keep model-written state only for information the lifecycle
events cannot know.

### 3. `activePlans()` conflicts with the single-active-plan rule

The script treats every ledger modified within 24 hours as active. That can:

- include queued or already-completed plans;
- exclude the real active plan after 24 quiet hours;
- ignore a live dispatch if its ledger has not changed recently.

`STATUS.md` is now the canonical owner of the single active plan, so filesystem
recency should not create another definition of "active".

**Recommendation:** resolve the active plan from `STATUS.md` or another single
canonical identifier. An explicit in-flight dispatch must remain recoverable
regardless of ledger mtime.

### 4. Runtime recovery files are currently Git-visible

The hook writes `.superpowers/sdd/checkpoint/<session>.md`, and the convention
adds `dispatch.md` under the same runtime tree. The repository's `.gitignore`
does not currently ignore these paths.

That means compaction can create new untracked files in an agent-driven working
tree, exactly where ownership of unexplained changes matters.

**Recommendation:** keep runtime recovery state outside tracked project content,
preferably in Claude Code's session scratch space when practical, or explicitly
ignore the runtime SDD/checkpoint paths.

### 5. Root and worker hook behavior should be separated

Claude Code hooks also run in subagents and expose `agent_id` / `agent_type`.
The checkpoint script currently does not distinguish a root controller from a
worker.

A worker that compacts can therefore run controller-oriented checkpoint and
resume logic and receive instructions about dispatching/reconciling other
agents.

**Recommendation:** controller recovery hooks should no-op for subagent
invocations. Subagent lifecycle hooks should only update their own dispatch
record.

### 6. The recovery subsystem needs tests for its actual failure modes

The 312-line script has a useful `--self-check`, but it only exercises
`statusLines()`. The risky behavior is orchestration and recovery.

**Recommendation:** add deterministic tests for at least:

- two concurrent dispatches under one active plan;
- start/stop updates for one agent without disturbing another;
- a live dispatch whose ledger is older than 24 hours;
- queued/recent ledgers not being treated as active;
- root versus subagent hook input;
- snapshot/resume with missing or malformed dispatch state;
- runtime checkpoint files remaining outside Git status.

Wire the self-check/test entry into a normal repository verification command so
the hook does not silently rot.

## Recommended shape

Keep the mechanism small:

1. `STATUS.md` selects the one active plan.
2. A structured runtime dispatch registry is keyed by `agent_id`.
3. Dispatch records map task + base SHA to the agent.
4. `SubagentStart` / `SubagentStop` update mechanical lifecycle state.
5. `PreCompact` snapshots root git state plus the dispatch registry.
6. Root-only `SessionStart(compact)` re-injects a concise recovery summary.
7. Detailed snapshot data stays on disk and out of Git.
8. Recovery code has focused deterministic tests.

This preserves the useful idea from `78767408` without turning compaction
recovery into a second workflow engine beside Superpowers.

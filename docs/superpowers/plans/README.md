# Implementation plans

Superpowers is Vigilia's sole planning/execution workflow.

Active executable plans live here. Move a completed or superseded plan to
`archive/`; it is historical context, not current instruction.
`.superpowers/sdd/` is ignored execution state and points to the plan it
executes.

Do not maintain parallel implementation-plan or project-workflow directories
under `.agents/` or `.claude/`.

## The one plan whose scope grows

Plans here normally have a fixed scope, written down before the work starts.

**`2026-09-29-author-journey-proof.md` is the exception, deliberately.** It is
driven by using the product: the agent works as a human author, records what is
wrong, and **reorders its own queue** as findings arrive. Its Findings backlog is
the live work list, and the tasks below it are the work as it was first
understood. **A task number going stale there is not drift — it is the plan
working.** The pass ends when nothing is left that using the product can find,
not when its list runs out.

It also settled a set of product decisions by hand that no spec covered, and its
ledger records the rulings and the evidence behind them.

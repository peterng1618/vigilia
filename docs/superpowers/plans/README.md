# Implementation plans

Superpowers is Vigilia's sole planning/execution workflow.

Active and queued executable plans live here. A completed or superseded plan
moves to `archive/` **once no active or queued plan depends on it** — the
condition, and the process around it, are `AGENTS.md`'s, not this file's.
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

## The one plan held out of the queue

**`2026-10-03-editor-left-column-and-header.md` is neither executable nor
archived.** Its left column and pane bar were superseded by the shell redesign,
and its insert popover landed under a different contract in a later plan. Its
Task 4 is "Two menus, and the View settings beside the canvas": the Insert half
of that has since landed — `shell-menu-bar.tsx` renders File, Edit and View only,
and `shell-layout.dom.test.tsx` asserts the Insert menu's absence — so what
remains is the View half, and whether the View menu leaves the menubar is a
decision the redesign owns. It is kept here, unexecuted, rather than moved to
`archive/` — see `vg-161` in `docs/product/backlog.jsonl` for the measurement.

# 0054 — A vanished register row is caught against HEAD, not by a hash chain

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `scripts/backlog-check.mjs`

## The problem

`scripts/backlog-check.mjs` validates every row and has no notion of the set. It reported
`500 items across both registers, all valid` **before** an append script of the controller's own cut the
register's last row, and the same number **after** it added a different row: the deletion and the addition
cancelled in the only number the gate prints, and every surviving row still parsed. A plain deletion is
worse — removing one row reports `499 items … all valid` and exits 0.

So the shape to catch is **a row that was there and is not**, and the gate's green says nothing about it.
`vg-502` filed it and named three candidate answers, and refused to pick one without a decision.

## Rung 1 — Yunari

Searched: the register's own history and every rule the checker already enforces —
`check`, `checkParked`, `checkPlacement`, `checkDisjoint`, `registerRows`, `readRegister`.
Found: the checker already refuses an **unreadable** register and an **empty** one, on the stated ground
that *a baseline that answers green to a missing register is the same false green the rules exist to catch,
one level up*. It also already shells out to git — `cat-file -e` and `merge-base --is-ancestor` per
artefact sha — so depending on history is not a new kind of dependency here. Nothing compares two
revisions of the register.

`docs/decisions/0046` and `0045` are the precedents for adding a rule to this file: a rule the checker
*knows* and does not *test* is a convention, and a convention loses to whoever is in a hurry.

## Rung 2 — dependencies

Searched: `src/web/package.json`, `package.json`, and the checker's own import list.
Found: **nothing, and the checker has no dependencies on purpose.** It imports `node:child_process`,
`node:fs`, `node:path` and `node:url` and nothing else. A hash-chain package would be the first runtime
dependency in a gate that runs on every commit, for a property rung 4 shows it does not deliver.

## Rung 3 — platform

Searched: `git rev-parse`, `git show <rev>:<path>`, `git log --format=%H -- <paths>`, `git cat-file`.
Found: `git show HEAD:docs/product/backlog.jsonl` returns the register exactly as committed, and the
checker already calls git through `execFileSync` with an argv array — so a path can never become a command.
What the platform leaves to us: which revision to compare against, and what to do when the comparison
cannot run at all.

## Rung 4 — ecosystem

Searched: an Exa query — *how to detect a deleted or missing row in an append-only JSONL ledger,
integrity check against previous revision or high-water mark* — and a direct fetch of the README of
[beads](https://github.com/steveyegge/beads), the project this checker's own header cites as the model for
its JSONL format.

Found: **the ecosystem's answer to this exact problem is that a per-row hash chain does not solve it, and
every project that ships one says so in its own README.**

- `tamperlog`: *"Most 'tamper-evident log' code stores `hash(previous_hash + entry)` on each row and calls
  it done. That catches an edited entry, but it misses the attack that actually matters: **truncation**. If
  whoever runs the log drops the last few entries, the remaining chain is still perfectly self-consistent
  … The fix is not a better hash. It is having committed to the log's state at a point in time, somewhere
  its operator cannot quietly change."*
- `arcaeon-ledger`: *"Truncation. Lop off the most recent rows and what remains verifies clean."*
- `dan8433-user/ledger`: *"The chain can't catch truncation alone."* Its remedy is a **witness** holding
  the head `(rows, chain)` on a cadence, and it is explicit that *"the MAX gap between pins is your real
  security parameter, not the average, because an attacker picks the gap."*
- `matrym-hashchain`: a hash chain detects an edited payload, a reorder, an inserted row and a deleted
  **middle** row, and detects a dropped **tail** only *"with an anchor — stash `head_hash(path)` elsewhere
  … the chain alone can't see truncation."*
- **beads itself has left the format.** Its README now frames `.beads/issues.jsonl` as *"an export for
  viewers and interchange, not the source of truth or a backup"*, with Dolt as the store, and says nothing
  about vanished-row detection — the project that inspired this register's JSONL does not solve this
  problem in JSONL at all.

**How their shape compares to ours.** Every one of them is defending against an **adversary who can edit
the file**, so they pay for a per-row hash and an off-ledger anchor. Ours was an **accident** — a
`lastIndexOf` off-by-one in the controller's own append script — and our anchor already exists and is
already a dependency: **git**. The second-hand lesson that does transfer is `dan8433-user/ledger`'s
three-valued verdict: a run that skipped rows *never mints a green*, exiting `3` with the scope in-band
rather than `0`. That is the honesty rule the summary line below adopts.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Per-row hash chain | Catches an edit, reorder and mid-file deletion | A hash field on 543 rows; a chain break on every legitimate line-surgery edit | **Breaks the register's own editing practice** (rows are edited by line, never re-serialised) and still misses truncation | rejected |
| Id-gap rule | Cheap, no git | Catches a mid-file deletion only | **Does not catch the incident it was filed for** — the deleted id was replaced by the next id, so the sequence stayed unbroken | rejected |
| Count or high-water mark inside the file | Cheap | Puts state about the file inside the file it describes | The incident preserved the count, so only a high-water mark would have caught it; and the mark is edited by the same accident | rejected |
| Compare the id set against HEAD | Catches the incident exactly; no new field, no new dependency, no format change | One `git show` per register per run | Sees only the window before the loss is committed | **chosen** |

## Rung 6 — probe

Measured on the live register at `61582d4f`, by parsing both files and counting by state:

| State | Rows | carry `check` | carry `artefacts` |
|---|---|---|---|
| `open` | 154 | 1 (`vg-348`) | 0 |
| `verified` | 366 | 366 | 366 |
| `withdrawn` | 23 | **7** | **3** |
| total | 543 | | |

The 7 and 3 are the number that decides `0055` rather than this note, and they are recorded here because
they were taken in the same probe.

## Decision

**The CLI reads both registers at `HEAD` and refuses when an id that existed there exists in neither
register now.** The union rather than the live file alone, because **every legitimate close moves an id
from live to archive** — so a rule reading the live file alone would fire on the register's normal
operation. The invariant is *the register never loses a row*, and the two files are one register.

**The reason, specifically:** an id-gap rule and a per-row hash chain were both available and both are
worse here. The gap rule does not catch the incident it was filed for. The hash chain buys resistance to
an adversary this register does not have, at the price of breaking the by-line editing the register
actually uses — and rung 4 shows it would not have caught the tail truncation anyway.

**The limit, stated rather than implied:** the comparison is against `HEAD`, so it catches a loss in the
window between the edit and the commit — which is the window the incident happened in, and the window the
workflow runs the check in (`backlog:check` runs before the commit, at every task boundary). **Once a loss
is committed, `HEAD` becomes the loss and the comparison cannot see it.** Closing that would mean reading
every revision that ever touched the registers, which is a `git show` per commit in a gate that runs on
every commit; it is not worth it, and a later reader who wants it now knows what it costs.

**And a run that could not compare does not print a green.** If git cannot read `HEAD`'s copies, the
summary line says `continuity unchecked` with the reason, because a line that says `all valid` over a check
that never ran is the exact false green `registerRows` already refuses one level up.

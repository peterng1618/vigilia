# Decision notes

One file per decision where **the way something is built** was not obvious and
the reasoning would otherwise be lost. The rule these record is
[`AGENTS.md`](../../AGENTS.md)'s *Reuse before build* gate.

## When one is required

A task that touches a **mechanism boundary** — the watchlist in
`scripts/reuse-gate.mjs` — must land a note here before its first write to
those paths. The gate refuses the write; the note is how you unblock it.

## When one is not

Naming a library, or recording that a native API exists. Neither discharges
the gate. A native capability that still needs sampling, ordering, invalidation,
disposal and ownership decisions is exactly the case the gate is for.

## Template

```markdown
# NNNN — <the decision, in one line>

- **Date:** YYYY-MM-DD
- **Status:** accepted | superseded by NNNN
- **Paths:** `src/web/packages/.../owner.ts`   # the watchlisted paths this claims

## The problem

What had to be built, and what made it non-obvious. The *shape* of the problem,
not the feature request.

## Rung 1 — Vigilia
Searched: <owners, symbols, partial implementations>
Found: <what exists, or "nothing">

## Rung 2 — dependencies
Searched: <direct and transitive packages>
Found: <what exists, or "nothing">

## Rung 3 — platform
Searched: <the native API>
Found: <what it gives, and what it leaves to you>

## Rung 4 — ecosystem
Searched: <the actual queries, sites, libraries>
Found: <what others do, and how their shape compares to ours>

## Rung 5 — comparison
| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| <native> | | | | |
| <library> | | | | |

## Rung 6 — probe
What was measured, how, and what it showed. Numbers, not adjectives.

## Decision
What was chosen, and **the specific reason** — not "it was simplest".
```

## The part people skip

Rung 4 is the one that is skipped, because rung 3 usually works. **The searches
are the evidence.** A note listing three libraries without saying what was
searched, or that nobody solved this shape, is worth nothing — it cannot
distinguish work from theatre. Write down the queries and the dead ends.

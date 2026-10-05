# 0025 — A bare watchlist entry matches at any depth, because gitignore already says so

- **Date:** 2026-10-05
- **Status:** accepted
- **Paths:** `scripts/reuse-gate.mjs`

## The problem

`WATCHLIST` holds fourteen entries, thirteen of them anchored
(`src/web/packages/scene-fabric/src/glass.ts`) and one bare (`scripts/`).
`isWatched` resolved each candidate to a repo-relative path and asked
`rel.startsWith(w)`, which reads the bare entry as *repo-root* `scripts/` and
nothing else.

The repo has two `scripts/` directories: the one the entry names, and
`src/web/scripts/`, which holds `generate-font-trios.mjs` — the font catalogue
generator, a build step whose output is a shipped data package. So the entry
meant "scripts are a mechanism boundary" and enforced "the repo-root scripts
directory is a mechanism boundary", and the second one was ungated. Piping the
generator's path in answered 0 (allowed); `scripts/anything.mjs` answered 2
(refused).

This is the shape of bug the gate exists to prevent, one level up: a gate that
cannot see a boundary is worse than no gate, and the entry's own name is the
promise. It was found *by taking the gate at its word* — an agent was told
`scripts/` was on the watchlist, wrote the note anyway, and found the gate
allowing what it read as saying.

## Rung 1 — Vigilia

Searched: `scripts/reuse-gate.mjs` in full (`isWatched`, `WATCHLIST`,
`claimedPaths`, `covers`), the `--self-test` block, `AGENTS.md`'s reuse-gate
section, `docs/decisions/README.md`.
Found: the resolution is one line in `isWatched`, and the rule being asked for
is **already written down in this repo** — `AGENTS.md:264`, "Bare gitignore
patterns match at any depth." The gate contradicted a rule the repo had
already decided. That is the strongest available answer to "is this the way we
do things here": it is.

## Rung 2 — dependencies

Searched: the four gate scripts' imports (`backlog-check.mjs`,
`check-status.mjs`, `ownership-sweep.mjs`, `ownership-overlap.mjs`) and
`src/web/package.json`.
Found: nothing. All four gates are `node:fs` + `node:path` only, no glob
library, and adding one to express "match at any depth" would be a dependency
solving a two-line question the repo has already answered with its own
`.gitignore` semantics. `node:path`'s `sep` gives the segment split the
matching needs.

## Rung 3 — platform

Searched: git's `.gitignore` pattern semantics.
Found: git matches a pattern with no slash in it against **any** path segment,
at any depth. **Probed it rather than trusting the docs**: a scratch repo with
`a/scripts/x.js` and `b/scripts/y.js` and a one-line `.gitignore` containing
`scripts/` staged **only** `.gitignore` — both directories ignored. So git
gives exactly the semantics wanted here, for free, and it is the semantics
this repo already follows for its real ignore file.

## Rung 4 — ecosystem

Searched: how do other path-based exclusion systems resolve a bare directory
name?
Found: the space splits, and both halves fail here for the same reason.

- **Glob libraries** (`picomatch`, `minimatch`, `micromatch`) — a bare
  `scripts/` in a *glob* means *the root's* `scripts/`. That is correct glob
  semantics and the wrong semantics for a watchlist: a watchlist entry is a
  claim about *what kind of thing* is a mechanism boundary, not a location.
- **Gitignore-shaped systems** (`ignore`, `.dockerignore`, `.eslintignore`) —
  bare means any depth. Right semantics, and the one this repo is already
  running.

So the ecosystem answer is not "adopt a library"; it is "pick the convention
you already have, and do not pay a dependency to get it".

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Add `src/web/scripts/` as a 15th anchored entry | Fixes today's instance exactly | 1 line | **The trap stays.** A third `scripts/` under `packages/` is ungated, and nothing makes the next agent look twice. This is the fix that produces the next row. | Rejected |
| Widen a bare entry to match at any depth | Matches `AGENTS.md:264` and git | ~6 lines in `isWatched` | Over-gates a future `scripts/` under `packages/`. The cost is a note that already exists. | **Chosen** |
| Adopt `picomatch` for watchlist matching | Full glob semantics | New dependency | Wrong semantics anyway (bare = root), plus a shipped dep to express a rule the repo wrote down | Rejected |
| Make *every* entry match at any depth | Uniform | 1 line | **Catastrophic.** `glass.ts` would match any file of that name anywhere; `protocol.ts` likewise. The anchored entries carry their path *because* the path is the claim. | Rejected |

## Rung 6 — probe

Before: `src/web/scripts/generate-font-trios.mjs` → **0** (allowed);
`scripts/anything.mjs` → **2** (refused). Reproduced by piping the hook's own
stdin, not by reading the source.

After: both **2**, and every anchored entry still resolves to what it named —
`src/web/packages/scene-fabric/src/glass.ts` stays refused while
`src/web/packages/scene-fabric/src/unrelated.ts` stays allowed, which is the
regression this decision could most plausibly have caused and the one the
`--self-test` cases now hold.

## Decision

**A watchlist entry with no `/` before its trailing one is a bare name and
matches as a path segment at any depth. An entry containing a `/` is anchored
and is compared against the repo-relative path exactly as before.**

The distinction is not arbitrary and is not a special case for `scripts/`: it
is the same distinction git draws, so the entry's *name* carries its own
matching rule and reading the watchlist tells you how it will behave. `scripts/`
means "a directory called scripts, wherever it is"; `src/web/.../glass.ts`
means "this file, at this path". Widening the bare form is the conservative
direction — the failure mode of over-gating is a note that already exists,
while the failure mode of the current behaviour is a boundary nothing sees.

The `--self-test` gained two cases, because a gate that cannot refuse is worse
than no gate and this one had stopped being able to refuse a path its watchlist
names.

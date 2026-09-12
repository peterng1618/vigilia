# ADR-0001 — Evaluate both editor foundations in parallel at Gate 0

- **Status:** Accepted
- **Date:** 2026-09-12
- **Supersedes:** the sequential ordering in §39 of the design document

## Context

§37–§39 direct us to prototype [vue-fabric-editor](https://github.com/ikuaitu/vue-fabric-editor)
first and evaluate [yft-design](https://github.com/dromara/yft-design) "only if the
first candidate fails." Verification on 2026-09-12 turned up evidence that
undercuts that ordering:

| | vue-fabric-editor | yft-design |
| --- | --- | --- |
| fabric | **`5.3.0` hard-pinned** | `^6.4.1` |
| vite / vue | 4 / 3.2 | 5 / 3.4 |
| Release tags | **none usable** | — |
| Stars | 7965 | 1639 |
| Last push | 2026-07-21 | 2026-09-04 |

Current Fabric is `7.4.0`; v6 was a TypeScript rewrite with breaking changes. So
the preferred candidate is two majors behind on a dependency that sits at the
very centre of the architecture, and has no tag to pin. Its open-source build is
also frontend-only, with a separate paid edition — so its most complete feature
set is not what we would actually get.

Against that, vue-fabric-editor has ~5× the community and documents more of the
editor surface we need (history, rulers/guides, grouping, alignment, typography,
gradients).

Neither consideration dominates, and §33 tells us to treat library feature lists
as hypotheses until demonstrated.

## Decision

Evaluate **both** candidates in parallel during Gate 0, scored against one shared
acceptance harness rather than sequentially.

Ranking criteria stay as §45 defines them, in order: chart embedding, typography
fidelity, lightweight playback, extensibility — *then* drawing-tool breadth.

Because neither exposes a usable release tag for our purposes, **pin by commit
SHA** and record it in `docs/gates/gate-0.md`.

A third outcome stays explicitly open: if both fail the chart/typography bar,
build on current Fabric plus Moveable/Selecto primitives and own the editor
layer. §39 already calls these "fallback primitives, not complete editors" — the
point is that discovering this at Gate 0 is a success, not a failure.

## Consequences

- Gate 0 costs more up-front effort; the editor decision is the most expensive
  one to reverse later, so this is the right place to spend it.
- The acceptance harness must be foundation-agnostic — it tests *our* renderer
  contract, not a candidate's API. This is desirable regardless of the winner.
- Fabric 5 vs 6 is a scoring input, not a veto: a materially better editor on
  Fabric 5 may still win, with the upgrade cost recorded as known debt.

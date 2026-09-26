# Vigilia status

Updated: 2026-09-27
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional.

## Active work

- **Completed plan:** `docs/superpowers/plans/archive/2026-09-25-snapping-fidelity.md` —
  all eleven tasks landed; gate run, documentation close-out and final whole-plan
  review all closed 2026-09-27. The plan is archived.
- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md)
  — activated 2026-09-27, subagent-driven. Only Task 1 (the glass feasibility probe)
  is open; its findings must be reviewed before Tasks 2–12.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md)
  — written behind reference-theme fidelity; not activated. Replaces the one-entry
  hand-written trio with 380 generated pairings over 238 faces, and the two-option
  dropdown with one searchable picker. See its spec for the measured constraints.
- **Completed plan:** `2026-09-26-clock-and-theme-locale.md` — all tasks,
  whole-branch review, and runtime-text-layout repair closed.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path. It must account for `metadata.locale`: v1 documents carry
  no metadata, and absent means `en` there.
- **Queued spec, no plan:** [author-first seven-day release](docs/superpowers/specs/2026-09-26-author-first-release-design.md) — written-spec review pending; blank-to-running theme, ≥80% unassisted completion; not activated by the reference-theme priority change.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Reviewed the font system: the curated-font slice never finished. The
  catalogue holds one hand-written trio whose `minimal` id claims Fonttrio
  provenance its Inter/JetBrains Mono faces lack, in a bare `<select>`.
- Measured upstream: 380 pairings, 174 families, 238 faces, all resolvable to
  version-pinned Fontsource WOFF2 over a CORS-open CDN.
- Wrote the design and its plan, queued behind reference-theme fidelity. All
  380 ship; facets derived from data; favourites in the host; a trio declares
  its role weights; a bound preset unbinds explicitly.

## Next

1. Activate reference-theme fidelity.
2. Then the queued font catalogue plan, then the queued specs.

## Blockers / unverified

- `display-fabric.spec.ts` "is byte-stable at a fixed clock on one platform" is
  load-induced: it failed once under full-suite parallel load on the byte
  comparison, then passed on re-run and in isolation at HEAD and at this plan's
  base sha `a0a44ff`. The test's own comment records the mechanism — `runFor`
  advances simulated time while the first paint waits on real-time asset decode.
  Not reproduced at base, so it is not recorded as proven pre-existing.
- Whether `PreCompact`/`SessionStart` fire for a *subagent's* compaction is
  undocumented. The `agent_id` guard is defense-in-depth, not a demonstrated fix.
- No mechanism catches a dispatch the controller never recorded; a `SubagentStop`
  ledger audit for unknown agent ids is the only candidate and is not implemented.
- Unverified: browser round-trip of text align/wrap/overflow, in-place edit +
  undo, run preset/override.
- The walkthrough ran against `vite preview` bundles at desktop width; the phone
  surfaces were exercised by the browser suite, not by eye.

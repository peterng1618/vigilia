# Vigilia status

Updated: 2026-09-27
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional.

## Active work

- **Completed, archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`.
- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md)
  — subagent-driven. Tasks 1, 2, 3, 4 and 8 complete; Task 5 (glass lifecycle) in
  flight; 6, 7, 9, 10, 11, 12 remain. Ledger:
  `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md)
  — **approved 2026-09-27**; plan deferred until this plan closes, since it must be
  written against the delivered surface. Rebuilds the reference from blank through the
  UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md)
  — not activated. Replaces the one-entry hand-written trio with 380 generated
  pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Completed plan:** [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md)
  — `docs/bugs/` is gone; backlog and filing rule in `AGENTS.md` now live in
  [issues](https://github.com/peterng1618/vigilia/issues). Open: [#2](https://github.com/peterng1618/vigilia/issues/2)
  delete inside a group, [#3](https://github.com/peterng1618/vigilia/issues/3) packaged assets.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path — must account for `metadata.locale`: v1 documents carry
  no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- The bug registry is replaced by GitHub Issues. `AGENTS.md` now judges a
  defect's size on sight rather than counting three attempts: file when the
  cause is unknown, the owner ambiguous or a design decision is needed; fix small
  ones inline. The third failed attempt files the issue in that commit.
- The author journey is consolidated to one spec, queued between this plan and the
  font catalogue. The seven-day release spec is deleted and its promise absorbed.
  Five shipped author/consumer spec pairs still read `in progress`:
  shipped-and-unverified, **flips held** until that plan's Phase 1 observes them.
- Glass (in flight, this plan): real clipped backdrop blur in both mounts,
  48-unit cap, ~1 ms/frame. A real defect was found and fixed — the editor wired
  **no backdrop at all**, so every editor panel sampled nothing.

## Next

1. Continue reference-theme fidelity, Task 5 onward.
2. Then the font catalogue plan, then the queued specs.

## Blockers / unverified

- `display-fabric.spec.ts` "is byte-stable at a fixed clock on one platform" is
  load-induced: failed under full-suite parallel load, passed on re-run.
- Undocumented whether `PreCompact`/`SessionStart` fire for a *subagent's*
  compaction; the `agent_id` guard is defense-in-depth, not a demonstrated fix. No
  mechanism catches a dispatch the controller never recorded.
- Unverified: browser round-trip of text align/wrap/overflow, in-place edit +
  undo, run preset/override; phone surfaces exercised by suite, not by eye. Owned
  by the queued author journey proof spec.
- Carried into this plan's work: the starter binds the unowned `memory.used` so
  its donut renormalises to a false 100% (Task 7); the baseline GPU provider
  returns the **maximum** across controllers, so a caption could name one GPU
  over another's readings (Task 9). Pre-existing and outstanding:
  `format:check` fails on `snap-manager/scaling/scaling.dom.test.ts` (`01aa7dc`).

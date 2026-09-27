# Vigilia status

Updated: 2026-09-27
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional.

## Active work

- **Completed plans, both archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`.
- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md)
  — subagent-driven. Tasks 1, 2, 3, 4 and 8 complete; Task 5 (glass lifecycle) in
  flight; 6, 7, 9, 10, 11, 12 remain. Ledger:
  `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md)
  — **approved 2026-09-27**; plan deferred until this plan closes, since it must be
  written against the delivered surface. Proves the shipped surface by rebuilding the
  reference from blank through the UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md)
  — not activated. Replaces the one-entry hand-written trio with 380 generated
  pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued plan:** [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md)
  — replaces `docs/bugs/` with issues filed by agent and human. The spec's "not
  while a plan is active" rule is **overridden**: the running plan's citation is
  repointed and a note goes to its Task 5 subagent; the two e2e comments it is
  writing are deferred, not edited under it.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path — must account for `metadata.locale`, since v1 documents
  carry no metadata and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- **Task 4 — glass renders.** Real clipped backdrop blur in both mounts, shared
  lifecycle in `scene-fabric`, 48-unit cap, ~1 ms/frame. A real defect was found
  and fixed: the editor wired **no backdrop at all**, so every editor panel was
  sampling nothing.
- Video-frame invalidation measured broken and fixed; zero idle repaints from a
  glass panel; scratch surfaces released on every path.
- The author journey is consolidated to one spec, queued between this plan and the
  font catalogue. The seven-day release spec is deleted, its promise and the
  by-hand-rebuild requirement absorbed, and its finding protocol repointed at Issues.
- Five shipped author/consumer spec pairs still read `in progress`, plus
  `settings-scope`: shipped-and-unverified, not outstanding. **Status flips are
  held** until the new plan's Phase 1 observes them.

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
- Carried into this plan's work, not merely pre-existing: the starter binds the
  unowned `memory.used` so its donut renormalises to a false 100% (Task 7), and
  the baseline GPU provider returns the **maximum** across controllers so a
  caption could name one GPU over another's readings (Task 9). Also outstanding:
  `format:check` fails on `snap-manager/scaling/scaling.dom.test.ts` (`01aa7dc`).

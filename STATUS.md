# Vigilia status

Updated: 2026-09-27
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Reference-theme fidelity: a progressive default starter scene, mandatory glass,
RAM/VRAM gauges, existing charts accepted, glow optional.

## Active work

- **Completed, archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, [GitHub Issues as the backlog](docs/superpowers/plans/2026-09-27-github-issues-backlog.md) — `docs/bugs/` is gone; open [#2](https://github.com/peterng1618/vigilia/issues/2) delete inside a group, [#3](https://github.com/peterng1618/vigilia/issues/3) packaged assets.
- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — subagent-driven. Tasks 1–6 and 8 complete; 7, 9, 10, 11, 12 remain. Ledger: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`.
- **Queued spec, no plan:** [author journey proof](docs/superpowers/specs/2026-09-27-author-journey-proof-design.md) — **approved 2026-09-27**; plan deferred until this plan closes, since it must be written against the delivered surface. Rebuilds the reference from blank through the UI alone — no generator, starter, fixture or JSON.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md) — not activated. Replaces the one-entry hand-written trio with 380 generated pairings over 238 faces, and the two-option dropdown with one searchable picker.
- **Queued spec, no plan:** removing the v1 document format and the fixture node-tree render path — must account for `metadata.locale`: v1 documents carry no metadata, and absent means `en` there.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- **Glass is authorable and the starter's first reference card ships (Task 6).** The inspector gained a frosted-glass enable and blur radius on the existing `vigiliaGlass` property, gated on a rectangle; the bound is refused by `renderer-core`'s own reader rather than a copied number.
- Two defects made the control inert, both fixed: the glass handle re-resolved only on add/remove, so **enabling glass through the UI attached nothing**; and it cached the radius at attach time, so **the blur field moved the control and not the picture**. `EditorShell.refreshGlass` is the seam.
- The starter now carries a frosted CPU card — palette-backed rectangle, two-run live reading, `cpu.load` sparkline through the line family — saved, reopened and played from the host. Differences are in `task-6-report.md`.
- `new-fabric-theme.ts` was over `AGENTS.md`'s 800-line stop; its globals moved to `new-fabric-theme-globals.ts`, leaving 695 lines.

## Next

1. Continue reference-theme fidelity, Task 6 fix round then 7, 9, 10, 11, 12.
2. Then the font catalogue plan, then the queued specs.

## Blockers / unverified

- `display-fabric.spec.ts` byte-stability is load-induced: failed under parallel load, passed on re-run.
- Undocumented whether `PreCompact`/`SessionStart` fire for a *subagent's* compaction; the `agent_id` guard is defense-in-depth, not a fix. No mechanism catches a dispatch the controller never recorded.
- Unverified: browser round-trip of text align/wrap/overflow, in-place edit + undo, run preset/override; phone surfaces exercised by suite, not by eye. Owned by the queued author journey proof spec.
- Carried into this plan: the starter binds unowned `memory.used`, so its donut renormalises to a false 100% (Task 7); the baseline GPU provider returns the **maximum** across controllers, so a caption could name one GPU over another's readings (Task 9). `format:check` fails on `snap-manager/scaling/scaling.dom.test.ts` (`01aa7dc`).

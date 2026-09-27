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
  — activated 2026-09-27, subagent-driven. Task 1 (the glass probe) is complete and
  unblocks Tasks 2–12; Task 2 (the authored `vigiliaGlass` contract) is in flight.
  Ledger: `.superpowers/sdd/2026-09-26-reference-theme-fidelity/progress.md`.
- **Queued plan:** [font catalogue and trio picker](docs/superpowers/plans/2026-09-27-font-trio-catalog.md)
  — written behind reference-theme fidelity; not activated. Replaces the one-entry
  hand-written trio with 380 generated pairings over 238 faces, and the two-option
  dropdown with one searchable picker. See its spec for the measured constraints.
- **Completed plan:** `2026-09-26-clock-and-theme-locale.md` — all tasks,
  whole-branch review, and runtime-text-layout repair closed.
- **Queued spec, no plan:** removing the v1 document format and the fixture
  node-tree render path. It must account for `metadata.locale`: v1 documents carry
  no metadata, and absent means `en` there.
- **Queued spec, no plan:** [author-first seven-day release](docs/superpowers/specs/2026-09-26-author-first-release-design.md) — written-spec review pending; blank-to-running theme, ≥80% unassisted completion; not activated by the reference-theme priority change. **Hard requirement added 2026-09-27:** rebuild the whole reference dashboard from a blank scene through the UI alone, no generator or JSON, recording gaps and friction as findings. **Its implementation plan must be refreshed when activated** — the seven-day sequence predates reference-theme fidelity and must be re-derived against the delivered surface.
- Compaction recovery: [`adr/0010-dispatch-record-owns-recovery-state.md`](docs/adr/0010-dispatch-record-owns-recovery-state.md).

## Last completed change

- Task 1's glass probe is complete and recorded in the plan. Real clipped
  backdrop blur works via Fabric's per-object `before:render` plus native
  `ctx.filter` — no new dependency, no DOM overlay.
- Measured: **48 artboard-unit radius cap**, **+0.61 ms** StaticCanvas /
  **+0.69 ms** interactive at 1672×941, **zero idle repaints**, live canvas and
  `toCanvasElement` in agreement so thumbnails inherit it.
- Sharp foreground is **bit-for-bit unchanged** (peak 537 with glass off,
  detached and on); `sampledInsideCache: 0` throughout, so no self-sampling.
- Two obligations recorded for Tasks 4–5: scratch surfaces **must** be released
  explicitly (56 survived 10 mount cycles otherwise), and cross-origin media
  taints the canvas, so failure must be caught and reported.
- Unproven and owned by Task 4 as regression cases: overlapping panels,
  grouped-vs-flattened, and video-frame invalidation.

## Next

1. Continue reference-theme fidelity, Task 2 onward.
2. Then the queued font catalogue plan, then the queued specs.

## Blockers / unverified

- `display-fabric.spec.ts` "is byte-stable at a fixed clock on one platform" is
  load-induced: it failed once under full-suite parallel load, then passed on
  re-run and in isolation. Not reproduced at base, so not proven pre-existing.
- Whether `PreCompact`/`SessionStart` fire for a *subagent's* compaction is
  undocumented. The `agent_id` guard is defense-in-depth, not a demonstrated fix.
- No mechanism catches a dispatch the controller never recorded; a `SubagentStop`
  ledger audit for unknown agent ids is the only candidate and is not implemented.
- Unverified: browser round-trip of text align/wrap/overflow, in-place edit +
  undo, run preset/override; phone surfaces exercised by suite, not by eye.
- Pre-existing, not from this plan: `format:check` fails on
  `snap-manager/scaling/scaling.dom.test.ts` (`01aa7dc`); the starter binds the
  unowned `memory.used`, so its donut renormalises to a false 100%; and the
  baseline GPU provider returns the **maximum** across controllers, so a caption
  naming one GPU could sit over another's readings.

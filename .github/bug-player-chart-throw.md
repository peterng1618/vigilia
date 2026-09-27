**What happens**

The starter theme's charts throw inside ECharts when the theme is loaded in the
player (`@vigilia/player`). No chart renders a live value, so the default demo
theme shows no live data on a second screen. The starter's own clock and date are
bound text rather than charts and are unaffected.

Reproduced without the reference CPU card added by the reference-theme plan, so
it predates that work.

**Why**

Cause **not established**. What is established:

- The throw originates inside ECharts, reached from
  `hydrateCharts` in `src/web/packages/player/src/main.ts:361-374`, which calls
  `buildChartPlan` and then `VigiliaChart.setOption`
  (`src/web/packages/scene-fabric/src/chart-object.ts`).
- The exact error message and stack were not preserved: the failure was observed
  through a Playwright run whose console text was not captured, and the throw does
  not reproduce on demand.
- Ruled out so far: the glass lifecycle (the throw is present with glass
  detached), and Task 6's CPU card (isolated without it).

Until the message is captured, the responsible call site inside the chart
pipeline is not identified. A guess here would send the next person to the wrong
subsystem.

**Why it is not <adjacent subsystem>**

- Not `scene-fabric/src/glass.ts` or `chart-refresh.ts`. The glass lifecycle was
  detached and the throw persisted; the frame loop's own robustness was separately
  fixed in `1ca70ba` and the throw survives that fix.
- Not the envelope or persistence. The theme validates and revives; the failure
  happens when ECharts is asked to render the revived chart.
- Not telemetry. The symptom is a rendering throw, not a missing or
  non-`ok` sample.

**Evidence**

- `src/web/tests/e2e/host-player.spec.ts` carries the live-reading claim as a
  `test.fixme`, with the adjacent green assertion that a display shows the
  unavailable placeholder (`—%`) instead of a reading.
- The report for the task that isolated this:
  `.superpowers/sdd/2026-09-26-reference-theme-fidelity/task-6-report.md`, §7.1.
- `1ca70ba` fixed a related and separate defect: the refresh loop scheduled the
  next frame *after* `refresh()`, so any throwing chart froze every repaint in the
  scene. That is fixed; the throw behind it is not.

**How to reproduce**

1. Build and open the starter theme in the player (a theme containing a gauge,
   line, bar or pie chart on the default document).
2. Observe that no chart renders, and that `hydrateCharts` throws.

**Where it bites**

- The default demo theme on the display player: the first thing a new user sees
  running is a theme with no live data.
- Any theme that binds a chart.

**Notes**

Two adjacent things were checked and are not this bug, recorded so the
investigation is not repeated:

- A refresh-loop scheduling defect froze the whole scene on any chart throw. Fixed
  in `1ca70ba`; the loop now survives a throwing refresh and reports once.
- Cross-origin media taints the canvas, which would fail `getImageData` in the
  glass sampler. That is a separate constraint, tracked with the packaged-assets
  route issue.

**Suggested next step**

Capture the error text: run the player against the starter theme with the
console/error output recorded, and take the first stack frame inside
`setOption`. That single datum names the owner; the throw's own text and the
call site are both currently unknown.

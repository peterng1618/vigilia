# 0003 — Scene planning and sample sources

- **Status:** plan layer implemented; DOM mount implementation superseded by [0013](0013-fabric-scene-migration.md)
- **Design sections:** §31, §51, §57, §83, §87, §89, §91, §93, §97, §116, §122, §124, §137, §141

## Intent

Turn a theme plus live samples into a deterministic render plan. Rendering is now
applied by `scene-fabric`; the old DOM `mount.ts` exists only during migration.

## Required split

| Layer | Responsibility |
|---|---|
| `scene/plan.ts` | pure geometry/style/text/chart/data decisions |
| `scene-fabric` | apply those decisions to Fabric objects |

`buildScenePlan` receives the clock and never reads global time.

## Data semantics

- Non-`ok` sample → gap/placeholder, never zero.
- Missing mapping → explicit `PlanIssue`, not a fake sample.
- `ok` with no value → provider/data error.
- Binding scale/offset applies consistently to text and charts.
- Fake source is explicit dev/test data and never an automatic fallback.

## Formatting

- Explicit precision is exact, including trailing zeroes.
- Default numeric formatting is compact and avoids unnecessary `.0`.
- Unit spacing follows typographic convention.
- Unknown long unit names fall back to the known short unit rather than being
  invented.

## Sample source

`SampleSource` is pull-based: latest value plus bounded history. History is
bounded by age and count; reconnect may reset it. Providers never run on the
phone/player.

## Renderer contract

- One artboard transform scales the complete scene.
- Scene updates should reuse objects where structure permits.
- Only supported style/property vocabulary reaches the renderer.
- Renderer gaps are reported explicitly rather than approximated silently.

## Out of scope

- transport/pairing/theme delivery;
- generic editor interaction;
- diagnostics UI beyond issue reporting;
- behaviour superseded by spec 0013's Fabric adapter.

## Acceptance

- unit tests cover geometry defaults, group-local coordinates, style resolution,
  text formatting, chart data and unmapped-key reporting;
- fake-source tests cover all chart families and explicit missing/outage cases;
- browser tests prove the Fabric path draws expected scene content and updates
  charts without recreating the whole product state.

Screenshots are visual evidence, not cross-platform pixel baselines.
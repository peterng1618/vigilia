# Dependency findings

Provenance/notes behind `THIRD-PARTY-NOTICES.md`. Keep only facts that affect
licensing or architecture; re-audit the full installed graph before release.

## Current declared dependencies

| Package | Version/pin | Licence | Role |
|---|---|---|---|
| `echarts` | 6.1.0 | Apache-2.0 | runtime charts |
| `fabric` | 7.4.0 | MIT | runtime scene graph |
| `@anu3ev/fabric-image-editor` | fork `918a454` / 0.10.32 | MIT | runtime editor foundation |
| `vite` | 8.3.0 | MIT | build/dev |
| `typescript` | 7.0.2 | Apache-2.0 | build |
| `vitest` | 5.0.0 | MIT | tests |
| `@playwright/test` | 1.63.0 | Apache-2.0 | browser tests |
| `jsdom` | 26.1.0 | MIT | DOM tests |
| `canvas` | 3.2.3 | MIT | raster DOM tests; native dev dependency |
| `@types/node` | 22.10.2 | MIT | types |

Versions above match the current workspace/fork manifests. The legal notice file
must be updated whenever those manifests change.

## Fabric

Verified from Fabric 7.4.0 package metadata/LICENSE: MIT, no runtime dependencies.
Use `fabric/es`; the default entry is pre-bundled and measured substantially
larger. Player uses `StaticCanvas` to exclude the interaction layer.

## Adopted image-editor fork

Current editor manifest pins
`peterng1618/fabricjs-image-editor#918a454038551d188d765960f64c0c3e12bf40c1`.
The fork declares MIT and depends on Fabric 7.4.0 plus `jspdf`, `jsondiffpatch`
and `nanoid`; its production build externalizes Fabric, jsPDF and jsondiffpatch.
Those dependencies therefore need to be considered in the final distributed
editor licence inventory, including their transitive graph.

Primary metadata checked during this cleanup confirms MIT for jsPDF,
jsondiffpatch and nanoid. This is **not** a substitute for a generated
transitive notice audit before release.

## ECharts

ECharts 6.1.0 is Apache-2.0. Two engine gaps affect product design:

- gauge ring colour accepts segmented stops rather than a native angular
  gradient;
- discrete line-threshold bands have no direct authored equivalent.

Those are product/engine decisions, not licensing issues; see `decisions.md`.

## Planned external hardware software

LibreHardwareMonitor/PawnIO are **not current Vigilia dependencies and are not
redistributed today**. The intended architecture runs a user-provided/prebuilt
LHM process and reads its local interface. Before bundling, downloading or
installing any of it, re-open the licensing analysis and distribution decision.

Earlier research found LHM MPL-2.0 and PawnIO/PawnIO modules under GPL/LGPL
licenses. Treat that as planning evidence, not a current shipped notice.

## Release rule

Before any public package:

1. enumerate the complete installed runtime/transitive graph from the lockfile;
2. verify licences from package/vendor primary metadata;
3. ensure every redistributed component's required notice/licence text ships;
4. re-check any external executable/driver distribution plan separately.

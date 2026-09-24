# Dependency findings

Provenance behind `THIRD-PARTY-NOTICES.md`. Re-audit the installed graph before release.

## Declared dependencies

| Package | Version/pin | Licence | Role |
|---|---|---|---|
| `echarts` | 6.1.0 | Apache-2.0 | charts |
| `fabric` | 7.4.0 | MIT | scene graph |
| `fflate` | 0.8.3 | MIT | theme ZIP codec |
| `@biomejs/biome` | 2.5.14 | MIT OR Apache-2.0 | format/lint |
| `vite` | 8.3.0 | MIT | build/dev |
| `typescript` | 7.0.2 | Apache-2.0 | build |
| `vitest` | 5.0.0 | MIT | tests |
| `@playwright/test` | 1.63.0 | Apache-2.0 | browser tests |
| `jsdom` | 26.1.0 | MIT | DOM tests |
| `canvas` | 3.2.3 | MIT | native raster test dependency |
| `@types/node` | 22.10.2 | MIT | types |

Fabric 7.4.0 metadata/LICENSE confirms MIT and no runtime dependencies. Use
`fabric/es`; player and editor both use it directly, with no adopted
image-editor package or its transitive graph.

## Vendored source

| Source | Pin | Licence | Role |
|---|---|---|---|
| `@anu3ev/fabric-image-editor` | 0.10.32, commit `9efdd78a34` | MIT | adapted movement-snapping and indicator source |

Copied, not installed: no entry appears in `package.json` and nothing enters the
transitive graph. Licence verified from the `LICENSE` blob at that commit,
`MIT, Copyright (c) 2025 Alexander Anufriev`. Full text in
`THIRD-PARTY-NOTICES.md`. The note above about the removed image-editor package
refers to the runtime dependency, which stays removed.

LibreHardwareMonitor/PawnIO are not current dependencies or redistributed.
Earlier planning research found LHM MPL-2.0 and PawnIO modules under GPL/LGPL;
re-open the analysis before bundling, downloading or installing them.

`systeminformation` 5.33.13 (MIT, no dependencies of its own) is the host's
hardware-metrics source: verified from the package's own `LICENSE` and `npm
view` metadata on 2026-09-24. It reads platform counters; it is not a vendored
or linked third-party executable.

## Release rule

Before publishing: enumerate the runtime/transitive graph from the lockfile,
verify licences from primary metadata, ship required notices, and separately
review any external executable/driver distribution.

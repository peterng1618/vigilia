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

LibreHardwareMonitor/PawnIO are not current dependencies or redistributed.
Earlier planning research found LHM MPL-2.0 and PawnIO modules under GPL/LGPL;
re-open the analysis before bundling, downloading or installing them.

## Release rule

Before publishing: enumerate the runtime/transitive graph from the lockfile,
verify licences from primary metadata, ship required notices, and separately
review any external executable/driver distribution.

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

### LibreHardwareMonitor packaging review — 2026-09-24

Assessed against the `v0.9.6` release archive
(`LibreHardwareMonitor.zip`, 6.6 MB, 43 files) and the repository's own
`LICENSE` and `THIRD-PARTY-NOTICES.txt`. Scope: redistributing LHM inside a
Vigilia release so it ships as the default extended-sensor source.

Findings:

- **LHM itself is MPL-2.0.** File-level copyleft: redistribution is permitted,
  including in a larger work, provided LHM's own source stays MPL and its
  notices travel with it. Vigilia links nothing and modifies nothing.
- **The archive ships no licence or notice file at all**, while bundling
  third-party binaries whose licences require notices: `Aga.Controls.dll`
  (BSD), `HidSharp`, `OxyPlot`, `RAMSPDToolkit-NDD` and the .NET support
  assemblies. Shipping the archive as-is would omit notices those licences
  require, so **Vigilia must add LHM's `LICENSE` and `THIRD-PARTY-NOTICES.txt`
  plus the per-dependency notices** to its own distribution.
- **No PawnIO driver binary is in the archive** (no `.sys`; the `PawnIo`
  module is fetched separately at runtime and is LGPL-2.1). Bundling the
  archive therefore does not itself redistribute PawnIO, but a first-run
  download of the PawnIO module would, and that path needs its own review
  before being enabled.
- LHM runs with a GUI and enables its web server through an in-app menu, not a
  command-line switch, so shipping it as the *default* source means Vigilia
  launching a desktop application on the user's machine.

Conclusion: redistribution is **permissible with notices added**, and is not
blocked by licence. It remains a product decision with external effects
(shipping a third-party GUI app, and a driver-download path), so it needs the
maintainer's sign-off and the notices above before any release includes it.
`.agents/dependency-licences.md`'s release rule still applies.

`systeminformation` 5.33.13 (MIT, no dependencies of its own) is the host's
hardware-metrics source: verified from the package's own `LICENSE` and `npm
view` metadata on 2026-09-24. It reads platform counters; it is not a vendored
or linked third-party executable.

## Release rule

Before publishing: enumerate the runtime/transitive graph from the lockfile,
verify licences from primary metadata, ship required notices, and separately
review any external executable/driver distribution.

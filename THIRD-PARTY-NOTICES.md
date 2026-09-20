# Third-party notices

Vigilia is MIT licensed; see [LICENSE](LICENSE). This is the current development
inventory, not a release-grade transitive audit. Provenance:
[`.agents/dependency-licences.md`](.agents/dependency-licences.md).

## Runtime/editor

| Dependency | Licence | Use |
|---|---|---|
| Apache ECharts 6.1.0 | Apache-2.0 | charts |
| Fabric.js 7.4.0 | MIT | scene graph |
| fflate 0.8.3 | MIT | theme ZIP packages |
| @anu3ev/fabric-image-editor 0.10.32, Vigilia fork | MIT | editor foundation |
| jsPDF | MIT | editor-fork dependency |
| jsondiffpatch | MIT | editor-fork dependency |
| nanoid | MIT | editor-fork dependency |

Editor fork source:
<https://github.com/peterng1618/fabricjs-image-editor/tree/918a454038551d188d765960f64c0c3e12bf40c1>.

Preserve applicable Apache-2.0 and MIT licence/NOTICE obligations. The editor
fork dependencies have transitive graphs; audit the actual lockfile/build before
distribution.

## Build/test

Declared development dependencies: @biomejs/biome 2.5.14 (MIT OR Apache-2.0),
TypeScript 7.0.2 (Apache-2.0), Vite 8.3.0 (MIT), Vitest 5.0.0 (MIT),
@playwright/test 1.63.0 (Apache-2.0), jsdom 26.1.0 (MIT), canvas 3.2.3 (MIT),
and @types/node 22.10.2 (MIT). Native `canvas` may carry linked-library
obligations.

## Assets and planned integrations

Imported assets retain their own licence requirements; record source/hash/licence
metadata.

The approved curated-font slice will copy pairing metadata from
[Fonttrio](https://github.com/kapishdima/fonttrio) as data, not a runtime
dependency. Fonttrio is MIT licensed; preserve its attribution when shipping
derived pairing data.

LibreHardwareMonitor and PawnIO are planned integrations, not current
dependencies. Re-review their licences if Vigilia starts shipping them.

## Release rule

Before publishing, audit the complete runtime/transitive graph and ship every
required licence/NOTICE text. Verify new dependencies from primary/package
metadata when adding them.

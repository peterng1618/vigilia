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
| react 19.3.0 | MIT | editor shell chrome |
| react-dom 19.3.0 | MIT | editor shell chrome |
| @base-ui/react 1.8.0 | MIT | editor shell primitives |
| systeminformation 5.33.13 | MIT | host hardware metrics (no dependencies of its own) |

Preserve applicable Apache-2.0 and MIT licence/NOTICE obligations.

LibreHardwareMonitor is **not** a dependency and its source is not vendored.
It is an optional external program the machine owner may run; the host reads
the JSON its own web server publishes and never links or compiles its .NET
library. LibreHardwareMonitor is MPL-2.0 (`.agents/dependency-licences.md`).

## Build/test

Declared development dependencies: @biomejs/biome 2.5.14 (MIT OR Apache-2.0),
TypeScript 7.0.2 (Apache-2.0), Vite 8.3.0 (MIT), Vitest 5.0.0 (MIT),
@playwright/test 1.63.0 (Apache-2.0), jsdom 26.1.0 (MIT), canvas 3.2.3 (MIT),
@types/node 22.10.2 (MIT), @types/react 19.3.x (MIT), @types/react-dom
19.3.x (MIT), tailwindcss 4.3.3 (MIT, editor dev styling), @tailwindcss/vite
4.3.3 (MIT, editor dev). Native `canvas` may carry linked-library
obligations.

## Vendored source

`packages/editor/src/snap-manager/` and `packages/editor/src/indicator-manager/`
contain adapted copies of `@anu3ev/fabric-image-editor` 0.10.32, taken from
commit `9efdd78a342a29f169a8dbf1da78c95bbf1ffe77`. It is not a dependency; the
source was adapted in place. Its licence follows in full, as MIT requires for
substantial portions.

MIT License

Copyright (c) 2025 Alexander Anufriev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

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

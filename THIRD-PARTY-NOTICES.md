# Third-party notices

Vigilia is MIT licensed (see [LICENSE](LICENSE)). This file records the current
development dependency inventory relevant to distribution. The project is not
released; **re-audit the complete runtime/transitive dependency graph before any
public package**. Provenance notes live in
[`.agents/dependency-licences.md`](.agents/dependency-licences.md).

## Runtime/editor dependencies

### Apache ECharts 6.1.0 — Apache-2.0

Source: <https://github.com/apache/echarts>

Used for charts. Apache-2.0 licence/NOTICE obligations must be preserved in a
distribution.

### Fabric.js 7.4.0 — MIT

Source: <https://github.com/fabricjs/fabric.js>

Shared player/editor scene graph. Vigilia imports `fabric/es`; the licence and
copyright notice must accompany redistribution.

### @anu3ev/fabric-image-editor 0.10.32 — MIT

Source: <https://github.com/peterng1618/fabricjs-image-editor/tree/918a454038551d188d765960f64c0c3e12bf40c1>

Compiled editor foundation consumed from the Vigilia fork. The fork currently
declares runtime dependencies on `jspdf`, `jsondiffpatch` and `nanoid`.

### jsPDF — MIT

Source: <https://github.com/parallax/jsPDF>

Runtime dependency of the editor foundation.

### jsondiffpatch — MIT

Source: <https://github.com/benjamine/jsondiffpatch>

Runtime dependency of the editor foundation.

### nanoid — MIT

Source: <https://github.com/ai/nanoid>

Runtime dependency of the editor foundation; the fork build may inline it.

The three editor-foundation dependencies above have their own dependency graphs.
The final distributed notice set must be generated/audited from the actual
lockfile/build, not inferred from this direct list.

## Build/test dependencies

These are declared by Vigilia but are not intended to ship in the player/editor
runtime bundle:

- TypeScript 7.0.2 — Apache-2.0
- Vite 8.3.0 — MIT
- Vitest 5.0.0 — MIT
- `@playwright/test` 1.63.0 — Apache-2.0
- jsdom 26.1.0 — MIT
- canvas 3.2.3 — MIT; native test dependency with its own linked-library
  licences
- `@types/node` 22.10.2 — MIT

## Imported assets

Packaged fonts, SVGs and other imported assets retain their own licences and
attribution requirements. Record source/hash/licence metadata with imported
assets. A source URL alone does not establish reuse rights.

## Not currently distributed

LibreHardwareMonitor and PawnIO are planned extended-sensor integrations, not
current Vigilia dependencies. Do not copy their old planned notices into a
release unless the eventual distribution model actually ships them; re-review
their licences at that point.

## Maintenance

Any new dependency must have its licence verified from package/vendor primary
metadata before it is added. Before release, audit transitive runtime
components and ship the required licence/NOTICE texts rather than treating this
hand-maintained summary as exhaustive.

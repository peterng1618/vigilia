# Dependency findings

Provenance for the licence claims in
[`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md), plus the few dependency
facts that shaped a design decision.

**Verified 2026-09-12**, each against a primary source — package metadata, a
repository file, or vendor documentation — with the method recorded so it can be
re-run. Licences are read from the package's own `package.json` or `LICENSE`,
never from a search summary.

Rewritten 2026-09-13 when the C# host was deleted: the .NET support matrix and
the 2026-09-12 editor-foundation comparison (Vue, Pinia, Moveable, and the two
Fabric-based *editors* `vue-fabric-editor` and `yft-design`) are gone. None of
those is a dependency. Fabric itself **is** one as of 2026-09-15 — see *the
editor and the player render through Fabric* in [`decisions.md`](decisions.md),
and note that what was rejected in 2026-09 was the two prebuilt editors, not the
library.

## Installed

Everything Vigilia actually depends on. All build- or test-time except ECharts
and Fabric.

| Package | Version | Licence | Ships? |
|---|---|---|---|
| echarts | 6.1.0 | Apache-2.0 | **Yes** — bundled into the player and editor |
| fabric | 7.4.0 | MIT | **Yes** — bundled into the player and editor |
| vite | 8.3.0 | MIT | No |
| typescript | 7.0.2 | Apache-2.0 | No |
| vitest | 5.0.0 | MIT | No |
| @playwright/test | 1.63.0 | Apache-2.0 | No |
| @types/node | 22.10.2 | MIT | No — types only |

## Fabric — MIT, no dependencies, and one import path that matters

**Method:** the installed package's own `package.json` and bundled `LICENSE`
file, read on 2026-09-15 at version 7.4.0.

- **Licence: MIT**, stated identically in `package.json`'s `"license"` and in
  `LICENSE`'s first line.
- **No runtime dependencies at all** (`dependencies: {}`, `peerDependencies:
  {}`), and `"sideEffects": false`.

**The `fabric/es` subpath is not an optimisation, it is the only correct import.**
The default `.` entry resolves to `dist/index.min.mjs` — one pre-bundled,
pre-minified 292 KB file that a tree-shaker cannot see into. `./es` resolves to
a barrel over ~430 per-module files and **carries the same `types`**, so there
is no typing penalty for taking it. Measured on 2026-09-15 with the workspace's
own Vite 8.3.0: the same five named imports cost **95.0 KB gzip through `.` and
49.3 KB through `./es`**. Writing `from 'fabric'` out of habit silently costs
45 KB, which is why an import-boundary test names the bare specifier rather than
relying on the §47 total to notice.

Two further measured facts, because they shape what the player may import:

- `StaticCanvas` genuinely excludes the interaction layer — no pointer handlers,
  no `SelectableCanvas`, no brushes — confirmed by module manifest, string grep
  and a 31 KB gzip difference against `Canvas`.
- Every **built-in** shape extends `InteractiveFabricObject`, which imports
  `createObjectDefaultControls`. So a display-only player still pays ~6.4 KB
  gzip of control definitions unless every object descends from
  `BaseFabricObject`. That is the accepted price of using `Rect`, `FabricText`
  and `Group` rather than hand-rolling them.

## The image-editor source fork

**Method:** the adopted fork's `package.json`, read 2026-09-17 at commit
`9a370711d89611e7f9f1c32261208cc4abebb981`.

`@anu3ev/fabric-image-editor` 0.10.32 is MIT. Vigilia consumes its compiled
Git package so the fork retains its own TypeScript program; its `fabric/es`
external resolves to Vigilia's pinned Fabric 7.4.0.

**The host has no runtime dependencies at all**: `node:http` to serve, SSE for
the stream, `node:os` for telemetry.

## Apache ECharts — and the engine gap it revealed

**Method:** npm registry; `apache/echarts-doc` raw `en/option/series/gauge.md`.

Apache-2.0, latest 6.1.0, repo very active.

- **Arbitrary-sweep gauges: supported.** `startAngle` (default 225) and
  `endAngle` (default −45) both accept −360…360, which satisfies §81's
  full/half/arbitrary-sweep requirement.
- **Gauge ring gradients: ENGINE GAP.** `axisLine.lineStyle.color` takes
  `[[proportion, color], …]` pairs, producing **discrete colour segments**.
  Gradient objects are not documented for that property.

So "gradient fills with editable stops" is **not natively expressible on a gauge
ring**. The implementation approximates one with many small segments
(`gradientSegments`, default 64). §85 requires explicit human agreement on the
alternative; it is still open — see [`decisions.md`](decisions.md).

## LibreHardwareMonitor — planned, not yet used

**Method:** GitHub repo API, `LICENSE`, the library csproj at `master` and at
tag `v0.9.6`, NuGet flat-container index, repo file tree.

- **Licence: MPL-2.0**, confirmed in both `LICENSE` and the csproj's
  `PackageLicenseExpression`.
- **Health: good.** 9.0k stars, last push 2026-09-10, not archived.
- **Latest stable: `v0.9.6`** (2026-02-14). NuGet carries **12 stable versions
  against 735 prereleases** (the `0.9.7-preNNN` train), so anything resolving
  "latest" picks up a prerelease.

Vigilia will run LHM as an **external prebuilt executable** read over its local
HTTP endpoint, not as a linked library — so the MPL-2.0 obligation applies to a
separate program, and the NuGet packaging above is background rather than a
dependency. Nothing here is implemented yet.

### WinRing0 is blocklisted, and LHM has already moved off it

Relevant because it is the reason a driver is involved at all: the old WinRing0
driver is on Microsoft's vulnerable-driver blocklist. Current LHM uses **PawnIO**
instead.

### PawnIO is a separate, user-installed driver

GPL-2.0, installed by the user, not redistributed by Vigilia. The embedded PawnIO
*modules* are LGPL-2.1. This is why extended sensors are a separate tier that may
legitimately be unavailable (see `decisions.md`).

## Still unverified

Only one item survives from the original list — the others were answered, or
their questions were retired with the decisions that raised them.

**Real sensor coverage on the target machine.** Which sensors exist, their names
and instance ids, and which are actually populated. This must come from the
hardware (§166); it cannot be reasoned about, and no LHM provider exists yet to
ask.

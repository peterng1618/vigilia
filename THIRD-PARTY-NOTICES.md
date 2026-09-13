# Third-party notices

This project is MIT licensed (see [LICENSE](LICENSE)). It uses the third-party
components below. **All notices here must be reproduced in distributed packages**
(§132, §161 of the design document).

Licensing facts in this file were verified against primary sources on
**2026-09-12**; see [.agents/dependency-licences.md](.agents/dependency-licences.md)
for how each was checked. Re-verify before any public release.

---

## LibreHardwareMonitorLib — MPL-2.0

- Source: <https://github.com/LibreHardwareMonitor/LibreHardwareMonitor>
- License: Mozilla Public License 2.0 (declared as `PackageLicenseExpression` in
  `LibreHardwareMonitorLib.csproj`)
- Pinned version: **0.9.6** (latest *stable*; the package also publishes 700+
  `0.9.7-preNNN` builds which we deliberately do not take — see ADR-0003)

MPL-2.0 is **file-level** copyleft. Consuming the unmodified NuGet package inside
this MIT-licensed application is permitted under the MPL's "Larger Work" provision.
Obligations we must honour:

1. Keep this notice and a copy of the MPL-2.0 text in distributed packages.
2. If we **modify** any MPL-covered file, that modified file must be released
   under MPL-2.0. Prefer wrapping/extending over editing vendored sources so this
   never arises.
3. Make the source of the MPL-covered components available (linking upstream at
   the pinned version satisfies this).

## PawnIO modules (embedded in LibreHardwareMonitorLib) — LGPL-2.1

- Source: <https://github.com/namazso/PawnIO.Modules> (release **0.2.11**)
- License: GNU Lesser General Public License 2.1 (`Resources/PawnIo/COPYING`)
- Form: pre-compiled `.bin` bytecode modules (`IntelMSR.bin`, `RyzenSMU.bin`,
  `LpcIO.bin`, `SmbusI801.bin`, …) embedded as resources in the library and
  loaded into the PawnIO driver at runtime.

These are redistributed with the library. LGPL-2.1 permits use by a
differently-licensed application provided the LGPL components stay replaceable
and their notices are preserved. **Do not modify the module binaries.**

## PawnIO driver — GPL-2.0 (separate program, not linked)

- Source: <https://github.com/namazso/PawnIO> · <https://pawnio.eu/>
- License: GNU General Public License 2.0

PawnIO is a signed, scriptable kernel driver **installed separately** by the user
or by our installer invoking the vendor's own `PawnIO_setup.exe`. Our code
communicates with it only through the documented device interface
(`\\?\GLOBALROOT\Device\PawnIO`) as an independent program, so GPL-2.0 does not
extend to this application.

> **Do not statically link, vendor, or modify the PawnIO driver sources.** Doing
> so would change the licensing analysis above. If bundling the installer, ship it
> verbatim with its own licence text intact.

## Apache ECharts — Apache-2.0

- Source: <https://github.com/apache/echarts>
- License: Apache License 2.0 · Pinned version: **6.1.0**

Apache-2.0 requires preserving the licence, copyright and NOTICE file contents,
and stating significant changes. Import per-series from `echarts/core` for
tree-shaking rather than the default bundle.

## Fonts, icons and imported assets

Packaged fonts and imported SVG icons carry their own licences and must ship with
attribution metadata and required notices preserved (§132). Font Awesome Free
terms: <https://fontawesome.com/license/free>. A URL alone does not establish
reuse rights — record source, hash and supplied licence for every imported asset.

---

## TypeScript — Apache-2.0

Compiler and type checker. **Build-time only**; nothing from it is bundled, and
no TypeScript runtime ships. Licence read from the installed package's own
`package.json`.

## Vitest — MIT

Unit test runner. Test-time only; never bundled.

## Playwright (`@playwright/test`) — Apache-2.0

Browser test runner. Test-time only; never bundled. Downloads its own Chromium
build, which carries its own licences and is not redistributed by Vigilia.

## Vite — MIT

Bundler and dev server. Build-time only.

## @types/node — MIT

`@types/node` 22.10.2, a devDependency of `@vigilia/host`. Licence verified
from the package's own `package.json` (`"license": "MIT"`) and its bundled
`LICENSE` file (MIT, Copyright (c) Microsoft Corporation), on 2026-09-13.

**Type declarations only.** Nothing from this package exists at runtime — `tsc`
erases it — so it cannot appear in a distributed bundle and carries no notice
obligation into one. Recorded here because `AGENTS.md` requires every declared
dependency to be listed, not because it ships.

The host itself has **no runtime dependencies** beyond `@vigilia/renderer-core`
(this repository): serving is `node:http`, the sample stream is Server-Sent
Events over that same server, and baseline telemetry is `node:os`
([ADR-0007](.agents/decisions.md)). Adding one —
`systeminformation` is the intended source for disk and network counters — needs
an entry here first.

---

## Maintenance rule

Any new dependency must be added here **with its licence verified from the
package's own metadata or LICENSE file** — not from a search summary — before it
is referenced in build files. Gate 0 requires a complete licence inventory (§157).

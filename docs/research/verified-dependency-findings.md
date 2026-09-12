# Verified dependency findings

**Verified 2026-09-12.** Every row below was checked against a primary source
(package metadata, repository file, or vendor documentation) and the method is
recorded so it can be re-run. Items marked **UNVERIFIED** are explicitly *not*
established and must not be treated as settled — §33 of the design document
requires treating feature lists as hypotheses until demonstrated.

> Web search was unavailable during this pass. Findings came from direct HTTP
> fetches of registry APIs, raw repository files, and Microsoft documentation.

---

## 1. .NET runtime support matrix

**Method:** `dotnet/core` `release-notes/releases-index.json`.

| Channel | Type | Phase | EOL |
| --- | --- | --- | --- |
| 11.0 | STS | go-live (`11.0.0-rc.1`) | — |
| **10.0** | **LTS** | **active** (`10.0.12`) | **2028-11-14** |
| 9.0 | STS | maintenance | 2026-11-10 |
| 8.0 | LTS | maintenance | 2026-11-10 |
| 7.0 / 6.0 and earlier | — | EOL | past |

**Consequence:** .NET 8 *and* 9 expire in under two months. Target `net10.0`
(ADR-0002). Note the local machine currently has **no SDK** — only the EOL
6.0.35 runtime. Install the .NET 10 SDK before building.

## 2. LibreHardwareMonitor

**Method:** GitHub repo API, `LICENSE`, `LibreHardwareMonitorLib.csproj` at
`master` and at tag `v0.9.6`, NuGet flat-container index, repo file tree.

- **License: MPL-2.0** (confirmed in both `LICENSE` and the csproj's
  `PackageLicenseExpression`).
- **Health: good.** 9.0k stars, 1010 forks, last push 2026-09-10, not archived.
- **Latest stable release: `v0.9.6`** (2026-02-14).
- **NuGet versions: 12 stable** (max `0.9.6`) vs **735 prereleases** (the
  `0.9.7-preNNN` train). Pin the stable one.
- **Target frameworks:** `net472;netstandard2.0;net8.0;net9.0;net10.0` — `net10.0`
  is supported. `IsAotCompatible` and `IsTrimmable` are both set.

### 2a. WinRing0 is blocklisted — and LHM has already moved off it

This was the single highest-stakes unknown, and both halves are now established.

**The block is real.** Downloaded the official blocklist
(`aka.ms/VulnerableDriverBlockList` → `DriverPolicy_Enforced.xml`) and searched
it: **29 `Deny` rules** match WinRing0/OpenLibSys, covering

`WinRing0.sys`, `WinRing0.Sys`, `WinRing0x64.sys`, `WinRing0a64.sys`,
`WinRing0_1_2_2.sys`, `iFlyWinRing0x64.sys`, and `OpenLibSys.sys`
(the OpenHardwareMonitor driver).

These are **unconditional SHA1/SHA256 hash denies** — not version-bounded, so
there is no "newer fixed build" escape. Per Microsoft's documentation the
blocklist is **enabled by default since the Windows 11 2022 update**, is always
enforced when HVCI / Smart App Control / S mode is active, and **HVCI is on by
default for most new Windows 11 devices**.

**But LHM no longer uses it.** `Ring0.cs` is absent from `master`; the library now
ships **PawnIO**:

- `LibreHardwareMonitorLib/PawnIo/*.cs` — `PawnIo.cs`, `IntelMsr.cs`,
  `RyzenSmu.cs`, `LpcIO.cs`, `AmdFamily0F/10/17.cs`, `Nvidia.cs`, …
- `LibreHardwareMonitorLib/Resources/PawnIo/*.bin` — signed bytecode modules
- **Present in stable `v0.9.6`**, not only in `master`/prerelease.

### 2b. PawnIO is a separate, user-installed driver

From `PawnIo.cs`:

- Installation is detected via registry
  `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\PawnIO`
  (`DisplayVersion`), with a Wow64 fallback; `PawnIo.IsInstalled` is false when absent.
- The device is opened with
  `CreateFile(@"\\?\GLOBALROOT\Device\PawnIO", ReadWrite, …)` and driven by
  IOCTLs `IOCTL_PIO_LOAD_BINARY` / `IOCTL_PIO_EXECUTE_FN`.
- LHM bundles the vendor installer at
  `LibreHardwareMonitor.Windows.Forms/Resources/PawnIO_setup.exe`.

**Architectural consequence:** full sensor coverage depends on an out-of-band
driver install. The provider must detect absence and degrade rather than fail —
this is what ADR-0004's tiered design exists to handle.

**Licensing consequence:** three licences, three different obligations — driver
GPL-2.0 (separate program), modules LGPL-2.1 (redistributed), library MPL-2.0.
See [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md).

## 3. Editor foundation candidates

**Method:** GitHub repo API, raw `package.json`, raw `LICENSE`, `README.md`, tags API.

| | vue-fabric-editor | yft-design |
| --- | --- | --- |
| License | MIT | MIT |
| Stars / forks | 7965 / 1396 | 1639 / 331 |
| Last push | 2026-07-21 | 2026-09-04 |
| **fabric** | **`5.3.0` (hard-pinned, no caret)** | **`^6.4.1`** |
| vite | `^4.2.1` | `^5.4.3` |
| vue | `^3.2.25` | `^3.4.30` |
| typescript | `5.1.6` | `^4.9.5` |
| pinia | — | `^2.1.7` |
| Tags | **none usable** (`vue`, `no-plugin` only) | — |

Two findings that bear on §37's "prototype vue-fabric-editor first":

1. **It is two Fabric majors behind** (current Fabric is `7.4.0`; v6 was a
   TypeScript rewrite with breaking API changes), on Vite 4.
2. **It has no release tags**, so "pinned dependencies" (§157) can only mean a
   commit SHA.

Its `README.md` also confirms the design document's caution: the open-source
build is **frontend-only**, with a separate paid edition providing
backend/admin/source licensing. Only OSS capabilities may be relied on.

→ Both candidates are evaluated in parallel at Gate 0 (ADR-0001).

## 4. Apache ECharts

**Method:** npm registry, `apache/echarts-doc` raw `en/option/series/gauge.md`.

- **License Apache-2.0**, latest **`6.1.0`**. Repo very active (67.3k stars).
- **Arbitrary-sweep gauges: supported.** `startAngle` (default `225`) and
  `endAngle` (default `-45`) both accept **−360…360**. Satisfies §81's
  full/half/arbitrary-sweep radial gauge requirement.
- **Gauge ring gradients: ENGINE GAP.** `axisLine.lineStyle.color` takes
  `[[proportion, color], …]` pairs (default `[[1, '#E6EBF8']]`), producing
  **discrete colour segments**. Gradient objects are **not documented** for this
  property.

**Consequence for §83/§85:** "gradient fills with editable stops" is *not*
natively expressible on a gauge ring. Decide the alternative before authoring the
chart/style acceptance matrix — candidates: (a) synthesise many small segments to
approximate an angular gradient, (b) a shared native overlay arc, (c) restrict
gradients to non-gauge families. §85 requires explicit human agreement on the
alternative; this gap is pre-recorded in the Gate 0 checklist.

## 5. Other pinned frontend packages

| Package | Latest | License |
| --- | --- | --- |
| fabric | 7.4.0 | MIT |
| echarts | 6.1.0 | Apache-2.0 |
| vue | 3.5.42 | MIT |
| pinia | 4.0.3 | MIT |
| vite | 8.3.0 | MIT |
| moveable | 0.53.0 | MIT |

---

## UNVERIFIED — must be established empirically

These are **open questions**, not findings. Several were guessed at during an
earlier research attempt; none of those guesses are recorded here as fact.

1. **Per-sensor elevation requirements.** Which sensors work unelevated and which
   need PawnIO is undetermined. Whether opening `\\?\GLOBALROOT\Device\PawnIO`
   succeeds without admin depends on the device ACL the installer applies.
   → Gate 0 probe `G0-P1`; must be measured, not reasoned about.
2. **Anti-cheat coexistence.** Whether PawnIO is tolerated by Vanguard, EAC and
   BattlEye is unknown. PawnIO being signed and blocklist-clean is *necessary but
   not sufficient* — anti-cheat vendors maintain independent policies.
   → Gate 0 probe `G0-P2`, on real hardware with the real games.
3. **SignalR backpressure.** §122 requires discarding obsolete pending snapshots
   for slow clients. No built-in "keep-latest" behaviour is known to exist; this
   most likely needs an explicit bounded `Channel` with `DropOldest` or an
   interlocked snapshot swap. The scaffold implements the bounded-channel
   approach, but the framework's own slow-client behaviour is unverified.
   → Gate 0 probe `G0-P3`.
4. **Real sensor coverage on the target machine** — sensor names, instance IDs and
   which are actually populated. Must come from the hardware (§166).
5. **Reference hardware for performance budgets.** §126 requires budgets on
   "named reference PCs/phones" but names none. Blocks Gate 0 sign-off until the
   actual devices are chosen.

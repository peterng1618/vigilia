# ADR-0002 — Target .NET 10 (LTS)

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

§41 requires pinning supported versions at Gate 0. The support matrix from
`dotnet/core`'s `releases-index.json` on 2026-09-12:

| Channel | Type | Phase | EOL |
| --- | --- | --- | --- |
| 11.0 | STS | go-live (`rc.1`) | — |
| **10.0** | **LTS** | active (`10.0.12`) | **2028-11-14** |
| 9.0 | STS | maintenance | **2026-11-10** |
| 8.0 | LTS | maintenance | **2026-11-10** |

.NET 8 and 9 both expire in under two months. Pinning either at Gate 0 would ship
an already-expiring runtime. .NET 11 is at release candidate and is STS
(short-term support) — a shorter support window and a moving target during v1.

`LibreHardwareMonitorLib` already multi-targets `net10.0` (alongside `net472`,
`netstandard2.0`, `net8.0`, `net9.0`), so our largest dependency imposes no
constraint here.

## Decision

Target **`net10.0`**, pinned via `global.json` (`10.0.100`, `rollForward:
latestFeature`, prerelease disallowed) and `Directory.Build.props`.

Windows-specific projects target `net10.0-windows` by opting in with
`IsWindowsPlatformProject=true`, keeping §97's boundary mechanical: everything
else stays platform-neutral and `CA1416` is escalated to an error.

## Consequences

- **The .NET 10 SDK must be installed before building.** The development machine
  currently has no SDK at all — only the EOL 6.0.35 runtime.
- LTS through 2028-11-14 comfortably outlasts v1 development.
- Revisit when .NET 12 reaches LTS; STS channels are skipped by default.
- `IsAotCompatible`/`IsTrimmable` are set upstream in LHM, so trimming the host
  stays a live option for the §111 "minimal PC overhead" requirement.

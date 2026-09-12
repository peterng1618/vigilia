# ADR-0003 — Pin LibreHardwareMonitorLib 0.9.6 (stable), not the prerelease train

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

`LibreHardwareMonitorLib` on NuGet publishes **12 stable versions** (highest
`0.9.6`) and **735 prereleases** — a continuous `0.9.7-preNNN` stream currently at
`-pre736`. Tooling that resolves "latest" will pull a prerelease.

The decisive question was whether the **PawnIO migration** (which replaces the
blocklisted WinRing0 driver — see
[verified-dependency-findings §2a](../research/verified-dependency-findings.md))
is available in a stable release or only in `master`.

It is in stable. The csproj at tag **`v0.9.6`** already embeds the PawnIO module
resources (`IntelMSR.bin`, `RyzenSMU.bin`, `LpcIO.bin`, …). So there is no
need to take prerelease risk to get off WinRing0.

## Decision

Pin **`LibreHardwareMonitorLib` 0.9.6** exactly. Do not float the version, and do
not enable prerelease resolution.

Re-evaluate only on a deliberate, recorded upgrade: newer sensor coverage the
project actually needs, or a newer PawnIO module set. Any move onto a prerelease
requires the §164 human review for "major dependency changes."

## Consequences

- Reproducible Gate 0 evidence — a prerelease train would invalidate measurements
  between runs.
- We forgo sensor fixes landing in `0.9.7-pre*` until they reach stable. Acceptable:
  sensor coverage is measured per-machine at Gate 0 anyway (§166), so a gap shows
  up as a concrete missing sensor rather than a vague regression.
- The pin is asserted in one place (`src/Vigilia.Providers.Windows`) and
  echoed in `THIRD-PARTY-NOTICES.md`. Keep both in sync.

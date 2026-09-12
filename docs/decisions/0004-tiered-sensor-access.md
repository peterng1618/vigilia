# ADR-0004 — Tiered sensor access; the kernel driver is optional

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

Full sensor coverage — CPU package temperature, fan RPM, voltages — needs ring-0
access to MSRs and Super-I/O chips. LibreHardwareMonitor reaches these through
**PawnIO**, a signed scriptable kernel driver that is **installed separately**
(`PawnIo.IsInstalled` probes
`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\PawnIO`; LHM bundles the
vendor's `PawnIO_setup.exe`).

The predecessor approach is closed off permanently: **WinRing0 is in Microsoft's
vulnerable-driver blocklist** under 29 unconditional hash denies, the blocklist is
default-on since the Windows 11 2022 update, and HVCI — which always enforces it —
is default-on for most new Windows 11 devices. There is no version of WinRing0 that
loads on a current default-configured Windows 11 machine.

Two things remain genuinely unknown and cannot be resolved by reading:

1. Whether opening the PawnIO device requires elevation (depends on the ACL the
   installer applies).
2. Whether PawnIO is tolerated by Vanguard / EAC / BattlEye. Being signed and
   blocklist-clean is necessary but not sufficient.

§111 makes minimal overhead a release requirement "for performance-conscious
users, including gamers" — precisely the users for whom an anti-cheat conflict or
a mandatory kernel driver is disqualifying.

## Decision

Ship **two sensor tiers** behind one provider interface.

**Tier 1 — Baseline (always available, no driver, no elevation).**
CPU/GPU load, memory, disk and network throughput, GPU utilisation via performance
counters/WMI and vendor read-only GPU APIs. The app is fully functional here.

**Tier 2 — Extended (opt-in, requires PawnIO).**
Temperatures, fan RPM, voltages, clocks and anything else needing ring-0.

Rules:

- **Never demand the driver on first run.** The app starts, discovers Tier 1
  sensors, and works.
- Tier 2 is surfaced as an explicit, reversible opt-in that states plainly what it
  installs and why.
- A theme binding an unavailable Tier 2 sensor renders the §93 **missing** state
  with an actionable prompt — never a fabricated or zero reading.
- Sensor descriptors carry their tier, so the editor can warn at authoring time
  rather than failing at display time.
- Tier boundaries are **discovered, not hardcoded**: the Windows provider reports
  what it actually got from the hardware. Gate 0 probe `G0-P1` records the real
  per-sensor breakdown.

## Consequences

- The provider contract needs capability/tier reporting from the start — this also
  serves §97's requirement that future Linux/macOS providers report capabilities
  rather than fabricate readings.
- More states to build and test: driver absent, present-but-unelevated, present,
  and blocked-by-policy. The fake provider must simulate all four.
- Graceful degradation is the default posture, so an anti-cheat incompatibility
  found at `G0-P2` becomes a documented limitation rather than a dead project.
- Deferred: whether the installer should offer the driver during setup or only on
  demand. Decide after `G0-P1`/`G0-P2` report.

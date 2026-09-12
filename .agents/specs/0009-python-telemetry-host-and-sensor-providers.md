# 0009 — Python telemetry host and sensor providers

- **Status:** draft
- **Design document sections:** §93, §95, §97, §111, §120, §122, §160
- **Specs superseded:** none

## Problem

The current backend is scaffolded in C#/.NET but has never been built or run. Keeping it would introduce a .NET SDK/toolchain dependency before any backend behaviour has been validated.

Vigilia also needs more hardware telemetry than one portable library can reliably provide. `psutil` is sufficient for baseline OS metrics but not temperatures, fans, power, clocks and motherboard sensors.

The backend should therefore move to Python, using:

- **`psutil`** for baseline telemetry;
- the **prebuilt LibreHardwareMonitor executable** for extended hardware sensors;
- a provider boundary that can support other monitoring applications later.

The TypeScript frontend remains unchanged in responsibility and communicates only through Vigilia's normalized telemetry contract.

## Behaviour

### Python host

Replace the unverified C# backend with a Python application.

Python is preferred over a TypeScript/Node backend because `psutil` is the primary built-in telemetry source. Using TypeScript would either replace it or require a separate Python process.

The Python host owns the same responsibilities intended for the C# host:

- provider discovery and sampling;
- scheduling;
- semantic sensor mapping;
- normalization;
- bounded history;
- stale/error handling;
- HTTP APIs;
- realtime publication to the player/editor.

SignalR is not retained. The Python host exposes a normal WebSocket transport that implements the existing frontend `SampleSource` boundary.

Slow clients use **keep-latest** behaviour: obsolete telemetry snapshots are discarded rather than queued and replayed.

Runtime installation must not require a compiler or SDK. Python dependencies used by the normal Windows install must have prebuilt wheels.

### Provider contract

Providers acquire data; the host schedules and publishes it.

Each provider supplies:

- sensor discovery;
- stable provider-local sensor IDs;
- sensor metadata and units;
- current samples;
- availability/health.

Themes never bind to provider-specific IDs. They continue to use semantic keys such as:

```text
cpu.load
cpu.temp.package
cpu.power.package
gpu.0.load
gpu.0.temp
gpu.0.power
memory.used
network.download
```

Changing the source behind a semantic key must not require editing a theme.

### `psutil` provider

`psutil` is the default provider and requires no separate monitoring application.

It supplies baseline metrics where supported, including:

- CPU load;
- memory usage;
- disk usage and I/O;
- network throughput;
- process/system information.

Vigilia remains functional when this is the only available provider.

`psutil` is preferred for baseline OS metrics even when another provider exposes equivalent readings. This avoids unnecessarily depending on LibreHardwareMonitor for data the OS already exposes reliably.

### LibreHardwareMonitor provider

LibreHardwareMonitor supplies extended hardware telemetry, including where available:

- CPU/GPU temperatures;
- clocks;
- power;
- voltages;
- fan speeds;
- motherboard sensors;
- other device-specific sensors.

Vigilia does **not** reference `LibreHardwareMonitorLib.dll` or compile LibreHardwareMonitor.

Instead, LibreHardwareMonitor runs as a separate prebuilt executable and Vigilia reads its local HTTP sensor endpoint.

One complete LHM sensor tree is fetched per sampling cycle, not one request per sensor.

LibreHardwareMonitor is optional. If unavailable, its semantic keys become `missing`; no value is fabricated.

The provider supports:

1. connecting to an LHM instance already running with its web server enabled;
2. launching a configured LHM executable as a companion process.

Vigilia may stop LHM on shutdown only when Vigilia started that process. It must never terminate a user-owned instance.

Bundling or automatically downloading LHM is a packaging decision outside this spec.

### Sensor mapping

The provider layer normalizes raw sensors before the frontend sees them.

For overlapping data, default ownership is:

| Metric class | Preferred source |
|---|---|
| CPU load | `psutil` |
| Memory | `psutil` |
| Disk usage/I/O | `psutil` |
| Network | `psutil` |
| Temperature | LHM |
| Fan speed | LHM |
| Voltage | LHM |
| CPU/GPU power | LHM |
| Hardware clocks | LHM |
| Motherboard sensors | LHM |

Mappings may later be overridden by users.

Provider array/tree position is never treated as persistent identity. Use the strongest stable identifier exposed by the provider.

### Failure isolation

A provider failure must not stop telemetry from other providers.

If LHM:

- is not installed;
- is not running;
- has its web server disabled;
- stops responding; or
- returns malformed data,

the LHM provider becomes unavailable/error while `psutil` continues operating.

Last-known values may briefly be marked `stale`, then become `missing`. Zero is never substituted for unavailable data.

### C# removal

The Python backend replaces rather than wraps the current C# scaffold.

Once equivalent contracts and tests exist in Python, remove:

- `Vigilia.Host`;
- `Vigilia.Core`;
- `Vigilia.Contracts`;
- C# provider projects;
- C# platform projects that have no validated implementation worth retaining;
- backend `.csproj`/solution infrastructure;
- the pinned .NET SDK requirement.

Behavioural ideas from the C# scaffold may be reimplemented, but the unexecuted C# code is not treated as a compatibility target.

The TypeScript renderer/editor/player contracts remain the compatibility boundary.

## Future providers

The provider abstraction must allow additional adapters without changing themes or renderer code.

Likely future Windows sources include:

- HWiNFO shared memory;
- AIDA64 shared memory;
- MSI Afterburner shared memory;
- vendor-specific GPU APIs.

These are roadmap items, not part of the initial implementation.

## Out of scope

- Reimplementing LibreHardwareMonitor's hardware-access code.
- Loading LibreHardwareMonitor's .NET library directly.
- Requiring the .NET SDK.
- HWiNFO, AIDA64 or MSI Afterburner implementation.
- Hardware control, overclocking or fan control.
- Arbitrary third-party code plugins.
- Cross-platform telemetry beyond keeping the provider contract platform-neutral.
- Automatic LHM download/update/installation.

## Acceptance

| Behaviour | Test |
|---|---|
| Backend runs without .NET | Clean environment can install and run the Python host with no .NET SDK |
| Baseline telemetry works alone | `psutil` provider publishes real CPU/memory/disk/network samples with LHM absent |
| LHM extended sensors work | LHM HTTP fixture produces normalized temperature/power/clock/fan descriptors and samples |
| LHM is optional | Unavailable LHM produces missing extended sensors while `psutil` continues normally |
| One LHM read per cycle | Multiple mapped LHM sensors cause one sensor-tree request |
| Provider failure is isolated | Failing LHM fixture does not interrupt `psutil` samples |
| Provider replacement does not change themes | Same semantic key can resolve to different provider sensors without modifying the theme |
| No stale backlog | Slow WebSocket client receives the newest snapshot rather than queued historical snapshots |
| C# dependency is removed | Normal build/test/development workflow contains no required `dotnet` command |
| Frontend contract survives migration | Player consumes Python-host samples through its existing `SampleSource` abstraction |
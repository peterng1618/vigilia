# 0010 — Host, CLI and live telemetry

- **Status:** active; baseline host implemented, extended providers/product flow incomplete
- **Design sections:** §93, §97, §111, §116, §120, §122, §141, §145

## Goal

Run Vigilia from one Node/TypeScript host that serves the player/editor and
publishes real sensor samples without requiring .NET or Python.

## Implemented contract

### CLI/serving

From `src/web/`:

```bash
node packages/host/bin/vigilia.js
```

Future published binary: `vigilia-dashboard`.

- Default bind: `127.0.0.1`, port 5227.
- `--host`, `--port`, `--no-browser`, `--help`, `--version` are supported.
- Port fallback is bounded/reported.
- `/` serves the player and defaults it to live data.
- `/editor/` serves the editor only to loopback peers.
- `/api/sensors` exposes discovered sensor descriptors.
- `/api/health` exposes connected-display/polled-key state.
- `/ws` is the SSE sample stream despite the legacy path name.
- Static traversal is refused; non-GET methods are refused.

### Transport

`renderer-core/src/data/protocol.ts` owns the versioned sample frame shared by
host/display. Transport is Server-Sent Events. A client declares semantic keys
in the stream query; the host polls the union of all connected clients' keys
once per cadence.

Slow clients use keep-latest: at most the newest pending snapshot matters.
Unknown protocol versions are refused rather than guessed.
The display source holds received samples for one cadence before exposing them,
so every telemetry surface shares a measured, continuously scrolling timeline.

### Provider model

Providers acquire; the host schedules. Providers expose discovery, stable local
sensor ids, metadata/units, current samples and availability. Failure in one
provider must not stop the others.

Themes bind semantic keys, never provider ids. Missing/unavailable data remains
missing/stale/error; zero is never fabricated.

### Baseline provider

Implemented with Node built-ins:

- `cpu.load` from deltas of cumulative `os.cpus()` ticks;
- `ram.used`, `ram.used.percent`, `ram.total` from `node:os` memory data.

The first CPU sample after start is `missing` because there is no prior counter
to diff. It must not render as an idle CPU.

## Not implemented yet

- disk/network baseline metrics;
- LibreHardwareMonitor extended provider for temperatures, power, clocks, fans,
  voltages and motherboard sensors;
- provider/user mapping UI;
- theme storage/editor save-to-host;
- pairing/revocable sessions and polished LAN onboarding;
- cross-platform telemetry beyond keeping provider contracts portable.

When LHM is implemented, treat it as an optional external prebuilt process/local
interface. Do not link or compile its .NET library. Stop only processes Vigilia
started itself.

## Security/product rules

- LAN serving is explicit opt-in; editing stays loopback-only by default.
- Do not imply confidentiality on plain LAN HTTP.
- Never expose credentials through themes/browser responses.
- No automatic fallback from real providers to synthetic data.
- Hardware control/overclocking/fan control are out of scope.

## Acceptance

Current implemented path remains covered by tests for CLI parsing/port fallback,
protocol framing/version refusal, keep-latest, CPU delta calculation, missing
status, provider failure isolation, union polling and static-path safety.

Future provider/LAN/theme-storage work must add evidence at its own boundary.
Current run counts and machine-specific observations belong in `status.md`, not
this spec.

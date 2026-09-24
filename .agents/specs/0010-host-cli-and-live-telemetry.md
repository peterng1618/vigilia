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
The display source exposes received samples immediately. Line-chart viewports
trail one cadence so complete measured segments scroll in from the right.

### LAN display sessions

Loopback is trusted admin and needs no credential. A non-loopback display needs
a live session for every read it makes, and a host started without a session
store refuses LAN reads rather than trusting them.

- Pairing is loopback-only: minting, listing and revoking are admin actions, so
  a phone can never mint its own credentials.
- Tokens are 32 bytes of CSPRNG output with a 12-hour expiry, compared in
  constant time and swept on each verification.
- The token travels in the page URL because `EventSource` cannot set request
  headers; fetches send it as `x-vigilia-session` and the stream appends
  `session=`. Anyone who sees the link can watch until it is revoked or
  expires, which is why it is short-lived.
- `/api/health` reports whether pairing is available.

### Provider model

Providers acquire; the host schedules. Providers expose discovery, stable local
sensor ids, metadata/units, current samples and availability. Failure in one
provider must not stop the others.

Themes bind semantic keys, never provider ids. Missing/unavailable data remains
missing/stale/error; zero is never fabricated.

A non-`ok` sample does **not** claim its key: a later provider may still answer
it, so the providers form a fallback chain. A key no provider measured keeps the
earliest provider's gap, so the display shows a specific reason rather than a
blank.

### Providers

Vigilia does not maintain a hardware collector. Collection belongs to a library
or an existing external program (§97).

| Provider | Source | Answers |
|---|---|---|
| `lhm` (preferred) | LibreHardwareMonitor's own web server, `data.json` | CPU temperature/power/clock/fan, GPU load/temp/power/clock/fan, VRAM, network throughput |
| `library` (fallback) | the `systeminformation` npm package (MIT, no dependencies) | CPU load/clock, RAM, GPU load/temp/power, VRAM, disk capacity, network throughput, plus every key LHM could not answer |

- LHM is an optional external prebuilt program. Vigilia reads the JSON its
  server publishes; it never links or compiles its .NET library, and it stops
  only processes it started itself.
- LHM answers `SensorType` values, and `RawValue` is the consistent number to
  read (`Value` is a formatted display string). LHM writes `"NaN"` for a sensor
  it cannot read; that is a gap, never a zero.
- Two LHM traps are handled explicitly: `Used Space` is typed `Load` yet carries
  a **percentage**, so `disk.used` is derived from `Total Space` minus
  `Free Space`, both of which are GB; and `SensorType.Data` is already GB while
  `Throughput` is bytes per second, so only the latter is converted (to Mb/s).
- The `library` provider sums capacity across mounted filesystems and throughput
  across interfaces, so a multi-volume or multi-NIC machine reports totals.

`network.download` and `network.upload` now have real providers; they are no
longer reported through `/api/health`'s `unmapped`.

## Not implemented yet

- LibreHardwareMonitor is not yet packaged with the host, and its coexistence
  with Vanguard/EAC/BattlEye remains unverified;
- provider/user mapping UI;
- theme storage/editor save-to-host;
- LAN onboarding polish: the launcher prints a pairing link, but there is no
  in-editor device list or QR-code flow, and no physical-phone test;
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

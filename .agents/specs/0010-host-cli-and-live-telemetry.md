# 0010 — Host, CLI and live telemetry

- **Status:** accepted
- **Design document sections:** §93, §95, §97, §111, §116, §120, §122, §141, §160
- **Specs superseded:** the Python draft that previously occupied this file
  (`0009-python-telemetry-host-and-sensor-providers.md`). Its provider contract,
  semantic-key rules, LHM handling, mapping ownership and failure isolation are
  **kept verbatim in intent**; only the runtime changed. See
  [ADR-0007](../decisions/0007-host-in-node-shipped-as-a-cli.md).

**Implementation state**, because this spec is wider than one milestone:

| Section | State |
|---|---|
| CLI launcher | implemented |
| HTTP server and bundle serving | implemented |
| SSE transport, keep-latest | implemented |
| OS baseline provider — **CPU and RAM only** | implemented |
| OS baseline provider — disk and network | **not implemented** |
| Provider contract and registry | implemented |
| LHM extended provider | **not implemented** — contract only |
| Theme storage, starter theme, editor save-to-host | **not implemented** |
| Pairing codes, LAN opt-in | **not implemented** — binds loopback; `--host` is the only opt-in |
| C# removal | done — the tree, its solution, `global.json` and the CI backend job are deleted |

## Problem

The frontend is shippable and the player renders **invented numbers**. There is
no host and no transport, so the product's whole point — real hardware readings
on a phone over local Wi-Fi — has never once worked.

The previous backend was a C# scaffold that never compiled, then a Python draft
that produced no code. ADR-0007 settles the runtime: Node/TypeScript in the
existing workspace, shipped as an npm CLI.

## Behaviour

### The CLI is the product's front door

One command starts everything:

```bash
npx vigilia-dashboard                # once published
node packages/host/bin/vigilia.js    # from src/web/, today
```

**The binary is `vigilia-dashboard`** (decided 2026-09-13). Plain `vigilia`
belongs to an unrelated package on the public registry, so `npx vigilia` fetches
a stranger's CLI and crashes on Windows with `spawn man ENOENT` — which a user
hit. Nothing is published yet (`@vigilia/host` is `private`), so the repo-local
command above is what works today.

It resolves a port, starts the HTTP and WebSocket server, waits until the port
actually accepts a TCP connection — not a fixed sleep — and only then opens the
browser and prints the URLs.

| Flag | Effect |
|---|---|
| `--port <n>` / `-p` | Preferred port. Default 5227 |
| `--host <addr>` / `-H` | Bind address. Default `127.0.0.1` |
| `--no-browser` / `-n` | Do not open a browser |
| `--version` / `-v`, `--help` / `-h` | Print and exit |

**Port fallback is bounded and reported.** If the preferred port is taken, the
CLI tries the next few and prints the port it actually bound. Silently landing
somewhere else is worse than failing, because the phone is told a URL by a
human reading this output.

**Binding is loopback by default, and that is a deliberate divergence** from the
launcher this was modelled on. §7 requires LAN serving to start disabled with
explicit interface selection; a default that listens on every interface is a
default that exposes hardware telemetry to a hotel network. When `--host` is
given a non-loopback address the CLI prints the reachable LAN address and says
plainly that the network can now reach it.

**A stopped host cannot restart itself** (§7). Process lifetime belongs to the
terminal — and later the tray — never to the website it serves.

### Serving

The player and editor are served from their built `dist/` directories. If a
bundle is missing the CLI says which one and what to run, because a blank page
is indistinguishable from a crash.

- `/` → the player
- `/editor` → the editor
- `/api/sensors` → discovered sensor descriptors
- `/ws` → the sample stream

### Transport

**Server-Sent Events**, not a WebSocket. SignalR and MessagePack are not
retained either — they were chosen for a C# host that no longer exists.

Telemetry is push-only: the host sends samples and a display never sends one
back. SSE is that exactly, over the HTTP server already running, with
`EventSource` reconnection built in and **no dependency** — where a WebSocket
server in Node needs one whose bidirectionality would go unused. When a display
eventually needs to talk back (pairing, declaring keys), that is a POST, not a
reason to change transport.

The wire contract lives in `renderer-core/src/data/protocol.ts` — **in the
shared library, imported by both ends**, not defined by the host and mirrored
into the client. That is the concrete thing ADR-0007 was chosen for.

The server pushes a batch of samples per cycle. Framing is versioned so an old
client meets a clear refusal rather than a misparse (§141).

**Slow clients get keep-latest** (§111, §122): at most one pending snapshot per
client. A client that cannot keep up receives the *newest* state, never a
replayed backlog of stale telemetry. Telemetry has no value once superseded, so
queueing it trades memory for staleness.

**The host subscribes to the union of keys active clients need** and polls once
at the required cadence (§111). Opening a second phone must not double upstream
polling.

**The renderer's side of this already exists and does not change.**
`SampleSource` is a pull interface; `SampleStore` is the bounded buffer the
transport fills. The player swaps one thing — its `source` — exactly as
ADR-0006 anticipated.

### Provider contract

Providers acquire; the host schedules and publishes. A provider must never start
a timer, cache history, or push.

Each provider supplies: sensor discovery, stable provider-local sensor IDs,
metadata and units, current samples, and its own availability/health.

**Provider tree or array position is never identity.** Use the strongest stable
identifier the provider exposes — position shifts when hardware is added.

### Themes bind to semantic keys, never to providers (§93)

```text
cpu.load          cpu.temp.package   cpu.power.package
gpu.0.load        gpu.0.temp         gpu.0.power
ram.used          network.download
```

Changing the source behind a semantic key must not require editing a theme.

### OS baseline provider

The default provider. Needs no separate monitoring application, no driver and
no elevation.

**Implemented: CPU load and RAM**, from Node built-ins — `os.cpus()` diffed
across an interval, `os.totalmem`/`freemem`. Semantic keys `cpu.load`,
`ram.used`, `ram.used.percent`, `ram.total`.

`os.cpus()` reports **cumulative** tick counters, not a rate, so load is the
change in busy ticks over the change in total ticks between two cycles. The
first cycle after start has nothing to diff against and reports `missing` with
a reason — **not zero**, which would render as a genuinely idle CPU on every
host start (§83).

**Not implemented: disk and network.** These need more than a built-in;
`systeminformation` is the intended source (pure JavaScript, no native build
step) and would be the host's first runtime dependency, so it needs a
THIRD-PARTY-NOTICES entry before it is added.

**Vigilia remains functional when this is the only available provider**, and
this provider is preferred for baseline OS metrics even when another provider
exposes an equivalent reading — so a dashboard of baseline metrics never
acquires a dependency on LibreHardwareMonitor for data the OS already exposes
reliably.

### LibreHardwareMonitor extended provider — contract only, not implemented

Supplies temperatures, clocks, power, voltages, fan speeds and motherboard
sensors where available.

Vigilia does **not** reference `LibreHardwareMonitorLib.dll` and does not compile
LHM. LHM runs as a separate prebuilt executable and Vigilia reads its local HTTP
sensor endpoint.

- **One complete sensor-tree read per sampling cycle**, never one request per
  sensor.
- Optional. If unavailable its semantic keys go `stale`, then `missing`. **No
  value is fabricated** (§97).
- Either attaches to an LHM already running with its web server enabled, or
  launches a configured executable.
- **May stop LHM on shutdown only when Vigilia started that process.** Never
  terminates a user-owned instance.

Bundling or auto-downloading LHM is a packaging decision outside this spec.

### Sensor mapping ownership

| Metric class | Preferred source |
|---|---|
| CPU load, memory, disk usage/I/O, network | OS baseline |
| Temperature, fan speed, voltage | LHM |
| CPU/GPU power, hardware clocks, motherboard | LHM |

Users may override mappings later.

### Failure isolation

A provider failure must not stop telemetry from other providers. If LHM is
absent, not running, has its web server disabled, stops responding or returns
malformed data, it goes unavailable/error while the baseline provider keeps
running. Last-known values may be briefly `stale`, then `missing`. **Zero is
never substituted for unavailable data** (§83).

### C# removal — **done, 2026-09-13**

The Node host replaced rather than wrapped the C# scaffold. Removed with it
(26 tracked files, none of which had ever compiled):
`Vigilia.Host`, `Vigilia.Core`, `Vigilia.Contracts`, the C# provider and
platform projects, `Vigilia.slnx`, `global.json`, the `Directory.Build.props`
platform enforcement, the paused `backend` CI job, and
`contracts-mirror.test.ts` — whose subject no longer exists.

Behavioural ideas from the scaffold may be reimplemented; the unexecuted code is
not a compatibility target. `renderer-core`'s TypeScript types are now the
single definition, imported by the host rather than mirrored into it.

## Out of scope

- Reimplementing LHM's hardware access, or loading its .NET library.
- Requiring a .NET SDK or Python.
- HWiNFO, AIDA64, MSI Afterburner — roadmap, behind the same provider contract.
- Hardware control, overclocking, fan control.
- Third-party code plugins.
- Auto-download/update/install of LHM.
- Cross-platform telemetry beyond keeping the provider contract
  platform-neutral.

## Acceptance

| Behaviour | Test |
|---|---|
| Argument parsing, defaults, port fallback bounds | `cli/args.test.ts` |
| Loopback is the default bind, LAN is opt-in | `cli/args.test.ts` |
| A sample batch frames and parses round-trip | `transport/protocol.test.ts` |
| A version mismatch is refused, not misparsed | `transport/protocol.test.ts` |
| Keep-latest keeps one pending snapshot, newest wins | `transport/keep-latest.test.ts` |
| CPU load is derived by diffing, never absolute ticks | `providers/os.test.ts` |
| An unreadable metric reports status, never zero (§83, §97) | `providers/os.test.ts` |
| Registry isolates one provider's failure from another | `providers/registry.test.ts` |
| The union of active keys is polled once per cycle | `providers/registry.test.ts` |
| Backend runs with no .NET SDK and no Python | the suite runs on Node alone |
| URL path traversal is refused (§141) | `serve/static-path.test.ts` |
| A display refuses an incompatible host instead of reconnecting forever | `renderer-core/data/live-source.test.ts` |
| The transport never fabricates a value for an unmapped key (§97) | `live-source.test.ts`, `registry.test.ts` |

### Observed end to end, on this machine

Executed 2026-09-13 against `npx vite build packages/host` on Node 25.9.0:

- `/api/sensors` lists the four baseline descriptors with their provider id.
- The SSE stream delivered **real readings** — 63.68 GB total memory, ~61%
  used, CPU load varying 5–15% across cycles.
- The **first cycle reported `cpu.load` as `missing` with a reason and no
  value**, then `ok` from the second cycle on. §83's rule, observed rather than
  asserted.
- `gpu.temp`, requested but unsupplied, was **absent from the batch** — a gap,
  not a zero (§97).
- `/api/health` reported `{displays: 1, polling: ["cpu.load"]}` — the union is
  only what connected displays asked for.
- A headless browser at `/` was redirected to `?data=live`, reached
  `status: live`, and accumulated history through the pull interface.
- `/editor` served to loopback; an encoded traversal got 403; `POST` got 405.

### The finding that blocks a good first run

**The only bundled theme is a dev fixture, and it renders almost entirely as
gaps against real baseline data.** `demo-theme.json` binds eight keys: one
(`cpu.load`) the OS provider supplies, one (`ram.used`) that was the same
quantity under a *different name* from this spec's original `memory.used`, five
extended-tier keys needing LHM, and one deliberately unmapped.

It also **hardcodes "32 GB installed"** with a fixed pie total of 32, so a key
rename alone would not fix the first run — it would render "63.7 / 32 GB" on
this machine, a dashboard lying about the hardware. That is worse than a gap
and exactly what §97 exists to prevent.

Two things followed, and both are now done:

1. **The semantic key vocabulary has one owner**, at
   `renderer-core/src/data/semantic-keys.ts`. The split is resolved in favour
   of **`ram`**, by user decision on 2026-09-13: `ram` and `vram` are separate
   families, so neither needs a qualifier to stay unambiguous, whereas
   `memory.*` would need one the moment video memory arrived. The fixtures
   already used `ram.used` and `vram.used`, so the host was renamed to agree
   with them rather than the reverse. This spec's earlier `memory.*` spelling
   is superseded throughout.

   The vocabulary declares **names, not availability** — an unsupplied key
   still renders as a gap (§97), and `expectedTier` is a hint for an author,
   not a claim about the current machine.
2. **A starter theme built for real baseline keys**, served by the host, with
   no hardcoded capacities. The demo fixture stays what it is — a showcase of
   gap, outage and overflow cases for the renderer.

**Still undecided:** how to address a second device of the same family. The
`gpu.0.load` form sketched above is illustrative only; no indexed form is
declared until a provider needs one.

**Not verified.** Nothing has run on a real phone — a viewport is not a device.
The LHM provider is a contract with no implementation, so every extended-tier
row above is unproven. No pairing, and **no LAN bind has been exercised**: the
`--host` path, the LAN address print and the editor's 403 for a non-loopback
peer are all source-level only, tested from loopback alone. Slow-client
keep-latest is unit-tested but **has never been driven by a genuinely slow
socket**. Sample rates are the 1 s baseline chosen in `SampleStore`, **not a
measured budget** — §126 still has no named reference hardware.

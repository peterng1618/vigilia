# Vigilia

Windows-first hardware-monitoring dashboards: the PC collects sensor data and
serves a local site; desktop authors dashboards and phones display them over
local Wi-Fi.

> **Early and unstable.** Authoring, rendering, packaging and LAN display work
> end to end; the persisted theme format may still change before the first
> release. Nothing is published yet.

## Run

From `src/web/`:

```bash
npm install
npm run build
node packages/host/bin/vigilia.js
```

The host defaults to `http://127.0.0.1:5227`. The editor is at `/editor`.

CLI package name: `vigilia-dashboard` (`vigilia` on npm is unrelated).

## Sensors

Metrics come from sources that already exist; Vigilia does not implement its own
hardware collector.

- **Baseline** (CPU load and clock, memory, GPUs, disks, network) comes from the
  [`systeminformation`](https://www.npmjs.com/package/systeminformation) package
  and works with no setup.
- **Extended** sensors (CPU temperature, fans, power, per-GPU detail) come from
  [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor)
  when it is running. LHM is an optional external program: Vigilia reads the
  JSON its web server publishes and never controls your hardware.

  Run LHM yourself and enable **Options → Run web server** (port 8085), or let
  Vigilia start a copy for you:

  ```bash
  npm run vendor:lhm -w @vigilia/host   # stages the pinned release
  node packages/host/bin/vigilia.js --lhm-exe packages/host/vendor/lhm/LibreHardwareMonitor.exe
  ```

  Keys with no reading stay empty with a stated reason; Vigilia never invents a
  number. `node packages/host/bin/vigilia.js --help` lists the LHM flags.

## Show a dashboard on your phone

LAN serving is **off by default**. To turn it on:

```bash
node packages/host/bin/vigilia.js --host 0.0.0.0
```

The host prints a pairing link containing a short-lived token (12 hours). Open
that link on the phone. Only paired devices can read a dashboard from the LAN;
pairing itself is localhost-only, and `Ctrl+C` or the printed `curl -X DELETE`
revokes a token sooner. Plain LAN HTTP has no confidentiality, so use it on
trusted networks only — never the internet.

## Docs

Start with [`AGENTS.md`](AGENTS.md) and [current status](.agents/status.md).
Read [product requirements](.agents/product-requirements.md),
[architecture](.agents/architecture.md), [decisions](.agents/decisions.md) and
[active specs](.agents/specs/) as needed. Active implementation plans live in
[`docs/superpowers/plans/`](docs/superpowers/plans/).
Licences: [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
